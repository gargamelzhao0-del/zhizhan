# DMA 与所有权

```zhizhan-anchor
m06
```



[DMA](term:dma) 是嵌入式里最容易出"幽灵 bug"的地方：传输进行中，CPU 又去改了同一块缓冲，或者把缓冲移走/释放了。 C 里这靠约定与注释；Rust 的 **借用检查器** 能在编译期把"传输期间缓冲被改动/移动"直接拦下——这一节讲它到底保证了什么。

 

> ◷ 约 65 分钟 · ◈ 借用检查器 vs DMA · ⚑ 静态保证缓冲不被移动

 

```zhizhan-anchor
m06-1
```



## 6.1 DMA 的经典 C bug

 

设一次 UART/SPI 的 DMA 发送：你启动 DMA，把缓冲地址交给外设；在传输完成前，某处代码 **又写了同一块缓冲** ， 于是线上发出的数据一半是旧的、一半是新的；更糟的是缓冲在栈上，函数返回后地址失效，DMA 还在读它。

 

| C 里的坑 | 后果 | Rust 靠什么拦 |
| --- | --- | --- |
| 传输中改动被 DMA 读的缓冲 | 发出去的数据被撕裂 | 借用：传输期间持有 ` &buf `，禁止再改 |
| 把栈上缓冲交给 DMA 后函数返回 | 悬垂 DMA | 生命周期：缓冲必须活得比传输久 |
| 缓冲被 ` free ` 后 DMA 还在读 | 读到已复用内存 | [所有权](term:ownership)：` move ` 后原绑定失效 |

 

**FIG 6.1**  DMA 缓冲的所有权生命周期：谁在用，类型说了算

 

```zhizhan-figure
<svg viewBox="0 0 660 188" role="img" aria-label="DMA 缓冲从 CPU 可变借用、借给 DMA、再归还的时间线">
          <line x1="40" y1="120" x2="640" y2="120" stroke="var(--line-2)"></line>
          <rect x="40" y="80" width="180" height="36" rx="5" class="sv-grn-s"></rect>
          <text x="130" y="103" class="sv-lbl-hi" text-anchor="middle">CPU: &amp;mut buf</text>
          <rect x="220" y="80" width="240" height="36" rx="5" class="sv-amb-s"></rect>
          <text x="340" y="103" class="sv-lbl-hi" text-anchor="middle">DMA: &amp;buf（只读借用）</text>
          <rect x="460" y="80" width="180" height="36" rx="5" class="sv-grn-s"></rect>
          <text x="550" y="103" class="sv-lbl-hi" text-anchor="middle">CPU 收回 &amp;mut</text>
          <text x="340" y="140" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--red)">此区间改 buf / 移动 buf → 编译错误（E0506）</text>
          <text x="40" y="168" class="sv-lbl-dim">"借出"由类型表达：DmaTx 活着 = 缓冲被共享借用。</text>
        </svg>
```

 

缓冲的使用权像"接力棒"：CPU 持可变借用 → 启动 DMA（借出只读）→ 传输结束（` DmaTx ` 析构）→ CPU 收回可变借用。 **借出期间任何改动都会被编译器拦下。**

 

```zhizhan-anchor
m06-2
```



## 6.2 借用检查器如何保证"传输期间缓冲不动"

 

把"一次 DMA 传输"做成一个持有缓冲借用的对象：只要这个对象还活着，它对缓冲的 **共享借用** 就一直有效， 于是任何 **可变借用/修改** 都会被拒绝。

 

dma\_ok.rs — 传输期间借用缓冲（合法） Rust

 

```text
// dma_ok.rs —— 传输期间持有 buf 的共享借用
#![no_std]

pub struct DmaTx<'a> { buf: &'a [u8], active: bool }
impl<'a> DmaTx<'a> {
    pub fn start(buf: &'a [u8]) -> Self { Self { buf, active: true } }
    pub fn busy(&self) -> bool { self.active }
    pub fn len(&self) -> usize { self.buf.len() }
}

pub fn demo(buf: &mut [u8]) {
    buf[0] = 1;
    let tx = DmaTx::start(buf);   // 共享借用 buf；此后不能再可变借用
    while tx.busy() { /* 等 DMA 完成 */ }
    let _ = tx.len();
}
```

 

注意 ` demo ` 接收 ` &mut [u8] `（可变借用）：在 ` buf[0] = 1 ` 之后、启动 DMA 之前的修改是允许的； 一旦 ` DmaTx::start(buf) ` 借出共享引用，` buf ` 在 ` tx ` 存活期间就 **不能再被写** 。

 

dma\_fail.rs — 反面：传输中改动缓冲 Rust

 

```text
// 反面：启动 DMA 后还想改缓冲 —— 借用检查器拒绝
#![no_std]

pub struct DmaTx<'a> { buf: &'a [u8] }
impl<'a> DmaTx<'a> { pub fn start(buf: &'a [u8]) -> Self { Self { buf } } }

pub fn bad(buf: &mut [u8]) {
    let tx = DmaTx::start(buf);   // 共享借用
    buf[0] = 2;                   // 错误：已有共享借用时不能再可变借用
    let _ = tx.buf.len();
}
```

 

**bash**  — 复跑：` bash tools/probes/m06.sh `（rustc 1.99 · thumbv7m-none-eabi）

 

```text
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj dma_fail.rs -o dma_fail.o
error[E0506]: cannot assign to `buf[_]` because it is borrowed
 --> dma_fail.rs:6:5
  |
5 |     let tx = DmaTx::start(buf);   // 共享借用
  |                           --- `buf[_]` is borrowed here
6 |     buf[0] = 2;                   // 错误：已有共享借用时不能再可变借用
  |     ^^^^^^^^^^ `buf[_]` is assigned to here but it was already borrowed
7 |     let _ = tx.buf.len();
  |             ------ borrow later used here
```

 

◆ 编译器给出的信息比"出错了"多得多

 

报错同时指出了 **借用发生在哪** （第 5 行）、 **冲突的写在哪** （第 6 行）、以及 **借用为何仍有效** （第 7 行还在用 ` tx `）。 这正对应 C 里最难查的"DMA 与被 CPU 同时访问"——Rust 把它变成了"编译期指给你看"。

 

```zhizhan-anchor
m06-3
```



## 6.3 ` &'static mut `：给 DMA 一块"活得够久"的缓冲

 

栈缓冲天然活不过函数；要让 DMA 安全使用，缓冲通常放在 **静态存储** 里。Rust 里取得一块唯一的静态缓冲需要一次 ` unsafe `（ 因为 ` static mut ` 的别名要你自己保证），但之后就能把它当普通 ` &mut [u8] ` 安全使用：

 

dma\_static.rs — 从静态存储取得一个唯一的可变缓冲 Rust

 

```text
// dma_static.rs —— 把静态缓冲"借出一次"，之后按普通引用用
#![no_std]

static mut DMA_BUF: [u8; 64] = [0; 64];

/// # Safety
/// 只能调用一次；调用方必须保证此后不再通过其他路径访问 DMA_BUF。
pub unsafe fn take_dma_buf() -> &'static mut [u8] {
    &mut *core::ptr::addr_of_mut!(DMA_BUF)
}

pub fn use_buf() {
    // 在初始化阶段调用一次（真实项目里用 OnceCell/单例封装）
    let buf = unsafe { take_dma_buf() };
    buf[0] = 0xAA;
}
```

 

⚠ ` unsafe ` 只在这里出现一次

 

` take_dma_buf ` 里的 ` unsafe ` 是 **唯一** 的不安全点：它承诺"这块缓冲的唯一可变引用只发出去一次"。 一旦拿到 ` &'static mut [u8] `，之后所有使用都是 **安全的** ——借用检查器接管，DMA 期间你改它就编译不过。 实战里用 ` critical-section ` 或 ` OnceCell ` 把这个"只发一次"封装起来（见 Module 07 的封装规范）。

 

```zhizhan-anchor
m06-4
```



## 6.4 一个提醒：` DmaTx ` 的真实语义

 

上面的 ` DmaTx ` 是教学简化：真实 DMA 完成后要由中断置"完成"标志，并 **在完成后归还缓冲** 。 但无论细节如何，核心不变—— **用类型表达"缓冲的使用权现在在谁手上"** ： DMA 在用时，CPU 只有只读借用；传输结束、对象析构后，CPU 才拿回可变借用。这套"所有权随状态流转"的写法， 与第①册"明确谁是 buffer 的 owner"、第②册 M10 的"边界处类型擦除"是同一个工程直觉。

 

```zhizhan-anchor
m06-5
```



## 6.5 把"传输期间缓冲不动"变成类型约束

 

**FIG 6.2**  借用保证 DMA 传输期间缓冲不被改动

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="DMA 独占借用缓冲，其他代码在传输期间无法可变访问它">
          <rect x="30" y="40" width="200" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="130" y="63" class="sv-lbl-hi" text-anchor="middle">DmaTx::new(&amp;mut buf)</text>
          <text x="130" y="83" class="sv-lbl-dim" text-anchor="middle">独占借用开始</text>
          <rect x="290" y="40" width="200" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="390" y="63" class="sv-lbl-hi" text-anchor="middle">传输进行中</text>
          <text x="390" y="83" class="sv-lbl-dim" text-anchor="middle">别人借不到 &amp;mut</text>
          <rect x="510" y="40" width="140" height="56" rx="6" class="sv-cyn-s"></rect>
          <text x="580" y="63" class="sv-lbl-hi" text-anchor="middle">完成</text>
          <text x="580" y="83" class="sv-lbl-dim" text-anchor="middle">归还借用</text>
        </svg>
```

 

C 里"传输中改了缓冲"靠人盯；Rust 里它是编译错误。

 

| DMA 场景 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 传输期间缓冲不可改 | 注释/约定 | 独占借用 ` &mut ` |
| 缓冲需活得够久 | static 全局 | ` &'static mut ` |
| 取唯一可变引用 | 靠人保证 | 编译期保证唯一 |

 

| 写法 | 能否编译 | 说明 |
| --- | --- | --- |
| 传输中 ` &buf ` 再读 | 能 | 共享借用允许 |
| 传输中 ` &mut buf ` | 不能 | 独占借用冲突 |
| 传输结束前 drop DmaTx | 不能 | 借用未还 |
| ` unsafe ` 绕过 | 能 | 责任自负 |

 

| 获得 ` &'static mut ` 的正规途径 | 说明 |
| --- | --- |
| ` cortex_m::singleton! ` | 一次性取得唯一引用 |
| 已初始化的静态缓冲 | 启动期建好 |
| 临界区内取得 | 短时间独占 |
| 避免 ` unsafe { &mut STATIC } ` | 易产生别名 |

 

◆ 迁移练习

 

给一个 DMA 发送结构体加"传输期间独占借用缓冲"的签名，写出"传输中改动缓冲"的反面并确认编译不过。

 

◆ 本章要点

 

 
- DMA 的经典 bug（传输中改动缓冲 / 悬垂 / 释放后读取）在 C 里靠约定，在 Rust 里靠 **借用与生命周期** 。
 
- 把一次传输建模成"持有缓冲借用的对象"：对象存活期间，缓冲不可被改、不可被移动。
 
- 冲突时编译器给出 **借用点、写点、为何仍有效** 三段信息，直击最难查的 DMA 竞态。
 
- DMA 缓冲放静态存储；从 ` static mut ` 取唯一引用只写一次 ` unsafe `，之后交给借用检查器。
 
- 核心思想：用类型表达"缓冲的使用权现在归谁"。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 简答：Rust 如何在不运行时检测的情况下，保证"DMA 传输期间缓冲不被改"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"传输对象持有缓冲的 **共享借用** ；只要该对象活着，缓冲就被借用，任何可变借用/修改都会在编译期被拒绝（` E0506 `）。"}
   ```
 
2. 判断：把栈上的 ` [u8; N] ` 交给 DMA 也不会有问题，因为 Rust 很安全。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对。栈缓冲在函数返回后失效，DMA 若仍在读就是悬垂——生命周期检查会阻止你把一个\"活不够久\"的借用传进要求更长生命周期的位置。DMA 缓冲应放静态存储。"}
   ```
 
3. 诊断：` let tx = DmaTx::start(buf); buf[0] = 2; ` 报什么错？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` E0506: cannot assign to buf[_] because it is borrowed `：` buf ` 已被 ` DmaTx ` 共享借用，不能再写；且报错会指出 ` tx ` 在之后仍被使用，所以借用一直有效。"}
   ```
 
4. 动手：把 ` dma_ok.rs ` 改成"传输开始后再 ` buf[0]=1 `"。预测报错并验证。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会得到与 ` dma_fail ` 同样的借用错误。把那次修改 **移到 ` DmaTx::start ` 之前** 即可通过——这正好演示\"哪些修改是安全的\"。"}
   ```
 
5. 判断：` take_dma_buf ` 是 ` unsafe `，所以用它就不安全。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对。` unsafe ` 表示\"调用方要遵守一个契约\"（这里：只取一次）。遵守契约后，拿到的 ` &'static mut ` 是安全的，后续使用受借用检查器保护。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  给你项目里一处 DMA 缓冲，画出"谁在哪段时间拥有/借用了它"，看能否用类型把它写出来。

 

```zhizhan-assessment
{"id":"course-b03-m06","criterion":"DMA 完成或确实停止后才归还缓冲；取消路径同样遵守此规则。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
