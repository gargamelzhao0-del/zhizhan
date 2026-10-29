# Rust 语言基础 · 学习路线

```zhizhan-anchor
top
```

 

```zhizhan-anchor
content
```



◆ MODULE 01–12 · 阶段 ② 现代语言 · 基

 

## Rust 语言基础 从零到能读《Rust 迁移》

 

这一册把  **Rust 当作一门语言从零讲** ：变量、[所有权](term:ownership)与移动、借用、枚举与模式匹配、结构体与 trait、集合与错误处理、生命周期与迭代器、模块/Cargo/测试。 前提是你会 C（读完 B00）。学完它，你就能顺畅读《Rust（嵌入式向）》(B03)，把 Rust 用到单片机上。 每个示例都用 ` rustc `  **真实编译并运行** 。

 

**12** 核心模块

 

**40** 代码与命令

 

**21** 原理图示

 

**34** 对照表格

 

◆ 谁该读 / 读完能做什么

 

 
- **会 C、想系统学 Rust** ：从这一册开始。B03 假设你已懂所有权/借用，本册正是补这一课。
 
- 学完你能：写结构体与 enum、用 trait、用 ` Result ` 处理错误、用集合与迭代器、组织 Cargo 工程与测试。
 
- 然后进入 B03：把 Rust 放到 MCU 上——所有权如何保证 [DMA](term:dma)/中断安全、no\_std 与体积。

  

```zhizhan-anchor
book-mastery
```



```zhizhan-anchor
book-mastery-title
```



## Rust 分支 · 读到能完成什么？



**交付一个带 trait 后端与 Result 错误的库，含单元、文档及编译失败测试。**



入门条件：能写函数与集合处理；C 经验有帮助但不是所有权概念的替代。



首次阅读：[所有权与移动](doc:course-b03a-m02#m02) → [借用与引用](doc:course-b03a-m03#m03) → [枚举与模式匹配](doc:course-b03a-m04#m04) → [结构体、方法与 trait](doc:course-b03a-m05#m05) → [集合与错误处理](doc:course-b03a-m06#m06) → [模块、Cargo 与测试](doc:course-b03a-m08#m08) → [泛型、trait 与 API 设计深化](doc:course-b03a-m09#m09) → [Cargo 工程、测试与质量](doc:course-b03a-m12#m12)



按需延后：高级异步与线程先延后；进入 B03 的 no\_std 与设备驱动时再用。



```zhizhan-details
{"title":"独立验收：先做，再展开核对","body":"**需求变更与故障：** 把借用对象移出作用域，或把 Rc 交给线程；解释编译错误并调整接口。\n\n\n\n**通过判据：** cargo test 与目标 feature 组合通过；不靠 clone/unwrap 掩盖生命和失败政策。\n\n\n\n先不看示例独立实现；卡住时只查对应小节。成功复现后换一个输入、平台或需求，说明为什么仍成立。记录证据路径与失败原因，不以勾选数量代替能力。\n\n\n\n参考工程：[P01](doc:course-projects#P01)；[全库项目路线与时间安排](doc:course-learning-path)。"}
```



时间为规划估计，阅读、编程、排错分开记录。主机测试、SDK 构建与板上测量分别验收；自评不等于能力认证。
