# 云边协同架构

```zhizhan-anchor
m06
```



云边协同的核心是 **职责划分** ：边缘负责实时与自治，云端负责全局与训练；两者通过消息/命令通道协作，并处理离线与一致性。

 

> 前置：完成 M02（网关续传）与 M05（分析与规则）。 · ◷ 约 44 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：画出端/边/云职责边界并落地断网自治与恢复对账，使待同步 6→0、命令[幂等](term:idempotency)。

 

本章速览




- 云边职责：边缘实时自治，云端全局训练。

- 断网时边缘自治，恢复后对账同步。

- 命令要幂等。

 

```zhizhan-anchor
m06-split
```



```zhizhan-anchor
m06-split-t
```



## 6.1 职责划分：边缘自治，云端全局



边缘负责实时控制与自治（断网可运行），云端负责存储、分析与训练；通过消息/命令通道协作。设计要回答“断网怎么办、恢复如何对账、命令是否幂等”。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  端 / 边 / 云的职责



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="端 / 边 / 云的职责" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">设备端：采集/执行</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">边缘网关：实时自治/缓存/续传</text><rect x="60" y="112" width="680" height="44" rx="6" class="sv-amb-s"></rect><text x="75" y="138.0" class="sv-lbl-hi">云平台：存储/分析/训练/策略</text></svg>
```



设备端采集/执行；边缘网关实时闭环、缓存、续传；云端存储、分析、训练、下发策略。



表 6.1 云边职责



| 职责 | 边缘 | 云端 |
| --- | --- | --- |
| 实时控制 | 就地闭环 | 策略下发 |
| 数据 | 汇聚/缓存 | 存储/分析 |
| 模型 | 推理 | 训练/发布 |
| 配置 | 执行\+确认 | 管理 |
| 自治 | 断网可运行 | 恢复后同步 |



edge\_cloud.txt 节选Text

 

```text
边缘: 实时闭环 + 本地缓存 + 断网自治 + 水位续传
云端: 存储/分析/训练 + 策略下发 + 恢复对账
命令: 唯一 ID 幂等；一致性: 最终一致而非实时一致
```

职责划分：边缘自治、云端全局



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：恢复对账（水位）



断网后恢复靠“已确认位置”对账：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_sync.cC\n\n \n\n```text\n/* host_sync.c —— 云边同步：水位/已确认位置与断点续传（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sync.c -o host_sync && ./host_sync\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int local_seq = 10, acked = 4;         /* 本地已产生 10 条，云端只确认到 4 */\n    int pending = local_seq - acked;\n    printf(\"本地=%d 已确认=%d 待同步=%d\\n\", local_seq, acked, pending);\n    if (pending != 6) ok = 0;\n    /* 断点续传：从 acked+1 开始补传 */\n    acked += pending;                       /* 假设全部补传成功 */\n    printf(\"补传后已确认=%d，待同步=%d（期望 0）\\n\", acked, local_seq - acked);\n    if (local_seq - acked != 0) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n水位/续传模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sync.c -o labs/host_sync && ./labs/host_sync
本地=10 已确认=4 待同步=6
补传后已确认=10，待同步=0（期望 0）
RESULT: PASS
```



断网心跳丢失进入自治；恢复后从已确认位置 4 补传到 10，待同步归零。



表 6.2 离线策略



| 场景 | 边缘行为 | 恢复动作 |
| --- | --- | --- |
| 心跳丢失 | 进入自治 | 继续本地闭环 |
| 持续断网 | 本地缓存（有界） | 按策略丢旧/降采样 |
| 恢复 | 按水位补传 | 待同步→0 |
| 命令重发 | 幂等（唯一 ID） | 不重复执行 |



```zhizhan-anchor
m06-idem
```



```zhizhan-anchor
m06-idem-t
```



## 6.3 命令幂等与一致性



云边不可能“实时一致”。命令要带唯一 ID 保证幂等；数据按事件时间排序、按水位同步；不要把“最终一致”当成“实时一致”。



cmd.c 节选C

 

```text
if (seen_cmd(cmd_id)) return ACK_DUP;   // 幂等：重复命令不重复执行
execute(cmd); mark_seen(cmd_id);
/* 恢复后：按已确认位置续传；命令按 ID 去重 */
```

命令唯一 ID 幂等 \+ 恢复按水位对账



表 6.3 一致性做法



| 维度 | 做法 | 避免 |
| --- | --- | --- |
| 命令 | 唯一 ID 幂等 | 重复执行 |
| 数据 | 水位续传 | 丢/重 |
| 时间 | 事件时间排序 | 口径错 |
| 一致性 | 最终一致 | 假设实时一致 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与三级对照



协同自检：职责清晰、边缘自治、恢复对账、命令幂等。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  断网自治与恢复



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="断网自治与恢复" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">心跳丢失</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">自治</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">网络恢复</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">对账/去重</text></svg>
```



心跳丢失 → 边缘自治（本地闭环\+缓存）→ 网络恢复 → 按水位对账补传 → 命令去重。



表 6.4 三级协同



| 层级 | 协同角色 | 注意 |
| --- | --- | --- |
| 设备端 | 执行/上报 | 断链保护 |
| 边缘网关 | 自治/缓存 | 水位/幂等 |
| 云平台 | 全局/策略 | 恢复对账 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **边缘强依赖云** ：断网业务停。

- **命令不幂等** ：重发重复执行。

- **无对账** ：恢复后数据错乱。

- **一致性假设过高** ：以为云边实时一致。



◆ 自测 · Module 06（先答再看）




1. 为什么“边缘自治”是云边协同的前提？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"网络不可靠、云端会维护/升级。边缘必须能在断网时继续提供实时控制与本地闭环，恢复后再同步，否则业务连续性无法保证。"}
   ```

2. 为什么命令必须“幂等”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"网络重传/恢复补发会重复投递同一命令。带唯一 ID 去重，保证重复命令不会重复执行。"}
   ```

3. 云边为什么不能假设“实时一致”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"网络有延迟/中断。应按“最终一致”设计：数据按水位同步、命令幂等、恢复后对账，而不是假设两边实时同步。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：画出你系统的端/边/云职责边界，落地断网自治与恢复对账，并给命令加唯一 ID 幂等。



核对与延伸：[MQTT 规范](https://mqtt.org/mqtt-specification/) · [AWS IoT / 物模型概念](https://docs.aws.amazon.com/iot/)

 

动手练习



运行 ` labs/host_sync.c `（水位/续传）；画出你的云边职责与离线策略。



**检查结果：** 职责边界清晰；断网心跳丢失 30s×3 进入自治；恢复后按已确认位置 4→10 同步、命令幂等。

 

迁移练习：把本章的“画出端/边/云职责边界并落地断网自治与恢复对账，使待同步 6→0、命令幂等。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m06","criterion":"职责边界清晰；断网心跳丢失 30s×3 进入自治；恢复后按已确认位置 4→10 同步、命令幂等。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
