/* m07_uart.c — B05-M07 UART
 * 波特率 BRR 计算 + 溢出错误处理 + ISR 环形接收。DMA + IDLE 收不定长帧见正文。 */
#include "stm32f103_regs.h"

/* 复用阶段①的环形缓冲：容量取 2 的幂，用掩码回绕 */
#define UART_RB_SIZE 256u
typedef struct {
    volatile uint16_t head;
    volatile uint16_t tail;
    uint8_t buf[UART_RB_SIZE];
} uart_rb_t;

static uart_rb_t g_rx;
volatile uint32_t g_rx_overrun;

int uart_rb_push(uart_rb_t *rb, uint8_t byte)
{
    uint16_t next = (uint16_t)((rb->head + 1u) & (UART_RB_SIZE - 1u));
    if (next == rb->tail) {
        return 0;                 /* 满：丢弃新数据并计数 */
    }
    rb->buf[rb->head] = byte;
    rb->head = next;              /* 先写数据，后发布索引 */
    return 1;
}

int uart_rb_pop(uart_rb_t *rb, uint8_t *out)
{
    if (rb->head == rb->tail) {
        return 0;                 /* 空 */
    }
    *out = rb->buf[rb->tail];
    rb->tail = (uint16_t)((rb->tail + 1u) & (UART_RB_SIZE - 1u));
    return 1;
}

/* BRR = fCK/(16×baud)，四舍五入；返回实际写入值便于核对误差 */
uint32_t usart1_baud_init(uint32_t pclk2, uint32_t baud)
{
    uint32_t brr = (pclk2 + baud / 2u) / baud;
    USART1->BRR = brr;
    USART1->CR1 |= USART_CR1_UE | USART_CR1_TE | USART_CR1_RE | USART_CR1_RXNEIE;
    return brr;
}

/* 波特率相对误差（ppm）：越小越好，一般要求 < 2% */
int32_t usart1_baud_error_ppm(uint32_t pclk2, uint32_t baud)
{
    uint32_t brr = (pclk2 + baud / 2u) / baud;
    if (brr == 0u) {
        return 1000000; /* 非法 */
    }
    int32_t actual = (int32_t)(pclk2 / brr);
    return (actual - (int32_t)baud) * 1000000 / (int32_t)baud;
}

/* 中断：先读 SR 再读 DR。ORE 会锁住后续接收，必须读 DR 清掉，否则整段数据丢失 */
void USART1_IRQHandler(void)
{
    uint32_t sr = USART1->SR;
    if (sr & USART_SR_RXNE) {
        uint8_t b = (uint8_t)USART1->DR;
        if (!uart_rb_push(&g_rx, b)) {
            g_rx_overrun++;
        }
    } else if (sr & USART_SR_ORE) {
        (void)USART1->DR;
        g_rx_overrun++;
    }
}
