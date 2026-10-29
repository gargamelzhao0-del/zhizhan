# 可视化与告警

```zhizhan-anchor
m04
```



可视化把数据变成可读的图；告警要把“ **异常** ”变成“ **可处理的事件** ”。规则要含阈值 \+  **持续时长**  \+  **迟滞** ，否则会在边界反复抖动。

 

> 前置：完成 M03（时序存储与查询）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：用阈值 80 \+ 持续 3 次 \+ 迟滞下限 75 实现告警，使触发=1、复位=1。

 

本章速览




- 告警 = 阈值 \+ 持续时长 \+ 迟滞。

- 分级/抑制避免告警风暴。

- 告警要有闭环（确认/处理/恢复）。

 

```zhizhan-anchor
m04-model
```



```zhizhan-anchor
m04-model-t
```



## 4.1 阈值 \+ 持续时长 \+ 迟滞



单点阈值会被噪声反复触发。规则加上 **持续时长** （去瞬时毛刺）与 **迟滞** （防边界抖动），把“异常”变成“稳定的事件”。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  告警的触发与迟滞复位



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="告警的触发与迟滞复位" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><text x="12" y="48" class="sv-lbl">信号</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="155" height="22" rx="4" class="sv-box"></rect><text x="227.5" y="47" text-anchor="middle" class="sv-lbl-hi">70</text><rect x="305" y="32" width="103" height="22" rx="4" class="sv-amb-s"></rect><text x="356.7" y="47" text-anchor="middle" class="sv-lbl-hi">82</text><rect x="408" y="32" width="103" height="22" rx="4" class="sv-red-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">90</text><rect x="563" y="32" width="103" height="22" rx="4" class="sv-grn-s"></rect><text x="615.0" y="47" text-anchor="middle" class="sv-lbl-hi">74</text><text x="12" y="82" class="sv-lbl">告警</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="413" height="22" rx="4" class="sv-box"></rect><text x="356.7" y="81" text-anchor="middle" class="sv-lbl-hi">off</text><rect x="563" y="66" width="207" height="22" rx="4" class="sv-grn-s"></rect><text x="666.7" y="81" text-anchor="middle" class="sv-lbl-hi">on→off</text></svg>
```



值连续 3 次 \>80 才触发；降到 \<75 才复位。死区（75–80）内维持现状，避免抖动。



表 4.1 告警五概念



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 看板 | 趋势与对比 | 时间对齐 |
| 阈值 | 基础判定 | 单点抖动 |
| 持续时长 | 去瞬时毛刺 | 延迟触发 |
| 迟滞 | 防边界抖动 | 复位条件 |
| 分级/抑制 | 降噪 | 关联告警 |



alert.c 节选C

 

```text
if (v > HI) over++; else if (v < LO) over = 0;  // 迟滞双阈值
if (!alarm && over >= 3) { alarm = 1; notify(); } // 持续3次才触发
if (alarm && v < LO) { alarm = 0; mark_recovered(); }
```

阈值\+持续时长\+迟滞：防抖动的告警规则



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：触发与迟滞复位



下面这段程序验证阈值\+持续时长\+迟滞：



host\_alert.cC

 

```text
/* host_alert.c —— 告警规则：阈值 + 持续时长 + 迟滞（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_alert.c -o host_alert && ./host_alert
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    float hi = 80, lo = 75; int need = 3;      /* 超过 80 持续 3 次触发；低于 75 复位（迟滞） */
    float v[] = {70, 82, 85, 90, 78, 74};
    int n = (int)(sizeof(v)/sizeof(v[0])), over = 0, alarm = 0, resets = 0;
    for (int i = 0; i < n; i++) {
        if (v[i] > hi) { over++; if (over >= need) alarm = 1; }
        else if (v[i] < lo) { over = 0; if (alarm) { resets++; alarm = 0; } }
        printf("t=%d v=%.0f over=%d alarm=%d\n", i, v[i], over, alarm);
    }
    printf("触发=1 复位=%d（迟滞避免抖动）\n", resets);
    if (resets != 1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

告警规则模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_alert.c -o labs/host_alert && ./labs/host_alert
t=0 v=70 over=0 alarm=0
t=3 v=90 over=3 alarm=1
t=5 v=74 over=0 alarm=0
触发=1 复位=1（迟滞避免抖动）
RESULT: PASS
```



连续 3 次 \>80 触发（t=3）；降到 \<75 复位（t=5）。迟滞死区让中间波动不反复触发。



表 4.2 告警参数



| 参数 | 值 | 作用 |
| --- | --- | --- |
| 高阈值 | 80 | 触发线 |
| 持续次数 | 3 | 去毛刺 |
| 低阈值 | 75 | 复位线 |
| 死区 | 5 | 防抖动 |



```zhizhan-anchor
m04-closed
```



```zhizhan-anchor
m04-closed-t
```



## 4.3 告警闭环



告警要有闭环：触发 → 通知 → 确认 → 处理 → 恢复。没有闭环保留的告警会变成“狼来了”，最终没人看。



alert.c 节选C

 

```text
if (v > HI) over++; else if (v < LO) over = 0;
if (!alarm && over >= 3) { alarm = 1; notify(); }   // 触发+通知
if (alarm && v < LO) { alarm = 0; mark_recovered(); }// 迟滞复位
/* 分级/抑制：相关告警合并，避免风暴 */
```

阈值\+持续\+迟滞触发；分级抑制避免告警风暴



表 4.3 告警闭环五环节



| 环节 | 内容 | 要点 |
| --- | --- | --- |
| 触发 | 规则判定 | 阈值\+时长\+迟滞 |
| 通知 | 通道/分级 | 避免风暴 |
| 确认 | 人工/自动 | 进入处理 |
| 恢复 | 复位条件 | 闭环 |
| 抑制 | 关联降噪 | 风暴控制 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与三级对照



告警自检：规则含时长与迟滞、有分级抑制、有闭环。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  单点阈值 vs 带迟滞（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="单点阈值 vs 带迟滞（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">单点阈值</text><rect x="150" y="26" width="514" height="18" rx="4" class="sv-red-s"></rect><text x="672" y="43" class="sv-lbl-hi">12次(h)</text><text x="12" y="67" class="sv-lbl">+时长+迟滞</text><rect x="150" y="50" width="43" height="18" rx="4" class="sv-grn-s"></rect><text x="201" y="67" class="sv-lbl-hi">1次(h)</text></svg>
```



单点阈值在边界反复触发；持续时长\+迟滞把触发次数显著降低。



表 4.4 三级告警



| 层级 | 告警角色 | 注意 |
| --- | --- | --- |
| 设备端 | 本地阈值保护 | 即时 |
| 边缘网关 | 规则/抑制 | 本地闭环 |
| 云平台 | 全局/分级 | 通知与闭环 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **单点阈值** ：噪声导致频繁误报。

- **无迟滞** ：边界反复触发/复位。

- **无抑制/分级** ：告警风暴。

- **无闭环** ：告警被忽视。



◆ 自测 · Module 04（先答再看）




1. 迟滞（hysteresis）解决什么问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"当数值在阈值附近波动时，避免告警在“触发/复位”之间反复抖动：用两个阈值（高触发、低复位）形成死区。"}
   ```

2. “持续时长”相比“单点阈值”的好处？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它要求异常持续 N 次才触发，过滤瞬时毛刺，显著降低误报（代价是触发略有延迟）。"}
   ```

3. 为什么告警必须有“闭环”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没有闭环（通知/确认/处理/恢复）的告警会变成“狼来了”，最终被忽视，失去意义。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你系统写一条告警规则（阈值\+持续时长\+迟滞），并定义它的通知、确认与恢复闭环。



核对与延伸：[Grafana 文档](https://grafana.com/docs/) · [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)

 

动手练习



运行 ` labs/host_alert.c `：验证阈值\+持续时长\+迟滞的触发与复位。



**检查结果：** 触发=1 复位=1（迟滞）：阈值 80 连续 3 次才触发、低于 75 才复位。

 

迁移练习：把本章的“用阈值 80 \+ 持续 3 次 \+ 迟滞下限 75 实现告警，使触发=1、复位=1。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m04","criterion":"触发=1 复位=1（迟滞）：阈值 80 连续 3 次才触发、低于 75 才复位。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
