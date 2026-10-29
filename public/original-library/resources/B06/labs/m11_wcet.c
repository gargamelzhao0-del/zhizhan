/* m11_wcet.c —— 用 DWT 周期计数器测 WCET（Cortex-M3）。
 * WCET 关注“最坏一次”，不是平均；要用能覆盖最坏输入/分支的测试。 */
#include <stdint.h>
#include "rtos_cm.h"

#define DEMCR      (*(volatile uint32_t *)0xE000EDFCu)
#define DWT_CYCCNT (*(volatile uint32_t *)0xE0001004u)

volatile uint32_t g_wcet_cycles;

void m11_wcet_on(void) { DEMCR |= (1u << 24); DWT_CYCCNT = 0u; }

void m11_wcet_sample(uint32_t (*job)(void)) {
    uint32_t t0 = DWT_CYCCNT;
    (void)job();
    uint32_t dt = DWT_CYCCNT - t0;
    if (dt > g_wcet_cycles) { g_wcet_cycles = dt; }   /* 取最大，不是平均 */
}
