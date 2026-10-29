# 实战：用 C++ 重构驱动框架

```zhizhan-anchor
m10
```



把前九节拼起来：拿第①册 Module 07 的"虚表 \+ ` void* ctx `"驱动框架，做一次 **逐行对照的重构** 。 目标不是"改得更花哨"，而是 **在保持零运行时开销的前提下，让类型更安全、调用点更清楚** 。

 

> ◷ 约 70 分钟 · ◈ 重构前后逐行对照 · ⚑ 全册收口

 

```zhizhan-anchor
m10-1
```



## 10.1 出发点：第①册的 ops 表

 

第①册用一张 ` const ` 的函数指针表 \+ 一个 ` void* ctx ` 做多态。它是对的，但有两个"手写负担"： 调用点要 **手写 ` ops->fn(ctx, …) `** ，参数类型全靠约定，编译期几乎不检查。下面是它的形状：

 

display\_c.c — 重构前：ops 表 \+ void\* ctx C

 

```text
/* display_c.c —— 第①册风格的驱动抽象（简化） */
#include <stdint.h>

typedef struct display display_t;

typedef struct {
    void     (*init)(void* ctx);
    void     (*clear)(void* ctx, uint8_t on);
    uint16_t (*width)(void* ctx);          /* 每次都要传 ctx、强转、对参数 */
} display_ops_t;

struct display { const display_ops_t* ops; void* ctx; };

/* 上层只认 ops 表 */
void display_bring_up(display_t* d)
{
    d->ops->init(d->ctx);
    d->ops->clear(d->ctx, 1);
}

/* 一个具体实现 */
typedef struct { uint16_t w; } st7789_t;
static void st7789_init(void* ctx)  { (void)ctx; }
static void st7789_clear(void* ctx, uint8_t on) { (void)ctx; (void)on; }
static uint16_t st7789_width(void* ctx) { return ((st7789_t*)ctx)->w; }

static const display_ops_t ST7789_OPS = { st7789_init, st7789_clear, st7789_width };
```

 

```zhizhan-anchor
m10-2
```



## 10.2 重构后：概念（concepts）\+ 泛型驱动

 

用 C\+\+20 的 ` concept `，把"一个显示器"需要具备什么 **写成编译期约束** ： 上层函数模板收任何满足 ` Display ` 的类型，编译器在 **实例化时检查** 接口是否齐全 —— 不用虚表、不用 ` void* `、不用手写 ` ops-> `。

 

display\_after.cpp — 重构后：concept \+ 泛型，零 vptr C\+\+

 

```text
// display_after.cpp —— 用 concept 表达"什么是显示器"
#include <cstdint>
#include <concepts>

// 约束：任何满足它的类型都能当"显示器"用
template <class D>
concept Display = requires(D d, uint8_t on) {
    { d.init() } -> std::same_as<void>;
    { d.clear(on) } -> std::same_as<void>;
    { d.width() } -> std::convertible_to<uint16_t>;   // 只读查询
};

// 上层：对任意 Display 生成一份代码，调用在编译期解析、可内联
template <Display D>
void display_bring_up(D& d) {
    d.init();
    d.clear(1);
    (void)d.width();
}

// 一个具体实现：普通类，无虚函数、无 vptr
class St7789 {
public:
    explicit St7789(uint16_t w) noexcept : w_(w) {}
    void     init() noexcept         {}
    void     clear(uint8_t) noexcept {}
    uint16_t width() const noexcept  { return w_; }
private:
    uint16_t w_;
};

// 编译期就验证：St7789 满足 Display
static_assert(Display<St7789>);

void use() {
    St7789 lcd(320);
    display_bring_up(lcd);        // 无间接跳转、无 void* 强转
}
```

 

✔ 逐行映射（重构前 → 重构后）

 

 
- ` d->ops->init(d->ctx) ` → ` d.init() `：` ctx ` 从"每次调用手传的裸指针"变成"对象自己的成员（` this `）"。
 
- ` display_ops_t ` 表 → ` concept Display `：从"运行期的函数指针表"变成"编译期的接口约束"。
 
- ` void* ctx ` \+ ` (st7789_t*)ctx ` 强转 → ` St7789& d `：强转消失，具体类型由模板参数带出。
 
- ` void display_bring_up(display_t*) ` → ` template<Display D> void display_bring_up(D&) `：动态分派变静态分派。

 

**bash**  — 复跑：` bash tools/probes/m10.sh `（Arm GNU Toolchain 13.3.1，cortex-m3；探针用同构的最小示例 ` Driver/Uart `，只为把"分派方式"这一项差异单独隔离出来）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c ops_table.cpp   -o ops_table.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c concepts_drv.cpp -o concepts_drv.o
$ arm-none-eabi-size ops_table.o concepts_drv.o
   text    data     bss     dec     hex filename
     26       0       4      30      1e ops_table.o
     16       4       4      24      18 concepts_drv.o
# 两份 .o 来自不同源文件，体积数字只当量级参考。真正的差别在指令形态 ↓

# 重构前 use_ops：两次经寄存器间接跳转（blx），ctx 还要单独占一个寄存器传
$ arm-none-eabi-objdump -d --demangle ops_table.o
  b570        push    {r4, r5, r6, lr}
  460c        mov     r4, r1
  4616        mov     r6, r2
  4605        mov     r5, r0
  6803        ldr     r3, [r0, #0]
  4608        mov     r0, r1
  4798        blx     r3             # ← 间接跳转 #1（init）：目标要等 r3 加载出来才定
  4620        mov     r0, r4
  4631        mov     r1, r6
  686b        ldr     r3, [r5, #4]
  4798        blx     r3             # ← 间接跳转 #2（write）
  6820        ldr     r0, [r4, #0]
  bd70        pop     {r4, r5, r6, pc}

# 重构后 use_generic<Uart>：没有间接跳转，三步被压成直接的寄存器读写
$ arm-none-eabi-objdump -d --demangle concepts_drv.o
  2201        movs    r2, #1
  4b02        ldr     r3, [pc, #8]
  601a        str     r2, [r3, #0]     # init
  6019        str     r1, [r3, #0]     # write
  6818        ldr     r0, [r3, #0]     # read
  4770        bx      lr
# 整个函数只剩 16 字节，没有 blx、没有 void* 强转、没有 ctx 搬运。
# 代价：这段代码只对 Uart 有效 —— 换一个类型就换一份实例化（见 4.5）。

# 契约写在 concept 里，不满足时是编译错误而不是运行期崩溃：
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -fsyntax-only contract_fail.cpp
contract_fail.cpp: In function 'int main()':
contract_fail.cpp:7:26: error: no matching function for call to 'boot(Half&)'
    7 | int main() { Half h; boot(h); }
      |                      ~~~~^~~
contract_fail.cpp:6:26: note: candidate: 'template<class D>  requires  Driver<D> void boot(D&)'
    6 | template <Driver D> void boot(D& d) { d.init(); }
      |                          ^~~~
       ...（中间 8 行推导过程略）
contract_fail.cpp:5:69: note: the required expression 'd.write(b)' is invalid
    5 | concept Driver = requires(D& d, std::uint32_t b) { d.init(); d.write(b); };
      |                                                              ~~~~~~~^~~
# 编译器直接告诉你："Half 没有 write"。这不是"事后检查"，而是重载决议时的硬约束。
```

 

◆ 逐点对照

 

| 维度 | 重构前（C ops 表） | 重构后（concept） |
| --- | --- | --- |
| 调用写法 | ` ops->clear(ctx, 1) ` | ` d.clear(1) ` |
| 参数类型检查 | 无（` void* ` \+ 约定） | 编译期（` requires `） |
| 分派 | 运行期间接跳转 | 编译期静态调用（可内联） |
| 每对象开销 | ` ops ` 指针 \+ ` ctx ` 指针（2 字） | 只剩自身状态（如 ` w_ `），不含 ops/ctx 指针 |
| 运行期换实现 | 可以 | 不能（类型编译期定） |
| 报错可读性 | 链接期或运行期才发现 | 实例化时直接指出"缺 clear()" |

 

**FIG 10.1**  重构前后的结构对比：间接跳转是在哪一层被消掉的 （指令序列与体积均为 ` bash tools/probes/m10.sh ` 实读）

 

```zhizhan-figure
<svg viewBox="0 0 660 336" role="img" aria-label="重构前 ops 表结构的两次间接跳转，与重构后 concept 泛型驱动的直接内联调用对照">
          <!-- 重构前 -->
          <text x="16" y="42" class="sv-lbl-hi" style="fill:var(--amb)">重构前 · 运行期 ops 表</text>
          <rect x="16" y="54" width="112" height="48" rx="4" class="sv-amb-s"></rect>
          <text x="72" y="74" class="sv-lbl-hi" text-anchor="middle">use_ops()</text>
          <text x="72" y="90" class="sv-lbl-dim" text-anchor="middle">text 26 B</text>
          <line x1="128" y1="78" x2="146" y2="78" class="sv-arrow-a"></line>
          <rect x="148" y="54" width="150" height="48" rx="4" class="sv-box"></rect>
          <text x="223" y="74" class="sv-lbl" text-anchor="middle">对象 { ops*, ctx* }</text>
          <text x="223" y="90" class="sv-lbl-dim" text-anchor="middle">2 个指针 · 每次搬运 ctx</text>
          <line x1="298" y1="68" x2="358" y2="68" class="sv-arrow-a"></line>
          <text x="328" y="62" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--amb)">① blx r3</text>
          <line x1="298" y1="90" x2="358" y2="90" class="sv-arrow-a"></line>
          <text x="328" y="104" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--amb)">② blx r3</text>
          <rect x="360" y="54" width="160" height="48" rx="4" class="sv-box"></rect>
          <text x="440" y="74" class="sv-lbl" text-anchor="middle">uart_init</text>
          <text x="440" y="90" class="sv-lbl-dim" text-anchor="middle">uart_write</text>
          <text x="532" y="74" class="sv-lbl-dim" style="fill:var(--red)">两次间接跳转</text>
          <text x="532" y="90" class="sv-lbl-dim">顺序核无动态预测，取指等目标</text>

          <!-- 重构后 -->
          <text x="16" y="176" class="sv-lbl-hi" style="fill:var(--grn)">重构后 · 编译期 concept</text>
          <rect x="16" y="188" width="150" height="48" rx="4" class="sv-grn-s"></rect>
          <text x="91" y="208" class="sv-lbl-hi" text-anchor="middle">use_generic&lt;Uart&gt;()</text>
          <text x="91" y="224" class="sv-lbl-dim" text-anchor="middle">text 16 B</text>
          <line x1="166" y1="212" x2="330" y2="212" class="sv-arrow"></line>
          <text x="248" y="206" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--grn)">全部内联 · 无间接跳转</text>
          <rect x="332" y="188" width="150" height="48" rx="4" class="sv-box"></rect>
          <text x="407" y="208" class="sv-lbl" text-anchor="middle">Uart::init / write</text>
          <text x="407" y="224" class="sv-lbl-dim" text-anchor="middle">三步压成寄存器读写</text>
          <text x="500" y="208" class="sv-lbl-dim" style="fill:var(--grn)">一条直线</text>
          <text x="500" y="224" class="sv-lbl-dim">无 blx / 无 ctx</text>

          <line x1="16" y1="252" x2="644" y2="252" class="sv-dash"></line>

          <!-- 契约检查时机 -->
          <text x="16" y="272" class="sv-lbl-hi">契约在哪一层被检查？</text>
          <text x="16" y="296" class="sv-lbl-dim" style="fill:var(--red)">运行期 / 链接期才发现</text>
          <text x="16" y="312" class="sv-lbl-dim">（void* 强转 + 口头约定）</text>
          <text x="16" y="332" class="sv-lbl-dim" style="fill:var(--grn)">实例化时直接报"缺 write()"</text>

          <rect x="290" y="282" width="354" height="46" rx="4" class="sv-red-s" stroke-dasharray="5 4"></rect>
          <text x="302" y="300" class="sv-lbl-dim" style="fill:var(--red)">error: no matching function for call to 'boot(Half&amp;)'</text>
          <text x="302" y="318" class="sv-lbl-dim" style="fill:var(--red)">note: the required expression 'd.write(b)' is invalid</text>
        </svg>
```

 

重构省下的不是那 10 个字节（26 → 16 B，两份 ` .o ` 来源不同，只能当量级参考），而是 **两跳间接** ： 上面那条路径上，` blx r3 ` 的目标地址要到运行时从 ` ops ` 指针里读出来， 所以取指会被打断（目标要等加载完成；Cortex-M3/M0 是 **顺序发射、没有动态分支预测器** ），而且这种调用无法被内联、也无法做静态的跨函数优化；` ctx ` 还得单独占一个寄存器一路搬。 下面那条路径把同一个语义变成了 **静态可解析的调用** ，于是能内联成一条直线—— 代价是它 **只对 ` Uart ` 有效** ，换类型就多一份实例化（回到 FIG 4.1）。 最下面那个红框是收益里最容易被低估的一项：契约从"运行期靠约定"变成了"编译期硬约束"， 写错类型时编译器 **直接点到 ` d.write(b) ` 这一行** ，而不是留给你一个运行期崩溃。

 

```zhizhan-anchor
m10-3
```



## 10.3 那还要不要虚表？—— 两个都要会

 

concept 方案很漂亮，但它 **丢失了运行期多态** ：` St7789 `/` Ili9341 ` 是不同的类型， 没法放进"一个 ` Display* ` 数组"里在运行期遍历。所以真实工程里两者常并存：

 

| 需求 | 用哪个 |
| --- | --- |
| 实现编译期已知、追求零开销与强检查 | concept / 模板 |
| 运行期要在一批"同接口不同实现"间切换/遍历 | 虚表（或第①册的 ops 表） |
| 边界清晰的两层：上层泛型、边界处擦除类型 | 混合：内部用 concept，暴露给外部的接口用 **手写的函数指针表** （或虚表）做一次类型擦除 |

 

✔ 一个实用的折中：类型擦除边界

 

内部逻辑用模板/concept 享受零开销与强检查；在最外面的一层（比如"注册一个显示后端"的接口）用一次  **类型擦除** （虚表 / 函数指针表）把不同实现统一起来。这样 **热路径是静态的、边界是可扩展的** 。 第①册的 ops 表没有过时——它正好适合那个"边界"。  *擦除层别用 ` std::function ` 这类"可能走堆、且依赖异常运行时"的现成组件；在 MCU 上手写一个小函数指针表（或极简虚表）更可控、更省体积。*

 

display\_erase.cpp — 边界处一次类型擦除：内部泛型、外部统一 C\+\+

 

```text
// display_erase.cpp —— 手写一张 vtbl，把不同实现统一到"边界"
#include <cstdint>

struct DisplayVtbl {                    // 手写的"虚表"，等价于第①册的 ops 表
    void     (*init)(void* self);
    void     (*clear)(void* self, uint8_t on);
    uint16_t (*width)(const void* self);
};

template <class D>
struct DisplayModel {                   // 把任意具体类型适配成上面那张表
    static void     init(void* self)              { static_cast<D*>(self)->init(); }
    static void     clear(void* self, uint8_t on) { static_cast<D*>(self)->clear(on); }
    static uint16_t width(const void* self)       { return static_cast<const D*>(self)->width(); }
    static constexpr DisplayVtbl vtbl{&init, &clear, &width};
};

class St7789 {
public:
    explicit St7789(uint16_t w) noexcept : w_(w) {}
    void     init() noexcept {}
    void     clear(uint8_t) noexcept {}
    uint16_t width() const noexcept { return w_; }
private:
    uint16_t w_;
};

// 边界：只认 vtbl + void*，不同实现可以放进同一个数组、在运行期遍历
void bring_up(const DisplayVtbl* vt, void* self) {
    vt->init(self);
    vt->clear(self, 1);
    (void)vt->width(self);
}

void use(St7789& lcd) { bring_up(&DisplayModel<St7789>::vtbl, &lcd); }
```

 

✔ 这一层把两种方案接了起来

 

` DisplayModel<D> ` 用模板在 **编译期** 生成"某类型怎么调"的静态函数（零开销、可内联）， 而 ` DisplayVtbl ` 把它们收成一张运行期的函数指针表 —— 于是 **热路径仍是静态的，边界却可以运行期切换/遍历** 。 这正是 §10.3 说的"内部 concept、边界擦除"的落地写法；它和第①册的 ops 表是同一个东西，只是填表由模板自动完成、不再手写。

 

```zhizhan-anchor
m10-4
```



## 10.4 重构的纪律（比技术更重要）

 

 
1. **先测后改** ：重构前把行为测住（第①册 Module 07 的 PC 单元测试），改完立刻回归。
 
2. **小步前进** ：一次只换一个模块、一个接口；用 ` extern "C" ` 让新旧共存（Module 09）。
 
3. **盯住体积** ：每次改动都用 ` size `/` nm --size-sort ` 对比，别让模板实例化悄悄膨胀（Module 04）。
 
4. **别为重构而重构** ：C 写得好好的、又没人会误用的地方，不必强行 C\+\+ 化。收益要能说清。
 

 

✔ 重构后要盯的三个数

 

 
- ` sizeof(对象) `：重构后应只剩自身状态（如 ` St7789 ` 的 ` w_ ` = 2 字节），不含 ` ops `/` ctx ` 指针。
 
- ` nm --size-sort `：看有没有某个实例化特别大；模板每多一种类型就多一份代码。
 
- 整镜像 ` size `：确认没有把 ` libstdc++ `/异常运行时拖进来（对照 §1.3 那个 566 KB 的教训）。

 

```zhizhan-anchor
m10-5
```



## 10.5 全册回顾：一张"用不用"的速查

 

| 场景 | 用 | 不要用 |
| --- | --- | --- |
| 封装驱动/句柄 | 类 \+ RAII | 裸 ` void* ` \+ 手动配对 |
| 生成查找表 | constexpr/consteval | 运行时初始化 / 手抄 |
| 实现已知的多态 | 模板/CRTP/concept | 不必要的虚表 |
| 运行期切换实现 | 虚表 / 类型擦除 | 模板（做不到） |
| 共享数据并发 | std::atomic（单次读写；M0 读-改-写用临界区） | ` volatile ` 当原子用 |
| 中断服务程序 | 极简、无异常、无分配 | 异常/堆/阻塞/iostream |
| 动态内存 | 固定块池/arena | malloc/shared\_ptr/iostream |
| 跟 C 库/启动文件打交道 | extern "C" | 直接暴露 C\+\+ 符号 |

 

**FIG 10.2**  泛型驱动 vs 虚表驱动：两条路各自适合什么

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="泛型在编译期定实现、零开销；虚表在运行期可换、有间接成本">
          <rect x="30" y="40" width="200" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="130" y="63" class="sv-lbl-hi" text-anchor="middle">泛型驱动（模板/concepts）</text>
          <text x="130" y="83" class="sv-lbl-dim" text-anchor="middle">编译期绑定·可内联·零开销</text>
          <rect x="330" y="40" width="200" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="430" y="63" class="sv-lbl-hi" text-anchor="middle">虚表驱动</text>
          <text x="430" y="83" class="sv-lbl-dim" text-anchor="middle">运行期可换·代价是间接调用</text>
          <text x="600" y="60" class="sv-lbl-dim" text-anchor="middle">按需求</text>
          <text x="600" y="80" class="sv-lbl-hi" text-anchor="middle">二选一</text>
        </svg>
```

 

重构的纪律：先保证行为不变、再谈抽象；两种多态都要会，按"是否需要运行期换实现"来选。

 

| 需求 | 泛型 | 虚表 |
| --- | --- | --- |
| 实现编译期固定 | ✓ |  |
| 运行期热插拔 |  | ✓ |
| 极致体积/速度 | ✓ |  |
| 统一接口容器 |  | ✓ |

 

◆ 迁移练习

 

把第①册的 ` ops ` 函数指针表用 concepts \+ 模板重构一版，保证行为不变，并对比重构前后的体积与可读性。

 

◆ 本章要点

 

 
- 用 ` concept ` 把"什么是显示器"写成 **编译期约束** ：无 vptr、无 ` void* `、调用可内联、实例化时报错可读。
 
- 代价： **丢失运行期多态** ——没法把不同实现放进同一个指针/数组。
 
- 真实工程 **两者并存** ：内部用模板/concept，边界用虚表/类型擦除。
 
- 重构纪律： **先测后改、小步前进、盯住体积、别为重构而重构** 。
 
- 第①册的 ops 表没过时——它是"运行期可切换"这个需求的正确解。

 

◆ 自测 · Module 10（先答再看）

 

 
1. 简答：用 concept \+ 模板重构 ops 表，最大的收益与最大的代价各是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"收益： **零 vptr/零 ctx、静态可内联、参数类型在编译期被检查、报错可读** 。代价： **丢失运行期多态** ——不能把不同实现放进同一个基类指针/数组在运行期切换。"}
   ```
 
2. 判断：有了 concept，ops 虚表就完全没用了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。需要\"运行期在一批同接口不同实现间切换/遍历\"时，仍要虚表或类型擦除。常见做法是 **内部用模板、边界用一次类型擦除** ，兼顾零开销与可扩展。"}
   ```
 
3. 填空：重构的第一步应该是 \_\_\_\_\_\_，而不是直接改代码。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**先把行为测住（写测试）** 。重构改的是结构、不改行为，所以必须有能立刻判断\"行为没变\"的回归测试（第①册 Module 07）。"}
   ```
 
4. 简答：重构时为什么每次都要看 ` size `/` nm --size-sort `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为模板/concept 会 **为每种类型实例化一份代码** （Module 04 的膨胀问题）。不看体积，可能\"重构后更安全了、但固件超了\"。用 ` nm --size-sort ` 能发现异常大的实例化。"}
   ```
 
5. 判断：一个项目应该"全量改成 C\+\+"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不建议。稳妥路径是 **自下而上、逐文件** ：先把纯逻辑模块改成 C\\+\\+ 并用 ` extern \"C\" ` 接回 C 工程，跑通验证再继续。C 写得好、没人误用的地方不必强行 C\\+\\+ 化。"}
   ```
 
6. 决策：minidrv 里"同一块 LCD， **运行期** 可能换成另一种控制器"，该用 concept 泛型还是虚表/类型擦除？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"用 **类型擦除/虚表** （如 ` display_erase.cpp ` 的 ` DisplayVtbl `）——因为需要运行期在多个实现间切换/遍历，而 concept 泛型在编译期就把类型定死了。只有\"编译期就确定是哪种 LCD、且要极致开销\"时，才纯用 concept。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 10 完成？**  挑一个驱动抽象，写一份 concept 版本，和现有实现比 ` size ` 与可读性——再决定要不要换。

 

```zhizhan-assessment
{"id":"course-b02-m10","criterion":"先保持 C 基线行为，再替换一个驱动；正常与故障路径均与基线对照。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
