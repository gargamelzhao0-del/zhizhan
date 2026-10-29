# 术语与符号对照表

```zhizhan-anchor
glossary
```



本页是 B03 的 **单一事实源** ：` verify/glossary.json ` 与下表逐条比对， 两边漂移（少了/多了/写错）会在构建时 **直接失败** 。改术语/符号时，两处必须同步。

 

```zhizhan-anchor
glossary-terms
```



## 术语

 

| 术语 | 含义 |
| --- | --- |
| **[所有权](term:ownership)** | 每个值有且只有一个所有者；所有者离开作用域即析构。它是 Rust 消灭"忘记释放/重复释放"的根机制。 |
| **借用** | 不转移所有权的临时引用：` &T ` 为共享借用（可多个、只读），` &mut T ` 为独占借用（同时只能一个）。 |
| **生命周期** | 引用必须不晚于它引用的数据失效；用 ` 'a ` 显式标注，对应 C 里的悬垂指针约束。 |
| **类型状态机** | 把"对象处于哪个状态"编码进类型（如 ` Uart<Uninit> ` / ` Uart<Ready> `），使"前置条件未满足"的操作根本不存在。 |
| **newtype** | 只用一层包装区分同一底层类型的不同含义（如 ` struct RegAddr(u32) `），运行期零开销。 |
| **no\_std** | 去掉依赖操作系统的 ` std `，只用 ` core `；需自备 panic 行为、入口（可选分配器）。 |
| **core** | Rust 语言内核 crate：基本类型、` Option `/` Result `、切片、atomic、迭代器、fmt（可选）。 |
| **panic\_handler** | no\_std 下由你提供的"panic 时做什么"的函数（` #[panic_handler] `）；缺失则可执行 crate 构建失败。 |
| **UnsafeCell** | Rust 中唯一允许"内部可变性"的底层类型；` Cell `/` RefCell `/` Mutex ` 等都建立在它之上。共享可变的根源难点都在这里。 |
| **Send** | ` T ` 的所有权可安全转移到另一执行单元；跨上下文传递值的编译期约束。 |
| **Sync** | ` &T ` 可安全跨执行单元共享；因此 ` static T ` 要求 ` T: Sync `。这是"无数据竞争"的类型来源。 |
| **单态化** | 泛型在编译期为每种具体类型各生成一份代码（monomorphization）；零运行时开销，代价是体积膨胀。 |

 

```zhizhan-anchor
glossary-symbols
```



## 符号 / 构件

 

| 符号 / 构件 | 类别 | 说明 |
| --- | --- | --- |
| ` #[entry] ` | 宏（cortex-m-rt） | 标记复位后进入的 ` main `；由 cortex-m-rt 生成启动与调用序列。 |
| ` #[exception] ` | 宏（cortex-m-rt） | 注册系统异常处理器（SysTick / HardFault / …）。 |
| ` #[interrupt] ` | 宏（PAC） | 注册外设中断处理器（中断名来自具体芯片 PAC）。 |
| ` #[no_mangle] ` | 属性 | 关闭名字修饰，导出稳定的 C 符号名（供 C/汇编/向量表使用）。 |
| ` extern "C" ` | ABI 约定 | 使用 C ABI 与链接名；声明外部 C 函数或导出 Rust 函数。 |
| ` Reset ` | 符号（cortex-m-rt） | 复位向量指向的符号：清 ` .bss `、调用 ` __cortex_m_rt_main ` 最终进 ` main `。 |
| ` HardFault_ ` | 符号（cortex-m-rt） | 默认硬故障处理器（未自定义时的兜底）。 |
| ` __INTERRUPTS ` | 符号（链接） | 中断向量表区域；由 cortex-m-rt 依据 ` memory.x ` 与向量布局生成。 |
| ` memory.x ` | 文件（链接脚本片段） | 声明 Flash/RAM 的 ORIGIN 与 LENGTH，被链接脚本 link.x 引用。 |
| ` critical-section ` | crate/机制 | 跨平台"临界区"抽象；cortex-m 提供 ` interrupt::free ` / single-core 实现。 |
| ` panic-halt ` | crate | 现成的 ` panic_handler `：panic 后死循环，省去自己实现。 |

 

维护提示：正文里新增的术语/符号若要进对照表，先登记到 ` verify/glossary.json `，再补本表——两处同步后构建才会通过。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
