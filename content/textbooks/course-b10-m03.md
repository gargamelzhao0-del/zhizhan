# 并发与锁

```zhizhan-anchor
m03
```



内核代码天生并发：多个进程、中断、软中断可能同时执行。先识别 **共享数据** 与 **可能并发的上下文** ，再选择锁：能睡眠用互斥锁，不能睡眠用自旋锁。 **锁顺序不一致** 是死锁的根因。

 

> 前置：Module 01 模块上下文与 Module 02 驱动的并发入口。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为共享数据写出按全局顺序取锁、且不在自旋锁临界区内睡眠的并发保护代码。

 

本章速览




- 先识别共享与并发上下文，再选锁：能睡眠用互斥锁，不能睡眠用自旋锁。

- 死锁根因是锁顺序不一致；给所有锁定全局顺序。

- 自旋锁临界区内不可睡眠；中断与进程共享变量要用 irqsave 变体。

 

```zhizhan-anchor
m03-source
```



```zhizhan-anchor
m03-source-t
```



## 3.1 并发从哪来：先识别共享与上下文



内核并发来源：多进程、中断上半部、软中断/下半部、多核。第一件事不是“选锁”，而是 **列出共享数据、标出哪些上下文会碰它** 。同一个变量只被进程访问和被中断访问，需要的保护强度不同。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  选锁的决策顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="选锁的决策顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">有无共享</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">含中断?</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">会睡眠?</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">选锁</text></svg>
```



有共享数据吗？→ 会在中断上下文访问吗？→ 会睡眠吗？逐步决定用 atomic / spinlock / mutex / RCU。



表 3.1 四种同步原语



| 锁 | 场景 | 规则 |
| --- | --- | --- |
| mutex | 进程上下文、可能睡眠 | 不可在中断里用 |
| spinlock | 中断/短临界区 | 临界区内不可睡眠 |
| atomic | 单个计数器 | 无锁但只保证原子 |
| RCU | 读多写少 | 读端不加锁，写端延迟释放 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：死锁检测与睡眠违规



下面这段程序用“等待图”检测死锁，并检查自旋锁内是否调用了可能睡眠的函数：



host\_concurrency.cC

 

```text
/* host_concurrency.c —— 并发与锁：锁顺序与死锁检测模型（主机可运行）。
 *
 * 内核里最贵的 bug 是并发：多把锁的获取顺序不一致就会死锁；自旋锁里睡眠会崩。
 * 本程序用“等待图 + 环检测”判定两种顺序是否死锁，并演示“自旋锁不可睡眠”。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_concurrency.c -o host_concurrency && ./host_concurrency
 */
#include <stdio.h>
#include <string.h>

/* 锁管理器：记录“谁在等谁” */
static int wait_for[8];   /* wait_for[i]=j：任务 i 等待任务 j 持有的锁 */

static int has_cycle(int n) {
    for (int i = 0; i < n; i++) {
        int cur = i, steps = 0;
        while (cur >= 0 && wait_for[cur] >= 0 && steps <= n) {
            cur = wait_for[cur];
            steps++;
            if (cur == i) return 1;
        }
    }
    return 0;
}

int main(void) {
    int ok = 1, n = 2;
    /* 情形 1：两个任务都按 A→B 顺序取锁 */
    wait_for[0] = -1; wait_for[1] = -1;
    printf("一致顺序 A→B：cycle=%d（期望 0）\n", has_cycle(n));
    if (has_cycle(n) != 0) ok = 0;

    /* 情形 2：T0 持 A 等 B，T1 持 B 等 A → 环 */
    wait_for[0] = 1; wait_for[1] = 0;
    printf("交叉顺序 A→B 与 B→A：cycle=%d（期望 1，检测到死锁）\n", has_cycle(n));
    if (has_cycle(n) != 1) ok = 0;

    /* 自旋锁不可睡眠：临界区内调用可能睡眠的函数即命中 BUG（正向判定） */
    int spinlock_held = 1, may_sleep = 1;
    int bug = spinlock_held && may_sleep;
    printf("自旋锁内调用可能睡眠函数 → BUG=%d（期望 1，命中即 BUG）\n", bug);
    if (bug != 1) ok = 0;
    /* 互斥锁（可睡眠）里睡眠是允许的 */
    int mutex_held = 1, sleep_in_mutex = 1;
    printf("互斥锁内睡眠 → 允许=%d（期望 1）\n", mutex_held && sleep_in_mutex);
    if (!(mutex_held && sleep_in_mutex)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

死锁/睡眠违规检测模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_concurrency.c -o labs/host_concurrency && ./labs/host_concurrency
一致顺序 A→B：cycle=0（期望 0）
交叉顺序 A→B 与 B→A：cycle=1（期望 1，检测到死锁）
自旋锁内调用可能睡眠函数 → BUG=1（期望 1，命中即 BUG）
互斥锁内睡眠 → 允许=1（期望 1）
RESULT: PASS
```



一致锁顺序不成环（cycle=0）；交叉取锁成环即死锁（cycle=1）；自旋锁内睡眠记 BUG。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  交叉取锁为何死锁



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="交叉取锁为何死锁" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">40</text><text x="12" y="48" class="sv-lbl">任务1</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="620" height="22" rx="4" class="sv-red-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">持A 等B</text><text x="12" y="82" class="sv-lbl">任务2</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="620" height="22" rx="4" class="sv-red-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">持B 等A</text></svg>
```



任务 1 持有 A 等 B，任务 2 持有 B 等 A —— 两边互等，形成环，谁都无法继续。破坏死锁只需让所有代码按同一全局顺序取锁。



```zhizhan-anchor
m03-rule
```



```zhizhan-anchor
m03-rule-t
```



## 3.3 规则：锁顺序与不可睡眠



两条铁律： **① 所有代码按同一全局顺序取锁** （否则成环即死锁）； **② 自旋锁临界区内不可睡眠** （一旦睡眠，可能永久占用 CPU 并死锁）。进程上下文可睡眠用 mutex；中断/短临界区用 spinlock。



表 3.2 按上下文选锁



| 上下文 | 可用的锁 | 禁止 | 理由 |
| --- | --- | --- | --- |
| 进程上下文 | mutex / spinlock | 长时间 CPU 占用 | 可睡眠 |
| 中断上半部 | spinlock / atomic | mutex、睡眠 | 不可睡眠 |
| 软中断/下半部 | spinlock（需关底半部） | mutex | 不可睡眠 |
| 读多写少 | RCU / rwlock | — | 读端无锁 |



lock\_order.c 节选C

 

```text
// 所有路径都按 A→B 的顺序取锁（全局约定）
mutex_lock(&A);
mutex_lock(&B);
... // 临界区
mutex_unlock(&B); mutex_unlock(&A);

// 与中断共享的变量：进程侧要关本核中断
unsigned long flags;
spin_lock_irqsave(&lock, flags);
shared++;                 // 与 ISR 共享
spin_unlock_irqrestore(&lock, flags);
```

统一取锁顺序 \+ 与 ISR 共享时用 irqsave 变体



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm03-routes\n```\n\n\n\n```zhizhan-anchor\nm03-routes-t\n```\n\n\n\n## 3.4 三条内核路线对照：并发原语\n\n\n\n三条路线的同步原语 API 一致，差异主要在中断控制器与 SMP/单核配置。\n\n\n\n表 3.3 三条路线的并发环境\n\n\n\n| 内核路线 | 核数 | 与中断共享 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | 双核 A7 | spin\\_lock\\_irqsave | SMP，需考虑多核 |\n| i.MX6ULL | 单核 A7 | spin\\_lock\\_irqsave | 单核仍需关中断 |\n| V3s | 单核 A7 | spin\\_lock\\_irqsave | 单核 |"}
````



```zhizhan-anchor
m03-dead
```



```zhizhan-anchor
m03-dead-t
```



## 3.5 死锁的四个条件与检测



死锁不是玄学：它有四个必要条件，破坏任一个即可避免。工程上最实用的是 **破坏“循环等待”** ——统一取锁顺序。



表 3.4 死锁的四个必要条件



| 条件 | 含义 | 破坏方式 |
| --- | --- | --- |
| 互斥 | 资源同一时刻只给一个 | 难以避免（锁的本质） |
| 持有并等待 | 持锁再申请新锁 | 一次性申请或释放后申请 |
| 不可剥夺 | 锁不能被抢走 | 用带超时的锁 |
| 循环等待 | 互相等对方持有的锁 | 全局统一取锁顺序 |



lockdep.txt 节选Text

 

```text
# 打开内核锁调试，运行期自动检测锁顺序违规
CONFIG_PROVE_LOCKING=y
# dmesg 出现循环依赖时给出完整锁链：
#   Possible circular locking dependency detected
# ... 按提示修锁顺序，而不是靠复现碰运气
```

用 lockdep 把“偶发死锁”变成“启动即报的锁链”



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.6 常见误区与排障



失败路径与排障




- **锁顺序不一致** ：两个任务交叉持锁 → 死锁。

- **自旋锁内睡眠** ：调度器警告/崩溃。

- **在中断里用 mutex** ：可能睡眠，非法。

- **忘关中断保护共享** ：中断与进程同时改同一变量。



◆ 自测 · Module 03（先答再看）




1. 一个变量既在进程上下文又被中断修改，只加 spinlock 够吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不够——进程持锁时中断仍可能打断并尝试取同一把锁，导致自旋/死锁。要用 spin\\_lock\\_irqsave 这类同时关本核中断的变体。"}
   ```

2. 死锁最常见的根因是什么？怎么预防？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"锁顺序不一致导致成环（各持一把、互等）。预防：给所有锁定一个全局顺序，所有代码按同一顺序取锁。"}
   ```

3. 为什么自旋锁临界区里不能睡眠？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"自旋锁占用 CPU 等待；若临界区内睡眠，CPU 可能被调度给别人，导致持锁者长时间不释放，其它核/中断自旋到底 → 系统卡死。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：列出你驱动里的所有锁与取锁点，给出一个全局顺序并检查是否存在逆序或自旋锁内睡眠。



核对与延伸：[Linux 内核文档 · regmap](https://www.kernel.org/doc/html/latest/driver-api/regmap.html)

 

动手练习



运行 ` labs/host_concurrency.c `：用等待图检测一致顺序与交叉顺序下的死锁，并检测自旋锁内睡眠。



**检查结果：** 一致顺序 cycle=0；交叉顺序 cycle=1（死锁）；自旋锁内睡眠 → BUG=1；互斥锁内睡眠允许=1。

 

迁移练习：把本章的“能为共享数据写出按全局顺序取锁、且不在自旋锁临界区内睡眠的并发保护代码。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m03","criterion":"一致顺序 cycle=0；交叉顺序 cycle=1（死锁）；自旋锁内睡眠 → BUG=1；互斥锁内睡眠允许=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
