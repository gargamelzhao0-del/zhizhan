/* h7_m04_timer.c — STM32H7 定时器：通用定时器寄存器布局与 F1 相同，但时钟更高
 * H7 的 TIM2/3/4 是 32 位计数器；时钟来自 APB1 且同样受“预分频≠1 则 ×2”规则影响。 */
#include "stm32h7_regs.h"

#define H7_TIM2_CR1   R32(0x40000000u)
#define H7_TIM2_EGR   R32(0x40000014u)
#define H7_TIM2_CCMR1 R32(0x40000018u)
#define H7_TIM2_CCER  R32(0x40000020u)
#define H7_TIM2_CNT   R32(0x40000024u)
#define H7_TIM2_PSC   R32(0x40000028u)
#define H7_TIM2_ARR   R32(0x4000002Cu)
#define H7_TIM2_CCR1  R32(0x40000034u)
#define H7_TIM2EN     (1u << 0)

void h7_tim2_pwm_init(uint32_t tim_clk, uint32_t pwm_hz)
{
    H7_RCC_APB1LENR |= H7_TIM2EN;
    H7_TIM2_PSC = tim_clk / 1000000u - 1u;      /* 1 MHz 计数 */
    H7_TIM2_ARR = 1000000u / pwm_hz - 1u;
    H7_TIM2_CCMR1 = (0x6u << 4) | (1u << 3);    /* PWM1 + 预装载 */
    H7_TIM2_CCR1 = 0u;
    H7_TIM2_CCER = 1u;
    H7_TIM2_EGR = 1u;                            /* UG：装载 PSC/ARR */
    H7_TIM2_CR1 = (1u << 7) | (1u << 0);        /* ARPE | CEN */
}

void h7_tim2_duty(uint16_t permille)
{
    if (permille > 1000u) { permille = 1000u; }
    H7_TIM2_CCR1 = (uint32_t)permille * (H7_TIM2_ARR + 1u) / 1000u;
}

/* 32 位计数是 H7 相对 F1（16 位）的实在优势：低频测速不必频繁处理溢出 */
uint32_t h7_tim2_count32(void) { return H7_TIM2_CNT; }
