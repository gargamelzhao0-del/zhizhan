# 类型系统护栏：让错误编译不过

```zhizhan-anchor
m07
```



第①册的信念是"把假设写成编译期检查"（` _Static_assert `、` offsetof `）。 C\+\+ 把这件事做得更彻底： **用类型把"单位、句柄、字节"区分开** ，让"把毫秒当微秒传"这类错误 **在编译期就报出来** ， 而不是等现场出现"延时差了 1000 倍"。

 

> ◷ 约 55 分钟 · ◈ enum class / 强类型单位 / std::byte · ⚑ 0 运行时开销

 

```zhizhan-anchor
m07-1
```



## 7.1 ` enum class `：有作用域、不隐式转 int

 

C 的 ` enum ` 会隐式转成 ` int `，名字还泄漏到外层作用域。 ` enum class ` 同时解决这两点： **名字带作用域、不隐式转换** ，而且可以指定底层类型以控制大小。

 

strong\_enum.cpp — 编译器帮你拦住"混着用" C\+\+

 

```text
// strong_enum.cpp —— enum class 的作用域与强类型
#include <cstdint>

enum class State : uint8_t { Idle, Run, Fault };     // 明确 1 字节
enum class Err   : uint16_t { Ok = 0, Timeout = 1, Crc = 2 };

static_assert(sizeof(State) == 1, "State 应为一字节（省 RAM）");

void set_state(State s) noexcept { (void)s; }

void demo() noexcept {
    set_state(State::Run);        // ✔ 必须写全限定名
    // set_state(0);              // ✕ 编译错误：int 不能隐式转 State
    // if (State::Run == 0) {}    // ✕ 编译错误：不隐式转 int
    if (State::Run == State::Run) {}   // ✔ 同类型比较
    uint8_t raw = static_cast<uint8_t>(State::Fault);   // ✔ 要"落地"为整数得显式转
    (void)raw;
}
```

 

✔ 为什么值得

 

它把"` State ` 与 ` Err ` 是两码事"从 **约定** 变成 **编译器强制** ： ` set_state(some_err) ` 直接编译失败。而底层类型可指定为 ` uint8_t `，不存在"为了类型安全而变大"的问题。

 

⚠ ` enum class ` 默认不支持位运算

 

这是寄存器编程里最常踩的一条：` enum class `  **不会** 隐式转成整数，所以 ` Irq::Rx | Irq::Tx `、` f & Mask `  **默认编译不过** 。 要当"标志位集合"用，就得自己提供 ` operator|/&/~ `：

 

irq\_flags.cpp — 给 enum class 补上位运算 C\+\+

 

```text
// irq_flags.cpp —— enum class 当标志位用，必须自定义 operator
#include <cstdint>

enum class Irq : uint32_t {
    None = 0u, Rx = 1u << 0, Tx = 1u << 1, Err = 1u << 2
};

constexpr Irq operator|(Irq a, Irq b) noexcept {
    return static_cast<Irq>(static_cast<uint32_t>(a) | static_cast<uint32_t>(b));
}
constexpr bool has(Irq set, Irq bit) noexcept {
    return (static_cast<uint32_t>(set) & static_cast<uint32_t>(bit)) != 0u;
}

void enable(Irq) noexcept {}

void demo() noexcept {
    Irq f = Irq::Rx | Irq::Tx;        // ✔ 有了 operator| 才能组合
    enable(f);
    (void)has(f, Irq::Rx);            // ✔ 用辅助函数做"含某位"判断
    // 若没有上面的 operator|，`Irq::Rx | Irq::Tx` 这行会直接编译失败。
}
```

 

```zhizhan-anchor
m07-2
```



## 7.2 强类型单位：拦住"把毫秒传给微秒"

 

API 里成群的 ` uint32_t delay_ms `/` timeout_us ` 是 bug 温床：两者的类型都是 ` uint32_t `， 传错 **不会报错** ，只会在运行期表现为"延时差 1000 倍"。用"标签 \+ 数值"的强类型可以彻底杜绝。

 

unit.cpp — 毫秒与微秒是两个类型（构造必须显式） C\+\+

 

```text
// unit.cpp —— 单位作为类型参数；编译期就能发现"传错单位"
#include <cstdint>

template <class Tag>
struct Unit {                          // 极简强类型：不同 Tag 就是不同类型
    uint32_t v;
    explicit constexpr Unit(uint32_t n) noexcept : v(n) {}   // 显式构造，杜绝 uint32_t 隐式进入
};

struct MsTag {}; struct UsTag {};
using Milliseconds = Unit<MsTag>;
using Microseconds = Unit<UsTag>;

constexpr Milliseconds ms(uint32_t n) noexcept { return Milliseconds{n}; }
constexpr Microseconds us(uint32_t n) noexcept { return Microseconds{n}; }

void delay(Milliseconds /*t*/) noexcept {}          // 只接受"毫秒"

void demo() noexcept {
    delay(ms(10));                 // ✔
    // delay(us(500));             // ✕ 编译错误：Microseconds 不是 Milliseconds
    // delay(10);                  // ✕ 编译错误：uint32_t 无法隐式转 Unit
}
```

 

**bash**  — 复跑：` bash tools/probes/m07.sh `（Arm GNU Toolchain 13.3.1，cortex-m3）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c unit_ok.cpp -o unit_ok.o
$ arm-none-eabi-size unit_ok.o
   text    data     bss     dec     hex filename
     28       0       4      32      20 unit_ok.o

$ arm-none-eabi-objdump -d --demangle unit_ok.o
0000000c <run()>:
f44f 727a   mov.w   r2, #1000       @ 0x3e8     # Ms{1000} —— 数值直接进寄存器
4b01        ldr     r3, [pc, #4]    @ (18 <run()+0xc>)
601a        str     r2, [r3, #0]
6818        ldr     r0, [r3, #0]
4770        bx      lr
00000000    .word   0x00000000
# Unit<MsTag> 没有留下任何痕迹：没有构造、没有拷贝、没有额外存储 —— 参数仍走 r0/r2

$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -fsyntax-only unit_fail.cpp
unit_fail.cpp: In function 'uint32_t run()':
unit_fail.cpp:21:14: error: could not convert 'Unit<MsTag>(1000)' from 'Unit<MsTag>' to 'Unit<UsTag>'
   21 |     delay_us(Ms{1000});                      // ← 单位错了：Ms 不是 Us
      |              ^~~~~~~~
      |              |
      |              Unit<MsTag>
# 注意：这是 error 而不是 warning。编译器不是在"劝你"，而是根本没有这个重载。
```

 

◆ 强类型的正确姿势

 

不需要一上来就抄 ` std::chrono ` 那套（模板实例多、写法重）。嵌入式里更实用的是这种 **极简 Unit** ： 一个 tag 类型区分单位、一个 ` uint32_t ` 定宽度。 **零运行时开销** （就是个包装）， 但把整类单位错误挡在了编译期。

 

✔ 但要清楚：强类型只解决"单位"，不解决"数值"

 

 
- **换算与混算** ：` ms + us `、` ms → us ` 默认 **不提供** 。要允许就自己写 **只接受同类型** 的 ` operator+ `，或显式给一个 ` to_us(ms) ` 换算函数 —— 别用隐式转换把它变回"能随便混"。
 
- **溢出/饱和** ：` Unit ` 里还是 ` uint32_t `，相加照旧会按无符号 **回绕** ；实时语境下常要 **饱和** 而非回绕，得在 ` operator+ ` 里显式处理。
 
- **别留可写裸成员** ：若把 ` v ` 暴露成到处可改的 public 成员，等于给护栏开了后门；尽早就地封装成只读访问（` value() `）或受限的算子。

 

unit\_math.cpp — 只允许"同单位"运算，换算是显式函数 C\+\+

 

```text
// unit_math.cpp —— 强类型也要能"安全地算"：只提供同单位的 operator+
#include <cstdint>

template <class Tag>
struct Unit {
    uint32_t v;
    explicit constexpr Unit(uint32_t n) noexcept : v(n) {}
};

struct MsTag {}; struct UsTag {};
using Milliseconds = Unit<MsTag>;
using Microseconds = Unit<UsTag>;

// 只接受"同单位"相加：不同单位传进来直接编译失败
constexpr Milliseconds operator+(Milliseconds a, Milliseconds b) noexcept {
    return Milliseconds{a.v + b.v};          // 注意：仍会无符号回绕，实时场合要改成饱和
}
// 换算是显式的：调用方一眼看得见"这里在改单位"
constexpr Microseconds to_us(Milliseconds t) noexcept {
    return Microseconds{t.v * 1000u};        // 溢出由调用方负责（或加饱和检查）
}

void demo() noexcept {
    Milliseconds t = Milliseconds{5} + Milliseconds{10};   // ✔ 同单位
    Microseconds u = to_us(t);                             // ✔ 显式换算
    (void)u;
    // Milliseconds bad = Milliseconds{1} + Microseconds{2};   // ✕ 无匹配 operator+，编译失败
}
```

 

```zhizhan-anchor
m07-3
```



## 7.3 ` std::byte `：字节就是字节

 

C 里"一字节"常用 ` uint8_t ` 或 ` char `，两者都会 **隐式参与算术** （加减乘）， 而字节通常 **不该做算术** 。C\+\+17 的 ` std::byte ` 把"原始字节"与"数值"区分开：

 

byte\_use.cpp — std::byte 只做位运算，不做数值运算 C\+\+

 

```text
// byte_use.cpp —— 原始字节用 std::byte；要算术先显式转
#include <cstddef>
#include <cstdint>

void fill(std::byte* p, std::size_t n, std::byte v) noexcept {
    while (n--) *p++ = v;
}

void demo(std::byte* buf) noexcept {
    fill(buf, 16, std::byte{0xAA});                 // 用花括号初始化，避免隐式整数
    std::byte b = buf[0];
    b = b | std::byte{0x01};                        // 位运算：允许
    // int x = b;                                   // ✕ 不隐式转整数
    uint8_t raw = std::to_integer<uint8_t>(b);      // ✔ 要当数值用时显式转
    (void)raw;
}
```

 

```zhizhan-anchor
m07-4
```



## 7.4 把寄存器布局钉进编译期（对照第①册）

 

第①册用 ` offsetof + _Static_assert ` 校验寄存器结构体。C\+\+ 里除了沿用 ` offsetof `，还能用 ` static_assert ` 把"位宽/位号/掩码"一起钉住，并配合强类型让"写错寄存器"也难以发生。

 

| 护栏 | 拦住的错误 |
| --- | --- |
| ` static_assert(offsetof(...) == …) ` | 结构体成员顺序/填充被改动 |
| ` enum class ` 作为函数参数 | 把 A 状态传给收 B 状态的函数 |
| 强类型单位 | 毫秒/微秒、字节/字数 混用 |
| ` std::byte ` vs 整数 | 对原始字节做数值运算 |
| ` constexpr ` 掩码 \+ ` static_assert ` | 位域掩码写错（如 ` 1<<n ` 漏了宽度） |

 

⚠ ` offsetof ` 有个前提：类型必须是"标准布局"

 

` offsetof ` 只对 **标准布局类型（standard-layout）** 获得标准保证。一旦给寄存器视图加上构造函数、成员函数或访问控制（` private `/公私混排），它就不再是标准布局， ` offsetof ` 变成"有条件支持"（GCC 会报 ` -Winvalid-offsetof `），断言随之失去意义。 所以寄存器视图要保持 **"纯数据成员 \+ 标准布局"** ，并把这个前提也一起断言出来：

 

regs\_layout.cpp — 先断言"标准布局"，再断言偏移 C\+\+

 

```text
// regs_layout.cpp —— 布局断言的前提
#include <cstdint>
#include <cstddef>
#include <type_traits>

struct GpioRegs {                 // 只有数据成员、无访问控制 → 标准布局
    volatile uint32_t crl, crh, idr, odr, bsrr;
};

static_assert(std::is_standard_layout_v<GpioRegs>, "寄存器视图必须是标准布局");
static_assert(std::is_trivially_copyable_v<GpioRegs>, "且应可平凡复制");
static_assert(offsetof(GpioRegs, odr)  == 0x0C, "ODR  偏移应为 0x0C");
static_assert(offsetof(GpioRegs, bsrr) == 0x10, "BSRR 偏移应为 0x10");
```

 

reg\_field.cpp — 用 constexpr 描述位域，运行期零成本地读/改/写 C\+\+

 

```text
// reg_field.cpp —— 位域描述是编译期常量，读改写是运行期几条指令
#include <cstdint>

struct Field { uint8_t pos; uint8_t width; };

constexpr uint32_t mask_of(Field f) noexcept { return ((1u << f.width) - 1u) << f.pos; }
constexpr uint32_t pack(Field f, uint32_t val) noexcept { return (val << f.pos) & mask_of(f); }
constexpr uint32_t unpack(Field f, uint32_t reg) noexcept { return (reg & mask_of(f)) >> f.pos; }

constexpr Field MODE0{0, 2};                 // 某寄存器第 0 号字段，2 位
static_assert(mask_of(MODE0) == 0x3u, "MODE0 掩码应为 0x3");

// 清字段再置值（读-改-写；并发/中断场景要配临界区，见 Module 06/08）
void set_field(volatile uint32_t* reg, Field f, uint32_t val) noexcept {
    *reg = (*reg & ~mask_of(f)) | pack(f, val);
}
uint32_t get_field(uint32_t reg, Field f) noexcept { return unpack(f, reg); }
```

 

⚠ 护栏也要"值得"

 

类型护栏的价值在于" **拦住的错误确实可能发生** "。给一个只在本文件内传一两次的短命值造一堆强类型，反而添乱。 经验法则： **跨模块接口、容易混的单位/句柄、状态与错误码** ——这些地方加类型，收益最大。

 

✔ 与 ` std::chrono ` 的关系，以及 ` std::bit_cast `

 

 
- **` std::chrono `**  是标准库的强类型时间：` std::chrono::milliseconds `/` microseconds ` 是不同类型，且自带换算（` duration_cast `、字面量 ` 10ms `）。但它模板实例多、写法重；MCU 上若只需"防串用"，本节的极简 ` Unit ` 更省事，要完整时间算术再上 chrono。
 
- **` std::bit_cast `** （C\+\+20）：在 **同大小、可平凡拷贝** 的类型间按位重解释（如把 ` uint32_t ` 的位模式转成 ` float `），替代 ` union ` 双关或 ` memcpy `：无 UB、可用于 ` constexpr `。是"原始字节/寄存器值"场景的正规写法。
 
- **别名与对齐** ：用 ` std::byte `/` unsigned char ` 访问任意对象是标准允许的；但用 ` uint32_t* ` 去解引用一个 ` std::byte ` 缓冲会违反严格别名与对齐 —— 这类"重解释"交给 ` bit_cast `/` memcpy `，别硬转指针。

 

```zhizhan-anchor
m07-5
```



## 7.5 强类型：让编译器拦住单位错误

 

**FIG 7.1**  强类型单位：毫秒 ≠ 微秒

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="用不同的类型区分单位，传错编译不过">
          <rect x="30" y="40" width="180" height="50" rx="6" class="sv-grn-s"></rect>
          <text x="120" y="62" class="sv-lbl-hi" text-anchor="middle">Milliseconds</text>
          <text x="120" y="81" class="sv-lbl-dim" text-anchor="middle">强类型（结构体包装）</text>
          <rect x="250" y="40" width="180" height="50" rx="6" class="sv-red-s"></rect>
          <text x="340" y="62" class="sv-lbl-hi" text-anchor="middle">Microseconds</text>
          <text x="340" y="81" class="sv-lbl-dim" text-anchor="middle">另一种强类型</text>
          <text x="530" y="60" class="sv-lbl-dim" text-anchor="middle">把 ms 传给</text>
          <text x="530" y="80" class="sv-lbl-hi" text-anchor="middle">收 us 的参数 → 编译报错</text>
        </svg>
```

 

用 ` int ` 传时间，单位和量纲全靠约定；强类型把它变成编译期错误。

 

**FIG 7.2**  把寄存器布局钉进编译期

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="用结构体映射寄存器块，static_assert 校验偏移与大小">
          <rect x="40" y="40" width="200" height="56" rx="6" class="sv-cyn-s"></rect>
          <text x="140" y="63" class="sv-lbl-hi" text-anchor="middle">struct GPIO_Type</text>
          <text x="140" y="83" class="sv-lbl-dim" text-anchor="middle">MODER/OTYPER/…</text>
          <path d="M240 68 L290 68" class="sv-arrow"></path>
          <rect x="292" y="40" width="220" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="402" y="63" class="sv-lbl-hi" text-anchor="middle">static_assert</text>
          <text x="402" y="83" class="sv-lbl-dim" text-anchor="middle">offsetof/sizeof 编译期核对</text>
        </svg>
```

 

偏移写错在编译期就报错，比上板后"寄存器写到别处"安全得多。

 

| 做法 | 编译期检查 | 运行期代价 |
| --- | --- | --- |
| ` #define ` 地址 | 无 | 无 |
| 结构体映射 \+ ` static_assert ` | 有 | 无 |
| 强类型单位 | 有（类型） | 零（可内联） |
| 裸 ` int ` 传时间 | 无 | — |

 

| 错误 | 用强类型能拦住吗 | 说明 |
| --- | --- | --- |
| ms 当 us 用 | 能 | 类型不匹配 |
| 角度当弧度 | 能 | 不同单位类型 |
| 寄存器偏移错 | 能 | ` static_assert ` |
| 数值算错 | 不能 | 逻辑错误靠测试 |

 

◆ 迁移练习

 

给"时间"定义 ` Milliseconds `/` Microseconds ` 两个强类型，写一个只接受 ` Microseconds ` 的延时函数；故意传 ms，看编译是否报错。

 

| 概念 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 时间单位 | ` int ` \+ 注释约定 | 强类型 ` Milliseconds ` |
| 寄存器块 | 宏地址 \+ 手工偏移 | 结构体 \+ ` static_assert ` |
| 错误定位 | 运行期才暴露 | 编译期报错 |

 

◆ 本章要点

 

 
- ` enum class `：有作用域、不隐式转 ` int `，可指定底层类型控制大小（如 ` uint8_t `）； **当标志位用时需自己补 ` operator|/& `** 。
 
- 用"tag \+ 数值"的 **极简强类型单位** 拦住"毫秒/微秒"混用——零运行时开销。
 
- ` std::byte ` 把原始字节与数值分开：允许位运算、拒绝数值运算，要算术必须显式 ` to_integer `。
 
- ` static_assert + offsetof ` 把寄存器布局与位掩码钉进编译期。
 
- 护栏要加在"确实可能传错"的地方：跨模块接口、易混单位、状态/错误码。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 简答：` enum class ` 相比 C 的 ` enum `，关键区别是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"两点：① 枚举名 **带作用域** （要写 ` State::Run `），不污染外层；②  **不隐式转成 int** ，也不接受整数的隐式转换——把\"把 A 当 B 用\"\"拿枚举当整数\"都变成编译错误。还可用 ` : uint8_t ` 指定底层类型以省 RAM。"}
   ```
 
2. 简答：强类型单位能拦住什么典型 bug？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"\"把毫秒当微秒传\"这类单位混用。两者底层都是 ` uint32_t ` 时编译器分不清；用 tag 区分成不同类型后，` delay(us(500)) ` 传给只收 ` Milliseconds ` 的函数会直接编译失败。"}
   ```
 
3. 判断：` std::byte ` 可以直接参与加减运算吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不可以。它只支持位运算（` | & ^ ~ ` 与移位 ` b << 3 `，移位数须是整型），不做数值运算；要当整数用必须显式 ` std::to_integer<uint8_t>(b) `。这是为了把\"原始字节\"和\"数值\"在类型上分开。"}
   ```
 
4. 填空：把寄存器成员偏移钉进编译期，用 \_\_\_\_\_\_ 结构体 \+ \_\_\_\_\_\_ 断言。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` offsetof ` 取成员偏移；` static_assert `（或第①册的 ` _Static_assert `）在编译期断言它等于手册值。"}
   ```
 
5. 判断：类型护栏越多越好。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。护栏的价值取决于\"它拦的错误是否真会发生\"。给只在一个函数内用一两次的短命值造大量强类型，只会增加阅读负担。优先给 **跨模块接口、易混单位/句柄、状态与错误码** 加护栏。"}
   ```
 
6. 决策：` void delay(Milliseconds t); ` 下，写 ` delay(Milliseconds{10} + Microseconds{5}); ` 会发生什么？若你 **确实** 想允许混算，该怎么办？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会 **编译失败** ——没有接受 ` Milliseconds + Microseconds ` 的 ` operator+ `。这正是护栏的意义。若确实允许，你 **必须显式** 提供该重载或换算函数（如 ` to_us() `）；护栏的原则是\"要么编译不过，要么在代码里清楚写出来\"，绝不让\"单位混用\"无声通过。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  把项目里一处"靠注释说明单位"的 ` uint32_t ` 参数，改成强类型单位；把状态枚举改成 ` enum class `。

 

```zhizhan-assessment
{"id":"course-b02-m07","criterion":"用类型区分单位与状态；构造不合法参数在合适的编译期或运行期被拒绝。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
