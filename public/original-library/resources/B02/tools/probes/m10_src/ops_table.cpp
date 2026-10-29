// M10 探针 A：重构前 —— 第①册模块 07 的 ops 虚表 + void* ctx 写法
#include <cstdint>

struct UartHw { volatile std::uint32_t cr; };
UartHw g_hw;

struct DriverOps {
    void (*init)(void*);
    void (*write)(void*, std::uint32_t);
};

static void uart_init(void* ctx)  { static_cast<UartHw*>(ctx)->cr = 1; }
static void uart_write(void* ctx, std::uint32_t b) { static_cast<UartHw*>(ctx)->cr = b; }

const DriverOps uart_ops{uart_init, uart_write};

// 调用方只认接口：两个函数指针，都要经寄存器间接跳转
std::uint32_t use_ops(const DriverOps* ops, void* ctx, std::uint32_t b) {
    ops->init(ctx);
    ops->write(ctx, b);
    return static_cast<UartHw*>(ctx)->cr;
}
