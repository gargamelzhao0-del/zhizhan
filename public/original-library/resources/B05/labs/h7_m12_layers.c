/* h7_m12_layers.c — 同一“置位 LED”的三种写法（H7 版），用于跨平台体积对照
 * H7 的 BSRR 与 F1 语义相同，但 MODER 是 2 位/引脚；抽象层次与取舍结论与 F1 一致。 */
#include "stm32h7_regs.h"

/* 档 1：裸寄存器 */
void h7_led_reg(void) { H7_GPIOB->BSRR = (1u << 0); }

/* 档 2：内联封装（零开销抽象） */
static inline void h7_gpio_set(h7_gpio_t *p, uint32_t bits) { p->BSRR = bits; }
void h7_led_inline(void) { h7_gpio_set(H7_GPIOB, (1u << 0)); }

/* 档 3：运行期句柄 */
typedef struct { h7_gpio_t *port; uint32_t pin; } h7_gpio_handle_t;
static h7_gpio_handle_t g_h7_led = { H7_GPIOB, 0u };

void h7_gpio_handle_write(h7_gpio_handle_t *h, int on)
{
    h->port->BSRR = on ? (1u << h->pin) : (1u << (h->pin + 16u));
}

void h7_led_handle(void) { h7_gpio_handle_write(&g_h7_led, 1); }
