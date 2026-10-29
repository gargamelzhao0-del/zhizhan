# 端侧大模型与多模态分支

```zhizhan-anchor
m13
```



端侧大模型/多模态把生成式能力放到设备，但仍受 **内存/算力/功耗** 限制。现实路线是“ **小模型基线 \+ 蒸馏/量化 \+ 任务特化** ”。

 

> 前置：了解神经网络推理与量化基础；有内存/算力预算评估经验。 · ◷ 约 44 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能在端侧建立小模型基线并评估量化/蒸馏后的资源与质量权衡。

 

本章速览




- 端侧大模型受内存/算力/功耗限制。

- 先建小模型基线，再蒸馏/量化。

- 严格测资源与质量。

 

```zhizhan-anchor
m13-llm
```



```zhizhan-anchor
m13-llm-t
```



## 13.1 先问“真的需要大模型吗”



端侧大模型受内存/算力/功耗限制。很多端侧任务用小模型/传统方法即可；需要时再上蒸馏/量化，并严格测资源与质量。



```zhizhan-anchor
fig-图-13-1
```



**图 13.1**  端侧大模型的三重预算



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="端侧大模型的三重预算" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">内存预算：模型≤RAM 50%</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">算力预算：TOPS</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">功耗预算：续航</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">质量：量化/蒸馏后损失可接受</text></svg>
```



内存（模型≤设备 RAM 50%）\+ 算力（TOPS）\+ 功耗。任一超限就不可行。



表 13.1 端侧大模型维度



| 维度 | 手段 | 代价 |
| --- | --- | --- |
| 内存 | 量化/蒸馏 | 能力下降 |
| 算力 | 加速器/裁剪 | 兼容性 |
| 输入 | 流式/分块 | 延迟 |
| 隐私 | 本地处理 | 资源 |
| 基线 | 小模型先跑 | 可能够用 |



tinyllm.py 节选Python

 

```text
base = small_model_baseline(task)      # 先基线
if base_ok(base): ship(base)            # 够用就别上大模型
else: q = quantize(distill(big), int8)  # 蒸馏+量化
# 严格测资源(内存≤RAM 50%)与质量(损失≤2%)
```

小模型基线先行；不够再蒸馏/量化并测资源质量



```zhizhan-anchor
m13-evidence
```



```zhizhan-anchor
m13-evidence-t
```



## 13.2 真实证据：资源预算（类比）



资源分配模型类比“模型必须放得进设备预算”：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_hetero.cC\n\n \n\n```text\n/* host_hetero.c —— 异构多核/加速器：任务分配与负载均衡（主机可运行）。\n * 把任务按成本分配到能力不同的核/加速器，最小化最大完成时间（简化贪心）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hetero.c -o host_hetero && ./host_hetero\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int cost[] = {5, 3, 4, 2};              /* 4 个任务成本 */\n    int n = 4, core[2] = {0, 0};            /* 2 个核负载 */\n    for (int i = 0; i < n; i++) core[core[0] <= core[1] ? 0 : 1] += cost[i];   /* 贪心分给较空核 */\n    int makespan = core[0] > core[1] ? core[0] : core[1];\n    printf(\"负载 核0=%d 核1=%d makespan=%d\\n\", core[0], core[1], makespan);\n    if (makespan != 7) ok = 0;              /* 5+2=7 与 3+4=7 */\n    printf(\"较单核总成本=%d 缩短=%d%%\\n\", 14, (14-makespan)*100/14);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n资源分配模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_hetero.c -o labs/host_hetero && ./labs/host_hetero
负载 核0=7 核1=7 makespan=7
较单核总成本=14 缩短=50%
RESULT: PASS
```



以 M06 的资源分配做类比，说明“模型/任务必须放进设备预算”；非端侧大模型专属实验。



表 13.2 端侧预算判据



| 预算 | 阈值 | 说明 |
| --- | --- | --- |
| 内存 | ≤RAM 50% | 模型上限 |
| 算力 | TOPS | 推理时间 |
| 质量损失 | ≤2% | 量化/蒸馏 |
| 延迟 | ≤截止期 | 流式/分块 |



```zhizhan-anchor
m13-small
```



```zhizhan-anchor
m13-small-t
```



## 13.3 小模型基线与压缩



先建小模型/传统方法基线；只有基线不够且资源允许时，才考虑蒸馏/量化的大模型方案。隐私敏感数据尽量本地处理。



tinyllm.py 节选Python

 

```text
base = small_model_baseline(task)      # 先基线
if base_ok(base): ship(base)            # 够用就别上大模型
else: q = quantize(distill(big), int8)  # 蒸馏+量化
# 严格测资源（内存≤RAM 50%）与质量（损失≤2%）
```

小模型基线先行；不够再蒸馏/量化，并测资源与质量



表 13.3 端侧落地步骤



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 基线 | 小模型/传统 | 直接上大模型 |
| 压缩 | 蒸馏/量化 | 不测质量 |
| 流式 | 分块输入 | 一次性加载超内存 |
| 隐私 | 本地处理 | 敏感数据上云 |



```zhizhan-anchor
m13-check
```



```zhizhan-anchor
m13-check-t
```



## 13.4 自检与成熟度对照



端侧大模型自检：有基线、预算明确、压缩后质量可接受、隐私本地化。



```zhizhan-anchor
fig-图-13-2
```



**图 13.2**  小模型 vs 大模型（资源/质量示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="小模型 vs 大模型（资源/质量示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">小模型</text><rect x="150" y="26" width="200" height="18" rx="4" class="sv-grn-s"></rect><text x="358" y="43" class="sv-lbl-hi">20%RAM</text><text x="12" y="67" class="sv-lbl">大模型(压缩)</text><rect x="150" y="50" width="500" height="18" rx="4" class="sv-amb-s"></rect><text x="658" y="67" class="sv-lbl-hi">50%RAM</text><text x="12" y="91" class="sv-lbl">预算线</text><rect x="150" y="74" width="500" height="18" rx="4" class="sv-red-s"></rect><text x="658" y="91" class="sv-lbl-hi">50%RAM</text></svg>
```



小模型资源占用低、可能已够用；大模型质量更高但超预算。按预算取含。



表 13.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 小模型/传统方法 | 首选 |
| 成长期 | 端侧小 LLM | 试点 |
| 观察期 | 端侧大 LLM | 跟踪 |



```zhizhan-anchor
m13-pitfalls
```



```zhizhan-anchor
m13-pitfalls-t
```



## 13.5 常见误区与排障



失败路径与排障




- **直接上大模型** ：资源不够。

- **无小模型基线** ：不知道是否值得。

- **量化后不测质量** ：任务退化。

- **隐私数据上云** ：合规风险。



◆ 自测 · Module 13（先答再看）




1. 端侧用大模型前最该先做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先确认任务是否真的需要，并建立小模型/传统方法基线；只有基线不够且资源允许时，才考虑蒸馏/量化的大模型方案。"}
   ```

2. 为什么端侧大模型要设“内存上限 50% RAM”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型与运行时占用内存，还要留出系统/缓冲空间。超过一半会把系统挤爆（OOM），所以设上限并据此选压缩方案。"}
   ```

3. 量化后为什么必须“测质量”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"量化会带来能力下降。必须在任务指标上测损失（目标≤2%），否则“能跑”但“没用”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的端侧任务建一个小模型基线并对比大模型方案的资源/质量，给出取舍结论。



核对与延伸：[LiteRT 微控制器](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_hetero.c `（资源分配）；比较小模型基线与大模型方案的资源/质量。



**检查结果：** 资源预算明确（模型≤设备 RAM 的 50%）；有小模型基线；量化/蒸馏后质量损失可接受、隐私本地化。

 

迁移练习：把本章的“能在端侧建立小模型基线并评估量化/蒸馏后的资源与质量权衡。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 13 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m13","criterion":"资源预算明确（模型≤设备 RAM 的 50%）；有小模型基线；量化/蒸馏后质量损失可接受、隐私本地化。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
