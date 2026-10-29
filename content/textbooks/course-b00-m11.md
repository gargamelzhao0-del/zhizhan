# 动态内存与对象生命周期

```zhizhan-anchor
m11
```



管理动态数组的容量与[所有权](term:ownership)，分配失败后仍保留有效状态。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）



扩容：失败保持旧对象，成功才提交新状态



```zhizhan-figure
<svg viewBox="0 0 800 190" role="img" aria-label="扩容：失败保持旧对象，成功才提交新状态"><title>扩容：失败保持旧对象，成功才提交新状态</title><defs><marker id="mastery-arrow-c-memory" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="currentColor"></path></marker></defs><rect x="10" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="132.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">原对象</text><text x="132.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">size=4 / capacity=4</text><text x="132.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">data拥有原分配块</text><text x="132.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">请求第5个元素</text><path d="M257 92H272" stroke="currentColor" marker-end="url(#mastery-arrow-c-memory)"></path><rect x="275" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="397.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">尝试扩容</text><text x="397.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">先检查容量乘法</text><text x="397.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">临时指针接返回值</text><text x="397.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">成功前不改对象</text><path d="M522 92H537" stroke="currentColor" marker-end="url(#mastery-arrow-c-memory)"></path><rect x="540" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="662.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">分支验收</text><text x="662.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">NULL：旧对象仍有效</text><text x="662.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">成功：提交并写第5个</text><text x="662.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">重分配后旧别名失效</text></svg>
```



状态图是接口示意。分配失败和成功扩容由 sampler\_test.c 注入与验收；size 与 capacity 不混用。

 

```zhizhan-anchor
m11-mechanism
```



## 机制与契约



size 是已初始化元素数，capacity 是可用存储槽数，data 是唯一拥有的分配块。扩容先检查容量乘法是否溢出，再把 realloc 返回值放入临时指针。成功后同时提交指针与容量；失败保留旧块、旧 size 和旧 capacity。扩容可能移动存储，所以旧元素指针不能继续使用。清理函数归还所有权并重置对象，避免再次释放旧地址。实验注入一次分配失败，以验证程序能继续扩容。



关键片段 · 完整可运行项目见下方源码



```text
int *next = s->resize(s->data, bytes);
if (!next) return 0; /* 旧对象不变 */
s->data = next;
s->capacity = new_capacity;
```

 

```zhizhan-anchor
m11-boundary
```



## 边界与误用



直接 data=realloc(data,n) 会在失败时丢失旧指针；先窄类型相乘再转 size\_t 无法修复溢出。示例分配器必须与 free 兼容。该主机实现不提供线程安全，也不承诺 MCU 的确定性分配耗时；硬实时路径优先考虑固定容量。

 

```zhizhan-anchor
m11-run
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



读 sampler\_test.c 的两次失败注入：第一次分配失败、已有四个元素后扩容失败。增加多次扩容、空对象释放和满容量测试。



**验收：** 失败后旧指针、内容、size/capacity 保持不变；后续正常 push 可成功；销毁后对象为空。

 

先预测，再运行



扩容失败后，为什么不能把 size 提前加一？



```zhizhan-details
{"title":"查看推理","body":"size 是可访问的已初始化元素数。提前增加会让遍历进入没有存储或没有初始化的槽位；写入与 size 更新应在扩容成功之后。"}
```



核对来源：[C11 委员会草案 N1570 · 7.22/7.21](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)

 





```zhizhan-assessment
{"id":"course-b00-m11","criterion":"为分配失败写测试；realloc 失败后原指针仍可释放，没有泄漏或重复释放。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
