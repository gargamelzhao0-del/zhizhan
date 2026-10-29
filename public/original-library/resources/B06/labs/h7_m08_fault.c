/* h7_m08_fault.c —— 抓取 HardFault 现场（STM32H7 / Cortex-M7）。
 * CFSR/HFSR/MMFAR/BFAR 是内核调试寄存器，能把“跑飞”定位到具体原因与地址。 */
#include <stdint.h>

#define CFSR  (*(volatile uint32_t *)0xE000ED28u)   /* 可配置错误状态 */
#define HFSR  (*(volatile uint32_t *)0xE000ED2Cu)   /* 硬错误状态 */
#define MMFAR (*(volatile uint32_t *)0xE000ED34u)   /* MemManage 出错地址 */
#define BFAR  (*(volatile uint32_t *)0xE000ED38u)   /* BusFault 出错地址 */

volatile uint32_t g_fault[4];

void HardFault_Handler(void) {
    g_fault[0] = CFSR;
    g_fault[1] = HFSR;
    g_fault[2] = MMFAR;
    g_fault[3] = BFAR;
    for (;;) { }        /* 断在这里，用调试器读 g_fault */
}
