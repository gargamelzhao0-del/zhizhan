// M05 探针 A：裸指针 + 手工析构（基线）
#include <cstdint>
#include <new>

struct Uart {
    volatile std::uint32_t cr;
    void write(std::uint32_t b) { cr = b; }
};

alignas(Uart) unsigned char g_pool[sizeof(Uart)];   // 静态内存池：不碰堆

std::uint32_t raw_use(std::uint32_t b) {
    Uart* p = new (g_pool) Uart{};                  // placement new
    p->write(b);
    std::uint32_t got = p->cr;
    p->~Uart();                                     // 手工析构
    return got;
}
