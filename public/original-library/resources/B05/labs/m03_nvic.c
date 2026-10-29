/* m03_nvic.c — B05-M03 中断与 NVIC
 * 优先级分组、EXTI 按键中断、PRIMASK/BASEPRI 临界区。
 * 关键事实：PRIMASK/BASEPRI 是内核“专用寄存器”，不是内存映射，必须用 MRS/MSR。 */
#include "stm32f103_regs.h"

#define EXTI0_IRQN 6u   /* STM32F103 的 EXTI0 中断号 */

void nvic_set_priority_grouping(uint32_t group)
{
    /* AIRCR.PRIGROUP：0=1 位抢占/7 位子优先级 … 7=7 位抢占/1 位子优先级 */
    SCB_AIRCR = AIRCR_VECTKEY | (group & 0x7u);
}

void exti0_button_init(void)
{
    RCC_APB2ENR |= RCC_APB2ENR_AFIOEN;
    AFIO_EXTICR1 = (AFIO_EXTICR1 & ~0xFu) | 0x0u; /* PA0 → EXTI0 */
    EXTI_FTSR |= (1u << 0);                        /* 下降沿触发 */
    EXTI_IMR  |= (1u << 0);                        /* 不屏蔽 */
    NVIC_IPR[EXTI0_IRQN] = (uint8_t)(0x2u << 5);   /* 优先级 2（数值越小越紧急） */
    NVIC_ISER = (1u << EXTI0_IRQN);                /* 使能 IRQ */
}

void EXTI0_IRQHandler(void)
{
    if (EXTI_PR & 1u) {
        EXTI_PR = 1u; /* 写 1 清挂起位（写 0 无效，这是最常见的“中断只进一次”原因） */
    }
}

/* 通用临界区：保存-关闭-恢复，避免嵌套时错误地打开中断 */
uint32_t critical_begin(void)
{
    uint32_t saved = b05_get_primask();
    b05_disable_irq();
    b05_dsb();
    return saved;
}

void critical_end(uint32_t saved)
{
    if (saved == 0u) {
        b05_enable_irq(); /* 只在原本开中断时才恢复 */
    }
}

/* BASEPRI：屏蔽“优先级数值 ≥ threshold”的中断，保留更高优先级（数值更小）的实时性。
 * 传 0 等于关闭屏蔽。RTOS 用它把临界区限制在 configMAX_SYSCALL_INTERRUPT_PRIORITY 之内。 */
void mask_at_or_below(uint32_t threshold)
{
    b05_set_basepri(threshold << 4); /* 优先级值需左移到 BASEPRI 的高 4 位 */
}

int in_handler_mode(void) { return b05_get_ipsr() != 0u; }
