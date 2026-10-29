// M04 探针 B：同一模板实例化 4 个策略 —— 代码膨胀就是这么来的
#include "spi.hpp"

std::uint32_t use_blocking(std::uint32_t w) { return Spi<Blocking>::transfer(w); }
std::uint32_t use_polling (std::uint32_t w) { return Spi<Polling >::transfer(w); }
std::uint32_t use_irq     (std::uint32_t w) { return Spi<Irq     >::transfer(w); }
std::uint32_t use_dma     (std::uint32_t w) { return Spi<Dma     >::transfer(w); }
