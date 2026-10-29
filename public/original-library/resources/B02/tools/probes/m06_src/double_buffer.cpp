// double_buffer.cpp —— 取自站点 07-m06.html 的代码块，逐字一致
#include <atomic>
#include <cstdint>

struct Frame { uint8_t data[16]; };

static Frame g_buf[2];
static std::atomic<uint8_t> g_state[2];    // 0 = 空闲（生产者可写）；1 = 就绪（消费者可读）

// 中断侧（生产者）：找一块空闲缓冲 → 填数据 → release 标"就绪"
bool isr_fill(const uint8_t* src) {
    for (int i = 0; i < 2; i++) {
        if (g_state[i].load(std::memory_order_acquire) == 0) {
            for (int k = 0; k < 16; k++) g_buf[i].data[k] = src[k];
            g_state[i].store(1, std::memory_order_release);  // 数据先落地，再发布"就绪"
            return true;
        }
    }
    return false;   // 两块都还没被消费：丢弃本帧（工程上应计数而非静默丢）
}

// 主循环侧（消费者）：找到就绪缓冲 → 取数据 → release 标"空闲"归还
bool main_poll(Frame* out) {
    for (int i = 0; i < 2; i++) {
        if (g_state[i].load(std::memory_order_acquire) == 1) {
            *out = g_buf[i];                                 // 此刻 data 一定已写好
            g_state[i].store(0, std::memory_order_release);  // 归还：生产者以后可复用
            return true;
        }
    }
    return false;
}
