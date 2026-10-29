# ISR 里的 C++

```zhizhan-anchor
m08
```



C\+\+ 的特性不是"在中断里也能用"——很多恰恰不能用。这一节给出一张 **中断上下文白/黑名单** ， 并演示怎么用 C\+\+ 写一个 **安全的 ISR 回调注册与分发** （对照第①册的裸机版）。

 

> ◷ 约 55 分钟 · ◈ 白/黑名单 · ⚑ 用错就是随机崩溃

 

```zhizhan-anchor
m08-1
```



## 8.1 白名单：中断里可以做的事

 

| 可以做 | 说明 |
| --- | --- |
| 读/写 ` volatile ` 寄存器、清中断标志 | 中断处理的本职；尽早清标志避免重复进入 |
| 对 ` std::atomic ` 做 **单次 load/store** | 免锁的 load/store 通常是一条访存指令；但默认 ` seq_cst `、以及 ` acquire `/` release ` 会额外插一条 ` dmb ` —— "单指令"只对 ` relaxed `（无屏障）成立。M0 上单次 load/store 也没问题（读-改-写才要小心，Module 06） |
| 写入一个 **预先分配好** 的环形缓冲 | 只做 memcpy/赋值，不动堆 |
| 置一个"待处理"标志，交给主循环 | 把重活挪出中断（最经典的分工） |
| 调用 **可重入、无阻塞** 的纯函数 | 例如无共享状态的数学函数；要确认它不触碰共享资源 |

 

```zhizhan-anchor
m08-2
```



## 8.2 黑名单：中断里别做这些

 

| 不要做 | 为什么 | 替代 |
| --- | --- | --- |
| 抛/接异常 | 异常无法安全跨中断边界展开；本册也已默认关异常 | 用错误码 \+ 标志 |
| ` new/delete `、` malloc ` | 堆操作非重入、耗时不确定 | 预分配环形缓冲 / 内存池（只取不还） |
| 阻塞等待（信号量、忙等超时） | 中断里不能"等" | 记录状态、尽快返回、主循环处理 |
| ` iostream `/重型 ` printf ` | 不可重入、慢、可能阻塞 | 只把事件码写入 RAM 环形缓冲，主循环再格式化 |
| 长时间关中断的临界区 | 拉大最坏中断延迟 | 临界区只包"读改写"几个指令 |
| 浮点（某些配置下的额外开销） | M4F 的惰性保存会带来额外栈与周期（见 §8.5） | 中断里尽量用定点；或把浮点计算挪出中断 |

 

✕ 最危险的一类："看着能用、偶尔崩"

 

中断里调用一个 **平时没问题、但内部触碰了共享状态** 的函数（比如带静态缓冲的格式化函数）， 表现为"绝大多数时候正常，偶尔数据错乱或卡死"。这类 bug 因为 **复现概率低** 极难查。 纪律： **中断里只调用你 100% 确认"可重入、无阻塞、无分配"的东西。**

 

```zhizhan-anchor
m08-3
```



## 8.3 中断上下文里 volatile 与 atomic 的取舍

 

| 共享量 | 用什么 |
| --- | --- |
| ISR 只写、主循环只读的 **单字节/单字标志** | 硬件层面单次对齐访问不会撕裂，所以 ` volatile ` 能工作；但按 C\+\+ 内存模型，跨执行单元读写同一非 atomic 对象 **是数据竞争（UB）**  —— 规范做法用 ` std::atomic `（配 ` relaxed ` 或 release/acquire）。这正是 M06 强调的"` volatile ` ≠ ` atomic `" |
| 主循环/ISR  **都要读-改-写** 的计数器 | M3\+ 用 ` std::atomic `； **M0 用关中断临界区** （Module 06） |
| 多字节结构的一致性 | 原子不够（多字节非原子）→ 临界区 \+ 双缓冲/release-acquire |

 

✔ 让编译器替你判定"是否 lock-free"

 

把 ` std::atomic ` 放进 ISR 之前，先断言它是否免锁： ` static_assert(std::atomic<uint32_t>::is_always_lock_free); `。 目标不支持时（例如 M0 上的读-改-写会走加锁回退） **当场编译失败** ，好过等到运行期才发现。  *边界：这条断言针对"读-改-写"类操作；单次 load/store 即便非 lock-free 也通常是普通访存。*

 

```zhizhan-anchor
m08-4
```



## 8.4 用 C\+\+ 写一个安全的 ISR 回调注册

 

第①册用"函数指针数组 \+ weak 默认实现"接管中断。C\+\+ 里可以用 **编译期大小的表 \+ 类型化的注册** 做得更规整。 ` extern "C" ` 保证分发入口对 C/汇编可见（Module 09 细讲）。

 

isr\_dispatch.cpp — 编译期定表 \+ 运行期注册 C\+\+

 

```text
// isr_dispatch.cpp —— 中断回调注册与分发
// 向量表项签名固定是 void(void)：IRQ 号从 IPSR 里取，不能当函数参数传进来
#include <cstdint>
#include <atomic>

using IsrHandler = void (*)(void* ctx);
struct Slot { IsrHandler fn; void* ctx; };      // 注册后不再改动 → 可安全发布

constexpr uint32_t kIrqCount = 8;
static_assert(kIrqCount > 0, "IRQ 表不能为空");

// 表项发布的是"指向不可变 Slot 的指针"：读侧一次原子 load 就得到一致快照
static std::atomic<const Slot*> g_slots[kIrqCount] = {};

// 注册：在主循环初始化阶段调用（此时对应 IRQ 还没使能）；发布用 release
bool isr_register(uint32_t irq, const Slot* s) noexcept {
    if (irq >= kIrqCount) return false;
    g_slots[irq].store(s, std::memory_order_release);
    return true;
}

// 取当前异常号（IPSR）；IRQn = 异常号 - 16
static inline uint32_t current_exception() noexcept {
    uint32_t ipsr;
    __asm volatile("mrs %0, ipsr" : "=r"(ipsr));
    return ipsr & 0x1FFu;
}

// 向量表里每个 IRQ 项都指向它；签名必须是 void(void)
extern "C" void irq_dispatch(void) noexcept {
    uint32_t e = current_exception();
    if (e < 16u) return;                 // 系统异常（SysTick 等）另有入口
    const uint32_t irq = e - 16u;
    if (irq >= kIrqCount) return;
    const Slot* s = g_slots[irq].load(std::memory_order_acquire);   // 一致快照
    if (s && s->fn) s->fn(s->ctx);
}

// 一个具体处理函数：只做"取数据 + 置标志"，不做重活
static void uart_rx_isr(void* ctx) noexcept {
    volatile uint32_t* sr = static_cast<volatile uint32_t*>(ctx);
    (void)sr;                           /* 读 SR、清标志、把字节塞进环形缓冲 */
}
```

 

**bash**  — 复跑：` bash tools/probes/m08.sh `（同一份 ` isr_atomic.cpp `，换 ` MCU= ` 各编一次）

 

```text
# 同一份源码，一行不改，分别面向 cortex-m3 与 cortex-m0plus

$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c isr_atomic.cpp -o isr_cortex-m3.o
$ arm-none-eabi-size isr_cortex-m3.o
   text    data     bss     dec     hex filename
     68       0      12      80      50 isr_cortex-m3.o

# 发布/订阅（EXTI0_IRQHandler 写，main_loop 读）：
    222a        movs    r2, #42     @ 0x2a
    4b03        ldr     r3, [pc, #12]
    601a        str     r2, [r3, #0]   # 先写数据
    2201        movs    r2, #1
    f3bf 8f5b   dmb     ish            # ← 屏障在中间
    711a        strb    r2, [r3, #4]   # 再发布标志
    4770        bx      lr

# 原子自增 bump()：
    e853 0f00   ldrex   r0, [r3]       # 独占读
    1c42        adds    r2, r0, #1
    e843 2100   strex   r1, r2, [r3]   # 独占写
    2900        cmp     r1, #0
    d1f8        bne.n   ...             # ← 失败就重试（自旋）

$ arm-none-eabi-nm -u isr_cortex-m3.o
    （无）

$ arm-none-eabi-g++ -mcpu=cortex-m0plus -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c isr_atomic.cpp -o isr_cortex-m0plus.o
$ arm-none-eabi-size isr_cortex-m0plus.o
   text    data     bss     dec     hex filename
     64       0      12      76      4c isr_cortex-m0plus.o

# 发布/订阅：与 M3 形状相同 —— 还是 dmb ish + strb
    222a        movs    r2, #42     @ 0x2a
    4b03        ldr     r3, [pc, #12]
    601a        str     r2, [r3, #0]
    3a29        subs    r2, #41        # 常数仍是 1，只是换了条指令装进 r2
    f3bf 8f5b   dmb     ish
    711a        strb    r2, [r3, #4]
    4770        bx      lr

# 原子自增 bump()：M0+ 没有 ldrex/strex，于是……
    b510        push    {r4, lr}
    2200        movs    r2, #0
    2101        movs    r1, #1
    4802        ldr     r0, [pc, #8]
    f7ff fffe   bl      0 <__atomic_fetch_add_4>   # ← 变成一次函数调用
    bd10        pop     {r4, pc}

$ arm-none-eabi-nm -u isr_cortex-m0plus.o
             U __atomic_fetch_add_4
# 未定义符号从"无"变成 __atomic_*：M0 上这个 C++ 写法需要链接 libatomic，
# 否则链接期报 undefined reference。M3 上则完全不需要。
```

 

◆ 这段代码为什么"安全"

 

 
- **无动态分配** ：表是编译期固定大小的静态数组。
 
- **无异常** ：全 ` noexcept `，且本册默认关异常。
 
- **一致快照** ：注册的是"指向不可变 ` Slot ` 的指针"，读侧 **一次 ` acquire ` load**  就拿到整个指针 ——  **不会出现 ` fn `/` ctx ` 错配或撕裂** （若直接拷贝一个多字节 ` Slot ` 结构体，那是非原子读，可能读到"新 fn \+ 旧 ctx"）。
 
- **边界检查** ：` irq >= kIrqCount ` 直接返回，越界不会踩内存。
 
- **静态就绪** ：` g_slots ` 是静态存储期、零初始化，在 ` main ` 前就可读；注册在主循环里、对应 IRQ 使能 **之前** 完成。

 

**FIG 8.1**  中断安全操作白名单：三栏判定 \+ 灰区的实测依据 （下栏读数出自 ` bash tools/probes/m08.sh `）

 

```zhizhan-figure
<svg viewBox="0 0 660 352" role="img" aria-label="中断上下文安全操作白名单、灰区与黑名单三栏对照，以及读-改-写在 cortex-m3 与 cortex-m0plus 上的实测落地方式">
          <!-- 三栏表头 -->
          <text x="16" y="36" class="sv-lbl-hi" style="fill:var(--grn)">✅ 白名单：可以放心做</text>
          <text x="236" y="36" class="sv-lbl-hi" style="fill:var(--amb)">△ 灰区：要先证明</text>
          <text x="432" y="36" class="sv-lbl-hi" style="fill:var(--red)">✕ 黑名单：别做</text>

          <!-- 白名单 -->
          <text x="16" y="60" class="sv-lbl-dim">▸ 读 / 写寄存器</text>
          <text x="16" y="84" class="sv-lbl-dim">▸ 单次 load / store</text>
          <text x="16" y="108" class="sv-lbl-dim">▸ 写预分配环形缓冲</text>
          <text x="16" y="132" class="sv-lbl-dim">▸ 置标志，交给主循环</text>
          <text x="16" y="156" class="sv-lbl-dim">▸ 时间确定的纯函数</text>

          <!-- 灰区 -->
          <text x="236" y="60" class="sv-lbl-dim">▸ volatile / atomic 单次</text>
          <text x="236" y="84" class="sv-lbl-dim" style="fill:var(--amb)">▸ 读-改-写（看核，见下栏）</text>
          <text x="236" y="108" class="sv-lbl-dim">▸ 短临界区（几指令）</text>
          <text x="236" y="132" class="sv-lbl-dim">▸ 浮点（M4F / M7）</text>

          <!-- 黑名单 -->
          <text x="432" y="60" class="sv-lbl-dim">▸ 抛 / 接异常</text>
          <text x="432" y="84" class="sv-lbl-dim">▸ new / delete / malloc</text>
          <text x="432" y="108" class="sv-lbl-dim">▸ 阻塞等待（信号量 / 忙等）</text>
          <text x="432" y="132" class="sv-lbl-dim">▸ printf / iostream</text>
          <text x="432" y="156" class="sv-lbl-dim">▸ 长时间关中断的临界区</text>
          <text x="432" y="180" class="sv-lbl-dim">▸ 带静态缓冲的格式化函数</text>

          <line x1="16" y1="200" x2="644" y2="200" class="sv-dash"></line>

          <!-- 实测依据 -->
          <text x="16" y="220" class="sv-lbl-hi">灰区第二项的实测依据：同一份 <tspan style="fill:var(--grn)">std::atomic</tspan> 源码，两个核</text>

          <rect x="16" y="232" width="304" height="108" rx="6" class="sv-grn-s"></rect>
          <text x="30" y="252" class="sv-lbl-hi" style="fill:var(--grn)">cortex-m3 · text 68 B</text>
          <text x="30" y="272" class="sv-lbl">ldrex  r0, [r3]</text>
          <text x="30" y="289" class="sv-lbl">adds   r2, r0, #1</text>
          <text x="30" y="306" class="sv-lbl">strex  r1, r2, [r3]</text>
          <text x="30" y="323" class="sv-lbl">bne.n  ↑ 失败就重试</text>
          <text x="30" y="336" class="sv-lbl-dim" style="fill:var(--grn)">nm -u →（无未定义符号）</text>

          <rect x="336" y="232" width="308" height="108" rx="6" class="sv-red-s"></rect>
          <text x="350" y="252" class="sv-lbl-hi" style="fill:var(--red)">cortex-m0plus · text 64 B</text>
          <text x="350" y="272" class="sv-lbl">push   {r4, lr}</text>
          <text x="350" y="289" class="sv-lbl">movs   r2, #0 / r1, #1</text>
          <text x="350" y="306" class="sv-lbl">bl     __atomic_fetch_add_4</text>
          <text x="350" y="323" class="sv-lbl">pop    {r4, pc}</text>
          <text x="350" y="336" class="sv-lbl-dim" style="fill:var(--red)">nm -u → U __atomic_fetch_add_4（要链 libatomic）</text>
        </svg>
```

 

三栏的划分标准只有一条： **这件事在中断上下文里是否"可重入、无阻塞、无分配、时间有界"** 。 白名单里的每一项都不需要调用任何库函数，所以编译器能把它压成几条指令。 灰区不是"不能做"，而是 **"要用实测证明它在你的核上确实是一条指令"** ——下栏就是这项证明的样板： 同一份源码，M3 用硬件独占访问 ` ldrex/strex ` 完成读-改-写， **没有任何未定义符号** ； M0\+ 没有独占访问指令，编译器只能改成 ` bl __atomic_fetch_add_4 `， 于是你的中断里多了一次 **库函数调用** ，链接时还必须带上 ` libatomic `。  **同一句 C\+\+，在 M0 上就不再是"白名单"了** ——这就是为什么 §8.3 说 M0 上读-改-写要用关中断临界区。

 

另一个几乎每个固件都要写的模式： **中断写入、主循环读出的环形缓冲** 。用原子索引把"先写数据、再发布可读"钉住， 单生产者/单消费者（SPSC）下可以做到无锁、无分配、无阻塞 —— 中断侧只做几次整数运算和一次 release 发布。

 

ring\_spsc.cpp — 中断只写、主循环只读的无锁环形缓冲 C\+\+

 

```text
// ring_spsc.cpp —— 单生产者（ISR）/ 单消费者（主循环）环形缓冲
#include <atomic>
#include <cstdint>
#include <cstddef>

constexpr std::size_t kCap = 64;                 // 实际可用 63：留一个空位区分"满/空"
static uint8_t g_buf[kCap];
static std::atomic<std::size_t> g_head{0};        // 生产者写
static std::atomic<std::size_t> g_tail{0};        // 消费者读

// 中断侧（生产者）：只写、无阻塞、无分配
bool ring_put(uint8_t b) noexcept {
    const std::size_t h   = g_head.load(std::memory_order_relaxed);
    const std::size_t nxt = (h + 1) % kCap;
    if (nxt == g_tail.load(std::memory_order_acquire)) return false;  // 满：丢弃并计数
    g_buf[h] = b;                                                     // 先写数据
    g_head.store(nxt, std::memory_order_release);                    // 再发布可读
    return true;
}

// 主循环侧（消费者）
bool ring_get(uint8_t* out) noexcept {
    const std::size_t t = g_tail.load(std::memory_order_relaxed);
    if (t == g_head.load(std::memory_order_acquire)) return false;    // 空
    *out = g_buf[t];                                                  // 此刻数据一定已写好
    g_tail.store((t + 1) % kCap, std::memory_order_release);
    return true;
}
```

 

✔ 为什么它是无锁且安全的

 

只有 **一个生产者** 改 ` g_head `、 **一个消费者** 改 ` g_tail `， 各自独占自己的索引，所以不需要互斥；生产者的 ` release ` 与消费者的 ` acquire ` 构成配对， 保证"读到新 head ⇒ 一定读得到对应数据"。留一个空位是把"满"与"空"区分开的经典技巧。  *M0 上这套仍然成立 —— 因为用到的只有单次 ` load/store `，没有读-改-写。*

 

```zhizhan-anchor
m08-5
```



## 8.5 浮点与惰性保存（M4F/M7 注意）

 

带 FPU 的核（M4F/M7）在异常入口采用 **惰性保存** ：处理器 **总是会预留** 一段 FP 扩展帧的栈空间 （S0–S15 \+ FPSCR \+ 保留字），是否真正写回浮点寄存器由 ` FPCCR ` 的 ` ASPEN `/` LSPEN ` 控制 —— 只有异常处理里（或被打断的代码里）用到浮点时，才去写这些槽。 所以"没在中断里用浮点，栈还是变深了"正因为这段 **预留帧** ；而一旦中断里真的用了浮点， 还要多做实际的保存/恢复， **栈峰值与进入/退出周期会进一步增加** （第①册 Module 08 讲过这是"栈帧看着对不上"的常见原因之一）。

 

⚠ 三条建议

 

 
- **中断里尽量不用浮点** ：能定点就定点；必须用时，评估它对最坏中断延迟与栈峰值的影响。
 
- **给中断栈留足余量** ：FPU 扩展帧会让"一次中断吃多少栈"明显变大。
 
- **统一浮点使用约定** ：团队约定"中断里禁用浮点"，比每个人各自判断更可靠。

 

**FIG 8.2**  中断上下文：白名单与黑名单

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="ISR 里只做取数据/清标志/唤醒；长计算、动态分配、阻塞等下沉到主循环">
          <rect x="30" y="40" width="200" height="60" rx="6" class="sv-grn-s"></rect>
          <text x="130" y="62" class="sv-lbl-hi" text-anchor="middle">白名单</text>
          <text x="130" y="82" class="sv-lbl-dim" text-anchor="middle">读外设·清标志·置原子标志</text>
          <rect x="260" y="40" width="220" height="60" rx="6" class="sv-red-s"></rect>
          <text x="370" y="62" class="sv-lbl-hi" text-anchor="middle">黑名单</text>
          <text x="370" y="82" class="sv-lbl-dim" text-anchor="middle">动态分配·阻塞·长计算·打印</text>
          <text x="560" y="62" class="sv-lbl-dim" text-anchor="middle">长活下沉到</text>
          <text x="560" y="82" class="sv-lbl-hi" text-anchor="middle">主循环/任务</text>
        </svg>
```

 

ISR 越短，所有中断与主循环的最坏延迟越小——这是实时性最直接的杠杆。

 

isr\_safe.cpp — ISR 只置原子标志 C\+\+

 

```text
#include <atomic>

std::atomic<bool> g_tick{false};

extern "C" void SysTick_Handler(void) {
    g_tick.store(true, std::memory_order_relaxed);  /* ISR 只置标志 */
}

void loop() {
    if (g_tick.exchange(false)) { /* 长活在主循环里做 */ }
}
```

 

| 动作 | ISR 里可以做吗 | 原因 |
| --- | --- | --- |
| 读寄存器/清标志 | 可以 | 硬件要求尽快 |
| 置 ` atomic ` 标志 | 可以 | 原子、非阻塞 |
| ` new `/堆分配 | 不可以 | 时间不确定 |
| 打印/浮点 | 不建议 | 放大中断延迟 |

 

◆ 迁移练习

 

把一个"在 ISR 里做滤波计算"的实现改成"ISR 只存原始值 \+ 主循环计算"，测量最坏中断延迟的变化。

 

◆ 本章要点

 

 
- 中断白名单：读写寄存器、单次原子 load/store、写预分配的环形缓冲、置标志交给主循环。
 
- 中断黑名单：异常、动态分配、阻塞、重型 ` printf `/` iostream `、长临界区。
 
- ISR 只写 \+ 主循环只读的 **单次** 访问：` volatile `/` atomic ` 都行； **读-改-写** 在 M0 上必须临界区。
 
- C\+\+ 版的 ISR 分发： **编译期定表 \+ 一次拷贝出来用 \+ 边界检查 \+ ` noexcept ` \+ ` extern "C" ` 入口** 。
 
- 带 FPU 的核上，中断里用浮点会带来额外的栈与周期开销——能不用就不用。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 判断：中断里可以 ` new ` 一个对象吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不可以。` new/delete `/` malloc ` 走堆，非重入且耗时不确定，会破坏中断的及时性甚至损坏堆状态。应改为预分配环形缓冲或内存池。"}
   ```
 
2. 简答：为什么"中断里调用了一个带静态缓冲的函数"很危险？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为它是 **不可重入** 的：主循环正在用它时中断打断进来，又用同一个静态缓冲，就会互相覆盖。表现是\"偶发数据错乱/卡死\"，极难复现。中断里只能调可重入、无阻塞、无分配的函数。"}
   ```
 
3. 填空：ISR 分发函数出口要写 \_\_\_\_\_\_，才能在向量表/汇编里用固定名字调用。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` extern \"C\" `（关闭 C\\+\\+ 名字修饰，保证符号名固定，Module 09 会细讲）。另外注意向量表项的签名固定是 ` void(void) `： **IRQ 号不能当函数参数传进来** ，要在处理函数里读 ` IPSR `（如 ` mrs %0, ipsr `）再算出 ` IRQn `。"}
   ```
 
4. 简答：为什么示例里要 ` Slot s = g_slots[irq]; ` 先拷贝一份再用？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"避免\"读一半被改\"造成 ` fn `/` ctx ` 错配：` Slot `（函数指针 \\+ ` void* `）在 32 位核上是 8 字节， **普通拷贝会拆成两次访存** ，可能读到\"新 fn \\+ 旧 ctx\"。所以改成发布\"指向不可变 ` Slot ` 的 **指针** \"，读侧一次 ` atomic load(acquire) ` 拿到整块一致快照。也就是说：要一致，靠的是\"原子地读 **一个指针** \"，而不是\"拷贝一个多字节结构体\"。"}
   ```
 
5. 判断：带 FPU 的核在中断里用浮点没有额外代价。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"有额外代价。异常入口会触发浮点上下文（S0–S15/FPSCR）的 **惰性保存** ，增加栈用量与进入/退出周期。中断里应尽量用定点，或把浮点计算挪出中断。"}
   ```
 
6. 找错：某 ISR 里写了 ` if (rx) { count++; buf[head++ % N] = dr; } `，主循环也读 ` count `。指出至少两处隐患。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① ` count++ ` 是 **读-改-写** ，若主循环也改就非原子、会丢更新（应按 M06 用 ` std::atomic ` 或临界区）；② ` head ` 与数据写入之间没有 ` release ` 约束，读者可能看到新 ` head ` 却读不到对应数据（应像 ` ring_spsc.cpp ` 那样先写数据、再 release 发布）；③ 对 ` count ` 的跨上下文裸访问还是数据竞争（UB）。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 08 完成？**  检查你的中断服务程序，逐一对照黑名单；把 ` printf `/分配/阻塞全部移出中断。

 

```zhizhan-assessment
{"id":"course-b02-m08","criterion":"ISR 只做允许的非阻塞操作，外部 C 入口和对象生命明确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
