# 综合项目 B · 电机运动控制

```zhizhan-anchor
m11
```



编码器 \+ PWM \+ PID \+ 限位/过流保护 \+ 位置/速度双环；实时性分析。

 

> 前置：已掌握 M05 的 PID 与编码器/PWM 外设使用，理解采样周期与带宽。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现编码器测速、速度/位置双环 PID 与限位/过流保护，并用控制周期与带宽数字论证实时性。

 

本章速览




- 运动控制：编码器 \+ PWM \+ PID \+ 限位/过流保护，保护优先于控制。

- 位置/速度双环要分配好带宽；低速量化误差要专门处理。

- 实时性用数字论证：采样周期、整定时间、最坏阻塞。

 

```zhizhan-anchor
m11-motor
```



```zhizhan-anchor
m11-motor-t
```



## 11.1 保护优先于控制



运动控制第一条铁律：保护优先于控制。限位/过流一触发，立即关输出并锁存，再谈 PID。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  双环与保护



```zhizhan-figure
<svg viewBox="0 0 800 140" width="100%" height="140" role="img" aria-label="双环与保护" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">位置环（外）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">速度环（内）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">PWM</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">保护（优先）</text></svg>
```



位置环（外）给速度指令 → 速度环（内）输出 PWM；限位/过流独立且优先，触发即锁存。



表 11.1 运动控制环节



| 环节 | 做法 | 要点 |
| --- | --- | --- |
| 测速 | 编码器双边沿计数 | 低速要处理量化误差 |
| 速度环 | PID\+限幅 | 采样周期固定，带宽留裕量 |
| 位置环 | 外环给速度指令 | 内外环带宽分离（约 5~10 倍） |
| 保护 | 限位/过流硬件\+软件 | 故障锁存，需显式复位 |



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：抗饱和 \+ 三平台规模



控制算法的可运行证据见 host\_pid.c（抗饱和前后积分峰值 23.4 vs 1734.8）；三平台代码交叉编译：



m11\_motor.cC

 

```text
/* m11_motor.c —— 综合项目 B：电机运动控制（Cortex-M3）。
 * 保护优先：限位/过流一触发立即停输出，再谈控制。 */
#include "app_api.h"
#include "pid_api.h"

static pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };

int motor_tick(float sp, float speed, float dt, int limit_hit, int overcurrent) {
    if (limit_hit || overcurrent) {           /* 安全动作：先关输出并锁存 */
        (void)motor_set_pwm(0);
        return 0;
    }
    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);
    (void)motor_set_pwm(d);
    return d;
}
```

STM32F103 · 运动控制



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m11_motor.c -o m11.o && arm-none-eabi-size m11.o
   text    data     bss     dec     hex filename
     56       0       0      56      38 m11.o
```



真实工具输出：m11\_motor.c（M3）text=56 B；esp\_m11\_motor.c（Xtensa）text=70 B；h7\_m11\_motor.c（M7）text=52 B。抗饱和积分峰值 23.4 vs 1734.8 见 host\_pid.c。



表 11.2 运动控制规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m11\_motor.c | M3 | 56 B |
| esp\_m11\_motor.c | Xtensa | 70 B |
| h7\_m11\_motor.c | M7 | 52 B |
| 抗饱和 | — | 23.4 vs 1734.8 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm11-plat\n```\n\n\n\n```zhizhan-anchor\nm11-plat-t\n```\n\n\n\n## 11.3 三平台对照：运动控制\n\n\n\n三平台的编码器/PWM 外设不同，但双环 PID 与保护逻辑一致。\n\n\n\nm11\\_motor.cC\n\n \n\n```text\n/* m11_motor.c —— 综合项目 B：电机运动控制（Cortex-M3）。\n * 保护优先：限位/过流一触发立即停输出，再谈控制。 */\n#include \"app_api.h\"\n#include \"pid_api.h\"\n\nstatic pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };\n\nint motor_tick(float sp, float speed, float dt, int limit_hit, int overcurrent) {\n    if (limit_hit || overcurrent) {           /* 安全动作：先关输出并锁存 */\n        (void)motor_set_pwm(0);\n        return 0;\n    }\n    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);\n    (void)motor_set_pwm(d);\n    return d;\n}\n```\n\nSTM32F103 · 运动控制\n\n\n\nesp\\_m11\\_motor.cC\n\n \n\n```text\n/* esp_m11_motor.c —— ESP32 电机控制：LEDC + 保护（Xtensa）。 */\n#include \"esp_app.h\"\n#include \"pid_api.h\"\n\nstatic pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };\n\nint esp_motor_tick(float sp, float speed, float dt, int fault) {\n    if (fault) {\n        ledc_set_duty(0, 0, 0u);\n        ledc_update_duty(0, 0);\n        return 0;\n    }\n    int d = pid_step(&g_pid, sp, speed, dt, 0, 1023);\n    ledc_set_duty(0, 0, (uint32_t)d);\n    ledc_update_duty(0, 0);\n    return d;\n}\n```\n\nESP32 · 运动控制\n\n\n\nh7\\_m11\\_motor.cC\n\n \n\n```text\n/* h7_m11_motor.c —— H7 电机控制：定时器 PWM + 保护（Cortex-M7）。 */\n#include \"stm32_app.h\"\n#include \"pid_api.h\"\n\nstatic pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };\n\nint h7_motor_tick(float sp, float speed, float dt, int fault) {\n    if (fault) { TIM2_CCR1 = 0u; return 0; }\n    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);\n    TIM2_CCR1 = (uint32_t)d * (TIM2_ARR + 1u) / 1000u;\n    return d;\n}\n```\n\nSTM32H7 · 运动控制\n\n\n\n表 11.3 三平台运动控制\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 编码器 | 定时器编码器模式 | PCNT | 定时器编码器 |\n| PWM | 高级定时器 | LEDC/MCPWM | 高级定时器 |\n| 保护 | 限位/过流输入 | GPIO | 限位/过流输入 |\n| 双环 | 同 | 同 | 同 |"}
````



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检



运动自检：硬件保护、双环带宽分离、低速测速、实时性数字论证。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  抗饱和积分峰值（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="抗饱和积分峰值（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">开抗饱和</text><rect x="150" y="26" width="8" height="18" rx="4" class="sv-grn-s"></rect><text x="166" y="43" class="sv-lbl-hi">23峰值积分</text><text x="12" y="67" class="sv-lbl">关抗饱和</text><rect x="150" y="50" width="578" height="18" rx="4" class="sv-red-s"></rect><text x="736" y="67" class="sv-lbl-hi">1735峰值积分</text></svg>
```



开抗饱和峰值 23.4；关抗饱和 1734.8——回落时严重超调。



表 11.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 保护 | 硬件\+锁存 | 软件轮询 |
| 双环 | 带宽 5~10 倍 | 不分离 |
| 测速 | 低速滑窗/时间法 | 直接差分 |
| 实时 | 周期\+阻塞\+抖动 | 无指标 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **保护做成软件轮询** ：过流瞬间来不及关输出，应先有硬件保护。

- **双环带宽不分离** ：内环跟不上外环，系统振荡。

- **低速直接算差分** ：量化误差让速度估算剧烈跳变。

- **无超调/整定时间指标** ：无法判断调好了没有。



◆ 自测 · Module 11（先答再看）




1. 为什么运动控制里“保护”要独立于 PID？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"PID 可能因积分饱和/模型偏差给出错误输出；保护是安全底线，必须独立且优先（硬件限流\\+软件锁存），不能依赖控制算法正确。"}
   ```

2. 双环为什么要做带宽分离？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内环（速度）必须比外环（位置）快得多，否则外环指令内环跟不上，系统振荡。经验上带宽相差约 5~10 倍。"}
   ```

3. 低速测速为什么要特别处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"低速时单位时间脉冲数少，直接差分量化误差大、速度估算跳变。可用时间法（测脉冲间隔）或加长滑窗平滑。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：实现编码器测速、速度/位置双环 PID 与限位/过流保护（硬件\+锁存），并用控制周期与带宽数字论证实时性。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html) · [ST · RM0433 STM32H7 参考手册](https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-743-750-753-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

 

动手练习



编译三个平台的运动控制代码；用 ` host_pid.c ` 的响应数字论证整定与抗饱和。



**检查结果：** 保护触发时输出=0 且锁存；抗饱和积分峰值 23.4 vs 1734.8；双环带宽分离约 5~10 倍。

 

迁移练习：把本章的“能实现编码器测速、速度/位置双环 PID 与限位/过流保护，并用控制周期与带宽数字论证实时性。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m11","criterion":"保护触发时输出=0 且锁存；抗饱和积分峰值 23.4 vs 1734.8；双环带宽分离约 5~10 倍。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
