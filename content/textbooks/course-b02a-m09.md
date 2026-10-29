# 对象生命周期与值语义深化

```zhizhan-anchor
m09
```



解释复制、移动和销毁，设计不会共享悬空资源的值类型。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m09-mechanism
```



## 机制与契约



值语义要求复制后的对象可以独立使用。Buffer 拥有 unique\_ptr 指向的数组，复制构造分配新块并复制元素；移动转移[所有权](term:ownership)并把源长度置零。赋值按值接收临时对象，再交换：参数复制若失败，目标还未变化；交换和移动应满足 noexcept 承诺。多数实际类优先用 vector/string 实现规则零，只有确实管理独特资源时才手写特殊成员。



关键片段 · 完整可运行项目见下方源码



```text
Buffer(const Buffer& b) : Buffer(b.n_) { /* 深复制 */ }
Buffer& operator=(Buffer b) noexcept { swap(b); return *this; }
```

 

```zhizhan-anchor
m09-boundary
```



## 边界与误用



复制一个裸指针不会复制它拥有的对象，会造成共享修改或重复释放。std::move 只是允许选择移动重载，不保证所有类型都会便宜地移动。移动后的标准库对象通常只保证有效状态，不能统一假设为空；本例置零是本例明示的契约。

 

```zhizhan-anchor
m09-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
g++ -std=c++20 -Wall -Wextra -Werror -O2 labs/values.cpp -o values
./values
```



完整源码：[labs/values.cpp](textbook-file:b02a/labs/values.cpp)

 

动手与迁移



运行复制、移动、自赋值测试；修改副本观察原对象。说明复制期间分配失败发生在哪一步、目标为何仍可用。



**验收：** 副本修改不影响原对象；自赋值正确；本例移动源为空且可销毁；能解释异常安全与 noexcept 边界。

 

先预测，再运行



按值赋值为什么能处理自赋值？



```zhizhan-details
{"title":"查看推理","body":"实参先成为独立的临时对象，再交换资源。交换后临时对象释放旧资源；没有先释放原对象再从已释放资源复制的顺序问题。"}
```



核对来源：[C\+\+ 工作草案 · 生命周期、容器与视图（按 C\+\+20 示例核对）](https://eel.is/c++draft/)

 





```zhizhan-assessment
{"id":"course-b02a-m09","criterion":"测试复制、移动、自赋值与移动后契约，记录构造/析构次数。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
