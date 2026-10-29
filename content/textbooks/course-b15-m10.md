# 技术雷达与选型方法论

```zhizhan-anchor
m10
```



选型方法论： **明确问题 → 收集证据 → 加权评估 → 最小实验 → 迁移/回退成本** 。避免“新技术光环”与“只比参数”。

 

> 前置：理解加权评分与成本模型；有技术选型或方案评审经验。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用加权评分矩阵（迁移成本取负向）产出可复核的选型证据清单。

 

本章速览




- 选型：问题适配→证据→加权→实验→迁移成本。

- 产出是可复核的证据清单。

- 避免热度与均权评分。

 

```zhizhan-anchor
m10-method
```



```zhizhan-anchor
m10-method-t
```



## 10.1 选型方法论五步



明确问题 → 收集证据 → 加权评估 → 最小实验 → 迁移/回退成本。产出是可复核的证据清单，而不是“我觉得它好”。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  选型方法论



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="选型方法论" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">问题适配</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">证据</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">加权</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">实验</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">迁移/回退</text></svg>
```



明确问题（适配）→ 收集证据（成熟度）→ 加权评估（按业务权重）→ 最小实验 → 迁移/回退评估。



表 10.1 选型五维度



| 维度 | 内容 | 要点 |
| --- | --- | --- |
| 问题适配 | 是否解决真问题 | 不被名词带偏 |
| 成熟度 | 生态/案例/维护 | 证据驱动 |
| 加权 | 按业务权重 | 避免均权 |
| 实验 | 最小验证 | 真实数据 |
| 迁移 | 成本/回退 | 单程票风险 |



radar.md 节选Text

 

```text
候选: [A, B]  权重: {成熟度3, 生态3, 性能2, 迁移成本2}
评分: A=22, B=30 (满分50)
结论: B 更优（迁移成本计入负向后 30>22）
适用条件: ...    回退成本: ...
```

可复核证据清单：评分 \+ 适用条件 \+ 回退成本



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：加权评分结论



下面这段程序用加权评分矩阵比较候选技术：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_radar.cC\n\n \n\n```text\n/* host_radar.c —— 技术雷达与选型：加权评分矩阵（主机可运行）。\n * 按权重给候选技术打分，避免“只看热度”。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_radar.c -o host_radar && ./host_radar\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    /* 维度权重: 成熟度/生态/性能/迁移成本(越低越好，取负向) */\n    int w[4] = {3, 3, 2, 2};\n    int A[4] = {4, 4, 3, 4};     /* 技术 A */\n    int B[4] = {5, 3, 5, 2};     /* 技术 B */\n    int sa = 0, sb = 0, tw = 0;\n    for (int i = 0; i < 4; i++) {\n        int sign = (i == 3) ? -1 : 1;   /* 第 4 维“迁移成本”越低越好 */\n        sa += sign * w[i] * A[i];\n        sb += sign * w[i] * B[i];\n        tw += w[i];\n    }\n    printf(\"A=%d B=%d 满分=%d\\n\", sa, sb, tw * 5);\n    if (!(sa == 22 && sb == 30)) ok = 0;   /* A=3*4+3*4+2*3-2*4=22; B=3*5+3*3+2*5-2*2=30 */\n    printf(\"结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡\\n\");\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n加权评分矩阵（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_radar.c -o labs/host_radar && ./labs/host_radar
A=22 B=30 满分=50
结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡
RESULT: PASS
```



权重 {成熟度:3, 生态:3, 性能:2, 迁移成本:2}，单项满分 5、总分 50；迁移成本取负向。



表 10.2 评分权重



| 维度 | 权重 | 说明 |
| --- | --- | --- |
| 成熟度 | 3 | 证据驱动 |
| 生态 | 3 | 资料/社区 |
| 性能 | 2 | 满足即可 |
| 迁移成本 | 2（负向） | 越大越扣分 |



```zhizhan-anchor
m10-evidence2
```



```zhizhan-anchor
m10-evidence2-t
```



## 10.3 可复核的选型证据



选型产出是一份可复核的证据清单：适用/不适用条件、实验数据、迁移与回退成本。



radar.md 节选Text

 

```text
候选: [A, B]  权重: {成熟度3, 生态3, 性能2, 迁移成本2}
评分: A=22, B=30 (满分50)
结论: B 更优（迁移成本计入负向后 30>22）
适用条件: ...    回退成本: ...
```

可复核证据清单：评分 \+ 适用条件 \+ 回退成本



表 10.3 评估报告要素



| 产出 | 内容 | 价值 |
| --- | --- | --- |
| 结论 | 选谁/为什么 | 决策 |
| 适用条件 | 何时适用 | 防误用 |
| 实验数据 | 最小验证 | 可信 |
| 回退成本 | 失败怎么办 | 防单程票 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检与成熟度对照



选型自检：问题明确、证据充分、按业务加权、有实验、评估回退。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  候选加权评分（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="候选加权评分（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">A</text><rect x="150" y="26" width="240" height="18" rx="4" class="sv-amb-s"></rect><text x="398" y="43" class="sv-lbl-hi">22分</text><text x="12" y="67" class="sv-lbl">B</text><rect x="150" y="50" width="327" height="18" rx="4" class="sv-grn-s"></rect><text x="485" y="67" class="sv-lbl-hi">30分</text><text x="12" y="91" class="sv-lbl">满分</text><rect x="150" y="74" width="545" height="18" rx="4" class="sv-box"></rect><text x="703" y="91" class="sv-lbl-hi">50分</text></svg>
```



A=22、B=30（满分 50）；结论量化、可复核，而不是主观。



表 10.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 资料/案例齐 | 可评估 |
| 成长期 | 案例少 | 先实验 |
| 观察期 | 仅热度 | 观察不投产 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **只看热度** ：忽略适配与成熟度。

- **均权评分** ：与业务不符。

- **不做最小实验** ：结论不可靠。

- **低估迁移/回退成本** ：上马难下。



◆ 自测 · Module 10（先答再看）




1. 技术选型为什么一定要评估“迁移与回退成本”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"新技术若失败或不适配，回退代价可能极高（数据/接口/固件已改）。评估回退成本能避免“单程票”决策。"}
   ```

2. 为什么选型“不应该均权评分”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不同维度对业务的重要性不同。均权会让不重要的维度（如纯性能）盖过关键维度（如迁移成本），与业务不符。"}
   ```

3. 为什么选型要做“最小实验”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"资料与案例不能替代真实场景验证。最小实验用真实数据检验适配性，避免“纸上谈兵”的结论。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用加权评分矩阵比较你手上两个候选技术，产出含适用条件与回退成本的评估报告。



核对与延伸：[RISC-V 官方](https://riscv.org/)

 

动手练习



运行 ` labs/host_radar.c `：用加权评分矩阵比较候选技术并给出结论。



**检查结果：** 候选按业务权重评分（迁移成本取负向），A=22、B=30（满分 50）；结论有量化依据并给出适用/不适用条件。

 

迁移练习：把本章的“能用加权评分矩阵（迁移成本取负向）产出可复核的选型证据清单。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m10","criterion":"候选按业务权重评分（迁移成本取负向），A=22、B=30（满分 50）；结论有量化依据并给出适用/不适用条件。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
