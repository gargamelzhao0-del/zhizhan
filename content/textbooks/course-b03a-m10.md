# 集合、借用与错误链深化

```zhizhan-anchor
m10
```



处理集合引用、UTF-8 切片和可追溯的错误。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m10-mechanism
```



## 机制与契约



String 的长度是字节数，任意字节下标不一定处在 UTF-8 字符边界。切片要通过 get 等受检查操作处理非法范围。Vec 增长可能迁移存储，Rust 阻止在活跃引用存在时进行冲突修改；编译器通过不是业务格式正确的证明。parse 将解析错误与非有限数分开，错误枚举允许上层决定记录、重试还是拒绝，而不是在深层 panic。



关键片段 · 完整可运行项目见下方源码



```text
let v = text.trim().parse::<f64>().map_err(|_|SampleError::Parse)?;
if !v.is_finite() { return Err(SampleError::NonFinite); }
```

 

```zhizhan-anchor
m10-boundary
```



## 边界与误用



用 unwrap 清空错误路径会使坏输入终止程序；NaN 可以成功被解析，仍需业务范围检查。保留字段、行号或设备 ID 等上下文，不只返回“失败”。

 

```zhizhan-anchor
m10-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
cargo test --manifest-path labs/course-core/Cargo.toml --offline
cargo check --manifest-path labs/course-core/Cargo.toml --offline --no-default-features
```



完整源码：[labs/course-core/Cargo.toml](textbook-file:b03a/labs/course-core/Cargo.toml) · [labs/course-core/src/lib.rs](textbook-file:b03a/labs/course-core/src/lib.rs)

 

动手与迁移



运行 parse 测试与 compile\_fail 文档测试；增加中文字符串的合法/非法边界切片和带行号的解析错误。



**验收：** 坏文本与 NaN 区分；没有失效引用；非法 UTF-8 边界不会 panic；能追踪失败输入位置。

 

先预测，再运行



为什么浮点解析成功后还要 is\_finite？



```zhizhan-details
{"title":"查看推理","body":"词法解析只识别表示形式，NaN/无穷仍属于可解析值。传感器或控制契约通常需要有限数及物理范围，必须再验证。"}
```



核对来源：[Rust 官方 Book · 泛型、所有权、错误与并发](https://doc.rust-lang.org/book/)

 





```zhizhan-assessment
{"id":"course-b03a-m10","criterion":"在借用、迭代和修改集合之间安排生命期；保留底层错误来源。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
