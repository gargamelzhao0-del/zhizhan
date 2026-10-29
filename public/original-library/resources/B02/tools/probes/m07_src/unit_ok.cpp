// M07 探针 A：用类型系统拦住"把毫秒传给微秒"—— 正确写法
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

void delay_us(Us t) { g_sink = t.v; }        // 只接受微秒

std::uint32_t run() {
    delay_us(Us{1000});                      // 明确构造：类型对得上
    return g_sink;
}
