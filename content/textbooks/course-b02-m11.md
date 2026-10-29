# 驱动库交付与边界验证

```zhizhan-anchor
m11
```



把驱动库接成有明确资源与错误边界的采集应用。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m11-mechanism
```



## 机制与契约



Sampler 通过 Bus 模板接收后端，读取失败时保持样本数不变，固定数组提供四个槽位。MockBus 验证上层契约，目标后端处理真实传输、超时和器件状态。先把驱动读数、缓存、转换与发布分成接口，再把错误向上层传递。容量满的处理政策必须明确，不能静默覆盖还未消费的数据。主机验证后，将同一核心接到现有 minidrv，并构建完整固件。



关键片段 · 完整可运行项目见下方源码



```text
auto reading=bus.read();
if(reading.error!=Error::ok) return reading.error;
// 只有成功才写入数组并更新 count。
```

 

```zhizhan-anchor
m11-boundary
```



## 边界与误用



模板内联、无虚函数或无动态分配都不等于零成本。目标资源验收使用最终链接的 ELF/map、运行栈与实际时序；ISR 与任务共享缓存还需独立同步设计。

 

```zhizhan-anchor
m11-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
g++ -std=c++20 -Wall -Wextra -Werror -O2 labs/driver_contract.cpp -o driver_contract
./driver_contract
```



完整源码：[labs/driver\_contract.cpp](textbook-file:b02/labs/driver_contract.cpp)

 

动手与迁移



运行 driver\_contract.cpp；增加超时错误；接入一个真实 minidrv 后端，保存完整构建命令、map 和失败恢复记录。



**验收：** 总线失败不推进 count；满容量被拒；主机测试通过；目标链接和硬件测量分别留下证据。

 

先预测，再运行



为什么 MockBus 通过后还要上板？



```zhizhan-details
{"title":"查看推理","body":"Mock 固定了输入与错误，验证上层政策。实际总线时序、芯片寄存器、电气条件和中断行为仍可能与假设不符。"}
```



核对来源：[C\+\+ 工作草案 · 生命周期、容器与视图（按 C\+\+20 示例核对）](https://eel.is/c++draft/)

 





```zhizhan-assessment
{"id":"course-b02-m11","criterion":"库由另一工程独立调用；容量、错误传播、视图生命与目标成本都有记录。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
