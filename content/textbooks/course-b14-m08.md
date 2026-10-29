# 实战：从设备到决策的完整链路

```zhizhan-anchor
m08
```



综合实战把前面所有环节连起来： **采集 → 网关 → 存储 → 语义 → 告警 → 看板 → 决策** ，并保证断链可恢复、数据可回放。

 

> 前置：完成 M01–M07 主干章节。 · ◷ 约 46 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：写出采集→网关→存储→语义→告警→看板→决策的端到端验收清单，并演示断链恢复与数据回放。

 

本章速览




- 端到端链路每环都要有验收。

- 断链可恢复、数据可回放。

- 告警要能变成行动。

 

```zhizhan-anchor
m08-chain
```



```zhizhan-anchor
m08-chain-t
```



## 8.1 端到端七环节



把前面所有环节连成一条链路：采集 → 网关 → 存储 → 语义 → 告警 → 看板 → 决策；任一环含糊，整条链路都不可信。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  设备到决策的完整链路



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="设备到决策的完整链路" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">采集</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">网关</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">存储</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">语义</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">告警/决策</text></svg>
```



采集（契约）→ 网关（按确认续传、[幂等](term:idempotency)提交并记录丢失）→ 存储（可查询/降采样）→ 语义（时间/质量）→ 告警（闭环）→ 看板 → 决策（行动）。



表 8.1 端到端验收



| 环节 | 验收 | 手段 |
| --- | --- | --- |
| 采集 | 契约一致 | 单位/量程/时间戳 |
| 网关 | 按确认续传、幂等提交并记录丢失 | 缓存\+续传 |
| 存储 | 可查询可降采样 | 标签/保留 |
| 语义 | 时间/质量清楚 | 去重/补缺 |
| 决策 | 可行动 | 告警闭环 |



pipeline.txt 节选Text

 

```text
采集(契约) -> 网关(缓存/续传) -> 存储(标签/降采样)
-> 语义(去重/乱序/质量) -> 告警(阈值+迟滞,闭环) -> 看板 -> 决策
回放: 固定窗口 24h, 按事件时间重放, 结果逐位一致
```

端到端七环节一条链路 \+ 可回放



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：断链恢复



端到端的关键机制是“断链可恢复”，用断网续传模型验证：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_sync.cC\n\n \n\n```text\n/* host_sync.c —— 云边同步：水位/已确认位置与断点续传（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sync.c -o host_sync && ./host_sync\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int local_seq = 10, acked = 4;         /* 本地已产生 10 条，云端只确认到 4 */\n    int pending = local_seq - acked;\n    printf(\"本地=%d 已确认=%d 待同步=%d\\n\", local_seq, acked, pending);\n    if (pending != 6) ok = 0;\n    /* 断点续传：从 acked+1 开始补传 */\n    acked += pending;                       /* 假设全部补传成功 */\n    printf(\"补传后已确认=%d，待同步=%d（期望 0）\\n\", acked, local_seq - acked);\n    if (local_seq - acked != 0) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n断链恢复/水位模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sync.c -o labs/host_sync && ./labs/host_sync
本地=10 已确认=4 待同步=6
补传后已确认=10，待同步=0（期望 0）
RESULT: PASS
```



断链期间本地缓存 6 条待同步；恢复后按已确认位置补传至 10，待同步归零。



表 8.2 关键机制与证据



| 环节 | 可运行证据 | 验收 |
| --- | --- | --- |
| 续传 | host\_sync.c | 待同步→0 |
| 存储 | host\_tsdb.c | 区间/降采样 |
| 语义 | host\_semantics.c | 去重/乱序 |
| 告警 | host\_alert.c | 触发/复位 |



```zhizhan-anchor
m08-replay
```



```zhizhan-anchor
m08-replay-t
```



## 8.3 数据回放与时间口径



链路要能回答：数据从哪来、时间口径是什么、断网怎么办、异常怎么变成行动。数据要可确定性回放。



pipeline.txt 节选Text

 

```text
采集(单位/量程/事件时间) → 网关(缓存/水位续传) → 存储(标签/降采样/保留)
→ 语义(去重/乱序/质量标志) → 告警(阈值+时长+迟滞, 闭环) → 看板 → 决策
回放: 固定窗口 24h, 按事件时间重放, 结果逐位一致
```

一条链路写清“来源/时间/断网/决策”，并可回放



表 8.3 链路四问



| 问题 | 答案 | 验收 |
| --- | --- | --- |
| 数据从哪来 | 采集\+契约 | 单位/量程 |
| 时间口径 | 事件时间 | NTP 对齐 |
| 断网怎么办 | 缓存\+续传 | 待同步→0 |
| 异常变行动 | 告警闭环 | 可处理 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 端到端验收清单



逐环判定，缺一项整条链路不可信。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  各环节验收通过率（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="各环节验收通过率（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="40" class="sv-lbl">采集</text><rect x="150" y="26" width="545" height="14" rx="4" class="sv-grn-s"></rect><text x="703" y="40" class="sv-lbl-hi">100%</text><text x="12" y="60" class="sv-lbl">网关</text><rect x="150" y="46" width="545" height="14" rx="4" class="sv-grn-s"></rect><text x="703" y="60" class="sv-lbl-hi">100%</text><text x="12" y="80" class="sv-lbl">存储</text><rect x="150" y="66" width="545" height="14" rx="4" class="sv-grn-s"></rect><text x="703" y="80" class="sv-lbl-hi">100%</text><text x="12" y="100" class="sv-lbl">语义</text><rect x="150" y="86" width="327" height="14" rx="4" class="sv-amb-s"></rect><text x="485" y="100" class="sv-lbl-hi">60%</text><text x="12" y="120" class="sv-lbl">告警</text><rect x="150" y="106" width="545" height="14" rx="4" class="sv-grn-s"></rect><text x="703" y="120" class="sv-lbl-hi">100%</text></svg>
```



示例：采集/网关/存储/告警通过，语义环节因时间口径未对齐未过——它决定后续是否可信。



表 8.4 三级链路



| 层级 | 链路角色 | 注意 |
| --- | --- | --- |
| 设备端 | 采集/执行 | 契约 |
| 边缘网关 | 汇聚/缓存 | 续传 |
| 云平台 | 存储/分析/决策 | 语义/闭环 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **链路某环无验收** ：问题在那一环爆发。

- **断链不可恢复** ：数据永久丢失。

- **不可回放** ：无法复现。

- **告警不成行动** ：看板好看没人用。



◆ 自测 · Module 08（先答再看）




1. 端到端链路最容易被忽略的验收点是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"“时间与质量语义”——数据是否带时间戳、时区/时钟是否一致、是否有质量标志。它不显眼，但决定后续查询与告警是否可信。"}
   ```

2. 为什么端到端“断链可恢复”是硬要求？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"网络/网关故障不可避免。断链不可恢复意味着数据永久丢失，整条链路的数据可信度崩坏。"}
   ```

3. “告警可闭环为行动”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"告警不能只是一条通知；要能触发确认、处理与恢复，形成可追踪的行动，否则看板好看但无人用。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的端到端链路写一张验收清单（7 环节）并逐条判定，重点补上时间/质量语义。



核对与延伸：[MQTT 规范](https://mqtt.org/mqtt-specification/) · [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)

 

动手练习



运行 ` labs/host_sync.c `（断链恢复）；为你的链路写一张端到端验收清单并逐条判定。



**检查结果：** 7 个环节验收明确；断链本地 10/已确认 4 可恢复至待同步 0；数据可回放；告警可闭环为行动。

 

迁移练习：把本章的“写出采集→网关→存储→语义→告警→看板→决策的端到端验收清单，并演示断链恢复与数据回放。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m08","criterion":"7 个环节验收明确；断链本地 10/已确认 4 可恢复至待同步 0；数据可回放；告警可闭环为行动。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
