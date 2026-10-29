// relaxed_bad.cpp —— 取自站点 07-m06.html 的代码块，逐字一致
#include <atomic>
#include <cstdint>

static uint32_t g_data = 0;
static std::atomic<uint32_t> g_flag{0};

void producer() {
    g_data = 42;
    // ✕ relaxed：不约束顺序，写 g_data 可能被挪到写标志之后
    g_flag.store(1, std::memory_order_relaxed);
    // ✔ 正解：g_flag.store(1, std::memory_order_release);
}

bool consumer(uint32_t* out) {
    if (g_flag.load(std::memory_order_relaxed) == 1) {   // ✔ 正解：load(std::memory_order_acquire)
        *out = g_data;                                    // relaxed 下，这里可能是旧值
        return true;
    }
    return false;
}
