# 构建、测试与库边界

```zhizhan-anchor
m12
```



声明库边界与构建政策，在干净目录复现测试。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m12-mechanism
```



## 机制与契约



一个可交付库需要公开头文件、实现、测试、工具链标准和配置政策。先把 values.cpp 拆成值类型头文件与测试，再由构建系统生成库目标和测试目标。边界明确是否允许异常、RTTI、动态分配、线程与跨模块拥有对象。对象布局可能随编译器/选项改变，不应把任意 C\+\+ 类当稳定二进制接口。



关键片段 · 完整可运行项目见下方源码



```text
g++ -std=c++20 -Wall -Wextra -Werror -O2 labs/values.cpp -o values
./values
```

 

```zhizhan-anchor
m12-boundary
```



## 边界与误用



主机测试通过不能证明目标镜像资源满足要求。目标链接还需启动文件、链接脚本、运行库和板级初始化；保留 map/size 及构建选项，不把单文件 .o 大小当整镜像开销。

 

```zhizhan-anchor
m12-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
g++ -std=c++20 -Wall -Wextra -Werror -O2 labs/values.cpp -o values
./values
```



完整源码：[labs/values.cpp](textbook-file:b02a/labs/values.cpp)

 

动手与迁移



从只有源码的新目录构建；声明异常/RTTI/分配政策；准备一个 C ABI 的薄接口并规定错误与释放方法。



**验收：** 不依赖个人目录；标准与编译选项明确；测试可重复；主机验证与目标链接/实测分别记录。

 

先预测，再运行



库升级时为什么只保持函数名字不变还不够？



```zhizhan-details
{"title":"查看推理","body":"参数布局、调用约定、异常跨边界、内存分配/释放以及行为契约也属于兼容性；跨版本边界应使用明确的 ABI 和版本政策。"}
```



核对来源：[C\+\+ 工作草案 · 生命周期、容器与视图（按 C\+\+20 示例核对）](https://eel.is/c++draft/)

 





```zhizhan-assessment
{"id":"course-b02a-m12","criterion":"库与调用者独立构建；检查异常/分配/ABI 契约，测试公开接口。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
