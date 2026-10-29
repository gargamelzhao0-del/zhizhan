// M08 探针：ISR 里 volatile 与 std::atomic 的取舍
// 两个问题：（一）atomic 落到什么指令上？（二）换到 M0 会不会拉进 libatomic？
#include <atomic>
#include <cstdint>

volatile std::uint32_t g_shared;
std::atomic<bool>     g_ready{false};    // 标志位
std::atomic<std::uint32_t> g_count{0};   // 计数器

extern "C" void EXTI0_IRQHandler() {     // ISR 上下文
    g_shared = 42;
    g_ready.store(true, std::memory_order_release);   // 发布：先数据、后标志
}

std::uint32_t main_loop() {
    if (g_ready.load(std::memory_order_acquire)) {    // 订阅
        return g_shared;
    }
    return 0;
}

std::uint32_t bump() {                   // 原子自增：M0 上往往要帮手
    return g_count.fetch_add(1, std::memory_order_relaxed);
}
