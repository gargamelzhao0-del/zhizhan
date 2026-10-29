/* h7_m16_io.c — B05-M16 输入输出电气类型（STM32H7，含真实 DAC）
 * H7 有 12 位 DAC；输出类型（推挽/开漏）与 F1 概念一致但寄存器不同。 */
#include "stm32h7_regs.h"

#define H7_DAC_BASE 0x40007400u
#define H7_DAC_CR   R32(H7_DAC_BASE + 0x00u)
#define H7_DAC_DHR12R1 R32(H7_DAC_BASE + 0x08u)
#define H7_DAC_DHR12R2 R32(H7_DAC_BASE + 0x14u)
#define H7_DAC_CR_EN1 (1u << 0)
#define H7_DAC_CR_EN2 (1u << 16)

void h7_dac_init(void)
{
    R32(0x580244E8u) |= (1u << 29);   /* 开 DAC12 时钟（APB1LENR，示意） */
    H7_DAC_CR |= H7_DAC_CR_EN1;
}

/* 12 位 DAC 输出：0..4095 → 0..VREF（真实模拟输出，替代 F1 的 PWM+RC） */
void h7_dac_write(uint16_t code) { H7_DAC_DHR12R1 = (code & 0x0FFFu); }

/* GPIO 开漏输出（I²C/线与场景）：H7 用 OTYPER */
void h7_gpio_opendrain(h7_gpio_t *port, uint8_t pin)
{
    port->OTYPER |= (1u << pin);
    port->MODER = (port->MODER & ~(3u << (pin * 2u))) | (H7_MODER_OUT << (pin * 2u));
}
