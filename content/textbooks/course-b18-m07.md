# 内存序与多核共享

```zhizhan-anchor
m07
```



“我按顺序写的，怎么并发就乱了？”因为 **编译器会重排、CPU 也会重排** ，只要可观察结果不变。本章把“重排—屏障—原子—acquire/release”讲成一条能推导的链，并给出生产/消费的正确配对与可复现反例。

 

> 前置：了解多线程/中断并发与“数据竞争”概念。 · ◷ 约 44 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用原子操作与 acquire/release 屏障建立跨线程/跨核可见顺序，识别并修复乱序导致的数据竞争。

 

本章速览




- 编译器/CPU 会重排；并发要用原子\+屏障。

- acquire/release 配对建立可见顺序。

- relaxed 只保证原子不保证顺序。

 

```zhizhan-anchor
m07-reorder
```



```zhizhan-anchor
m07-reorder-t
```



## 7.1 重排从哪来：两个“看不见的手”



硬件顺序不一定等于程序顺序。 **编译器** 为优化会把独立访存调序； **CPU/内存系统** 为吞吐会用缓冲、乱序执行。单线程下“结果不变”所以无害；一旦有 **共享 \+ 无同步** ，调序就会让另一个执行流看到“未初始化/未完成”的状态。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  “先写数据、后置标志”为何可能被看见成反的



```zhizhan-figure
<svg viewBox="0 0 800 188" width="100%" height="188" role="img" aria-label="“先写数据、后置标志”为何可能被看见成反的" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V162"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V162"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M460,26 V162"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><path class="sv-dash" d="M615,26 V162"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">90</text><path class="sv-dash" d="M770,26 V162"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">120</text><text x="12" y="48" class="sv-lbl">P: 写 data</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="227.5" y="47" text-anchor="middle" class="sv-lbl-hi">store data</text><text x="12" y="82" class="sv-lbl">P: 置 flag</text><path class="sv-dash" d="M150,78 H770"></path><rect x="305" y="66" width="155" height="22" rx="4" class="sv-amb-s"></rect><text x="382.5" y="81" text-anchor="middle" class="sv-lbl-hi">store flag</text><text x="12" y="116" class="sv-lbl">C: 读 flag</text><path class="sv-dash" d="M150,112 H770"></path><rect x="357" y="100" width="155" height="22" rx="4" class="sv-red-s"></rect><text x="434.2" y="115" text-anchor="middle" class="sv-lbl-hi">load flag</text><text x="12" y="150" class="sv-lbl">C: 读 data</text><path class="sv-dash" d="M150,146 H770"></path><rect x="460" y="134" width="155" height="22" rx="4" class="sv-box"></rect><text x="537.5" y="149" text-anchor="middle" class="sv-lbl-hi">load data</text></svg>
```



线程 P 期望：data 先、flag 后；线程 C 期望：看到 flag 才读 data。若两次写被重排（flag 先落地），C 可能看到 flag 却读到未就绪的 data——这就是经典的数据竞争。



表 7.1 重排的来源与对策



| 来源 | 表现 | 手段 |
| --- | --- | --- |
| 编译器重排 | 优化调换独立访存 | 编译器屏障 / volatile / 原子 |
| CPU 乱序 | 写缓冲、乱序执行 | 内存屏障（DMB/DSB/ISB 或 fence） |
| cache 传播延迟 | 多核看到的时间不同 | acquire/release 配对 |
| 弱内存模型 | 默认不保证跨核顺序 | 显式同步原语 |



```zhizhan-anchor
m07-atomics
```



```zhizhan-anchor
m07-atomics-t
```



## 7.2 原子与屏障：把“顺序”变成语义



原子操作解决“不可分割”， **内存序** 解决“谁先看见谁”。常用四种：



表 7.2 四种内存序



| 内存序 | 保证 | 适用 |
| --- | --- | --- |
| relaxed（松弛） | 只保证原子，不保证顺序 | 计数器、统计 |
| acquire（获取） | 之后的读写不排到它前面 | 消费者读标志后读数据 |
| release（释放） | 之前的读写不排到它后面 | 生产者写数据后置标志 |
| seq\_cst / full | 全局一致的顺序 | 复杂场景、可读性优先 |



配对口诀：写数据 → release 标志；acquire 标志 → 读数据



生产者：` data=…; atomic_store(&flag,1,release); `；消费者：` while(!atomic_load(&flag,acquire)){}; use(data); `。release 保证“data 在 flag 之前可见”，acquire 保证“看到 flag 就能看到 data”。缺一不可。



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.3 真实验证：relaxed vs acquire



下面这段主机程序用内存模型演示“松弛 vs 获取”在读侧造成的可见性差异：



host\_memorder.cC

 

```text
/* Real C11 release/acquire with POSIX threads (MinGW-w64 winpthreads also works).
 * The consumer may read data ONLY after acquire observes ready=1 published by
 * release. An acknowledgement prevents the next write racing with this read.
 * gcc -std=c11 -Wall -Wextra -Werror -O2 -pthread host_memorder.c -o host_memorder
 * A passing run illustrates the protocol; the C memory model is its guarantee.
 * Replacing these atomics by volatile or compiler-only barriers is incorrect.
 */
#include <stdatomic.h>
#include <pthread.h>
#include <stdio.h>
#define COUNT 20000
static atomic_int ready=0;
static int data=0,errors=0;
static void *producer(void *unused) {
    (void)unused;
    for(int i=1;i<=COUNT;++i) {
        while(atomic_load_explicit(&ready,memory_order_acquire)!=0) {}
        data=i;
        atomic_store_explicit(&ready,1,memory_order_release);
    }
    return NULL;
}
int main(void) {
    pthread_t thread;
    if(pthread_create(&thread,NULL,producer,NULL)!=0) return 2;
    for(int i=1;i<=COUNT;++i) {
        while(atomic_load_explicit(&ready,memory_order_acquire)!=1) {}
        if(data!=i) ++errors;
        atomic_store_explicit(&ready,0,memory_order_release);
    }
    if(pthread_join(thread,NULL)!=0) return 2;
    printf("release/acquire handshakes=%d errors=%d\n",COUNT,errors);
    puts(errors ? "RESULT: FAIL" : "RESULT: PASS");
    return errors!=0;
}
```

内存序可见性模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_memorder.c -o labs/host_memorder && ./labs/host_memorder
release/acquire handshakes=20000 errors=0
RESULT: PASS
```



松弛序下“看到 ready 不代表看到 data”；acquire 建立顺序后，读 ready 后 data 必然可见。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  release/acquire 建立“可见顺序”



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="release/acquire 建立“可见顺序”" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">25</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">50</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">75</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">100</text><text x="12" y="48" class="sv-lbl">release 侧</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="161" height="22" rx="4" class="sv-cyn-s"></rect><text x="230.6" y="47" text-anchor="middle" class="sv-lbl-hi">store data</text><rect x="311" y="32" width="124" height="22" rx="4" class="sv-grn-s"></rect><text x="373.2" y="47" text-anchor="middle" class="sv-lbl-hi">store flag (rel)</text><text x="12" y="82" class="sv-lbl">acquire 侧</text><path class="sv-dash" d="M150,78 H770"></path><rect x="435" y="66" width="124" height="22" rx="4" class="sv-grn-s"></rect><text x="497.2" y="81" text-anchor="middle" class="sv-lbl-hi">load flag (acq)</text><rect x="559" y="66" width="161" height="22" rx="4" class="sv-cyn-s"></rect><text x="639.8" y="81" text-anchor="middle" class="sv-lbl-hi">load data</text></svg>
```



release 把“data 写”圈在“flag 写”之前；acquire 把“flag 读”圈在“data 读”之前。两把锁配对，跨核就能看到完整状态。



```zhizhan-anchor
m07-bad
```



```zhizhan-anchor
m07-bad-t
```



## 7.4 可复现的反例：用 relaxed 当同步



把同步用的标志写成 ` relaxed `，就丢掉了顺序保证。下面这段“看起来对”的代码在弱序核上会偶发读到未就绪数据：



relaxed\_bad.c 节选C

 

```text
// 反例：标志用 relaxed，跨核无顺序保证
data = 42;
atomic_store_explicit(&flag, 1, memory_order_relaxed);   // ✗ 没有 release
// 消费者
while (!atomic_load_explicit(&flag, memory_order_relaxed)) {}  // ✗ 没有 acquire
use(data);   // 可能读到未就绪的 data
```

缺 release/acquire：原子性有了，顺序没建立



内存序错误最致命的地方：本地测不出来



在强序的 x86 上跑得好好的，换到弱序的 ARM/RISC-V 就偶发崩。所以不要靠“本地没复现”判断正确性——要按语义写（配对 release/acquire），并用工具（如 TSAN、板测）验证。



表 7.3 生产/消费的写法对错



| 写法 | 是否安全 | 说明 |
| --- | --- | --- |
| relaxed 存标志 | ✗ | 无顺序保证 |
| release 存标志 | ✓ | 写前不重排（配合 acquire） |
| relaxed 读标志 | ✗ | 无序 |
| acquire 读标志 | ✓ | 读后不重排 |
| 全用 seq\_cst | ✓（慢） | 可读性好，开销大 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **无屏障** ：读标志却读不到数据。

- **relaxed 当同步** ：有原子性、无顺序性。

- **只保护写不保护读** ：仍存在竞争。

- **忽略编译器重排** ：优化后顺序变了。

- **用“本地能跑”当证据** ：弱序平台才暴露。



prodcons\_ok.c 节选C

 

```text
// 生产者（安全写法）
data = 42;
atomic_store_explicit(&flag, 1, memory_order_release);   // ✓
// 消费者（安全写法）
while (!atomic_load_explicit(&flag, memory_order_acquire)) {}  // ✓
use(data);   // 必然看到 42
```

配对 release/acquire 后，跨核可见顺序被硬件与编译器共同保证



表 7.4 各架构的屏障与原子



| 架构 | 默认模型 | 屏障/fence | 原子实现 |
| --- | --- | --- | --- |
| Armv7-A/M | 弱序 | DMB / DSB / ISB | LDREX/STREX 或 LSE |
| AArch64 | 弱序 | DMB / DSB / ISB | LDXR/STXR 或 LSE |
| RISC-V | 弱序 (RVWMO) | fence | LR/SC 或 A 扩展 |
| 可移植写法 | — | C11 原子 \+ 内存序 | stdatomic.h / \_\_atomic\_\* |



◆ 自测 · Module 07（先答再看）




1. acquire/release 配对解决什么问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"建立“先写数据后置标志（release）、先读标志后读数据（acquire）”的跨线程可见顺序，避免重排导致“看到标志却读到未就绪数据”。"}
   ```

2. 为什么“本地跑没问题”不能证明内存序正确？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"x86 是强序，很多乱序不会暴露；ARM/RISC-V 是弱序，同样的错误会偶发。要按语义写并用弱序平台/工具验证。"}
   ```

3. 生产者的 release 与消费者的 acquire，哪个能省？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"都不能省。release 负责“数据在标志之前可见”，acquire 负责“看到标志即看到数据”。只写一侧，顺序链就断了。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：在项目里找一处“标志位 \+ 数据”的跨线程/跨核通信，检查是否 release/acquire 配对，改为显式内存序并加注释。



核对与延伸：[C\+\+ 内存模型 (cppreference)](https://en.cppreference.com/w/cpp/atomic/memory_order) · [Linux 内存屏障](https://www.kernel.org/doc/Documentation/memory-barriers.txt)

 

动手练习



运行 ` labs/host_memorder.c `：对比 relaxed 与 acquire/release 下的可见性。



**检查结果：** relaxed 无顺序保证；acquire 下“看到标志即看到数据”（data=42）；release 与 acquire 必须配对。

 

迁移练习：把本章的“能用原子操作与 acquire/release 屏障建立跨线程/跨核可见顺序，识别并修复乱序导致的数据竞争。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m07","criterion":"relaxed 无顺序保证；acquire 下“看到标志即看到数据”（data=42）；release 与 acquire 必须配对。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
