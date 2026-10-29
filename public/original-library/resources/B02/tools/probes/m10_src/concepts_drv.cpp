// M10 探针 B：重构后 —— concepts + 模板，类型即契约，没有虚表也没有 void* ctx
#include <cstdint>
#include <concepts>

struct UartHw { volatile std::uint32_t cr; };
UartHw g_hw;

struct Uart {
    void init()  { g_hw.cr = 1; }
    void write(std::uint32_t b) { g_hw.cr = b; }
    std::uint32_t last() const { return g_hw.cr; }
};

template <class D>
concept Driver = requires(D& d, std::uint32_t b) {
    d.init();
    d.write(b);
    { d.last() } -> std::convertible_to<std::uint32_t>;
};

template <Driver D>
std::uint32_t use_generic(D& d, std::uint32_t b) {   // 同样三件事
    d.init();
    d.write(b);
    return d.last();
}

// 取地址强制实例化，避免被内联掉后看不到生成体
auto volatile g_fp = &use_generic<Uart>;
