# 异构多核与加速器协同

```zhizhan-anchor
m06
```



异构系统把任务按“ **最适合的单元** ”分配：CPU 管控制、DSP/NPU 管计算、FPGA 管流水。瓶颈往往是 **数据搬运** 与同步。

 

> 前置：了解 CPU/DSP/NPU/FPGA 架构差异；有任务调度与内存带宽概念。 · ◷ 约 44 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按算力特性分配任务、最小化 makespan 并识别数据搬运瓶颈。

 

本章速览




- 异构按“最适合的单元”分配任务。

- 瓶颈常在数据搬运，尽量零拷贝。

- 同步与一致性要明确。

 

```zhizhan-anchor
m06-hetero
```



```zhizhan-anchor
m06-hetero-t
```



## 6.1 按最适合的单元分工



CPU 管控制/逻辑、DSP 管信号处理、NPU 管定点推理、FPGA 管流水/并行。协同设计要点：任务分配均衡（最小化 makespan）、减少跨单元拷贝、明确同步与一致性。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  异构单元的分工



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="异构单元的分工" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">CPU：控制/逻辑</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">DSP：信号处理</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">NPU：定点推理</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-vio-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">FPGA：流水/并行</text></svg>
```



控制/逻辑 → CPU；信号 → DSP；推理 → NPU；流水/并行 → FPGA。瓶颈常在搬运与同步。



表 6.1 异构单元分工



| 单元 | 擅长 | 注意 |
| --- | --- | --- |
| CPU | 控制/逻辑 | 算力有限 |
| DSP | 信号处理 | 编程复杂 |
| NPU | 定点推理 | 算子/量化约束 |
| FPGA | 流水/并行 | 开发成本 |
| 搬运 | 零拷贝/共享 | 带宽与一致性 |



hetero.c 节选C

 

```text
assign_greedy(tasks, cost, 2);      // 均衡分配，最小化 makespan
shared_buf = map_zero_copy(dev);   // 零拷贝/共享缓冲
dma_run(dev, shared_buf); wait_and_sync(dev);  // 同步后再读
```

均衡分配 \+ 零拷贝 \+ 同步后读结果



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：任务分配与 makespan



下面这段程序贪心分配任务到两核并计算 makespan：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_hetero.cC\n\n \n\n```text\n/* host_hetero.c —— 异构多核/加速器：任务分配与负载均衡（主机可运行）。\n * 把任务按成本分配到能力不同的核/加速器，最小化最大完成时间（简化贪心）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hetero.c -o host_hetero && ./host_hetero\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int cost[] = {5, 3, 4, 2};              /* 4 个任务成本 */\n    int n = 4, core[2] = {0, 0};            /* 2 个核负载 */\n    for (int i = 0; i < n; i++) core[core[0] <= core[1] ? 0 : 1] += cost[i];   /* 贪心分给较空核 */\n    int makespan = core[0] > core[1] ? core[0] : core[1];\n    printf(\"负载 核0=%d 核1=%d makespan=%d\\n\", core[0], core[1], makespan);\n    if (makespan != 7) ok = 0;              /* 5+2=7 与 3+4=7 */\n    printf(\"较单核总成本=%d 缩短=%d%%\\n\", 14, (14-makespan)*100/14);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n异构任务分配模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_hetero.c -o labs/host_hetero && ./labs/host_hetero
负载 核0=7 核1=7 makespan=7
较单核总成本=14 缩短=50%
RESULT: PASS
```



任务成本 5,3,4,2；单核总 14，双核均衡后 makespan=7，缩短 50%。



表 6.2 分配结果



| 量 | 值 | 含义 |
| --- | --- | --- |
| 单核总成本 | 14 | 串行总和 |
| 核0/核1 | 7/7 | 均衡 |
| makespan | 7 | 完工时间 |
| 加速 | 50% | 相对单核 |



```zhizhan-anchor
m06-copy
```



```zhizhan-anchor
m06-copy-t
```



## 6.3 数据搬运与同步



跨单元搬数据要走总线/内存，带宽有限且与计算争用；拷贝时间可能超过计算时间。用零拷贝/共享缓冲，并明确同步与内存一致性。



hetero.c 节选C

 

```text
assign_greedy(tasks, cost, 2);      // 均衡分配，最小化 makespan
shared_buf = map_zero_copy(dev);   // 零拷贝/共享缓冲
dma_run(dev, shared_buf);
wait_and_sync(dev);                 // 同步后再读结果
```

均衡分配 \+ 零拷贝 \+ 同步后读结果



表 6.3 瓶颈与对策



| 瓶颈 | 后果 | 对策 |
| --- | --- | --- |
| 分配不均 | 一个忙一个闲 | 贪心/负载均衡 |
| 拷贝 | 带宽耗尽 | 零拷贝/共享 |
| 同步错 | 读到未完成 | 事件/屏障 |
| 一致性 | cache 旧值 | clean/invalidate |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与成熟度对照



异构自检：分配均衡、搬运优化、同步与一致性明确。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  单核 vs 双核（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="单核 vs 双核（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">单核</text><rect x="150" y="26" width="560" height="18" rx="4" class="sv-amb-s"></rect><text x="718" y="43" class="sv-lbl-hi">14时间单位</text><text x="12" y="67" class="sv-lbl">双核 makespan</text><rect x="150" y="50" width="280" height="18" rx="4" class="sv-grn-s"></rect><text x="438" y="67" class="sv-lbl-hi">7时间单位</text></svg>
```



单核总成本 14；双核均衡后 makespan=7，缩短 50%。



表 6.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 多核 MCU/DSP 成熟 | 可用 |
| 成长期 | NPU 生态推进 | 试点 |
| 观察期 | 工具链不足 | 跟踪 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **分配不均** ：一个单元忙死，其它闲。

- **拷贝成瓶颈** ：带宽被搬数据占满。

- **同步错** ：读到未完成结果。

- **忽略一致性** ：cache 不一致。



◆ 自测 · Module 06（先答再看）




1. 异构系统里为什么“数据搬运”常被低估？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"跨单元搬数据要走总线/内存，带宽有限且与计算争用；拷贝时间可能超过计算时间。零拷贝/共享缓冲是关键优化。"}
   ```

2. 为什么任务分配要“均衡”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"makespan 由最忙的单元决定。分配不均会让一个单元忙、其它闲，整体完工时间变长。"}
   ```

3. 跨单元协作为什么要显式“同步”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"单元之间异步执行；不同步就可能在结果未完成时去读，或读到 cache 旧值。用事件/屏障/一致性维护保证正确。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你异构系统分配任务并计算 makespan，识别搬运瓶颈并改用零拷贝/共享缓冲。



核对与延伸：[RISC-V 官方](https://riscv.org/)

 

动手练习



运行 ` labs/host_hetero.c `：贪心分配任务到两核并计算 makespan。



**检查结果：** 分配后核0=7、核1=7、makespan=7；较单核总成本 14 缩短 50%。

 

迁移练习：把本章的“能按算力特性分配任务、最小化 makespan 并识别数据搬运瓶颈。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m06","criterion":"分配后核0=7、核1=7、makespan=7；较单核总成本 14 缩短 50%。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
