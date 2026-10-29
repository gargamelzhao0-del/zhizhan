# no_std 与 panic

```zhizhan-anchor
m03
```



MCU 上没有操作系统、没有文件、没有 ` Vec `。Rust 用 ` no_std ` 把语言核心（` core `）留下、把依赖操作系统的部分（` std `）去掉。 代价是： **panic 时怎么办，要你自己给一个答案** 。这一节把 no\_std 的组成与 panic 的真实体积讲清楚。

 

> ◷ 约 60 分钟 · ◈ core vs std · panic\_handler · ⚑ 体积敏感

 

```zhizhan-anchor
m03-1
```



## 3.1 ` core ` 与 ` std `：留下什么、去掉什么

 

| crate | 包含什么 | MCU 上 |
| --- | --- | --- |
| ` core ` | 语言内建能力：基本类型、` Option `/` Result `、切片、` atomic `、迭代器、` fmt `（可选） | 用（` #![no_std] ` 后自动可用） |
| ` alloc ` | ` Vec `/` Box `/` String `：需要"堆分配器" | 需要时才引入（自己提供分配器或内存池） |
| ` std ` | 文件、网络、线程、` std::io `、panic=unwind… 依赖操作系统 | 不用（除少数如 ESP32 带 OS 的场景） |

 

关键点：` no_std ` 不是"另一个 Rust"，它就是"把 ` std ` 换成 ` core `"。大多数语言特性（[所有权](term:ownership)、trait、泛型、闭包、迭代器）都在 ` core ` 里，照常用。

 

**FIG 3.1**  no\_std 运行时组成：core 给"语言"，你补三样"边界"

 

```zhizhan-figure
<svg viewBox="0 0 660 206" role="img" aria-label="no_std 运行时组成：core 加上你提供的 panic_handler、入口与可选分配器">
          <rect x="30" y="24" width="600" height="40" rx="6" class="sv-grn-s"></rect>
          <text x="46" y="49" class="sv-lbl-hi">core（语言内核，随 rustc 提供）</text>
          <text x="614" y="49" class="sv-lbl-dim" text-anchor="end">所有权 / trait / 泛型 / 迭代器 / atomic</text>
          <rect x="30" y="72" width="190" height="52" rx="6" class="sv-amb-s"></rect>
          <text x="125" y="93" class="sv-lbl-hi" text-anchor="middle">#[panic_handler]</text>
          <text x="125" y="111" class="sv-lbl-dim" text-anchor="middle">panic 后做什么（你必须给）</text>
          <rect x="235" y="72" width="190" height="52" rx="6" class="sv-amb-s"></rect>
          <text x="330" y="93" class="sv-lbl-hi" text-anchor="middle">入口 / 启动</text>
          <text x="330" y="111" class="sv-lbl-dim" text-anchor="middle">复位向量 → 你的函数</text>
          <rect x="440" y="72" width="190" height="52" rx="6" class="sv-box"></rect>
          <text x="535" y="93" class="sv-lbl-hi" text-anchor="middle">可选：alloc 分配器</text>
          <text x="535" y="111" class="sv-lbl-dim" text-anchor="middle">要用 Vec/Box 才需要</text>
          <text x="30" y="152" class="sv-lbl-dim">去掉的：std 的文件 / 网络 / 线程 / 堆 / 默认 panic 行为（都需要操作系统）。</text>
          <text x="30" y="178" class="sv-lbl-dim" style="fill:var(--red)">缺 panic_handler → `#[panic_handler] function required, but not found`（本机实测）</text>
        </svg>
```

 

no\_std 不是"另一门语言"：` core ` 提供全部语言能力， **你只需补三样"边界"** ——panic 行为、入口、以及（可选）分配器。

 

```zhizhan-anchor
m03-2
```



## 3.2 ` panic_handler `：panic 之后由你决定

 

` std ` 在 panic 时会打印回溯并（可能）展开栈——这些都需要操作系统。no\_std 下没有默认行为，所以编译器会要求你 **提供一个 ` #[panic_handler] `** ，告诉它"panic 时做什么"。 嵌入式里最常见的答案就是"点个错误灯、复位、或直接死循环"。

 

min\_no\_std.rs — 最小 no\_std 骨架（含 panic\_handler 与入口） Rust

 

```text
// min_no_std.rs —— 一个能编过的最小固件骨架
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! { loop {} }   // 最小实现：死循环（现场可改成复位/灯闪）

static mut COUNTER: u32 = 0;

#[no_mangle]
pub extern "C" fn reset_handler() -> ! {
    unsafe { COUNTER = 0; }
    loop { unsafe { COUNTER = COUNTER.wrapping_add(1); } }
}
```

 

` #![no_main] ` 表示"不要标准入口"；真正的入口（复位向量）通常由启动文件/连接脚本指向你导出的函数（这里示意为 ` reset_handler `）。 这与第①册讲 STM32 启动流程时"` Reset_Handler ` 里干了什么"是同一件事。

 

no\_handler.rs — 反面：有 panic 路径却没有 panic\_handler Rust

 

```text
// 反面：索引越界会 panic，但没有提供 #[panic_handler]
#![no_std]
#![no_main]

#[no_mangle]
pub extern "C" fn first(x: &[u8]) -> u8 { x[0] }
```

 

**bash**  — 复跑：` bash tools/probes/m03.sh `（rustc 1.99 · thumbv7m-none-eabi）

 

```text
# 作为可执行 crate 构建（--crate-type bin）时，缺 panic_handler 直接报错：
$ rustc --edition 2021 --crate-type bin --target thumbv7m-none-eabi -O --emit=obj no_handler.rs -o no_handler.o
error: `#[panic_handler]` function required, but not found

# 加上 panic_handler 后，最小骨架编过、体积 28 字节：
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj min_no_std.rs -o min_no_std.o
$ arm-none-eabi-size min_no_std.o
   text    data     bss     dec     hex filename
     28       0       0      28      1c min_no_std.o
```

 

一个更"实战"的 ` panic_handler `：先记下故障码（写备份寄存器 / 静态变量），再复位或死等。 真正的 HardFault 现场（CFSR/HFSR）通常在异常向量里处理，panic 只负责"应用级不可恢复错误"的收尾——这两者分工要分清。

 

panic\_fault.rs — panic 时写故障码再复位 Rust

 

```text
// panic_fault.rs —— panic 收尾：记故障码 + 复位（示意）
#![no_std]
#![no_main]
use core::panic::PanicInfo;

// 掉电不清除的"故障码"（真实项目写备份寄存器 / noinit 段）
#[no_mangle]
pub static mut FAULT_CODE: u32 = 0;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    unsafe { core::ptr::write_volatile(&raw mut FAULT_CODE, 0xDEAD_BEEF); }
    // 现场：点错误灯 / 关中断 / 触发系统复位；这里简化为等待复位
    loop { core::hint::spin_loop(); }
}
```

 

⚠ HardFault ≠ panic

 

` panic ` 是 **软件主动** 触发的不可恢复错误（断言失败、` unwrap() ` 到 ` None `）。 硬件异常（HardFault/BusFault）是 **CPU 触发** 的，走的是异常向量，不是 ` panic_handler `。 第①册 Module 08 讲的那套（CFSR 逐位、栈帧冻结）在这里仍然适用——Rust 只是把"应用级不可恢复"的收尾标准化了。

 

```zhizhan-anchor
m03-3
```



## 3.3 panic 的代价：不是"有没有"，而是"带不带格式化"

 

panic 本身在 MCU 上是"可控的"（通常编译成 ` panic=abort `：直接终止），但 **带格式化的 panic**  会把 ` core::fmt ` 拖进来， 体积可能翻几倍。这是评估"能不能用 panic"时最该量的一件事。

 

panic\_size.rs — panic!() vs panic!("…{}") Rust

 

```text
// panic_size.rs —— 同一个文件里两种 panic
#![no_std]
use core::panic::PanicInfo;

#[panic_handler]
fn ph(_: &PanicInfo) -> ! { loop {} }

#[no_mangle]
pub extern "C" fn plain(x: u32) -> u32 {
    if x == 0 { panic!() }             // 无格式化
    x
}
#[no_mangle]
pub extern "C" fn formatted(x: u32) -> u32 {
    if x == 0 { panic!("bad {}", x) }  // 带格式化 → 拉进 core::fmt
    x
}
```

 

**bash**  — 复跑：` bash tools/probes/m03.sh `（第 3 节）

 

```text
$ arm-none-eabi-size panic_size.o
   text    data     bss     dec     hex filename
    181       0       0     181      b5 panic_size.o
# 两个函数放一起共 181 字节；把 formatted 去掉后明显更小 —— 格式化是恐慌成本的"大头"。
```

 

◆ panic 的三条实践

 

 
- **生产固件用 ` panic=abort `** （嵌入式默认），并把 ` panic_handler ` 写成"记录 \+ 复位/点灯"，而不是打印。
 
- **别在热路径用带格式化的 panic** ：` panic!("…{}", x) ` 拉进 ` core::fmt `；用 ` debug_assert! ` 只在 debug 构建里留。
 
- **panic 是"最后手段"** ，不是错误处理：可恢复错误用 ` Result `，这与 C 里"返回错误码"是一回事。

 

```zhizhan-anchor
m03-4
```



## 3.4 与 C 的启动流程对照

 

| 环节 | C（第①册） | Rust no\_std |
| --- | --- | --- |
| 入口 | ` Reset_Handler `（汇编/C） | ` #[no_mangle] extern "C" fn … `（被向量表指向） |
| 运行时初始化 | ` __libc_init_array `（.data/.bss \+ C\+\+ 构造） | Rust 无 C\+\+ 式全局构造；` static ` 需常量初始化 |
| 错误出口 | 断言失败 → ` abort `/死循环 | ` #[panic_handler] `（你实现） |
| 堆 | ` _sbrk ` \+ ` malloc ` | 默认无堆；要 ` alloc ` 需自己接分配器 |

 

```zhizhan-anchor
m03-5
```



## 3.5 真实工程：把上面拼成一个 Cargo 固件

 

前面用裸 ` rustc ` 是为了聚焦语言机制；真实项目用  **Cargo \+ cortex-m-rt** 。 ` cortex-m-rt ` 负责启动代码、向量表与 ` #[entry] `；你只需提供 ` memory.x `（内存布局）与 ` .cargo/config.toml `（目标与链接参数）：

 

Cargo.toml — 依赖与 release 优化档 TOML

 

```text
[package]
name = "minirs"
version = "0.1.0"
edition = "2021"

[dependencies]
cortex-m = "0.7"
cortex-m-rt = "0.7"
panic-halt = "0.2"

[profile.release]
opt-level = "z"      # 体积优先（Module 08）
lto = true
codegen-units = 1
```

 

memory.x — 内存布局（被链接脚本引用） text

 

```text
MEMORY {
  FLASH : ORIGIN = 0x08000000, LENGTH = 64K
  RAM   : ORIGIN = 0x20000000, LENGTH = 20K
}
```

 

.cargo/config.toml — 默认目标与链接参数 TOML

 

```text
[build]
target = "thumbv7m-none-eabi"

[target.thumbv7m-none-eabi]
rustflags = ["-C", "link-arg=-Tlink.x"]
```

 

src/main.rs — 最小固件（含关中断临界区） Rust

 

```text
// src/main.rs —— 一个真实、可链接的 cortex-m-rt 固件
#![no_std]
#![no_main]
use panic_halt as _;                       // panic → 死循环（Module 03）
use core::sync::atomic::{AtomicU32, Ordering};
use cortex_m::interrupt;
use cortex_m_rt::entry;

static COUNT: AtomicU32 = AtomicU32::new(0);

#[entry]
fn main() -> ! {
    let mut n = 0u32;
    loop {
        // 关中断临界区：读-改-写共享计数（M0/M3 都适用，Module 05）
        interrupt::free(|_cs| {
            n = COUNT.load(Ordering::Relaxed);
            COUNT.store(n.wrapping_add(1), Ordering::Relaxed);
        });
        core::hint::spin_loop();
    }
}
```

 

**bash**  — 复跑：` bash tools/probes/m_cargo.sh `（真实 ` cargo build --release `）

 

```text
$ cargo build --release
    Finished `release` profile [optimized] target(s) in 0.05s
$ arm-none-eabi-size target/thumbv7m-none-eabi/release/minirs
   text    data     bss     dec     hex filename
   1144       0       4    1148     47c target/thumbv7m-none-eabi/release/minirs
# 关键符号：cortex-m-rt 提供 Reset / HardFault_ / 向量表；你的 main 只有 8 字节
    00000008 T main
    00000006 T HardFault_
    00000006 T DefaultHandler_
    00000028 T Reset
    000003c0 R __INTERRUPTS
# Reset 先清 .bss，再跳 __cortex_m_rt_main → 你的 main（与第①册启动流程一一对应）
08000400 <Reset>:
  8000400:  bl   <DefaultPreInit>
  8000404:  ...        # 循环清 .bss
  ...
```

 

◆ 从"能编过"到"能烧录"还差什么

 

 
- **cortex-m-rt** ：提供启动、向量表、` #[entry] ` —— 对应第①册的 ` startup_*.s ` \+ 链接脚本。
 
- **memory.x** ：把 Flash/RAM 的地址与大小告诉链接器（本例 F103 风格：` 0x08000000 ` / ` 0x20000000 `）。
 
- **panic-halt** ：一个现成的 ` panic_handler `（死循环），省得每次自己写。
 
- **烧录** ：` cargo build ` 得到 ELF；用 ` probe-rs `/OpenOCD 下载。门禁能证明"能链接成 ELF"，但"烧到板子"仍需硬件。

 

**FIG 3.2**  core 与 std：留什么、去什么

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="no_std 用 core（无操作系统依赖），去掉分配/文件/线程等标准库设施">
          <rect x="30" y="40" width="180" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="120" y="63" class="sv-lbl-hi" text-anchor="middle">core（保留）</text>
          <text x="120" y="83" class="sv-lbl-dim" text-anchor="middle">类型/迭代/借用/atomic</text>
          <rect x="260" y="40" width="200" height="56" rx="6" class="sv-red-s"></rect>
          <text x="360" y="63" class="sv-lbl-hi" text-anchor="middle">std（去掉）</text>
          <text x="360" y="83" class="sv-lbl-dim" text-anchor="middle">堆/文件/线程/panic 运行时</text>
        </svg>
```

 

` #![no_std] ` 里没有现成的 ` panic_handler ` 与 ` start `，要自己提供。

 

| 设施 | std 有 | core 有 |
| --- | --- | --- |
| Vec / String（堆） | ✓ | ✗（需 alloc） |
| 文件 / 网络 / 线程 | ✓ | ✗ |
| atomic / 借用 / 迭代器 | ✓ | ✓ |
| ` panic_handler ` | 内置 | 需自己提供 |

 

| panic 策略 | 行为 | 体积 | 适用 |
| --- | --- | --- | --- |
| ` panic!("…{}") ` | 带格式化信息 | 大 | 开发期 |
| ` panic!() ` / ` abort ` | 直接中止/复位 | 小 | 发布固件 |
| 自写 ` panic_handler ` | 写故障码再复位 | 可控 | 量产 |

 

◆ 迁移练习

 

把一段依赖 ` std ` 的代码改成 ` #![no_std] `，补上 ` #[panic_handler] ` 与入口；记录编译报错并逐个消除。

 

◆ 本章要点

 

 
- ` no_std ` = 用 ` core ` 替 ` std `；所有权、trait、泛型、迭代器照常可用。
 
- no\_std 下必须提供 ` #[panic_handler] `；缺了它，可执行 crate 直接报错。
 
- panic 的体积大头是 **格式化** （` core::fmt `）；生产固件用 ` panic=abort ` 并避免格式化 panic。
 
- 入口与启动由你（或启动文件）提供，与 C 的 ` Reset_Handler ` 对应。
 
- 可恢复错误仍走 ` Result `，panic 只留给"不可恢复"。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 简答：` no_std ` 的固件为什么必须提供 ` #[panic_handler] `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为没有 ` std ` 提供的默认 panic 行为（打印/展开栈都需要操作系统）。编译器要求你指定 panic 时做什么；缺失时构建报 `` `#[panic_handler]` function required ``。"}
   ```
 
2. 判断：用了 ` no_std `，就不能用迭代器、闭包、泛型了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错。这些都在 ` core ` 里，照常可用。失去的是依赖操作系统的部分（文件、网络、线程、堆）。"}
   ```
 
3. 诊断：把一个固件从 ` panic!() ` 改成 ` panic!("bad {}", x) `，体积为什么明显变大？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"带占位符的 panic 需要格式化，会把 ` core::fmt ` 及相关代码链进来。本机实测：两种 panic 同文件共 181 字节，去掉带格式化的那个明显更小。"}
   ```
 
4. 动手：把最小骨架的 ` panic_handler ` 从 ` loop {} ` 改成"关中断 \+ 复位"，再编一次看体积变化。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"复位通常要写系统控制寄存器（` unsafe ` \\+ MMIO），体积增加很少，但语义更合适——这正是嵌入式 panic 的常规做法。"}
   ```
 
5. 判断：` panic ` 应该用来做日常错误处理（比如"文件没找到"）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不应该。可恢复错误用 ` Result<T, E> `（对应 C 的错误码）；panic 只用于\"不可恢复、继续运行没意义\"的情况。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  把本节的 ` panic_size.rs ` 在你板子的目标上编一次，量出"带格式化/不带格式化"的体积差。

 

```zhizhan-assessment
{"id":"course-b03-m03","criterion":"目标 no_std 构建成功，panic 策略和启动/内存配置可追溯。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
