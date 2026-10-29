# 泛型、trait 与 API 设计深化

```zhizhan-anchor
m09
```



设计可替换后端的 trait 接口，并选择静态或动态分派。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m09-mechanism
```



## 机制与契约



Source 通过关联类型 Error 表达后端错误，acquire\<S:Source\> 使用泛型静态分派，调用者仍能获得具体错误类型。dyn Source\<Error=SampleError\> 使用运行时分派，需满足 dyn 兼容规则并固定关联类型。泛型可能增加单态化代码，动态分派增加间接调用；是否值得取决于后端数量、镜像体积和实际调用频率。先为接口定义输入输出和失败语义，再决定分派方式。



关键片段 · 完整可运行项目见下方源码



```text
pub trait Source {
    type Error;
    fn next(&mut self) -> Result<f64, Self::Error>;
}
```

 

```zhizhan-anchor
m09-boundary
```



## 边界与误用



trait 不是只写函数名；&self/&mut self 表达共享与独占约束。带泛型方法的 trait 不一定可作为 dyn 使用，接口设计时应核对 dyn 兼容条件。

 

```zhizhan-anchor
m09-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
cargo test --manifest-path labs/course-core/Cargo.toml --offline
cargo check --manifest-path labs/course-core/Cargo.toml --offline --no-default-features
```



完整源码：[labs/course-core/Cargo.toml](textbook-file:b03a/labs/course-core/Cargo.toml) · [labs/course-core/src/lib.rs](textbook-file:b03a/labs/course-core/src/lib.rs)

 

动手与迁移



为 Source 增加另一个返回固定值的后端；运行泛型调用与 dyn 调用；让后端读完后返回 End。



**验收：** 两类分派都能使用；错误没有被 unwrap 隐藏；解释独占访问和关联错误类型；能够选择适合目标的分派。

 

先预测，再运行



为何 dyn Source 必须指定这里的 Error？



```zhizhan-details
{"title":"查看推理","body":"调用者需要知道 next 的返回类型与布局。dyn 对象隐藏了实现类型，仍须固定关联类型才能确定这个返回契约。"}
```



核对来源：[Rust 官方 Book · 泛型、所有权、错误与并发](https://doc.rust-lang.org/book/)

 





```zhizhan-assessment
{"id":"course-b03a-m09","criterion":"比较泛型静态分发与 dyn trait；说明所有权和对象安全等接口限制。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
