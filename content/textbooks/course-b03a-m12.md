# Cargo 工程、测试与质量

```zhizhan-anchor
m12
```



交付可离线测试、可检查 feature 组合的 Cargo 工程。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）



核心与主机能力分开检查



```zhizhan-figure
<svg viewBox="0 0 800 190" role="img" aria-label="核心与主机能力分开检查"><title>核心与主机能力分开检查</title><defs><marker id="mastery-arrow-rust-features" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="currentColor"></path></marker></defs><rect x="10" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="132.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">核心API</text><text x="132.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">Source + Result</text><text x="132.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">解析与有限数检查</text><text x="132.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">无第三方依赖</text><path d="M257 92H272" stroke="currentColor" marker-end="url(#mastery-arrow-rust-features)"></path><rect x="275" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="397.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">feature=host</text><text x="397.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">主机线程与有界通道</text><text x="397.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">单元+compile_fail测试</text><text x="397.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">cargo test --offline</text><path d="M522 92H537" stroke="currentColor" marker-end="url(#mastery-arrow-rust-features)"></path><rect x="540" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="662.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">关闭默认feature</text><text x="662.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">核心按no_std检查</text><text x="662.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">并非完整固件</text><text x="662.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">目标入口/HAL另接</text></svg>
```



同一个包分别验证主机测试和 no\_std 核心。无 std 不代表已链接、已烧录或满足实时约束。

 

```zhizhan-anchor
m12-mechanism
```



## 机制与契约



包清单声明 edition、依赖和 features；本例没有第三方依赖，host feature 控制线程实验，关闭它后核心按 no\_std 编译。核心接口不依赖文件、网络或硬件，便于单元测试。单元测试验证模块内部，集成测试验证公开 API，文档测试同时验证例子和预期编译失败。团队项目应记录工具链、依赖锁与目标，不随意让远端最新依赖决定构建。



关键片段 · 完整可运行项目见下方源码



```text
cargo test --manifest-path labs/course-core/Cargo.toml --offline
cargo check --manifest-path labs/course-core/Cargo.toml --offline --no-default-features
```

 

```zhizhan-anchor
m12-boundary
```



## 边界与误用



no\_std 检查只说明核心没有依赖 std，并不等于完整固件。目标构建还需 target、链接脚本、启动入口、panic 策略和 HAL。不要把某一 feature 组合通过推广到所有组合。

 

```zhizhan-anchor
m12-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
cargo test --manifest-path labs/course-core/Cargo.toml --offline
cargo check --manifest-path labs/course-core/Cargo.toml --offline --no-default-features
```



完整源码：[labs/course-core/Cargo.toml](textbook-file:b03a/labs/course-core/Cargo.toml) · [labs/course-core/src/lib.rs](textbook-file:b03a/labs/course-core/src/lib.rs)

 

动手与迁移



清洁运行命令；增加集成测试；故意开启/关闭 host 比较可用接口；记录 rustc/cargo 版本。



**验收：** 单元与 compile\_fail 测试通过；无第三方下载依赖；no-default-features 可检查；明确目标固件尚需哪些组件。

 

先预测，再运行



为什么要把算法核心与硬件后端拆开？



```zhizhan-details
{"title":"查看推理","body":"核心可以在主机用大量边界输入验证；后端单独处理时钟、中断和设备生命。这样能区分算法错误、接口错误和平台错误，但仍须做整体验收。"}
```



核对来源：[Rust 官方 Book · 泛型、所有权、错误与并发](https://doc.rust-lang.org/book/)

 





```zhizhan-assessment
{"id":"course-b03a-m12","criterion":"锁定依赖并验证 feature 组合，运行格式/静态检查及公开接口测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
