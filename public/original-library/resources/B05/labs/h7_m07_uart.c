/* h7_m07_uart.c — STM32H7 USART（v2）：ISR/ICR/RDR/TDR 取代 F1 的 SR/DR
 * BRR 公式与格式（含 1/16 小数）与 F1 相同，但寄存器访问方式全变。 */
#include "stm32h7_regs.h"

uint32_t h7_usart1_baud(uint32_t pclk, uint32_t baud)
{
    uint32_t brr = (pclk + baud / 2u) / baud;   /* 与 F1 同：BRR=fCK/baud，含小数位 */
    H7_USART1->BRR = brr;
    H7_USART1->CR1 |= H7_USART_CR1_UE | H7_USART_CR1_TE | H7_USART_CR1_RE;
    return brr;
}

int h7_usart1_getc(uint8_t *c)
{
    if (H7_USART1->ISR & H7_USART_ISR_RXNE) {
        *c = (uint8_t)H7_USART1->RDR;   /* v2 用 RDR，不是 DR */
        return 1;
    }
    return 0;
}

void h7_usart1_putc(uint8_t c)
{
    while ((H7_USART1->ISR & H7_USART_ISR_TXE) == 0u) {
    }
    H7_USART1->TDR = c;                 /* v2 用 TDR */
}

/* v2 的错误标志集中在 ISR，用 ICR 清；ORE 依然是“不处理就锁死接收”的头号坑 */
void h7_usart1_clear_errors(void)
{
    H7_USART1->ICR = (1u << 1) | (1u << 3);   /* 清 ORE/错误标志（见 RM0433） */
}
