# 数据与模型运行闭环

```zhizhan-anchor
m11
```



闭环让系统“越用越准”： **数据版本 → 指标监测 → 漂移检测 → 重训 → 发布 → 回退** 。发布必须有独立验证与回退，不能自动重训后直接全量。

 

> 前置：完成 M04（告警规则）与 M06（协同）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：定义数据版本→指标监测→漂移重训→灰度发布→回退的闭环，并给出漂移判据与回退边界。

 

本章速览




- 数据版本可追溯，指标可监测，漂移触发重训。

- 重训后独立验证\+灰度\+回退。

- 禁止自动重训直接全量。

 

```zhizhan-anchor
m11-loop
```



```zhizhan-anchor
m11-loop-t
```



## 11.1 运行闭环六环节



数据版本 → 指标监测 → 漂移检测 → 重训 → 发布（灰度\+验证）→ 回退（有边界）。模型运行闭环与 B13 的模型 [OTA](term:ota) 相连。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  数据与模型运行闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="数据与模型运行闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">数据版本</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">监测</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">漂移/重训</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">发布/回退</text></svg>
```



数据版本（快照）→ 线上指标监测 → 漂移检测 → 重训 → 独立验证 → 灰度发布 → 失败回退。



表 11.1 闭环六环节



| 环节 | 内容 | 要点 |
| --- | --- | --- |
| 数据版本 | 训练数据快照 | 可追溯 |
| 监测 | 线上指标 | 阈值告警 |
| 漂移 | 分布变化 | 触发重训 |
| 发布 | 灰度\+验证 | 独立测试 |
| 回退 | 失败切换 | 有边界 |



loop.c 节选C

 

```text
if (drift_psi() > 0.2f) retrain();          // 漂移触发重训
if (!independent_eval(new_model)) return;   // 独立验证
deploy_gray(new_model, 0.05);              // 灰度≤5%
if (online_metric_drop() > 0.05f) rollback();// 降>5%回退
```

漂移重训→独立验证→灰度→量化回退



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：监测/告警规则



监测用告警规则（阈值\+时长\+迟滞）判定线上指标是否异常：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_alert.cC\n\n \n\n```text\n/* host_alert.c —— 告警规则：阈值 + 持续时长 + 迟滞（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_alert.c -o host_alert && ./host_alert\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    float hi = 80, lo = 75; int need = 3;      /* 超过 80 持续 3 次触发；低于 75 复位（迟滞） */\n    float v[] = {70, 82, 85, 90, 78, 74};\n    int n = (int)(sizeof(v)/sizeof(v[0])), over = 0, alarm = 0, resets = 0;\n    for (int i = 0; i < n; i++) {\n        if (v[i] > hi) { over++; if (over >= need) alarm = 1; }\n        else if (v[i] < lo) { over = 0; if (alarm) { resets++; alarm = 0; } }\n        printf(\"t=%d v=%.0f over=%d alarm=%d\\n\", i, v[i], over, alarm);\n    }\n    printf(\"触发=1 复位=%d（迟滞避免抖动）\\n\", resets);\n    if (resets != 1) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n监测/告警规则模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_alert.c -o labs/host_alert && ./labs/host_alert
触发=1 复位=1（迟滞避免抖动）
RESULT: PASS
```



线上指标监测复用告警规则（阈值\+持续\+迟滞），避免指标抖动导致误触发重训/回退。



表 11.2 监测判据与动作



| 监测项 | 判据 | 动作 |
| --- | --- | --- |
| 线上指标 | 阈值\+时长\+迟滞 | 告警 |
| 漂移 | PSI\>0.2/偏移\>2σ | 触发重训 |
| 发布灰度 | 首批≤5% | 观察 |
| 回退 | 指标降\>5% | 切回旧版 |



```zhizhan-anchor
m11-safety
```



```zhizhan-anchor
m11-safety-t
```



## 11.3 独立验证与回退边界



重训产物要经 **独立验证** 、灰度、可回退；避免“自动重训后直接全量发布”造成批量事故。回退要有边界（数据/预处理不可回退时，模型也不能随意退）。



loop.c 节选C

 

```text
if (drift_psi() > 0.2f) retrain();           // 漂移触发重训
if (!independent_eval(new_model)) return;    // 独立验证
deploy_gray(new_model, 0.05);               // 灰度 ≤5%
if (online_metric_drop() > 0.05f) rollback();// 降>5% 回退
```

漂移重训 → 独立验证 → 灰度 → 量化回退



表 11.3 闭环安全要求



| 要求 | 做法 | 理由 |
| --- | --- | --- |
| 数据版本 | 快照\+可追溯 | 可复现 |
| 独立验证 | 独立测试集 | 防过拟合 |
| 灰度 | 首批≤5% | 限影响面 |
| 回退边界 | 明确可退范围 | 防错配 |



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检与三级对照



闭环自检：数据可追溯、指标可监测、漂移触发重训、发布可回退。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  漂移与重训触发（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="漂移与重训触发（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">PSI</text><rect x="150" y="26" width="500" height="18" rx="4" class="sv-amb-s"></rect><text x="658" y="43" class="sv-lbl-hi">25(×10⁻²)</text><text x="12" y="67" class="sv-lbl">阈值</text><rect x="150" y="50" width="400" height="18" rx="4" class="sv-red-s"></rect><text x="558" y="67" class="sv-lbl-hi">20(×10⁻²)</text><text x="12" y="91" class="sv-lbl">正常</text><rect x="150" y="74" width="160" height="18" rx="4" class="sv-grn-s"></rect><text x="318" y="91" class="sv-lbl-hi">8(×10⁻²)</text></svg>
```



PSI 超阈值只触发调查：先排除采集/分箱变化，结合标签核查性能。0.2 是示例，不是通用重训门槛。



表 11.4 三级闭环



| 层级 | 闭环角色 | 注意 |
| --- | --- | --- |
| 设备端 | 推理/回传难例 | 带宽 |
| 边缘网关 | 监测/聚合 | 实时性 |
| 云平台 | 训练/发布/回退 | 版本/验证 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **自动重训直接全量** ：坏模型批量事故。

- **无数据版本** ：模型不可复现。

- **无漂移监测** ：悄悄退化。

- **无回退** ：发布即单程票。



◆ 自测 · Module 11（先答再看）




1. 为什么“自动重训后不能直接全量发布”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"重训可能因数据/参数问题产生坏模型。必须先独立验证、灰度观察、保留回退，否则一次自动更新就能造成批量事故。"}
   ```

2. 漂移检测的作用是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"监测分布变化并调查原因；PSI 与分箱、样本量有关，漂移不等于性能下降。确认数据/标签有效后训练候选模型，独立评估通过才进入灰度。"}
   ```

3. 为什么回退要有“边界”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"某些升级不可逆（数据/预处理结构变化）。无边界回退可能出现“旧模型 \\+ 新预处理”的错配，导致状态错乱。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你系统定义数据版本→监测→漂移重训→灰度发布→回退的闭环，并给出漂移判据与回退边界。



核对与延伸：[Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/) · [AWS IoT / 物模型概念](https://docs.aws.amazon.com/iot/)

 

动手练习



运行 ` labs/host_alert.c `（监测/告警规则）；为你的闭环定义漂移判据与回退边界。



**检查结果：** 数据可追溯；指标可监测；PSI 与灰度百分比只作为示例策略，需结合标签、样本量和业务风险定阈值；候选重训模型先离线验证，再灰度并支持回退。

 

迁移练习：把本章的“定义数据版本→指标监测→漂移重训→灰度发布→回退的闭环，并给出漂移判据与回退边界。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m11","criterion":"数据可追溯；指标可监测；PSI 与灰度百分比只作为示例策略，需结合标签、样本量和业务风险定阈值；候选重训模型先离线验证，再灰度并支持回退。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
