// M05 探针 B：同一个对象，改由 unique_ptr + 无状态删除器持有
// 期望：生成的代码与 A 完全一致 —— 这就是"零开销"
#include <cstdint>
#include <memory>
#include <new>

struct Uart {
    volatile std::uint32_t cr;
    void write(std::uint32_t b) { cr = b; }
};

alignas(Uart) unsigned char g_pool[sizeof(Uart)];

struct PoolDeleter {                                 // 无状态：不占对象空间
    void operator()(Uart* p) const { p->~Uart(); }
};

std::uint32_t uptr_use(std::uint32_t b) {
    std::unique_ptr<Uart, PoolDeleter> p(new (g_pool) Uart{});
    p->write(b);
    return p->cr;                                    // 出作用域自动析构
}
