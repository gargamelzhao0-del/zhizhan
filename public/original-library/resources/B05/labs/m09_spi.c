/* m09_spi.c — B05-M09 SPI
 * SPI 模式 0（CPOL=0/CPHA=0）读 Flash JEDEC ID；软件片选。 */
#include "stm32f103_regs.h"

#define FLASH_CS_PIN 4u   /* 软件片选：PA4，推挽 50 MHz */

static uint8_t spi1_xfer(uint8_t out)
{
    while ((SPI1->SR & SPI_SR_TXE) == 0u) {
    }
    *((volatile uint8_t *)&SPI1->DR) = out;   /* F1 上 8 位传输只写低字节 */
    while ((SPI1->SR & SPI_SR_RXNE) == 0u) {
    }
    return *((volatile uint8_t *)&SPI1->DR);
}

void spi1_init(void)
{
    RCC_APB2ENR |= (1u << 12) | RCC_APB2ENR_IOPAEN;   /* SPI1EN */
    /* PA4 片选：通用推挽 50 MHz */
    GPIOA->CRL = (GPIOA->CRL & ~(0xFu << (FLASH_CS_PIN * 4u)))
               | ((uint32_t)GPIO_CNF_OUT_PP << 2)
               | (uint32_t)GPIO_MODE_OUT_50M;
    /* SPI1 默认引脚：PA5=SCK、PA7=MOSI 复用推挽 50 MHz；PA6=MISO 浮空输入。
     * 漏配这三个引脚是最常见的“代码对但收不到数据”。 */
    GPIOA->CRL = (GPIOA->CRL & ~((0xFu << 20) | (0xFu << 24) | (0xFu << 28)))
               | (0xBu << 20)   /* PA5 AF-PP（CNF=10,MODE=11） */
               | (0x4u << 24)   /* PA6 浮空输入（CNF=01,MODE=00） */
               | (0xBu << 28);  /* PA7 AF-PP */
    /* 模式 0 = CPOL=0, CPHA=0；主模式；软件 NSS 且内部拉高；预分频 8（72/8=9 MHz） */
    SPI1->CR1 = SPI_CR1_MSTR | SPI_CR1_SSM | SPI_CR1_SSI
              | (0x2u << 3) | SPI_CR1_SPE;
    GPIOA->BSRR = (1u << FLASH_CS_PIN);                /* 拉高，空闲 */
}

static void cs_low(void)  { GPIOA->BSRR = (1u << (FLASH_CS_PIN + 16u)); }
static void cs_high(void) { GPIOA->BSRR = (1u << FLASH_CS_PIN); }

uint32_t spi_flash_jedec_id(void)
{
    cs_low();
    (void)spi1_xfer(0x9Fu);                    /* JEDEC ID 命令 */
    uint32_t id = (uint32_t)spi1_xfer(0x00);
    id |= (uint32_t)spi1_xfer(0x00) << 8;
    id |= (uint32_t)spi1_xfer(0x00) << 16;
    cs_high();
    return id;                                 /* 典型 Winbond = 0xEF4015 */
}

/* 读状态寄存器 SR1，轮询 BUSY 位 */
uint8_t spi_flash_status(void)
{
    cs_low();
    (void)spi1_xfer(0x05u);
    uint8_t st = spi1_xfer(0x00);
    cs_high();
    return st;
}
