/* h7_m08_wdt.c —— H7 看门狗与复位原因分析（Cortex-M7）。 */
#include "stm32_app.h"

/* 复位原因决定自恢复策略：看门狗复位要计数并对相关任务限次重启 */
uint32_t h7_reset_flags(void) { return RCC_CSR; }
int h7_was_watchdog_reset(uint32_t flags) {
    return (flags & (1u << 29)) ? 1 : 0;    /* IWDGRSTF */
}
