/* h7_m06_dma.c — STM32H7 DMA：用“流(stream)”而非“通道”，且有 D-cache 一致性要求
 * 关键差异：F1 固定通道映射；H7 是流 + 请求复用器(DMAMUX)，同一外设可由不同流服务。 */
#include "stm32h7_regs.h"

#define H7_ADC1_DR_ADDR 0x40022040u
#define H7_SxCR_TCIE (1u << 1)
#define H7_SxCR_CIRC (1u << 8)
#define H7_SxCR_MINC (1u << 10)
#define H7_SxCR_PSIZE_16 (1u << 16)
#define H7_SxCR_MSIZE_16 (1u << 18)

void h7_adc_dma_start(uint16_t *buf, uint16_t len)
{
    H7_DMA1_Stream0->PAR  = H7_ADC1_DR_ADDR;
    H7_DMA1_Stream0->M0AR = (uint32_t)(uintptr_t)buf;
    H7_DMA1_Stream0->NDTR = len;
    H7_DMA1_Stream0->CR   = H7_DMA_SxCR_EN | H7_SxCR_TCIE | H7_SxCR_CIRC
                          | H7_SxCR_MINC | H7_SxCR_PSIZE_16 | H7_SxCR_MSIZE_16;

    /* D-cache 开启时：DMA 写入内存前，需保证该区不在 cache 里是脏数据。
     * H7 上“忘记 cache 维护”比 F1 多出的一类 bug，volatile 不能替代。 */
    h7_dcache_clean((uint32_t)(uintptr_t)buf, (uint32_t)len * 2u);
}

void h7_dma1_stream0_stop(void)
{
    H7_DMA1_Stream0->CR &= ~H7_DMA_SxCR_EN;
    while (H7_DMA1_Stream0->CR & H7_DMA_SxCR_EN) {
    }
}
