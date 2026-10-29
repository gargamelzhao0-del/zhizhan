# B23-M02算法选型：复杂度、内存与最坏耗时

```zhizhan-anchor
B23-M02
```



学习范围 · 复杂度；固定内存；最坏输入；WCET 测量；CPU 与总线预算



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="算法选型：复杂度、内存与最坏耗时 · 机制路径"><title>算法选型：复杂度、内存与最坏耗时 · 机制路径</title><defs><marker id="arrow-B23-M02" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">固定输入上限</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M02)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">估计运算与存储</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M02)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">构造最坏输入</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M02)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">板上测量与余量</text></svg>
```



算法选型：复杂度、内存与最坏耗时 · 机制路径



嵌入式算法不仅要算对，还必须按时算完。O(N) 描述输入增大时的趋势，不等于执行时间。乘法是否有硬件支持、缓存是否命中、[DMA](term:dma) 是否争用总线、任务是否被抢占，都会改变实际延迟。先限制最大输入长度，再给 CPU、RAM 和延迟分配预算。

 

例如 100 Hz 的控制周期是 10 ms。假设采样处理 0.6 ms、控制 0.2 ms、输出 0.1 ms，单次计算总量为 0.9 ms；还需考虑中断、阻塞和调度造成的响应时间。一次平均 0.9 ms 的测量不能证明最坏情况下满足 10 ms。

 

| 任务 | 常见方法 | 工程取舍 |
| --- | --- | --- |
| 滑动平均 | 滚动和，单次 O(1) | 需要窗口存储，和可能溢出 |
| 小窗口中值 | 固定数组排序 | 窗口短时简单；延迟随窗口增大 |
| 查标定表 | 二分 O(log N) 或等距索引 O(1) | 需定义边界、单调性和外插策略 |
| 频谱分析 | FFT，通常 O(N log N) | 需要工作区；块处理增加等待延迟 |

 

主机可用 ` time.perf_counter() ` 比较实现，但它不能代替 MCU 实测。板上用可用的周期计数器或 GPIO 翻转配合逻辑分析仪，记录输入上限、优化级别、时钟与中断负载。没有完整分析覆盖时，测得的最大值应称为“本次测量最大耗时”。



**动手练习** 

对 8、32、128 点窗口比较重算平均与滚动和；先验证结果一致，再测时间和额外内存。

 **检查结果** 

输出长度—耗时—RAM 对照表；包含窗口未满、最大长度和高负载场景。



核对与延伸：[Python：单调计时与性能计数器](https://docs.python.org/3/library/time.html)



```zhizhan-assessment
{"id":"course-b23-b23-m02","criterion":"输出长度—耗时—RAM 对照表；包含窗口未满、最大长度和高负载场景。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
