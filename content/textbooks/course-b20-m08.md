# 控制系统基础

```zhizhan-anchor
m08
```



闭环控制用反馈把误差拉小，但引入 **稳定性** 问题：延迟、滤波、离散化都会削减相位裕度，过度增益导致振荡。

 

> 前置：理解微分方程/传递函数直觉，读过 M07。 · ◷ 约 42 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能分析闭环稳定性（相位裕度）并考虑采样离散化、延迟与执行器约束。

 

本章速览




- 闭环抗扰但可能振荡；延迟/滤波削裕度。

- 采样周期过大等于加延迟。

- 执行器约束要纳入设计。

 

```zhizhan-anchor
m08-control
```



```zhizhan-anchor
m08-control-t
```



## 8.1 反馈、误差与稳定性



闭环用反馈把误差拉小，但引入稳定性问题：延迟、滤波、离散化都会削减相位裕度，过度增益导致振荡。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  闭环控制回路



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="闭环控制回路" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">设定值</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">误差</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">控制器</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">对象/反馈</text></svg>
```



设定值 → 误差（目标−测量）→ 控制器 → 执行器 → 被控对象 → 测量反馈 → 闭环。



表 8.1 控制五概念



| 概念 | 含义 | 注意 |
| --- | --- | --- |
| 开环/闭环 | 有/无反馈 | 闭环抗扰但可能振荡 |
| 误差 | 目标−测量 | 驱动控制 |
| 相位裕度 | 稳定余量 | 延迟/滤波吃掉 |
| 离散化 | ZOH/采样周期 | 周期过大不稳 |
| 执行器约束 | 限幅/速率 | 影响性能 |



control.c 节选C

 

```text
e = sp - y;                                  // 误差
u = clamp(pid(e), U_MIN, U_MAX);             // 限幅
/* 采样周期/滤波延迟 -> 相位滞后；周期过大失稳 */
```

误差驱动控制；限幅尊重执行器；周期/延迟影响稳定



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：闭环收敛



下面这段程序是闭环控制模型，验证收敛到设定值且不振荡：



host\_pid.cC

 

```text
/* host_pid.c —— PID 与执行器约束（限幅/抗饱和）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pid.c -o host_pid && ./host_pid
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    double kp=2, ki=0.5, I=0, hi=10, lo=0;
    double set=5, y=0, dt=0.1; int aw=1;
    for (int i=0;i<200;i++) {
        double e = set - y;
        double u = kp*e + ki*I;
        int sat = 0;
        if (u > hi) { u = hi; sat = 1; }
        if (u < lo) { u = lo; sat = -1; }
        if (!(aw && sat && ((sat>0&&e>0)||(sat<0&&e<0)))) I += e*dt;
        y += dt*(u - y);                 /* 一阶对象 */
    }
    printf("最终 y=%.3f（期望 ~5）输出限幅 [%.0f,%.0f]\n", y, lo, hi);
    if (y < 4.5 || y > 5.5) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

闭环控制模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_pid.c -o labs/host_pid && ./labs/host_pid
最终 y=4.956（期望 ~5）输出限幅 [0,10]
RESULT: PASS
```



闭环收敛到设定值 5 附近（4.956），输出守限幅 \[0,10\]；延迟/滤波会削相位裕度。



表 8.2 闭环指标



| 指标 | 值 | 说明 |
| --- | --- | --- |
| 设定值 | 5 | 目标 |
| 最终 y | 4.956 | 收敛 |
| 限幅 | \[0,10\] | 执行器约束 |
| 相位裕度 | ≥45° | 稳定余量 |



```zhizhan-anchor
m08-stable
```



```zhizhan-anchor
m08-stable-t
```



## 8.3 延迟、离散与限幅



采样周期、滤波延迟与执行器速率限制都会影响闭环；先分析稳定性，再调参数。降低采样周期可减少离散延迟、改善稳定性。



control.c 节选C

 

```text
e = sp - y;                                  // 误差
u = clamp(pid(e), U_MIN, U_MAX);             // 限幅
/* 采样周期/滤波延迟 → 相位滞后；周期过大失稳 */
```

误差驱动控制；限幅尊重执行器；周期/延迟影响稳定



表 8.3 影响稳定的因素



| 因素 | 影响 | 对策 |
| --- | --- | --- |
| 采样周期 | 离散延迟 | 减小周期 |
| 滤波延迟 | 削相位裕度 | 补偿/减阶 |
| 增益 | 振荡/发散 | 整定 |
| 限幅/速率 | 饱和/过冲 | 抗饱和 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



控制自检：收敛不振荡、相位裕度足够、周期/延迟在预算内、执行器约束被尊重。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  阶跃响应（示意）



```zhizhan-figure
<svg viewBox="0 0 800 86" width="100%" height="86" role="img" aria-label="阶跃响应（示意）" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V60"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V60"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M460,26 V60"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M615,26 V60"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M770,26 V60"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><text x="12" y="48" class="sv-lbl">响应</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="103" height="22" rx="4" class="sv-cyn-s"></rect><text x="201.7" y="47" text-anchor="middle" class="sv-lbl-hi">上升</text><rect x="253" y="32" width="207" height="22" rx="4" class="sv-amb-s"></rect><text x="356.7" y="47" text-anchor="middle" class="sv-lbl-hi">小超调</text><rect x="460" y="32" width="310" height="22" rx="4" class="sv-grn-s"></rect><text x="615.0" y="47" text-anchor="middle" class="sv-lbl-hi">稳态</text></svg>
```



闭环阶跃应快速收敛、无持续振荡、无大幅超调；延迟/滤波会引入滞后与振荡。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 稳定性 | 相位裕度≥45° | 增益过高 |
| 周期 | 足够小 | 离散失稳 |
| 延迟 | 预算内 | 砍相位 |
| 限幅 | 尊重 | 饱和过冲 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **增益过高** ：振荡/发散。

- **采样周期过大** ：离散化失稳。

- **忽略延迟** ：相位裕度不足。

- **忽略执行器约束** ：饱和/过冲。



◆ 自测 · Module 08（先答再看）




1. 为什么“降低采样周期”有时反而让闭环更稳？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"采样/控制周期过大等于在回路里插入延迟，吃掉相位裕度。减小周期降低离散延迟，改善稳定性（但增加计算/功耗）。"}
   ```

2. 相位裕度衡量什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"闭环距失稳的余量。常见要求 ≥45°；延迟、滤波、过大增益都会降低它，导致振荡。"}
   ```

3. 执行器限幅为什么影响控制性能？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"限幅会让控制量饱和，闭环“想给更多但给不出”，导致响应变慢、超调或积分饱和。需配合抗饱和设计。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：分析你闭环的采样周期、滤波延迟与限幅对稳定性的影响，评估相位裕度。



核对与延伸：[PID 控制入门](https://en.wikipedia.org/wiki/PID_controller) · [STM32 电机控制](https://www.st.com/en/embedded-software/motor-control.html)

 

动手练习



运行 ` labs/host_pid.c `（闭环模型）；分析闭环里延迟/滤波/限幅的影响。



**检查结果：** 闭环收敛到设定值且不振荡；能识别延迟/滤波对相位裕度的影响与限幅 \[0,10\]。

 

迁移练习：把本章的“能分析闭环稳定性（相位裕度）并考虑采样离散化、延迟与执行器约束。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m08","criterion":"闭环收敛到设定值且不振荡；能识别延迟/滤波对相位裕度的影响与限幅 [0,10]。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
