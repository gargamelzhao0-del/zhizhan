/* h7_m07_power.c —— H7 STOP 模式与唤醒（Cortex-M7）。
 * 进 STOP 前配置唤醒源（RTC/EXTI），唤醒后从原处继续。 */
#include "stm32_app.h"

void h7_enter_stop(void) {
    PWR_CR |= PWR_CR_LPDS;      /* 深睡时稳压器低功耗 */
    PWR_CR |= PWR_CR_CWUF;      /* 清唤醒标志 */
    __asm volatile ("wfi");     /* 等待中断唤醒 */
}
