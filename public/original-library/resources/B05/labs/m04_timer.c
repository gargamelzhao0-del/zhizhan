/* m04_timer.c — B05-M04 定时器
 * TIM2：PWM 呼吸灯（PSC/ARR 计算）；TIM3：编码器模式读位置。
 * 关键事实：APB1 预分频≠1 时，定时器时钟 = APB1 时钟 ×2（F1 的时钟树细节）。 */
#include "stm32f103_regs.h"

/* sysclk_hz=72MHz，APB1=36MHz，故 TIM2 计数时钟 = 72MHz（×2） */
void tim2_pwm_init(uint32_t sysclk_hz, uint32_t pwm_hz)
{
    RCC_APB1ENR |= RCC_APB1ENR_TIM2EN;

    uint32_t tim_clk = sysclk_hz;             /* 已按 ×2 处理 */
    uint32_t psc = tim_clk / 1000000u - 1u;   /* 计数频率 1 MHz → 1 µs 步进 */
    uint32_t arr = 1000000u / pwm_hz - 1u;    /* PWM 周期 */

    TIM2->PSC = psc;
    TIM2->ARR = arr;
    TIM2->CCMR1 = TIM_CCMR1_OC1M_PWM1 | TIM_CCMR1_OC1PE; /* PWM 模式 1 + 预装载 */
    TIM2->CCR1 = 0u;
    TIM2->CCER = TIM_CCER_CC1E;
    TIM2->EGR = 1u;                            /* UG：立即装载 PSC/ARR */
    TIM2->CR1 = TIM_CR1_ARPE | TIM_CR1_CEN;
}

/* 占空比 0..1000（千分比），整数运算避免浮点 */
void tim2_set_duty_permille(uint16_t permille)
{
    if (permille > 1000u) {
        permille = 1000u;
    }
    TIM2->CCR1 = (uint32_t)permille * (TIM2->ARR + 1u) / 1000u;
}

void tim3_encoder_init(void)
{
    RCC_APB1ENR |= (1u << 1);      /* TIM3EN */
    TIM3->CCMR1 = (1u << 0) | (1u << 8); /* CC1S=01(TI1)、CC2S=01(TI2) */
    TIM3->SMCR = TIM_SMCR_SMS_ENCODER;   /* 编码器模式 3：两相双边沿计数 ×4 */
    TIM3->ARR = 0xFFFFu;
    TIM3->CNT = 0u;
    TIM3->CR1 = TIM_CR1_CEN;
}

/* 读增量：用有符号转换处理回绕 */
int16_t tim3_encoder_read(void)
{
    return (int16_t)TIM3->CNT;
}

/* 输入捕获测频（示意公式）：频率 = 计数时钟 / 两次捕获差值 */
uint32_t ic_freq_hz(uint32_t timer_clk, uint16_t captured_delta)
{
    if (captured_delta == 0u) {
        return 0u; /* 防止除零；超高频/无信号时会走到这里 */
    }
    return timer_clk / captured_delta;
}
