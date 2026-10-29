// spinlock.cpp —— 用 atomic_flag 实现自旋锁（acquire/release 语义）
#include <atomic>
#include <cstdint>

class SpinLock {
public:
    void lock() noexcept {
        while (flag_.test_and_set(std::memory_order_acquire)) { /* 自旋等待 */ }
    }
    void unlock() noexcept {
        flag_.clear(std::memory_order_release);
    }
private:
    std::atomic_flag flag_ = ATOMIC_FLAG_INIT;
};

static SpinLock g_lock;
static uint32_t g_counter = 0;

void locked_inc() {
    g_lock.lock();
    g_counter++;              // 临界区：只在这里改
    g_lock.unlock();
}
