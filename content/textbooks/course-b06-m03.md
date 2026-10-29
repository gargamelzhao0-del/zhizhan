# 同步原语

```zhizhan-anchor
m03
```



二值/计数信号量、互斥量与优先级继承、优先级天花板、递归锁；中断里只能用 FromISR 版。

 

> 前置：了解任务并发访问共享资源的竞态，以及信号量与互斥量的基本语义。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按用途选对同步原语，并用优先级继承/天花板把优先级反转限制在一个临界区内。

 

本章速览




- 互斥量保护临界资源并带优先级继承；二值信号量不继承，不能替代互斥量。

- 中断里只能用 FromISR 版同步 API，并用唤醒标志决定是否 portYIELD\_FROM\_ISR。

- 双核临界区必须用 portMUX/自旋锁，单核只关中断不够。

 

```zhizhan-anchor
m03-prim
```



```zhizhan-anchor
m03-prim-t
```



## 3.1 按用途选原语



信号量用于“通知/计数”，互斥量用于“保护临界资源”。最关键的差别是[所有权](term:ownership)与优先级继承：互斥量有持有者，阻塞时持有者继承等待者优先级。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  优先级反转与继承



```zhizhan-figure
<svg viewBox="0 0 800 154" width="100%" height="154" role="img" aria-label="优先级反转与继承" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V128"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M315,26 V128"></path><text x="315" y="18" text-anchor="middle" class="sv-lbl-dim">8</text><path class="sv-dash" d="M460,26 V128"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M605,26 V128"></path><text x="605" y="18" text-anchor="middle" class="sv-lbl-dim">22</text><path class="sv-dash" d="M770,26 V128"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><text x="12" y="48" class="sv-lbl">L(低)</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="124" height="22" rx="4" class="sv-amb-s"></rect><text x="212.0" y="47" text-anchor="middle" class="sv-lbl-hi">持锁</text><text x="12" y="82" class="sv-lbl">M(中)</text><path class="sv-dash" d="M150,78 H770"></path><rect x="274" y="66" width="413" height="22" rx="4" class="sv-red-s"></rect><text x="480.7" y="81" text-anchor="middle" class="sv-lbl-hi">抢占</text><text x="12" y="116" class="sv-lbl">H(高)</text><path class="sv-dash" d="M150,112 H770"></path><rect x="191" y="100" width="496" height="22" rx="4" class="sv-grn-s"></rect><text x="439.3" y="115" text-anchor="middle" class="sv-lbl-hi">等锁</text></svg>
```



L 持锁、H 等锁、M 抢占 L → H 被 M 无界拖延；继承让 L 临时升到 H 优先级，把反转限制在一个临界区。



表 3.1 同步原语



| 原语 | 用途 | 是否继承优先级 | 典型误用 |
| --- | --- | --- | --- |
| 二值信号量 | 事件通知 | 否 | 拿来当锁→反转 |
| 计数信号量 | 资源计数 | 否 | 初值给错 |
| 互斥量 | 保护临界资源 | 是 | 在中断里 take |
| 递归互斥量 | 同一任务可重入 | 是 | take/give 不配对 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：反转时长对比



下面这段主机程序对比关闭/开启优先级继承后的反转时长：



host\_sync.cC

 

```text
/* host_sync.c —— 优先级反转与优先级继承的定量模型（主机可运行）。
 *
 * 场景（经典的三任务反转）：低优先级 L 先拿到互斥量，进入临界区；
 * 中优先级 M 就绪后不停抢占 L；高优先级 H 随后也要这把锁，于是被卡在 L 后面。
 *   · 关闭优先级继承：M 一直霸占 CPU，L 无法推进，H 被“无关的” M 拖住 —— 无界反转。
 *   · 打开优先级继承：H 阻塞在锁上时，L 临时继承 H 的优先级，立刻抢回 CPU 完成临界区，
 *     H 很快拿到锁 —— 反转被“限制在一个临界区以内”。
 *
 * 模型是逐 tick 的固定优先级调度；数字来自本程序真实运行，不是估算。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sync.c -o host_sync && ./host_sync
 */
#include <stdio.h>
#include <string.h>

#define T_MAX 200

enum { ST_OFF = 0, ST_READY, ST_DONE };
typedef struct {
    const char *name;
    int base_prio;   /* 越小越紧急 */
    int releases_at;
    int work;        /* 还需执行的 tick */
    int needs_mutex; /* 是否要拿互斥量 */
    int state;
    int blocked;     /* 阻塞在互斥量上 */
    int holds_mutex;
} task_t;

static int g_inversion, g_release_tick, g_acquire_tick;

static int run(int use_pi) {
    task_t T[3] = {
        {"L_low",  3, 0, 6, 1, ST_READY, 0, 0},
        {"M_mid",  2, 1, 20, 0, ST_OFF,   0, 0},
        {"H_high", 1, 2, 1, 1, ST_OFF,   0, 0},
    };
    int locked = 0, owner = -1;   /* 互斥量 */
    int t, acquire = -1;

    for (t = 0; t < T_MAX; t++) {
        int i;
        /* 释放事件 */
        for (i = 0; i < 3; i++)
            if (t == T[i].releases_at) T[i].state = ST_READY;

        /* L 在 t=0 先拿到锁（它是唯一在 t=0 就绪的任务） */
        if (t == 0) { locked = 1; owner = 0; T[0].holds_mutex = 1; }

        /* H 尝试拿锁 */
        if (T[2].state == ST_READY && T[2].needs_mutex && !T[2].holds_mutex) {
            if (!locked) { locked = 1; owner = 2; T[2].holds_mutex = 1; acquire = t; }
            else T[2].blocked = 1;
        }
        /* 锁被释放：让阻塞的等待者下一 tick 能再次尝试 */
        if (!locked) T[2].blocked = 0;

        /* 计算有效优先级：持锁者若有等待者，继承其中最高的（数值最小的）优先级 */
        int eff[3];
        for (i = 0; i < 3; i++) eff[i] = T[i].base_prio;
        if (use_pi && locked && owner >= 0) {
            for (i = 0; i < 3; i++)
                if (T[i].blocked && T[i].base_prio < eff[owner]) eff[owner] = T[i].base_prio;
        }

        /* 选择就绪、未完成、未阻塞、且有效优先级最高的任务 */
        int pick = -1;
        for (i = 0; i < 3; i++) {
            if (T[i].state != ST_READY || T[i].work <= 0 || T[i].blocked) continue;
            if (pick < 0 || eff[i] < eff[pick]) pick = i;
        }
        if (pick < 0) continue;
        T[pick].work--;

        if (T[pick].work == 0) {
            if (T[pick].holds_mutex) { locked = 0; owner = -1; T[pick].holds_mutex = 0; }
            T[pick].state = ST_DONE;
        }
    }
    g_release_tick = 2;                 /* H 在 t=2 就绪并开始等待 */
    g_acquire_tick = acquire;
    g_inversion = acquire - g_release_tick;
    return g_inversion;
}

int main(void) {
    int no_pi = run(0);
    printf("关闭优先级继承：H 从 t=2 等到 t=%d 拿到锁，反转=%d tick\n", g_acquire_tick, no_pi);
    int with_pi = run(1);
    printf("开启优先级继承：H 从 t=2 等到 t=%d 拿到锁，反转=%d tick\n", g_acquire_tick, with_pi);

    int ok = 1;
    if (!(no_pi > 15)) ok = 0;          /* 无界：被中优先级任务长时间拖住 */
    if (!(with_pi <= 6)) ok = 0;        /* 有界：约等于一个临界区（6 tick） */
    if (!(with_pi < no_pi)) ok = 0;
    printf("\n结论：优先级继承把反转从 %d tick 限制到 %d tick（临界区本身 6 tick）。\n", no_pi, with_pi);
    printf("%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

优先级继承模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sync.c -o labs/host_sync && ./labs/host_sync
关闭优先级继承：H 从 t=2 等到 t=26 拿到锁，反转=24 tick
开启优先级继承：H 从 t=2 等到 t=7 拿到锁，反转=5 tick
结论：优先级继承把反转从 24 tick 限制到 5 tick（临界区本身 6 tick）。
RESULT: PASS
```



开启继承后反转 5 tick ≈ 一个临界区（6 tick）；关闭则 24 tick 被中优先级任务拖长。



表 3.2 反转对比



| 场景 | H 获得锁 | 反转时长 |
| --- | --- | --- |
| 关闭继承 | t=26 | 24 tick |
| 开启继承 | t=7 | 5 tick |
| 临界区 | — | 6 tick |
| 结论 | — | 限制在一个临界区 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm03-plat\n```\n\n\n\n```zhizhan-anchor\nm03-plat-t\n```\n\n\n\n## 3.3 三平台对照：互斥与临界区\n\n\n\n三平台的互斥/临界区 API 名不同，但“保护临界资源用 mutex、中断用 FromISR”一致。三份代码均真实交叉编译。\n\n\n\nm03\\_mutex.cC\n\n \n\n```text\n/* m03_mutex.c —— 互斥量：保护临界资源并在阻塞时继承优先级（Cortex-M3）。\n * 互斥量 ≠ 二值信号量：它带所有权，configUSE_MUTEXES=1 时启用优先级继承。 */\n#include \"rtos_api.h\"\n\nstatic SemaphoreHandle_t g_mtx;\n\nstatic void sensor_write(void *arg) {\n    (void)arg;\n    for (;;) {\n        if (xSemaphoreTake(g_mtx, pdMS_TO_TICKS(50)) == pdTRUE) {\n            /* 临界区：读写共享缓存，越短越好 */\n            xSemaphoreGive(g_mtx);\n        } else {\n            /* 拿不到锁不能死等：超时后降级或重试 */\n        }\n        vTaskDelay(pdMS_TO_TICKS(10));\n    }\n}\n\nvoid m03_create(void) {\n    g_mtx = xSemaphoreCreateMutex();\n    (void)xTaskCreate(sensor_write, \"sensor\", 256u, 0, 3u, 0);\n}\n```\n\nSTM32F103 · mutex\n\n\n\nesp\\_m03\\_critical.cC\n\n \n\n```text\n/* esp_m03_critical.c —— 双核临界区必须用 portMUX（ESP32 / Xtensa）。\n * 单核只关中断就够；双核还要阻止另一个核同时进入，所以用 portMUX_TYPE。 */\n#include \"esp_idf_api.h\"\n\nstatic portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;\nstatic volatile int g_shared = 0;\n\nvoid esp_shared_bump(void) {\n    portENTER_CRITICAL(&g_mux);\n    g_shared++;                       /* 临界区：本核不被调度打断，且另一个核被挡在自旋锁外 */\n    portEXIT_CRITICAL(&g_mux);\n}\n\nint esp_shared_read(void) {\n    int v;\n    portENTER_CRITICAL(&g_mux);\n    v = g_shared;\n    portEXIT_CRITICAL(&g_mux);\n    return v;\n}\n```\n\nESP32 · 临界区\n\n\n\nh7\\_m03\\_recursive.cC\n\n \n\n```text\n/* h7_m03_recursive.c —— 递归互斥量（STM32H7 / Cortex-M7）。\n * 同一任务可重复 take，必须等量 give；适合“已持锁的函数又调用要锁的函数”。 */\n#include \"rtos_api.h\"\n\nstatic SemaphoreHandle_t g_rec;\n\nstatic void inner(void) {\n    (void)xSemaphoreTakeRecursive(g_rec, portMAX_DELAY);\n    /* 需要同一把锁的内层操作 */\n    (void)xSemaphoreGiveRecursive(g_rec);\n}\n\nstatic void outer(void *arg) {\n    (void)arg;\n    for (;;) {\n        (void)xSemaphoreTakeRecursive(g_rec, portMAX_DELAY);\n        inner();                               /* 再次获取同一把锁，计数 +1，不会自锁 */\n        (void)xSemaphoreGiveRecursive(g_rec);  /* 计数归零才真正释放 */\n        vTaskDelay(pdMS_TO_TICKS(100));\n    }\n}\n\nvoid h7_m03_create(void) {\n    g_rec = xSemaphoreCreateRecursiveMutex();\n    (void)xTaskCreate(outer, \"outer\", 256u, 0, 3u, 0);\n}\n```\n\nSTM32H7 · 递归锁\n\n\n\n表 3.3 三平台同步\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 互斥 | xSemaphoreCreateMutex | portMUX/xSemaphore | xSemaphoreCreateMutex |\n| 临界区 | taskENTER\\_CRITICAL | portENTER\\_CRITICAL | taskENTER\\_CRITICAL |\n| 继承 | configUSE\\_MUTEXES | 支持 | 支持 |\n| FromISR | xSemaphoreGiveFromISR | 同 | 同 |"}
````



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



同步自检：按用途选原语、有继承/天花板、临界区短、FromISR 配对。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  反转时长（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="反转时长（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">关闭继承</text><rect x="150" y="26" width="554" height="18" rx="4" class="sv-red-s"></rect><text x="712" y="43" class="sv-lbl-hi">24tick</text><text x="12" y="67" class="sv-lbl">开启继承</text><rect x="150" y="50" width="115" height="18" rx="4" class="sv-grn-s"></rect><text x="273" y="67" class="sv-lbl-hi">5tick</text></svg>
```



关闭继承 24 tick，开启 5 tick；继承把反转限制在一个临界区。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 选原语 | 锁用 mutex | 信号量当锁 |
| 继承 | 开启/天花板 | 无继承 |
| 临界区 | 尽量短 | I/O/打印 |
| 中断 | FromISR | 中断 take |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **用二值信号量当锁** ：没有继承，遇到 M 任务出现无界反转。

- **中断里 take 普通互斥量** ：会阻塞，中断不能阻塞。

- **临界区过长** ：持锁做 I/O，放大别人的阻塞。

- **take/give 不配对** ：锁泄漏，后续全阻塞。



◆ 自测 · Module 03（先答再看）




1. 二值信号量能用来保护共享缓冲区吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不该。它没有所有权、不做优先级继承，用作锁会导致优先级反转；应用互斥量。只有“一个任务 give、另一个 take”的通知语义才适合二值信号量。"}
   ```

2. 优先级继承如何限制反转？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"阻塞时让持有锁的低优先级任务临时升到等待者的高优先级，使中优先级任务无法抢占它，把反转限制在一个临界区以内。"}
   ```

3. 中断里为什么要用 FromISR 版？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"普通 API 可能阻塞，中断不能阻塞。FromISR 版不阻塞，用 xHigherPriorityTaskWoken 表示是否唤醒了更高优先级任务，再由 portYIELD\\_FROM\\_ISR 决定是否切换。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你系统的共享资源逐一确认：用互斥量而非信号量、开启优先级继承、临界区只做短操作。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [ARM · Cortex-M3/M7 与 ARMv7-M 架构参考](https://developer.arm.com/documentation/dui0552/latest/)

 

动手练习



编译运行 ` labs/host_sync.c `：模拟 L 持锁、M 抢占、H 等待，对比关闭/开启优先级继承。



**检查结果：** 关闭继承时 H 反转≈24 tick；开启继承后≈5 tick（临界区本身 6 tick）。

 

迁移练习：把本章的“能按用途选对同步原语，并用优先级继承/天花板把优先级反转限制在一个临界区内。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m03","criterion":"关闭继承时 H 反转≈24 tick；开启继承后≈5 tick（临界区本身 6 tick）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
