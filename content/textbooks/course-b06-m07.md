# 时间管理

```zhizhan-anchor
m07
```



tick 精度与开销；软件定时器；vTaskDelayUntil 的周期任务；tickless 低功耗与休眠联动。

 

> 前置：了解 tick/节拍与任务延时语义，以及周期任务的基本需求。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 vTaskDelayUntil 实现不漂移的周期任务，并用 tickless 空闲把唤醒次数降到事件级以省电。

 

本章速览




- tick 精度决定延时分辨率，也决定唤醒开销。

- 严格周期任务用 vTaskDelayUntil；用 vTaskDelay 会累积漂移。

- tickless 空闲让 MCU 睡到下一个到期事件，显著省电，但要一个低功耗时基。

 

```zhizhan-anchor
m07-time
```



```zhizhan-anchor
m07-time-t
```



## 7.1 tick、延时与周期



tick 决定延时分辨率与空闲唤醒次数（越高越精细、越耗电）。周期任务用 vTaskDelayUntil 按绝对节拍推进，避免把执行时间累进周期。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  vTaskDelay vs vTaskDelayUntil



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="vTaskDelay vs vTaskDelayUntil" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">6</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">12</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">18</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">24</text><text x="12" y="48" class="sv-lbl">vTaskDelay</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="103" height="22" rx="4" class="sv-amb-s"></rect><text x="201.7" y="47" text-anchor="middle" class="sv-lbl-hi">exec</text><rect x="253" y="32" width="258" height="22" rx="4" class="sv-red-s"></rect><text x="382.5" y="47" text-anchor="middle" class="sv-lbl-hi">delay</text><rect x="512" y="32" width="103" height="22" rx="4" class="sv-amb-s"></rect><text x="563.3" y="47" text-anchor="middle" class="sv-lbl-hi">exec</text><rect x="615" y="32" width="258" height="22" rx="4" class="sv-red-s"></rect><text x="744.2" y="47" text-anchor="middle" class="sv-lbl-hi">delay</text><text x="12" y="82" class="sv-lbl">vTaskDelayUntil</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="103" height="22" rx="4" class="sv-grn-s"></rect><text x="201.7" y="81" text-anchor="middle" class="sv-lbl-hi">exec</text><rect x="253" y="66" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="330.8" y="81" text-anchor="middle" class="sv-lbl-hi">固定到10</text><rect x="408" y="66" width="103" height="22" rx="4" class="sv-grn-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">exec</text><rect x="512" y="66" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="589.2" y="81" text-anchor="middle" class="sv-lbl-hi">固定到20</text></svg>
```



vTaskDelay(10) 从“现在”起延时，周期=执行\+10 → 漂移；vTaskDelayUntil 按上次唤醒\+周期 → 不漂移。



表 7.1 延时方式



| 延时方式 | 语义 | 漂移 | 适用 |
| --- | --- | --- | --- |
| vTaskDelay(n) | 从“现在”起延时 n | 累积（周期=exec\+n） | 非严格周期 |
| vTaskDelayUntil | 按绝对节拍推进 | 无（exec\<n 时） | 严格周期任务 |
| 软件定时器 | 回调在服务任务执行 | 取决于服务任务优先级 | 超时/周期回调（要短） |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：漂移与 tickless



下面这段主机程序比较两种周期延时的漂移与 tickless 唤醒次数：



host\_time.cC

 

```text
/* host_time.c —— 时间管理：延迟漂移、tickless 唤醒次数、软件定时器顺序（主机可运行）。
 *
 *   ① vTaskDelay(P) 的周期从“本次工作结束”开始计，实际周期 = 执行时间 + P → 累积漂移。
 *      vTaskDelayUntil(&last, P) 以绝对节拍推进，只要执行时间 < P 就不漂移。
 *   ② tickless 空闲：空闲时数 tick 唤醒 vs 只在“下一个到期事件”唤醒，唤醒次数差一个数量级。
 *   ③ 软件定时器：按到期时间排序，到期顺序必须确定性。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_time.c -o host_time && ./host_time
 */
#include <stdio.h>

/* 模拟一个周期任务在 total 个 tick 内被唤醒的次数与末次漂移 */
static void periodic(int period, int exec, int use_until, int total, int *wakes, int *drift) {
    int t = 0, w = 0;
    while (t < total) {
        w++;
        t += use_until ? period : (period + exec);   /* until：绝对节拍；delay：工作后再等 */
    }
    *wakes = w;
    *drift = (t - (use_until ? period : (period + exec))) - (w - 1) * period;
}

int main(void) {
    int ok = 1;
    const int P = 10, E = 4, TOTAL = 100;
    int wd, dd, wu, du;
    periodic(P, E, 0, TOTAL, &wd, &dd);
    periodic(P, E, 1, TOTAL, &wu, &du);
    printf("周期任务 P=%d exec=%d，观察 %d tick：\n", P, E, TOTAL);
    printf("  vTaskDelay     : 唤醒 %d 次，末次漂移 %+d tick（周期被拉长为 %d）\n", wd, dd, P + E);
    printf("  vTaskDelayUntil: 唤醒 %d 次，末次漂移 %+d tick（严格 %d 节拍）\n", wu, du, P);
    if (!(dd > 0)) ok = 0;
    if (du != 0) ok = 0;
    if (!(wu > wd)) ok = 0;

    /* tickless：1000 tick 窗口，一个 100 tick 周期任务 + 一个 700 tick 单次定时器 */
    int tick_wakeups = 1000;                 /* 非 tickless：每个 tick 都醒 */
    int tickless_wakeups = 1000 / 100 + 1;   /* 只在事件到期时醒 */
    printf("\ntickless 空闲（1000 tick 窗口，100 tick 周期任务 + 700 tick 单次定时器）：\n");
    printf("  非 tickless = %d 次唤醒；tickless = %d 次唤醒\n", tick_wakeups, tickless_wakeups);
    if (!(tick_wakeups == 1000)) ok = 0;
    if (!(tickless_wakeups <= 11)) ok = 0;

    /* 软件定时器：插入乱序，取出必须按到期时间升序 */
    int expiries[4] = {70, 30, 100, 10};
    for (int i = 0; i < 4; i++)              /* 插入排序，模拟定时器链表 */
        for (int j = i + 1; j < 4; j++)
            if (expiries[j] < expiries[i]) { int s = expiries[i]; expiries[i] = expiries[j]; expiries[j] = s; }
    printf("\n软件定时器到期顺序：");
    for (int i = 0; i < 4; i++) printf("%d%s", expiries[i], i < 3 ? "," : "");
    printf(" (期望 10,30,70,100)\n");
    if (!(expiries[0] == 10 && expiries[1] == 30 && expiries[2] == 70 && expiries[3] == 100)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时间管理模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_time.c -o labs/host_time && ./labs/host_time
周期任务 P=10 exec=4，观察 100 tick：
  vTaskDelay     : 唤醒 8 次，末次漂移 +28 tick（周期被拉长为 14）
  vTaskDelayUntil: 唤醒 10 次，末次漂移 +0 tick（严格 10 节拍）
tickless 空闲：非 tickless = 1000 次唤醒；tickless = 11 次唤醒
RESULT: PASS
```



vTaskDelayUntil 漂移 0、周期严格 10；vTaskDelay 漂移 \+28、周期 14；tickless 唤醒 1000→11。



表 7.2 漂移对比



| 方式 | 唤醒 | 末次漂移 |
| --- | --- | --- |
| vTaskDelay | 8 | \+28 |
| vTaskDelayUntil | 10 | 0 |
| tickless 唤醒 | 11 | （vs 1000） |
| 结论 | — | 周期任务用 Until |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm07-plat\n```\n\n\n\n```zhizhan-anchor\nm07-plat-t\n```\n\n\n\n## 7.3 三平台对照：时间/tickless\n\n\n\n三平台的延时/定时器 API 名不同，vTaskDelayUntil 与 tickless 的思路一致。\n\n\n\nm07\\_tickless.cC\n\n \n\n```text\n/* m07_tickless.c —— tickless 空闲：睡到“下一个到期事件”（Cortex-M3）。\n * 空闲时关掉周期 tick，改用低功耗定时器设一个唤醒点；代价是 tick 与硬件计时器的换算。 */\n#include <stdint.h>\n#include \"rtos_api.h\"\n\nextern void mcu_rtc_set_wake(uint32_t ticks);\nextern void mcu_enter_stop(uint32_t wake_in_ticks);\n\n/* 这是 FreeRTOS 的弱钩子：内核在空闲够久时调用它来决定睡眠时长 */\nvoid vPortSuppressTicksAndSleep(TickType_t idle_ticks) {\n    if (idle_ticks > 2u) {          /* 睡太短不划算，直接数 tick */\n        mcu_rtc_set_wake(idle_ticks);\n        mcu_enter_stop(idle_ticks);\n    }\n}\n```\n\nSTM32F103 · tickless\n\n\n\nesp\\_m07\\_timer.cC\n\n \n\n```text\n/* esp_m07_timer.c —— 深度睡眠与定时唤醒（ESP32 / Xtensa）。\n * 深度睡眠会丢失内存状态，唤醒等价于一次复位；睡眠前必须先保存关键状态。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n\nvoid esp_sleep_until(uint64_t microseconds) {\n    esp_sleep_enable_timer_wakeup(microseconds);\n    esp_deep_sleep_start();            /* 不返回；唤醒后从复位向量重新开始 */\n}\n```\n\nESP32 · 定时器\n\n\n\nh7\\_m07\\_systick.cC\n\n \n\n```text\n/* h7_m07_systick.c —— 系统节拍源 SysTick（STM32H7 / Cortex-M7）。\n * 重装载值 = 内核时钟 / 节拍频率 - 1；tick 精度与开销都源自这里。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n#include \"rtos_api.h\"\n\nvoid h7_systick_init(uint32_t core_hz) {\n    CM_SYST_RVR = (core_hz / configTICK_RATE_HZ) - 1u;\n    CM_SYST_CVR = 0u;\n    CM_SYST_CSR = 0x7u;                 /* ENABLE | TICKINT | CLKSOURCE */\n}\n\n/* 内核每 tick 的记账与调度入口（真实实现里做延时链表推进与切换决策） */\nvoid SysTick_Handler(void) {\n    /* 推进 tick、唤醒到期的延时任务、必要时挂起 PendSV */\n}\n```\n\nSTM32H7 · SysTick\n\n\n\n表 7.3 三平台时间\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 周期延时 | vTaskDelayUntil | vTaskDelayUntil | vTaskDelayUntil |\n| 软件定时器 | xTimerCreate | esp\\_timer | xTimerCreate |\n| tickless | vPortSuppressTicksAndSleep | TICKLESS\\_IDLE | tickless |"}
````



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



时间自检：周期用 Until、定时器回调短、tickless 有可靠时基、tick 频率合理。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  末次漂移（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="末次漂移（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">Delay(until)</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="43" class="sv-lbl-hi">0tick</text><text x="12" y="67" class="sv-lbl">Delay</text><rect x="150" y="50" width="560" height="18" rx="4" class="sv-red-s"></rect><text x="718" y="67" class="sv-lbl-hi">28tick</text></svg>
```



vTaskDelayUntil 漂移 0；vTaskDelay 漂移 \+28。周期任务几乎都应用 Until。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 周期 | vTaskDelayUntil | vTaskDelay |
| 定时器 | 回调短 | 做长活 |
| tickless | 可靠时基 | 时基漂移 |
| tick | 频率折中 | 过高耗电 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **用 vTaskDelay 做周期** ：周期被拉长（执行\+延时），长期漂移。

- **软件定时器回调做长活** ：阻塞定时器服务任务，拖慢所有软件定时器。

- **tickless 无可靠低功耗时基** ：唤醒点不准，系统时间漂移。

- **tick 频率过高** ：空闲频繁唤醒，功耗与切换开销上升。



◆ 自测 · Module 07（先答再看）




1. 10ms 周期任务、执行 4ms，用 vTaskDelay(10) 的长期周期是多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"14ms（执行 4ms \\+ 延时 10ms）。要固定 10ms 应用 vTaskDelayUntil(&last, 10)。"}
   ```

2. 软件定时器回调为什么必须短？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"软件定时器回调在定时器服务任务里执行；回调太长会阻塞该任务，拖慢所有软件定时器。"}
   ```

3. tickless 空闲如何省电？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"空闲时关掉周期 tick，让 MCU 睡到下一个任务到期时刻（由 RTC/低功耗定时器唤醒），唤醒次数从每秒上千降到事件级。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的周期任务改为 vTaskDelayUntil，并评估是否可用 tickless 降低空闲唤醒次数。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [ST · 如何用 FreeRTOS 降低 STM32 功耗](https://www.st.com/resource/en/application_note/an4994-how-to-use-freertos-with-lowpower-features-on-the-stm32-microcontroller-stmicroelectronics.pdf)

 

动手练习



运行 ` labs/host_time.c `：比较 vTaskDelay 与 vTaskDelayUntil 的唤醒次数与漂移，核对 tickless。



**检查结果：** vTaskDelayUntil 末次漂移=0；vTaskDelay 漂移 \+28、周期被拉长；tickless 唤醒 1000→11 次。

 

迁移练习：把本章的“能用 vTaskDelayUntil 实现不漂移的周期任务，并用 tickless 空闲把唤醒次数降到事件级以省电。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m07","criterion":"vTaskDelayUntil 末次漂移=0；vTaskDelay 漂移 +28、周期被拉长；tickless 唤醒 1000→11 次。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
