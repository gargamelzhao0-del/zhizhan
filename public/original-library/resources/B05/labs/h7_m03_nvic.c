/* h7_m03_nvic.c — STM32H7 中断：NVIC 与 M3 同架构，但 IRQ 更多、且有 I/D cache
 * PRIMASK/BASEPRI 仍是内核专用寄存器（MRS/MSR），与 F1 一致。 */
#include "stm32h7_regs.h"
#include <stdint.h>

#define NVIC_ISER_H7 R32(0xE000E100u)
#define NVIC_IPR_H7  ((volatile uint8_t *)0xE000E400u)
#define SCB_AIRCR_H7 R32(0xE000ED0Cu)

void h7_set_grouping(uint32_t group)
{
    SCB_AIRCR_H7 = (0x05FAu << 16) | (group & 0x7u);
}

/* EXTI0_IRQn 在 H7 上同样是 6（Cortex-M 系列一致） */
void h7_exti0_enable(void)
{
    NVIC_IPR_H7[6] = (uint8_t)(0x2u << 5);
    NVIC_ISER_H7 = (1u << 6);
}

uint32_t h7_critical_begin(void)
{
    uint32_t saved;
    __asm volatile ("mrs %0, primask" : "=r"(saved));
    __asm volatile ("cpsid i" ::: "memory");
    return saved;
}

void h7_critical_end(uint32_t saved)
{
    if (saved == 0u) { __asm volatile ("cpsie i" ::: "memory"); }
}

void h7_mask_at_or_below(uint32_t priority)
{
    __asm volatile ("msr basepri, %0" :: "r"(priority << 4) : "memory");
}
