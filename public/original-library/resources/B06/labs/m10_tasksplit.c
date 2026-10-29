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
