# 机器人与 ROS 2 分支

```zhizhan-anchor
m11
```



ROS 2 用 **节点 \+ 话题/服务/动作** 组织机器人系统，底层是 DDS 中间件。关键在 **坐标系/时间统一** 与 **MCU 与 Linux 的分工** 。

 

> 前置：了解 Linux 多进程通信与实时性概念；有 MCU 裸机/RTOS 经验。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为机器人划分节点与安全层并统一坐标系/时间、保证底层独立保护。

 

本章速览




- ROS 2 用节点\+话题/服务/动作组织系统。

- 坐标系/时间必须统一。

- 安全保护放 MCU/实时域，不依赖上层。

 

```zhizhan-anchor
m11-ros
```



```zhizhan-anchor
m11-ros-t
```



## 11.1 节点/话题/服务与分层



ROS 2 用节点 \+ 话题/服务/动作组织系统，底层 DDS。机器人系统要分层：实时控制与保护放 MCU/实时域，感知与规划放 Linux；上层不可用时底层仍能安全运行。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  机器人的分层



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="机器人的分层" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">实时控制 + 安全保护（MCU/RTOS）</text><rect x="60" y="64" width="680" height="55" rx="6" class="sv-cyn-s"></rect><text x="75" y="95.5" class="sv-lbl-hi">感知/规划（Linux + ROS 2）</text><rect x="60" y="123" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="142.0" class="sv-lbl-hi">人机/云（可视化/远程）</text></svg>
```



实时控制/保护（MCU/RTOS）↔ 感知/规划（Linux）↔ 人机/云。保护层不依赖上层在线。



表 11.1 ROS 2 五概念



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 节点 | 功能单元 | 粒度/职责 |
| 话题/服务 | 数据流/请求 | QoS |
| 坐标系 | TF 变换 | 统一与时间戳 |
| 时间 | 同步/仿真时间 | 时钟源 |
| 保护 | 安全层 | 不依赖上层在线 |



robot.txt 节选Text

 

```text
MCU/RTOS: 电机闭环 + 急停 + 限位 + 看门狗（独立保护）
Linux:    感知/规划/ROS 2 节点（可卡顿）
原则: 上层失效时，底层仍能安全停机
```

保护在 MCU/实时域独立实现，不依赖上层



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：节点通信可靠性



机器人节点间通信同样需要确认/重传（QoS 可靠）。用通信模型验证：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_protocol.cC\n\n \n\n```text\n/* host_protocol.c —— 物联网新协议：CoAP 式请求/确认与重传（主机可运行）。\n * 基于 UDP 的请求需自行确认与重传；指数退避直到超时。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_protocol.c -o host_protocol && ./host_protocol\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int lost = 2;                 /* 前两次丢失 */\n    int tries = 0, acked = 0, backoff = 100;\n    while (tries < 5) {\n        tries++;\n        if (lost > 0) { lost--; printf(\"第 %d 次超时，退避 %dms\\n\", tries, backoff); backoff *= 2; continue; }\n        acked = 1; printf(\"第 %d 次收到响应\\n\", tries); break;\n    }\n    printf(\"尝试=%d 确认=%d 最终退避=%dms\\n\", tries, acked, backoff);\n    if (!(tries == 3 && acked == 1)) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n确认/重传模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_protocol.c -o labs/host_protocol && ./labs/host_protocol
尝试=3 确认=1 最终退避=400ms
RESULT: PASS
```



可靠 QoS 等价于确认\+指数退避重传（100→200→400ms）；丢关键消息会造成控制异常。



表 11.2 机器人系统要点



| 维度 | 要点 | 避免 |
| --- | --- | --- |
| 坐标系 | TF 统一 \+ 时间戳 | 数据对不上 |
| 时间 | 统一时钟源 | 仿真/真实混用 |
| QoS | 按重要性设 | 丢关键消息 |
| 保护 | 底层独立 | 依赖上层在线 |



```zhizhan-anchor
m11-safety
```



```zhizhan-anchor
m11-safety-t
```



## 11.3 保护分层



安全保护必须放 MCU/实时域独立实现：保证即使规划层卡顿/崩溃，底层也能进入安全状态。



robot.txt 节选Text

 

```text
MCU/RTOS: 电机闭环 + 急停 + 限位 + 看门狗（独立保护）
Linux:    感知/规划/ROS 2 节点（可卡顿）
原则: 上层失效时，底层仍能安全停机（保护不依赖上层在线）
```

保护在 MCU/实时域独立实现，不依赖上层



表 11.3 职责与实时性



| 层级 | 职责 | 实时性 |
| --- | --- | --- |
| MCU/RTOS | 闭环控制 \+ 保护 | 硬实时 |
| Linux | 感知/规划 | 软实时 |
| 云/人机 | 远程/可视化 | 非实时 |



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检与成熟度对照



机器人自检：坐标系/时间统一、通信可靠、保护独立、分层清晰。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  从感知到保护



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从感知到保护" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">感知</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">规划</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">下发</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">MCU 闭环/保护</text></svg>
```



感知（Linux）→ 规划（Linux）→ 下发指令 → MCU 闭环 \+ 保护（独立）→ 失效即安全停机。



表 11.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | ROS 2 \+ 实时域成熟 | 可用 |
| 成长期 | 实时性需调优 | 试点 |
| 观察期 | 生态待完善 | 跟踪 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **坐标系/时间不统一** ：数据对不上。

- **把安全放上层** ：上层挂了就危险。

- **节点粒度过细** ：通信开销大。

- **QoS 不匹配** ：丢关键消息。



◆ 自测 · Module 11（先答再看）




1. 机器人系统为什么安全保护不能只放在 Linux 上层？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"上层可能卡顿/崩溃/被抢占；安全保护应在 MCU/实时域独立实现，保证即使规划层失效，底层也能进入安全状态。"}
   ```

2. 为什么机器人系统要统一坐标系与时间？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不同节点的数据要能对齐融合。坐标系统一（TF）与时间戳统一是数据可信、动作正确的前提。"}
   ```

3. ROS 2 的 QoS 有什么作用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"QoS 决定消息的可靠性/时效/持久性。关键控制消息要用“可靠”QoS（确认\\+重传），否则丢消息会造成控制异常。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的机器人划分节点与安全层，统一坐标系/时间，并确保保护层在 MCU/实时域独立实现。



核对与延伸：[ROS 2 文档](https://docs.ros.org/)

 

动手练习



运行 ` labs/host_protocol.c `（节点通信/重传模型）；为机器人划分节点与安全层。



**检查结果：** 节点职责清晰、坐标系与时间统一；节点通信确认/重传可复现（尝试=3、确认=1、退避=400ms）；实时保护不依赖上层在线。

 

迁移练习：把本章的“能为机器人划分节点与安全层并统一坐标系/时间、保证底层独立保护。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m11","criterion":"节点职责清晰、坐标系与时间统一；节点通信确认/重传可复现（尝试=3、确认=1、退避=400ms）；实时保护不依赖上层在线。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
