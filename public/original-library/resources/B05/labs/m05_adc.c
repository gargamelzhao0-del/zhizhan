/* m05_adc.c — B05-M05 ADC 采样与标定
 * 校准 → 单次转换 → 过采样平均 → 换算毫伏。采样时间需按源阻抗选取。 */
#include "stm32f103_regs.h"

void adc1_init(void)
{
    RCC_APB2ENR |= RCC_APB2ENR_ADC1EN;
    ADC1->CR2 |= ADC_CR2_ADON;            /* 第一次写 ADON：上电 */

    /* 校准序列：RSTCAL 自清 → CAL 自清 */
    ADC1->CR2 |= ADC_CR2_RSTCAL;
    while (ADC1->CR2 & ADC_CR2_RSTCAL) {
    }
    ADC1->CR2 |= ADC_CR2_CAL;
    while (ADC1->CR2 & ADC_CR2_CAL) {
    }

    /* 通道 0 采样时间 = 55.5 周期（SMPR2 bit[2:0]=101），适配较高源阻抗 */
    ADC1->SMPR2 = (ADC1->SMPR2 & ~(0x7u << 0)) | (0x5u << 0);
    ADC1->SQR3 = 0u;                      /* 规则序列第 1 个转换 = 通道 0，长度 1 */
}

uint16_t adc1_read_once(void)
{
    ADC1->CR2 |= ADC_CR2_ADON;            /* 第二次写 ADON：启动转换（F1 特性） */
    while ((ADC1->SR & ADC_SR_EOC) == 0u) {
    }
    return (uint16_t)ADC1->DR;            /* 读 DR 清 EOC */
}

/* 过采样：N 次平均，牺牲时间换信噪比；注意 sum 用 32 位防溢出 */
uint16_t adc1_read_avg(uint16_t n)
{
    if (n == 0u) {
        return 0u;
    }
    uint32_t sum = 0u;
    for (uint16_t i = 0u; i < n; ++i) {
        sum += adc1_read_once();
    }
    return (uint16_t)(sum / n);
}

/* 原始码 → 毫伏（12 位、VREF 通常 3300 mV） */
uint32_t adc_to_mv(uint16_t raw, uint32_t vref_mv)
{
    return (uint32_t)raw * vref_mv / 4095u;
}
