/* m16_io_types.c — B05-M16 输入输出电气类型（STM32F103）
 * 推挽/开漏（OC/OD）、上拉/浮空输入、PWM+RC 做“伪 DAC”、用 ADC+窗口做软件比较器。 */
#include "stm32f103_regs.h"

/* 输出类型：推挽能主动拉高/拉低；开漏只能拉低，高电平靠外部上拉（总线/线与/OC/OD） */
void io_cfg_pushpull(uint8_t pin)
{
    GPIOC->CRL = (GPIOC->CRL & ~(0xFu << (pin * 4u)))
               | ((uint32_t)GPIO_CNF_OUT_PP << 2) | (uint32_t)GPIO_MODE_OUT_2M;
}
void io_cfg_opendrain(uint8_t pin)
{
    GPIOC->CRL = (GPIOC->CRL & ~(0xFu << (pin * 4u)))
               | ((uint32_t)GPIO_CNF_OUT_OD << 2) | (uint32_t)GPIO_MODE_OUT_2M;
}
/* 输入：上拉（PU）适合按键到地；浮空/模拟取决于外部电路 */
void io_cfg_input_pullup(uint8_t pin)
{
    GPIOC->CRL = (GPIOC->CRL & ~(0xFu << (pin * 4u)))
               | ((uint32_t)GPIO_CNF_IN_PU << 2) | (uint32_t)GPIO_MODE_INPUT;
}

/* PWM + RC 低通做“伪 DAC”：占空比 → 平均电压（F1 无 DAC 时的常见替代） */
uint32_t io_pwm_to_mv(uint16_t permille, uint32_t vdd_mv)
{
    return (uint32_t)permille * vdd_mv / 1000u;
}

/* 软件比较器：ADC 采样后与阈值比较，带迟滞避免抖动 */
int io_soft_compare(uint16_t sample, uint16_t threshold, uint16_t hysteresis)
{
    static int state = 0;
    if (sample > (uint16_t)(threshold + hysteresis)) { state = 1; }
    else if (sample < (uint16_t)(threshold - hysteresis)) { state = 0; }
    return state;
}
