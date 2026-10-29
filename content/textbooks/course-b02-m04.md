# 模板与零开销抽象

```zhizhan-anchor
m04
```



第①册用"虚表 \+ ` void* ctx `"实现多态，每对象多一个指针、每调用一次间接跳转。 C\+\+ 还提供了另一条路： **把分派挪到编译期** ——策略模板、CRTP、` if constexpr `。 两条路都要会用，关键是知道各自什么时候划算。

 

> ◷ 约 65 分钟 · ◈ 模板 vs 虚表实测 · ⚑ 零开销的真相

 

```zhizhan-anchor
m04-1
```



## 4.1 两种多态：编译期 vs 运行期

 

| 维度 | 运行期多态（虚表） | 编译期多态（模板/CRTP） |
| --- | --- | --- |
| 分派时机 | 运行期：查 vptr → 跳表 | 编译期：直接静态调用，可内联 |
| 每对象开销 | **一个 vptr** （4 字节） | 0 |
| 调用开销 | 一次间接跳转（不可预测） | 可能内联为几条指令 |
| 能换实现吗 | 运行期可换（同一接口，多实现） | 编译期固定（类型即实现） |
| 适用 | 运行期要切换、或实现清单在链接期才知道 | 实现已知、追求极致开销、可静态绑定 |

 

vptr\_cost.cpp — 用 static\_assert 量出"vptr 占一个指针" C\+\+

 

```text
// vptr_cost.cpp —— 编译期就能量出"每个多态对象多花了多少"
#include <cstdint>
#include <cstddef>

struct Plain   { int x; void f() {} };                 // 无虚函数
struct Poly    { int x; virtual void f() {} };         // 有虚函数 → 多一个 vptr

static_assert(sizeof(Plain) == sizeof(int),                 "Plain 只有一个 int");
static_assert(sizeof(Poly)  == sizeof(int) + sizeof(void*), "Poly 多了一个 vptr（4 字节）");
```

 

这段 ` static_assert ` 本身就是证据：在 32 位 ARM 上， **每个多态对象比普通对象多 4 字节** （一个 vptr）。 实现清单在运行期固定、但对象很多时，这笔"每对象 4 字节"就会累积。

 

```zhizhan-anchor
m04-2
```



## 4.2 策略模板：把"后端"变成模板参数

 

同一个 UART 的发送路径，可能有"阻塞写"和"[DMA](term:dma) 写"两种后端。虚表版本要在每个对象里存一个 ops 指针、每次发送一次间接跳转； 策略模板把后端当作 **模板参数** ，调用被编译成立即数的静态调用，编译器还能顺手内联。

 

uart\_policy.cpp — 后端在编译期确定，零间接跳转 C\+\+

 

```text
// uart_policy.cpp —— 两种后端，同一套上层代码（STM32F1 USART：SR@0x00, DR@0x04）
#include <cstdint>

struct BlockingBackend {
    static void send(volatile uint32_t* reg, uint8_t b) noexcept {
        while (!(reg[0] & 0x80u)) { }        // 等 SR 的 TXE（bit7）
        reg[1] = b;                          // 写 DR
    }
};
struct DmaBackend {
    static void send(volatile uint32_t* reg, uint8_t b) noexcept {
        reg[3] = (uint32_t)b;                // 示意：把数据/搬运交给 DMA 通道
    }
};

// 策略模板：Backend 是"编译期参数"
template <class Backend>
class Uart {
public:
    explicit Uart(volatile uint32_t* reg) noexcept : reg_(reg) {}
    void write_byte(uint8_t b) noexcept { Backend::send(reg_, b); }
private:
    volatile uint32_t* reg_;
};

void use_blocking(volatile uint32_t* r) { Uart<BlockingBackend> bus(r); bus.write_byte(0x10); }
void use_dma(volatile uint32_t* r)      { Uart<DmaBackend>      bus(r); bus.write_byte(0x10); }
```

 

◆ 代价对比

 

**虚表版** ：对象多 4 字节 vptr；调用是一次间接跳转；好处是可以在 **运行期** 换后端。  **策略模板版** ：对象 **不含 vptr** ；调用是静态调用、可内联；代价是"后端必须在编译期确定"， 且每换一个后端就生成一份 ` Uart<Backend> ` 的代码（ **实例化膨胀** ，见 §4.5；那里的探针用一个同构的 ` Spi<Policy> ` 薄例子来量字节）。  *选哪个取决于"后端要不要运行期切换"——要，用虚表；不要，用模板。*

 

```zhizhan-anchor
m04-3
```



## 4.3 CRTP：让基类"看见"派生类

 

有时你想要继承的复用、又不想付 vptr 的代价。CRTP（Curiously Recurring Template Pattern）让基类把派生类当作模板参数， 从而在 **编译期** 完成"调用派生类实现"这件事：

 

crtp.cpp — 静态多态：无 vptr 的"继承 \+ 覆写" C\+\+

 

```text
// crtp.cpp —— 基类通过模板参数知道派生类，调用在编译期解析
#include <cstdint>

template <class Derived>
struct SensorBase {
    uint16_t read() noexcept {
        return static_cast<Derived*>(this)->read_raw();   // 编译期绑定到 Derived::read_raw
    }
};

struct TempSensor : SensorBase<TempSensor> {
    uint16_t read_raw() noexcept { return 2500; }          // 25.00℃ * 100
};
struct HumidSensor : SensorBase<HumidSensor> {
    uint16_t read_raw() noexcept { return 4800; }
};

template <class S>
uint16_t sample(S& s) noexcept { return s.read(); }        // 可为任意 SensorBase 派生类生成一份
```

 

⚠ CRTP 的代价与陷阱

 

 
- 无 vptr、调用可内联 —— 但 **每个派生类型都生成一份基类代码** （和策略模板一样会膨胀）。
 
- 它不是"运行期多态"： **无法用基类指针统一存放不同派生对象** 。需要"一批异构对象"时，还是得回到虚表。
 
- 写法略绕（` static_cast<Derived*>(this) `），团队要约定统一，否则可读性下降。

 

```zhizhan-anchor
m04-4
```



## 4.4 ` if constexpr `：只编译需要的那条分支

 

以前用 ` #if `/模板特化做"按类型走不同实现"，现在用 ` if constexpr ` 更直观：  **条件为假的分支根本不会被实例化** （不是"运行期不走"，而是"编译期不生成"）。  *但别误解成"整块跳过"：被丢弃分支里的 **非依赖名** （不依赖模板参数的名称）仍要经过语法与名称检查，写错照样编译不过；真正被丢弃的是 **依赖模板参数** 的那部分实例化。*

 

if\_constexpr.cpp — 编译期分支，未选中的分支不生成 C\+\+

 

```text
// if_constexpr.cpp —— 按元素宽度选择不同的长度计算
#include <cstdint>

template <class T>
uint32_t byte_count(const T* /*p*/, uint32_t n) noexcept {
    if constexpr (sizeof(T) == 1) {
        return n;                 // uint8_t：个数就是字节数
    } else {
        return n * (uint32_t)sizeof(T);
    }
}

uint32_t f8(const uint8_t* p, uint32_t n) { return byte_count(p, n); }
uint32_t f32(const uint32_t* p, uint32_t n){ return byte_count(p, n); }
```

 

dispatch\_traits.cpp — if constexpr \+ 类型特征：按"有无符号"选实现 C\+\+

 

```text
// dispatch_traits.cpp —— 编译期按类型特征分派，未选分支不生成
#include <cstdint>
#include <type_traits>

template <class T>
constexpr bool fits_u16(T x) noexcept {
    if constexpr (std::is_unsigned_v<T>) {
        return x <= 0xFFFFu;                                  // 无符号：只查上界
    } else {
        return x >= 0 && static_cast<uint32_t>(x) <= 0xFFFFu;  // 有符号：还要查下界
    }
}

static_assert(fits_u16(1000u), "uint 1000 放得下");
static_assert(!fits_u16(-1),   "负数放不进 u16");

int encode(uint32_t v) noexcept { return fits_u16(v) ? 1 : 0; }
```

 

```zhizhan-anchor
m04-5
```



## 4.5 代价：模板实例化膨胀

 

模板的"零开销"是指 **运行时开销为零** ；它的代价在 **代码体积** ：每种模板实参组合都会生成一份代码。 如果同一份代码被多种类型实例化，体积会成倍增长。

 

| 现象 | 原因 | 缓解 |
| --- | --- | --- |
| 固件变大，符号里出现 ` foo<int> `/` foo<long> `… | 多份实例化 | 把与类型无关的部分抽到一个 **非模板函数** 里，模板只做薄薄的转发 |
| 同一定义被多个 TU 重复生成 | 模板定义在头文件里，每个 TU 各生成一份 weak/COMDAT 副本 | 跨 TU 的重复实例由  **weak/COMDAT 符号在链接期自动只保留一份** （与 ` --gc-sections ` 无关）；` --gc-sections ` 删的是 **"没人引用的 section"** ，不是"去重"。要合并"内容相同但来源不同"的代码用 ` -Wl,--icf=all `；还可用显式实例化 \+ ` extern template ` 控制生成点 |
| 调试困难 | 符号名被修饰得很长 | ` c++filt ` 还原；` nm --size-sort ` 找最大的实例化 |

 

**bash**  — 复跑：` bash tools/probes/m04.sh `（Arm GNU Toolchain 13.3.1，cortex-m3）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c tpl_one.cpp  -o tpl_one.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c tpl_many.cpp -o tpl_many.o
$ arm-none-eabi-size tpl_one.o tpl_many.o
   text    data     bss     dec     hex filename
     24       0       8      32      20 tpl_one.o     # 只有 Spi<Blocking>
    116       0      32     148      94 tpl_many.o    # Blocking/Polling/Irq/Dma 四个
# text 24 → 116 字节（≈4 倍）；bss 8 → 32 —— 每多一个策略参数，就多一份真实代码和一份状态

$ arm-none-eabi-nm --print-size --demangle --size-sort tpl_many.o
  00000000 00000018 T use_blocking(unsigned long)
  00000018 0000001c T use_polling(unsigned long)
  00000034 00000020 T use_irq(unsigned long)
  00000054 00000020 T use_dma(unsigned long)
# 四份函数体各自独立、长度不同（0x18/0x1c/0x20/0x20），没有任何合并 ——
# 因为 transfer() 被内联进了各自的函数体里，"共用一份实现"在机器码层面并不存在

$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -ffunction-sections -fdata-sections -c tpl_gc.cpp -o tpl_gc.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -nostdlib -Wl,-e,main -Wl,--no-gc-sections tpl_gc.o -o nogc.elf
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -nostdlib -Wl,-e,main -Wl,--gc-sections    tpl_gc.o -o gc.elf
$ arm-none-eabi-size nogc.elf gc.elf
   text    data     bss     dec     hex filename
    144       0      32     176      b0 nogc.elf
     28       0       8      36      24 gc.elf
# 两者只差一个链接开关：没被调用的实例被整段删除，text 144 → 28
```

 

**FIG 4.1**  实例化膨胀：每多一个策略实参组合，就多一份 **完整的机器码**  （高度按 ` --print-size ` 真实字节数等比例绘制）

 

```zhizhan-figure
<svg viewBox="0 0 660 372" role="img" aria-label="模板实例化膨胀对照：单实例 24 字节 vs 四实例各自独立的 24/28/32/32 字节，以及 gc-sections 的裁剪效果">
          <!-- 表头 -->
          <text x="152" y="40" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--grn)">1 个实例</text>
          <text x="152" y="56" class="sv-lbl-dim" text-anchor="middle">tpl_one.o · text 24 B</text>
          <text x="452" y="40" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">4 个实例</text>
          <text x="452" y="56" class="sv-lbl-dim" text-anchor="middle">tpl_many.o · text 116 B</text>

          <!-- 基线 -->
          <line x1="100" y1="244" x2="644" y2="244" stroke="var(--line-2)"></line>

          <!-- 左：单实例 -->
          <rect x="120" y="210" width="64" height="34" rx="3" class="sv-grn-s"></rect>
          <text x="152" y="231" class="sv-lbl-hi" text-anchor="middle">24 B</text>
          <text x="152" y="264" class="sv-lbl-dim" text-anchor="middle">bss 8 B</text>

          <!-- 右：四个实例，逐段堆叠（自下而上） -->
          <rect x="420" y="210" width="64" height="34" rx="3" class="sv-amb-s"></rect>
          <rect x="420" y="171" width="64" height="39" rx="3" class="sv-amb-s"></rect>
          <rect x="420" y="126" width="64" height="45" rx="3" class="sv-amb-s"></rect>
          <rect x="420" y="81" width="64" height="45" rx="3" class="sv-amb-s"></rect>
          <text x="452" y="264" class="sv-lbl-dim" text-anchor="middle">bss 32 B</text>

          <line x1="484" y1="227" x2="494" y2="227" stroke="var(--line-2)"></line>
          <text x="498" y="231" class="sv-lbl">use_blocking 24 B</text>
          <line x1="484" y1="190" x2="494" y2="190" stroke="var(--line-2)"></line>
          <text x="498" y="194" class="sv-lbl">use_polling &nbsp;28 B</text>
          <line x1="484" y1="148" x2="494" y2="148" stroke="var(--line-2)"></line>
          <text x="498" y="152" class="sv-lbl">use_irq &nbsp;&nbsp;&nbsp;&nbsp;32 B</text>
          <line x1="484" y1="103" x2="494" y2="103" stroke="var(--line-2)"></line>
          <text x="498" y="107" class="sv-lbl">use_dma &nbsp;&nbsp;&nbsp;&nbsp;32 B</text>

          <!-- 单实例高度的参考线 -->
          <line x1="190" y1="210" x2="490" y2="210" class="sv-dash"></line>
          <text x="196" y="204" class="sv-lbl-dim">← 一个实例的高度（24 B）</text>

          <line x1="16" y1="284" x2="644" y2="284" class="sv-dash"></line>

          <!-- 链接期兜底 -->
          <text x="16" y="302" class="sv-lbl-hi">链接期兜底：这 4 份里没人调用的，可以被整段删掉</text>
          <text x="136" y="329" class="sv-lbl-dim" text-anchor="end">-Wl,--no-gc-sections</text>
          <rect x="144" y="316" width="130" height="18" rx="3" class="sv-red-s"></rect>
          <text x="280" y="329" class="sv-lbl-hi">144 B</text>

          <text x="136" y="357" class="sv-lbl-dim" text-anchor="end">-Wl,--gc-sections</text>
          <rect x="144" y="344" width="25" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="175" y="357" class="sv-lbl-hi" style="fill:var(--grn)">28 B</text>
          <text x="290" y="357" class="sv-lbl-dim" style="fill:var(--grn)">← 省下 116 B，只留真正被调用的那份</text>
        </svg>
```

 

右列四段是 ` nm --print-size --demangle --size-sort ` 的原样读数： **24 / 28 / 32 / 32** ， 加起来正好 116——这四份函数体 **长度各不相同、边界分明，没有任何共用** 。 原因在左图中那条虚线：每个 ` use_*() ` 都是"薄壳"，` transfer() ` 被 **内联** 进了各自函数体， 所以"四份实例共享一份实现"在机器码层面 **并不存在** 。注意 ` bss ` 也同步 8 → 32： 每份实例还各带一份状态对象。下框是另一种兜底：没被调用的实例，靠链接器把整个 section 删掉（144 → 28 B）。

 

✔ 一句话原则

 

**模板适合"薄而通用"的代码** （策略、类型安全包装、编译期计算），  **不适合把大块逻辑塞进模板头文件** ——那会让每份实例化都拖着整块代码。体积敏感时，用 ` -ffunction-sections ` 加 ` --gc-sections ` 兜底。

 

✔ 控制膨胀的另外两件工具

 

 
- **` -flto `（链接期优化）** ：让"跨 TU 内联 \+ 删死代码"在链接期统一发生，常能显著压掉被多处实例化又高度重复的模板代码；代价是编译/链接变慢，且需工具链带 LTO 插件（Arm GNU Toolchain 支持）。
 
- **显式实例化 \+ ` extern template `** ：在某个 ` .cpp ` 里写 ` template class Spi<Blocking>; ` 只生成这一份；在头文件里写 ` extern template class Spi<Blocking>; ` 让其它 TU  **不再各生成一份** 。适合"实例化清单已知且有限"的场景。

 

```zhizhan-anchor
m04-6
```



## 4.6 进阶：用 ` extern template ` 控制"谁生成这份实例"

 

` --gc-sections ` 删的是" **没人引用** 的"实例；但"被引用了、却每个 TU 各生成一份"的重复，它管不了。 这种重复在 **对象文件** 层面是真实存在的（每个 TU 一份 weak 定义）。标准给了另一种控制手段： **显式实例化 \+ ` extern template `** 。

 

extern\_template.cpp — 一个显式实例化点，其余 TU 不再生成 C\+\+

 

```text
// extern_template.cpp —— 模板被多个 TU 使用时的两种写法
#include <cstdint>

struct Blocking { static constexpr uint32_t spins = 3; };

template <class P>
struct Engine {
    __attribute__((noinline))
    static uint32_t run(uint32_t w) {
        for (uint32_t i = 0; i < P::spins; ++i) w = w * 1664525u + 1013904223u;
        return w;
    }
};

// ① 放在头文件里：告诉所有 TU"Engine<Blocking> 别在这里生成"
extern template struct Engine<Blocking>;

// ② 放在唯一的 .cpp 里：显式实例化，真正生成这一份
template struct Engine<Blocking>;

uint32_t use_engine(uint32_t w) { return Engine<Blocking>::run(w); }
```

 

**bash**  — 复跑：` bash tools/probes/m04.sh `（第 4 节：同一模板在 2 个 TU 里的两种处理）

 

```text
# 4a) 不带 extern template：两个 .o 各自生成一份 Engine<Blocking>::run
$ arm-none-eabi-nm -C ext_w1.o | grep Engine
00000000 W Engine<Blocking>::run(unsigned long)
$ arm-none-eabi-nm -C ext_w2.o | grep Engine
00000000 W Engine<Blocking>::run(unsigned long)

# 4b) 头文件加 extern template + 单点显式实例化：只 ext_xi.o 生成定义
$ arm-none-eabi-nm -C ext_x1.o | grep Engine
         U Engine<Blocking>::run(unsigned long)
$ arm-none-eabi-nm -C ext_x2.o | grep Engine
         U Engine<Blocking>::run(unsigned long)
$ arm-none-eabi-nm -C ext_xi.o | grep Engine
00000000 W Engine<Blocking>::run(unsigned long)
```

 

✔ 什么时候用 ` extern template `

 

 
- **实例化清单已知且有限** （如只对 ` Blocking/Dma ` 两种后端实例化）：用一个 ` .cpp ` 显式实例化，头文件加 ` extern template `。
 
- **收益** ：减小每个 ` .o `、加快链接，且不依赖"链接器一定会做 weak/COMDAT 去重"。 *注意：它 **不减少"被真正使用"的实例化份数** ，也不替代 ` --gc-sections `（后者删没引用的）。*
 
- **代价** ：实例化清单需要维护；漏了显式实例化就会变成链接期 ` undefined reference `。

 

**FIG 4.2**  静态多态（模板/CRTP）与动态多态（虚表）

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="模板在编译期确定调用，虚表在运行期经指针查表">
          <rect x="30" y="40" width="180" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="120" y="63" class="sv-lbl-hi" text-anchor="middle">静态多态</text>
          <text x="120" y="83" class="sv-lbl-dim" text-anchor="middle">编译期绑定·可内联·0 开销</text>
          <path d="M210 68 L260 68" class="sv-arrow"></path>
          <rect x="262" y="40" width="180" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="352" y="63" class="sv-lbl-hi" text-anchor="middle">动态多态</text>
          <text x="352" y="83" class="sv-lbl-dim" text-anchor="middle">运行期查虚表·可换实现</text>
          <text x="540" y="60" class="sv-lbl-dim" text-anchor="middle">需要"运行期换对象"</text>
          <text x="540" y="80" class="sv-lbl-hi" text-anchor="middle">才用虚表</text>
        </svg>
```

 

能用模板在编译期定下来的，就不要付虚表（vptr \+ 间接调用）的代价。

 

| 方式 | 绑定时机 | 开销 | 适用 |
| --- | --- | --- | --- |
| 模板 ` template ` | 编译期 | 零（可内联） | 后端在编译期已知 |
| CRTP | 编译期 | 零 | 基类需调用派生类 |
| 虚函数 / 虚表 | 运行期 | vptr \+ 间接调用 | 运行期换实现 |
| 函数指针 / ops 表 | 运行期 | 间接调用 | C 风格多态 |

 

| 信号 | 选静态 | 选动态 |
| --- | --- | --- |
| 实现种类编译期固定 | ✓ |  |
| 需要运行时热插拔 |  | ✓ |
| 代码体积敏感 | ✓ |  |
| 需要统一接口容器 |  | ✓ |

 

◆ 迁移练习

 

把一个"用虚函数做后端切换"的驱动，改成模板参数化版本；对比两者的 text 体积与是否可内联。

 

◆ 本章要点

 

 
- 多态有两条路： **运行期（虚表，多 4 字节/对象 \+ 间接跳转）**  与  **编译期（模板/CRTP，零 vptr、可内联）** 。
 
- 用 ` static_assert ` 可当场量出 ` sizeof(Poly) == sizeof(int) + sizeof(void*) `。
 
- 策略模板把"后端"变成模板参数：无 vptr、静态分派，但 **后端必须编译期确定** 。
 
- CRTP 做"无 vptr 的继承"，代价是每派生类型一份代码，且 **无法统一存放异构对象** 。
 
- ` if constexpr ` 让未选中的分支 **根本不生成** 。
 
- 模板的代价是 **实例化膨胀** ：用"非模板公共函数 \+ 薄模板 \+ ` --gc-sections `"控制体积。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 填空：在 32 位 ARM 上，一个含虚函数的对象比普通对象多 \_\_\_\_\_\_ 字节。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"多  **4 字节** （一个 vptr）。可用 ` static_assert(sizeof(Poly) == sizeof(int) + sizeof(void*)) ` 当场验证。"}
   ```
 
2. 简答：策略模板和虚表，各在什么情况下更合适？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"需要 **运行期切换** 实现、或实现清单在链接期才知道 → 虚表。实现 **编译期已知** 、追求零 vptr/可内联 → 策略模板。二者不是替代，是按\"要不要运行期换实现\"分工。"}
   ```
 
3. 判断：CRTP 可以在运行期用基类指针统一存放不同派生对象吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。CRTP 是 **编译期** 多态，基类是基于具体派生类型实例化的模板，不存在\"一个统一的运行期基类指针\"。要存放异构对象，仍需虚表（或回到第①册的 ops 表方案）。"}
   ```
 
4. 简答：` if constexpr ` 和普通 ` if ` 的本质区别？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` if constexpr ` 的条件在 **编译期** 求值，未选中的分支 **不会被实例化/生成** ；普通 ` if ` 两条分支都会被编译，只是运行期走哪条的问题。"}
   ```
 
5. 简答：模板的"零开销"指什么？它的代价在哪？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"\"零开销\"指 **运行时开销为零** （无分派、可内联）；代价在 **代码体积** ——每种实参组合生成一份实例化。缓解办法：抽非模板公共函数、` -ffunction-sections + --gc-sections `、显式实例化控制。"}
   ```
 
6. 动手：给 ` uart_policy.cpp ` 再加一个 ` IrqBackend `（含 ` use_irq() `），` nm --size-sort ` 会多出几份符号？为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会多一份 ` use_irq `。因为 ` Uart<IrqBackend> ` 是一个 **新类型** ，` write_byte ` 连同被内联的 ` send ` 会再生成一份机器码。这就是\"每种模板实参组合一份\"的实例化膨胀——用 ` --gc-sections ` 只能删\"没人引用的\"，删不掉\"你确实用了\"的。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  挑一个用虚表实现的抽象，评估能否改成策略模板；用 ` nm --size-sort ` 看看实例化有没有膨胀。

 

```zhizhan-assessment
{"id":"course-b02-m04","criterion":"替换两个模板后端，说明实例化数量与错误诊断；检查 Flash 是否随实例增加。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
