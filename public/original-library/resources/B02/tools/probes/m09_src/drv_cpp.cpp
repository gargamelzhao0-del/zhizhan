// M09 探针：C++ 侧。同一个函数，加不加 extern "C" 决定它在符号表里长什么样
#include <cstdint>

std::uint32_t g_calls;                      // 全局命名空间下的变量名同样不被修饰

extern "C" std::uint32_t drv_open(std::uint32_t id) {   // C 看得见
    ++g_calls;
    return id + 1;
}

std::uint32_t drv_close_mangled(std::uint32_t id) {     // 没加 extern "C"：名字被修饰
    return id - 1;
}
