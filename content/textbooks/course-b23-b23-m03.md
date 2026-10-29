# B23-M03环形缓冲、滑动窗口与流式算法

```zhizhan-anchor
B23-M03
```



学习范围 · head/tail；满空区分；溢出策略；滚动和；ISR 与任务交接



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="环形缓冲、滑动窗口与流式算法 · 机制路径"><title>环形缓冲、滑动窗口与流式算法 · 机制路径</title><defs><marker id="arrow-B23-M03" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">采样产生数据</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M03)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">环形队列暂存</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M03)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">任务消费与窗口</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M03)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">统计丢样与水位</text></svg>
```



环形缓冲、滑动窗口与流式算法 · 机制路径



采样生产数据，处理任务消费数据，环形缓冲把两者解耦。采用“留一个空槽”的实现时，head==tail 表示空，下一写索引等于 tail 表示满。数组长度 8 只能暂存 7 个元素；容量估计必须使用可用槽数。

 

满时可以拒绝新数据、覆盖最旧数据，或触发降载，但策略必须明确。控制链中丢掉旧数据和丢掉新数据会产生不同的时延。记录丢样计数、队列最高水位和序号差，才能判断后端算得慢还是源头采样不连续。



C · 串行访问示意；完整 push/pop 与边界检查见 algorithms.c



```text
unsigned next = (q->head + 1u) & (CAPACITY - 1u);
if (next == q->tail) return false; /* 满，拒绝写入 */
q->data[q->head] = value;
q->head = next;
```



位与回绕要求 CAPACITY 是 2 的幂。示例只演示串行访问；ISR 与任务共享时，还必须保证数据先写完、索引后发布，以及读取索引和数据之间的顺序。` volatile ` 不能单独保证并发正确性。移植时选择芯片/RTOS 支持的临界区、原子操作或队列，并核对 [DMA](term:dma) 缓存一致性。

 

长度 W 的滑动平均可用 sum←sum−旧值\+新值，每次只做常数次运算；启动时用真实有效样本数做除数。整数累计和要按 W×输入最大值选择位宽，不能先在窄类型里相加后再转换。



**动手练习** 

编译本册 C 实验；检查空读、填满、拒绝第八次写入和反复回绕。再增加计数器观察溢出。

 **检查结果** 

FIFO 顺序正确；满和空的行为可解释；移植方案明确谁修改哪个索引。



核对与延伸：[Linux 内核：环形缓冲区](https://docs.kernel.org/core-api/circular-buffers.html)



```zhizhan-assessment
{"id":"course-b23-b23-m03","criterion":"FIFO 顺序正确；满和空的行为可解释；移植方案明确谁修改哪个索引。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
