// relaxed_ok.cpp —— 与 relaxed_bad.cpp 同一份逻辑，标志改用 release/acquire
#include <atomic>
#include <cstdint>

static uint32_t g_data = 0;
static std::atomic<uint32_t> g_flag{0};

void producer() {
    g_data = 42;
    g_flag.store(1, std::memory_order_release);   // 屏障在写前
}

bool consumer(uint32_t* out) {
    if (g_flag.load(std::memory_order_acquire) == 1) {   // 屏障在读后
        *out = g_data;
        return true;
    }
    return false;
}
