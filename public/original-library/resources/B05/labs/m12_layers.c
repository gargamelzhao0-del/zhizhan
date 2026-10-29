/* m12_layers.c — B05-M12 分层取舍：同一“置位 LED”的三种写法体积对照
 * 用 -ffunction-sections + objdump 逐函数看体量；正文给出真实测量。 */
#include "stm32f103_regs.h"

/* 档 1：裸寄存器宏 */
void led_set_reg(void) { GPIOC->BSRR = (1u << 13); }

/* 档 2：CMSIS 风格内联封装（仍是编译期展开，零调用开销） */
static inline void gpio_set_bits(gpio_t *port, uint32_t bits)
{
    port->BSRR = bits;
}
void led_set_inline(void) { gpio_set_bits(GPIOC, (1u << 13)); }

/* 档 3：带句柄的运行期抽象（多一次间接访问，换来可替换实现） */
typedef struct {
    gpio_t  *port;
    uint32_t pin;
} gpio_handle_t;

static gpio_handle_t g_led = { GPIOC, 13u };

void gpio_handle_write(gpio_handle_t *h, int on)
{
    if (on) {
        h->port->BSRR = (1u << h->pin);
    } else {
        h->port->BSRR = (1u << (h->pin + 16u));
    }
}

void led_set_handle(void) { gpio_handle_write(&g_led, 1); }
