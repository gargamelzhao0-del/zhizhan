# 控制算法落地

```zhizhan-anchor
m05
```



PID 离散化、积分饱和与抗饱和、微分先行、死区与限幅、参数整定方法、非线性补偿；有刷/BLDC 基础。

 

> 前置：理解 PID 公式与采样周期 dt 的关系，会用定时器产生固定控制周期。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把 PID 离散化落地，实现抗饱和、输出限幅与微分滤波/微分先行，并用积分峰值与超调判定整定。

 

本章速览




- PID 落地要点：离散化、积分抗饱和、输出限幅、微分滤波（微分先行）。

- 整定时每次只改一个参数，并记录超调/整定时间/稳态误差。

- 不可达目标、模型偏差与整定问题要能区分，别一律怪 PID。

 

```zhizhan-anchor
m05-pid
```



```zhizhan-anchor
m05-pid-t
```



## 5.1 PID 落地的四步



PID 从公式到落地有四步：离散化（用采样周期 dt）、抗饱和（执行器饱和时抑制积分）、限幅（输出到执行器范围）、微分滤波/微分先行（避免设定值阶跃冲击）。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  抗饱和：积分峰值对比（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="抗饱和：积分峰值对比（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">开抗饱和</text><rect x="150" y="26" width="8" height="18" rx="4" class="sv-grn-s"></rect><text x="166" y="43" class="sv-lbl-hi">23.4峰值积分</text><text x="12" y="67" class="sv-lbl">关抗饱和</text><rect x="150" y="50" width="578" height="18" rx="4" class="sv-red-s"></rect><text x="736" y="67" class="sv-lbl-hi">1734.8峰值积分</text></svg>
```



设定 150 不可达再回落 40；关抗饱和积分爆表到 1734.8，回落时严重超调；开抗饱和峰值仅 23.4。



表 5.1 PID 落地问题



| 问题 | 现象 | 处理 |
| --- | --- | --- |
| 积分饱和 | 执行器顶死后积分累积，回落超调 | 饱和且同号时停止积分 |
| 微分噪声 | 测量噪声被放大，输出抖动 | 对测量微分\+低通滤波 |
| 死区 | 小误差时执行器抖动 | 加死区或迟滞 |
| 限幅 | 输出超出执行器范围 | u 截断到 \[min,max\] |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：抗饱和前后



下面这段主机程序让执行器饱和再回落，比较开/关抗饱和的积分峰值与最终误差：



host\_pid.cC

 

```text
/* host_pid.c —— 离散 PID 与积分抗饱和（主机可运行）。
 *
 * 被控对象：一阶加热模型 y' = (K·u − y)/tau，u∈[0,1]，K=100 → u=0.5 时稳态 50℃。
 * 对比：关闭抗饱和时执行器饱和期间积分无界累积（windup），回落设定后大幅超调；
 *       开启抗饱和（饱和且误差同号时停止积分）后积分有界、回落平顺。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pid.c -o host_pid && ./host_pid
 */
#include <stdio.h>

typedef struct { double kp, ki; double I, last_e; int use_aw; } pid_t;

static double pid_step(pid_t *p, double sp, double y, double dt, int *sat) {
    double e = sp - y;
    double P = p->kp * e;
    double u = P + p->ki * p->I;          /* I = ∫e dt（积分状态） */
    *sat = 0;
    if (u > 1.0) { u = 1.0; *sat = 1; }
    if (u < 0.0) { u = 0.0; *sat = -1; }
    /* 抗饱和：饱和且误差会把执行器推得更满时，停止积分 */
    int freeze = p->use_aw && (*sat != 0) && ((*sat > 0 && e > 0) || (*sat < 0 && e < 0));
    if (!freeze) p->I += e * dt;
    p->last_e = e;
    return u;
}

static void run(int use_aw, double sp1, double sp2, double *peak_I, double *max_y_after2, int *within) {
    pid_t p = {0.03, 0.02, 0.0, 0.0, use_aw};
    double y = 0.0, dt = 0.05, K = 100.0, tau = 8.0, peak = 0.0, after2max = 0.0;
    int i, sat;
    for (i = 0; i < 400; i++) {                 /* 阶段 1：设定 sp1（可能不可达→饱和） */
        double u = pid_step(&p, sp1, y, dt, &sat);
        y += dt * (K * u - y) / tau;
        if (p.I > peak) peak = p.I;
    }
    for (i = 0; i < 400; i++) {                 /* 阶段 2：回落到 sp2 */
        double u = pid_step(&p, sp2, y, dt, &sat);
        y += dt * (K * u - y) / tau;
        if (y > after2max) after2max = y;
        if (p.I > peak) peak = p.I;
    }
    *peak_I = peak;
    *max_y_after2 = after2max;
    *within = (y > sp2 - 2.0 && y < sp2 + 2.0);
}

int main(void) {
    double peak_on, peak_off, ymax_on, ymax_off;
    int ok_on, ok_off;
    run(1, 150.0, 40.0, &peak_on, &ymax_on, &ok_on);    /* 开抗饱和 */
    run(0, 150.0, 40.0, &peak_off, &ymax_off, &ok_off); /* 关抗饱和 */

    printf("设定 150 不可达（执行器上限），再回落到 40：\n");
    printf("  开抗饱和：峰值积分=%.1f  回落后峰值 y=%.1f  最终在 40±2 内=%d\n", peak_on, ymax_on, ok_on);
    printf("  关抗饱和：峰值积分=%.1f  回落后峰值 y=%.1f  最终在 40±2 内=%d\n", peak_off, ymax_off, ok_off);

    int ok = 1;
    if (!ok_on) ok = 0;
    if (!(peak_off > peak_on * 1.5)) ok = 0;    /* 无抗饱和积分明显更大 */
    if (!(ymax_off > ymax_on + 2.0)) ok = 0;    /* 无抗饱和回落超调更大 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

PID 抗饱和模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_pid.c -o labs/host_pid && ./labs/host_pid
设定 150 不可达（执行器上限），再回落到 40：
  开抗饱和：峰值积分=23.4  回落后峰值 y=91.3  最终在 40±2 内=1
  关抗饱和：峰值积分=1734.8  回落后峰值 y=99.3  最终在 40±2 内=0
RESULT: PASS
```



开抗饱和积分峰值 23.4、最终收敛（=1）；关抗饱和峰值 1734.8、无法收敛（=0）。



表 5.2 抗饱和结果



| 配置 | 峰值积分 | 最终 40±2 |
| --- | --- | --- |
| 开抗饱和 | 23.4 | 1 |
| 关抗饱和 | 1734.8 | 0 |
| 结论 | — | 抗饱和必须 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm05-plat\n```\n\n\n\n```zhizhan-anchor\nm05-plat-t\n```\n\n\n\n## 5.3 三平台对照：PID 与外设\n\n\n\n三平台的定时器/PWM/ADC 不同，但离散 PID 与抗饱和逻辑一致。\n\n\n\nm05\\_pid.cC\n\n \n\n```text\n/* m05_pid.c —— 离散 PID 与抗饱和（Cortex-M3）。 */\n#include \"app_api.h\"\n#include \"pid_api.h\"\n\nint pid_step(pid_t *p, float sp, float y, float dt, int out_min, int out_max) {\n    float e = sp - y;\n    p->I += e * dt;                                   /* 积分 */\n    float u = p->kp * e + p->ki * p->I + p->kd * (e - p->last_e) / dt;\n    p->last_e = e;\n    int uu = (int)u, sat = 0;\n    if (uu > out_max) { uu = out_max; sat = 1; }\n    if (uu < out_min) { uu = out_min; sat = -1; }\n    if (sat && ((sat > 0 && e > 0) || (sat < 0 && e < 0))) p->I -= e * dt;  /* 抗饱和回退 */\n    return uu;\n}\n```\n\nSTM32F103 · PID\n\n\n\nesp\\_m05\\_pid.cC\n\n \n\n```text\n/* esp_m05_pid.c —— ESP32 速度环 + LEDC PWM（Xtensa）。 */\n#include \"esp_app.h\"\n#include \"pid_api.h\"\n\nstatic pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };\n\nint esp_motor_ctrl(float sp, float speed, float dt) {\n    int duty = pid_step(&g_pid, sp, speed, dt, 0, 1023);\n    ledc_set_duty(0, 0, (uint32_t)duty);\n    ledc_update_duty(0, 0);\n    return duty;\n}\n```\n\nESP32 · PID\n\n\n\nh7\\_m05\\_pid.cC\n\n \n\n```text\n/* h7_m05_pid.c —— H7 速度环 + 定时器 PWM + 编码器（Cortex-M7）。 */\n#include \"pid_api.h\"\n#include \"stm32_app.h\"\n\nstatic pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };\n\nint h7_motor_ctrl(float sp, float speed, float dt) {\n    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);\n    TIM2_CCR1 = (uint32_t)d * (TIM2_ARR + 1u) / 1000u;   /* 千分比 → 比较值 */\n    return d;\n}\n```\n\nSTM32H7 · PID\n\n\n\n表 5.3 三平台 PID\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 周期 | 定时器 | 定时器/task | 定时器 |\n| 输出 | PWM | LEDC/PWM | PWM |\n| 反馈 | ADC | ADC | ADC |\n| 抗饱和 | 同 | 同 | 同 |"}
````



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



控制自检：固定周期、抗饱和、限幅、微分滤波、只改一个参数。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  抗饱和抑制回落超调



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="抗饱和抑制回落超调" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M299,26 V94"></path><text x="299" y="18" text-anchor="middle" class="sv-lbl-dim">12</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">25</text><path class="sv-dash" d="M621,26 V94"></path><text x="621" y="18" text-anchor="middle" class="sv-lbl-dim">38</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">50</text><text x="12" y="48" class="sv-lbl">关抗饱和</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="248" height="22" rx="4" class="sv-red-s"></rect><text x="274.0" y="47" text-anchor="middle" class="sv-lbl-hi">饱和</text><rect x="398" y="32" width="372" height="22" rx="4" class="sv-red-s"></rect><text x="584.0" y="47" text-anchor="middle" class="sv-lbl-hi">大超调</text><text x="12" y="82" class="sv-lbl">开抗饱和</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="248" height="22" rx="4" class="sv-amb-s"></rect><text x="274.0" y="81" text-anchor="middle" class="sv-lbl-hi">饱和</text><rect x="398" y="66" width="372" height="22" rx="4" class="sv-grn-s"></rect><text x="584.0" y="81" text-anchor="middle" class="sv-lbl-hi">平稳</text></svg>
```



饱和期间冻结积分；目标回落后输出平稳跟进，不出现大幅超调/振荡。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 周期 | 固定 dt | 漂移 |
| 抗饱和 | 饱和同号冻结 | 无抗饱和 |
| 限幅 | 截断 \[min,max\] | 溢出 |
| 整定 | 一次改一个 | 碰运气 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **无抗饱和** ：执行器饱和后积分爆表，回落时严重超调甚至振荡。

- **对误差直接微分** ：设定值阶跃时微分冲击，输出尖峰。

- **输出不限幅** ：PWM 比较值溢出或超出范围，行为不可预测。

- **一次改多个参数** ：无法归因，整定变成碰运气。



◆ 自测 · Module 05（先答再看）




1. 为什么抗饱和要在“饱和且误差把输出推得更满”时才停止积分？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"如果误差方向已能让输出退出饱和（目标已回落），继续积分有助于尽快退出；只有当误差继续把执行器推向更满时才冻结积分，才能兼顾响应与抑制 windup。"}
   ```

2. 用 host\_pid.c 的数字说明抗饱和的必要性。
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"关抗饱和时积分峰值 1734.8，回落时严重超调无法收敛（40±2 内=0）；开抗饱和峰值仅 23.4 且收敛（=1）。"}
   ```

3. 为什么微分要“先行/对测量微分”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"对误差直接微分会在设定值阶跃时产生冲击。对测量值微分加低通，可抑制噪声放大并避免设定值突变引起的微分尖峰。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的控制环实现固定周期、抗饱和、输出限幅与微分滤波，并用积分峰值/超调数字记录整定过程（一次改一个参数）。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html)

 

动手练习



运行 ` labs/host_pid.c `：设定不可达目标使执行器饱和再回落，比较开/关抗饱和。



**检查结果：** 开抗饱和峰值积分 23.4、最终在 40±2 内=1；关抗饱和峰值积分 1734.8、最终在 40±2 内=0。

 

迁移练习：把本章的“能把 PID 离散化落地，实现抗饱和、输出限幅与微分滤波/微分先行，并用积分峰值与超调判定整定。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m05","criterion":"开抗饱和峰值积分 23.4、最终在 40±2 内=1；关抗饱和峰值积分 1734.8、最终在 40±2 内=0。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
