/* h7_m07_systick.c —— 系统节拍源 SysTick（STM32H7 / Cortex-M7）。
 * 重装载值 = 内核时钟 / 节拍频率 - 1；tick 精度与开销都源自这里。 */
#include <stdint.h>
#include "rtos_cm.h"
#include "rtos_api.h"

void h7_systick_init(uint32_t core_hz) {
    CM_SYST_RVR = (core_hz / configTICK_RATE_HZ) - 1u;
    CM_SYST_CVR = 0u;
    CM_SYST_CSR = 0x7u;                 /* ENABLE | TICKINT | CLKSOURCE */
}

/* 内核每 tick 的记账与调度入口（真实实现里做延时链表推进与切换决策） */
void SysTick_Handler(void) {
    /* 推进 tick、唤醒到期的延时任务、必要时挂起 PendSV */
}
