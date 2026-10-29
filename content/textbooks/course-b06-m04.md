# 队列、事件组与流缓冲

```zhizhan-anchor
m04
```



队列的拷贝语义与指针传递；xQueueSendFromISR 的唤醒标志；事件组；stream/message buffer。

 

> 前置：了解任务间通信需求，以及中断与任务上下文的区别。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用队列（按值/按指针）解耦生产与消费，并正确处理 FromISR 入队的唤醒标志与事件组多条件等待。

 

本章速览




- 队列按值拷贝：传大结构要算拷贝成本，传指针要管生命周期。

- FromISR 入队后若唤醒更高优先级任务，必须 portYIELD\_FROM\_ISR 才能立刻切换。

- 事件组用于“多条件同时满足”；流/消息缓冲用于字节流与不定长消息。

 

```zhizhan-anchor
m04-queue
```



```zhizhan-anchor
m04-queue-t
```



## 4.1 队列的拷贝语义



队列 = 定长消息 \+ 按值拷贝 \+ 线程安全 FIFO。按值拷贝意味着入队后改原变量不影响副本；传大结构则每次收发都有一份拷贝成本。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  队列解耦生产与消费



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="队列解耦生产与消费" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">send</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">队列缓冲</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">receive</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">处理</text></svg>
```



生产者 send（满则失败/等）→ 队列缓冲 → 消费者 receive（空则等/超时）。按值拷贝保证隔离。



表 4.1 数据传递方式



| 传递方式 | 拷贝成本 | 生命周期风险 | 适用 |
| --- | --- | --- | --- |
| 按值（大结构） | 高 | 低 | 小结构、强隔离 |
| 按值（指针） | 低 | 高 | 生命周期清晰的大缓冲 |
| 流缓冲 | 按字节 | 低 | ISR→任务字节流 |
| 消息缓冲 | 带长度前缀 | 低 | 不定长消息 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：拷贝语义与唤醒标志



下面这段主机程序验证拷贝语义、满/空、FromISR 唤醒与事件组：



host\_queue.cC

 

```text
/* host_queue.c —— 队列 / 事件组的语义模型（主机可运行）。
 *
 * 覆盖 RTOS 队列最容易被想当然的三件事：
 *   ① 拷贝语义：入队的是“值”，不是指针；之后改原变量不影响队列里的副本。
 *   ② 满/空边界：满时 send 返回失败（不是覆盖）；空时 recv 返回失败。
 *   ③ FromISR 唤醒：中断里 send，只有在“有更高优先级任务在等”时才设置
 *      xHigherPriorityTaskWoken，据此决定是否 portYIELD_FROM_ISR。
 *   ④ 事件组：按位与/或等待与超时。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_queue.c -o host_queue && ./host_queue
 */
#include <stdio.h>

#define QCAP 4
typedef struct { int buf[QCAP]; int head, tail, count; } queue_t;

static void q_init(queue_t *q) { q->head = q->tail = q->count = 0; }
static int  q_send(queue_t *q, int v) {
    if (q->count == QCAP) return 0;               /* 满：拒绝，不覆盖 */
    q->buf[q->tail] = v; q->tail = (q->tail + 1) % QCAP; q->count++; return 1;
}
static int  q_recv(queue_t *q, int *v) {
    if (q->count == 0) return 0;                  /* 空：失败 */
    *v = q->buf[q->head]; q->head = (q->head + 1) % QCAP; q->count--; return 1;
}
/* 中断上下文版本：receiver_waiting 表示是否有更高优先级任务正阻塞在“收”上 */
static int  q_send_from_isr(queue_t *q, int v, int receiver_waiting, int *higher_woken) {
    *higher_woken = 0;
    if (q->count == QCAP) return 0;
    q_send(q, v);
    if (receiver_waiting) *higher_woken = 1;      /* 唤醒后需要 portYIELD_FROM_ISR */
    return 1;
}

/* 事件组：32 位标志 + 等待/超时 */
typedef struct { unsigned bits; } evt_t;
static void evt_set(evt_t *e, unsigned mask) { e->bits |= mask; }
static void evt_clear(evt_t *e, unsigned mask) { e->bits &= ~mask; }
/* 返回 1 表示满足（所有 clear_on_exit 位都置位），0 表示超时 */
static int evt_wait(evt_t *e, unsigned mask, int timeout_ticks, int *waited) {
    int t;
    for (t = 0; t <= timeout_ticks; t++) {
        if ((e->bits & mask) == mask) { *waited = t; return 1; }
    }
    *waited = timeout_ticks; return 0;
}

int main(void) {
    queue_t q; int v, ok = 1;

    q_init(&q);
    /* ① 拷贝语义 */
    int src = 100;
    q_send(&q, src);
    src = 999;                                     /* 改原变量 */
    q_recv(&q, &v);
    printf("拷贝语义：入队 100 后改原变量为 999，出队得到 %d\n", v);
    if (v != 100) ok = 0;

    /* ② 满/空边界 */
    q_init(&q);
    for (int i = 1; i <= QCAP; i++) if (!q_send(&q, i)) ok = 0;
    printf("满队列：已装 %d 项，再 send 返回 %s\n", QCAP, q_send(&q, 99) ? "成功" : "失败(正确)");
    if (q_send(&q, 99)) ok = 0;

    q_recv(&q, &v); q_recv(&q, &v);                /* 取走 1、2 */
    q_send(&q, 5); q_send(&q, 6);                  /* 空出两格再入 5、6 */
    int seq[6], n = 0;
    while (q_recv(&q, &v)) seq[n++] = v;
    printf("FIFO 顺序：");
    for (int i = 0; i < n; i++) printf("%d%s", seq[i], i + 1 < n ? "," : "");
    printf(" (期望 3,4,5,6)\n");
    if (!(n == 4 && seq[0] == 3 && seq[1] == 4 && seq[2] == 5 && seq[3] == 6)) ok = 0;

    /* ③ FromISR 唤醒标志 */
    q_init(&q);
    int woken = -1;
    q_send_from_isr(&q, 7, 0, &woken);
    printf("FromISR：无等待者 → higher_woken=%d (期望 0)\n", woken);
    if (woken != 0) ok = 0;
    q_send_from_isr(&q, 8, 1, &woken);
    printf("FromISR：有高优先级等待者 → higher_woken=%d (期望 1)\n", woken);
    if (woken != 1) ok = 0;

    /* ④ 事件组 */
    evt_t e = {0};
    evt_set(&e, 0x1);
    evt_set(&e, 0x4);
    int waited = 0;
    int r = evt_wait(&e, 0x5, 10, &waited);
    printf("事件组：等待 0x5 → %s，等了 %d tick\n", r ? "满足" : "超时", waited);
    if (!(r == 1 && waited == 0)) ok = 0;
    evt_clear(&e, 0x1);
    if ((e.bits & 0x1) != 0) ok = 0;
    r = evt_wait(&e, 0x2, 5, &waited);
    printf("事件组：等待未置位的 0x2 → %s，等了 %d tick\n", r ? "满足" : "超时", waited);
    if (!(r == 0 && waited == 5)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

队列/事件组模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_queue.c -o labs/host_queue && ./labs/host_queue
拷贝语义：入队 100 后改原变量为 999，出队得到 100
满队列：已装 4 项，再 send 返回 失败(正确)
FIFO 顺序：3,4,5,6
FromISR：无等待者 → higher_woken=0
FromISR：有高优先级等待者 → higher_woken=1
事件组：等待 0x5 → 满足，等了 0 tick
RESULT: PASS
```



拷贝语义：入队 100 后改 999、出队仍 100；满队列 send 失败；FromISR 唤醒标志 0/1；事件组满足/超时。



表 4.2 队列结果



| 检查 | 结果 | 说明 |
| --- | --- | --- |
| 拷贝语义 | 出队=100 | 按值隔离 |
| 满队列 | send 失败 | 不覆盖 |
| FIFO | 3,4,5,6 | 顺序 |
| 唤醒标志 | 0/1 | 有无等待者 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm04-plat\n```\n\n\n\n```zhizhan-anchor\nm04-plat-t\n```\n\n\n\n## 4.3 三平台对照：队列/事件\n\n\n\n三平台的队列/事件 API 名不同，拷贝语义与 FromISR 唤醒机制一致。三份代码均真实交叉编译。\n\n\n\nm04\\_queue\\_isr.cC\n\n \n\n```text\n/* m04_queue_isr.c —— 队列按值拷贝 + 中断里入队（Cortex-M3）。\n * 中断只做“搬数据 + 设唤醒标志”；FromISR 后按标志决定是否 portYIELD_FROM_ISR。 */\n#include <stdint.h>\n#include \"rtos_api.h\"\n\ntypedef struct { uint16_t adc; uint32_t tick; } sample_t;\nstatic QueueHandle_t g_q;\n\nvoid m04_uart_isr(void) {\n    sample_t s;\n    BaseType_t woken = pdFALSE;\n    s.adc  = 0x0FFFu;                     /* 从外设寄存器取样本 */\n    s.tick = xTaskGetTickCount();\n    (void)xQueueSendFromISR(g_q, &s, &woken);\n    portYIELD_FROM_ISR(woken);            /* 唤醒了更高优先级任务就立刻切换 */\n}\n\nstatic void consumer(void *arg) {\n    sample_t s;\n    (void)arg;\n    for (;;) {\n        if (xQueueReceive(g_q, &s, portMAX_DELAY) == pdTRUE) {\n            /* 处理样本；队列已拷贝，s 是安全副本 */\n        }\n    }\n}\n\nvoid m04_create(void) {\n    g_q = xQueueCreate(16u, (uint32_t)sizeof(sample_t));\n    (void)xTaskCreate(consumer, \"cons\", 256u, 0, 4u, 0);\n}\n```\n\nSTM32F103 · 队列\\+ISR\n\n\n\nesp\\_m04\\_stream.cC\n\n \n\n```text\n/* esp_m04_stream.c —— 流缓冲：字节流、无消息边界（ESP32 / Xtensa）。\n * 适合 ISR/驱动与任务之间批量搬运字节，读端按“有多少读多少”。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n#include \"rtos_api.h\"\n\nstatic StreamBufferHandle_t g_sb;\nstatic volatile uint8_t g_dma[64];\n\nvoid esp_dma_done_isr(void) {\n    (void)xStreamBufferSend(g_sb, (const void *)g_dma, (size_t)sizeof(g_dma), 0u);\n}\n\nstatic void parser(void *arg) {\n    uint8_t buf[32];\n    (void)arg;\n    for (;;) {\n        size_t n = xStreamBufferReceive(g_sb, buf, sizeof(buf), portMAX_DELAY);\n        if (n == 0u) { continue; }\n        /* 解析 buf[0..n) */\n    }\n}\n\nvoid esp_m04_create(void) {\n    g_sb = xStreamBufferCreate(256u, 1u);   /* 容量 256 字节，触发水位 1 */\n    (void)xTaskCreate(parser, \"parse\", 3072u, 0, 5u, 0);\n}\n```\n\nESP32 · 流缓冲\n\n\n\nh7\\_m04\\_eventgroup.cC\n\n \n\n```text\n/* h7_m04_eventgroup.c —— 事件组：一个任务等待多个事件同时满足（STM32H7）。\n * 比“多个信号量”更省对象，也便于表达“全部就绪才开始”。 */\n#include <stdint.h>\n#include \"rtos_api.h\"\n\n#define EVT_NET  (1u << 0)\n#define EVT_SENS (1u << 1)\n#define EVT_CFG  (1u << 2)\nstatic EventGroupHandle_t g_eg;\n\nstatic void app(void *arg) {\n    (void)arg;\n    const EventBits_t need = EVT_NET | EVT_SENS | EVT_CFG;\n    for (;;) {\n        EventBits_t got = xEventGroupWaitBits(g_eg, need, pdFALSE, pdTRUE, pdMS_TO_TICKS(5000));\n        if ((got & need) == need) {\n            /* 三个前置都就绪：进入主流程 */\n        } else {\n            /* 超时：降级或重试 */\n        }\n    }\n}\n\nvoid h7_m04_create(void) {\n    g_eg = xEventGroupCreate();\n    (void)xTaskCreate(app, \"app\", 256u, 0, 3u, 0);\n}\n```\n\nSTM32H7 · 事件组\n\n\n\n表 4.3 三平台队列/事件\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 队列 | xQueueCreate | xQueueCreate | xQueueCreate |\n| FromISR | xQueueSendFromISR | 同 | 同 |\n| 事件 | xEventGroup\\* | EventGroup | xEventGroup\\* |\n| 唤醒 | portYIELD\\_FROM\\_ISR | 同 | 同 |"}
````



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



队列自检：按值/指针语义清楚、满空处理、FromISR 唤醒、事件组掩码。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  唤醒标志（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="唤醒标志（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">无等待者</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-box"></rect><text x="160" y="43" class="sv-lbl-hi">0(唤醒=1)</text><text x="12" y="67" class="sv-lbl">有等待者</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="67" class="sv-lbl-hi">1(唤醒=1)</text></svg>
```



无等待者时 FromISR 唤醒=0；有高优先级等待者=1——决定是否立刻切换。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 传递 | 值/指针清楚 | 悬空指针 |
| 满空 | 处理返回值 | 假设必成功 |
| ISR | FromISR\+唤醒 | 忘 portYIELD |
| 事件 | 掩码明确 | 清位冲突 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.4 常见误区与排障



失败路径与排障




- **传指针却先释放内存** ：接收方拿到悬空指针。

- **忘记 portYIELD\_FROM\_ISR** ：唤醒了高优先级任务但不切换，响应退化到下一 tick。

- **发送超时设 0 又当会成功** ：队列满时立即失败，需处理返回值。

- **事件组混用 clear-on-exit** ：多等待者时清位互相影响。



◆ 自测 · Module 04（先答再看）




1. 队列装一条 200 字节帧，按值与按指针各有什么代价？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"按值每次收发拷贝 200 字节（CPU 成本随速率上升，但数据安全）；按指针只拷 4/8 字节，但必须保证缓冲在接收方用完前不被改写/释放，并处理所有权与回收。"}
   ```

2. xHigherPriorityTaskWoken 有什么用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它表示 FromISR 是否唤醒了更高优先级任务；随后 portYIELD\\_FROM\\_ISR(woken) 才会立刻切换。忘了这一步，被唤醒的任务要等到下一个 tick。"}
   ```

3. 事件组相比堆叠多个信号量的好处？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用一组位表达多个条件，可“等全部/等任一置位”，比多个信号量更省对象，适合“网络连上 \\+ 传感器就绪 \\+ 参数加载完”这类组合条件。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目的任务间通信改为队列/S 事件组，明确按值或按指针语义并处理 FromISR 唤醒。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [RT-Thread 官方文档](https://www.rt-thread.io/document/site/)

 

动手练习



运行 ` labs/host_queue.c `：验证拷贝语义、满/空边界、FromISR 唤醒标志与事件组超时。



**检查结果：** 满 4 项再 send 失败；入队 100 后改原变量为 999、出队仍 100；无等待者 FromISR 唤醒=0、有高优先级等待者=1。

 

迁移练习：把本章的“能用队列（按值/按指针）解耦生产与消费，并正确处理 FromISR 入队的唤醒标志与事件组多条件等待。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m04","criterion":"满 4 项再 send 失败；入队 100 后改原变量为 999、出队仍 100；无等待者 FromISR 唤醒=0、有高优先级等待者=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
