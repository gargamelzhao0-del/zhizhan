# 与 C 互操作

```zhizhan-anchor
m09
```



真实项目几乎不可能"全 C\+\+"：HAL、RTOS、DSP 库、启动文件都是 C/汇编，很多底层代码还会长期保留 C。 这一节讲清 ` extern "C" ` 到底做了什么、结构体布局什么时候能跨语言、以及混合链接怎么写。

 

> ◷ 约 50 分钟 · ◈ extern "C" / ABI · ⚑ 混合工程的必修

 

```zhizhan-anchor
m09-1
```



## 9.1 ` extern "C" `：把名字修饰关掉

 

C\+\+ 支持函数重载，所以编译器会把 **参数类型编码进符号名** （名字修饰 / name mangling）。 例如 ` void uart_write(int) ` 在 C\+\+ 里的符号可能是 ` _Z10uart_writei `， 而在 C 里就是 ` uart_write `。两边对不上，链接器就找不到符号。 ` extern "C" ` 告诉编译器：" **这个名字按 C 规则生成，不要修饰** "。

 

crc\_link.hpp — 一个可被 C 和 C\+\+ 共用的头文件 C\+\+

 

```text
// crc_link.hpp —— 经典的"两面兼容"头文件写法
#ifndef CRC_LINK_HPP
#define CRC_LINK_HPP
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* 这些函数对 C 和 C++ 都暴露同一个符号名 */
uint8_t crc8_link(const uint8_t* d, uint32_t n);
uint32_t version_link(void);

#ifdef __cplusplus
}
#endif
#endif /* CRC_LINK_HPP */
```

 

crc\_link.cpp — 用 C\+\+ 实现，但导出 C 符号 C\+\+

 

```text
// crc_link.cpp —— 实现可以是 C++（类、模板、constexpr 都在），出口是 C 符号
#include "crc_link.hpp"
#include <array>

namespace {
consteval std::array<uint8_t, 256> make_table() {
    std::array<uint8_t, 256> t{};
    for (int i = 0; i < 256; i++) {
        uint8_t c = (uint8_t)i;
        for (int b = 0; b < 8; b++) c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
        t[i] = c;
    }
    return t;
}
constexpr auto TABLE = make_table();
}  // namespace

extern "C" uint8_t crc8_link(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) c = TABLE[c ^ *d++];
    return c;
}
extern "C" uint32_t version_link(void) { return 0x00010000u; }
```

 

**bash**  — 复跑：` bash tools/probes/m09.sh `（Arm GNU Toolchain 13.3.1，cortex-m3）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c drv_cpp.cpp -o drv_cpp.o

# ① 目标文件里真实存的名字（不加 --demangle）：
$ arm-none-eabi-nm drv_cpp.o
  00000010 T _Z17drv_close_mangledm   # ← 修饰过的名字，C 侧看不见
  00000000 T drv_open                 # ← extern "C"：裸名
  00000000 B g_calls

# ② 同一份符号，C++ 读法（--demangle 只是把它还原给人看，不改变 .o 里存的内容）：
$ arm-none-eabi-nm --demangle drv_cpp.o
  00000010 T drv_close_mangled(unsigned long)
  00000000 T drv_open
  00000000 B g_calls

# ③ 用 C 编译器编译调用方（gcc 不认 C++ 语法，所以调用方必须是真的 .c）
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -std=c11 -Wall -Wextra -c main_c.c -o main_c.o

# ④ 混合链接：用 g++ 当链接器，把两份 .o 拼成一个可执行文件
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -nostdlib -Wl,-e,main drv_cpp.o main_c.o -o mixed.elf
$ arm-none-eabi-size mixed.elf
   text    data     bss     dec     hex filename
     40       0       8      48      30 mixed.elf

# ⑤ 验证 C 侧的 main 确实通过裸名 drv_open 跳进了 C++ 实现：
$ arm-none-eabi-objdump -d --demangle mixed.elf
  b508        push    {r3, lr}
  2029        movs    r0, #41    @ 0x29
  f000 f806   bl      8014 <drv_open>   # ← 裸名直接落地，没有任何转换层
  4b01        ldr     r3, [pc, #4]
  6018        str     r0, [r3, #0]
  6818        ldr     r0, [r3, #0]
  bd08        pop     {r3, pc}

# ⑥ 反面验证：C 侧去调那个没加 extern "C" 的函数，会怎样？
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -std=c11 -Wall -Wextra -c main_c_bad.c -o main_c_bad.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -nostdlib -Wl,-e,main drv_cpp.o main_c_bad.o -o bad.elf
…/arm-none-eabi/bin/ld.exe: main_c_bad.o: in function `main':
main_c_bad.c:(.text.startup+0x2): undefined reference to `drv_close_mangled'
collect2.exe: error: ld returned 1 exit status
# 注意：C 侧编译毫无怨言（它只是声明了一个外部函数），
# 错误到链接期才爆出来 —— 因为 C++ 侧导出的是 _Z17drv_close_mangledm，
# 从来没有哪个 .o 提供过 drv_close_mangled 这个名字。
```

 

◆ 记住三句话

 

 
- ` extern "C" ` 只影响 **链接名** ，不影响函数体 —— 里面照样能用类、模板、` constexpr `。
 
- 它 **不能** 修饰成员函数。对 **重载** 函数，准则是" **同名最多只能有一个 ` extern "C" ` 版本** "（其余重载仍走 C\+\+ 链接），并不是整个重载集都加不了。
 
- **最该防的坑** ：两个不同 TU（或两个命名空间）各写一个 **同名 ` extern "C" `**  函数 —— 各自 TU 内编译都不报错，到汇编/链接期才爆 ` symbol is already defined `。因为 C 链接名是全局唯一的裸名，没有命名空间/重载可区分。

 

**FIG 9.1**  编译单元与链接边界：` extern "C" ` 改的到底是什么 （符号名与链接结果均为 ` nm ` / ` ld ` 实读）

 

```zhizhan-figure
<svg viewBox="0 0 660 272" role="img" aria-label="C++ 编译单元与 C 编译单元各自的符号表，以及链接器如何按名字逐字配对，修饰名导致链接失败">
          <!-- 列表头 -->
          <text x="109" y="34" class="sv-lbl-hi" style="fill:var(--cyn)" text-anchor="middle">C++ 编译单元</text>
          <text x="109" y="50" class="sv-lbl-dim" text-anchor="middle">drv_cpp.cpp → drv_cpp.o</text>
          <text x="339" y="34" class="sv-lbl-hi" style="fill:var(--cyn)" text-anchor="middle">C 编译单元</text>
          <text x="339" y="50" class="sv-lbl-dim" text-anchor="middle">main_c.c → main_c.o</text>
          <text x="560" y="34" class="sv-lbl-hi" style="fill:var(--grn)" text-anchor="middle">链接结果</text>
          <text x="560" y="50" class="sv-lbl-dim" text-anchor="middle">mixed.elf · text 40 B</text>

          <!-- C++ 侧符号表 -->
          <rect x="16" y="60" width="186" height="76" rx="4" class="sv-box"></rect>
          <text x="28" y="80" class="sv-lbl" style="fill:var(--grn)">T  drv_open</text>
          <text x="28" y="98" class="sv-lbl" style="fill:var(--red)">T  _Z17drv_close_mangledm</text>
          <text x="28" y="118" class="sv-lbl-dim">↑ 同一份 .cpp 里的两个函数</text>

          <!-- C 侧符号表 -->
          <rect x="246" y="60" width="186" height="76" rx="4" class="sv-box"></rect>
          <text x="258" y="80" class="sv-lbl" style="fill:var(--grn)">U  drv_open</text>
          <text x="258" y="98" class="sv-lbl-dim">（没有 _Z17… 这一条）</text>
          <text x="258" y="118" class="sv-lbl-dim">C 编译器只会写裸名</text>

          <!-- 链接结果 -->
          <rect x="476" y="60" width="168" height="76" rx="4" class="sv-grn-s"></rect>
          <text x="488" y="80" class="sv-lbl" style="fill:var(--grn)">bl  8014 &lt;drv_open&gt;</text>
          <text x="488" y="98" class="sv-lbl-dim">裸名直接落地</text>
          <text x="488" y="118" class="sv-lbl-dim">无转换层 / 无 thunk</text>

          <!-- 配对：绿 -->
          <line x1="204" y1="80" x2="242" y2="80" class="sv-arrow"></line>
          <line x1="434" y1="80" x2="472" y2="80" class="sv-arrow"></line>
          <!-- 失配：红 -->
          <line x1="204" y1="98" x2="242" y2="98" class="sv-dash" stroke="var(--red)"></line>
          <text x="223" y="92" class="sv-lbl" text-anchor="middle" style="fill:var(--red)">✕</text>
          <text x="223" y="114" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--red)">配不上</text>

          <!-- 下排：各自"边界上的约束" -->
          <rect x="16" y="152" width="186" height="52" rx="4" class="sv-box"></rect>
          <text x="28" y="172" class="sv-lbl-dim">函数体里随便用：</text>
          <text x="28" y="190" class="sv-lbl-dim">类 / 模板 / consteval</text>
          <rect x="246" y="152" width="186" height="52" rx="4" class="sv-box"></rect>
          <text x="258" y="172" class="sv-lbl-dim">它只认得裸名，</text>
          <text x="258" y="190" class="sv-lbl-dim">看不到修饰名</text>
          <rect x="476" y="152" width="168" height="52" rx="4" class="sv-box"></rect>
          <text x="488" y="172" class="sv-lbl-dim">链接器只做一件事：</text>
          <text x="488" y="190" class="sv-lbl-dim">把 T 与 U 逐字配对</text>

          <line x1="16" y1="220" x2="644" y2="220" class="sv-dash"></line>

          <!-- 图例 -->
          <line x1="20" y1="234" x2="58" y2="234" class="sv-arrow"></line>
          <text x="68" y="238" class="sv-lbl-dim" style="fill:var(--grn)">名字逐字相同 → 配对成功，调用直接落地，跨语言边界零开销</text>
          <line x1="20" y1="256" x2="58" y2="256" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 4"></line>
          <text x="68" y="260" class="sv-lbl-dim" style="fill:var(--red)">名字对不上 → C 侧编过、链接期 undefined reference（本机复现过）</text>
        </svg>
```

 

这张图只讲一件事： **` extern "C" ` 是给链接器看的，不是给编译器看的** 。 左列的 ` drv_open ` 与 ` drv_close_mangled ` 出自同一份 ` .cpp `、同一个命名空间， 唯一的区别就是前者写了 ` extern "C" `——于是它在 ` .o ` 里叫 ` drv_open `， 后者叫 ` _Z17drv_close_mangledm `（` 17 ` 是名字长度，末尾 ` m ` 是 ` unsigned long `）。 C 侧 **没有任何办法** 写出后面那个名字，所以它只能请求裸名： 配上了就是右边那条 ` bl 8014 <drv_open> `——没有桩函数、没有封送、没有开销； 配不上就是下面那条红虚线—— **链接期直接失败** ，而且 C 侧编译时 **毫无警告** 。 这也解释了为什么 ` extern "C" ` 只该出现在 **出口** 上：内部实现爱用什么 C\+\+ 特性都行，边界只有一个名字问题。

 

```zhizhan-anchor
m09-2
```



## 9.2 结构体布局：什么时候能跨语言传

 

C 和 C\+\+ 之间传结构体，前提是 **双方看到的内存布局完全一致** 。C\+\+ 的"标准布局类型（standard-layout）"能满足这一点， 但一旦引入虚函数、多重继承、访问控制混排，布局就不再与 C 兼容。

 

| 类型特征 | 能安全地跨 C/C\+\+ 传吗 |
| --- | --- |
| 纯 POD（无虚函数、无访问控制、无基类） | 能（与 C 结构体布局一致） |
| 含 ` private `/` public ` 混排成员 | 标准布局性可能被破坏 → 不要跨语言传 |
| 含虚函数（有 vptr） | 不能（C 侧没有 vptr 的概念） |
| 含基类 | **通常不能** ；但"恰好含一个标准布局基类、且派生类无非静态数据成员" **仍可能是标准布局**  → 必须用 trait 具体断言，别凭经验 |
| ` enum class `（且指定 ` : uint8_t `） | 能，但 C 侧 **必须用匹配的 ` uint8_t `** （C 的普通 ` enum ` 底层宽度是实现定义的 ` int `，对不上） |

 

⚠ "能跨语言传"的充分条件（不只是标准布局）

 

光"标准布局"还不够，两边还必须 **逐项一致** ： **成员顺序与类型** 一致、 **位域宽度与顺序** 一致、  **结构体对齐/pack** 一致（如 C 侧用了 ` #pragma pack `）、 **` bool ` 与 ` enum ` 的底层宽度** 一致。 只断言 ` sizeof ` 不够 —— 总大小相同、偏移却不同也能骗过你；要连 ` offsetof ` 一起断言（见下）。

 

abi\_check.cpp — 用 trait 与断言把"可跨语言"钉死 C\+\+

 

```text
// abi_check.cpp —— 编译期确认"这个结构体能安全地给 C 用"
#include <cstdint>
#include <cstddef>
#include <type_traits>

struct Frame {              // 纯 POD，用于跨语言传递
    uint8_t  addr;
    uint8_t  len;
    uint16_t crc;
};

static_assert(std::is_standard_layout<Frame>::value, "必须标准布局才能给 C 用");
static_assert(std::is_trivially_copyable<Frame>::value, "必须可平凡拷贝");
static_assert(sizeof(Frame) == 4, "布局要与协议一致（本例 4 字节）");
// 只断 sizeof 不够：偏移也要钉住（总大小相同、偏移不同同样会错位）
static_assert(offsetof(Frame, addr) == 0, "addr 必须在偏移 0");
static_assert(offsetof(Frame, len)  == 1, "len  必须在偏移 1");
static_assert(offsetof(Frame, crc)  == 2, "crc  必须在偏移 2");
```

 

```zhizhan-anchor
m09-3
```



## 9.3 ` std::atomic ` 与 C11 ` _Atomic `

 

C11 的 ` _Atomic ` 与 C\+\+ 的 ` std::atomic ` 都表达"原子类型"，但 **它们的 ABI 不保证一致** ： 同一块共享内存被一边当 ` _Atomic int `、另一边当 ` std::atomic<int> ` 访问，属于未定义行为。

 

⚠ 跨语言共享原子量的正确做法

 

 
- 要么 **整块由一侧代码掌管** （另一侧只通过函数访问，不直接读那个变量）。
 
- 要么在 **边界处用明确的函数接口** （` extern "C" int counter_get(void) `），把原子操作关在实现里。
 
- 别指望"C 侧 ` _Atomic `、C\+\+ 侧 ` std::atomic ` 指向同一个变量"能正常工作。

 

```zhizhan-anchor
m09-4
```



## 9.4 混合链接：Makefile 要点

 

| 要点 | 说明 |
| --- | --- |
| 分别用 ` gcc `/` g++ ` 编译 | ` .c ` 用 C 编译器、` .cpp ` 用 C\+\+ 编译器，各自带对应标准 |
| **用 ` g++ ` 链接** | 链接阶段要拉入 C\+\+ 运行库（` libstdc++ `）；用 ` gcc ` 链可能报缺 C\+\+ 符号（何时真的需要，见下） |
| **影响 ABI 的选项要一致** | ` -mcpu/-mthumb/-mfloat-abi/-mabi/-fshort-enums `、` #pragma pack `、位域与 ` enum ` 底层宽度都要一致。 *注意：` -fno-exceptions/-fno-rtti ` 是  **C\+\+ 专属选项** ，只作用于 C\+\+ 代码，与 C 编译单元无关（传给 ` gcc ` 编 ` .c ` 只会告警）。* |
| 头文件加 ` __cplusplus ` 守卫 | 让同一个头文件被 C 和 C\+\+ 都能包含（§9.1） |
| 启动文件/向量表 | 是汇编/C，照旧；C\+\+ 的全局构造靠 ` __libc_init_array `（第①册 Module 04）。 **若用 ` -nostartfiles ` 或自写启动文件，必须在 ` Reset_Handler ` 里显式调用它，否则所有 C\+\+ 全局构造都不执行。** |

 

⚠ "必须用 g\+\+ 链接"要看情况

 

§9.1 的探针用 ` -nostdlib ` 链出 ` mixed.elf ` —— 那份代码没有全局构造、不用异常、不碰 ` libstdc++ `，所以 C 编译器也能链。 但只要用到  **C\+\+ 运行时设施** （全局对象构造、异常、` new `、` libstdc++ ` 组件），就必须用 ` g++ ` 链接（或显式补 ` -lstdc++ ` 与 ` __libc_init_array `），否则报缺符号。

 

Makefile.mixed — C 与 C\+\+ 混合编译、用 g\+\+ 链接 Makefile

 

```text
# 混合工程：C 与 C++ 分别用各自编译器，最后用 g++ 链接
TARGET   := app
LDSCRIPT := linker.ld            # 你的链接脚本
OBJS     := main_c.o drv_cpp.o   # 实际项目里用通配/变量收集
CC   := arm-none-eabi-gcc
CXX  := arm-none-eabi-g++
CPU  := -mcpu=cortex-m3 -mthumb

# 让 --gc-sections 能按函数/数据回收（配合链接期的 -Wl,--gc-sections）
SECT := -ffunction-sections -fdata-sections

CFLAGS   := $(CPU) -std=c11   -Os -Wall -Wextra $(SECT)
CXXFLAGS := $(CPU) -std=c++20 -Os -Wall -Wextra $(SECT) \
            -fno-exceptions -fno-rtti -fno-threadsafe-statics -fno-use-cxa-atexit
LDFLAGS  := $(CPU) -T$(LDSCRIPT) -nostartfiles -Wl,--gc-sections \
            --specs=nano.specs --specs=nosys.specs

%.o: %.c
	$(CC)  $(CFLAGS)   -c $< -o $@
%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

# ★ 链接必须用 $(CXX)：它会把 libstdc++ 一起拉进来。
#   若这里用 $(CC)，含 C++ 目标文件时会报一堆缺的 C++ 运行库符号。
#   （若整个工程完全不依赖 C++ 运行库，才可改用 $(CC) + -nostdlib。）
$(TARGET).elf: $(OBJS)
	$(CXX) $(LDFLAGS) $^ -o $@

# ⚠ 用了 -nostartfiles / 自写启动文件时：Reset_Handler 里记得 `bl __libc_init_array`，
#   否则所有 C++ 全局对象都不会被构造。
```

 

✔ 迁移的现实路径

 

最稳的迁移是 **自下而上、逐文件** ：先把一个纯逻辑模块改成 C\+\+（导出 ` extern "C" ` 接口）， 其余 C 代码完全不用动。跑通、验证、再迁下一个。 *不要一次性"把整个工程改成 C\+\+"。*

 

✔ 变量与链接性：不止函数

 

 
- **命名空间作用域的变量** 同样 **不被名字修饰** ：C 侧可以直接链接 C\+\+ 定义的全局变量（前提是类型/布局一致）。探针里的 ` g_calls ` 就是证据。
 
- 但 ` const `/` constexpr ` 的命名空间作用域变量默认是 **内部链接** （每个 TU 各一份），不能这样跨语言共享；要共享得显式写 ` extern `，并保证 **只有一个定义** 。
 
- 需要固定 C 名字的变量，用 ` extern "C" ` 修饰声明（如 ` extern "C" int g_flag; `），保证裸名与单一实体。

 

```zhizhan-anchor
m09-5
```



## 9.5 ` extern "C" ` 与名称修饰

 

**FIG 9.2**  ` extern "C" ` 关掉 C\+\+ 名称修饰以对接 C

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="C++ 会修饰函数名以支持重载，跨语言边界需用 extern " c"="" 统一符号名"="">
          <rect x="30" y="40" width="220" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="140" y="63" class="sv-lbl-hi" text-anchor="middle">C++ 编译：名字被修饰</text>
          <text x="140" y="83" class="sv-lbl-dim" text-anchor="middle">_Z3addii</text>
          <path d="M250 68 L300 68" class="sv-arrow"></path>
          <rect x="302" y="40" width="240" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="422" y="63" class="sv-lbl-hi" text-anchor="middle">extern "C"：名字不修饰</text>
          <text x="422" y="83" class="sv-lbl-dim" text-anchor="middle">add —— C 侧按此名链接</text>
        </svg>
```

 

不给接口加 ` extern "C" `，C 侧会报 ` undefined reference `。

 

| 边界 | 要做什么 | 否则 |
| --- | --- | --- |
| C\+\+ 调 C 函数 | 在 C\+\+ 里 ` extern "C" ` 声明 | 链接找不到符号 |
| C 调 C\+\+ 函数 | C\+\+ 导出 ` extern "C" ` 包装 | 名称修饰不匹配 |
| 共享头文件 | ` #ifdef __cplusplus ` 包 ` extern "C" ` | 两侧声明不一致 |
| 结构体跨语言 | 用 POD \+ 固定布局 | ABI 不一致 |

 

| 类型 | 能否跨语言传 | 注意 |
| --- | --- | --- |
| POD 结构体 | 能 | 布局/对齐一致 |
| 含虚函数/非平凡类型 | 不能 | ABI 相关 |
| 引用来自 C | — | C 只有指针 |
| 模板类型 | 不能直接 | 需实例化具体类型 |

 

◆ 迁移练习

 

写一个 C 可调用的 ` extern "C" ` 包装函数，用 C 的 ` main ` 链接调用它；去掉 ` extern "C" ` 再看链接报错。

 

◆ 本章要点

 

 
- ` extern "C" ` 关掉名字修饰，让 C 能按名字找到 C\+\+ 定义的函数；它只影响链接名。
 
- 头文件用 ` #ifdef __cplusplus ` 守卫，实现同一个头文件对 C/C\+\+ 双兼容。
 
- 只有 **标准布局 \+ 可平凡拷贝** 的结构体才能安全跨语言传；含虚函数/基类的不能。
 
- ` _Atomic ` 与 ` std::atomic ` 的 ABI 不保证一致：共享量用函数接口隔开。
 
- 混合链接：各自编译、 **用 ` g++ ` 链接** 、ABI 选项统一。
 
- 迁移要 **自下而上、逐文件** ，用 ` extern "C" ` 保持与 C 工程的接缝。

 

◆ 自测 · Module 09（先答再看）

 

 
1. 简答：` extern "C" ` 解决了什么问题？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"解决 C\\+\\+  **名字修饰** 导致的符号名不一致：C 侧按 ` uart_write ` 找，C\\+\\+ 却生成 ` _Z10uart_writei `。加上它后符号名按 C 规则生成，两边能对上。它只影响链接名，不改变函数体。"}
   ```
 
2. 判断：` extern "C" ` 能修饰类的成员函数吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**成员函数不能** （C 没有类概念）。对 **重载** 函数，准则是\"同名最多只能有一个 ` extern \"C\" ` 版本\"，其余重载仍走 C\\+\\+ 链接。要跨语言暴露，通常在类外写一个 ` extern \"C\" ` 的自由函数作为门面。另注意：不同 TU 里写同名 ` extern \"C\" ` 会撞车，报重定义。"}
   ```
 
3. 简答：什么结构体可以安全地跨 C/C\+\+ 传递？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**标准布局 \\+ 可平凡拷贝** 的（纯 POD）结构与 C 结构体布局一致，可以传。含虚函数（有 vptr）、基类、访问控制混排的类型布局与 C 不兼容，不能直接传。可用 ` is_standard_layout `/` is_trivially_copyable ` \\+ ` static_assert ` 钉住。"}
   ```
 
4. 判断：C 侧用 ` _Atomic int `、C\+\+ 侧用 ` std::atomic<int> ` 指向同一变量是安全的。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不安全。两者 ABI 不保证一致，混用是未定义行为。正确做法是用函数接口把原子操作关在一侧，另一侧只通过函数访问。"}
   ```
 
5. 填空：混合工程里，` .c ` 用 \_\_\_\_\_\_ 编、` .cpp ` 用 \_\_\_\_\_\_ 编，链接用 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` arm-none-eabi-gcc ` / ` arm-none-eabi-g++ ` /  **用 ` g++ ` 链接** （保证拉入 C\\+\\+ 运行库）。"}
   ```
 
6. 诊断：` a.cpp ` 与 ` b.cpp ` 各自在不同命名空间里定义了 ` extern "C" void foo(){} `，单独编都过。一起链会怎样？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"报 ` foo is already defined `（汇编/链接期）。因为 ` extern \"C\" ` 生成的是 **全局唯一的裸名** ，命名空间与重载都区分不了它，两个 TU 撞了同一个 C 符号。所以同名 ` extern \"C\" ` 只能有一处定义。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 09 完成？**  把项目里一个纯逻辑模块改成 C\+\+，其余不动，用 ` extern "C" ` 接口接回 C 工程。

 

```zhizhan-assessment
{"id":"course-b02-m09","criterion":"跨 C 边界使用稳定类型与 extern C 链接，异常不得穿过未定义的接口边界。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
