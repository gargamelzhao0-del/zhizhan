/* h7_m05_basepri.c —— 用 BASEPRI 做临界区（STM32H7 / Cortex-M7）。
 * 阈值以下（更紧急）的中断不被屏蔽；比 PRIMASK 关所有中断更适合实时系统。 */
#include <stdint.h>
#include "rtos_cm.h"

static volatile uint32_t g_counter;

uint32_t h7_atomic_inc(void) {
    uint32_t saved = cm_enter_critical();
    g_counter++;
    uint32_t v = g_counter;
    cm_exit_critical(saved);
    return v;
}

/* 读的是同一个共享量：与自增互斥 */
uint32_t h7_atomic_read(void) {
    uint32_t saved = cm_enter_critical();
    uint32_t v = g_counter;
    cm_exit_critical(saved);
    return v;
}
