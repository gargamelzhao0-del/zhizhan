# 实时性与多线程

```zhizhan-anchor
m05
```



多线程的第一原则： **无锁共享数据 = 竞态** 。所有跨线程共享的可变数据都要用互斥量/原子/条件变量保护；实时还要控制抖动（调度策略/亲和）。

 

> 前置：Module 01 的返回值处理与 Module 02 的共享状态边界。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 pthread\_create/pthread\_mutex\_t 保护共享计数，使并发累加结果精确可复现。

 

本章速览




- 无锁共享数据 = 竞态；用互斥/原子/条件变量。

- 忙等浪费 CPU，条件变量更省。

- 实时线程要分析最坏执行时间与调度策略。

 

```zhizhan-anchor
m05-model
```



```zhizhan-anchor
m05-model-t
```



## 5.1 竞态与同步



读-改-写不是原子操作：两个线程都先读旧值再写回，后写的覆盖先写的，就丢失更新。所有跨线程共享的可变数据都要用互斥量/原子/条件变量保护。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  读-改-写交错导致丢失更新



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="读-改-写交错导致丢失更新" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">40</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">80</text><text x="12" y="48" class="sv-lbl">线程1</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="227.5" y="47" text-anchor="middle" class="sv-lbl-hi">读0</text><rect x="460" y="32" width="155" height="22" rx="4" class="sv-amb-s"></rect><text x="537.5" y="47" text-anchor="middle" class="sv-lbl-hi">写1</text><text x="12" y="82" class="sv-lbl">线程2</text><path class="sv-dash" d="M150,78 H770"></path><rect x="305" y="66" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="382.5" y="81" text-anchor="middle" class="sv-lbl-hi">读0</text><rect x="615" y="66" width="155" height="22" rx="4" class="sv-amb-s"></rect><text x="692.5" y="81" text-anchor="middle" class="sv-lbl-hi">写1</text></svg>
```



两线程都先读 x=0，各自 \+1 得 1，写回还是 1——两次自增只加了一次。加锁让“读-改-写”串行化。



表 5.1 多线程的五个坑



| 问题 | 现象 | 处理 |
| --- | --- | --- |
| 数据竞态 | 偶发错值 | 互斥/原子 |
| 忙等 | CPU 空转 | 条件变量 |
| 优先级反转 | 高优先级被拖 | 优先级继承 |
| 抖动 | 响应不稳 | CPU 亲和/调度策略 |
| 锁竞争 | 吞吐下降 | 缩小临界区/分片 |



mutex.c 节选C

 

```text
pthread_mutex_lock(&m);
  shared++;                    // 临界区尽量小
pthread_mutex_unlock(&m);
/* 无事件时：pthread_cond_wait(&cv, &m) 而非忙等 */
```

互斥保护临界区；条件变量替代忙等



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：无锁 vs 加锁



下面这段主机程序用真实 ` pthread ` 跑两种情形：



host\_threads.cC

 

```text
/* host_threads.c —— 实时性与多线程：真实 pthread 竞态与加锁模型（主机可运行）。
 *
 * 无锁共享计数的“读-改-写”不是原子操作，两线程并发会丢失更新；用 pthread_mutex_t
 * 保护临界区后结果精确。本程序用真实 pthread_create 起两个线程，并用 pthread_barrier
 * 强制两线程“先都读、再都写”，从而稳定复现一次丢失更新。
 *
 * 编译运行（POSIX 线程，显式链接可加 -pthread）：
 *   gcc -std=c11 -Wall -Wextra -O2 host_threads.c -o host_threads -pthread && ./host_threads
 * 在 glibc ≥ 2.34 / 现代 winpthreads 上 pthread 已随 libc 默认链接，故 gcc -std=c11 -O2 亦可编过。
 */
#include <stdio.h>
#include <pthread.h>

static int raw = 0;                        /* 无锁共享计数 */
static pthread_barrier_t bar;              /* 强制两线程都读完后才写 */
static int locked_count = 0;               /* 互斥保护的计数 */
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;

/* 无锁 +1：读 → 同步 → 写回，后写覆盖先写 → 丢失更新 */
static void *raw_inc(void *arg) {
    (void)arg;
    int tmp = raw;                         /* 读 */
    pthread_barrier_wait(&bar);            /* 两线程都读完再继续 */
    raw = tmp + 1;                         /* 写回（非原子） */
    return 0;
}

/* 加锁 +500：临界区内自增，串行且不丢失 */
static void *locked_inc(void *arg) {
    (void)arg;
    for (int i = 0; i < 500; i++) {
        pthread_mutex_lock(&m);
        locked_count++;
        pthread_mutex_unlock(&m);
    }
    return 0;
}

int main(void) {
    int ok = 1;
    pthread_t t1, t2;

    /* 无锁：两线程各 +1，barrier 强制都先读到 0，最终只保留一次 +1 */
    pthread_barrier_init(&bar, 0, 2);
    pthread_create(&t1, 0, raw_inc, 0);
    pthread_create(&t2, 0, raw_inc, 0);
    pthread_join(t1, 0);
    pthread_join(t2, 0);
    printf("无锁两线程各 +1（barrier 强制都先读）：期望 2，实际 %d（丢失更新）\n", raw);
    if (raw != 1) ok = 0;

    /* 加锁：两线程各 +500，互斥保护下必须恰好 1000 */
    pthread_create(&t1, 0, locked_inc, 0);
    pthread_create(&t2, 0, locked_inc, 0);
    pthread_join(t1, 0);
    pthread_join(t2, 0);
    printf("加锁自增 2×500：实际 %d（期望 1000）\n", locked_count);
    if (locked_count != 1000) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

线程竞态与互斥模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 -pthread labs/host_threads.c -o labs/host_threads && ./labs/host_threads
无锁两线程各 +1（barrier 强制都先读）：期望 2，实际 1（丢失更新）
加锁自增 2×500：实际 1000（期望 1000）
RESULT: PASS
```



barrier 强制两线程都先读，暴露无锁的丢失更新；加锁后 2×500 精确为 1000。



表 5.2 同步原语



| 原语 | 用途 | 注意 |
| --- | --- | --- |
| pthread\_mutex | 保护临界区 | 临界区尽量小 |
| 条件变量 | 等待/通知 | 替代忙等 |
| 原子操作 | 单变量 | 无锁但需内存序 |
| 读写锁 | 读多写少 | 写者饥饿风险 |



```zhizhan-anchor
m05-rt
```



```zhizhan-anchor
m05-rt-t
```



## 5.3 实时与抖动



实时线程要分析 **最坏执行时间** 与 **调度策略** （SCHED\_FIFO/RR）；把关键线程绑核、减少锁竞争与内存分配，才能控制抖动。



rt\_thread.c 节选C

 

```text
struct sched_param sp = { .sched_priority = 80 };
pthread_setschedparam(tid, SCHED_FIFO, &sp);   // 实时调度
cpu_set_t set; CPU_ZERO(&set); CPU_SET(2, &set);
pthread_setaffinity_np(tid, sizeof set, &set); // 绑核
/* 减少锁竞争与动态分配，控制最坏执行时间 */
```

实时调度 \+ 绑核 \+ 少锁少分配 = 抖动可控



表 5.3 控制抖动的四种手段



| 手段 | 作用 | 代价 |
| --- | --- | --- |
| SCHED\_FIFO/RR | 确定性调度 | 需权限、可能饿死低优 |
| CPU 亲和 | 减少迁移抖动 | 负载不均 |
| 优先级继承 | 缓解优先级反转 | mutex 属性 |
| 缩小临界区 | 降锁竞争 | 需重构 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与三路线对照



并发自检聚焦“结果可复现、无死锁、抖动可控”：



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  并发正确性的验证路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="并发正确性的验证路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">识别共享</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">同步保护</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">压力跑</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">结果可复现</text></svg>
```



先静态识别共享数据 → 加锁/原子 → 压力跑多次 → 结果精确可复现 → 查死锁/抖动。



表 5.4 三路线实时能力



| 路线 | 实时能力 | 说明 |
| --- | --- | --- |
| Buildroot | PREEMPT\_RT 可选 | 需内核配置 |
| Yocto | PREEMPT\_RT 配方 | 可定制 |
| Debian | rt 内核包 | 最易获取 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **无锁共享** ：丢失更新/读数撕裂。

- **用忙等代替条件变量** ：CPU 空转、功耗高。

- **临界区过大** ：锁竞争严重，吞吐骤降。

- **不看最坏执行时间** ：偶发超期，实时性失守。



◆ 自测 · Module 05（先答再看）




1. 两个线程各把变量 \+1 一次，为什么结果可能只有 1？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"读-改-写不是原子操作：两线程都先读旧值再写回，后写的覆盖先写的，丢了一次更新。要用原子操作或互斥锁。"}
   ```

2. 为什么建议用条件变量而不是忙等？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"忙等空转 CPU、费电、还可能与低优先级抢资源；条件变量在无事件时休眠，被通知才唤醒。"}
   ```

3. 实时线程控制抖动常做哪几件事？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用 SCHED\\_FIFO/RR、CPU 亲和绑核、减少锁竞争与动态分配、分析最坏执行时间。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把项目里所有跨线程共享的可变数据列出来，逐项加锁/原子保护并压测验证结果可复现。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/)

 

动手练习



运行 ` labs/host_threads.c `（真实 pthread\_create \+ pthread\_mutex\_t）：验证无锁丢失更新、加锁精确 1000。



**检查结果：** barrier 强制两线程都先读后无锁 \+1 实际=1（丢失一次更新）；加锁 2×500 实际=1000。

 

迁移练习：把本章的“能用 pthread\_create/pthread\_mutex\_t 保护共享计数，使并发累加结果精确可复现。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m05","criterion":"barrier 强制两线程都先读后无锁 +1 实际=1（丢失一次更新）；加锁 2×500 实际=1000。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
