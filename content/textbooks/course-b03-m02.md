# 用类型系统编码硬件约束

```zhizhan-anchor
m02
```



C 里"这个参数是寄存器地址、不是随便一个整数"只能写在注释里；Rust 用  **newtype**  把它写进类型。 更进一步：用 **类型状态机** 让"没初始化就用"变成编译错误 —— 这一节把"硬件使用顺序"变成类型系统能检查的东西。

 

> ◷ 约 65 分钟 · ◈ newtype · 类型状态机 · ⚑ 0 运行时开销

 

```zhizhan-anchor
m02-1
```



## 2.1 newtype：把"同一底层类型的不同含义"分开

 

嵌入式里到处都是 ` u32 `：寄存器地址、引脚号、超时毫秒数、位掩码……它们底层一样， 所以 C 里可以随便互传。Rust 用一个只包一层的  **newtype** （` struct RegAddr(u32) `）把它们分成不同类型，且 **零运行时开销** 。

 

newtype.rs — 寄存器地址与普通整数分开 Rust

 

```text
// newtype.rs —— 同一底层类型，不同"类型身份"
#![no_std]

#[derive(Clone, Copy)]
pub struct RegAddr(pub u32);
#[derive(Clone, Copy)]
pub struct PinId(pub u8);

pub fn write_reg(a: RegAddr, v: u32) {
    unsafe { core::ptr::write_volatile(a.0 as *mut u32, v) }
}

pub fn demo() {
    let a = RegAddr(0x4001_0000);
    write_reg(a, 1);
    // write_reg(0x4001_0000, 1);   // ✕ u32 不能隐式变成 RegAddr
}
```

 

` RegAddr ` 与 ` u32 ` 在机器码里完全一样（就是个 ` u32 `）， 但编译器不再允许你把一个"地址"误传给收"毫秒"的函数。这正是第①册"类型即护栏"在 Rust 里的自然延伸。

 

```zhizhan-anchor
m02-2
```



## 2.2 类型状态机：让"没初始化就用"编译不过

 

硬件最危险的错误之一是"外设没配置就去读写"。C 靠"记得先调 ` init() `"；Rust 可以把 **状态编码进类型** ： 用两个零大小标记类型 ` Uninit `/` Ready `，把 ` write() ` 只实现在 ` Ready ` 上。

 

typestate.rs — init() 之后类型才变成 Ready Rust

 

```text
// typestate.rs —— 类型状态机：只有 Ready 才能 write
#![no_std]
use core::marker::PhantomData;

pub struct Uninit;
pub struct Ready;

pub struct Uart<State> {
    base: u32,
    _s: PhantomData<State>,
}
impl Uart<Uninit> {
    pub fn new(base: u32) -> Self { Self { base, _s: PhantomData } }
    pub fn init(self) -> Uart<Ready> {
        // 实际这里配置寄存器；返回一个新的类型
        Uart { base: self.base, _s: PhantomData }
    }
}
impl Uart<Ready> {
    pub fn write(&mut self, b: u8) {
        unsafe { core::ptr::write_volatile((self.base + 4) as *mut u32, b as u32) }
    }
}

pub fn demo() {
    let mut u = Uart::new(0x4001_3800).init();  // 先 init，类型变为 Uart<Ready>
    u.write(0x41);                              // 再 write
}
```

 

` PhantomData<State> ` 是 **零大小** 的（运行期不占字节），它只是让编译器把状态记在类型里。 关键在于：` write ` 根本不存在于 ` Uart<Uninit> ` 上 —— 提前调用不是"运行时出错"，而是 **没有这个方法** 。

 

**FIG 2.1**  类型状态机：状态在类型里，不在变量里

 

```zhizhan-figure
<svg viewBox="0 0 660 170" role="img" aria-label="Uart 从 Uninit 到 Ready 的类型状态迁移">
          <rect x="40" y="58" width="150" height="48" rx="8" class="sv-amb-s"></rect>
          <text x="115" y="79" class="sv-lbl-hi" text-anchor="middle">Uart&lt;Uninit&gt;</text>
          <text x="115" y="96" class="sv-lbl-dim" text-anchor="middle">只有 new()</text>
          <path d="M190 82 L296 82" class="sv-arrow-a"></path>
          <text x="243" y="74" class="sv-lbl-dim" text-anchor="middle">init(self)</text>
          <rect x="296" y="58" width="150" height="48" rx="8" class="sv-grn-s"></rect>
          <text x="371" y="79" class="sv-lbl-hi" text-anchor="middle">Uart&lt;Ready&gt;</text>
          <text x="371" y="96" class="sv-lbl-dim" text-anchor="middle">write() 等方法</text>
          <text x="462" y="72" class="sv-lbl-dim" style="fill:var(--grn)">✓ 只有到这里，write 才存在</text>
          <text x="462" y="92" class="sv-lbl-dim" style="fill:var(--red)">✕ Uninit 上调 write → E0599</text>
          <text x="40" y="142" class="sv-lbl-dim">运行时：两个类型布局相同（PhantomData 零大小）—— 状态只存在于编译期。</text>
        </svg>
```

 

状态迁移不是"运行时改一个 enum 字段"，而是 **类型在变** ：` init() ` 消费 ` Uart<Uninit> `、返回 ` Uart<Ready> `。所以"没 init 就 write"根本没有对应方法可调。

 

typestate\_fail.rs — 反面：没 init 就 write Rust

 

```text
// 反面：未初始化的 Uart 没有 write()
#![no_std]
use core::marker::PhantomData;

pub struct Uninit; pub struct Ready;
pub struct Uart<State> { base: u32, _s: PhantomData<State> }

impl Uart<Uninit> { pub fn new(base: u32) -> Self { Self { base, _s: PhantomData } } }
impl Uart<Ready>  { pub fn write(&mut self, _b: u8) {} }

pub fn bad() {
    let mut u = Uart::<Uninit>::new(0x4001_3800);
    u.write(0x41);   // 错误：Uninit 的 Uart 没有 write()
}
```

 

**bash**  — 复跑：` bash tools/probes/m02.sh `（rustc 1.99 · thumbv7m-none-eabi）

 

```text
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj typestate_fail.rs -o typestate_fail.o
error[E0599]: no method named `write` found for struct `Uart<Uninit>` in the current scope
 --> typestate_fail.rs:9:7
  |
4 | pub struct Uart<State> { base: u32, _s: PhantomData<State> }
  | ---------------------- method `write` not found for this struct
...
9 |     u.write(0x41);   // 错误：Uninit 的 Uart 没有 write()
  |       ^^^^^ method not found in `Uart<Uninit>`
  |
  = note: the method was found for `Uart<Ready>`
```

 

◆ 编译器甚至告诉你"它在哪个类型上有"

 

最后那句 `` note: the method was found for `Uart<Ready>` `` 是类型状态机最大的好处： 它不只拒绝你，还 **指出正确的前置状态** 。这正是 C 里"忘记 init 导致寄存器行为诡异"最想要的答案。

 

```zhizhan-anchor
m02-3
```



## 2.3 单位也同理：毫秒不是微秒

 

同一套思路可以防"把毫秒当微秒传"。定义两个 newtype，各自实现需要的运算；不同单位之间 **没有隐式转换** ，要换必须显式写出来。 这与第②册 C\+\+ 分册里的强类型单位是同一个思想，只是 Rust 的 newtype 更轻。

 

| 约束 | Rust 用什么表达 |
| --- | --- |
| "这是寄存器地址，不是任意整数" | ` struct RegAddr(u32) `（newtype） |
| "必须先 init 才能 write" | 类型状态机：` Uart<Uninit> -> Uart<Ready> ` |
| "毫秒不是微秒" | 两个 newtype \+ 只允许同单位的运算 |
| "这个句柄独占，不可复制" | 不实现 ` Copy `；移动即转移（M01） |

 

⚠ 护栏也要"值得"

 

给只在一个函数里用一两次的短命值造一堆 newtype，只会添乱。经验法则： **跨模块接口、容易混的单位/地址、状态与错误码** ——这些地方加类型，收益最大。

 

```zhizhan-anchor
m02-4
```



## 2.4 让"非法状态"根本表示不出来

 

**FIG 2.2**  类型状态机：init() 之后类型才变成 Ready

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="用类型区分" 未初始化="" 已就绪"，没="" init="" 就="" write="" 编译不过"="">
          <rect x="30" y="40" width="160" height="46" rx="6" class="sv-red-s"></rect>
          <text x="110" y="68" class="sv-lbl-hi" text-anchor="middle">Pin&lt;Uninit&gt;</text>
          <path d="M190 63 L240 63" class="sv-arrow"></path>
          <text x="215" y="55" class="sv-lbl-dim" text-anchor="middle">init()</text>
          <rect x="242" y="40" width="160" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="322" y="68" class="sv-lbl-hi" text-anchor="middle">Pin&lt;Ready&gt;</text>
          <text x="520" y="55" class="sv-lbl-dim" text-anchor="middle">只有 Ready 上</text>
          <text x="520" y="75" class="sv-lbl-hi" text-anchor="middle">才有 write()</text>
        </svg>
```

 

把"运行期断言"前移成"编译期类型"，就少了整整一类顺序错误。

 

| 手段 | C 里怎么做 | Rust 里怎么做 |
| --- | --- | --- |
| 区分同底层含义 | typedef \+ 约定 | newtype 结构体 |
| 强制初始化顺序 | 运行期标志 \+ 断言 | 类型状态机 |
| 单位/量纲 | 注释 \+ 命名约定 | 强类型包装 |

 

| 类型状态 | 能做的方法 | 误用后果 |
| --- | --- | --- |
| ` Uninit ` | ` init(self) -> Ready ` | 还没 init 就 write → 编译不过 |
| ` Ready ` | ` write() ` | — |
| ` newtype(Addr) ` | 只接受地址 | 传普通整数 → 类型不匹配 |
| ` newtype(Ms) ` | 只接受毫秒 | 传 us → 类型不匹配 |

 

| 场景 | 用 newtype/typestate | 不用 |
| --- | --- | --- |
| 单位易混 | ✓ |  |
| 初始化顺序关键 | ✓ |  |
| 状态少且线性 | ✓ |  |
| 状态多且互相跳转 |  | 用数据枚举更合适 |

 

◆ 迁移练习

 

给一个"必须先 init 再 write"的外设类型加类型状态机，写出反面（没 init 就 write）确认它编译不过。

 

```zhizhan-anchor
m02-5
```



## 2.5 什么时候别用类型体操

 

newtype 和类型状态机很优雅，但不是越多越好：状态一多、跳转复杂时，硬套类型状态机会让代码难读，此时用数据枚举（` enum `）表达状态更合适。 **用类型消灭"真实发生过"的错误** ，而不是为每个 bit 都建一个类型。

 

◆ 本章要点

 

 
- **newtype**  ` struct X(u32) `：把同一底层类型的不同含义分开，零运行时开销。
 
- **类型状态机** ：用 ` Uninit/Ready ` 标记类型，让"没 init 就用"变成"没有这个方法"。
 
- ` PhantomData<State> ` 是零大小的，状态只存在于类型层面。
 
- 编译器会指出方法"在哪个类型上存在"，比 C 的"行为诡异"好得多。
 
- 护栏要加在值得的地方：跨模块接口、易混单位/地址、状态码。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 简答：` struct RegAddr(u32) ` 相比直接用 ` u32 `，运行期有什么代价？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"没有。newtype 在机器码里就是一个 ` u32 `，编译期通过类型系统增加约束，运行期零开销。"}
   ```
 
2. 判断：类型状态机里的 ` PhantomData<State> ` 会在运行期占一个字节来记录状态。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。` PhantomData ` 是零大小类型，状态信息完全在编译期；` Uart<Uninit> ` 与 ` Uart<Ready> ` 运行期布局相同。"}
   ```
 
3. 诊断：` let mut u = Uart::<Uninit>::new(...); u.write(0x41); ` 报什么错？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"`` E0599: no method named `write` found for struct `Uart<Uninit>` ``，并提示 `` method was found for `Uart<Ready>` ``。因为 ` write ` 只实现在 ` Ready ` 状态上。"}
   ```
 
4. 动手：用 newtype 定义 ` Millis(u32) ` 与 ` Micros(u32) `，写一个只收 ` Millis ` 的延时函数，确认传 ` Micros ` 会编译失败。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会得到类型不匹配错误（` expected Millis, found Micros `）。要换算必须显式写一个把 ` Micros ` 转 ` Millis ` 的函数 —— 这正是\"护栏\"的意义。"}
   ```
 
5. 判断：newtype 会阻止你把它当整数做运算（比如 ` addr + 4 `）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会——除非你为它实现运算（或取出 ` .0 `）。这既是约束也是\"多写一点、少错一点\"的权衡；寄存器地址常直接 ` addr.0 + 4 ` 取值再加。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  挑一个"必须先 init 后使用"的外设，用类型状态机把它编码一遍，看编译器如何拦住误用。

 

```zhizhan-assessment
{"id":"course-b03-m02","criterion":"使用类型状态限制未初始化外设操作，同时说明仍需运行期检测的硬件错误。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
