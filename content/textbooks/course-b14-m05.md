# 数据分析与预测性维护

```zhizhan-anchor
m05
```



数据分析把存储的数据变成决策： **趋势、异常、剩余寿命** 。先建基线，再谈预测；一切以“业务价值”验收。

 

> 前置：完成 M03/M04（存储与告警规则）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：基于健康基线实现异常判定与 RUL 估计，并给出误报/漏报与停机成本的可量化评估。

 

本章速览




- 先建基线再谈异常与预测。

- 预测性维护要落到业务价值。

- 数据质量决定分析可信度。

 

```zhizhan-anchor
m05-model
```



```zhizhan-anchor
m05-model-t
```



## 5.1 基线 → 异常 → 趋势/RUL



先建健康基线（均值±3σ 或健康分布），再判异常，再谈趋势与剩余寿命（RUL）。预测性维护的坑是“指标好但没价值”，要落到减少停机/降低维护成本。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  健康基线与异常阈值（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="健康基线与异常阈值（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">正常均值</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="43" class="sv-lbl-hi">50(相对)</text><text x="12" y="67" class="sv-lbl">+3σ</text><rect x="150" y="50" width="480" height="18" rx="4" class="sv-amb-s"></rect><text x="638" y="67" class="sv-lbl-hi">80(相对)</text><text x="12" y="91" class="sv-lbl">异常阈值</text><rect x="150" y="74" width="540" height="18" rx="4" class="sv-red-s"></rect><text x="698" y="91" class="sv-lbl-hi">90(相对)</text></svg>
```



健康区间均值±3σ；超出即异常。示例振动 RMS\>4.5 mm/s 触发维护。



表 5.1 分析方法



| 分析 | 方法 | 输出 |
| --- | --- | --- |
| 趋势 | 移动平均/回归 | 走向 |
| 异常 | 统计/模型 | 异常点 |
| RUL | 退化模型/回归 | 剩余寿命 |
| 基线 | 健康分布 | 偏离 |
| 评估 | 误报漏报/成本 | 价值 |



baseline.py 节选Python

 

```text
mu, sd = mean(reference), std(reference)
anomaly = abs(x - mu) > 3*sd            # 健康基线 ±3σ
value = downtime_saved - false_alarm_cost  # 量化业务价值
```

先建健康基线；预测要落到业务价值



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：聚合趋势基础



聚合与降采样是趋势分析的基础（真实证据）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_tsdb.cC\n\n \n\n```text\n/* host_tsdb.c —— 时序存储：追加、区间查询、降采样（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tsdb.c -o host_tsdb && ./host_tsdb\n */\n#include <stdio.h>\ntypedef struct { long t; float v; } pt_t;\nstatic pt_t S[16]; static int n = 0;\nstatic void put(long t, float v) { if (n < 16) { S[n].t = t; S[n].v = v; n++; } }\nstatic int range(long a, long b, float *out) { int c = 0; for (int i = 0; i < n; i++) if (S[i].t >= a && S[i].t <= b) out[c++] = S[i].v; return c; }\nstatic float avg_downsample(long bucket, long t0, long t1) { (void)bucket; float s = 0; int c = 0; for (int i = 0; i < n; i++) if (S[i].t >= t0 && S[i].t < t1) { s += S[i].v; c++; } return c ? s/c : 0; }\nint main(void) {\n    int ok = 1;\n    for (int i = 0; i < 10; i++) put(i * 100, (float)i);\n    float out[16]; int c = range(200, 500, out);\n    printf(\"区间 [200,500] 点数=%d（期望 4：2,3,4,5）\\n\", c);\n    if (c != 4) ok = 0;\n    float m = avg_downsample(1000, 0, 1000);\n    printf(\"降采样 [0,1000) 均值=%.2f（期望 4.50）\\n\", m);\n    if (m < 4.49f || m > 4.51f) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n聚合/降采样模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_tsdb.c -o labs/host_tsdb && ./labs/host_tsdb
区间 [200,500] 点数=4（期望 4：2,3,4,5）
降采样 [0,1000) 均值=4.50（期望 4.50）
RESULT: PASS
```



趋势 = 按桶聚合的时间序列（降采样均值）；它是异常检测与 RUL 的输入。



表 5.2 分析步骤



| 步骤 | 方法 | 输出 |
| --- | --- | --- |
| 基线 | 健康均值±3σ | 偏离判据 |
| 异常 | 越界/统计 | 异常点 |
| 趋势 | 降采样均值/回归 | 走向 |
| RUL | 退化外推 | 剩余寿命 |



```zhizhan-anchor
m05-value
```



```zhizhan-anchor
m05-value-t
```



## 5.3 价值评估：误报 vs 停机成本



维护动作有成本（停机/备件/人工）。只有当“减少的损失”大于“误报成本”时，预测才有意义。用误报率/漏报率 \+ 单次停机成本量化价值。



value.py 节选Python

 

```text
cost_avoided = downtime_hours * cost_per_hour * recall
cost_false   = n_alarms * (1 - precision) * per_alarm_cost
# 只有 cost_avoided > cost_false，预测才有价值
```

把预测落到“避免的停机损失 − 误报成本”上



表 5.3 价值评估指标



| 指标 | 含义 | 验收 |
| --- | --- | --- |
| 误报率 | 打扰成本 | ≤阈值 |
| 漏报率 | 漏检风险 | 安全优先 |
| 停机成本 | 元/小时 | 量化 |
| 收益 | 避免损失 | \> 误报成本 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与三级对照



分析自检：有基线、异常可解释、价值可量化。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  从数据到决策



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从数据到决策" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">基线</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">异常</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">趋势/RUL</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">价值/行动</text></svg>
```



基线 → 异常检测 → 趋势/RUL → 价值评估 → 行动（维护/降载）。



表 5.4 三级分析



| 层级 | 分析角色 | 注意 |
| --- | --- | --- |
| 设备端 | 本地阈值/异常 | 资源受限 |
| 边缘网关 | 趋势/聚合 | 实时性 |
| 云平台 | 模型/RUL | 数据量 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **无基线** ：无法判断异常。

- **只追准确率** ：忽略业务成本。

- **数据质量差** ：结论不可信。

- **不评估价值** ：做了没人用。



◆ 自测 · Module 05（先答再看）




1. 预测性维护为什么必须量化“业务价值”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"维护动作有成本（停机/备件/人工）。只有当“减少的损失”大于“误报带来的成本”时，预测才有意义；否则再准也没人用。"}
   ```

2. 为什么先建“健康基线”再谈预测？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没有健康基线就无法定义“偏离”。基线（均值±3σ/健康分布）是异常判定的参照。"}
   ```

3. RUL（剩余寿命）估计的常见方法是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"基于退化特征的时间外推/回归（如随时间的趋势外推到阈值），或退化模型。数据质量决定其可信度。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备建一个健康基线并给出误报率与单次停机成本，量化预测性维护的价值。



核对与延伸：[TimescaleDB 文档](https://docs.timescale.com/) · [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)

 

动手练习



运行 ` labs/host_tsdb.c `（聚合与趋势基础）；为你的数据设计基线与异常检测指标。



**检查结果：** 基线取健康均值±3σ、异常阈值示例振动 RMS\>4.5 mm/s；评估含误报率与单次停机成本。

 

迁移练习：把本章的“基于健康基线实现异常判定与 RUL 估计，并给出误报/漏报与停机成本的可量化评估。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m05","criterion":"基线取健康均值±3σ、异常阈值示例振动 RMS>4.5 mm/s；评估含误报率与单次停机成本。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
