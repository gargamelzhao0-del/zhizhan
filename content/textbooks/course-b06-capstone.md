# 把一个裸机项目 RTOS 化并满足实时性

```zhizhan-anchor
capstone
```



把 12 章串成一条路径：任务划分 → 调度与优先级 → 同步与队列 → ISR 边界 → 内存/时间 → 可调度性分析 → 多核。



> ◈ 10 步改造路径 · ⚑ 每步可验收

 

把 12 章的能力串成一个可交付的小终端： **传感器任务每 100ms 采一次，队列交给处理任务，再排队给通信任务上报；[I²C](term:i2c) 总线用互斥量保护，通信任务负责喂狗。** 这不是新示例，而是把各章代码按依赖重排成一条构建路径，每一步都有可检验的验收。

 

 
1. **① 拆任务** （M01/M10）——采样 / 处理 / 通信三层；验收：优先级按截止期分配，慢任务不再拖慢采样。
 
2. **② 定调度** （M02）——可抢占 \+ 优先级；验收：采样任务被唤醒后立刻运行，切换发生在 PendSV。
 
3. **③ 护总线** （M03）——I²C 用互斥量；验收：两任务并发读传感器时[事务](term:transaction)不交叉，无优先级反转。
 
4. **④ 传数据** （M04）——队列按值拷贝；验收：满队列时发送超时而不丢数据也不死锁。
 
5. **⑤ 分中断** （M05）——采样中断只入队；验收：ISR 时长固定，长逻辑都在任务里。
 
6. **⑥ 管内存** （M06）——任务栈与队列静态分配；验收：启动后无堆分配，高水位有余量。
 
7. **⑦ 控时间** （M07）——周期任务用 vTaskDelayUntil；验收：100ms 采样周期不漂移；空闲进 tickless。
 
8. **⑧ 可观测** （M08）——栈溢出检测 \+ 任务看门狗；验收：栈溢出被捕获、卡死能被复位。
 
9. **⑨ 算预算** （M11）——对三条任务链做 RTA；验收：R\_i ≤ T\_i，留出阻塞与抖动余量。
 
10. **⑩ 上多核** （M12）——` labs/capstone_node_rtos.c `；验收：跨核共享用自旋锁，缓存按 line 维护。
 

 

本册所有板上项（真实中断延迟、功耗、RSSI 等）均标注为“需上板实测”，未接板不声称已测；主机可验证的调度/同步数字已给出真实运行结果。



capstone\_node\_rtos.cC

 

```text
/* capstone_node_rtos.c —— 贯穿项目骨架：环境采集终端的 RTOS 化（Cortex-M3 示范）。
 * sensor(高) → queue → process(中) → queue → comms(低)；I²C 用互斥量保护，通信任务负责上报与喂狗。 */
#include <stdint.h>
#include "rtos_api.h"
#include "rtos_cm.h"

typedef struct { int16_t t; uint16_t v; } sample_t;
static QueueHandle_t g_raw, g_tx;
static SemaphoreHandle_t g_i2c;

static void sensor_task(void *arg) {
    sample_t s; (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_i2c, pdMS_TO_TICKS(5)) == pdTRUE) {
            s.t = 0; s.v = 0;                              /* 读传感器 */
            (void)xSemaphoreGive(g_i2c);
            (void)xQueueSend(g_raw, &s, pdMS_TO_TICKS(5));
        }
        vTaskDelay(pdMS_TO_TICKS(100));                    /* 100ms 采样周期 */
    }
}
static void process_task(void *arg) {
    sample_t s; (void)arg;
    for (;;) {
        if (xQueueReceive(g_raw, &s, portMAX_DELAY) == pdTRUE) {
            (void)xQueueSend(g_tx, &s, pdMS_TO_TICKS(50));
        }
    }
}
static void comms_task(void *arg) {
    sample_t s; (void)arg;
    for (;;) {
        if (xQueueReceive(g_tx, &s, pdMS_TO_TICKS(1000)) == pdTRUE) {
            /* 上报成功后才喂狗；超时说明链路异常 */
        }
    }
}
void capstone_start(void) {
    g_raw = xQueueCreate(8u, (uint32_t)sizeof(sample_t));
    g_tx  = xQueueCreate(8u, (uint32_t)sizeof(sample_t));
    g_i2c = xSemaphoreCreateMutex();
    (void)xTaskCreate(sensor_task,  "sensor",  512u, 0, 4u, 0);
    (void)xTaskCreate(process_task, "process", 512u, 0, 3u, 0);
    (void)xTaskCreate(comms_task,   "comms",   768u, 0, 2u, 0);
}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
