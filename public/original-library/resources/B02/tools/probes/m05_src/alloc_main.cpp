// alloc_main.cpp —— 两种实现共用的调用方，用于同条件链接对照
extern "C" void  pool_init();
extern "C" void* xalloc();
extern "C" void  xfree(void*);

int main() {
    pool_init();
    void* p = xalloc();
    xfree(p);
    return p == nullptr;
}
