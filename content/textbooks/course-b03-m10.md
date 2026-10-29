# 异步固件、取消与外设所有权

```zhizhan-anchor
m10
```



说明异步取消后 [DMA](term:dma) 缓冲区何时可以安全归还。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）



真实DMA取消：先确认停止，再归还缓冲



```zhizhan-figure
<svg viewBox="0 0 800 190" role="img" aria-label="真实DMA取消：先确认停止，再归还缓冲"><title>真实DMA取消：先确认停止，再归还缓冲</title><defs><marker id="mastery-arrow-dma-cancel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="currentColor"></path></marker></defs><rect x="10" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="132.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">提出取消</text><text x="132.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">停止新提交</text><text x="132.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">缓冲仍由DMA占有</text><text x="132.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">等待停止协议</text><path d="M257 92H272" stroke="currentColor" marker-end="url(#mastery-arrow-dma-cancel)"></path><rect x="275" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="397.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">确认外设静止</text><text x="397.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">停通道并等待确认</text><text x="397.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">处理晚到IRQ/回调</text><text x="397.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">不再有硬件访问</text><path d="M522 92H537" stroke="currentColor" marker-end="url(#mastery-arrow-dma-cancel)"></path><rect x="540" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="662.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">归还资源</text><text x="662.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">缓冲可复用</text><text x="662.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">外设可重新提交</text><text x="662.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">记录取消结果</text></svg>
```



这是目标后端必须满足的协议；dma\_contract.rs 只实现同步 mock，不能用 busy=false 证明真实DMA已停止。

 

```zhizhan-anchor
m10-mechanism
```



## 机制与契约



Transfer 同时独占借用 Channel 与缓冲，存在期间调用者不能再次使用它们。Drop 可实现清理，但真实 DMA 是独立于 CPU 的外设：丢弃 Future 后，硬件仍可能继续读写内存。实际取消协议必须禁止新提交、停止通道、等待硬件确认静止、清除/屏蔽晚到中断，再归还缓冲与外设[所有权](term:ownership)。示例只实现同步停止的 mock，验证借用与再次提交；不把软件 busy=false 视作硬件停止证据。



关键片段 · 完整可运行项目见下方源码



```text
{ let mut transfer=channel.start(&mut buffer);
  transfer.mock_progress(); } // mock 在 Drop 同步停止
// 只有停止确认后，真实后端才能提供相同的安全归还语义。
```

 

```zhizhan-anchor
m10-boundary
```



## 边界与误用



只在 Drop 写一个标志不足以停止 DMA；异步等待不能直接放进普通 Drop。可采用显式 async cancel\_and\_wait，或满足同步停止保证的硬件抽象，并规定强制掉弃时的安全策略。

 

```zhizhan-anchor
m10-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
rustc --edition=2021 --test labs/dma_contract.rs -o dma_contract
./dma_contract
rustc --edition=2021 --crate-type lib labs/dma_contract.rs
```



完整源码：[labs/dma\_contract.rs](textbook-file:b03/labs/dma_contract.rs)

 

动手与迁移



运行 no\_std 模型测试；画出完成中断与取消竞争的时序；按实际 HAL/芯片说明谁确认停止、何时缓冲可复用。



**验收：** mock 取消后可再次提交；实际后端无取消后的写入和晚到回调；executor/HAL/芯片版本与验证层级明确。

 

先预测，再运行



所有权检查为什么不能自动证明外设已经停止？



```zhizhan-details
{"title":"查看推理","body":"借用检查约束 Rust 程序可见的引用；DMA 的异步访问通过 unsafe/HAL 合约进入系统，安全性依赖后端正确执行硬件停止与同步。"}
```



核对来源：[Rust Embedded Book · DMA](https://docs.rust-embedded.org/book/)

 





```zhizhan-assessment
{"id":"course-b03-m10","criterion":"future 取消不会提前释放在途 DMA/外设资源，超时后可恢复或明确转入故障态。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
