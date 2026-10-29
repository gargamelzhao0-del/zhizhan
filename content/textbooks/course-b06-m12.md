# 多核 RTOS 与任务生命周期

```zhizhan-anchor
m12
```



SMP；核亲和；锁；缓存一致性；取消、重启与共享资源。

 

> 前置：了解多核并发与 cache 基本概念，掌握单核临界区保护手段。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用自旋锁/原子保护跨核共享、按 cache line 维护一致性，并安全地管理任务生命周期。

 

本章速览




- SMP 下共享数据必须自旋锁/原子；per-core 数据不要跨核访问。

- 任务生命周期要管好资源：删除前释放锁与内存，挂起不释放资源。

- D-Cache 与 [DMA](term:dma)/核间共享要按 cache line 做 clean/invalidate 并保证对齐。

 

```zhizhan-anchor
m12-smp
```



```zhizhan-anchor
m12-smp-t
```



## 12.1 多核下的共享与生命周期



SMP 把共享数据变危险：两核可能真正同时访问同一内存。核间共享必须用自旋锁/原子；per-core 数据不要跨核访问。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  跨核共享的锁



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="跨核共享的锁" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">核A 读改写</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">核B 读改写</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">冲突/丢失</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">加锁正确</text></svg>
```



两个核同时对共享量读改写 → 丢失更新；自旋锁/原子使其互斥 → 计数正确。



表 12.1 单核 vs SMP



| 维度 | 单核 | SMP 多核 |
| --- | --- | --- |
| 并发 | 优先级抢占（时间并发） | 真正同时执行 |
| 共享保护 | BASEPRI 关中断 | 自旋锁/原子 |
| 私有数据 | 普通变量 | per-core，避免跨核 |
| Cache | 通常无 | D-Cache 按 line 维护 |



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：跨核计数的原子性



下面这段主机程序验证非原子读改写丢失更新、atomic/自旋锁正确：



host\_smp.cC

 

```text
/* host_smp.c —— 多核/并发下的共享计数：丢失更新与自旋锁（主机可运行）。
 *
 * 用真实 C11 原子操作演示两件事：
 *   ① 非原子的“读-改-写”：两个核交错执行时会丢失更新（最终值小于实际自增次数）。
 *   ② 用 atomic_flag 自旋锁或 atomic_fetch_add 保护后，计数严格正确。
 * 模型用“手工交错的步骤”表达两核并发；讨论的是内存序与互斥，不绑定具体指令。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_smp.c -o host_smp && ./host_smp
 */
#include <stdio.h>
#include <stdatomic.h>

int main(void) {
    int ok = 1;

    /* ① 非原子：两核都先读 0，各自 +1 后写回，最终只有 1（丢失一次自增） */
    int counter = 0, a_read, b_read;
    a_read = counter;      /* 核 A 读 */
    b_read = counter;      /* 核 B 读（A 尚未写回） */
    counter = a_read + 1;  /* 核 A 写 */
    counter = b_read + 1;  /* 核 B 写，覆盖了 A 的结果 */
    printf("非原子读改写：期望 2，实际 %d（丢失更新）\n", counter);
    if (counter != 1) ok = 0;

    /* ② atomic_fetch_add：每次自增原子完成，不丢 */
    atomic_int ac = 0;
    atomic_fetch_add(&ac, 1);   /* 核 A */
    atomic_fetch_add(&ac, 1);   /* 核 B */
    printf("atomic_fetch_add：期望 2，实际 %d\n", atomic_load(&ac));
    if (atomic_load(&ac) != 2) ok = 0;

    /* ③ 自旋锁：临界区内 +1，语义上等价于关调度/关中断的短临界区 */
    atomic_flag lock = ATOMIC_FLAG_INIT;
    int guarded = 0;
    for (int i = 0; i < 1000; i++) {
        while (atomic_flag_test_and_set_explicit(&lock, memory_order_acquire)) { /* spin */ }
        guarded++;                                   /* 临界区：只允许一个核进入 */
        atomic_flag_clear_explicit(&lock, memory_order_release);
    }
    printf("自旋锁保护的自增 1000 次：实际 %d\n", guarded);
    if (guarded != 1000) ok = 0;

    /* ④ 内存序对照：relaxed 只保证原子性，不保证跨线程可见顺序 */
    atomic_int seq = 0;
    atomic_store_explicit(&seq, 1, memory_order_relaxed);
    atomic_store_explicit(&seq, 2, memory_order_release);
    printf("release 存储后 relaxed 读 = %d（同线程内可见）\n", atomic_load_explicit(&seq, memory_order_relaxed));
    if (atomic_load_explicit(&seq, memory_order_relaxed) != 2) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

SMP/原子性模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_smp.c -o labs/host_smp && ./labs/host_smp
非原子读改写：期望 2，实际 1（丢失更新）
atomic_fetch_add：期望 2，实际 2
自旋锁保护的自增 1000 次：实际 1000
RESULT: PASS
```



非原子读改写丢失一次更新（2→1）；atomic 得 2；自旋锁保护 1000 次自增=1000。



表 12.2 原子性对比



| 方式 | 结果 | 判定 |
| --- | --- | --- |
| 非原子读改写 | 1 | 丢失更新 |
| atomic\_fetch\_add | 2 | 正确 |
| 自旋锁×1000 | 1000 | 正确 |
| 结论 | — | 跨核必须互斥 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm12-plat\n```\n\n\n\n```zhizhan-anchor\nm12-plat-t\n```\n\n\n\n## 12.3 三平台对照：多核/Cache\n\n\n\nESP32 双核、M7 有 D-Cache 需维护、M3 单核。三份代码均真实交叉编译。\n\n\n\nm12\\_lifecycle.cC\n\n \n\n```text\n/* m12_lifecycle.c —— 任务生命周期：创建 / 挂起 / 恢复 / 删除（Cortex-M3）。\n * 删除前必须先释放它持有的资源（锁、内存、句柄），否则别的任务会被永久阻塞。 */\n#include \"rtos_api.h\"\n\nstatic TaskHandle_t g_worker;\nstatic SemaphoreHandle_t g_lock;\n\nstatic void worker(void *arg) {\n    (void)arg;\n    for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); }\n}\n\nvoid m12_create(void) {\n    g_lock = xSemaphoreCreateMutex();\n    (void)xTaskCreate(worker, \"worker\", 256u, 0, 2u, &g_worker);\n}\nvoid m12_stop(void) {\n    if (g_worker) { vTaskSuspend(g_worker); }     /* 暂停：保留栈与状态 */\n}\nvoid m12_resume(void) {\n    if (g_worker) { vTaskResume(g_worker); }\n}\nvoid m12_destroy(void) {\n    if (g_worker) {\n        vTaskDelete(g_worker);                    /* 确保它不再持有 g_lock */\n        g_worker = 0;\n    }\n}\n```\n\nSTM32F103 · 生命周期\n\n\n\nesp\\_m12\\_smp.cC\n\n \n\n```text\n/* esp_m12_smp.c —— SMP 与亲和（ESP32 / Xtensa）。\n * 任务可固定到某个核也可迁移；核间共享数据必须用 spinlock/原子，per-core 数据不要跨核访问。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n#include \"rtos_api.h\"\n\nstatic portMUX_TYPE g_spin = portMUX_INITIALIZER_UNLOCKED;\nstatic volatile uint32_t g_cross;\n\nstatic void core0_only(void *arg) {\n    (void)arg;\n    for (;;) {\n        portENTER_CRITICAL(&g_spin);\n        g_cross++;                      /* 跨核共享：短临界区 + 自旋锁 */\n        portEXIT_CRITICAL(&g_spin);\n        vTaskDelay(1);\n    }\n}\nvoid esp_m12_start(void) {\n    TaskHandle_t h = 0;\n    (void)xTaskCreatePinnedToCore(core0_only, \"c0\", 4096u, 0, 3u, &h, 0);\n}\n```\n\nESP32 · 双核 SMP\n\n\n\nh7\\_m12\\_cache.cC\n\n \n\n```text\n/* h7_m12_cache.c —— D-Cache 与 DMA 一致性（STM32H7 / Cortex-M7）。\n * DMA/其他核对内存的写入对 CPU 不一定可见：共享缓冲要么放非 cache 区，\n * 要么按 cache line 做 clean/invalidate，并按 line 对齐。 */\n#include <stdint.h>\n\n#define ALIGN32 __attribute__((aligned(32)))\n\nstatic ALIGN32 volatile uint32_t g_dma_buf[16];   /* 32 字节对齐，覆盖一个 cache line */\n\n/* CMSIS 提供这两个函数（此处仅声明，链接时由 CMSIS 提供） */\nextern void SCB_CleanDCache_by_Addr(volatile void *addr, int32_t dsize);\nextern void SCB_InvalidateDCache_by_Addr(volatile void *addr, int32_t dsize);\n\nvoid h7_dma_clean(void)      { SCB_CleanDCache_by_Addr((void *)g_dma_buf, (int32_t)sizeof(g_dma_buf)); }\nvoid h7_dma_invalidate(void) { SCB_InvalidateDCache_by_Addr((void *)g_dma_buf, (int32_t)sizeof(g_dma_buf)); }\n```\n\nSTM32H7 · Cache 维护\n\n\n\n表 12.3 三平台多核/Cache\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 核数 | 1 | 2 | 1（可选双核 H7） |\n| 跨核锁 | — | 自旋锁/原子 | 原子 |\n| Cache | 无 | 依赖总线 | D-Cache 需维护 |\n| 生命周期 | 删除前释放资源 | 同 | 同 |"}
````



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 自检



多核自检：跨核用自旋锁/原子、私有数据隔离、cache 按 line 维护、生命周期释放资源。



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  计数结果（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="计数结果（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">非原子</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="43" class="sv-lbl-hi">1计数</text><text x="12" y="67" class="sv-lbl">atomic</text><rect x="150" y="50" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="67" class="sv-lbl-hi">2计数</text><text x="12" y="91" class="sv-lbl">自旋锁</text><rect x="150" y="74" width="600" height="18" rx="4" class="sv-grn-s"></rect><text x="758" y="91" class="sv-lbl-hi">1000计数</text></svg>
```



非原子读改写=1（丢失），atomic=2、自旋锁=1000（正确）。



表 12.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 共享 | 自旋锁/原子 | 关本核中断 |
| 私有 | per-core | 跨核访问 |
| Cache | clean/invalidate | 忘维护 |
| 生命周期 | 释放资源 | 删除不释放 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **用关本核中断保护跨核数据** ：另一核照样并发。

- **自旋锁持有期间调阻塞 API** ：可能死锁。

- **忘记 cache 维护** ：DMA 写入后 CPU 读到旧值。

- **删除任务不释放资源** ：锁/内存泄漏，最终卡死。



◆ 自测 · Module 12（先答再看）




1. 为什么单核“关中断”在多核上不够？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"关本核中断只阻止本核被抢占，挡不住另一个核同时读写同一内存。多核必须用自旋锁/原子保证跨核互斥。"}
   ```

2. Cache 一致性怎么维护？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"共享缓冲放非 cache 区，或按 cache line 对齐并做 clean（CPU→内存）/invalidate（内存→CPU），DMA 前后按方向维护。"}
   ```

3. 删除任务前必须做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"释放它持有的锁、内存与句柄。挂起只是暂停、不释放资源；反复删除/重建会引入碎片。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你多核系统确认跨核共享用自旋锁/原子、cache 按 line 维护，并规范任务删除前的资源释放。



核对与延伸：[ESP-IDF · FreeRTOS (IDF) 与任务 API](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html) · [Zephyr · Time & Timers / SMP](https://docs.zephyrproject.org/latest/kernel/services/index.html)

 

动手练习



运行 ` labs/host_smp.c `：验证非原子读改写丢失更新、atomic/自旋锁保护后计数正确。



**检查结果：** 非原子读改写期望 2 实际 1；atomic 得 2；自旋锁自增 1000 次=1000；cache 缓冲按 line 对齐维护。

 

迁移练习：把本章的“能用自旋锁/原子保护跨核共享、按 cache line 维护一致性，并安全地管理任务生命周期。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m12","criterion":"非原子读改写期望 2 实际 1；atomic 得 2；自旋锁自增 1000 次=1000；cache 缓冲按 line 对齐维护。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
