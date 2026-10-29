# 模块、Cargo 与测试 + 过渡到 B03

```zhizhan-anchor
m08
```



学完语言本体，最后一步是 **组织工程** ：用 ` mod ` 拆分模块、用  **Cargo**  管理依赖与构建、 用 ` #[test] ` 写测试。然后你就可以进入《Rust（嵌入式向）》(B03)。

 

> ◷ 约 65 分钟 · ◈ mod · cargo · #\[test\] · ⚑ 过渡到 B03

 

```zhizhan-anchor
m08-1
```



## 8.1 模块与可见性

 

modules.rs — mod 与 pub Rust

 

```text
mod math {
    pub fn square(x: i32) -> i32 { x * x }   // pub：对外可见
    fn helper() -> i32 { 1 }                 // 私有：模块外不可见
}

fn main() {
    println!("square(5) = {}", math::square(5));   // 用 模块::路径 访问
    // math::helper();                             // 错误：helper 是私有的
}
```

 

◆ 模块 = 命名空间 \+ 可见性

 

` mod ` 给代码分组；` pub ` 决定对外可见性。默认私有——这强制你把"实现细节"藏起来，只暴露必要接口（和 C 的不透明指针、C\+\+ 的 private 是同一个目的）。

 

```zhizhan-anchor
m08-2
```



## 8.2 Cargo 工程与测试

 

真实项目用 Cargo：` cargo new proj ` 建工程，` cargo run ` 编译运行，` cargo test ` 跑测试，` cargo build --release ` 出发布版。

 

Cargo.toml — 工程与依赖 TOML

 

```text
[package]
name = "minirstest"
version = "0.1.0"
edition = "2021"

[dependencies]
# 需要第三方 crate 时写在这里，如：
# libm = "0.2"     # 嵌入式常用数学库
```

 

src/main.rs — 程序 \+ 内联测试 Rust

 

```text
fn add(a: i32, b: i32) -> i32 { a + b }
fn is_even(n: i32) -> bool { n % 2 == 0 }

fn main() {
    println!("add(2,3) = {}", add(2, 3));
    println!("is_even(4) = {}", is_even(4));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_add() { assert_eq!(add(2, 3), 5); }
    #[test]
    fn test_is_even() { assert!(is_even(4)); assert!(!is_even(5)); }
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（另见 tools/probes/m08\_cargo/）

 

```text
$ cargo run -q
add(2,3) = 5
is_even(4) = true
$ cargo test
running 2 tests
test tests::test_add ... ok
test tests::test_is_even ... ok
test result: ok. 2 passed; 0 failed; 0 ignored
# 测试写在同一个文件里（或 tests/ 目录），cargo test 自动收集运行——语言自带测试框架。
```

 

| Cargo 命令 | 作用 |
| --- | --- |
| ` cargo new proj ` | 新建工程（含 Cargo.toml \+ src/main.rs） |
| ` cargo run ` | 编译并运行 |
| ` cargo test ` | 运行所有 ` #[test] ` |
| ` cargo build --release ` | 发布版构建（开优化） |
| ` cargo build --target thumbv7m-none-eabi ` | 交叉编译到 MCU（B03 详讲） |

 

```zhizhan-anchor
m08-3
```



## 8.3 你已经会 Rust 了——下一步

 

**FIG 8.1**  从"会 Rust"到"把 Rust 用到 MCU"

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="B03a 到 B03 的过渡">
          <rect x="20" y="52" width="230" height="46" rx="6" class="sv-box"></rect>
          <text x="135" y="72" class="sv-lbl-hi" text-anchor="middle">B03a（本册）</text>
          <text x="135" y="89" class="sv-lbl-dim" text-anchor="middle">所有权/借用/enum/trait/集合/迭代器</text>
          <path d="M250 75 L310 75" class="sv-arrow"></path>
          <rect x="312" y="30" width="328" height="90" rx="8" class="sv-grn-s"></rect>
          <text x="330" y="54" class="sv-lbl-hi" style="fill:var(--grn)">B03《Rust（嵌入式向）》</text>
          <text x="330" y="76" class="sv-lbl-dim">no_std 与 panic、embedded-hal 分层</text>
          <text x="330" y="96" class="sv-lbl-dim">中断与并发、DMA 与所有权</text>
          <text x="330" y="114" class="sv-lbl-dim">unsafe/FFI、体积与性能</text>
        </svg>
```

 

本册教" **Rust 怎么写** "；B03 教" **在 MCU 上怎么用** "——[所有权](term:ownership)如何保证 [DMA](term:dma)/中断安全、no\_std 与体积、与 C 互操作。两册配对。

 

```zhizhan-anchor
m08-4
```



## 08.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 拆文件 | ` #include ` | ` mod ` |
| 可见性 | ` static ` | ` pub ` |
| 构建 | Makefile | Cargo.toml |
| 测试 | 手写断言 | ` #[test] ` |

 

**FIG 8.2**  crate / mod 层级

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="crate 是包，mod 是可嵌套模块">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">crate</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">mod a</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">mod b</text>

        </svg>
```

 

可见性用 pub 控制。

 

**FIG 8.3**  Cargo 工作流

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="build / run / test 一条命令">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">cargo build</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">cargo run</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">cargo test</text>

        </svg>
```

 

无需手写构建脚本。

 

```zhizhan-anchor
m08-5
```



## 08.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| ` mod ` 路径写错 | unresolved module | 对齐文件/路径 |
| 忘记 ` pub ` | function is private | 加 ` pub ` |
| 测试没加 ` #[test] ` | 不被执行 | 补注解 |

 

```zhizhan-anchor
m08-6
```



## 08.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m08b.rs Rust

 

```text
mod math {
    pub fn add(a: i32, b: i32) -> i32 { a + b }
}

fn main() { println!("{}", math::add(2, 3)); }
```

 

m08c.rs Rust

 

```text
fn mul(a: i32, b: i32) -> i32 { a * b }

fn main() {
    assert_eq!(mul(3, 4), 12);
    println!("ok");
}
```

 

◆ 迁移练习

 

把你的单文件 Rust 程序拆成 ` mod `，用 Cargo 建工程，并写一个 ` #[test] ` 跑通。

 

◆ 本章要点

 

 
- ` mod ` 拆分模块、` pub ` 控制可见性（默认私有）。
 
- Cargo 管工程：` cargo new/run/test/build `。
 
- 测试用 ` #[test] ` \+ ` assert_eq! `，` cargo test ` 运行——语言自带测试框架。
 
- ` cargo build --target thumbv7m-none-eabi ` 就是交叉编译到 MCU 的入口。
 
- 学完本册，进入 B03 学嵌入式落地。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 填空：运行测试命令是 ` cargo ______ `，交叉编译到 MCU 用 ` cargo build --target ______ `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` cargo test `；` cargo build --target thumbv7m-none-eabi `（或 thumbv6m）。"}
   ```
 
2. 判断：mod 里的项默认对外可见。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对，默认 **私有** ；要对模块外可见必须加 ` pub `。"}
   ```
 
3. 诊断：` #[test] ` 函数报"no test harness"或不被运行，可能是什么原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"最根本的原因通常是 **没用 ` cargo test `** ：测试框架由 Cargo 提供，` rustc ` 只编译、不会运行 ` #[test] `。 *补充：` #[test] ` 函数并不强制要放进某个模块，` cargo test ` 会自动发现；惯例是放进 ` #[cfg(test)] mod tests `，这样发布构建里不含测试代码。*"}
   ```
 
4. 动手：给你的工程写一个 ` #[test] `，分别用 ` cargo test ` 与 ` rustc ` 试试，体会"测试需要 cargo"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` cargo test ` 会运行测试；直接用 ` rustc ` 编单文件不会跑测试（那只是编译）。"}
   ```
 
5. 判断：学完本册可以直接写出 MCU 上的 Rust 固件并跑起来。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"语言层面可以，但还需 B03 的知识：` no_std `、` panic_handler `、链接脚本/memory.x、cortex-m-rt、中断与 DMA —— 请继续读 B03。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**B03a 完成？**  恭喜——你已经掌握 Rust 语言本体。下一步请打开《Rust（嵌入式向）》(B03)，学"在 MCU 上的所有权、no\_std 与并发"。

 

```zhizhan-assessment
{"id":"course-b03a-m08","criterion":"拆模块、限定公开 API、运行 cargo test 与文档测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
