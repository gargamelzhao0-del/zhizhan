# 中断与并发

```zhizhan-anchor
m05
```



第①册用 ` volatile ` \+ 关中断保护 ISR↔主循环共享量；C\+\+ 分册讲 ` std::atomic ` 与内存序。 Rust 的路线略有不同： **用类型让"能安全共享的东西"与"不能的"分开** ，并在没有硬件原子的核（M0）上 **直接不给你那个方法** 。

 

> ◷ 约 70 分钟 · ◈ Atomic vs static mut · ⚑ M0 上会编译不过

 

```zhizhan-anchor
m05-1
```



## 5.1 三个层次：裸 ` static mut ` / ` Atomic ` / 临界区

 

| 共享量 | Rust 里的写法 | 代价 / 保护 |
| --- | --- | --- |
| 单字节/单字标志（ISR 写、主循环读） | ` static ATOMIC: AtomicBool/U32 ` | 单次 load/store，天然原子 |
| 计数器（两侧都读-改-写） | ` AtomicU32::fetch_add `（M3\+）；M0 上不存在该方法 | 无锁（M3\+）；M0 需临界区 |
| 多字节结构一致性 | ` critical-section ` / ` Mutex `（如 ` cortex-m ` 的临界区互斥） | 关中断，短临界区 |
| ` static mut ` 裸共享 | 能编过（要 ` unsafe `），但 **没有任何保护** | 数据竞争 / 撕裂，编译器不拦 |

 

关键差别：C 里共享一个变量不需要任何声明、也无人阻止你写错；Rust 里"能跨上下文共享"这件事，必须 **明确选一种机制** —— ` static mut ` 你要写 ` unsafe `（承认"这里由我负责"），而 ` Atomic ` 是安全的。

 

**FIG 5.1**  共享计数：M3 可无锁原子加；M0 必须进临界区

 

```zhizhan-figure
<svg viewBox="0 0 660 208" role="img" aria-label="中断与主循环共享计数器的两种实现时序">
          <text x="70" y="18" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">ISR</text>
          <text x="560" y="18" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">主循环</text>
          <line x1="70" y1="26" x2="70" y2="118" class="lifeline"></line>
          <line x1="560" y1="26" x2="560" y2="118" class="lifeline"></line>
          <rect x="20" y="34" width="100" height="18" rx="4" class="sv-amb-s"></rect>
          <text x="70" y="47" class="sv-lbl-dim" text-anchor="middle">fetch_add(1)</text>
          <path d="M74 76 L556 76" class="msg"></path>
          <text x="315" y="70" class="sv-lbl-dim" text-anchor="middle">M3：ldrex/strex 一次原子完成，主循环 load 即可</text>
          <rect x="500" y="92" width="120" height="18" rx="4" class="sv-cyn-s"></rect>
          <text x="560" y="105" class="sv-lbl-dim" text-anchor="middle">load(快照)</text>
          <line x1="16" y1="138" x2="644" y2="138" class="sv-dash"></line>
          <text x="16" y="162" class="sv-lbl-hi" style="fill:var(--red)">M0 · 没有 fetch_add：进临界区（关中断）</text>
          <rect x="20" y="170" width="600" height="26" rx="5" class="sv-red-s"></rect>
          <text x="320" y="187" class="sv-lbl-dim" text-anchor="middle">关中断 → 读-改-写 → 开中断（同时只能一方进入）</text>
        </svg>
```

 

M3 有独占访问指令，一次 ` fetch_add ` 就安全；M0 没有，Rust 干脆 **不提供** 这个方法，逼你用临界区（` critical-section `）。

 

```zhizhan-anchor
m05-2
```



## 5.2 ` Atomic `：M3 内联，M0 直接没有

 

把共享计数器写成 ` AtomicU32 `，用一次 ` fetch_add ` 完成"读-改-写"：

 

shared\_counter.rs — 用 AtomicU32 共享计数器 Rust

 

```text
// shared_counter.rs —— 原子计数：一次 fetch_add，无锁
#![no_std]
use core::sync::atomic::{AtomicU32, Ordering};

static COUNT: AtomicU32 = AtomicU32::new(0);

// 中断里：一次原子加
#[no_mangle] pub extern "C" fn isr_tick() { COUNT.fetch_add(1, Ordering::Relaxed); }
// 主循环：读快照
#[no_mangle] pub extern "C" fn snapshot() -> u32 { COUNT.load(Ordering::Relaxed) }
```

 

**bash**  — 复跑：` bash tools/probes/m05.sh `（同一份源码，换 target）

 

```text
# 1) Cortex-M3：fetch_add 内联成 ldrex/strex 重试循环，无未定义符号
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj shared_counter.rs -o sc_m3.o
$ arm-none-eabi-size sc_m3.o
   text    data     bss     dec     hex filename
     24       0       4      28      1c sc_m3.o
$ arm-none-eabi-objdump -d sc_m3.o   # isr_tick
  e850 1f00  ldrex   r1, [r0]     # 独占读
  3101       adds    r1, #1
  e840 1200  strex   r2, r1, [r0] # 独占写
  2a00       cmp     r2, #0
  d1f8       bne.n   ...           # 失败就重试

# 2) Cortex-M0：AtomicU32 连 fetch_add 方法都没有 —— 编译期直接拒绝
$ rustc --edition 2021 --crate-type lib --target thumbv6m-none-eabi -O --emit=obj shared_counter.rs -o sc_m0.o
error[E0599]: no method named `fetch_add` found for struct `Atomic<T>` in the current scope
 --> shared_counter.rs:7:27
  |
7 | pub fn isr_tick() { COUNT.fetch_add(1, Ordering::Relaxed); }
  |                           ^^^^^^^^^ method not found in `Atomic<u32>`
```

 

⚠ 这比 C/C\+\+ 更"硬"：M0 上方法直接不存在

 

在 C\+\+ 里，M0 上的 ` fetch_add ` 会编译成一个需要 ` libatomic ` 的外部调用（可能链不过是运行期/链接期的事，见第②册 M06）。 Rust 更彻底：` thumbv6m ` 上 ` AtomicU32 `  **只提供 load/store，根本没有 ` fetch_add `**  —— 你想在 M0 上"偷偷用它"都不行。 要么用 ` critical-section ` 关中断保护，要么换有独占访问的核。 *目标平台的能力，被编进了类型系统。*

 

```zhizhan-anchor
m05-3
```



## 5.3 反面：` static mut ` 裸共享（能编过，没人拦）

 

不选 ` Atomic `、直接用 ` static mut ` 也能"跑"，但它把安全的担子全交还给你——而且编译器不会再检查：

 

staticmut\_risk.rs — 警示：能编过，但无编译期保护 Rust

 

```text
// 反面：不带原子/临界保护的共享 static mut —— 数据竞争
#![no_std]
static mut COUNT: u32 = 0;

pub fn isr_tick() { unsafe { COUNT = COUNT.wrapping_add(1); } }  // 读-改-写，非原子
pub fn snapshot() -> u32 { unsafe { COUNT } }
```

 

◆ 为什么它"能编过"反而是坏事

 

` unsafe ` 的含义是"编译器无法替你检查，正确性由你保证"。它会编过、可能长期正常，然后在某个优化等级或时序下偶尔出错。 这与 C 的处境一样，但至少 Rust 逼你 **显式写下 ` unsafe `** ——让"这里有风险"在代码里可见、可审计， 而不是像 C 那样完全无声。所以纪律是： **能用 ` Atomic `/` critical-section ` 就别用 ` static mut `** 。   
 *底层上，Rust 把"内部可变性"这一能力收进唯一的受控类型 ` UnsafeCell `：` Cell `/` RefCell `/` Mutex ` 都建立在它之上——不是任意类型都能内部可变，这正是共享可变安全可控的原因。*

 

```zhizhan-anchor
m05-4
```



## 5.4 与 C/C\+\+ 的内存序对照

 

| 概念 | C/C\+\+（第②册） | Rust |
| --- | --- | --- |
| 原子类型 | ` _Atomic ` / ` std::atomic ` | ` core::sync::atomic::Atomic* ` |
| 内存序 | ` memory_order ` | ` Ordering::Relaxed/Acquire/Release/AcqRel/SeqCst ` |
| M0 上的读-改-写 | 走 libatomic（可能链不过） | 方法不存在，必须用临界区 |
| 共享可变状态 | 裸变量 \+ 约定 | ` static mut ` 需 ` unsafe `；否则用 ` Atomic `/` Mutex ` |

 

```zhizhan-anchor
m05-5
```



## 5.5 真实临界区：` cortex_m::interrupt::free `

 

M0 上没有 ` fetch_add `，标准解法就是"进临界区（关中断）"。真实工程里用 ` cortex-m ` 的 ` interrupt::free `：它接收一个闭包， **执行期间关中断、返回后恢复** —— 正是第①册 ` enter_critical()/exit_critical() ` 的类型化封装，且不会忘记恢复。

 

critical\_free.rs — 真实关中断临界区（Cargo 工程） Rust

 

```text
// critical_free.rs —— 用 cortex-m 的临界区封装共享访问
#![no_std]
#![no_main]
use panic_halt as _;
use core::sync::atomic::{AtomicU32, Ordering};
use cortex_m::interrupt;
use cortex_m_rt::entry;

static COUNT: AtomicU32 = AtomicU32::new(0);

#[entry]
fn main() -> ! {
    loop {
        // 关中断执行闭包，返回后自动恢复；M0 上的读-改-写也放这里
        let snapshot = interrupt::free(|_cs| COUNT.load(Ordering::Relaxed));
        let _ = snapshot;
        core::hint::spin_loop();
    }
}
```

 

◆ 三个层次的选型（对应 §5.1）

 

 
- **单次 load/store**  → 直接 ` AtomicU32 `（M0/M3 都行）。
 
- **读-改-写**  → M3 用 ` fetch_add `；M0 用 ` interrupt::free `（本节的写法）。
 
- **多字节一致性**  → 临界区内拷出快照，或双缓冲（与第②册 M06 的 release/acquire 对应）。

 

```zhizhan-anchor
m05-6
```



## 5.6 真实中断处理器与 ` Send/Sync `

 

真实固件用 ` cortex-m-rt ` 的 ` #[exception] `（系统异常：SysTick/HardFault…）或 PAC 的 ` #[interrupt] `（外设中断）注册处理函数。 它们与主循环共享数据时，Rust 用 ` Send `/` Sync ` 两个 trait 在 **编译期** 保证"能安全跨上下文共享"。

 

int\_exception.rs — 真实中断处理器（Cargo 工程） Rust

 

```text
// int_exception.rs —— 用 cortex-m-rt 注册 SysTick 异常处理器
#![no_std]
#![no_main]
use panic_halt as _;
use core::sync::atomic::{AtomicU32, Ordering};
use cortex_m::interrupt;
use cortex_m_rt::{entry, exception};

static COUNT: AtomicU32 = AtomicU32::new(0);

#[exception]
fn SysTick() {
    // 中断上下文：一次原子加（M3）。M0 上应改为临界区（见 §5.2）
    COUNT.fetch_add(1, Ordering::Relaxed);
}

#[entry]
fn main() -> ! {
    loop {
        let _snapshot = interrupt::free(|_cs| COUNT.load(Ordering::Relaxed));
        core::hint::spin_loop();
    }
}
```

 

**bash**  — 复跑：` bash tools/probes/m_cargo.sh `（真实 cortex-m-rt 固件）

 

```text
$ cargo build --release
    Finished `release` profile [optimized] target(s)
$ arm-none-eabi-nm --demangle target/thumbv7m-none-eabi/release/minirs | grep -iE 'SysTick|COUNT'
0800043c T SysTick
20000000 b minirs::COUNT
# SysTick 处理器编译成 ldrex/strex 原子自增（与 §5.2 手写版一致）
$ arm-none-eabi-objdump -d --demangle target/…/minirs
0800043c <SysTick>:
  e850 1f00  ldrex   r1, [r0]
  3101       adds    r1, #1
  e840 1200  strex   r2, r1, [r0]
  2a00       cmp     r2, #0
  d1f8       bne.n   ...
```

 

◆ ` Send ` / ` Sync ` 是什么

 

 
- ` Sync `：` &T ` 可以安全地跨执行单元共享（因此 ` static T ` 要求 ` T: Sync `）。
 
- ` Send `：` T ` 的[所有权](term:ownership)可以安全地转移给另一个执行单元。
 
- 规则落地：把 **非 ` Sync `**  类型放进"可被中断访问的 ` static `" →  **编译错误** 。这正是 Rust"无数据竞争"的来源——它把 C 里"共享变量靠约定"变成了类型约束。

 

sync\_ok.rs — AtomicU32 满足 Sync，可安全共享 Rust

 

```text
// sync_ok.rs —— 编译期确认"这个类型能安全共享"
#![no_std]
use core::sync::atomic::AtomicU32;

static COUNT: AtomicU32 = AtomicU32::new(0);   // ✔ AtomicU32: Sync

fn assert_sync<T: Sync>() {}
pub fn demo() { assert_sync::<AtomicU32>(); }
```

 

sync\_fail.rs — 反面：非 Sync 类型不能当共享 static Rust

 

```text
// 反面：Cell<u32> 不是 Sync，不能作为可跨上下文共享的 static
#![no_std]
use core::cell::Cell;

static CELL: Cell<u32> = Cell::new(0);   // ✕ `Cell<u32>` cannot be shared between threads safely
```

 

✔ 更进一步：async / embassy

 

当前嵌入式 Rust 的另一条主线是  **async/await \+ embassy** ：用异步任务 \+ 执行器替代手写状态机，` embassy ` 提供 ` Timer `/` Spi `/` Executor ` 等。 它仍建立在 ` Send/Sync ` 与所有权之上。本册以"同步 \+ 中断"打好地基；上手 embassy 时你会发现这里的每一条结论都还在用。

 

**FIG 5.2**  三层共享手段：Atomic / 临界区 / static mut

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="优先 Atomic，其次临界区，裸 static mut 无编译期保护">
          <rect x="30" y="40" width="200" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="130" y="63" class="sv-lbl-hi" text-anchor="middle">AtomicU32（首选）</text>
          <text x="130" y="83" class="sv-lbl-dim" text-anchor="middle">原子、无锁、Sync</text>
          <rect x="260" y="40" width="180" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="350" y="63" class="sv-lbl-hi" text-anchor="middle">interrupt::free</text>
          <text x="350" y="83" class="sv-lbl-dim" text-anchor="middle">关中断临界区</text>
          <rect x="470" y="40" width="180" height="56" rx="6" class="sv-red-s"></rect>
          <text x="560" y="63" class="sv-lbl-hi" text-anchor="middle">static mut（危险）</text>
          <text x="560" y="83" class="sv-lbl-dim" text-anchor="middle">无保护、易数据竞争</text>
        </svg>
```

 

能编过不等于安全：` static mut ` 没有任何编译期保护，要主动规避。

 

| 手段 | 是否 Sync | 适用 | 代价 |
| --- | --- | --- | --- |
| ` AtomicU32 ` | 是 | 单字段计数/标志 | 低 |
| ` Mutex `（cortex-m） | 是 | 多字段不变量 | 关中断 |
| ` interrupt::free ` | — | 短临界区 | 关中断 |
| ` static mut ` | 否（需 unsafe） | 尽量避免 | 易出错 |

 

| 内存序 | 含义 | 常用处 |
| --- | --- | --- |
| ` Relaxed ` | 只保证原子性 | 计数器 |
| ` Acquire ` | 读后不重排 | 取锁/取数据 |
| ` Release ` | 写前不重排 | 放锁/发布数据 |
| ` SeqCst ` | 全局顺序一致 | 简单但最强 |

 

◆ 迁移练习

 

把一个"ISR 与主循环共享的计数器"从 ` static mut ` 改成 ` AtomicU32 `，说明为什么这样就不再需要 ` unsafe `。

 

◆ 本章要点

 

 
- 跨上下文共享必须显式选机制：` Atomic `（安全）或 ` static mut ` \+ ` unsafe `（自担风险）。
 
- ` AtomicU32::fetch_add ` 在 M3 上内联为 ` ldrex/strex `；在 M0 上 **该方法不存在** 。
 
- M0 上的读-改-写要用 ` critical-section ` 关中断，或换核。
 
- 内存序与 C/C\+\+ 的 ` memory_order ` 一一对应（Relaxed/Acquire/Release/AcqRel/SeqCst）。
 
- 能用 ` Atomic ` 就别用 ` static mut `；Rust 至少把风险写成了 ` unsafe `。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 判断：在 Cortex-M0 上，` AtomicU32::fetch_add ` 会像 C\+\+ 那样变成 libatomic 调用。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。M0（` thumbv6m `）上 ` AtomicU32 `  **没有 ` fetch_add ` 方法** ，编译直接失败（E0599）。要用就得上 ` critical-section ` 或换核。"}
   ```
 
2. 简答：` static mut ` 能编过，为什么还说它"危险"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"它要 ` unsafe `，意味着编译器不再检查别名/竞争；读-改-写是非原子的，可能撕裂或丢更新。它\"能编过\"只因你把正确性责任显式接了过去。"}
   ```
 
3. 诊断：M3 上的 ` isr_tick() ` 编译成什么？有没有未定义符号？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` ldrex/adds/strex/cmp/bne ` 重试循环，无未定义符号（硬件独占访问内联完成）。"}
   ```
 
4. 动手：把 ` Ordering::Relaxed ` 改成 ` SeqCst `，在 M3 上反汇编看是否多出 ` dmb `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"通常会多出一条 ` dmb ish `（更强顺序）。这正是\"内存序有代价\"的可视化——与第②册 M06 的 C\\+\\+ 结论一致。"}
   ```
 
5. 判断：Rust 能宣称"无数据竞争"是因为它禁止了中断。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。是因为所有权/借用/Trait（` Send `/` Sync `）在 **编译期** 保证了\"要么共享只读、要么独占写\"，且跨上下文共享必须用 ` Atomic `/锁。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  检查你项目里"ISR 与主循环共享"的变量：能改成 ` Atomic ` 的改掉，不能的（M0 上的读-改-写）改用临界区。

 

```zhizhan-assessment
{"id":"course-b03-m05","criterion":"中断与线程共享对象有临界区/原子协议，记录适用单核或多核条件。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
