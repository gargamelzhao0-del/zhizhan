/* gpio_c.c —— 与站点 03-m02.html 的 gpio_c.c 代码块逐字一致
   谁调用 gpio_deinit，谁负责；编译器不检查。平台：STM32F1（CRL/CRH + BSRR）。 */
#include <stdint.h>
typedef struct {
    volatile uint32_t crl, crh, idr, odr, bsrr;   /* STM32F1 GPIO 寄存器 */
} gpio_regs_t;

static void gpio_init(gpio_regs_t *g, uint8_t pin, int as_output)
{
    if (!as_output) return;
    volatile uint32_t *cfg = (pin < 8u) ? &g->crl : &g->crh;
    const uint32_t sh = (pin & 7u) * 4u;
    *cfg = (*cfg & ~(0xFu << sh)) | (0x1u << sh);
}
static void gpio_deinit(gpio_regs_t *g, uint8_t pin)
{
    volatile uint32_t *cfg = (pin < 8u) ? &g->crl : &g->crh;
    const uint32_t sh = (pin & 7u) * 4u;
    *cfg &= ~(0xFu << sh);
}
void use_gpio(gpio_regs_t *g, uint8_t pin, int fail_early)
{
    gpio_init(g, pin, 1);
    if (fail_early) return;
    g->bsrr = (1u << pin);
    gpio_deinit(g, pin);
}
