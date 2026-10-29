/* m18_eth_w5500.c — B05-M18 以太网（STM32F103 无 MAC，外挂 W5500 硬件 TCP/IP 芯片，SPI 接口）
 * 网线相关通信：PHY 在 W5500 内部，MCU 只需 SPI 读写其寄存器 + socket 收发。 */
#include "stm32f103_regs.h"

#define W5500_BSB_COMMON 0x00u
#define W5500_BSB_S0     0x01u
#define W5500_BSB_TX0    0x10u
#define W5500_BSB_RX0    0x18u
#define W5500_RWB_READ   0x00u
#define W5500_RWB_WRITE  0x04u

static uint8_t w_spi(uint8_t out)
{
    while ((SPI1->SR & SPI_SR_TXE) == 0u) { }
    *((volatile uint8_t *)&SPI1->DR) = out;
    while ((SPI1->SR & SPI_SR_RXNE) == 0u) { }
    return *((volatile uint8_t *)&SPI1->DR);
}

static void w_cs(int low)
{
    GPIOA->BSRR = low ? (1u << (4 + 16)) : (1u << 4);   /* PA4 = W5500 片选 */
}

void w5500_write(uint8_t bsb, uint16_t off, const uint8_t *buf, uint16_t n)
{
    w_cs(1);
    w_spi((uint8_t)(off >> 8)); w_spi((uint8_t)off); w_spi((uint8_t)((bsb << 3) | W5500_RWB_WRITE));
    for (uint16_t i = 0; i < n; ++i) { w_spi(buf[i]); }
    w_cs(0);
}

void w5500_read(uint8_t bsb, uint16_t off, uint8_t *buf, uint16_t n)
{
    w_cs(1);
    w_spi((uint8_t)(off >> 8)); w_spi((uint8_t)off); w_spi((uint8_t)((bsb << 3) | W5500_RWB_READ));
    for (uint16_t i = 0; i < n; ++i) { buf[i] = w_spi(0x00); }
    w_cs(0);
}

/* 配好 MAC/IP，开 Socket0 为 TCP 客户端并连接服务器（示意端口 5000） */
int w5500_tcp_connect(const uint8_t mac[6], const uint8_t ip[4], const uint8_t srv[4])
{
    uint8_t cr;
    w5500_write(W5500_BSB_COMMON, 0x0009u, mac, 6);      /* SHAR */
    w5500_write(W5500_BSB_COMMON, 0x000Fu, ip, 4);       /* SIPR */
    cr = 0x01u; w5500_write(W5500_BSB_S0, 0x0000u, &cr, 1);   /* Sn_MR = TCP */
    w5500_write(W5500_BSB_S0, 0x000Cu, srv, 4);          /* Sn_DIPR */
    uint8_t port[2] = { 0x13u, 0x88u };                  /* 5000 */
    w5500_write(W5500_BSB_S0, 0x0010u, port, 2);         /* Sn_DPORT */
    cr = 0x01u; w5500_write(W5500_BSB_S0, 0x0001u, &cr, 1);   /* OPEN */
    cr = 0x04u; w5500_write(W5500_BSB_S0, 0x0001u, &cr, 1);   /* CONNECT */
    return 0;
}

int w5500_send(const uint8_t *buf, uint16_t n)
{
    uint8_t wr[2], cr = 0x20u;
    w5500_read(W5500_BSB_S0, 0x0024u, wr, 2);            /* Sn_TX_WR */
    uint16_t p = (uint16_t)(((uint16_t)wr[0] << 8) | wr[1]);
    w5500_write(W5500_BSB_TX0, p, buf, n);               /* 写入 TX 缓冲 */
    uint16_t np = (uint16_t)(p + n);
    uint8_t wr2[2] = { (uint8_t)(np >> 8), (uint8_t)np };
    w5500_write(W5500_BSB_S0, 0x0024u, wr2, 2);          /* 更新 Sn_TX_WR */
    w5500_write(W5500_BSB_S0, 0x0001u, &cr, 1);          /* SEND */
    return 0;
}
