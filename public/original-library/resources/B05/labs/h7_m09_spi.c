/* h7_m09_spi.c — STM32H7 SPI（v2）：CFG1/CFG2/IER/SR/TXDR/RXDR，带 FIFO
 * 与 F1 的 CR1/CR2/SR/DR 模型不同；数据通过 TXDR/RXDR，且 FIFO 深度可配。 */
#include "stm32h7_regs.h"

void h7_spi1_init(void)
{
    H7_RCC_APB2ENR |= (1u << 12);          /* SPI1 时钟（示意） */
    H7_SPI1->CFG1 = (7u << 0)              /* DSIZE=8 位（DSIZE=size-1） */
                  | (3u << 28);            /* MBR：主模式波特率预分频（见 RM0433） */
    H7_SPI1->CFG2 = (1u << 22)             /* MASTER */
                  | (1u << 26);            /* SSM：软件片选 */
    H7_SPI1->CR1 = H7_SPI_CR1_SPE | (1u << 12);   /* SPE | SSI */
}

/* 全双工 8 位收发：FIFO 使能后 TXDR/RXDR 需 4 字节对齐访问 */
void h7_spi1_xfer(const uint8_t *tx, uint8_t *rx, uint16_t n)
{
    for (uint16_t i = 0u; i < n; ++i) {
        while ((H7_SPI1->SR & H7_SPI_SR_TXP) == 0u) {
        }
        *((volatile uint8_t *)&H7_SPI1->TXDR) = tx[i];
        while ((H7_SPI1->SR & H7_SPI_SR_RXP) == 0u) {
        }
        rx[i] = *((volatile uint8_t *)&H7_SPI1->RXDR);
    }
}
