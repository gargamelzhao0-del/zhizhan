// M04 探针用：一个策略模板。每个策略的 wait_spins 不同，保证实例化体互不相同
// —— 这正是"模板零开销"的代价所在：每换一个策略参数，就多一份真实代码。
#pragma once
#include <cstdint>
#include <type_traits>

struct Blocking { static constexpr std::uint32_t wait_spins = 1; };
struct Polling  { static constexpr std::uint32_t wait_spins = 2; };
struct Irq      { static constexpr std::uint32_t wait_spins = 4; };
struct Dma      { static constexpr std::uint32_t wait_spins = 8; };

template <class Policy>
struct Spi {
    static inline volatile std::uint32_t sr = 0;   // 状态寄存器
    static inline volatile std::uint32_t dr = 0;   // 数据寄存器

    static std::uint32_t transfer(std::uint32_t w) {
        for (std::uint32_t i = 0; i < Policy::wait_spins; ++i) {
            w ^= (sr & 0xFFu);
        }
        dr = w;
        return sr;
    }
};
