/* esp32_regs.h — B05 教学用最小 ESP32（Xtensa LX6）寄存器定义（依据 ESP32 TRM）
 * 只含正文用到的寄存器；真实工程请用 ESP-IDF 的 soc 目录头文件与 driver API。 */
#ifndef B05_ESP32_REGS_H
#define B05_ESP32_REGS_H
#include <stdint.h>

#define REG32(a) (*(volatile uint32_t *)(uintptr_t)(a))

/* ---- GPIO（DPORT 空间） ---- */
#define GPIO_BASE        0x3FF44000u
#define GPIO_OUT_REG     REG32(GPIO_BASE + 0x04u)
#define GPIO_OUT_W1TS    REG32(GPIO_BASE + 0x08u)   /* 写 1 置位 */
#define GPIO_OUT_W1TC    REG32(GPIO_BASE + 0x0Cu)   /* 写 1 清除 */
#define GPIO_ENABLE_W1TS REG32(GPIO_BASE + 0x24u)
#define GPIO_IN_REG      REG32(GPIO_BASE + 0x3Cu)

/* ---- IO_MUX：引脚电气与功能选择（每个引脚一个寄存器） ---- */
#define IO_MUX_GPIO2_REG REG32(0x3FF49040u)
#define IO_MUX_FUN_IE    (1u << 9)      /* 输入使能 */
#define IO_MUX_DRV_SHIFT 10             /* FUN_DRV 位 [11:10]：2 位驱动强度 */
#define IO_MUX_MCU_SEL_SHIFT 12         /* MCU_SEL 位 [14:12]：功能选择 */

/* ---- UART：UART0 0x3FF40000 / UART1 0x3FF50000 / UART2 0x3FF6E000 ---- */
#define UART0_BASE 0x3FF40000u
#define UART1_BASE 0x3FF50000u
#define UART_FIFO(b)    REG32((b) + 0x00u)
#define UART_STATUS(b)  REG32((b) + 0x1Cu)
#define UART_CONF0(b)   REG32((b) + 0x20u)
#define UART_CLKDIV(b)  REG32((b) + 0x14u)
#define UART_TXFIFO_CNT_SHIFT 16u

/* ---- 时钟：ESP32 APB = 80 MHz（XTAL 40MHz，CPU 默认 240MHz） ---- */
#define ESP32_APB_HZ   80000000u

/* ---- ESP-IDF 风格的“无参数时钟门控”示例：GPIO 默认已开，
 *      其它外设需 DPORT 级使能——与 STM32 的“逐个外设开时钟”不同 ---- */
#define DPORT_PERIP_CLK_EN_REG REG32(0x3FF000C0u)

/* Xtensa 顺序屏障（对应 ARM 的 DMB/DSB 语境） */
static inline void esp_memw(void) { __asm__ volatile ("memw" ::: "memory"); }

#endif /* B05_ESP32_REGS_H */
