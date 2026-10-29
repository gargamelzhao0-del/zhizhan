/* stm32f103_regs.h — B05 教学用最小寄存器定义（STM32F103xB，依据 RM0008）
 * 只声明正文用到的寄存器；地址与位号逐条对照参考手册，偏移用 _Static_assert 钉死。
 * 可独立编译：arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c
 * 真实工程请使用 ST 官方 CMSIS 头（stm32f103xb.h）。 */
#ifndef B05_STM32F103_REGS_H
#define B05_STM32F103_REGS_H
#include <stdint.h>

#define R32(a) (*(volatile uint32_t *)(uintptr_t)(a))
#define R16(a) (*(volatile uint16_t *)(uintptr_t)(a))

/* ---- 总线基址（RM0008 表 1） ---- */
#define FLASH_BASE   0x08000000u
#define SRAM_BASE    0x20000000u
#define PERIPH_BASE  0x40000000u

/* ---- RCC：0x40021000 ---- */
#define RCC_BASE     0x40021000u
#define RCC_CR       R32(RCC_BASE + 0x00u)
#define RCC_CFGR     R32(RCC_BASE + 0x04u)
#define RCC_APB2ENR  R32(RCC_BASE + 0x18u)
#define RCC_APB1ENR  R32(RCC_BASE + 0x1Cu)
#define RCC_CSR      R32(RCC_BASE + 0x24u)
#define RCC_CR_HSEON    (1u << 16)
#define RCC_CR_HSERDY   (1u << 17)
#define RCC_CR_PLLON    (1u << 24)
#define RCC_CR_PLLRDY   (1u << 25)
#define RCC_CFGR_PLLSRC (1u << 16)
#define RCC_CFGR_PLLXTPRE (1u << 17)
#define RCC_CFGR_SW     (0x3u << 0)
#define RCC_CFGR_SWS    (0x3u << 2)
#define RCC_APB2ENR_IOPAEN (1u << 2)
#define RCC_APB2ENR_IOPBEN (1u << 3)
#define RCC_APB2ENR_IOPCEN (1u << 4)
#define RCC_APB2ENR_ADC1EN (1u << 9)
#define RCC_APB2ENR_AFIOEN (1u << 0)
#define RCC_APB1ENR_TIM2EN (1u << 0)
#define RCC_APB1ENR_I2C1EN (1u << 21)
#define RCC_APB1ENR_USART2EN (1u << 17)
#define RCC_APB1ENR_PWREN  (1u << 28)
#define RCC_APB1ENR_BKPEN  (1u << 27)

/* 复位原因（RCC_CSR，bit31..26 与 RMVF bit24） */
#define RCC_CSR_RMVF      (1u << 24)
#define RCC_CSR_PINRSTF   (1u << 26)
#define RCC_CSR_PORRSTF   (1u << 27)
#define RCC_CSR_SFTRSTF   (1u << 28)
#define RCC_CSR_IWDGRSTF  (1u << 29)
#define RCC_CSR_WWDGRSTF  (1u << 30)
#define RCC_CSR_LPWRRSTF  (1u << 31)

/* ---- GPIOA/B/C：0x4001_0800 / 0C00 / 1000，每组 0x400 ---- */
#define GPIOA_BASE   0x40010800u
#define GPIOB_BASE   0x40010C00u
#define GPIOC_BASE   0x40011000u
typedef struct {
  volatile uint32_t CRL;   /* 0x00 端口配置低 */
  volatile uint32_t CRH;   /* 0x04 端口配置高 */
  volatile uint32_t IDR;   /* 0x08 输入数据 */
  volatile uint32_t ODR;   /* 0x0C 输出数据 */
  volatile uint32_t BSRR;  /* 0x10 位设置/清除（写 1 生效，原子） */
  volatile uint32_t BRR;   /* 0x14 位清除 */
  volatile uint32_t LCKR;  /* 0x18 配置锁定 */
} gpio_t;
#define GPIOA ((gpio_t *)GPIOA_BASE)
#define GPIOB ((gpio_t *)GPIOB_BASE)
#define GPIOC ((gpio_t *)GPIOC_BASE)
_Static_assert(sizeof(gpio_t) == 7 * 4, "gpio_t must match F1 GPIO register block");

/* F1 每个引脚 4 位：bit[1:0]=MODE（方向+速度），bit[3:2]=CNF（复用/上下拉等） */
#define GPIO_MODE_INPUT   0u
#define GPIO_MODE_OUT_2M  2u   /* 输出 2 MHz：PC13/14/15 的上限 */
#define GPIO_MODE_OUT_10M 1u
#define GPIO_MODE_OUT_50M 3u
#define GPIO_CNF_OUT_PP   0u   /* 通用推挽输出 */
#define GPIO_CNF_OUT_OD   1u   /* 通用开漏输出 */
#define GPIO_CNF_AF_PP    2u   /* 复用推挽 */
#define GPIO_CNF_IN_PU    2u   /* 输入上拉 */

/* ---- AFIO：0x40010000（EXTI 线映射 / 复用重映射） ---- */
#define AFIO_BASE    0x40010000u
#define AFIO_MAPR    R32(AFIO_BASE + 0x04u)
#define AFIO_EXTICR1 R32(AFIO_BASE + 0x08u)

/* ---- EXTI：0x40010400 ---- */
#define EXTI_BASE    0x40010400u
#define EXTI_IMR     R32(EXTI_BASE + 0x00u)
#define EXTI_RTSR    R32(EXTI_BASE + 0x08u)
#define EXTI_FTSR    R32(EXTI_BASE + 0x0Cu)
#define EXTI_PR      R32(EXTI_BASE + 0x14u)

/* ---- 中断/异常：NVIC 位于 0xE000E100，SCB 位于 0xE000ED00 ---- */
#define NVIC_ISER    R32(0xE000E100u)   /* 使能第 0..31 号 IRQ */
#define NVIC_ICER    R32(0xE000E180u)
#define NVIC_ISPR    R32(0xE000E200u)
#define NVIC_IPR     ((volatile uint8_t *)0xE000E400u)
#define SCB_AIRCR    R32(0xE000ED0Cu)
#define SCB_VTOR     R32(0xE000ED08u)
#define SCB_ACTLR    R32(0xE000E008u)
#define AIRCR_VECTKEY (0x05FAu << 16)

/* ---- SysTick：0xE000E010 ---- */
#define SYST_CSR   R32(0xE000E010u)
#define SYST_RVR   R32(0xE000E014u)
#define SYST_CVR   R32(0xE000E018u)
#define SYST_CSR_ENABLE   (1u << 0)
#define SYST_CSR_TICKINT  (1u << 1)
#define SYST_CSR_CLKSOURCE (1u << 2)

/* ---- TIM2/3/4：0x40000000 + n*0x400（APB1）；TIM1：0x40012C00（APB2） ---- */
typedef struct {
  volatile uint32_t CR1, CR2, SMCR, DIER, SR, EGR, CCMR1, CCMR2,
                    CCER, CNT, PSC, ARR, RESERVED, CCR1, CCR2, CCR3, CCR4;
} tim_t;
#define TIM2 ((tim_t *)0x40000000u)
#define TIM3 ((tim_t *)0x40000400u)
_Static_assert(sizeof(tim_t) == 17 * 4, "tim_t must match F1 general timer block");
#define TIM_CR1_CEN   (1u << 0)
#define TIM_CR1_ARPE  (1u << 7)
#define TIM_CCMR1_OC1M_PWM1 (0x6u << 4)
#define TIM_CCMR1_OC1PE (1u << 3)
#define TIM_CCER_CC1E (1u << 0)
#define TIM_SMCR_SMS_ENCODER 3u   /* 编码器模式 3：双边沿 */

/* ---- ADC1：0x40012400 ---- */
typedef struct {
  volatile uint32_t SR, CR1, CR2, SMPR1, SMPR2, JOFR1, JOFR2, JOFR3, JOFR4,
                    HTR, LTR, SQR1, SQR2, SQR3, JSQR, JDR1, JDR2, JDR3, JDR4, DR;
} adc_t;
#define ADC1 ((adc_t *)0x40012400u)
_Static_assert(sizeof(adc_t) == 20 * 4, "adc_t must match F1 ADC register block");
#define ADC_CR2_ADON    (1u << 0)
#define ADC_CR2_CONT    (1u << 1)
#define ADC_CR2_CAL     (1u << 2)
#define ADC_CR2_RSTCAL  (1u << 3)
#define ADC_CR2_DMA     (1u << 8)
#define ADC_CR2_SWSTART (1u << 22)
#define ADC_SR_EOC      (1u << 1)

/* ---- DMA1：0x40020000，通道 1 在 +0x08；ISR +0x00，IFCR +0x04 ---- */
typedef struct {
  volatile uint32_t CCR, CNDTR, CPAR, CMAR;
} dma_channel_t;
#define DMA1_ISR   R32(0x40020000u)
#define DMA1_IFCR  R32(0x40020004u)
#define DMA1_Ch1   ((dma_channel_t *)0x40020008u)
#define DMA_CCR_EN   (1u << 0)
#define DMA_CCR_TCIE (1u << 1)
#define DMA_CCR_CIRC (1u << 5)
#define DMA_CCR_PINC (1u << 6)
#define DMA_CCR_MINC (1u << 7)
#define DMA_CCR_PSIZE_16 (1u << 8)
#define DMA_CCR_MSIZE_16 (1u << 10)

/* ---- USART1：0x40013800 ---- */
typedef struct {
  volatile uint32_t SR, DR, BRR, CR1, CR2, CR3, GTPR;
} usart_t;
#define USART1 ((usart_t *)0x40013800u)
_Static_assert(sizeof(usart_t) == 7 * 4, "usart_t must match F1 USART block");
#define USART_SR_IDLE  (1u << 4)
#define USART_SR_ORE   (1u << 3)
#define USART_SR_RXNE  (1u << 5)
#define USART_SR_TXE   (1u << 7)
#define USART_SR_TC    (1u << 6)
#define USART_CR1_RE   (1u << 2)
#define USART_CR1_TE   (1u << 3)
#define USART_CR1_IDLEIE (1u << 4)
#define USART_CR1_RXNEIE (1u << 5)
#define USART_CR1_UE   (1u << 13)

/* ---- I2C1：0x40005400 ---- */
typedef struct {
  volatile uint32_t CR1, CR2, OAR1, OAR2, DR, SR1, SR2, CCR, TRISE;
} i2c_t;
#define I2C1 ((i2c_t *)0x40005400u)
_Static_assert(sizeof(i2c_t) == 9 * 4, "i2c_t must match F1 I2C block");
#define I2C_CR1_PE     (1u << 0)
#define I2C_CR1_START  (1u << 8)
#define I2C_CR1_STOP   (1u << 9)
#define I2C_CR1_ACK    (1u << 10)
#define I2C_CR1_SWRST  (1u << 15)
#define I2C_SR1_SB     (1u << 0)
#define I2C_SR1_ADDR   (1u << 1)
#define I2C_SR1_BTF    (1u << 2)
#define I2C_SR1_RXNE   (1u << 6)
#define I2C_SR1_TXE    (1u << 7)
#define I2C_SR1_AF     (1u << 10)
#define I2C_SR2_BUSY   (1u << 1)

/* ---- SPI1：0x40013000 ---- */
typedef struct {
  volatile uint32_t CR1, CR2, SR, DR;
} spi_t;
#define SPI1 ((spi_t *)0x40013000u)
_Static_assert(sizeof(spi_t) == 4 * 4, "spi_t must match F1 SPI block");
#define SPI_SR_RXNE  (1u << 0)
#define SPI_SR_TXE   (1u << 1)
#define SPI_SR_BSY   (1u << 7)
#define SPI_CR1_CPHA (1u << 0)
#define SPI_CR1_CPOL (1u << 1)
#define SPI_CR1_MSTR (1u << 2)
#define SPI_CR1_SPE  (1u << 6)
#define SPI_CR1_SSI  (1u << 8)
#define SPI_CR1_SSM  (1u << 9)

/* ---- IWDG：0x40003000；PWR：0x40007000；BKP：0x40006C00 ---- */
#define IWDG_BASE 0x40003000u
#define IWDG_KR   R32(IWDG_BASE + 0x00u)
#define IWDG_PR   R32(IWDG_BASE + 0x04u)
#define IWDG_RLR  R32(IWDG_BASE + 0x08u)
#define IWDG_SR   R32(IWDG_BASE + 0x0Cu)
#define IWDG_SR_PVU (1u << 0)
#define IWDG_SR_RVU (1u << 1)
#define IWDG_KEY_ENABLE  0x5555u
#define IWDG_KEY_RELOAD  0xAAAAu
#define IWDG_KEY_START   0xCCCCu

#define PWR_CR   R32(0x40007000u)
#define PWR_CR_PDDS (1u << 1)
#define PWR_CR_LPDS (1u << 0)
#define PWR_CR_CWUF (1u << 2)
#define PWR_CR_DBP  (1u << 8)
#define BKP_DR1  R32(0x40006C04u)

/* ---- 内核专用寄存器：不是内存映射，必须用 MRS/MSR ---- */
static inline void b05_disable_irq(void){ __asm volatile ("cpsid i" ::: "memory"); }
static inline void b05_enable_irq(void){ __asm volatile ("cpsie i" ::: "memory"); }
static inline uint32_t b05_get_primask(void){ uint32_t v; __asm volatile ("mrs %0, primask" : "=r"(v)); return v; }
static inline void b05_set_basepri(uint32_t pri){ __asm volatile ("msr basepri, %0" :: "r"(pri) : "memory"); }
static inline void b05_dsb(void){ __asm volatile ("dsb 0xF" ::: "memory"); }
static inline void b05_isb(void){ __asm volatile ("isb 0xF" ::: "memory"); }
static inline uint32_t b05_get_ipsr(void){ uint32_t v; __asm volatile ("mrs %0, ipsr" : "=r"(v)); return v; }

#endif /* B05_STM32F103_REGS_H */
