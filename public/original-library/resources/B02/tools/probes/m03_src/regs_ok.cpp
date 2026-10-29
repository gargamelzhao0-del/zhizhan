// regs_ok.cpp —— 取自站点 04-m03.html 的 regs.hpp 代码块，逐字一致
#include <cstdint>
#include <cstddef>

struct gpio_regs {
    volatile uint32_t crl;    // 0x00
    volatile uint32_t crh;    // 0x04
    volatile uint32_t idr;    // 0x08
    volatile uint32_t odr;    // 0x0C
    volatile uint32_t bsrr;   // 0x10
};

// 编译期断言：布局一旦被改动，这里立刻报错（不用等运行期）
static_assert(offsetof(gpio_regs, odr)  == 0x0Cu, "ODR 偏移应为 0x0C");
static_assert(offsetof(gpio_regs, bsrr) == 0x10u, "BSRR 偏移应为 0x10");

// constexpr：把"位号/宽度"写成编译期常量，运行时零成本
struct Field { uint8_t pos; uint8_t width; };
constexpr Field CRL_MODE0{0, 2};        // CRL 里每个引脚低 2 位是 MODE
constexpr Field CRL_CNF0 {2, 2};        // 高 2 位是 CNF
constexpr uint32_t field_mask(Field f) { return ((1u << f.width) - 1u) << f.pos; }
static_assert(field_mask(CRL_MODE0) == 0x3u, "MODE 掩码应为 0x3");
static_assert(field_mask(CRL_CNF0)  == 0xCu, "CNF 掩码应为 0xC");

// constinit（C++20）：保证"静态初始化"，杜绝运行期初始化顺序问题
constinit uint32_t g_error_count = 0;
