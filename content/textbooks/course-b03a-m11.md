# 并发与异步语言基础

```zhizhan-anchor
m11
```



区分并发、共享状态和异步取消，维护[资源所有权](term:ownership)。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m11-mechanism
```



## 机制与契约



线程可以同时执行任务；Send/Sync 表达类型跨线程转移和共享的条件。示例用有界 sync\_channel 传递拥有的数据，以队列容量形成[背压](term:backpressure)；Arc\<Mutex\<T\>\> 共享受保护的状态，锁应只覆盖短操作。Future 是可被 poll 推进的状态机，async 函数被调用并不表示已经运行。取消常表现为 Future 被丢弃，但 Drop 不能自动证明真实 IO/[DMA](term:dma) 已停止。



关键片段 · 完整可运行项目见下方源码



```text
let (tx, rx) = std::sync::mpsc::sync_channel(2);
// 容量满时 send 阻塞；消费端关闭时发送返回错误。
```

 

```zhizhan-anchor
m11-boundary
```



## 边界与误用



Rc 不能直接跨线程；Arc 也不自动让任意 T 线程安全。不要持锁等待另一个线程必须获得同一锁才能完成的事件。主机线程模型不能直接套到中断上下文。

 

```zhizhan-anchor
m11-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
cargo test --manifest-path labs/course-core/Cargo.toml --offline
cargo check --manifest-path labs/course-core/Cargo.toml --offline --no-default-features
```



完整源码：[labs/course-core/Cargo.toml](textbook-file:b03a/labs/course-core/Cargo.toml) · [labs/course-core/src/lib.rs](textbook-file:b03a/labs/course-core/src/lib.rs)

 

动手与迁移



运行消息与互斥测试，以及 Rc 的 compile\_fail 测试；主动关闭接收端，改成处理发送错误。画出阻塞发生在哪一步。



**验收：** 消息总和=10、共享计数=400；关闭通道有明确处理；说明异步取消时谁关闭设备和归还缓冲。

 

先预测，再运行



使用 async 是否保证不会阻塞？



```zhizhan-details
{"title":"查看推理","body":"async 只允许分段让出执行；在 poll 内执行阻塞 IO、长计算或持锁等待仍会阻塞执行器。还需选择合适运行时与 IO 接口。"}
```



核对来源：[Rust 官方 Book · 泛型、所有权、错误与并发](https://doc.rust-lang.org/book/)

 





```zhizhan-assessment
{"id":"course-b03a-m11","criterion":"用编译失败说明 Rc 的线程边界；取消异步任务时资源释放有定义。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
