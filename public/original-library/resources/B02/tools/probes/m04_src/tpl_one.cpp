// M04 探针 A：只实例化 1 个策略
#include "spi.hpp"

std::uint32_t only_blocking(std::uint32_t w) {
    return Spi<Blocking>::transfer(w);
}
