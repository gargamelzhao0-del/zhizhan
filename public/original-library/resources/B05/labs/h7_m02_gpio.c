/* h7_m02_gpio.c — STM32H7 GPIO：每引脚 2 位的 MODER/OTYPER/OSPEEDR/PUPDR/AFR
 * 与 F1 的 CRL/CRH 4 位 nibble 完全不同；这是跨 F1→H7 移植时必改的一段。 */
#include "stm32h7_regs.h"

#define H7_AF_TIM2 1u   /* PA5 作为 TIM2_CH1 的复用值（AF1） */

void h7_gpio_pa5_af(void)
{
    H7_RCC_AHB4ENR |= (1u << 0);                       /* 开 GPIOA 时钟（H7 用 AHB4ENR） */
    uint32_t s = 5u * 2u;
    H7_GPIOA->MODER   = (H7_GPIOA->MODER & ~(3u << s)) | (H7_MODER_AF << s);
    H7_GPIOA->OTYPER &= ~(1u << 5);                    /* 推挽 */
    H7_GPIOA->OSPEEDR |= (3u << s);                    /* 非常快 */
    H7_GPIOA->PUPDR   &= ~(3u << s);                   /* 无上下拉 */
    H7_GPIOA->AFR[0] = (H7_GPIOA->AFR[0] & ~(0xFu << (5u * 4u)))
                     | (H7_AF_TIM2 << (5u * 4u));      /* AFR[0] 管 pin0..7 */
}

/* BSRR 语义与 F1 相同：低位区置位、高位区清除，单次写原子生效 */
void h7_led_on(void)  { H7_GPIOB->BSRR = (1u << 0); }
void h7_led_off(void) { H7_GPIOB->BSRR = (1u << (0 + 16)); }
