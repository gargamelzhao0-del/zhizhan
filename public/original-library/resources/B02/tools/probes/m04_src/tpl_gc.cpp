// M04 探针 C：4 个实例化都在，但只调用其中 1 个 —— 用来演示 --gc-sections 能回收
#include "spi.hpp"

std::uint32_t use_blocking(std::uint32_t w) { return Spi<Blocking>::transfer(w); }
std::uint32_t use_polling (std::uint32_t w) { return Spi<Polling >::transfer(w); }
std::uint32_t use_irq     (std::uint32_t w) { return Spi<Irq     >::transfer(w); }
std::uint32_t use_dma     (std::uint32_t w) { return Spi<Dma     >::transfer(w); }

int main() {
    return static_cast<int>(use_blocking(1));   // 只引用 Blocking 这一份
}
