# FPGA 与可编程逻辑分支

```zhizhan-anchor
m12
```



FPGA 用 **硬件并行** 换吞吐与确定性，适合“高吞吐/低抖动/定制接口”。代价是 **开发与验证成本** 高。

 

> 前置：了解数字逻辑与时钟/时序概念；有硬件描述语言或 C 优化经验。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能判断场景是否值得用 FPGA 并明确 CPU/FPGA 分工与接口握手。

 

本章速览




- FPGA 用并行换吞吐，代价是开发验证成本。

- 先仿真再板级，接口要握手。

- 不是所有计算都值得 FPGA。

 

```zhizhan-anchor
m12-fpga
```



```zhizhan-anchor
m12-fpga-t
```



## 12.1 用硬件并行换确定性



FPGA 适合高吞吐、确定性低抖动、定制高速接口。代价是开发与验证成本高。不是所有计算都值得用 FPGA——若 MCU/DSP 能满足，通常不划算。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  FPGA 开发流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="FPGA 开发流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">HDL</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">仿真</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">综合/约束</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">板级</text></svg>
```



设计 HDL → 仿真验证 → 综合 → 时序约束（建立/保持）→ 板级调试。跳过仿真会板级调不完。



表 12.1 FPGA 五概念



| 概念 | 内容 | 注意 |
| --- | --- | --- |
| HDL | Verilog/VHDL | 可综合/不可综合 |
| 仿真 | 功能验证 | 覆盖率 |
| 时序 | 时钟/约束 | 建立/保持 |
| 接口 | 并行/高速 | 握手与缓冲 |
| 分工 | CPU 控制 \+ FPGA 流水 | 边界清晰 |



interface.txt 节选Text

 

```text
CPU: 配置/控制（慢）    FPGA: 流水/并行（快）
接口: ready/valid 握手 + FIFO 缓冲 + 时钟域处理
决策: 需要极高吞吐/确定性低抖动才用 FPGA
```

分工写清接口握手；只在必要场景用 FPGA



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：分工与并行收益（类比）



FPGA 的价值是并行。用任务并行模型类比“分工 \+ 并行缩短时间”：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_hetero.cC\n\n \n\n```text\n/* host_hetero.c —— 异构多核/加速器：任务分配与负载均衡（主机可运行）。\n * 把任务按成本分配到能力不同的核/加速器，最小化最大完成时间（简化贪心）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hetero.c -o host_hetero && ./host_hetero\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int cost[] = {5, 3, 4, 2};              /* 4 个任务成本 */\n    int n = 4, core[2] = {0, 0};            /* 2 个核负载 */\n    for (int i = 0; i < n; i++) core[core[0] <= core[1] ? 0 : 1] += cost[i];   /* 贪心分给较空核 */\n    int makespan = core[0] > core[1] ? core[0] : core[1];\n    printf(\"负载 核0=%d 核1=%d makespan=%d\\n\", core[0], core[1], makespan);\n    if (makespan != 7) ok = 0;              /* 5+2=7 与 3+4=7 */\n    printf(\"较单核总成本=%d 缩短=%d%%\\n\", 14, (14-makespan)*100/14);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n并行/分工收益模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_hetero.c -o labs/host_hetero && ./labs/host_hetero
负载 核0=7 核1=7 makespan=7
较单核总成本=14 缩短=50%
RESULT: PASS
```



并行把 makespan 从 14 降到 7（缩短 50%）——这正是 FPGA 流水/并行的价值模型（类比）。



表 12.2 FPGA 判据



| 判据 | 阈值 | 说明 |
| --- | --- | --- |
| 建立裕量 | ≥0 | 时序满足 |
| 保持裕量 | ≥0 | 时序满足 |
| 接口 | ready/valid | 握手防丢 |
| 并行收益 | 缩短时间 | 值不值得 |



```zhizhan-anchor
m12-decide
```



```zhizhan-anchor
m12-decide-t
```



## 12.3 值不值得用 FPGA



先做仿真再做板级；CPU 与 FPGA 的分工要在接口上写清（握手、缓冲、时序）。若 MCU/DSP 能满足，FPGA 的开发与验证成本通常不划算。



interface.txt 节选Text

 

```text
CPU: 配置/控制（慢）    FPGA: 流水/并行（快）
接口: ready/valid 握手 + FIFO 缓冲 + 时钟域处理
决策: 需要极高吞吐/确定性低抖动/定制高速接口 才用 FPGA
```

分工写清接口握手；只在必要场景用 FPGA



表 12.3 是否用 FPGA



| 场景 | 用 FPGA? | 理由 |
| --- | --- | --- |
| 高吞吐/低抖动 | 是 | 软件达不到 |
| 定制高速接口 | 是 | 硬件实现 |
| 普通控制 | 否 | MCU/DSP 够 |
| 算法固定 | 看情况 | 成本/收益 |



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 自检与成熟度对照



FPGA 自检：仿真通过、时序满足、接口有握手、分工清晰。



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  并行收益（类比）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="并行收益（类比）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">单核</text><rect x="150" y="26" width="560" height="18" rx="4" class="sv-amb-s"></rect><text x="718" y="43" class="sv-lbl-hi">14时间单位</text><text x="12" y="67" class="sv-lbl">并行 makespan</text><rect x="150" y="50" width="280" height="18" rx="4" class="sv-grn-s"></rect><text x="438" y="67" class="sv-lbl-hi">7时间单位</text></svg>
```



单核总成本 14；并行后 makespan=7，缩短 50%——这是 FPGA 并行价值的类比。



表 12.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 成熟器件\+工具链 | 可用 |
| 成长期 | 开发成本高 | 关键场景 |
| 观察期 | 能力/成本不匹配 | 慎用 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **跳过仿真** ：板级调不完。

- **时序约束缺失** ：偶发亚稳态。

- **接口无握手** ：丢数据。

- **为 FPGA 而 FPGA** ：成本远超收益。



◆ 自测 · Module 12（先答再看）




1. 什么场景值得用 FPGA 而不是 MCU？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"需要极高吞吐、确定性低抖动或定制高速接口，且软件方案达不到时。若普通 MCU/DSP 能满足，FPGA 的开发与验证成本通常不划算。"}
   ```

2. 为什么 FPGA 项目“先仿真后板级”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"板级调试周期长、成本高。仿真能提前发现功能与时序问题，跳过仿真会导致板级调不完。"}
   ```

3. CPU 与 FPGA 的分工要在哪里“写清”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"在接口上：握手（ready/valid）、缓冲（FIFO）、时钟域处理与时序。边界清晰才能正确协同。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你场景判断是否值得用 FPGA，并写清 CPU/FPGA 分工与接口握手协议。



核对与延伸：[RISC-V 官方](https://riscv.org/)

 

动手练习



运行 ` labs/host_hetero.c `（分工与并行思路）；为场景判断是否值得用 FPGA。



**检查结果：** 仿真通过且时序满足（建立/保持裕量≥0）；CPU/FPGA 分工与接口清晰；并行收益对照 makespan=7、缩短 50%。

 

迁移练习：把本章的“能判断场景是否值得用 FPGA 并明确 CPU/FPGA 分工与接口握手。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m12","criterion":"仿真通过且时序满足（建立/保持裕量≥0）；CPU/FPGA 分工与接口清晰；并行收益对照 makespan=7、缩短 50%。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
