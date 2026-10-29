# 数据闭环与模型 OTA

```zhizhan-anchor
m09
```



数据闭环让设备“越用越准”： **难例回传 → 标注/迭代 → 模型 [OTA](term:ota) → 线上监测 → 再迭代** 。模型更新要与固件解耦、可灰度、可回滚。

 

> 前置：Module 08 的任务指标。 · ◷ 约 44 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计可追溯的难例回传—标注—训练—OTA—监测闭环，并支持灰度与回滚。

 

本章速览




- 数据闭环：难例回传→标注→训练→OTA→监测。

- 模型 OTA 与固件解耦、可灰度回滚。

- 监测漂移触发重训。

 

```zhizhan-anchor
m09-loop
```



```zhizhan-anchor
m09-loop-t
```



## 9.1 数据闭环的五个环节



难例回传（低置信/误判样本）→ 标注/迭代 → 模型 OTA（与固件解耦）→ 线上监测 → 再迭代。模型更新要可灰度、可回滚。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  数据闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="数据闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">难例回传</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">标注/训练</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">模型 OTA</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">监测/再迭代</text></svg>
```



难例回传 → 标注 → 训练 → 模型 OTA → 线上监测 → （漂移触发）再迭代。



表 9.1 闭环五环节



| 环节 | 内容 | 要点 |
| --- | --- | --- |
| 难例回传 | 低置信/误判样本 | 带宽/隐私 |
| 版本 | 数据\+模型版本 | 可追溯 |
| 模型 OTA | 只更新模型 | 与固件解耦 |
| 灰度 | 小批量先上 | 指标监测 |
| 漂移 | 分布变化 | 触发重训 |



loop.py 节选Python

 

```text
hard = query_low_conf_or_wrong(gate)     # 难例回传
labelled = annotate(hard); retrain(labelled)
deploy_gray(model, 0.10); monitor_drift() # 灰度+漂移监测
```

难例回传→标注→训练→灰度 OTA→漂移监测



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：会话隔离与闭环数据



闭环训练仍要按会话切分防泄漏。数据切分证据：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_split.cC\n\n \n\n```text\n/* host_split.c —— 数据切分与泄漏：按会话整段切分，避免同源数据跨集（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_split.c -o host_split && ./host_split\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    /* 4 个会话，每个 3 个样本；按会话整段分配给 train/val/test，避免碎片跨集泄漏 */\n    int session[12] = {0,0,0,1,1,1,2,2,2,3,3,3};\n    int n = 12, train = 0, val = 0, test = 0;\n    for (int i = 0; i < n; i++) {\n        if (session[i] <= 1) train++;        /* 会话 0,1 → train */\n        else if (session[i] == 2) val++;     /* 会话 2 → val */\n        else test++;                         /* 会话 3 → test */\n    }\n    /* 校验：任一会话不得同时出现在两个集合（整段切分不跨集） */\n    int group[4];\n    for (int s = 0; s < 4; s++) group[s] = (s <= 1) ? 0 : (s == 2 ? 1 : 2);\n    for (int s = 0; s < 4; s++) {\n        int mask = 0;\n        for (int i = 0; i < n; i++) if (session[i] == s) mask |= 1 << group[s];\n        if (mask != (1 << group[s])) ok = 0;   /* 一个会话只能落一个集合 */\n    }\n    printf(\"train=%d val=%d test=%d（按会话整段切分，不跨集）\\n\", train, val, test);\n    if (!(train == 6 && val == 3 && test == 3)) ok = 0;\n    printf(\"泄漏风险：随机按行切分会让同一会话同时出现在 train/test，导致指标虚高\\n\");\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n会话隔离切分（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_split.c -o labs/host_split && ./labs/host_split
train=6 val=3 test=3（按会话整段切分，不跨集）
泄漏风险：随机按行切分会让同一会话同时出现在 train/test，导致指标虚高
RESULT: PASS
```



回传的难例同样按会话整段切分，避免闭环里出现泄漏导致指标虚高。



表 9.2 难例回传策略



| 回传策略 | 内容 | 约束 |
| --- | --- | --- |
| 低置信 | 概率接近 0.5 | 带宽上限 |
| 误判 | 与标签不符 | 隐私脱敏 |
| 抽样 | 随机/分层 | 代表性 |
| 频次 | 按需/定期 | 功耗/流量 |



```zhizhan-anchor
m09-ota
```



```zhizhan-anchor
m09-ota-t
```



## 9.3 模型 OTA 与版本兼容



模型 OTA 复用 B07/B09 的机制（校验、A/B、回滚）；关键是 **模型-预处理-固件三者版本兼容** ——只更新模型而预处理变了，精度会崩。



model\_ota.c 节选C

 

```text
if (!compat_ok(model_ver, preproc_ver, fw_ver)) return -1;  // 三方兼容校验
if (verify_signature(img, sig) != OK) return -2;
deploy_gray(img, 0.10);       // 灰度首批 ≤10%
if (metric_drop() > 0.02f) rollback();  // 掉>2% 回滚
```

三方兼容校验 \+ 签名 \+ 灰度 \+ 量化回滚



表 9.3 模型 OTA 要求



| 要求 | 做法 | 理由 |
| --- | --- | --- |
| 解耦 | 模型独立于固件更新 | 频繁/小体积 |
| 兼容 | 模型-预处理-固件校验 | 防错配 |
| 灰度 | 首批≤10% | 影响面小 |
| 回滚 | 指标阈值触发 | 快速止损 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检与三级对照



闭环自检：可追溯、无泄漏、可灰度、可回滚、有漂移监测。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  闭环的版本与兼容约束



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="闭环的版本与兼容约束" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">数据版本</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">模型版本</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">预处理版本</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">固件版本</text></svg>
```



数据版本 \+ 模型版本 \+ 预处理版本 \+ 固件版本一起管理；任一不匹配即拒绝部署。



表 9.4 三级闭环角色



| 层级 | 闭环角色 | 注意 |
| --- | --- | --- |
| MCU 端 | 回传难例/接收模型 | 带宽/存储 |
| Linux 边缘 | 汇聚/监测 | 算力 |
| 云/训练 | 标注/训练/下发 | 版本/隐私 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **无难例回传** ：模型不迭代。

- **模型与固件强耦合** ：更新要整机升级。

- **无灰度/回滚** ：坏模型全量。

- **只看线上不监测漂移** ：悄悄退化。



◆ 自测 · Module 09（先答再看）




1. 为什么“模型 OTA”常与固件 OTA 解耦？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型更新频繁、体积小；解耦后可独立灰度/回滚，不必整机升级固件，但必须约束“模型-预处理-固件”的版本兼容。"}
   ```

2. 难例回传要回传哪些样本？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"低置信（概率接近 0.5）与误判（与标签不符）的样本最有价值；要限制带宽并做隐私脱敏。"}
   ```

3. 上线后为什么要“监测漂移”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"数据分布会随时间变化（漂移），模型精度悄悄下降。监测漂移并触发重训才能保持效果。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备设计“难例回传→标注→训练→模型 OTA→监测”的闭环，并定义灰度与回滚条件。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_split.c `（数据切分防泄漏）；为你的闭环画“采集→标注→训练→OTA→监测”链路。



**检查结果：** 闭环链路可追溯；按会话切分 train=6/val=3/test=3；模型更新可灰度（首批≤10%）可回滚。

 

迁移练习：把本章的“能设计可追溯的难例回传—标注—训练—OTA—监测闭环，并支持灰度与回滚。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m09","criterion":"闭环链路可追溯；按会话切分 train=6/val=3/test=3；模型更新可灰度（首批≤10%）可回滚。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
