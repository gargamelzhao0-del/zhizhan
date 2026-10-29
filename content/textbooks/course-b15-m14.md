# 可信技术评估与迁移项目

```zhizhan-anchor
m14
```



本册收口：对任一专项都走同一套 **可信评估** ：问题适配 → 资料/版本 → 成熟度 → 最小实验 → 迁移/回退成本 → 评估报告。

 

> 前置：读完前述专项中的至少一个；具备方案评审与风险评估经验。 · ◷ 约 44 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能针对任一专项写出含结论/依据/适用条件/风险/回退的可复核评估报告。



```zhizhan-anchor
m14-knowledge-boundary
```



### 专项学习的退出条件



选择一条分支后，交付同需求的基线与专项实现，记录准确度或功能、延迟、内存、功耗、依赖和维护成本。只介绍 ROS 2/FPGA/大模型名词不能验收专项掌握；专项工程另需对应硬件、工具链与任务数据。

 

本章速览




- 任何专项都走同一套可信评估流程。

- 评估报告含结论/依据/适用条件/风险/回退。

- 无需学完所有专项。

 

```zhizhan-anchor
m14-assess
```



```zhizhan-anchor
m14-assess-t
```



## 14.1 可信评估八步



对任一专项都走同一套评估：问题适配 → 资料/版本 → 成熟度 → 最小实验 → 迁移/回退成本 → 评估报告。把“看起来好”变成“有证据的决策”。



```zhizhan-anchor
fig-图-14-1
```



**图 14.1**  可信评估路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="可信评估路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">问题适配</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">资料版本</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">成熟度</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">实验</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">报告</text></svg>
```



问题适配 → 查资料版本 → 评成熟度 → 最小实验 → 迁移/回退成本 → 写评估报告（结论\+条件\+风险）。



表 14.1 评估五步



| 步骤 | 产出 | 证据 |
| --- | --- | --- |
| 问题适配 | 适用/不适用 | 需求对照 |
| 资料 | 版本/来源 | 官方文档 |
| 成熟度 | 案例/维护 | 数据 |
| 实验 | 最小验证 | 实测数据 |
| 迁移 | 成本/回退 | 评估 |



assessment.md 节选Text

 

```text
# 评估: <专项>
- 结论: <采用/观察/不采用> 依据: <资料 + 实验数据>
- 适用条件: <场景/规模/约束>
- 风险: <失败点>   回退: <成本/边界>
- 最小实验: <1 组真实数据>
```

评估报告模板：结论/依据/条件/风险/回退



```zhizhan-anchor
m14-evidence
```



```zhizhan-anchor
m14-evidence-t
```



## 14.2 真实证据：加权评估结论



下面这段程序给出可复核的加权评估结论：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_radar.cC\n\n \n\n```text\n/* host_radar.c —— 技术雷达与选型：加权评分矩阵（主机可运行）。\n * 按权重给候选技术打分，避免“只看热度”。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_radar.c -o host_radar && ./host_radar\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    /* 维度权重: 成熟度/生态/性能/迁移成本(越低越好，取负向) */\n    int w[4] = {3, 3, 2, 2};\n    int A[4] = {4, 4, 3, 4};     /* 技术 A */\n    int B[4] = {5, 3, 5, 2};     /* 技术 B */\n    int sa = 0, sb = 0, tw = 0;\n    for (int i = 0; i < 4; i++) {\n        int sign = (i == 3) ? -1 : 1;   /* 第 4 维“迁移成本”越低越好 */\n        sa += sign * w[i] * A[i];\n        sb += sign * w[i] * B[i];\n        tw += w[i];\n    }\n    printf(\"A=%d B=%d 满分=%d\\n\", sa, sb, tw * 5);\n    if (!(sa == 22 && sb == 30)) ok = 0;   /* A=3*4+3*4+2*3-2*4=22; B=3*5+3*3+2*5-2*2=30 */\n    printf(\"结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡\\n\");\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n加权评估矩阵（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_radar.c -o labs/host_radar && ./labs/host_radar
A=22 B=30 满分=50
结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡
RESULT: PASS
```



加权评分满分 50；迁移成本取负向；结论量化、可复核——这就是“有证据的决策”。



表 14.2 评估报告要素



| 要素 | 内容 | 验收 |
| --- | --- | --- |
| 结论 | 选谁/为什么 | 有依据 |
| 适用条件 | 何时适用 | 写明 |
| 风险 | 可能失败点 | 记录 |
| 回退 | 失败怎么办 | 有边界 |



```zhizhan-anchor
m14-report
```



```zhizhan-anchor
m14-report-t
```



## 14.3 评估报告模板



评估报告要写清：结论、依据、适用条件、风险与回退。缺“适用条件”和“回退”的评估无法支撑可信决策。无需学完所有专项才算合格。



assessment.md 节选Text

 

```text
# 评估: <专项>
- 结论: <采用/观察/不采用> 依据: <资料 + 实验数据>
- 适用条件: <场景/规模/约束>
- 风险: <失败点>   回退: <成本/边界>
- 最小实验: <1 组真实数据>  (评分: A=22, B=30, 满分50)
```

评估报告模板：结论/依据/条件/风险/回退 \+ 实验数据



表 14.3 常见缺失与补齐



| 缺失 | 后果 | 补齐 |
| --- | --- | --- |
| 适用条件 | 被误用到不适配场景 | 写明边界 |
| 回退 | 决策不可逆 | 评估回退成本 |
| 实验数据 | 纸上谈兵 | 最小验证 |
| 依据 | 无法复核 | 资料\+数据 |



```zhizhan-anchor
m14-check
```



```zhizhan-anchor
m14-check-t
```



## 14.4 自检与成熟度对照



评估自检：结论有依据、有适用条件、有风险、有回退、有实验数据。



```zhizhan-anchor
fig-图-14-2
```



**图 14.2**  从“看起来好”到“有证据”



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从“看起来好”到“有证据”" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">热度</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">资料/成熟度</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">实验</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">报告</text></svg>
```



直觉/热度 → 资料\+成熟度 → 最小实验 → 加权评估 → 评估报告（含条件/风险/回退）。



表 14.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 资料/案例充分 | 可决策 |
| 成长期 | 证据不足 | 先实验 |
| 观察期 | 仅热度 | 观察记录 |



```zhizhan-anchor
m14-pitfalls
```



```zhizhan-anchor
m14-pitfalls-t
```



## 14.5 常见误区与排障



失败路径与排障




- **结论无依据** ：无法复核。

- **不写适用条件** ：被误用到不适配场景。

- **无最小实验** ：纸上谈兵。

- **不评估回退** ：决策不可逆。



◆ 自测 · Module 14（先答再看）




1. 一份合格的技术评估报告至少应包含什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"结论、依据（资料与实验）、适用/不适用条件、风险、迁移与回退成本。缺了“适用条件”和“回退”的评估，无法支撑可信决策。"}
   ```

2. 为什么评估必须有“最小实验”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"资料与热度不能替代真实场景验证。最小实验用真实数据检验适配性，避免“纸上谈兵”的结论。"}
   ```

3. 本册的学习目标是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不是学完所有专项，而是掌握一套“可信评估”方法（问题适配→资料→成熟度→实验→迁移/回退→报告），能对任一专项做出有证据的决策。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：选一个你关注的前沿专项，按八步法写一份可信评估报告（含适用条件与回退成本）。



核对与延伸：[RISC-V 官方](https://riscv.org/) · [ISO 26262 / IEC 61508 概述](https://www.iso.org/standard/68383.html)

 

动手练习



运行 ` labs/host_radar.c `（加权评估）；为你的一个专项写一份评估报告（结论\+依据\+条件\+风险）。



**检查结果：** 评估报告含结论/依据/适用条件/风险/回退；有最小实验数据（A=22、B=30、满分 50）；决策可复核。

 

迁移练习：把本章的“能针对任一专项写出含结论/依据/适用条件/风险/回退的可复核评估报告。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 14 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m14","criterion":"评估报告含结论/依据/适用条件/风险/回退；有最小实验数据（A=22、B=30、满分 50）；决策可复核。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
