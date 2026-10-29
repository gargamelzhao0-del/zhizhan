// atom.cpp —— 取自站点 07-m06.html 的代码块，逐字一致
#include <atomic>
#include <cstdint>

static std::atomic<uint32_t> g_cnt{0};

uint32_t bump() { return g_cnt.fetch_add(1, std::memory_order_relaxed); }

// 经典模式：先把数据写好，再用 release 存储"标志"
void publish(uint32_t* p, std::atomic<uint32_t>& flag) {
    *p = 42;
    flag.store(1, std::memory_order_release);   // 之前的写必须对"读到 1 的人"可见
}

// 订阅侧：用 acquire 读标志，之后的读不会跑到它前面
bool consume(const uint32_t* p, std::atomic<uint32_t>& flag) {
    if (flag.load(std::memory_order_acquire) == 1) return *p == 42;
    return false;
}
