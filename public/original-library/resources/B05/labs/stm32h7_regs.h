/* stm32h7_regs.h — B05 教学用最小 STM32H7（Cortex-M7）寄存器定义（依据 RM0433）
 * 只含正文用到的寄存器；真实工程请用 ST 官方 CMSIS（stm32h743xx.h）。
 * 与 F1 的差异集中在：GPIO 每引脚 2 位、USART/I2C/SPI 换成 v2 外设、DMA 用“流”。 */
#ifndef B05_STM32H7_REGS_H
#define B05_STM32H7_REGS_H
#include <stdint.h>

#define R32(a) (*(volatile uint32_t *)(uintptr_t)(a))

/* ---- RCC：0x58024400（D3 域） ---- */
#define H7_RCC_CR        R32(0x58024400u)
#define H7_RCC_CFGR      R32(0x58024410u)
#define H7_RCC_D1CFGR    R32(0x58024418u)
#define H7_RCC_D2CFGR    R32(0x5802441Cu)
#define H7_RCC_D3CFGR    R32(0x58024420u)
#define H7_RCC_PLLCKSELR R32(0x58024428u)
#define H7_RCC_PLLCFGR   R32(0x5802442Cu)
#define H7_RCC_PLL1DIVR  R32(0x58024430u)
#define H7_RCC_CR_PLL1ON (1u << 24)
#define H7_RCC_CR_PLL1RDY (1u << 25)
#define H7_RCC_AHB4ENR   R32(0x580244E0u)   /* GPIOA..K 时钟使能 */
#define H7_RCC_APB1LENR  R32(0x580244E8u)
#define H7_RCC_APB2ENR   R32(0x580244F0u)

/* ---- GPIO：GPIOA 0x58020000，每组 0x400 ---- */
typedef struct {
  volatile uint32_t MODER;   /* 0x00 每引脚 2 位模式 */
  volatile uint32_t OTYPER;  /* 0x04 输出类型 */
  volatile uint32_t OSPEEDR; /* 0x08 速度 */
  volatile uint32_t PUPDR;   /* 0x0C 上下拉 */
  volatile uint32_t IDR;     /* 0x10 */
  volatile uint32_t ODR;     /* 0x14 */
  volatile uint32_t BSRR;    /* 0x18 */
  volatile uint32_t LCKR;    /* 0x1C */
  volatile uint32_t AFR[2];  /* 0x20/0x24 复用功能 */
} h7_gpio_t;
#define H7_GPIOA ((h7_gpio_t *)0x58020000u)
#define H7_GPIOB ((h7_gpio_t *)0x58020400u)
_Static_assert(sizeof(h7_gpio_t) == 10 * 4, "h7_gpio_t size");
#define H7_MODER_OUT 1u   /* 通用输出 */
#define H7_MODER_AF  2u   /* 复用 */
#define H7_MODER_AN 3u

/* ---- USART（v2，与 F1 的 USART 完全不同）：USART1 0x40011000 ---- */
typedef struct {
  volatile uint32_t CR1, CR2, CR3, BRR, GTPR, RTOR, RQR, ISR, ICR, RDR, TDR;
} h7_usart_t;
#define H7_USART1 ((h7_usart_t *)0x40011000u)
_Static_assert(sizeof(h7_usart_t) == 11 * 4, "h7_usart_t size");
#define H7_USART_ISR_RXNE (1u << 5)
#define H7_USART_ISR_TXE  (1u << 7)
#define H7_USART_CR1_UE   (1u << 0)
#define H7_USART_CR1_TE   (1u << 3)
#define H7_USART_CR1_RE   (1u << 2)

/* ---- I2C（v2）：I2C1 0x40005400 ---- */
typedef struct {
  volatile uint32_t CR1, CR2, OAR1, OAR2, TIMINGR, TIMEOUTR, ISR, ICR, PECR, RXDR, TXDR;
} h7_i2c_t;
#define H7_I2C1 ((h7_i2c_t *)0x40005400u)
_Static_assert(sizeof(h7_i2c_t) == 11 * 4, "h7_i2c_t size");
#define H7_I2C_ISR_TXIS (1u << 1)
#define H7_I2C_ISR_RXNE (1u << 2)
#define H7_I2C_ISR_NACKF (1u << 4)
#define H7_I2C_ISR_TC   (1u << 6)
#define H7_I2C_CR2_START (1u << 13)
#define H7_I2C_CR2_STOP  (1u << 14)
#define H7_I2C_CR2_AUTOEND (1u << 25)

/* ---- SPI（v2）：SPI1 0x40013000 ---- */
typedef struct {
  volatile uint32_t CR1, CR2, CFG1, CFG2, IER, SR, IFCR, RESERVED, TXDR, RESERVED2[3], RXDR;
} h7_spi_t;
#define H7_SPI1 ((h7_spi_t *)0x40013000u)
_Static_assert(sizeof(h7_spi_t) == 13 * 4, "h7_spi_t size");
#define H7_SPI_SR_RXP (1u << 0)
#define H7_SPI_SR_TXP (1u << 1)
#define H7_SPI_CR1_SPE (1u << 0)

/* ---- DMA1（流，不是通道）：0x40020000 ---- */
typedef struct {
  volatile uint32_t CR, NDTR, PAR, M0AR, M1AR, FCR;
} h7_dma_stream_t;
#define H7_DMA1_LISR  R32(0x40020000u)
#define H7_DMA1_HISR  R32(0x40020004u)
#define H7_DMA1_LIFCR R32(0x40020008u)
#define H7_DMA1_Stream0 ((h7_dma_stream_t *)0x40020010u)
#define H7_DMA_SxCR_EN (1u << 0)

/* ---- SysTick / 缓存维护（M7 特有） ---- */
#define H7_SCB_CCR       R32(0xE000ED14u)
#define H7_SCB_CCR_DCACHE (1u << 16)
#define H7_SCB_CCR_ICACHE (1u << 17)
static inline void h7_dcache_clean(uint32_t addr, uint32_t size) {
  /* 真实实现按 cache line 循环 DCCMVAC；此处仅示意 */
  register uint32_t a __asm("r0") = addr;
  register uint32_t s __asm("r1") = size;
  __asm volatile ("dsb 0xF" ::: "memory");
  (void)a; (void)s;
}
static inline void h7_dsb(void) { __asm volatile ("dsb 0xF" ::: "memory"); }
static inline void h7_isb(void) { __asm volatile ("isb 0xF" ::: "memory"); }

#endif /* B05_STM32H7_REGS_H */
