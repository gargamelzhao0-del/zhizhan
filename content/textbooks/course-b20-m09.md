# PID 与执行器约束

```zhizhan-anchor
m09
```



PID 落地四件事： **抗饱和、限幅、微分滤波、整定** 。执行器有物理约束，控制输出必须尊重它们。

 

> 前置：理解 M08 反馈与误差，会调 P/I/D 直觉。 · ◷ 约 42 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现带抗饱和、限幅与微分滤波的 PID 并整定出可验收指标。

 

本章速览




- PID 落地：抗饱和\+限幅\+微分滤波\+整定。

- 微分对测量而非误差。

- 整定一次一参数并记录指标。

 

```zhizhan-anchor
m09-pid
```



```zhizhan-anchor
m09-pid-t
```



## 9.1 P/I/D 与落地四件事



P 响应误差、I 消除稳态误差、D 抑制变化。落地四件事：抗饱和、限幅、微分滤波、整定。执行器有物理约束，输出必须尊重。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  PID 落地链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="PID 落地链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">P/I/D</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">求和</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">限幅</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">执行器</text></svg>
```



P/I/D 求和 → 输出限幅 → 执行器；饱和时冻结积分（抗饱和）；D 对测量滤波。



表 9.1 PID 五环节



| 环节 | 作用 | 坑 |
| --- | --- | --- |
| P | 响应误差 | 过冲击振荡 |
| I | 消除稳态误差 | 饱和 windup |
| D | 抑制变化 | 噪声放大 |
| 限幅 | 尊重执行器 | 饱和 |
| 整定 | 性能 | 一次一参数 |



pid.c 节选C

 

```text
u = kp*e + ki*integ + kd*(y - y_prev);       // D 用测量微分
if (u > U_MAX) { u = U_MAX; } else if (u < U_MIN) { u = U_MIN; }
else integ += e;                              // 饱和时冻结积分（抗饱和）
```

限幅 \+ 抗饱和（冻结积分）\+ D 用测量微分



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：抗饱和与限幅



下面这段程序验证带抗饱和与限幅的闭环收敛：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_pid.cC\n\n \n\n```text\n/* host_pid.c —— PID 与执行器约束（限幅/抗饱和）（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pid.c -o host_pid && ./host_pid\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    double kp=2, ki=0.5, I=0, hi=10, lo=0;\n    double set=5, y=0, dt=0.1; int aw=1;\n    for (int i=0;i<200;i++) {\n        double e = set - y;\n        double u = kp*e + ki*I;\n        int sat = 0;\n        if (u > hi) { u = hi; sat = 1; }\n        if (u < lo) { u = lo; sat = -1; }\n        if (!(aw && sat && ((sat>0&&e>0)||(sat<0&&e<0)))) I += e*dt;\n        y += dt*(u - y);                 /* 一阶对象 */\n    }\n    printf(\"最终 y=%.3f（期望 ~5）输出限幅 [%.0f,%.0f]\\n\", y, lo, hi);\n    if (y < 4.5 || y > 5.5) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\nPID/限幅模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_pid.c -o labs/host_pid && ./labs/host_pid
最终 y=4.956（期望 ~5）输出限幅 [0,10]
RESULT: PASS
```



输出始终在限幅 \[0,10\]；抗饱和下终值 4.956 接近设定 5，无大幅超调。



表 9.2 PID 结果



| 量 | 值 | 说明 |
| --- | --- | --- |
| 设定值 | 5 | 目标 |
| 终值 | 4.956 | ≈5 |
| 限幅 | \[0,10\] | 执行器约束 |
| 抗饱和 | 冻结积分 | 防超调 |



```zhizhan-anchor
m09-tune
```



```zhizhan-anchor
m09-tune-t
```



## 9.3 抗饱和与整定



输出限幅 \+ 饱和时冻结积分（抗饱和）\+ 微分对测量滤波。整定记录超调/整定时间/稳态误差。



pid.c 节选C

 

```text
u = kp*e + ki*integ + kd*(y - y_prev);       // D 用测量微分
if (u > U_MAX) { u = U_MAX; } else if (u < U_MIN) { u = U_MIN; }
else integ += e;                              // 饱和时冻结积分（抗饱和）
```

限幅 \+ 抗饱和（冻结积分）\+ D 用测量微分



表 9.3 PID 实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 限幅 | 尊重执行器 | 饱和失真 |
| 抗饱和 | 防积分 windup | 回落超调 |
| D 用测量 | 避设定值冲击 | 微分冲击 |
| 一次一参数 | 可归因 | 多参数乱调 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



PID 自检：限幅、抗饱和、微分滤波、整定可验收。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  PID 阶跃响应指标（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="PID 阶跃响应指标（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">超调</text><rect x="150" y="26" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="43" class="sv-lbl-hi">15(相对)</text><text x="12" y="67" class="sv-lbl">整定时间</text><rect x="150" y="50" width="400" height="18" rx="4" class="sv-cyn-s"></rect><text x="558" y="67" class="sv-lbl-hi">40(相对)</text><text x="12" y="91" class="sv-lbl">稳态误差</text><rect x="150" y="74" width="50" height="18" rx="4" class="sv-grn-s"></rect><text x="208" y="91" class="sv-lbl-hi">5(相对)</text></svg>
```



整定记录超调量、整定时间、稳态误差；目标是快速收敛、超调可接受。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 限幅 | 尊重执行器 | 饱和 |
| 抗饱和 | 冻结积分 | windup |
| 微分 | 测量滤波 | 噪声放大 |
| 整定 | 记录指标 | 乱调 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **无抗饱和** ：回落大幅超调。

- **D 用误差微分** ：设定值阶跃冲击。

- **超限幅** ：执行器失真。

- **一次改多个参数** ：无法归因。



◆ 自测 · Module 09（先答再看）




1. 积分抗饱和的作用是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"执行器饱和时停止积分累积，避免回落时因积分过大而大幅超调。常配合输出限幅一起用。"}
   ```

2. 为什么 D 项常用“测量微分”而不是“误差微分”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"设定值阶跃时，误差微分会产生冲击（derivative kick），使输出突变。用测量微分可避免。"}
   ```

3. PID 整定应该怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一次只改一个参数并记录指标（超调/整定时间/稳态误差），否则无法归因。先 P、再 I、再 D。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你闭环实现带限幅与抗饱和的 PID，整定并记录超调/整定时间/稳态误差。



核对与延伸：[PID 控制入门](https://en.wikipedia.org/wiki/PID_controller)

 

动手练习



运行 ` labs/host_pid.c `：验证带抗饱和与限幅的闭环收敛。



**检查结果：** 输出始终在限幅 \[0,10\]；抗饱和下终值 y=4.956（期望 ~5）。

 

迁移练习：把本章的“能实现带抗饱和、限幅与微分滤波的 PID 并整定出可验收指标。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m09","criterion":"输出始终在限幅 [0,10]；抗饱和下终值 y=4.956（期望 ~5）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
