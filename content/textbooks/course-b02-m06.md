# 并发与内存模型

```zhizhan-anchor
m06
```



第①册讲过 ` volatile ` 只保证"每次真读真写"——它 **不是原子、也不是屏障** 。 C\+\+ 把"原子 \+ 顺序"做成了标准设施：` std::atomic ` 与六种 ` memory_order `。 这一节讲它们怎么落到 Cortex-M 的 ` ldrex/strex ` 与 ` __DMB/__DSB ` 上，以及在 M0 上会踩到什么。

 

> ◷ 约 80 分钟 · ◈ M3/M0 反汇编实测 · ⚑ 最难但最值

 

```zhizhan-anchor
m06-1
```



## 6.1 从 ` volatile ` 到 ` std::atomic `

 

| 性质 | ` volatile ` | ` std::atomic ` |
| --- | --- | --- |
| 每次访问都真实发生（MMIO 必需） | 有 | 标准不承诺（那是 ` volatile ` 的语义） |
| **原子性** （操作不可分割） | 无 | 有（读-改-写是一个不可分割的操作） |
| **内存顺序** | 无 | 有（可指定 ` memory_order `） |
| 编译器能看懂（数据竞争被定义） | 一般 | 是（行为可预期） |

 

◆ 一句话

 

` volatile ` 解决的是" **编译器别乱优化这次访问** "； ` std::atomic ` 解决的是" **这个操作对别的执行单元而言是否原子、以及前后的访问顺序** "。 二者是不同维度， **不能互相替代** 。

 

```zhizhan-anchor
m06-2
```



## 6.2 实测：` std::atomic ` 落到什么指令上

 

用同一个源文件分别在 ` cortex-m3 ` 与 ` cortex-m0 ` 上编译，看 ` fetch_add ` 与 ` release store ` 变成什么：

 

atom.cpp — 原子自增 \+ 发布/订阅 C\+\+

 

```text
// atom.cpp —— 原子计数与"发布"语义
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
```

 

| 操作 | Cortex-M3（本机实测） | Cortex-M0（本机实测） |
| --- | --- | --- |
| ` fetch_add(1, relaxed) ` | ` ldrex ` \+ ` strex `（内联，无锁） | ` bl __atomic_fetch_add_4 `（ **外部调用** ） |
| ` store(1, release) ` | ` dmb ish ` \+ ` str `（屏障在写 **前** ） | ` dmb ish ` \+ ` str `（同一产物） |
| 未定义符号 | 无（自带 ldrex/strex） | ` U __atomic_fetch_add_4 ` |

 

**bash**  — 复跑：` bash tools/probes/m06.sh `（同一份 atom.cpp，只换 -mcpu）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c atom.cpp -o atom_m3.o
$ arm-none-eabi-g++ -mcpu=cortex-m0 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c atom.cpp -o atom_m0.o
$ arm-none-eabi-size atom_m3.o atom_m0.o
   text    data     bss     dec     hex filename
     64       0       4      68      44 atom_m3.o
     60       0       4      64      40 atom_m0.o

$ arm-none-eabi-objdump -d atom_m3.o | grep -E 'ldrex|strex|dmb'
   2: e853 0f00  ldrex   r0, [r3]
   8: e843 2100  strex   r1, r2, [r3]
  1e: f3bf 8f5b  dmb     ish
  28: f3bf 8f5b  dmb     ish
$ arm-none-eabi-objdump -d atom_m0.o | grep -E 'bl|dmb'
   8: f7ff fffe  bl      0 <__atomic_fetch_add_4>
  1a: f3bf 8f5b  dmb     ish
  26: f3bf 8f5b  dmb     ish
$ arm-none-eabi-nm -u atom_m0.o
         U __atomic_fetch_add_4
# M3 上未定义符号为空（ldrex/strex 是硬件指令）；
# 同样的源码换 M0，就多出一个必须由 libatomic 提供的帮手。
```

 

✕ M0 上的坑：原子读-改-写"编得过、链不过"

 

Cortex-M0/M0\+ 没有 ` LDREX/STREX `。所以 ` std::atomic<uint32_t> ` 的 ` fetch_add `/` compare_exchange ` 这类 **读-改-写** 操作，编译器会生成对 ` __atomic_fetch_add_4 ` 等 **外部函数** 的调用 —— 它们要么由 ` libatomic ` 提供，要么链不过。 而且 ` libatomic ` 在 M0 上的实现本质是 **加锁回退** （不是免等待），即使链上了，放进 ISR 也可能破坏实时性、引发优先级反转。 这与第①册 §6.8 的结论一致： **M0 上要么改用"关中断临界区"，要么软件实现原子序列，别指望 lock-free 的 ` std::atomic `** 。  *注意：单纯的 ` load `/` store ` 仍是单条指令，没问题；出问题的是"读-改-写"。*

 

```zhizhan-anchor
m06-3
```



## 6.3 六种 ` memory_order ` 与屏障的对应

 

` memory_order ` 描述的是" **这次原子操作与它周围访问的相对顺序** "，不是"指令执行顺序"。 在 Cortex-M 上，它们大体映射到 DMB/DSB 或干脆不需要屏障：

 

| memory\_order | 语义 | Cortex-M 上的典型产物 |
| --- | --- | --- |
| ` relaxed ` | 只保证原子性，不约束顺序 | 不加屏障（M3 上是 ldrex/strex；M0 走 \_\_atomic\_\*） |
| ` acquire `（读） | 其后的读写不能上移到它前面 | ` ld ` \+ ` dmb ish `（读侧屏障） |
| ` release `（写） | 其前的读写不能下移到它后面 | ` dmb ish ` \+ ` str `（写侧屏障） |
| ` acq_rel ` | 读-改-写同时具有两者语义 | 两侧屏障 |
| ` seq_cst ` | 额外要求全局单一全序（最强） | 通常 ` dmb ish `；单核上往往与 acq\_rel 差异很小 |
| ` consume ` | 依赖顺序（实践上多被当作 acquire） | 标准不建议用，按 acquire 处理 |

 

◆ 编译屏障 vs 硬件屏障

 

 
- ` std::atomic_signal_fence `： **只约束编译器** （不生成 DMB），等价于 ` asm volatile("" ::: "memory") `。用于"同一内核里、编译器别重排"。
 
- ` std::atomic_thread_fence `： **生成硬件屏障** （如 DMB），跨执行单元可见性用它。
 
- 对应第①册的：编译屏障 ` asm volatile("" ::: "memory") ` / 硬件屏障 ` __DMB()/__DSB() `。

 

⚠ 三条屏障别混用：DMB / DSB / ISB

 

` memory_order ` 只映射到  **DMB** ；另外两条不是"内存序"语义，而是" **等完成** "与" **重新取指** "，要你在改系统寄存器、进 ` WFI ` 前 **手动** 插入：

 

| 指令 | 管什么 | 典型场景 |
| --- | --- | --- |
| ` DMB ` | 数据内存屏障：屏障前的内存访问，对"屏障之后发生的访问"可见 | release/acquire、共享数据与标志的顺序 |
| ` DSB ` | 数据同步屏障：比 DMB 更强， **要等到屏障前的所有内存访问真正完成** 才继续 | 进 ` WFI ` / 复位前、切换栈、改 ` SCB ` 前确保写入落地 |
| ` ISB ` | 指令同步屏障：清空流水线，让其后指令 **重新取指** | 写 ` VTOR `/` NVIC `/系统控制寄存器之后、开关中断之后 |

 

一句话记法： **DMB 管顺序、DSB 等完成、ISB 重取指** 。只做共享数据同步时，通常只有 DMB 出现。

 

⚠ 反例：为什么 ` relaxed ` 不够（一个能复现的错序）

 

生产者先把结果写进 ` g_data `，再用标志通知消费者。若标志用 ` relaxed `， 编译器/处理器可以把"写数据"挪到"写标志" **之后**  —— 消费者就会看到" **标志已置位、数据还是旧的** "。 这不是理论：换优化等级或换个核，就可能复现。

 

relaxed\_bad.cpp — relaxed 标志允许"看到标志却看不到数据" C\+\+

 

```text
// relaxed_bad.cpp —— 用 relaxed 标志：错序是允许的
#include <atomic>
#include <cstdint>

static uint32_t g_data = 0;
static std::atomic<uint32_t> g_flag{0};

void producer() {
    g_data = 42;
    // ✕ relaxed：不约束顺序，写 g_data 可能被挪到写标志之后
    g_flag.store(1, std::memory_order_relaxed);
    // ✔ 正解：g_flag.store(1, std::memory_order_release);
}

bool consumer(uint32_t* out) {
    if (g_flag.load(std::memory_order_relaxed) == 1) {   // ✔ 正解：load(std::memory_order_acquire)
        *out = g_data;                                    // relaxed 下，这里可能是旧值
        return true;
    }
    return false;
}
```

 

**动手验收** ：把两侧换成 ` release `/` acquire `，在 ` cortex-m3 ` 上各编一次， 用 ` objdump ` 对比 ` dmb ` 的 **有无与位置**  —— 你会亲眼看到发行方多出一条"写前屏障"。

 

**bash**  — 复跑：` bash tools/probes/m06.sh `（第 5 节：同一份发布/订阅，relaxed vs release/acquire）

 

```text
# ── relaxed_bad · producer：两个 store 之间没有屏障 ──
    601a        str     r2, [r3, #0]     # 写数据
    605a        str     r2, [r3, #4]     # 写标志：中间无 dmb，顺序不受约束

# ── relaxed_ok · producer：release 在写标志前插一道屏障 ──
    601a        str     r2, [r3, #0]     # 写数据
    2201        movs    r2, #1
    f3bf 8f5b   dmb     ish            # ← 屏障在写前
    605a        str     r2, [r3, #4]     # 再写标志

# ── relaxed_ok · consumer：acquire 在读标志后插屏障 ──
    6850        ldr     r0, [r2, #4]     # 读标志
    f3bf 8f5b   dmb     ish            # ← 屏障在读后
    2801        cmp     r0, #1
```

 

⚠ 另一种互斥：自旋锁（` atomic_flag `），但别在 ISR 里用

 

` std::atomic_flag ` 是标准保证免锁的原子布尔，用它可写一个自旋锁 —— 也是"把 ` volatile ` 换成 ` atomic `"之外， 处理"短临界区"的一种正规写法：

 

spinlock.cpp — atomic\_flag 自旋锁（acquire/release） C\+\+

 

```text
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
```

 

M3 上它编译成 ` ldrexb/strexb ` \+ 两道 ` dmb `（实测见探针第 6 节）； 但  **M0 上没有独占访问指令，会退化成库调用** （不再是纯 inline）。更要记住两条纪律： ①  **绝不在 ISR 里取自旋锁**  —— 若被打断的代码正持有它，中断会永远自旋（死锁）； ② 自旋空烧周期与电量， **长临界区** 应改用"关中断"或调度器互斥量。 *它适合"极短、只在主循环上下文竞争"的临界区。*

 

```zhizhan-anchor
m06-4
```



## 6.4 经典模式：ISR 与主循环共享的双缓冲

 

最常见的并发场景： **中断填一块缓冲，主循环取走处理** 。用 release/acquire 把"数据写好"与"标志置位"的顺序钉死， 才能保证主循环看到标志时，数据一定已经写好。

 

double\_buffer.cpp — release/acquire 保证"先数据后标志" C\+\+

 

```text
// double_buffer.cpp —— 两块缓冲各带一个"空闲/就绪"状态位
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
```

 

**SEQ 6.1**  双缓冲状态位：ISR 填"空闲"块并发布"就绪"，主循环取走再归还（release ↔ acquire）

 

```zhizhan-figure
<svg viewBox="0 0 660 200" width="660" height="200" role="img" aria-label="双缓冲时序">
          <text x="90" y="18" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">ISR（生产者）</text>
          <text x="560" y="18" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">主循环（消费者）</text>
          <line x1="90" y1="26" x2="90" y2="188" class="lifeline"></line>
          <line x1="560" y1="26" x2="560" y2="188" class="lifeline"></line>

          <rect x="30" y="40" width="120" height="20" rx="4" class="sv-amb-s"></rect>
          <text x="90" y="54" class="sv-lbl-dim" text-anchor="middle">写 g_buf[i].data（i 为空闲块）</text>

          <path d="M 94 84 L 556 84" class="msg"></path>
          <text x="325" y="78" class="sv-lbl-dim" text-anchor="middle">store(g_state[i]=1, release) ← 屏障：data 先落地</text>

          <rect x="500" y="106" width="120" height="20" rx="4" class="sv-cyn-s"></rect>
          <text x="560" y="120" class="sv-lbl-dim" text-anchor="middle">load(g_state, acquire)</text>

          <path d="M 556 150 L 94 150" class="msg-ret"></path>
          <text x="325" y="144" class="sv-lbl-dim" text-anchor="middle">取走 data → store(g_state[i]=0, release) 归还该块</text>
        </svg>
```

 

⚠ 三条纪律

 

 
- **单核也别省"顺序"** ：同核硬件按程序序看到自己的写，硬件 DMB 未必是必需的；但 **编译器** 仍可能把"数据写"与"标志写"重排 —— release/acquire 是把顺序钉死的标准写法（退一步至少也要编译屏障）。
 
- **别用一个标志就地覆盖** ：ISR 可能在主循环正拷 ` g_buf[idx] ` 时再次触发并改写同一块；主循环末尾清标志还可能抹掉刚到达的新帧。给每块配独立状态位、生产者只写"空闲"块，才不会互相踩。
 
- **M0 上小心读-改-写** ：若标志需要 ` fetch_* `/` exchange ` 等操作，M0 会走外部原子函数（可能链不过）。只用 ` load/store ` 就没这个问题。

 

```zhizhan-anchor
m06-5
```



## 6.5 M0 的替代：临界区与软件序列

 

| 需求 | M3/M4/M7 上 | M0/M0\+ 上 |
| --- | --- | --- |
| 单次 load/store | ` std::atomic ` | ` std::atomic `（单指令，OK） |
| 计数器读-改-写 | ` fetch_add `（ldrex/strex） | 关中断临界区，或软件序列 |
| 标志交换 | ` exchange ` | 临界区 |
| 多字节量一致性 | 原子或临界区 | 临界区（关中断） |

 

✔ 一条实用判据

 

上 M0 之前，问自己一句： **"这个共享量是不是只做了单次 8/16/32 位 load/store？"**  是 → ` std::atomic ` 没问题；否（要读-改-写）→ 用 **关中断临界区** 把操作包起来。 这比"赌 M0 也有 lock-free"要稳得多。

 

更好的是让编译器替你判定：` static_assert(std::atomic<uint32_t>::is_always_lock_free); ` —— 目标不支持时 **当场编译不过** ，而不是等到运行期才发现走了加锁回退（这句在 M0 上会直接失败）。

 

✔ 还该知道的几件事

 

 
- **比较交换** ：` compare_exchange_weak/strong ` 是无锁读-改-写的通用原语；` weak ` 允许"伪失败"（配 ` while ` 循环用），` strong ` 不会伪失败。用于链表/栈时要留意  **ABA 问题** 。
 
- ` atomic_flag `：最简单的原子布尔，` test_and_set()/clear() ` 保证免锁，适合做自旋锁。注意静态初始化——全局 ` atomic `/` atomic_flag ` 要在任何使用前完成初始化（常量初始化或 ` atomic_init `）。
 
- **单核同核上，顺序往往只需编译屏障** ：ISR 与主循环在同一核、按程序序看到彼此之前的写，硬件 DMB 未必必需；关键是别让 **编译器** 重排。用 ` release `/` acquire `（或 ` atomic_signal_fence `）表达是标准且省心的写法。

 

**FIG 6.1**  ` volatile ` 管"别优化掉"，` atomic ` 管"不可分割"

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="volatile 禁止编译器缓存，atomic 提供原子性，两者职责不同">
          <rect x="30" y="40" width="240" height="56" rx="6" class="sv-cyn-s"></rect>
          <text x="150" y="63" class="sv-lbl-hi" text-anchor="middle">volatile</text>
          <text x="150" y="83" class="sv-lbl-dim" text-anchor="middle">每次都去内存读，不缓存到寄存器</text>
          <rect x="330" y="40" width="240" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="450" y="63" class="sv-lbl-hi" text-anchor="middle">std::atomic</text>
          <text x="450" y="83" class="sv-lbl-dim" text-anchor="middle">读改写不可分割，可定义内存序</text>
        </svg>
```

 

共享标志可用 ` volatile `；共享计数/多字段的不变量必须用 ` atomic ` 或临界区。

 

**FIG 6.2**  ISR 与主循环的双缓冲

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="ISR 写缓冲 A，主循环读缓冲 B；交换指针，读时不被写打断">
          <rect x="40" y="40" width="150" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="68" class="sv-lbl-hi" text-anchor="middle">buf[0]（ISR 写）</text>
          <rect x="220" y="40" width="170" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="305" y="68" class="sv-lbl-hi" text-anchor="middle">buf[1]（主循环读）</text>
          <path d="M390 63 L440 63" class="sv-arrow"></path>
          <rect x="442" y="40" width="170" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="527" y="68" class="sv-lbl-hi" text-anchor="middle">写满则交换指针</text>
        </svg>
```

 

双缓冲把"写"和"读"分到两块，交换只改一个指针——读侧永远拿到完整的一帧。

 

◆ 迁移练习

 

给你一个"ISR 置标志、主循环轮询"的共享变量，判断该用 ` volatile ` 还是 ` atomic `，并说明理由。

 

◆ 本章要点

 

 
- ` volatile ` ≠ 原子 ≠ 屏障；` std::atomic ` 才同时给"原子性 \+ 顺序"。
 
- 本机实测：M3 上 ` fetch_add ` → ` ldrex/strex `（无锁）；M0 上 → ` bl __atomic_fetch_add_4 `（ **需要外部实现** ）。
 
- ` store(release) ` 落到 ` dmb ish ` \+ ` str `（屏障在写 **前** ）；M0 上也一样 —— 屏障与核无关。
 
- **M0 上的读-改-写** 要么用临界区，要么别用 lock-free ` std::atomic `。
 
- ` atomic_signal_fence ` 只约束编译器；` atomic_thread_fence ` 生成硬件屏障（DMB）。
 
- ISR↔主循环共享用  **release/acquire**  固定"数据 → 标志"的顺序；` relaxed ` 不够，可能"看到标志却读到旧数据"。
 
- **自旋锁（` atomic_flag `）** 适合极短临界区，但 **绝不在 ISR 里取** （会死锁），且 M0 上退化为库调用。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 判断：` volatile ` 能替代 ` std::atomic ` 吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。` volatile ` 只保证\"每次真读真写、不合并删除\"， **既不含原子性、也不含内存顺序** ；读-改-写仍会撕裂、仍可能重排。原子性与顺序要用 ` std::atomic `。"}
   ```
 
2. 简答：为什么 M0 上 ` std::atomic<uint32_t>::fetch_add ` 可能链接失败？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"M0 没有 ` LDREX/STREX `，无法内联实现原子读-改-写，编译器生成对 ` __atomic_fetch_add_4 ` 等 **外部函数** 的调用，需要 ` libatomic ` 提供；裸工具链上常常没有 → 链接报 undefined reference。"}
   ```
 
3. 填空：把"数据写好"与"置标志"的顺序钉死，生产者用 \_\_\_\_\_\_，消费者用 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"生产者 ` store(..., memory_order_release) `；消费者 ` load(memory_order_acquire) `。这保证\"看到标志即看到数据\"。"}
   ```
 
4. 简答：` atomic_signal_fence ` 和 ` atomic_thread_fence ` 的区别？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` signal_fence ` 只约束 **编译器重排** （不生成 DMB），等价于 ` asm volatile(\"\" ::: \"memory\") `；` thread_fence ` 会生成 **硬件屏障** （如 DMB），用于跨执行单元的可见性。"}
   ```
 
5. 判断：在单核 MCU 上就不用管内存序了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错。中断可以在任意指令间打断，编译器也会重排访问；\"数据 → 标志\"的顺序仍然需要 release/acquire（或屏障）来保证，否则主循环可能看到标志却读到旧数据。"}
   ```
 
6. 诊断：生产者 ` data=42; ` 后 ` flag.store(1, memory_order_release); `；消费者 ` if (flag.load(memory_order_acquire)) read(data); `。若把两侧都改成 ` relaxed `，消费者可能读到什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"可能读到\"看到 ` flag==1 `、却仍是旧的 ` data `\"。` relaxed ` 只保证 **原子性** 、不约束顺序：编译器/硬件可以把 ` data ` 的写挪到 ` flag ` 的写之后。release/acquire 建立的正是\"看到标志 ⇒ 一定看到在此之前写的所有数据\"这条同步关系。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  检查你项目里所有"ISR 与主循环共享"的变量：涉及读-改-写的，若目标含 M0，改成关中断临界区。

 

```zhizhan-assessment
{"id":"course-b02-m06","criterion":"共享对象按同步协议访问；原子操作并不使复合不变量自动线程安全。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
