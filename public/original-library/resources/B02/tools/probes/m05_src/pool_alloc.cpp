// pool_alloc.cpp —— 固定块内存池：分配 = 从空闲链表弹一个，O(1) 且永不碎片化
// 与 heap_alloc.cpp 提供完全相同的 C 接口，便于同条件对照（FIG 5.1 实测来源）。
#include <cstdint>
#include <cstddef>

namespace {
struct Block { Block* next; };

constexpr std::size_t N = 8;
Block         g_slots[N];
Block*        g_free = nullptr;
std::uint32_t g_used = 0;
}  // namespace

extern "C" void pool_init() {
    for (std::size_t i = 0; i + 1 < N; i++) g_slots[i].next = &g_slots[i + 1];
    g_slots[N - 1].next = nullptr;
    g_free = &g_slots[0];
}

extern "C" void* xalloc() {
    Block* b = g_free;
    if (!b) return nullptr;      // 池空：由调用方决定怎么退让（这里如实返回空）
    g_free = b->next;
    g_used++;
    return b;
}

extern "C" void xfree(void* p) {
    if (!p) return;
    Block* b = static_cast<Block*>(p);
    b->next = g_free;            // 头插，无合并、无块头、无碎片
    g_free  = b;
    g_used--;
}
