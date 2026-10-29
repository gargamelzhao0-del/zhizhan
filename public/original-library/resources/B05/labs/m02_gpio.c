/* m02_gpio.c — B05-M02 GPIO 深入
 * LED(PC13) + 按键(PA0 上拉) 的寄存器写法；BSRR 原子置位/清除。
 * F1 每引脚 4 位：bit[1:0]=MODE，bit[3:2]=CNF。PC13/14/15 上限 2 MHz、3 mA。 */
#include "stm32f103_regs.h"

#define LED_PIN   13u
#define BUTTON_PIN 0u

void gpio_demo_init(void)
{
    RCC_APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPCEN;

    /* PA0：输入上拉（CNF=10, MODE=00） */
    GPIOA->CRL = (GPIOA->CRL & ~(0xFu << (BUTTON_PIN * 4u)))
               | ((uint32_t)GPIO_CNF_IN_PU << 2)
               | (uint32_t)GPIO_MODE_INPUT;

    /* PC13：通用推挽输出，2 MHz（不能用 50 MHz——RM0008 限 PC13/14/15 为 2 MHz/3 mA） */
    GPIOC->CRH = (GPIOC->CRH & ~(0xFu << ((LED_PIN - 8u) * 4u)))
               | ((uint32_t)GPIO_CNF_OUT_PP << 2)
               | (uint32_t)GPIO_MODE_OUT_2M;
}

/* BSRR 写 1 原子生效：低位区=置位，高位区=清除；不需要读-改-写 */
void led_on(void)  { GPIOC->BSRR = (1u << LED_PIN); }
void led_off(void) { GPIOC->BSRR = (1u << (LED_PIN + 16u)); }
void led_toggle_sw(void) { static uint32_t s; s ^= 1u; if (s) led_on(); else led_off(); }

/* 上拉输入：松开为高、按下为低 */
int button_pressed(void) { return (GPIOA->IDR & (1u << BUTTON_PIN)) == 0u; }

/* 反面示例（片段，不单独编译）：开漏输出必须外接上拉，否则只能输出低电平，
 * 因为开漏结构只能“拉低”，不能“推高”；IC/总线场景常故意如此。 */
