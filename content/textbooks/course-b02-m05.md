# 资源管理：所有权与静态分配

```zhizhan-anchor
m05
```



第①册反复强调"嵌入式慎用 ` malloc `"。C\+\+ 的答案不是"也慎用指针"，而是  **用类型表达[所有权](term:ownership)** ：` unique_ptr ` 自定义删除器、placement new、` std::span `， 以及"能静态就静态"的内存池。这一节的核心是： **把资源管好，同时一个字节都不多花** 。

 

> ◷ 约 70 分钟 · ◈ unique\_ptr / placement new / span · ⚑ 静态优先

 

```zhizhan-anchor
m05-1
```



## 5.1 所有权：` unique_ptr ` 为什么是零开销的

 

` std::unique_ptr<T, D> ` 就是"一个 T\* 加一个删除器 D"。 当 ` D ` 是 **空类型** （无状态）时，编译器用 **空基类优化** 把它压成 0 字节 —— 于是 ` unique_ptr<T> ` 的大小 **恰好等于一个指针** ，析构时静态调用删除器。

 

unique\_handle.cpp — 自定义删除器 \+ 大小断言 C\+\+

 

```text
// unique_handle.cpp —— 用 unique_ptr 表达"独占所有权"
#include <memory>
#include <cstdint>

struct Session {
    int  id;
    void (*close)(int);
};

// 删除器：无状态 → 可被空基类优化，不占额外空间
struct SessionCloser {
    void operator()(Session* s) const noexcept {
        if (s && s->close) s->close(s->id);
    }
};
using SessionPtr = std::unique_ptr<Session, SessionCloser>;

// 关键：unique_ptr<T>（默认删除器）与裸指针同宽
static_assert(sizeof(std::unique_ptr<int>) == sizeof(int*), "unique_ptr 不该比裸指针大");

// 注意：删除器若"有状态"（比如存了一个上下文指针），它就会被算进去
struct CtxCloser { void* ctx; void operator()(Session*) const noexcept {} };
static_assert(sizeof(std::unique_ptr<Session, CtxCloser>) > sizeof(int*), "有状态删除器要占空间");
```

 

**bash**  — 复跑：` bash tools/probes/m05.sh `（Arm GNU Toolchain 13.3.1，cortex-m3）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -c own_raw.cpp  -o own_raw.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -c own_uptr.cpp -o own_uptr.o
$ arm-none-eabi-size own_raw.o own_uptr.o
   text    data     bss     dec     hex filename
     12       0       4      16      10 own_raw.o
     12       0       4      16      10 own_uptr.o
$ # 把两个 .o 的反汇编剥掉地址与函数名行后逐条 diff：
  diff 无差异 —— 两者生成完全相同的指令序列

$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -c sizeof_probe.cpp -o sizeof_probe.o
$ arm-none-eabi-nm --print-size --demangle sizeof_probe.o | grep ' sz_'
  sz_cap       8 字节      # 有状态删除器：多存一个指针
  sz_default   4 字节      # std::unique_ptr<Uart>
  sz_pool      4 字节      # unique_ptr<Uart, PoolDeleter>，无状态删除器
  sz_raw       4 字节      # 裸指针基线
```

 

◆ 结论：所有权可以"免费"表达

 

` unique_ptr<T> ` = 一个指针： **不引入运行时开销，却让"谁负责释放"变成类型事实** 。 它是 RAII（Module 02）在"句柄"上的标准应用。注意两点：① 删除器有状态就会占空间；②  **它默认用 ` delete `** ， 若对象不是 ` new ` 出来的（比如是静态内存里的对象），要换成"不 delete"的删除器。

 

✔ 删除器的几种形态与开销（32 位 ARM）

 

 
- **无状态函数对象** （如 ` SessionCloser `）：被空基类优化， **0 字节**  → 整体 = 1 个指针（4 字节）。
 
- **无捕获 lambda** ：同样是无状态类型，结果同上。
 
- **函数指针**  ` unique_ptr<T, void(*)(T*)> `：删除器自身就是一个指针 → 整体  **8 字节** （本例 ` sz_cap `）。
 
- **有状态对象** （存池指针 / 上下文）：多存一分状态；成员若可用 ` [[no_unique_address]] `（C\+\+20）标出，空成员不占位。

 

```zhizhan-anchor
m05-2
```



## 5.2 placement new：在静态内存上"构造"对象

 

MCU 上我们常常手头有一块 **静态内存** （全局数组 / 专用段 / 内存池），不想每次都动态分配。 placement new 让你" **在这块内存上调用构造函数** "。要澄清一个常见误解：  **placement new 本身并不是 RAII**  —— 它只做"显式构造"，析构也要显式调用； 想让它变成 RAII，得自己（或用 ` unique_ptr ` \+ 自定义删除器）包一层。

 

placement.cpp — 静态存储 \+ 显式构造/析构 C\+\+

 

```text
// placement.cpp —— 存储来自静态数组，构造/析构仍然是显式的一对
#include <new>          // placement new
#include <cstdint>

class Logger {
public:
    explicit Logger(uint32_t sink_addr) noexcept : sink_(sink_addr) {}
    void put(char c) noexcept { (void)c; /* 写 sink_ */ }
    ~Logger() noexcept { /* 关闭、flush 等 */ }
private:
    uint32_t sink_;
};

// 存储：静态、对齐满足 Logger 的要求
alignas(Logger) static uint8_t g_logger_mem[sizeof(Logger)];

// 返回指针：由调用方持有，并在适当时机显式析构
Logger* bring_up_logger(uint32_t addr)
{
    Logger* lg = new (g_logger_mem) Logger(addr);   // 在静态内存上构造
    lg->put('A');
    return lg;               // 调用方在适当时机 lg->~Logger()
    // ⚠ 在 lg->~Logger() 之前再次调用本函数 → 把新对象构造到仍存活的对象上（UB）
}
```

 

⚠ placement new 的三条纪律

 

 
- **对齐** ：存储必须满足类型的对齐要求，用 ` alignas(T) ` 明确写出来。
 
- **不配对的析构 = 资源泄漏** ：placement new 出来的对象，析构要自己调（` p->~T() `）—— 它不在栈上，没有自动析构。
 
- **别和 ` delete ` 混用** ：不能用 ` delete p ` 释放 placement 对象（那会走堆），要用 RAII 包装或显式析构。
 
- **同一块存储上，前一个对象必须先析构、再构造下一个** ：在旧对象仍存活时就地 placement new 一个新对象，是未定义行为（旧对象没被销毁）。

 

```zhizhan-anchor
m05-3
```



## 5.3 ` std::span `：把"指针 \+ 长度"变成一个类型

 

第①册里到处都是 ` (const uint8_t* buf, uint32_t len) ` 这样的成对参数 —— 忘了传长度、或长度传错是常见 bug。 ` std::span `（C\+\+20）把两者绑成一个 **视图对象** （不拥有数据），接口与调用都更安全。

 

span.cpp — 视图：不拷贝、不拥有、自带长度 C\+\+

 

```text
// span.cpp —— 用 std::span 传"一段只读字节"
#include <span>
#include <cstdint>
#include <array>

// 收方：不关心来源，只在视图上操作
uint8_t checksum(std::span<const uint8_t> data) noexcept {
    uint8_t s = 0;
    for (uint8_t b : data) s = (uint8_t)(s + b);
    return s;
}

void demo() noexcept {
    std::array<uint8_t, 4> a{1, 2, 3, 4};
    uint8_t raw[3] = {9, 8, 7};

    (void)checksum(a);              // 从 std::array 构造视图
    (void)checksum(raw);            // 从 C 数组构造视图（长度自动推出）
    (void)checksum({raw, 2});       // 显式取前 2 个：`span(ptr, len)` 的老写法也有了类型
}
```

 

✔ 为什么它值得用

 

` std::span ` 是 **非拥有视图** （两个机器字：指针 \+ 长度）， **零拷贝、零分配** 。 它把"指针 \+ 长度"从"两个要记得配对传的参数"变成"一个不可能对不上的对象"—— 这正是第①册 Module 03 想表达的"类型即护栏"。  *注意它不是所有者的替代品：它不负责释放，别拿它当 unique\_ptr 用。*

 

```zhizhan-anchor
m05-4
```



## 5.4 内存池：MCU 上的"动态分配"正解

 

有时确实需要"运行期申请/归还"。比起 ` malloc ` 的通用堆，嵌入式更常用 **固定块内存池** ： 所有块等大、零碎片；用 **空闲链表（free-list）** 可做到 O(1) 分配（第①册 Module 04 已给出 C 版）。C\+\+ 里可以把它包成类型安全的小工厂。

 

| 方案 | 碎片 | 分配时间 | 适用 |
| --- | --- | --- | --- |
| ` malloc/free ` | 有 | 不确定 | 尽量不用 |
| 固定块池 | 无 | 空闲链表 O(1) | 同类对象（报文、节点、句柄） |
| arena / 线性分配 | 按生命周期整块回收 | 接近 O(1) | 一次性建好、用完整体丢弃 |
| ` std::pmr ` | 取决于 memory\_resource | 视实现 | 头文件大、体积敏感则慎用；可用其"单调/池"资源的思想自写 |

 

fixed\_pool.cpp — 固定块池 \+ unique\_ptr 句柄：自动归还 C\+\+

 

```text
// fixed_pool.cpp —— 把"固定块池"和"所有权"接起来
#include <memory>
#include <array>
#include <cstdint>

struct Msg { uint8_t data[32]; bool in_use; };

class MsgPool {
public:
    Msg* acquire() noexcept {
        // 直观版：线性找一个空块（最坏 O(n)）。要真正的 O(1)，改成空闲链表 —— 见下方探针 pool_alloc.cpp
        for (auto& m : pool_) if (!m.in_use) { m.in_use = true; return &m; }
        return nullptr;                 // 池满：是要处理的设计情况，不是"分配失败"
    }
    void release(Msg* m) noexcept { if (m) m->in_use = false; }
private:
    std::array<Msg, 8> pool_{};          // 全部静态存储，零碎片
};

// 有状态的删除器：它知道归还到哪个池（所以比空删除器多占一个指针，§5.1）
struct PoolDeleter {
    MsgPool* pool;
    void operator()(Msg* m) const noexcept { if (pool) pool->release(m); }
};
using MsgHandle = std::unique_ptr<Msg, PoolDeleter>;

MsgHandle acquire_msg(MsgPool& p) noexcept {
    return MsgHandle{ p.acquire(), PoolDeleter{&p} };   // 离开作用域自动 release
}

void use(MsgPool& pool) {
    MsgHandle h = acquire_msg(pool);
    if (!h) return;                       // 池满
    h->data[0] = 0xAA;
    // 作用域结束 → ~unique_ptr → PoolDeleter → pool.release(h)
}
```

 

**bash**  — 复跑：` bash tools/probes/m05.sh `（两份 **接口完全相同** 的分配器，同条件 A/B 链接）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c pool_alloc.cpp -o pool_alloc.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c heap_alloc.cpp -o heap_alloc.o
$ arm-none-eabi-size pool_alloc.o heap_alloc.o
   text    data     bss     dec     hex filename
    104       0      40     144      90 pool_alloc.o
     20       0       0      20      14 heap_alloc.o
$ arm-none-eabi-nm --print-size --size-sort pool_alloc.o
00000038 00000018 T xalloc
00000050 00000018 T xfree
00000000 00000038 T pool_init
00000000 00000020 b _ZN12_GLOBAL__N_17g_slotsE
# ① 池的"记账"全在这 104 字节里（24 + 24 + 56 的代码 + 32 字节槽）。
#    堆那份只有 20 字节 —— 因为它只负责 bl 出去，真正的实现不在你的源码里。
#    成本没有消失，只是搬到了你看不见的地方。

$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics --specs=nosys.specs alloc_main.o pool_alloc.o -o pool.elf
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics --specs=nosys.specs alloc_main.o heap_alloc.o -o heap.elf
$ arm-none-eabi-size pool.elf heap.elf
   text    data     bss     dec     hex filename
  10684    1404    880   12968    32a8 pool.elf
  81252    2044   1332   84628   14a94 heap.elf
# ② 两次链接唯一的差别就是那一个 .o，整镜像却差了 70568 字节。

$ arm-none-eabi-nm heap.elf | grep -E 'verbose_terminate|_svfprintf_r|_dtoa_r|__cxa_throw'
0000f6f4 T __cxa_throw
00015d40 T _dtoa_r
0001302c T _svfprintf_r
00008bc4 T _ZN9__gnu_cxx27__verbose_terminate_handlerEv
$ arm-none-eabi-nm pool.elf | grep -cE 'verbose_terminate|_svfprintf_r|_dtoa_r|__cxa_throw'
0
# ③ 那 70 KB 是 new 的"失败出口"：operator new 在分配失败时会 throw bad_alloc，
#    于是异常运行时 __cxa_throw 被链入；而 terminate 路径又引用 __verbose_terminate_handler，
#    它要格式化输出错误，继续拖来 _svfprintf_r + _dtoa_r + locale + C++ 反修饰器。
#    关键：你即使已经加了 -fno-exceptions，预编译的 libstdc++ 仍会把这套运行时链进来。
```

 

**FIG 5.1**  分配路径图：同样一句 ` xalloc() `，成本落在哪一层 （字节数均为本机 ` nm --print-size ` 实读）

 

```zhizhan-figure
<svg viewBox="0 0 660 336" role="img" aria-label="静态池与堆两条分配路径的成本层级对比"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--grn)"></path></marker></defs>
          <!-- 路径 A -->
          <text x="16" y="40" class="sv-lbl-hi" style="fill:var(--grn)">路径 A · 固定块池：成本全在你自己的代码里</text>
          <rect x="16" y="52" width="118" height="36" rx="4" class="sv-grn-s"></rect>
          <text x="75" y="68" class="sv-lbl-hi" text-anchor="middle">xalloc()</text>
          <text x="75" y="82" class="sv-lbl-dim" text-anchor="middle">24 B</text>
          <line x1="134" y1="70" x2="146" y2="70" class="sv-arrow"></line>
          <rect x="148" y="52" width="168" height="36" rx="4" class="sv-box"></rect>
          <text x="232" y="68" class="sv-lbl" text-anchor="middle">弹空闲链表</text>
          <text x="232" y="82" class="sv-lbl-dim" text-anchor="middle">6 条指令 · 无调用</text>
          <line x1="316" y1="70" x2="328" y2="70" class="sv-arrow"></line>
          <rect x="330" y="52" width="176" height="36" rx="4" class="sv-box"></rect>
          <text x="418" y="68" class="sv-lbl" text-anchor="middle">存储：.bss 里 8 个槽</text>
          <text x="418" y="82" class="sv-lbl-dim" text-anchor="middle">32 B + 8 B 状态</text>
          <text x="514" y="68" class="sv-lbl-hi" style="fill:var(--grn)">镜像 10684 B</text>
          <text x="514" y="82" class="sv-lbl-dim">无 __cxa_throw</text>

          <!-- 路径 B -->
          <text x="16" y="112" class="sv-lbl-hi" style="fill:var(--amb)">路径 B · new/delete：成本在库里，静态链接时整条拖进来</text>
          <rect x="16" y="124" width="118" height="36" rx="4" class="sv-amb-s"></rect>
          <text x="75" y="140" class="sv-lbl-hi" text-anchor="middle">xalloc()</text>
          <text x="75" y="154" class="sv-lbl-dim" text-anchor="middle">14 B</text>
          <line x1="134" y1="142" x2="146" y2="142" class="sv-arrow-a"></line>
          <rect x="148" y="124" width="150" height="36" rx="4" class="sv-box"></rect>
          <text x="223" y="140" class="sv-lbl" text-anchor="middle">operator new</text>
          <text x="223" y="154" class="sv-lbl-dim" text-anchor="middle">libstdc++</text>
          <line x1="298" y1="142" x2="312" y2="142" class="sv-arrow-a"></line>
          <rect x="314" y="124" width="150" height="36" rx="4" class="sv-box"></rect>
          <text x="389" y="140" class="sv-lbl" text-anchor="middle">_malloc_r</text>
          <text x="389" y="154" class="sv-lbl-dim" text-anchor="middle">1384 B</text>
          <line x1="389" y1="164" x2="389" y2="184" stroke="var(--red)" stroke-width="1.6" style="marker-end:url(#ah)"></line>

          <!-- 失败出口 -->
          <rect x="226" y="190" width="418" height="76" rx="6" class="sv-red-s" stroke-dasharray="5 4"></rect>
          <text x="240" y="208" class="sv-lbl" style="fill:var(--red)">失败出口（加了 -fno-exceptions 也照样被链进来）</text>
          <text x="240" y="226" class="sv-lbl-dim">__cxa_throw → __verbose_terminate_handler</text>
          <text x="240" y="242" class="sv-lbl-dim">→ _svfprintf_r 6956 B · _dtoa_r 3732 B</text>
          <text x="240" y="258" class="sv-lbl-dim">→ __loadlocale 1732 B · 反修饰器 9616 B</text>

          <!-- 总账 -->
          <text x="16" y="292" class="sv-lbl-hi">同条件链接的整镜像</text>
          <text x="144" y="295" class="sv-lbl-dim" text-anchor="end">静态池</text>
          <rect x="150" y="282" width="53" height="16" rx="3" class="sv-grn-s"></rect>
          <text x="209" y="295" class="sv-lbl-hi">10684 B</text>
          <text x="280" y="295" class="sv-lbl-dim" style="fill:var(--red)">→ 差 70568 B（×7.6）</text>
          <text x="144" y="319" class="sv-lbl-dim" text-anchor="end">new/delete</text>
          <rect x="150" y="306" width="400" height="16" rx="3" class="sv-red-s"></rect>
          <text x="556" y="319" class="sv-lbl-hi">81252 B</text>
        </svg>
```

 

这是一次 **受控 A/B** ：两次链接除了 ` pool_alloc.o ` 与 ` heap_alloc.o ` 之外，命令、调用方、库、链接脚本全都一样。 区别在"路径有多深"——池的路径 **在第一个方框里就结束了** ：24 字节代码、6 条指令、从 ` .bss ` 的静态槽里弹一个，没有任何函数调用， 所以编译器可以把它整个内联掉，成本 **可读、可审计、可预算** 。 堆的路径则是一路 ` bl ` 出去：14 字节的调用点 → ` operator new ` → ` _malloc_r `， 而且新增加了第二册里不存在的一整片区域—— **失败出口** 。只要 ` operator new ` 有可能失败， 抛异常的路径、终止处理器、格式化与 locale 就被静态链接进来， **70 KB 就是这么来的** 。 这也是为什么"MCU 上尽量别用 ` new `"不是风格偏好，而是 **体积预算问题** 。

 

⚠ ` std::pmr ` 在 MCU 上要掂量

 

` std::pmr ` 提供了"可插拔内存资源"的抽象，思想很好，但会拉入 ` <memory_resource> ` 相关代码、体积不小。 不过别一刀切：` std::pmr::monotonic_buffer_resource ` 可以后端接一个 **静态数组** 、完全不碰堆 —— 这种用法在 MCU 上其实可用； 真正带来体积的是 ` <memory_resource> ` 的虚函数与相关机制。 在几 KB 预算的 MCU 上， **更常见的是"照它的思想自己写一个固定块池 \+ 一个 arena"** （第①册 Module 04 的 C 版就是原型），再用 C\+\+ 的类型安全包一层。

 

◆ 想用 ` new `，又不想背那 70 KB？

 

 
- 提供 **自定义的、不抛异常的**  ` operator new `/` operator delete `（` noexcept ` 版本）， 内部从静态池取块、失败返回 ` nullptr ` —— 这样就不会引用 ` bad_alloc ` 与 terminate 链。
 
- 或使用 ` new (std::nothrow) T ` 并 **检查返回值** （前提同样是替换掉默认的抛异常实现）。
 
- 更省心的还是 **别用通用堆** ：固定块池 \+ ` unique_ptr ` 句柄（本节 §5.4），或对容器用固定容量。

 

✔ placement new 的现代替代与两个细节

 

 
- ` std::construct_at(p, args...) `（C\+\+20）：语义等同 placement new，但可用于 ` constexpr ` 上下文；写现代 C\+\+ 时推荐用它替代 ` new (p) T(...) `。
 
- ` std::launder `（C\+\+17）：当对象的存储被复用、且类型含 ` const `/引用成员时，要用 ` std::launder(p) ` 取回指向新对象的指针；否则通过旧指针访问是 UB。
 
- **过度对齐类型** ：对 ` alignas(32) ` 这类，普通 ` operator new(size) ` 不保证对齐，需要 ` operator new(size, std::align_val_t) ` 重载（C\+\+17）。静态存储用 ` alignas(T) ` 即可。

 

```zhizhan-anchor
m05-5
```



## 5.5 决策：什么时候用哪套

 

| 需求 | 建议 |
| --- | --- |
| 生命周期明确的句柄/对象 | 栈上直接构造（Module 02 的 RAII），无需智能指针 |
| 独占所有权、需要传递 | ` unique_ptr `（无状态删除器，零额外开销） |
| 需要在静态内存上构造大对象 | placement new（存储静态、构造显式、析构显式） |
| 传"一段数据"给下层 | ` std::span `（视图，长度自带） |
| 运行期真的需要申请/归还 | 固定块池 / arena；不用通用堆 |
| 共享所有权（引用计数） | ` shared_ptr ` ——  **MCU 上基本不用** （控制块、原子计数、体积） |

 

**FIG 5.2**  内存池：从固定块里分配，避免碎片

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="启动时切好固定大小块，运行期 O(1) 取还，不产生碎片">
          <rect x="30" y="40" width="240" height="50" rx="6" class="sv-cyn-s"></rect>
          <text x="150" y="62" class="sv-lbl-hi" text-anchor="middle">静态块数组（编译期定死）</text>
          <text x="150" y="81" class="sv-lbl-dim" text-anchor="middle">N × sizeof(Block)</text>
          <path d="M270 65 L320 65" class="sv-arrow"></path>
          <rect x="322" y="40" width="140" height="50" rx="6" class="sv-grn-s"></rect>
          <text x="392" y="62" class="sv-lbl-hi" text-anchor="middle">alloc()</text>
          <text x="392" y="81" class="sv-lbl-dim" text-anchor="middle">O(1) 取一块</text>
          <rect x="472" y="40" width="140" height="50" rx="6" class="sv-amb-s"></rect>
          <text x="542" y="62" class="sv-lbl-hi" text-anchor="middle">free()</text>
          <text x="542" y="81" class="sv-lbl-dim" text-anchor="middle">归还链表</text>
        </svg>
```

 

固定块池没有"大小不一的空洞"，所以不会碎片化；代价是只能按固定块大小服务。

 

| 分配方式 | 时间确定 | 碎片 | 嵌入式建议 |
| --- | --- | --- | --- |
| ` new/delete ` 堆 | 不确定 | 会 | 尽量别用 |
| placement new | 确定 | 无 | 在静态/池内存上构造 |
| 固定块内存池 | O(1) | 无 | 推荐 |
| 栈对象 | 确定 | 无 | 默认首选 |

 

| 问题 | 症状 | 解法 |
| --- | --- | --- |
| 堆碎片 | "总量够却分配失败" | 改用内存池/静态 |
| 分配耗时不定 | 实时性抖动 | 启动期分配好 |
| 忘记 delete | 内存泄漏 | RAII/池化 |
| 越界写 | 随机崩溃 | 边界检查/MPU |

 

◆ 迁移练习

 

用 ` placement new ` 在一块静态对齐缓冲区上构造/析构一个对象，验证它不触发堆分配（看 map 里无 malloc 符号）。

 

◆ 本章要点

 

 
- ` unique_ptr<T> `（无状态删除器） **与裸指针同宽** ：零开销地表达独占所有权。
 
- 删除器 **有状态** 就会占空间；对象不是 ` new ` 来的要换删除器。
 
- placement new 在 **静态内存** 上构造对象：对齐用 ` alignas `，析构要自己调，别和 ` delete ` 混用。
 
- ` std::span ` 是"指针 \+ 长度"的类型化视图：零拷贝、零分配、长度不会漏。
 
- MCU 上需要动态分配时，用 **固定块池 / arena** ；` shared_ptr `/` std::pmr ` 大体量，谨慎。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 判断：` std::unique_ptr<int> ` 比裸 ` int* ` 大吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不大。` sizeof(unique_ptr<int>) == sizeof(int*) `（本模块用 ` static_assert ` 钉住了这一点）。默认删除器是无状态类型，被空基类优化掉。删除器一旦 **有状态** ，才会占额外空间。"}
   ```
 
2. 简答：placement new 之后，为什么必须自己调用析构？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为它不在栈上、也没有对应的 ` delete `：存储是别人给的静态内存。不显式调 ` p->~T() `，对象持有的资源（句柄、锁等）就不会释放。也不能用 ` delete p `（那会走堆）。"}
   ```
 
3. 填空：` std::span<const uint8_t> ` 是 \_\_\_\_\_\_ 视图，大小约为 \_\_\_\_\_\_ 个机器字。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**非拥有** 视图；约  **2**  个机器字（指针 \\+ 长度），零拷贝、零分配。"}
   ```
 
4. 简答：为什么 MCU 上倾向"固定块内存池"而不是 ` malloc `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"固定块池所有块等大： **零碎片、分配/释放 O(1)、时间确定** 。而通用 ` malloc ` 长时间运行会碎片化，且分配耗时不确定，破坏实时性。"}
   ```
 
5. 判断：` shared_ptr ` 适合嵌入式吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"通常不适合。它带控制块（引用计数 \\+ 原子操作），有堆分配与体积成本，且原子计数的实现还可能拉入额外库。MCU 上优先 ` unique_ptr ` 或直接栈对象。"}
   ```
 
6. 预测：` std::unique_ptr<T, void(*)(T*)> ` 在 32 位 ARM 上是几字节？和 ` unique_ptr<T> ` 比差在哪？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"8 字节：删除器本身是一个函数 **指针** （4 字节）\\+ 对象指针（4 字节）。而 ` unique_ptr<T> ` 的删除器是无状态类型、被空基类优化掉，只有 4 字节。差别就在\"删除器是空类型还是真的存了东西\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  把项目里一处 ` (ptr, len) ` 接口改成 ` std::span `，并给一个句柄套上 ` unique_ptr `。

 

```zhizhan-assessment
{"id":"course-b02-m05","criterion":"固定容量满时返回明确错误；为堆分配失败和池耗尽写测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
