/* m06_dma.c — B05-M06 DMA
 * ADC1 → 内存 循环搬运：CPU 不参与每次转换。环回模式配合半满/全满中断做双缓冲。 */
#include "stm32f103_regs.h"

volatile uint16_t g_dma_half;
volatile uint16_t g_dma_full;

/* buf 指向长度 len 的 uint16 数组，硬件持续覆盖 */
void adc_dma_start(uint16_t *buf, uint16_t len)
{
    ADC1->CR2 |= ADC_CR2_DMA | ADC_CR2_CONT;   /* 开 DMA 请求 + 连续转换 */
    DMA1_Ch1->CPAR  = (uint32_t)(uintptr_t)&ADC1->DR;  /* 源：ADC 数据寄存器 */
    DMA1_Ch1->CMAR  = (uint32_t)(uintptr_t)buf;        /* 目的：内存缓冲 */
    DMA1_Ch1->CNDTR = len;
    DMA1_Ch1->CCR   = DMA_CCR_MINC | DMA_CCR_PSIZE_16 | DMA_CCR_MSIZE_16
                    | DMA_CCR_CIRC | DMA_CCR_TCIE | DMA_CCR_EN;
    ADC1->CR2 |= ADC_CR2_ADON | ADC_CR2_SWSTART;
}

/* 半满/全满由 DMA 通道的 HTIF/TCIF 判定。
 * DMA1_ISR 每通道占 4 位：GIFx=bit0、TCIFx=bit1、HTIFx=bit2、TEIFx=bit3。
 * 通道 1 即 GIF1/TCIF1/HTIF1/TEIF1；最容易写错的是把 bit1 当半满（其实是“传输完成”）。 */
void dma1_ch1_irq(void)
{
    if (DMA1_ISR & (1u << 2)) {        /* HTIF1：半传输（半满） */
        DMA1_IFCR = (1u << 2);
        g_dma_half++;
    }
    if (DMA1_ISR & (1u << 1)) {        /* TCIF1：传输完成（全满） */
        DMA1_IFCR = (1u << 1);
        g_dma_full++;
    }
}

void dma1_ch1_stop(void)
{
    DMA1_Ch1->CCR &= ~DMA_CCR_EN;
    while (DMA1_Ch1->CCR & DMA_CCR_EN) {
    }
}

/* 关于 cache：Cortex-M7 上 DMA 写入的内存可能留在 cache 里，
 * 需按缓冲方向 clean/invalidate；M3 无数据 cache，本示例不涉及。 */
