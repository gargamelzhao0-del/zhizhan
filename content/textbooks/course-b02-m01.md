# C++ 在 MCU 上的真实代价

```zhizhan-anchor
m01
```



不重讲语法。这一节只回答一个问题： **从 C 换到 C\+\+，每一样特性能带来什么，又要付出多少** 。 所有数字都来自本机真实工具链（Arm GNU Toolchain 13.3.1）的编译与链接结果，条件随结论一起给出。

 

> ◷ 约 60 分钟 · ◈ 含体积累账实测 · ⚑ 全册的决策基准

 

◆ 一句话立场

 

C\+\+ 在 MCU 上 **既能几乎零成本、也能贵得离谱** ，取决于你用了哪些特性、开了哪些开关。 所以正确的姿势不是"用不用 C\+\+"，而是 **"按账单用"** ：每一项先算清代价，再决定用不用。 这一节就是那张账单。

 

```zhizhan-anchor
m01-1
```



## 1.1 先看账单：一张表

 

下面每一行都是 **本机实测** （` arm-none-eabi-gcc / g++ 13.3.1 `， ` -mcpu=cortex-m3 -mthumb -Os `）。测的是编译出来的 ` .o ` 目标文件里的 ` text ` 段字节数（` arm-none-eabi-size ` 读出）—— 它反映"这段代码本身有多大"，不含链接后才能看到的库开销。

 

| 实验 | 文件 | text 字节 | 条件 |
| --- | --- | --- | --- |
| C 版 UART 驱动 | ` drv.o ` | 68 | ` -std=c11 ` |
| C\+\+ 版（关异常/RTTI） | ` drv_noex.o ` | 40 | ` -std=c++20 -fno-exceptions -fno-rtti ` |
| C\+\+ 版（默认：开异常\+RTTI） | ` drv_ex.o ` | 48 | ` + -fexceptions -frtti ` |
| 函数指针表调用 | ` vc.o ` | 10 | ` -std=c11 ` |
| 虚函数调用 | ` vx.o ` | 6 | ` -std=c++20 -fno-exceptions -fno-rtti ` |
| 最小 C\+\+ 函数 | ` bare.o ` | 4 | — |
| 含 ` <iostream> `（补 syscall 桩后链接成功） | ` io.elf ` | 574788 | ` --specs=nosys.specs `；此行为 **整镜像 text\+data** ，与上面各 ` .o ` 不同口径。不补桩则 12 处 ` undefined reference `（见 §1.3.3） |

 

**bash**  — 复跑：` bash tools/probes/m01.sh `（Arm GNU Toolchain 13.3.1；就是本节的 drv\_c.c / drv\_cpp.cpp）

 

```text
$ arm-none-eabi-gcc    -mcpu=cortex-m3 -mthumb -Os -std=c11  -c drv_c.c    -o drv_c.o
$ arm-none-eabi-g++    -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c drv_cpp.cpp -o drv_cpp.o
$ arm-none-eabi-g++    -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fexceptions -frtti -c drv_cpp.cpp -o drv_cpp_ex.o
$ arm-none-eabi-size drv_c.o drv_cpp.o drv_cpp_ex.o
   text    data     bss     dec     hex filename
     68       0       0      68      44 drv_c.o
     40       0       0      40      28 drv_cpp.o
     48       0       0      48      30 drv_cpp_ex.o
```

 

⚠ 先破除两个直觉

 

 
- **"C\+\+ 一定比 C 大"是错的** ：这张表里 C\+\+ 版（40 字节）反而比 C 版（68 字节）小。 但真正的原因不是"C\+\+ 内联更好"，而是 **发射口径不同** ：C 版的 ` uart_write ` 是 **外部函数** ， 即使这个 TU 里没人调用它，` .o ` 里也会被发射（` nm drv_c.o ` 能看到它）； C\+\+ 版的 ` Uart::write ` 是类内定义的 **隐式 inline**  函数，本 TU 未引用，就 **根本不发射** 。 换成把 C 版 ` uart_write ` 标成 ` static `，两者立刻持平。差异是 **几字节级** 的，且可正可负。
 
- **"虚函数一定贵"也不成立** ：这个微例里虚调用（6 字节）比函数指针表（10 字节）还小。  *所以"贵不贵"不能背结论，只能按场景测。*

 

**FIG 1.1**  同功能代码的体积账单：每一项 C\+\+ 特性各花多少字节 （真实 ` arm-none-eabi-size ` 读数，非估算）

 

```zhizhan-figure
<svg viewBox="0 0 660 272" role="img" aria-label="C 与 C++ 各写法 text 段体积对比柱状图">
          <!-- 轴 -->
          <line x1="160" y1="20" x2="160" y2="240" stroke="var(--line-2)" stroke-width="1"></line>
          <text x="160" y="258" class="sv-lbl-dim" text-anchor="middle">text 字节 · 单个 .o 文件（不含链接后的库开销）</text>

          <!-- 1 · bare 4 B -->
          <text x="150" y="38" class="sv-lbl" text-anchor="end">bare.o</text>
          <text x="150" y="51" class="sv-lbl-dim" text-anchor="end">最小 C++ 函数</text>
          <rect x="162" y="31" width="17" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="186" y="44" class="sv-lbl-hi">4 B</text>

          <!-- 2 · vx 6 B -->
          <text x="150" y="74" class="sv-lbl" text-anchor="end">vx.o</text>
          <text x="150" y="87" class="sv-lbl-dim" text-anchor="end">虚函数调用</text>
          <rect x="162" y="67" width="26" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="195" y="80" class="sv-lbl-hi">6 B</text>

          <!-- 3 · vc 10 B -->
          <text x="150" y="110" class="sv-lbl" text-anchor="end">vc.o</text>
          <text x="150" y="123" class="sv-lbl-dim" text-anchor="end">函数指针表调用</text>
          <rect x="162" y="103" width="43" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="212" y="116" class="sv-lbl-hi">10 B</text>

          <!-- 4 · drv_noex 40 B -->
          <text x="150" y="146" class="sv-lbl" text-anchor="end">drv_noex.o</text>
          <text x="150" y="159" class="sv-lbl-dim" text-anchor="end">C++ 驱动 · 关异常/RTTI</text>
          <rect x="162" y="139" width="171" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="340" y="152" class="sv-lbl-hi">40 B</text>

          <!-- 5 · drv_ex 48 B -->
          <text x="150" y="182" class="sv-lbl" text-anchor="end">drv_ex.o</text>
          <text x="150" y="195" class="sv-lbl-dim" text-anchor="end">C++ 驱动 · 开异常/RTTI</text>
          <rect x="162" y="175" width="206" height="18" rx="3" class="sv-amb-s"></rect>
          <text x="375" y="188" class="sv-lbl-hi">48 B</text>

          <!-- 6 · C 68 B -->
          <text x="150" y="218" class="sv-lbl" text-anchor="end">drv_c.o</text>
          <text x="150" y="231" class="sv-lbl-dim" text-anchor="end">C 驱动 · 同功能对照</text>
          <rect x="162" y="211" width="291" height="18" rx="3" class="sv-cyn-s"></rect>
          <text x="460" y="224" class="sv-lbl-hi">68 B</text>

          <!-- 右：断轴 -->
          <line x1="496" y1="20" x2="496" y2="240" class="sv-dash"></line>
          <text x="496" y="14" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--amb)">断轴</text>
          <rect x="508" y="40" width="140" height="180" rx="6" class="sv-red-s"></rect>
          <text x="578" y="68" class="sv-lbl" text-anchor="middle">另一口径</text>
          <text x="578" y="86" class="sv-lbl-dim" text-anchor="middle">（链接后的整镜像）</text>
          <text x="578" y="116" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--red)">574788 B</text>
          <text x="578" y="134" class="sv-lbl-dim" text-anchor="middle">≈ 566 KB Flash</text>
          <text x="578" y="162" class="sv-lbl-dim" text-anchor="middle">对照 bare 版</text>
          <text x="578" y="178" class="sv-lbl-dim" text-anchor="middle">6.5 KB</text>
          <text x="578" y="204" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">× 87</text>
        </svg>
```

 

读图顺序： **绿色** 三根是"零开销抽象"的实证——虚调用 6 字节、函数指针表调用 10 字节，都比一杯咖啡的机器码还短， 说明 C\+\+ 的抽象本身不贵； **琥珀色** 那根是打开 ` -fexceptions -frtti ` 后的增量（40 → 48）。真正贵的是 **右框里那件事** ： 仅仅 ` #include <iostream> ` 加一句 ` std::cout `，链接后的镜像就从 6.5 KB 涨到 566 KB（ **约 87 倍** ）。 注意两者 **口径不同** ——左边是单个 ` .o ` 的 text，右边是整镜像的 text\+data，所以用断轴隔开而不是画成同一条轴上的柱； 这个对比要说明的只有一件事： **该怕的不是 C\+\+，是把桌面标准库搬进 MCU** 。

 

```zhizhan-anchor
m01-2
```



## 1.2 编译开关：把不需要的东西关掉

 

真正拉开差距的不是"用不用 C\+\+"，而是 **用它的时候开没开对开关** 。 嵌入式 C\+\+ 的第一条纪律就是： **把标准默认打开的、你不需要的运行时设施全部关掉** 。

 

```zhizhan-table
{"rows":[[{"body":"开关","header":true,"rowSpan":1,"colSpan":1},{"body":"关掉什么","header":true,"rowSpan":1,"colSpan":1},{"body":"为什么嵌入式要关","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` -fno-exceptions `","header":false,"rowSpan":1,"colSpan":1},{"body":"异常（throw/catch）","header":false,"rowSpan":1,"colSpan":1},{"body":"异常需要 **展开表（unwind tables）与运行时代码** ，只在抛出时才跑、但代码与表一直在；MCU 上通常不需要","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -fno-rtti `","header":false,"rowSpan":1,"colSpan":1},{"body":"运行期类型信息","header":false,"rowSpan":1,"colSpan":1},{"body":"` dynamic_cast `/` typeid ` 要额外的类型描述表；用不到就别编进去","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -fno-threadsafe-statics `","header":false,"rowSpan":1,"colSpan":1},{"body":"函数内 ` static ` 的线程安全初始化","header":false,"rowSpan":1,"colSpan":1},{"body":"默认会给每个函数内静态量加一个\"守卫变量 \\+ 原子检查\"；单线程中断模型下不需要","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -fno-use-cxa-atexit `","header":false,"rowSpan":1,"colSpan":1},{"body":"全局对象析构的登记","header":false,"rowSpan":1,"colSpan":1},{"body":"避免为\"退出时析构\"引入 ` __cxa_atexit `（而裸机根本不会退出）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -fno-unwind-tables `  \n` -fno-asynchronous-unwind-tables `","header":false,"rowSpan":1,"colSpan":1},{"body":"栈回溯表","header":false,"rowSpan":1,"colSpan":1},{"body":"不为\"异常/回溯\"生成额外表；需要 ` bt ` 回溯时再单独权衡","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -fno-common `","header":false,"rowSpan":1,"colSpan":1},{"body":"把重复定义合并成 COMMON","header":false,"rowSpan":1,"colSpan":1},{"body":"与 C 一致：重复定义要报错，而不是静默合并（GCC 10\\+ 已默认）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Os ` \\+ ` -flto `","header":false,"rowSpan":1,"colSpan":1},{"body":"—","header":false,"rowSpan":1,"colSpan":1},{"body":"体积优先；LTO 能跨 TU 内联与删死代码（代价是编译变慢）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wall -Wextra -Wold-style-cast `","header":false,"rowSpan":1,"colSpan":1},{"body":"—","header":false,"rowSpan":1,"colSpan":1},{"body":"把 C 风格强制转换、隐式截断等问题尽早暴露（与第①册同一套警告纪律）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

✔ 一条工程惯例

 

把这组开关 **写进 Makefile/CMake 的公共 CXXFLAGS** ，而不是"记得的时候加"。 本册后面所有示例都默认带 ` -fno-exceptions -fno-rtti `； 当某一节需要讨论"开了会怎样"时，会显式注明。

 

*一个容易忽略的点：` -fno-exceptions ` 只作用于 **你自己编译的代码** 。 预编译的 ` libstdc++ `/` libstdc++_nano ` 仍然是带异常构建的； 若你用到内部可能 ` throw ` 的组件（例如 ` std::function ` 的某些分配路径）， 仍可能被牵回异常运行时 —— 这也是 Module 05 讨论 ` std::function ` 时要当心的原因。*

 

```zhizhan-anchor
m01-3
```



## 1.3 逐项算账

 

```zhizhan-anchor
m01-3-1
```



### 1.3.1 异常（exceptions）

 

异常的核心代价不在"抛"的时候，而在 **"编译器必须为'随时可能抛'准备数据"** ： ARM 上 GCC 用的是 **表驱动的"零成本"异常模型**  —— 正常执行路径上 **不会** 为每条指令插入检查或簿记（这才是"零成本"的含义）， 代价集中在只读的 **展开表** （` .ARM.exidx `/` .ARM.extab `）与异常运行时本身。 本机实测：同一份驱动，` -fno-exceptions ` 是 40 字节，显式 ` -fexceptions ` 变成 48 字节 —— 这多出的 8 字节基本就是新增的 ` .ARM.exidx `（` size ` 把只读表也算进 text）； 真正的运行时（` libgcc ` 的 unwind、terminate handler）在 **链接后** 才出现，远不止 8 字节。

 

⚠ 嵌入式里用异常的三条硬约束

 

 
- **不能跨中断边界抛** ：ISR 与线程/主循环是不同的栈上下文，异常无法安全穿越。
 
- **需要 unwinder 与 ` __exidx `** ：裸机链接常因缺 ` __exidx_start/__exidx_end ` 或终止处理而失败。
 
- **最好的做法往往是"不用异常，用错误码"** ：这与第①册 Module 07 的 ` err_t ` 体系一脉相承。

 

```zhizhan-anchor
m01-3-2
```



### 1.3.2 RTTI

 

` dynamic_cast ` 与 ` typeid ` 依赖运行期类型描述表。 嵌入式里几乎不用它们（多态靠虚表已经够），所以 ` -fno-rtti ` 基本是默认动作。 关掉之后，` dynamic_cast `/` typeid ` 会直接编译报错 —— 这也是好事，能拦住误用。

 

```zhizhan-anchor
m01-3-3
```



### 1.3.3 ` iostream `：在 MCU 上的真实账单

 

这是最"教科书级"的一个坑。` #include <iostream> ` 看着无害，但把 ` std::cout << "hello\n"; ` 放进一个空程序之后， **编译过、链接不过** ： 本机实测报  **12 处未定义引用** 。

 

| 未定义符号（实测去重后共 11 个） | 它来自哪儿 |
| --- | --- |
| ` _write ` / ` _read ` / ` _close ` / ` _lseek ` / ` _open ` / ` _fstat ` / ` _isatty ` | newlib 的文件/终端  **syscall 桩**  —— ` cout ` 最终要落到 ` _write ` |
| ` _sbrk ` | 堆边界；缓冲区申请可能走到它 |
| ` _exit ` / ` _kill ` / ` _getpid ` | 进程收尾与信号（` exit `/` abort ` 路径） |

 

这里要先纠正一个 **常见的误传** ： **"链接失败"这件事，跟 locale / 宽字符无关** 。 12 条报错里没有一条是 ` swprintf `/` getwc ` 之类的宽字符符号，清一色是 newlib 的 syscall 桩 —— 换句话说， **链接失败只是"缺桩"，补上就能链过** 。 但 **链过之后的体积膨胀是另一回事** ：那才是 libstdc\+\+ 的 iostream / locale 机制被真正拉进镜像的结果（见下）。

 

所以真正的问题不是"链不过"，而是 **链过之后有多大** ：

 

**bash**  — 复跑：` bash tools/probes/m01.sh `（Arm GNU Toolchain 13.3.1，cortex-m3）

 

```text
# ① 不补桩：编得过，链不过
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 iostream_probe.cpp -o iostream.elf
... libc.a(libc_a-writer.o): in function `_write_r':
writer.c:(.text._write_r+0x14): undefined reference to `_write'
... libc.a(libc_a-sbrkr.o): in function `_sbrk_r':
sbrkr.c:(.text._sbrk_r+0xc): undefined reference to `_sbrk'
... libc.a(libc_a-exitr.o): in function `exit':
exit.c:(.text.exit+0x14): undefined reference to `_exit'
collect2.exe: error: ld returned 1 exit status
# 共 12 条；缺的符号去重后是：
#   _close _exit _fstat _getpid _isatty _kill _lseek _open _read _sbrk _write

# ② 补上桩（--specs=nosys.specs）：链过了，代价现形
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 --specs=nosys.specs bare.cpp           -o bare_nosys.elf
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 --specs=nosys.specs iostream_probe.cpp -o iostream_nosys.elf
$ arm-none-eabi-size bare_nosys.elf iostream_nosys.elf
   text    data     bss     dec     hex filename
   5272    1404     840    7516    1d5c bare_nosys.elf
 574788    4276    7772  586836   8f454 iostream_nosys.elf
# Flash（text+data）：6.5 KB → 566 KB。RAM（bss）：840 B → 7772 B
# 同时链接器对每个桩都警告 "_write is not implemented and will always fail" ——
# 也就是说：即使在能链过的情况下，cout 也只是往一个空桩里写，什么都不会输出。
```

 

⚠ 一个 ` cout `，566 KB

 

这才是 ` iostream ` 在 MCU 上的真实账单：不是"语法不支持"，而是  **它把整条 IO 缓冲 \+ 流状态 \+ libstdc\+\+ 的本地化/异常处理链一起拖进了镜像** 。 放大它的机制之一：` <iostream> ` 在每个包含它的翻译单元里都会定义一个 ` std::ios_base::Init ` 静态对象，用来保证 ` cout ` 使用前完成初始化 —— 这个对象一旦存在，就会把 ` cout ` 及其依赖的整棵子树拉进来。 对一颗 64 KB Flash 的 M0 来说，这不是"值不值"的问题，是 **根本放不下** 。

 

◆ 结论与替代

 

**MCU 上不要用 ` iostream `** 。要输出就用： 第①册的 ` printf `/自写轻量输出（` --specs=nano.specs `）、ITM/RTT，或把日志做成"事件码 \+ 主机侧格式化"。 这不代表 C\+\+ 不可用 —— 只是 **别把桌面库的整棵依赖树拖进 MCU** 。

 

```zhizhan-anchor
m01-3-4
```



### 1.3.4 动态分配、虚函数、模板

 

| 特性 | 真实代价 | 本册的态度 |
| --- | --- | --- |
| **new / delete** | 走 ` _sbrk ` 管理堆；长期运行会产生 **碎片** ，且每次分配不确定（实时性差） | 慎用；优先 **静态分配** 与内存池（Module 05） |
| **虚函数** | 每对象一个 ` vptr `（4 字节）\+ 每次调用一次间接跳转；本机微例 6 字节 vs 函数指针表 10 字节 | 可用； **中断路径慎用** （间接跳转不可预测、打断流水线） |
| **模板** | **零运行时开销** （编译期实例化、通常内联）；代价在 **代码体积** ——每种实例化都生成一份 | 推荐；但注意实例化膨胀：用 ` -ffunction-sections -fdata-sections -Wl,--gc-sections ` 删掉 **未被引用** 的实例，跨 TU 的重复实例由 weak/COMDAT 合并（Module 04 细讲） |
| **全局对象构造** | 在 ` main ` 之前由 ` __libc_init_array ` 调用； **跨编译单元的初始化顺序不确定** | 少用全局对象；必须用时用"显式 init 函数"或 ` constexpr `/` constinit ` |

 

```zhizhan-anchor
m01-4
```



## 1.4 一份对照实验：同一功能，C 与 C\+\+

 

下面两份代码 **功能等价** ：一个 UART 发送 \+ 一个 CRC8。左边是 C，右边是 C\+\+（成员函数 \+ 构造函数）。 它们都能通过本册的编译门禁；本机 ` size ` 结果就是 §1.1 那张表。

 

drv\_c.c — C 版：结构体 \+ 函数 C

 

```text
/* drv_c.c —— C 的写法：数据（uart_t）与操作（uart_write）是分开的 */
#include <stdint.h>

typedef struct { uint32_t base; uint8_t id; } uart_t;

static uint8_t crc8(const uint8_t *d, uint32_t n)
{
    uint8_t c = 0;
    while (n--) {
        c ^= *d++;
        for (int i = 0; i < 8; i++) c = (uint8_t)((c << 1) ^ ((c >> 7) * 0x07));
    }
    return c;
}

void uart_write(uart_t *u, const uint8_t *buf, uint32_t n)
{
    volatile uint32_t *p = (volatile uint32_t *)u->base;
    while (n--) {
        while (!(p[0] & 0x80)) { }   /* SR(0x00) 的 TXE 位(bit7) */
        *(volatile uint8_t *)(u->base + 4) = *buf++;
    }
}

uint8_t frame_crc(const uint8_t *b, uint32_t n) { return crc8(b, n); }
```

 

drv\_cpp.cpp — C\+\+ 版：数据与操作封装在一起 C\+\+

 

```text
// drv_cpp.cpp —— C++ 的写法：构造即绑定，<cstdint> + class
#include <cstdint>

class Uart {
public:
    constexpr Uart(uint32_t base, uint8_t id) : base_(base), id_(id) {}
    void write(const uint8_t *buf, uint32_t n) const {
        volatile uint32_t *p = reinterpret_cast<volatile uint32_t *>(base_);
        while (n--) {
            while (!(p[0] & 0x80)) { }   /* SR(0x00) 的 TXE 位(bit7) */
            *reinterpret_cast<volatile uint8_t *>(base_ + 4) = *buf++;
        }
    }
private:
    uint32_t base_;
    uint8_t  id_;
};

static uint8_t crc8(const uint8_t *d, uint32_t n)
{
    uint8_t c = 0;
    while (n--) {
        c ^= *d++;
        for (int i = 0; i < 8; i++) c = (uint8_t)((c << 1) ^ ((c >> 7) * 0x07));
    }
    return c;
}

uint8_t frame_crc(const uint8_t *b, uint32_t n) { return crc8(b, n); }
```

 

✔ 从这份对照里读到的三件事

 

 
- **差几字节，不是差几倍** ：关掉异常/RTTI 后，C\+\+ 版和 C 版在目标文件层面基本持平（本例 C\+\+ 还小 28 字节 —— 但这来自"未被引用的成员函数不发射"的口径差异，见 §1.1，不是 C\+\+ 更快）。
 
- **C\+\+ 的收益在"接口"不在"指令"** ：` Uart ` 把 base/id 与行为绑定，调用方不需要"记得先传对结构体"—— 这类 **可维护性收益** 才是迁移的主要理由。
 
- **真正的分水岭是运行时库** ：一旦引入 ` iostream `/异常/动态分配，代价就从"几字节"跳到"链接失败或几 KB 运行时"。

 

```zhizhan-anchor
m01-5
```



## 1.5 决策表：什么时候值得用 C\+\+

 

| 场景 | 建议 | 理由 |
| --- | --- | --- |
| 纯寄存器操作、极简固件 | 用 C | 抽象收益小，C 更直接、更可预测 |
| 需要封装 \+ 多态（驱动框架、HAL） | 用 C\+\+ | 类/命名空间/模板带来的结构与安全，远超几字节代价（Module 10 实战） |
| 算法/查找表密集 | 用 constexpr | 把计算搬到编译期，Flash 里只留表（Module 03） |
| 资源需要成对获取/释放 | 用 RAII | 用析构替掉易错的 ` init/deinit ` 配对（Module 02） |
| 中断里、硬实时路径 | 极度克制 | 异常/动态分配/间接调用都要避开（Module 08） |
| 需要 ` iostream ` / 异常 / ` dynamic_cast ` | 不要 | 本机实测：引入即链接失败或拉入大运行时 |

 

**FIG 1.2**  决策：什么时候值得用 C\+\+

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="按体积、团队、维护成本权衡是否引入 C++">
          <rect x="30" y="40" width="180" height="60" rx="6" class="sv-cyn-s"></rect>
          <text x="120" y="65" class="sv-lbl-hi" text-anchor="middle">功能简单 / 体积极敏感</text>
          <text x="120" y="86" class="sv-lbl-dim" text-anchor="middle">→ 纯 C 足够</text>
          <path d="M210 70 L260 70" class="sv-arrow"></path>
          <rect x="262" y="40" width="180" height="60" rx="6" class="sv-amb-s"></rect>
          <text x="352" y="65" class="sv-lbl-hi" text-anchor="middle">需要 RAII / 泛型</text>
          <text x="352" y="86" class="sv-lbl-dim" text-anchor="middle">→ C++ 子集</text>
          <path d="M442 70 L492 70" class="sv-arrow"></path>
          <rect x="494" y="40" width="140" height="60" rx="6" class="sv-grn-s"></rect>
          <text x="564" y="65" class="sv-lbl-hi" text-anchor="middle">维护收益 &gt; 体积代价</text>
          <text x="564" y="86" class="sv-lbl-dim" text-anchor="middle">→ 值得</text>
        </svg>
```

 

关掉异常/RTTI、避免动态分配、模板别滥用，C\+\+ 的代价可以压到很小。

 

main.cpp — 最小 C\+\+ 程序（无异常/RTTI） C\+\+

 

```text
#include <cstdio>

int main() {
    std::printf("Hello, C++ on MCU\n");
    return 0;
}
```

 

| 用 C\+\+ 的信号 | 反信号 |
| --- | --- |
| 多处成对资源（开关/锁）易漏释放 | 资源简单、一进一出 |
| 需要编译期多态与零开销抽象 | 只需几个固定函数 |
| 模板能消除重复样板 | 重复很少，抽象成本高 |
| 团队熟悉并约定用子集 | 团队不熟、易写重功能 |

 

◆ 迁移练习

 

用 ` arm-none-eabi-size ` 对比你工程里"一个 C 写法"与"一个 C\+\+ 封装写法"的 text 体积差，写出"是否值得引入该封装"的结论。

 

◆ 本章要点

 

 
- C\+\+ 在 MCU 上 **可大可小** ：关掉异常/RTTI 后，目标文件层面与 C 基本持平（本例 40 vs 68 字节）。
 
- 第一条纪律： **` -fno-exceptions -fno-rtti -fno-threadsafe-statics -fno-use-cxa-atexit `**  写进公共选项。
 
- **` iostream ` 在 MCU 上基本不可用** ：本机实测报 12 处未定义引用（全是 newlib 的 syscall 桩：` _write/_sbrk/_exit… `）；补桩后可链过，但 Flash 从 6.5 KB 涨到  **566 KB** 。
 
- 虚函数 **不一定更贵** （本例虚调用 6 \< 函数指针表 10）——代价要按场景测，不能背结论。
 
- 迁移的真正理由是 **可维护性** （封装、RAII、编译期计算），不是"跑得快"。
 
- 硬实时路径与 ISR 要 **极度克制** ：避开异常、动态分配与不可预测的间接调用。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 判断：把驱动从 C 改写成 C\+\+，目标文件一定会变大吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。本机实测：同一份驱动，C 版 ` .o ` 是 68 字节，C\\+\\+ 版（关异常/RTTI）是 40 字节——C\\+\\+ 反而更小。差异是几字节级、可正可负，\"一定变大\"是错的。"}
   ```
 
2. 填空：嵌入式 C\+\+ 第一件事是关掉 \_\_\_\_\_\_ 和 \_\_\_\_\_\_ 两个运行时设施。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**异常（` -fno-exceptions `）**  与  **RTTI（` -fno-rtti `）** 。它们需要展开表/类型描述表与运行时代码，MCU 上通常不需要。"}
   ```
 
3. 简答：为什么 ` #include <iostream> ` 在 MCU 上通常是灾难？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"它会牵出 locale/缓冲区/终止处理整条链，把大量标准库实现拉进镜像。本机实测：一个空程序加上 ` std::cout ` 后 Flash 从 6.5 KB 涨到  **566 KB** （text 5272→574788）——注意报错本身只是 12 处 newlib syscall 桩缺失，补 ` --specs=nosys.specs ` 就能链过，但链过的结果谁也放不下。输出应改用 ` printf `/自写轻量输出或 ITM/RTT。"}
   ```
 
4. 判断：虚函数一定比函数指针表慢、更占空间吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不成立。本机微例里虚调用 ` .o ` 是 6 字节、函数指针表是 10 字节。虚函数确实有\"每对象 4 字节 vptr \\+ 一次间接跳转\"的固定成本，但是否更贵取决于场景——所以要在 **你的** 代码上测，而不是背结论。"}
   ```
 
5. 简答：MCU 上为什么普遍不建议用 ` new/delete `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"它走堆（` _sbrk `）分配：长期运行会产生 **内存碎片** ，且每次分配耗时不确定（破坏实时性）。优先静态分配、内存池或 arena（Module 05）。"}
   ```
 
6. 动手：给 ` drv_c.c ` 里的 ` uart_write ` 加一个 ` static `，再编一次，` size ` 会变成多少？ **先预测，再验证。**
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会从 68 降到与 C\\+\\+ 版同量级 —— 因为 ` static ` 且本 TU 无人调用时，这个函数不再被发射。这正好验证 §1.1 的结论：40 vs 68 的差异来自\"要不要发射这个未被引用的外部函数\"，而不是\"C\\+\\+ 内联更好\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  把本节的 ` -fno-exceptions -fno-rtti ` 写进你项目的公共编译选项，再编一次看看体积变化。

 

```zhizhan-assessment
{"id":"course-b02-m01","criterion":"同一功能的 C/C++ 目标 ELF 对比代码、静态 RAM 与运行开销，选型结论写明测量条件。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
