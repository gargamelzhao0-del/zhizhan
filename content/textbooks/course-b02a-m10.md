# 容器、算法与迭代器深化

```zhizhan-anchor
m10
```



依据布局、失效规则和资源上限选择容器与算法。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m10-mechanism
```



## 机制与契约



vector 连续存储，随机访问 O(1)，增长可能重新分配；map 保持有序，unordered\_map 依靠哈希且最坏情况不能按平均 O(1) 承诺。容器选择要同时考虑元素上限、分配、索引需求和迭代器失效。vector 扩容后地址可能变化，即使迭代器看起来仍指向某个数，也不能继续使用。排序后元素位置改变；索引也不等于稳定对象身份。



关键片段 · 完整可运行项目见下方源码



```text
int saved = v[0];  // 保存值，不保存可能失效的地址
v.reserve(100);
v.push_back(4);
std::ranges::sort(v);
```

 

```zhizhan-anchor
m10-boundary
```



## 边界与误用



reserve 只改变容量，不创建可通过下标访问的元素；v\[5\] 在 size=3 时仍越界。unordered\_map 的负载和哈希函数影响时间与内存，不能把常见情况当最坏执行时间。

 

```zhizhan-anchor
m10-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
g++ -std=c++20 -Wall -Wextra -Werror -O2 labs/values.cpp -o values
./values
```



完整源码：[labs/values.cpp](textbook-file:b02a/labs/values.cpp)

 

动手与迁移



将样本保存在 vector 中，比较 reserve 前后 capacity；增加排序和设备 ID 索引。写出每一步哪些引用仍有效。



**验收：** 只访问 size 范围；无失效引用；说明连续性、排序、增长与最坏成本；固定上限方案可解释。

 

先预测，再运行



为什么 reserve(100) 后仍不能直接写 v\[99\]？



```zhizhan-details
{"title":"查看推理","body":"capacity 表示存储容量，size 表示已存在元素数。下标访问要求对象已经存在，应该先 resize 或 push\\_back。"}
```



核对来源：[C\+\+ 工作草案 · 生命周期、容器与视图（按 C\+\+20 示例核对）](https://eel.is/c++draft/)

 





```zhizhan-assessment
{"id":"course-b02a-m10","criterion":"制造扩容导致视图失效的反例，修正对象生命与 span/string_view 接口。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
