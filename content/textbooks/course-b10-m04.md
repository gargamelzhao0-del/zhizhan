# 中断处理

```zhizhan-anchor
m04
```



中断处理分两半： **上半部** （硬中断）只做最少的必要动作； **下半部** （tasklet/workqueue/threaded irq）在更宽松的上下文做重活。上半部的时间直接决定系统最坏中断延迟。

 

> 前置：Module 03 的自旋锁与原子上下文限制。 · ◷ 约 42 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把中断处理拆成“上半部只做 1 步 \+ 调度下半部”的实现，并选对下半部类型。

 

本章速览




- 中断分上半部/下半部：上半部只清标志、取数据、调度下半部。

- 可能睡眠的重活用 workqueue/threaded irq，绝不在硬中断里做。

- 上半部时长直接决定最坏中断延迟。

 

```zhizhan-anchor
m04-half
```



```zhizhan-anchor
m04-half-t
```



## 4.1 上下半部：把“急的”和“多的”分开



中断处理的原则是 **越快越好** ：上半部只做“清标志、取数据、调度下半部”这几步；把可能耗时的处理（协议解析、[I²C](term:i2c)/SPI 传输、内存分配）放到下半部。这样其它中断的最坏延迟才可控。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  一次中断的分工



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次中断的分工" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">硬中断</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">上半部（1 步）</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">调度下半部</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">下半部运行</text></svg>
```



硬件中断 → 上半部（极短：取数据\+调度）→ ISR 返回 → 下半部（重活）在软中断/内核线程上下文运行。



表 4.1 四种下半部



| 下半部 | 上下文 | 适用 |
| --- | --- | --- |
| tasklet | 软中断，不可睡眠 | 短小、原子任务 |
| workqueue | 内核线程，可睡眠 | 可能睡眠的重活 |
| threaded irq | 专用线程 | 需要睡眠的中断处理 |
| NAPI | 网络收包 | 高吞吐网络 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：上半部只 1 步 \+ 下半部顺序



下面这段程序验证“ISR 返回后下半部尚未运行、调度后才运行，且顺序为 IRQ→BH”：



host\_irqhalf.cC

 

```text
/* host_irqhalf.c —— 中断上半部/下半部（bottom half）模型（主机可运行）。
 *
 * 硬中断（上半部）必须极短：只清标志、取数据、调度下半部；重活留给 tasklet/workqueue。
 * 本程序验证：ISR 只执行 1 步且只登记下半部；下半部在 ISR 返回后才运行。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_irqhalf.c -o host_irqhalf && ./host_irqhalf
 */
#include <stdio.h>
#include <string.h>

static int g_irq_steps = 0, g_bh_runs = 0, g_pending = 0;
static int g_in_isr = 0;
static char g_trace[64]; static int g_tl = 0;
static void trace(const char *s) { g_tl += sprintf(g_trace + g_tl, "%s ", s); }

/* 上半部：极短 */
static void hard_irq(void) {
    g_in_isr = 1; trace("IRQ");
    g_irq_steps++;                 /* 只做一步：读数据/清标志 */
    g_pending = 1;                 /* 调度下半部 */
    g_in_isr = 0;
}
/* 下半部：在 ISR 返回后运行 */
static void bh_run(void) {
    if (!g_pending || g_in_isr) return;
    g_pending = 0; g_bh_runs++; trace("BH");
}

int main(void) {
    int ok = 1;
    hard_irq();
    printf("ISR 后：pending=%d bh_runs=%d（下半部尚未运行）\n", g_pending, g_bh_runs);
    if (!(g_pending == 1 && g_bh_runs == 0)) ok = 0;

    bh_run();                      /* 调度器在稍后运行下半部 */
    printf("调度后：pending=%d bh_runs=%d  trace=\"%s\"\n", g_pending, g_bh_runs, g_trace);
    if (!(g_pending == 0 && g_bh_runs == 1)) ok = 0;
    if (strcmp(g_trace, "IRQ BH ") != 0) ok = 0;      /* 顺序：先上半部后下半部 */

    printf("ISR 步数=%d（期望 1，必须是极短）\n", g_irq_steps);
    if (g_irq_steps != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

中断上下半部模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_irqhalf.c -o labs/host_irqhalf && ./labs/host_irqhalf
ISR 后：pending=1 bh_runs=0（下半部尚未运行）
调度后：pending=0 bh_runs=1  trace="IRQ BH "
ISR 步数=1（期望 1，必须是极短）
RESULT: PASS
```



上半部只登记 pending（1 步）就返回；下半部在其后运行，trace 保持 IRQ→BH 的顺序。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  中断上半部与下半部的时间关系



```zhizhan-figure
<svg viewBox="0 0 800 154" width="100%" height="154" role="img" aria-label="中断上半部与下半部的时间关系" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V128"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V128"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">14</text><path class="sv-dash" d="M460,26 V128"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">28</text><path class="sv-dash" d="M615,26 V128"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">42</text><path class="sv-dash" d="M770,26 V128"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">56</text><text x="12" y="48" class="sv-lbl">上半部</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="66" height="22" rx="4" class="sv-red-s"></rect><text x="183.2" y="47" text-anchor="middle" class="sv-lbl-hi">IRQ</text><text x="12" y="82" class="sv-lbl">其它中断</text><path class="sv-dash" d="M150,78 H770"></path><rect x="216" y="66" width="221" height="22" rx="4" class="sv-box"></rect><text x="327.1" y="81" text-anchor="middle" class="sv-lbl-hi">可抢占</text><text x="12" y="116" class="sv-lbl">下半部</text><path class="sv-dash" d="M150,112 H770"></path><rect x="438" y="100" width="332" height="22" rx="4" class="sv-cyn-s"></rect><text x="603.9" y="115" text-anchor="middle" class="sv-lbl-hi">BH</text></svg>
```



上半部（IRQ）极短；返回后系统可响应其它中断；下半部（BH）稍后运行，做耗时工作。上半部越短，系统抖动越小。



```zhizhan-anchor
m04-atomic
```



```zhizhan-anchor
m04-atomic-t
```



## 4.3 原子上下文的限制与下半部选择



原子上下文（硬中断/软中断）里： **不能睡眠、不能调用可能睡眠的函数、尽量少打印、临界区越短越好** 。需要睡眠的中断处理用  **threaded irq**  或  **workqueue** ，把重活挪到可睡眠上下文。



表 4.2 上半部能做什么



| 要做的事 | 能否在上半部做 | 替代方案 |
| --- | --- | --- |
| 读取/清除中断标志 | 能（必须） | — |
| 拷贝少量数据 | 能 | — |
| I²C/SPI 传输（会睡眠） | 不能 | threaded irq / workqueue |
| 内存分配 GFP\_KERNEL | 不能 | 移到下半部 |
| 大量打印 | 尽量不做 | 移到下半部或限流 |



irq\_work.c 节选C

 

```text
static irqreturn_t my_isr(int irq, void *dev) {
    clear_irq(irq);                 // 只做必要的事
    schedule_work(&my_work);        // 重活交给工作队列
    return IRQ_HANDLED;
}
ret = request_irq(irq, my_isr, IRQF_SHARED, "my", dev);
// 需要睡眠时改用 request_threaded_irq(...) 提供 thread_fn
```

上半部登记工作、下半部（可睡眠）处理



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm04-routes\n```\n\n\n\n```zhizhan-anchor\nm04-routes-t\n```\n\n\n\n## 4.4 三条内核路线对照：中断\n\n\n\n三条路线都用 request\\_irq/上下半部机制，差异在中断控制器（GIC）与设备树 interrupts 属性。\n\n\n\n表 4.3 三条路线的中断描述\n\n\n\n| 内核路线 | 中断控制器 | dts 属性 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | GIC（Cortex-A） | interrupts / interrupts-extended | mainline |\n| i.MX6ULL | GIC | interrupts | BSP mainline |\n| V3s | GIC | interrupts | sunxi mainline |"}
````



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.5 中断自检



中断是否注册成功、触发多少次，可从 ` /proc/interrupts ` 直接看。“注册了但计数不涨”通常意味着硬件未触发或中断未使能。



表 4.4 中断自检清单



| 检查项 | 命令/输出 | 含义 |
| --- | --- | --- |
| 是否注册 | cat /proc/interrupts \| grep my | 出现即注册成功 |
| 触发计数 | 同上的计数列 | 涨=有触发，不涨=没触发/没使能 |
| 共享中断 | cat /proc/interrupts 同名多行 | IRQF\_SHARED 需判断来源 |
| 中断号 | platform\_get\_irq 返回值 | \<0 表示未配置 |



irq\_threaded.c 节选C

 

```text
// 需要睡眠的中断处理：把 thread_fn 放到内核线程上下文
ret = request_threaded_irq(irq, my_isr_fast, my_isr_thread,
                           IRQF_ONESHOT, "my", dev);
// my_isr_fast 只做最少的事并返回 IRQ_WAKE_THREAD；
// my_isr_thread 在可睡眠上下文做 I2C/SPI 等重活。
```

threaded irq：上半部唤醒、线程化下半部做重活



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.6 常见误区与排障



失败路径与排障




- **上半部做重活** ：中断延迟暴涨，其它中断被拖。

- **下半部里睡眠却用 tasklet** ：在软中断上下文睡眠，崩溃。

- **忘清中断标志** ：中断反复触发。

- **共享中断不判断来源** ：误处理别人的中断。



◆ 自测 · Module 04（先答再看）




1. 中断处理里要访问 I²C 传感器（会睡眠），应怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能在硬中断里直接做。应在上半部登记 workqueue/threaded irq，在可睡眠的内核线程上下文完成 I²C 传输。"}
   ```

2. 为什么上半部的时间决定系统最坏中断延迟？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"上半部执行期间，同级或更低优先级中断可能被推迟。上半部越长，其它中断的最坏响应时间越大，系统抖动越差。"}
   ```

3. tasklet 和 workqueue 最本质的区别是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"tasklet 运行在软中断上下文（不可睡眠），适合短小原子任务；workqueue 运行在内核线程（可睡眠），适合可能睡眠的重活。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把驱动里在上半部做的耗时操作（如 I²C 传输/内存分配）迁到 workqueue/threaded irq，并测量中断延迟变化。



核对与延伸：[Linux 内核文档 · Runtime PM](https://www.kernel.org/doc/html/latest/power/runtime_pm.html)

 

动手练习



运行 ` labs/host_irqhalf.c `：验证上半部只执行 1 步并登记下半部，下半部在 ISR 返回后运行。



**检查结果：** ISR 后 pending=1、bh\_runs=0；调度后 pending=0、bh\_runs=1、trace="IRQ BH "；上半部步数=1。

 

迁移练习：把本章的“能把中断处理拆成“上半部只做 1 步 \+ 调度下半部”的实现，并选对下半部类型。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m04","criterion":"ISR 后 pending=1、bh_runs=0；调度后 pending=0、bh_runs=1、trace=\"IRQ BH \"；上半部步数=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
