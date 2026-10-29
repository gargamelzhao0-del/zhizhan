/* esp_m07_uart.c — ESP32 UART：时钟来自 APB(80MHz)，CLKDIV=APB/baud
 * 与 STM32 不同：ESP32 有 128 字节硬件 FIFO，数据搬运用中断/驱动队列。 */
#include "esp32_regs.h"

uint32_t esp_uart_set_baud(uint32_t base, uint32_t baud)
{
    uint32_t div = (ESP32_APB_HZ + baud / 2u) / baud;   /* 整数分频；更精确可用 CLKDIV_FRAG */
    UART_CLKDIV(base) = div;
    return div;
}

void esp_uart_putc(uint32_t base, uint8_t c)
{
    while (((UART_STATUS(base) >> UART_TXFIFO_CNT_SHIFT) & 0xFFu) >= 128u) {
    }
    UART_FIFO(base) = c;
}

/* ESP-IDF 高层：uart_driver_install 建立环形缓冲 + 事件队列，避免裸轮询 */
extern int uart_driver_install(int port, int rx_buf, int tx_buf, int queue_size, void *queue, int flags);
int esp_uart_driver_start(int port)
{
    return uart_driver_install(port, 256, 0, 20, (void *)0, 0);
}
