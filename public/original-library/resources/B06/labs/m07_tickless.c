/* m07_tickless.c —— tickless 空闲：睡到“下一个到期事件”（Cortex-M3）。
 * 空闲时关掉周期 tick，改用低功耗定时器设一个唤醒点；代价是 tick 与硬件计时器的换算。 */
#include <stdint.h>
#include "rtos_api.h"

extern void mcu_rtc_set_wake(uint32_t ticks);
extern void mcu_enter_stop(uint32_t wake_in_ticks);

/* 这是 FreeRTOS 的弱钩子：内核在空闲够久时调用它来决定睡眠时长 */
void vPortSuppressTicksAndSleep(TickType_t idle_ticks) {
    if (idle_ticks > 2u) {          /* 睡太短不划算，直接数 tick */
        mcu_rtc_set_wake(idle_ticks);
        mcu_enter_stop(idle_ticks);
    }
}
