# 跟着做：一个最小固件 minirs

```zhizhan-anchor
minirs
```



全册不是九个孤立的知识点。从 M01 起，我们用同一个可编译、可测量的最小固件 ` minirs `， 把每节的新机制"接"进去；最后它就是一个 **真实可烧录的 cortex-m-rt 工程** （M03 §3.5 给了完整 ` Cargo.toml ` / ` memory.x ` / ` main.rs `）。

 

◆ 怎么用这条主线

 

每进入一个模块，先看它对应的"第 N 步"：给 ` minirs ` 加了什么、对应本节哪个代码块、以及一个 **你能自己动手验证的验收标准** 。 Rust 块用 ` rustc --target thumbv7m/thumbv6m-none-eabi `，Cargo 块用 ` cargo build --release `（见 ` tools/cargo-demo/ `）。

 

| 步 | 模块 | 给 minirs 加什么（对应代码块） | 动手验收（自己量/测） |
| --- | --- | --- | --- |
| 0 | M01 | 用[所有权](term:ownership)/借用表达"谁拥有缓冲"（` ownership.rs `/` borrow.rs `） | 制造悬垂/双重可变借用，确认是  **编译错误** |
| 1 | M02 | 用类型状态机包一个外设（` typestate.rs `） | 未 init 就 write，确认 ` E0599 ` |
| 2 | M03 | **落成真实 Cargo 固件** （` Cargo.toml `\+` memory.x `\+` main.rs `） | ` cargo build --release ` 出 ELF，` size ` 读 text/bss |
| 3 | M04 | 上层驱动只依赖 trait（` hal_traits.rs `/` hal_dyn.rs `） | 换底层实现不改上层；比较泛型 vs ` dyn ` 体积 |
| 4 | M05 | 共享计数用临界区（` critical_free.rs `） | M0 上 ` fetch_add ` 编不过 → 改用临界区 |
| 5 | M06 | [DMA](term:dma) 借用缓冲期间禁止改动（` dma_ok.rs `） | 传输中改缓冲，确认 ` E0506 ` |
| 6 | M07 | 把 MMIO/FFI 收敛成安全 API（` unsafe_wrap.rs `/` ffi.rs `） | ` nm -u ` 确认 C 符号为 ` U ` |
| 7 | M08 | 定体积预算与优化档（` opt-level `） | z/1/2/3 各编一次，量出体积差 |
| 8 | M09 | 同题对齐 C/C\+\+（` breath_*.c/.cpp/.rs `） | 三语言同功能 ` size ` 对照 |

 

✔ 为什么配"验收标准"

 

每一步都要求你 **自己量一次或让编译器判一次** ，因为它们能把你从"我以为懂了"推到"我量出来了"。 读懂原理只完成一半； **能预测、能测量、能排障** ，才算真的掌握。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
