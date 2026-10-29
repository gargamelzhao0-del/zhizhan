# embedded-hal 抽象

```zhizhan-anchor
m04
```



` embedded-hal ` 是嵌入式 Rust 的"驱动接口标准"： **上层驱动只依赖 trait，不依赖具体芯片** 。 这一节讲清 trait 分层（PAC → HAL → 驱动 → 应用），以及最关键的选型问题： **泛型（编译期单态化）还是 ` dyn `（运行期分派）** 。

 

> ◷ 约 70 分钟 · ◈ trait 分层 · 泛型 vs dyn · ⚑ 体积与灵活性的取舍

 

```zhizhan-anchor
m04-1
```



## 4.1 四层结构：谁依赖谁

 

**FIG 4.1**  嵌入式 Rust 的分层：上层只认 trait，越往下越"贴着芯片"

 

```zhizhan-figure
<svg viewBox="0 0 660 210" role="img" aria-label="PAC / HAL / 驱动 / 应用 四层结构">
          <rect x="30" y="26" width="600" height="34" rx="6" class="sv-box"></rect>
          <text x="46" y="47" class="sv-lbl-hi">应用 / App</text>
          <text x="614" y="47" class="sv-lbl-dim" text-anchor="end">只依赖 HAL 的 trait</text>
          <rect x="30" y="70" width="600" height="34" rx="6" class="sv-grn-s"></rect>
          <text x="46" y="91" class="sv-lbl-hi" style="fill:var(--grn)">通用驱动 / Driver</text>
          <text x="614" y="91" class="sv-lbl-dim" text-anchor="end">泛型 &lt;P: OutputPin&gt;，跨芯片复用</text>
          <rect x="30" y="114" width="600" height="34" rx="6" class="sv-cyn-s"></rect>
          <text x="46" y="135" class="sv-lbl-hi" style="fill:var(--cyn)">HAL / 实现 trait</text>
          <text x="614" y="135" class="sv-lbl-dim" text-anchor="end">stm32f1xx-hal / esp-hal，把寄存器包成 trait</text>
          <rect x="30" y="158" width="600" height="34" rx="6" class="sv-amb-s"></rect>
          <text x="46" y="179" class="sv-lbl-hi" style="fill:var(--amb)">PAC / 寄存器</text>
          <text x="614" y="179" class="sv-lbl-dim" text-anchor="end">svd2rust 生成的寄存器访问 + MMIO</text>
        </svg>
```

 

越往上越"与芯片无关"。应用只看到 ` OutputPin ` 这样的 trait，因此在 STM32 与 ESP32 上都能编译—— 这与第①册"BSP/OSAL 分层"是同一个工程思想，只是 Rust 用 trait 把边界写进了类型。

 

✔ 同一驱动，两个平台

 

因为驱动只依赖 trait，把 ` stm32f1xx-hal ` 的 ` OutputPin ` 换成 ` esp-hal ` 的实现，  **驱动代码一行不改** 就能编到 ESP32 上——这正是 ` embedded-hal ` 的价值。  *平台细节：ESP32-C3（RISC-V）在官方 rustc 目标里支持良好；经典 ESP32（Xtensa）需要 esp-rs 的工具链分支。选平台时把这层依赖也算进去。*

 

```zhizhan-anchor
m04-2
```



## 4.2 trait：把"能做什么"写成接口

 

一个通用驱动只需要声明它"要什么能力"，而不关心底层是谁。下面是一个完全自定义的迷你 ` OutputPin `（真实项目里用 ` embedded-hal ` 的版本）：

 

hal\_traits.rs — 泛型驱动：为每种 P 生成一份代码 Rust

 

```text
// hal_traits.rs —— trait 抽象 + 泛型驱动
#![no_std]

pub trait OutputPin { fn set_high(&mut self); fn set_low(&mut self); }

pub struct Led<P: OutputPin> { pin: P }
impl<P: OutputPin> Led<P> {
    pub fn new(pin: P) -> Self { Self { pin } }
    pub fn on(&mut self) { self.pin.set_high(); }
}

pub struct GpioA { odr: u32 }
impl OutputPin for GpioA {
    fn set_high(&mut self) { self.odr |= 1; }
    fn set_low(&mut self) { self.odr &= !1; }
}
pub struct GpioB { odr: u32 }
impl OutputPin for GpioB {
    fn set_high(&mut self) { self.odr |= 2; }
    fn set_low(&mut self) { self.odr &= !2; }
}

// 两个具体类型 → 单态化出两份代码
#[no_mangle] pub extern "C" fn use_a() { let mut l = Led::new(GpioA { odr: 0 }); l.on(); }
#[no_mangle] pub extern "C" fn use_b() { let mut l = Led::new(GpioB { odr: 0 }); l.on(); }
```

 

泛型的好处是 **零开销** ：` set_high ` 被内联，没有间接跳转。代价是 **单态化** —— ` Led<GpioA> ` 与 ` Led<GpioB> ` 是两份独立代码（与第②册的模板膨胀同源）。

 

```zhizhan-anchor
m04-3
```



## 4.3 另一种选择：` dyn `（运行期分派）

 

如果实现要在 **运行期** 才能定（比如"插上哪块扩展板就用哪个驱动"），泛型就不行了——类型是编译期死的。 这时用 ` &mut dyn OutputPin `：一份代码，通过 **虚表（vtable）** 在运行期分派。

 

hal\_dyn.rs — dyn 驱动：一份代码，运行期分派 Rust

 

```text
// hal_dyn.rs —— 运行期分派：&mut dyn OutputPin
#![no_std]

pub trait OutputPin { fn set_high(&mut self); fn set_low(&mut self); }

pub struct LedDyn<'a> { pin: &'a mut dyn OutputPin }
impl<'a> LedDyn<'a> {
    pub fn new(pin: &'a mut dyn OutputPin) -> Self { Self { pin } }
    pub fn on(&mut self) { self.pin.set_high(); }
}

pub struct Gpio { odr: u32 }
impl OutputPin for Gpio {
    fn set_high(&mut self) { self.odr |= 1; }
    fn set_low(&mut self) { self.odr &= !1; }
}

// 一份代码，运行期通过 vtable 分派
#[no_mangle] pub extern "C" fn use_dyn(g: &mut Gpio) { let mut l = LedDyn::new(g); l.on(); }
```

 

**bash**  — 复跑：` bash tools/probes/m04.sh `（rustc 1.99 · thumbv7m-none-eabi）

 

```text
$ arm-none-eabi-size hal_traits.o hal_dyn.o
   text    data     bss     dec     hex filename
     14       0       0      14       e hal_traits.o
     46       0       0      46      2e hal_dyn.o
# 泛型版把 set_high 内联成了几条指令（14 B）；dyn 版要带 vtable 指针 + 一次间接调用（46 B）。
```

 

◆ 泛型 vs ` dyn `：一张选型表

 

| 维度 | 泛型 ` <P: Trait> ` | ` &mut dyn Trait ` |
| --- | --- | --- |
| 分派 | 编译期静态、可内联 | 运行期经 vtable 间接调用 |
| 代码体积 | 每种类型一份（单态化） | 一份 |
| 每对象开销 | 0 | 胖指针（数据 \+ vtable） |
| 运行期换实现 | 不行 | 可以（一批实现可统一存放） |
| 本机体积 | 14 B | 46 B |

 

```zhizhan-anchor
m04-4
```



## 4.4 与 C 的 ops 表对照

 

第①册的"` ops ` 函数指针表 \+ ` void* ctx `"，在 Rust 里对应 ` dyn Trait `； 第②册 C\+\+ 的"策略模板/CRTP"，对应 Rust 的 **泛型单态化** 。三者的取舍完全一致：

 

| 需求 | 选择 |
| --- | --- |
| 实现编译期已知、追求零开销 | 泛型 ` <P: Trait> `（或 C\+\+ 模板 / CRTP） |
| 运行期要在一批"同接口不同实现"间切换 | 虚表：` dyn Trait `（或 C 的 ops 表 / C\+\+ 虚函数） |
| 边界清晰：内部泛型、边界擦除 | 混合：内部泛型，对外暴露处用 ` dyn ` 一次擦除 |

 

```zhizhan-anchor
m04-5
```



## 4.5 静态分派 vs 动态分派：怎么选

 

**FIG 4.2**  泛型单态化 vs dyn 运行期分派

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="泛型为每种类型生成一份代码（可内联），dyn 用虚表在运行期分派">
          <rect x="30" y="40" width="200" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="130" y="63" class="sv-lbl-hi" text-anchor="middle">泛型 &lt;P: Hal&gt;</text>
          <text x="130" y="83" class="sv-lbl-dim" text-anchor="middle">编译期单态化·零开销</text>
          <rect x="290" y="40" width="200" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="390" y="63" class="sv-lbl-hi" text-anchor="middle">dyn Hal</text>
          <text x="390" y="83" class="sv-lbl-dim" text-anchor="middle">运行期虚表·可换实现</text>
        </svg>
```

 

能用泛型在编译期定下来的，就别付 ` dyn ` 的间接开销与对象安全限制。

 

| 维度 | 泛型 ` <P: Trait> ` | ` dyn Trait ` |
| --- | --- | --- |
| 绑定时机 | 编译期 | 运行期 |
| 开销 | 零（可内联） | 虚表 \+ 间接调用 |
| 代码体积 | 每种类型一份 | 一份 |
| 可换实现 | 编译期固定 | 运行期可换 |

 

| 限制 | 泛型 | dyn |
| --- | --- | --- |
| 关联常量/泛型方法 | ✓ | 受限（对象安全） |
| 放进同一容器 | 需枚举包装 | ✓ |
| ` impl Trait ` 返回 | ✓ | ✓ |

 

dyn\_hal.rs — 运行期可换后端 Rust

 

```text
trait Hal { fn write(&mut self, b: u8); }

struct Uart; impl Hal for Uart { fn write(&mut self, _b: u8) {} }
struct Spi;  impl Hal for Spi  { fn write(&mut self, _b: u8) {} }

fn run(h: &mut dyn Hal) { h.write(0x5A); }   /* 运行期分派 */
```

 

◆ 迁移练习

 

把 ` run(&mut dyn Hal) ` 改成泛型 ` run<H: Hal>(h: &mut H) `，对比编译后的体积与是否可内联。

 

◆ 本章要点

 

 
- ` embedded-hal ` 用 trait 把"芯片无关"的能力标准化，驱动与芯片解耦。
 
- 泛型 ` <P: Trait> `：编译期单态化、零开销、可内联，但每种类型一份代码。
 
- ` &mut dyn Trait `：一份代码、可运行期换实现，代价是 vtable 与间接调用（本机 14 → 46 字节）。
 
- 选型问题与 C ops 表 / C\+\+ 虚函数完全一致：看"要不要运行期换实现"。
 
- 常见折中：内部泛型，边界处用一次 ` dyn ` 擦除。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 简答：为什么通用驱动写 \`P: OutputPin\` 就能同时用在 STM32 和 ESP32 上？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为驱动只依赖 ` OutputPin ` trait 定义的能力，不依赖具体寄存器。各芯片的 HAL 各自实现这个 trait，驱动在编译期针对传入类型单态化即可。"}
   ```
 
2. 判断：把泛型驱动改成 \`dyn\` 会让所有实例少一份代码，但每次调用更贵。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。泛型为每种类型生成一份；` dyn ` 只生成一份、但运行期经 vtable 分派。本机实测 14 B（泛型）vs 46 B（dyn，单实例）——代码少不代表总体积一定小，要按实例数量权衡。"}
   ```
 
3. 诊断：应用需要"运行期从多个已注册的传感器里选一个读取"，该用泛型还是 \`dyn\`？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"用 ` dyn `（或把 ` &mut dyn Sensor ` 存进数组）。因为要运行期在多个实现间切换/遍历，泛型在编译期就把类型定死了。"}
   ```
 
4. 动手：给 \`hal\_traits.rs\` 再加一个 \`GpioC\` 实现，用 \`nm --size-sort\` 看多出了哪几个符号。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会多出 ` use_c ` 以及（若导出）针对 ` GpioC ` 的单态化函数——每种具体类型一份，这就是单态化膨胀。"}
   ```
 
5. 判断：\`embedded-hal\` 的 trait 一定带来运行期开销。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。用泛型时是静态单态化、可内联，零开销；只有在用 ` dyn ` 时才有 vtable 与间接调用的成本。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  给你项目里的一个驱动，改成"依赖 trait"，让它能同时对两种底层实现编译。

 

```zhizhan-assessment
{"id":"course-b03-m04","criterion":"同一驱动运行于 mock 和一个真实 HAL 后端；不将 mock 成功计作总线实测。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
