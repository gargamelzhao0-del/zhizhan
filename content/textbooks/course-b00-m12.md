# 回调、模块接口与综合工程

```zhizhan-anchor
m12
```



交付具有稳定接口、可独立测试的多文件数据工具。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m12-mechanism
```



## 机制与契约



sampler.h 声明接口与数据契约，sampler.c 实现解析和数组，CLI 只负责参数与输出，测试独立验证库。回调用于把遍历与统计策略解耦：库传入 value 和 context，调用者决定如何累计。context 的生命周期必须覆盖整个同步调用，回调不得在遍历中修改数组；否则可能使迭代状态失效。头文件避免定义普通外部函数或私有全局对象，防止重复定义。



关键片段 · 完整可运行项目见下方源码



```text
typedef void (*sample_fn)(int value, void *context);
long double sum = 0;
samples_visit(&s, add, &sum);
```

 

```zhizhan-anchor
m12-boundary
```



## 边界与误用



void\* 是类型契约，不是类型安全。调用者和回调必须约定同一种实际类型。示例库仍暴露布局用于学习；生产接口可使用不透明对象，但需明确对象由谁分配、初始化和释放。

 

```zhizhan-anchor
m12-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
gcc -std=c11 -Wall -Wextra -Werror -O2 labs/sampler.c labs/sampler_test.c -o sampler_test
./sampler_test
gcc -std=c11 -Wall -Wextra -Werror -O2 labs/sampler.c labs/sampler_cli.c -o sampler_cli
./sampler_cli 10 20 30
```



完整源码：[labs/sampler.h](textbook-file:b00/labs/sampler.h) · [labs/sampler.c](textbook-file:b00/labs/sampler.c) · [labs/sampler\_test.c](textbook-file:b00/labs/sampler_test.c) · [labs/sampler\_cli.c](textbook-file:b00/labs/sampler_cli.c)

 

动手与迁移



清洁构建测试与 CLI；添加一个求最大值的回调，不修改 sampler.c。再只编译 CLI，观察缺失实现导致的链接错误。



**验收：** 10 20 30 输出 count=3 mean=20.000；坏输入退出 2；更换统计策略不改库实现；能区分编译错误和链接错误。

 

先预测，再运行



为什么同步回调可以使用局部 context，而异步保存回调时不一定可以？



```zhizhan-details
{"title":"查看推理","body":"同步调用在函数返回前结束，局部对象仍存活。若库保存指针以后调用，局部对象可能已经离开作用域；需要更长生命周期、拥有副本或明确注销与等待结束的协议。"}
```



核对来源：[C11 委员会草案 N1570 · 7.22/7.21](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)

 





```zhizhan-assessment
{"id":"course-b00-m12","criterion":"为回调声明参数生命、上下文与失败策略；替换后端不改变上层测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
