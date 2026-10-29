# 实践设计：IMU 异常检测

```zhizhan-anchor
m10
```



IMU 异常检测是端侧 AI 的经典综合题： **分窗 → 提特征 → 基线/模型 → 阈值 → 评估 → 部署** 。先做阈值基线，再决定是否上模型。

 

> 前置：Module 04 的会话切分与 Module 08 的指标。 · ◷ 约 46 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能先做阈值基线再用模型完成 IMU 异常检测，并按会话隔离评估漏报/误报。

 

本章速览




- IMU 异常检测先做阈值基线。

- 分窗/特征口径一致。

- 按会话隔离评估，报告漏报/误报。

 

```zhizhan-anchor
m10-pipe
```



```zhizhan-anchor
m10-pipe-t
```



## 10.1 IMU 异常检测流水线



分窗 → 提特征 → 阈值基线/模型 → 阈值 → 评估 → 部署。先做阈值基线，判断模型是否值得。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  IMU 异常检测流水线



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="IMU 异常检测流水线" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">分窗</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">提特征</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">基线/模型</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">评估/部署</text></svg>
```



IMU 采样 → 分窗 → 时域特征 → 阈值基线 → （必要时）模型 → 阈值 → 评估/部署。



表 10.1 流水线与验收



| 步骤 | 产出 | 验收 |
| --- | --- | --- |
| 分窗 | 固定窗 \+ 重叠 | 边界一致 |
| 特征 | 时域/频域 | 口径一致 |
| 基线 | 阈值/统计 | 可对比 |
| 模型 | 分类/重构 | 指标达标 |
| 评估 | 混淆矩阵 | 漏报/误报可解释 |



imu.py 节选Python

 

```text
Xw = windowize(imu, WIN, HOP)
F = features(Xw)                          # 与训练同口径
base = threshold_baseline(F_tr)           # 先基线
report(f1(train(F_tr), F_te), fn_rate, fp_rate)
```

IMU：分窗→特征→基线→模型→独立测试集评估



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 指标计算示例与证据边界



这里输入的是手工给定的 TP=40、FP=10、FN=5、TN=45，只验证指标公式；它不是采集、训练和部署完成后的 IMU 实测结果。完整训练与运行时流程可先复现 [P05 端侧 AI 项目](doc:course-projects#P05)，再替换为自己的会话数据：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_metrics.cC\n\n \n\n```text\n/* host_metrics.c —— 分类指标：混淆矩阵 → precision/recall/F1（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_metrics.c -o host_metrics && ./host_metrics\n */\n#include <stdio.h>\n#include <math.h>\nint main(void) {\n    int ok = 1;\n    /* TP=40 FP=10 FN=5 TN=45 */\n    int TP=40, FP=10, FN=5, TN=45;\n    float prec = (float)TP/(TP+FP);\n    float rec = (float)TP/(TP+FN);\n    float f1 = 2*prec*rec/(prec+rec);\n    float acc = (float)(TP+TN)/(TP+FP+FN+TN);\n    printf(\"precision=%.3f recall=%.3f F1=%.3f acc=%.3f\\n\", prec, rec, f1, acc);\n    if (fabsf(prec-0.8f) > 1e-3 || fabsf(rec-0.8889f) > 1e-3) ok = 0;\n    if (fabsf(f1-0.8421f) > 1e-3 || fabsf(acc-0.85f) > 1e-3) ok = 0;\n    printf(\"漏报率(FN rate)=%.3f 误报率(FP rate)=%.3f（按业务权衡阈值）\\n\", (float)FN/(TP+FN), (float)FP/(FP+TN));\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n分类指标模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_metrics.c -o labs/host_metrics && ./labs/host_metrics
precision=0.800 recall=0.889 F1=0.842 acc=0.850
漏报率(FN rate)=0.111 误报率(FP rate)=0.182（按业务权衡阈值）
RESULT: PASS
```



F1=0.842、漏报率 0.111 来自上述假设计数，只用于检验公式。真实数据须先冻结切分与验收条件，再运行基线/模型比较。



表 10.2 假设混淆矩阵的计算结果



| 评估项 | 值 | 说明 |
| --- | --- | --- |
| F1 | 0.842 | 综合指标 |
| 漏报率 | 0.111 | 安全优先 |
| 误报率 | 0.182 | 打扰代价 |
| 切分 | 此公式实验未加载数据 | 真实项目需按会话记录切分清单 |



```zhizhan-anchor
m10-deploy
```



```zhizhan-anchor
m10-deploy-t
```



## 10.3 部署与对拍



部署后与离线结果对拍，确认量化/预处理没有引入偏差；测试集按会话隔离，防止泄漏。



imu\_eval.py 节选Python

 

```text
Xw = windowize(imu, WIN, HOP)          # 分窗
F  = features(Xw)                       # 与训练同口径
base = threshold_baseline(F_tr);        # 先基线
model = train(F_tr); qm = quantize(model)
report(f1(qm, F_te), fn_rate, fp_rate)  # 独立测试集
```

基线→模型→量化→独立测试集评估，口径一致



表 10.3 部署后检查



| 部署后检查 | 方法 | 通过标准 |
| --- | --- | --- |
| 对拍 | 离线 vs 设备端 | 差异可解释 |
| 量化偏差 | 量化前后指标 | 回退≤阈值 |
| 延迟 | 端到端 | ≤ 截止期 |
| 稳定性 | 长跑 | 无退化 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检与三级对照



实战自检：基线先行、会话隔离、报漏报/误报、部署对拍。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  基线 vs 模型（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="基线 vs 模型（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">阈值基线</text><rect x="150" y="26" width="420" height="18" rx="4" class="sv-amb-s"></rect><text x="578" y="43" class="sv-lbl-hi">70F1×100</text><text x="12" y="67" class="sv-lbl">模型</text><rect x="150" y="50" width="504" height="18" rx="4" class="sv-grn-s"></rect><text x="662" y="67" class="sv-lbl-hi">84F1×100</text></svg>
```



基线给参照；模型应带来明显提升（否则不值得上）。示例 F1：基线 0.70 → 模型 0.842。



表 10.4 三级实现



| 层级 | 实现 | 注意 |
| --- | --- | --- |
| MCU 端 | 阈值/小模型 | 延迟/内存 |
| Linux 边缘 | 较大模型 | 算力 |
| 云/训练 | 训练/重训 | 数据版本 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **无基线直接上模型** ：无法判断模型价值。

- **随机切分** ：指标虚高。

- **不报漏报/误报** ：无法按业务调阈值。

- **部署后不对拍** ：量化偏差未发现。



◆ 自测 · Module 10（先答再看）




1. 为什么 IMU 异常检测要先做“阈值基线”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"阈值基线简单、可解释、成本低；它给出参照，能判断模型是否真的带来提升，也可能本身就满足需求（无需上模型）。"}
   ```

2. 为什么评估要按会话隔离？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"同一会话的 IMU 样本高度相关；不隔离会让同源样本跨 train/test，指标虚高、上线落差大。"}
   ```

3. 部署后为什么要与离线结果对拍？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"量化、算子近似、预处理差异会让设备端指标低于离线。对拍能定位偏差来源，确认真正可用。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对一段 IMU 数据先做阈值基线、再上模型，按会话隔离评估，并报告漏报/误报与延迟。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_metrics.c `：用混淆矩阵分析误报/漏报；设计你的 IMU 异常检测流程。



**检查结果：** 先复算给定混淆矩阵，再对独立会话记录基线与模型的实测指标；保留切分清单、误报/漏报反例和量化前后对比，不用本章示例数值作为业务门槛。

 

迁移练习：把本章的“能先做阈值基线再用模型完成 IMU 异常检测，并按会话隔离评估漏报/误报。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m10","criterion":"先复算给定混淆矩阵，再对独立会话记录基线与模型的实测指标；保留切分清单、误报/漏报反例和量化前后对比，不用本章示例数值作为业务门槛。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
