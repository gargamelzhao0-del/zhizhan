# 实战：裸机项目 RTOS 化

```zhizhan-anchor
m10
```



把裸机传感器工程重构为多任务：任务划分、优先级分配、队列设计、同步与超时。

 

> 前置：完成 M01–M09，能把裸机功能按“截止期”拆成任务与通信。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把裸机传感器工程重构为按截止期定优先级的多任务流水线，并用队列与超时解耦、用互斥量保护总线。

 

本章速览




- 把裸机拆成任务：按截止期定优先级，用队列/事件组解耦，共享资源用互斥量。

- 采样 / 处理 / 通信分层，各任务栈与优先级按最坏情况给。

- RTOS 化不是重写业务，而是重排调用关系与阻塞点。

 

```zhizhan-anchor
m10-split
```



```zhizhan-anchor
m10-split-t
```



## 10.1 从截止期倒推任务



RTOS 化不是把函数改名，而是从截止期倒推任务与通信：列出必须响应外部事件的活动，写下最坏响应期限，期限越紧优先级越高，再用队列解耦。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  任务与优先级



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="任务与优先级" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">sample_task（高，10ms）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">process_task（中）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">comms_task（低，100ms）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">heartbeat（最低）</text></svg>
```



采样(10ms) → 处理 → 上报(100ms) → 心跳；控制类(1ms)优先级最高。队列解耦生产消费。



表 10.1 任务拆分



| 裸机活动 | 拆分任务 | 优先级 | 通信 |
| --- | --- | --- | --- |
| ADC 采样 10ms | sample\_task | 高(4) | 队列→处理 |
| 滤波换算 | process\_task | 中(3) | 队列→通信 |
| 上报/存储 | comms\_task | 低(2) | 队列/互斥总线 |
| 状态灯/心跳 | heartbeat | 最低(1) | 无 |



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：任务/队列静态开销（交叉编译）



任务与队列的静态开销可从 bss 读出；三平台实现均真实交叉编译：



m10\_tasksplit.cC

 

```text
/* m10_tasksplit.c —— 把裸机工程拆成任务（Cortex-M3）。
 * 采样(高) → 处理(中) → 通信(低)，用队列解耦；优先级按截止期分配。 */
#include <stdint.h>
#include "rtos_api.h"

typedef struct { int16_t v; } item_t;
static QueueHandle_t g_raw, g_out;

static void sample_task(void *arg) {
    item_t it; (void)arg;
    for (;;) {
        it.v = 0;                                        /* 采一次 */
        (void)xQueueSend(g_raw, &it, pdMS_TO_TICKS(5));
        vTaskDelay(pdMS_TO_TICKS(10));                   /* 10ms 采样周期 */
    }
}
static void process_task(void *arg) {
    item_t it; (void)arg;
    for (;;) {
        if (xQueueReceive(g_raw, &it, portMAX_DELAY) == pdTRUE) {
            (void)xQueueSend(g_out, &it, pdMS_TO_TICKS(5));
        }
    }
}
static void comms_task(void *arg) {
    item_t it; (void)arg;
    for (;;) {
        if (xQueueReceive(g_out, &it, portMAX_DELAY) == pdTRUE) {
            /* 上报 */
        }
    }
}
void m10_split(void) {
    g_raw = xQueueCreate(8u, (uint32_t)sizeof(item_t));
    g_out = xQueueCreate(8u, (uint32_t)sizeof(item_t));
    (void)xTaskCreate(sample_task,  "sample",  256u, 0, 4u, 0);
    (void)xTaskCreate(process_task, "process", 256u, 0, 3u, 0);
    (void)xTaskCreate(comms_task,   "comms",   512u, 0, 2u, 0);
}
```

STM32F103 · 任务流水线



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m10_tasksplit.c -o m10.o && arm-none-eabi-size m10.o
   text    data     bss     dec     hex filename
    233       0       8     241      f1 m10.o
```



真实交叉编译：m10\_tasksplit.c（M3）text=233 B、bss=8 B；Xtensa 侧 text=160 B（含静态任务/队列）。



表 10.2 流水线规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m10\_tasksplit.c | M3 | 233 B |
| esp\_m10\_pipeline.c | Xtensa | 160 B |
| bss | — | 任务/队列静态 |
| 超时 | 所有阻塞 | \>0 |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm10-plat\n```\n\n\n\n```zhizhan-anchor\nm10-plat-t\n```\n\n\n\n## 10.3 三平台对照：流水线\n\n\n\n同一流水线在三平台用各自的 API 实现；任务划分与优先级分配不变。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m10\\\\_tasksplit.cC\\n\\n \\n\\n```text\\n/* m10_tasksplit.c —— 把裸机工程拆成任务（Cortex-M3）。\\n * 采样(高) → 处理(中) → 通信(低)，用队列解耦；优先级按截止期分配。 */\\n#include <stdint.h>\\n#include \\\"rtos_api.h\\\"\\n\\ntypedef struct { int16_t v; } item_t;\\nstatic QueueHandle_t g_raw, g_out;\\n\\nstatic void sample_task(void *arg) {\\n    item_t it; (void)arg;\\n    for (;;) {\\n        it.v = 0;                                        /* 采一次 */\\n        (void)xQueueSend(g_raw, &it, pdMS_TO_TICKS(5));\\n        vTaskDelay(pdMS_TO_TICKS(10));                   /* 10ms 采样周期 */\\n    }\\n}\\nstatic void process_task(void *arg) {\\n    item_t it; (void)arg;\\n    for (;;) {\\n        if (xQueueReceive(g_raw, &it, portMAX_DELAY) == pdTRUE) {\\n            (void)xQueueSend(g_out, &it, pdMS_TO_TICKS(5));\\n        }\\n    }\\n}\\nstatic void comms_task(void *arg) {\\n    item_t it; (void)arg;\\n    for (;;) {\\n        if (xQueueReceive(g_out, &it, portMAX_DELAY) == pdTRUE) {\\n            /* 上报 */\\n        }\\n    }\\n}\\nvoid m10_split(void) {\\n    g_raw = xQueueCreate(8u, (uint32_t)sizeof(item_t));\\n    g_out = xQueueCreate(8u, (uint32_t)sizeof(item_t));\\n    (void)xTaskCreate(sample_task,  \\\"sample\\\",  256u, 0, 4u, 0);\\n    (void)xTaskCreate(process_task, \\\"process\\\", 256u, 0, 3u, 0);\\n    (void)xTaskCreate(comms_task,   \\\"comms\\\",   512u, 0, 2u, 0);\\n}\\n```\\n\\nSTM32F103 · 任务流水线\"}\n````\n\n\n\nesp\\_m10\\_pipeline.cC\n\n \n\n```text\n/* esp_m10_pipeline.c —— 双核流水线（ESP32 / Xtensa）。\n * 采集固定到核 0，通信固定到核 1，减少彼此干扰；中间用队列交接。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n#include \"rtos_api.h\"\n\nstatic QueueHandle_t g_q;\n\nstatic void acq(void *arg) {\n    (void)arg;\n    for (;;) {\n        int v = 0;\n        (void)xQueueSend(g_q, &v, pdMS_TO_TICKS(5));\n        vTaskDelay(pdMS_TO_TICKS(10));\n    }\n}\nstatic void link(void *arg) {\n    int v;\n    (void)arg;\n    for (;;) {\n        if (xQueueReceive(g_q, &v, portMAX_DELAY) == pdTRUE) { /* 上报 */ }\n    }\n}\nvoid esp_m10_start(void) {\n    TaskHandle_t a = 0, b = 0;\n    g_q = xQueueCreate(16u, (uint32_t)sizeof(int));\n    (void)xTaskCreatePinnedToCore(acq,  \"acq\",  4096u, 0, 4u, &a, 0);\n    (void)xTaskCreatePinnedToCore(link, \"link\", 4096u, 0, 3u, &b, 1);\n}\n```\n\nESP32 · 流水线\n\n\n\nh7\\_m10\\_priority.cC\n\n \n\n```text\n/* h7_m10_priority.c —— 优先级分配原则（STM32H7 / Cortex-M7）。\n * 越“靠近截止期、越不能被延迟”的任务优先级越高；共享资源时注意优先级反转。 */\n#include \"rtos_api.h\"\n\nvoid h7_m10_assign(void) {\n    /* 例：控制周期 1ms > 通信 10ms > 显示 100ms */\n    (void)xTaskCreate((TaskFunction_t)0, \"ctrl\", 512u, 0, 5u, 0);\n    (void)xTaskCreate((TaskFunction_t)0, \"comm\", 512u, 0, 3u, 0);\n    (void)xTaskCreate((TaskFunction_t)0, \"disp\", 256u, 0, 1u, 0);\n}\n```\n\nSTM32H7 · 优先级\n\n\n\n表 10.3 三平台流水线\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 任务 | xTaskCreate | xTaskCreate | xTaskCreate |\n| 队列 | xQueueCreate | xQueueCreate | xQueueCreate |\n| 总线锁 | mutex | mutex | mutex |\n| 超时 | portMAX\\_DELAY/自定义 | 同 | 同 |"}
`````



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



RTOS 化自检：按截止期定优先级、队列深度可算、阻塞有超时、总线有锁。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  按截止期分配优先级（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="按截止期分配优先级（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">控制 1ms</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(周期倒数)</text><text x="12" y="67" class="sv-lbl">采样 10ms</text><rect x="150" y="50" width="327" height="18" rx="4" class="sv-amb-s"></rect><text x="485" y="67" class="sv-lbl-hi">60(周期倒数)</text><text x="12" y="91" class="sv-lbl">上报 100ms</text><rect x="150" y="74" width="109" height="18" rx="4" class="sv-grn-s"></rect><text x="267" y="91" class="sv-lbl-hi">20(周期倒数)</text></svg>
```



控制 1ms \> 采样 10ms \> 上报 100ms；周期越短、越接近截止期优先级越高（RM 思路）。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 拆任务 | 按截止期 | 按函数 |
| 队列 | 按突发/速率 | 拍脑袋 |
| 超时 | 所有阻塞 | 无限等 |
| 总线 | 互斥\+短[事务](term:transaction) | 持锁做 I/O |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **按函数而非截止期拆任务** ：优先级失去意义。

- **队列深度拍脑袋** ：太浅丢数据，太深吃 RAM。

- **阻塞调用不设超时** ：一个设备无响应卡死整个任务链。

- **持锁期间做 I/O** ：把总线锁住很久，其它任务集体阻塞。



◆ 自测 · Module 10（先答再看）




1. 采样 10ms、上报 100ms、控制 1ms，优先级从高到低怎么排？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"控制(1ms) \\> 采样(10ms) \\> 上报(100ms)。周期越短、越接近截止期的任务优先级越高（RM 的思路）。"}
   ```

2. 队列深度应该怎么给？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"按“最坏突发量 / 消费速率”估算，宁深勿浅但要算 RAM；太深会掩盖上游过快的问题。"}
   ```

3. 为什么每个阻塞调用都要有超时？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一个设备无响应会让该任务无限等待，进而卡死依赖它的整条任务链。有超时才能降级/恢复。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把一个裸机工程重构为按截止期定优先级的多任务流水线，给队列深度与所有阻塞调用加超时。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [Liu & Layland · Rate Monotonic Scheduling](https://en.wikipedia.org/wiki/Rate-monotonic_scheduling)

 

动手练习



编译 ` labs/m10_tasksplit.c `（M3）与 ` labs/esp_m10_pipeline.c `（Xtensa）。



**检查结果：** 按截止期分配优先级（控制 1ms\>采样 10ms\>上报 100ms）；有队列与超时；并发交叉编译通过。

 

迁移练习：把本章的“能把裸机传感器工程重构为按截止期定优先级的多任务流水线，并用队列与超时解耦、用互斥量保护总线。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m10","criterion":"按截止期分配优先级（控制 1ms>采样 10ms>上报 100ms）；有队列与超时；并发交叉编译通过。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
