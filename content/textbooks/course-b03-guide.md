# Rust（嵌入式向） · 学习路线

```zhizhan-anchor
top
```

 

```zhizhan-anchor
content
```



◆ MODULE 01–10 · 阶段 ② 现代语言

 

## 嵌入式 Rust 所有权与 no\_std

 

这不是又一份 Rust 语言教程。这里只回答一件事： **从你已经会写的 C 出发，Rust 用"[所有权](term:ownership)"替你消灭了哪一类 bug，代价是什么** 。 悬垂指针、数据竞争、忘记初始化、[DMA](term:dma) 缓冲被移动——这些在 C 里靠纪律，在 Rust 里靠编译器。 每个结论都落到真实交叉编译的指令、体积与错误信息上（` rustc --target thumbv7m-none-eabi `）。

 

**10** 核心模块

 

**54** 代码与命令

 

**19** 原理图示

 

**39** 对照表格

 

本册的定位

 

面向 **已经读完第①册、会在 C 里直接操作寄存器** 的开发者。前提是你清楚 **栈/堆/段、编译链接、` volatile ` 与内存序** 的底层含义 —— 因为 Rust 的每一个"安全保证"，最终都要落到这些底层机制上解释"它到底保证了什么、又要付什么"。

 

贯穿全册的是一条 **C ↔ Rust 对照线** ：同一件功能，先看 C 怎么写、会出什么错，再看 Rust 如何用类型与所有权让它在 **编译期** 不可能发生。 平台锚点仍是  **STM32（Cortex-M3/M0）** ；交叉编译目标 ` thumbv7m / thumbv6m-none-eabi `。

     

```zhizhan-anchor
book-mastery
```



```zhizhan-anchor
book-mastery-title
```



## Rust 固件分支 · 读到能完成什么？



**以 embedded-hal 接口实现设备后端，写出 DMA 缓冲的归还和取消协议。**



入门条件：B03a 所有权、Result、trait；B05 外设与中断。



首次阅读：[所有权与借用：对着 C 讲](doc:course-b03-m01#m01) → [用类型系统编码硬件约束](doc:course-b03-m02#m02) → [\`no\_std\` 与 panic](doc:course-b03-m03#m03) → [embedded-hal 抽象](doc:course-b03-m04#m04) → [中断与并发](doc:course-b03-m05#m05) → [DMA 与所有权](doc:course-b03-m06#m06) → [异步固件、取消与外设所有权](doc:course-b03-m10#m10)



按需延后：FFI、性能微调与多执行器比较按项目选读。



```zhizhan-details
{"title":"独立验收：先做，再展开核对","body":"**需求变更与故障：** 取消 future 后 DMA 仍忙，证明缓冲不能提前复用；测试外设故障与超时。\n\n\n\n**通过判据：** host mock、目标构建和实机分别有证据；unsafe 前提写清，drop 不冒充硬件停止。\n\n\n\n先不看示例独立实现；卡住时只查对应小节。成功复现后换一个输入、平台或需求，说明为什么仍成立。记录证据路径与失败原因，不以勾选数量代替能力。\n\n\n\n参考工程：[P01](doc:course-projects#P01)；[全库项目路线与时间安排](doc:course-learning-path)。"}
```



时间为规划估计，阅读、编程、排错分开记录。主机测试、SDK 构建与板上测量分别验收；自评不等于能力认证。
