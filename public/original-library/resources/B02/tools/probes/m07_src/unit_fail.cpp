// M07 探针 B：同一份代码，把毫秒传给微秒参数 —— 期望编译期被拦下
// 对照《嵌入式 C》第①册：这在 C 里只是两个 uint32_t，编译器一声不吭。
#include <cstdint>

template <class Tag>
struct Unit {
    std::uint32_t v;
    explicit constexpr Unit(std::uint32_t x) : v(x) {}
};

struct MsTag {};
struct UsTag {};
using Ms = Unit<MsTag>;
using Us = Unit<UsTag>;

volatile std::uint32_t g_sink;

void delay_us(Us t) { g_sink = t.v; }

std::uint32_t run() {
    delay_us(Ms{1000});                      // ← 单位错了：Ms 不是 Us
    return g_sink;
}
