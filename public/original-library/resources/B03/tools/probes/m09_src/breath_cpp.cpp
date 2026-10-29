// 定时器 PWM 呼吸灯：同一功能，C++ 版（C-ABI 导出，便于体积对照）
#include <cstdint>

extern "C" void breath_cpp(volatile std::uint32_t* arr, std::uint32_t period) {
    for (std::uint32_t d = 0; d < period; d++) {
        *arr = d;
        for (volatile std::uint32_t i = 0; i < period; i++) { }
    }
}
