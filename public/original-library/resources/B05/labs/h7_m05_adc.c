/* h7_m05_adc.c — STM32H7 ADC（v3）：16 位、ISR/CFGR/SQR1，与 F1 的 SR/CR2 不同
 * 校准改由 ADCAL 位触发；分辨率与过采样在 CFGR2 配置；参考电压可外接 VREFBUF。 */
#include "stm32h7_regs.h"

#define H7_ADC1_ISR   R32(0x40022000u)
#define H7_ADC1_CR    R32(0x40022008u)
#define H7_ADC1_CFGR  R32(0x4002200Cu)
#define H7_ADC1_CFGR2 R32(0x40022010u)
#define H7_ADC1_SQR1  R32(0x40022030u)
#define H7_ADC1_DR    R32(0x40022040u)
#define H7_ADC_ISR_EOC    (1u << 2)
#define H7_ADC_CR_ADEN    (1u << 0)
#define H7_ADC_CR_ADSTART (1u << 2)
#define H7_ADC_CR_ADCAL   (1u << 31)

void h7_adc1_init(void)
{
    R32(0x580244F0u) |= (1u << 24);    /* APB2 上的 ADC123 时钟（示意） */
    /* H7 必做：先开 ADC 电压调节器并等待就绪，否则 ADEN/ADCAL 不生效 */
    H7_ADC1_CR |= (1u << 28);          /* ADVREGEN（示意，位号见 RM0433） */
    for (volatile uint32_t d = 0u; d < 1000u; ++d) { }   /* 稳压器建立时间 */
    H7_ADC1_CR |= H7_ADC_CR_ADCAL;     /* 触发校准 */
    while (H7_ADC1_CR & H7_ADC_CR_ADCAL) {
    }
    H7_ADC1_CR |= H7_ADC_CR_ADEN;      /* 使能 ADC */
    while ((H7_ADC1_ISR & (1u << 0)) == 0u) {  /* ADRDY */
    }
    H7_ADC1_CFGR &= ~(0x3u << 2);      /* 分辨率 16 位（RES=00） */
    H7_ADC1_SQR1 = 0u;                 /* 序列长度 1，通道 0 */
}

uint16_t h7_adc1_read(void)
{
    H7_ADC1_CR |= H7_ADC_CR_ADSTART;
    while ((H7_ADC1_ISR & H7_ADC_ISR_EOC) == 0u) {
    }
    return (uint16_t)H7_ADC1_DR;
}

/* 16 位 → 毫伏：满量程 65535（F1 是 4095，换算系数不同，移植时改这里最容易漏） */
uint32_t h7_adc_to_mv(uint16_t raw, uint32_t vref_mv)
{
    return (uint32_t)raw * vref_mv / 65535u;
}
