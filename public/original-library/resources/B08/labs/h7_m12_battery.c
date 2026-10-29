/* h7_m12_battery.c —— H7 低功耗电池设备（Cortex-M7）。
 * standby 模式保留备份域（RTC/备份寄存器），唤醒后重新初始化。 */
#include "stm32_app.h"

void h7_battery_sleep(void) {
    PWR_CR |= PWR_CR_PDDS;      /* 进入待机：关闭主稳压器 */
    PWR_CR |= PWR_CR_CWUF;
    __asm volatile ("wfi");
}
