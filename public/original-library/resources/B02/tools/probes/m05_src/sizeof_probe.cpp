// M05 探针 C：句柄本身多大？用"数组长度进符号表"这个技巧把 sizeof 变成可 nm 读出的实数
#include <cstdint>
#include <memory>

struct Uart { volatile std::uint32_t cr; };

struct PoolDeleter {                                        // 无状态删除器
    void operator()(Uart* p) const { p->~Uart(); }
};

struct CapDeleter {                                         // 有状态删除器：得存点东西
    std::uint32_t* stats;
    void operator()(Uart* p) const { if (stats) *stats = 1; p->~Uart(); }
};

extern "C" {
char sz_raw[sizeof(Uart*)];                                 // 裸指针基线
char sz_default[sizeof(std::unique_ptr<Uart>)];             // 默认删除器
char sz_pool[sizeof(std::unique_ptr<Uart, PoolDeleter>)];   // 无状态自定义删除器
char sz_cap[sizeof(std::unique_ptr<Uart, CapDeleter>)];     // 有状态 -> 多存一个指针
}
