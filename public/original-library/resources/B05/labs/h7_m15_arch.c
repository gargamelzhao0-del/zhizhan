/* h7_m15_arch.c — B05-M15 ISA/结构（STM32H7 / Cortex-M7）
 * M7 是双发射顺序核 + I/D cache + 域（D1/D2/D3）地址空间；指令仍为 Thumb-2。 */
#include "stm32h7_regs.h"

int h7_add_mul(int a, int b, int c) { return a + b * c; }   /* 用于反汇编对照 */

void h7_relocate_vectors(const void *table)
{
    R32(0xE000ED08u) = (uint32_t)(uintptr_t)table;   /* SCB->VTOR */
    h7_dsb();
    h7_isb();
}

/* M7 的 cache 是“结构”的一部分：开启后 DMA 与 CPU 的一致性、以及 self-modifying 都要管 */
void h7_arch_enable_caches(void)
{
    H7_SCB_CCR |= H7_SCB_CCR_ICACHE | H7_SCB_CCR_DCACHE;
    h7_dsb();
    h7_isb();
}
