// regs_fail.cpp —— 故意把 BSRR 的偏移写错一位，看 static_assert 怎么拦
#include <cstdint>
#include <cstddef>

struct gpio_regs {
    volatile uint32_t crl;
    volatile uint32_t crh;
    volatile uint32_t idr;
    volatile uint32_t odr;
    volatile uint32_t bsrr;
};

static_assert(offsetof(gpio_regs, odr)  == 0x0Cu, "ODR 偏移应为 0x0C");
static_assert(offsetof(gpio_regs, bsrr) == 0x14u, "BSRR 偏移应为 0x10");  // ← 写错了
