# 设备端评估与业务验收

```zhizhan-anchor
m12
```



设备端评估要测全： **延迟、内存、功耗、精度** ，并在 **独立测试集** 上与离线结果对拍；验收按业务阈值与长跑稳定性判定。

 

> 前置：Module 08 的指标与 Module 11 的加速。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能在设备端测延迟/内存/功耗/精度并与离线结果对拍，写出可复现的验收报告。

 

本章速览




- 设备端测延迟/内存/功耗/精度并离线对拍。

- 用独立测试集与业务阈值验收。

- 长跑监测漂移。

 

```zhizhan-anchor
m12-accept
```



```zhizhan-anchor
m12-accept-t
```



## 12.1 设备端四维评估



设备端要测：延迟、内存、功耗、精度；在独立测试集上与离线对拍；验收按业务阈值与长跑稳定性判定。“离线好、设备差”通常来自预处理差异、量化、算子近似。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  设备端验收流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="设备端验收流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">设备端测量</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">独立测试</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">对拍</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">长跑/报告</text></svg>
```



设备端测量（延迟/内存/功耗）→ 独立测试集精度 → 与离线对拍 → 长跑稳定 → 验收报告。



表 12.1 四维评估



| 维度 | 测量 | 通过标准 |
| --- | --- | --- |
| 延迟 | 端到端 | ≤ 截止期 |
| 内存 | 峰值/常驻 | 在预算内 |
| 功耗 | 每次推理 | 满足续航 |
| 精度 | 独立测试集 | 指标达标 |
| 稳定 | 长跑/漂移 | 无退化 |



accept.c 节选C

 

```text
float lat = device_latency();            // 端到端
float f1v = device_f1(test);              // 独立测试集
float d   = fabs(f1v - offline_f1);       // 与离线对拍
assert(lat <= DEADLINE && d <= DECLARED_ERROR);
```

设备端测延迟/精度并与离线对拍，差异≤阈值



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 指标算法练习：不代表设备实测



本例只验证给定混淆矩阵的计算；设备端延迟须测量，不能用逐段预算代替：



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



F1=0.842 与漏报率 0.111 仅来自示例混淆矩阵，不能倒推产品验收线。先按业务漏报/误报代价定阈值，再用隔离的测试会话评估；host\_latency 不测真实推理。



表 12.2 验收线与来源



| 指标 | 验收线 | 来源 |
| --- | --- | --- |
| 延迟 | 预先声明的截止期/分位数 | 目标端到端测量 |
| F1 | 业务阈值，非示例数值 | 独立测试集 |
| 漏报率 | 按错误代价与样本量确定 | 独立测试集 |
| 内存/功耗 | 在预算 | 设备端测量 |



```zhizhan-anchor
m12-report
```



```zhizhan-anchor
m12-report-t
```



## 12.3 对拍与验收报告



对拍定位“离线 vs 设备端”差异来源；验收报告要写清测量条件与限制。



accept.md 节选Text

 

```text
## 设备端验收
- 延迟: 端到端 X us (条件: 频率 Y MHz, batch 1)
- 精度: F1=0.842 漏报率=0.111 (独立测试集 N=..)
- 对拍: 与离线差 X% (原因: 量化/算子近似)
- 长跑: 24h 无退化/无泄漏
```

验收报告写清测量条件、对拍差异与长跑结论



表 12.3 验收检查



| 检查 | 方法 | 通过标准 |
| --- | --- | --- |
| 对拍 | 离线 vs 设备端 | 差异≤阈值可解释 |
| 量化偏差 | 量化前后 | 回退可接受 |
| 长跑 | 小时/天级 | 无退化 |
| 报告 | 含条件/限制 | 可复现 |



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 自检与三级对照



验收自检：四维都测、独立测试集、对拍可解释、报告可复现。



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  离线 vs 设备端（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="离线 vs 设备端（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">离线</text><rect x="150" y="26" width="516" height="18" rx="4" class="sv-grn-s"></rect><text x="674" y="43" class="sv-lbl-hi">86F1×100</text><text x="12" y="67" class="sv-lbl">设备端</text><rect x="150" y="50" width="504" height="18" rx="4" class="sv-amb-s"></rect><text x="662" y="67" class="sv-lbl-hi">84F1×100</text></svg>
```



设备端可能因量化/算子近似略低于离线；差异要在阈值内且可解释。



表 12.4 三级验收



| 层级 | 验收重点 | 条件 |
| --- | --- | --- |
| MCU 端 | 延迟/内存 | 严格预算 |
| Linux 边缘 | 延迟/功耗/精度 | 算力充足 |
| 云/训练 | 离线指标 | 大数据集 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **只报离线指标** ：设备端可能更差。

- **不做对拍** ：差异原因不明。

- **无长跑** ：漂移/泄漏未发现。

- **报告不写条件** ：无法复现。



◆ 自测 · Module 12（先答再看）




1. 为什么验收要区分“离线指标”和“设备端指标”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"量化、算子近似、预处理差异会让设备端指标低于离线。只有设备端实测 \\+ 对拍才能判断是否真正可用。"}
   ```

2. “离线好、设备差”最可能的原因有哪些？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"预处理差异（口径不一致）、量化误差累积、算子近似、输入量纲不同。用设备端对拍逐项定位。"}
   ```

3. 验收报告为什么要写清测量条件？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"条件（频率/批大小/数据集规模）不同结果不可比。写清条件才能复现与对比。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你模型写一份设备端验收报告（延迟/内存/功耗/精度 \+ 对拍 \+ 长跑），并标注测量条件。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_metrics.c `：用业务指标评估；为你的模型写设备端验收报告。



**检查结果：** 实验前声明业务质量与资源门槛；使用独立测试会话和真实目标测量验收。示例混淆矩阵与预设耗时不能作产品指标。

 

迁移练习：把本章的“能在设备端测延迟/内存/功耗/精度并与离线结果对拍，写出可复现的验收报告。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m12","criterion":"实验前声明业务质量与资源门槛；使用独立测试会话和真实目标测量验收。示例混淆矩阵与预设耗时不能作产品指标。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
