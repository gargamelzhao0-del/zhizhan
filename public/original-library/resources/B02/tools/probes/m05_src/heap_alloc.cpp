// heap_alloc.cpp —— 同样的接口，但底下是堆：new/delete → malloc/free → _sbrk
// 与 pool_alloc.cpp 同条件对照（FIG 5.1 实测来源）。
#include <cstdint>
#include <cstddef>
#include <new>

extern "C" void pool_init() {}   // 空实现，保持接口一致

extern "C" void* xalloc() {
    return ::operator new(sizeof(void*), std::nothrow);   // 块头 + 查找空闲块 + 必要时 sbrk
}

extern "C" void xfree(void* p) {
    ::operator delete(p);        // 归还并尝试与相邻空闲块合并
}
