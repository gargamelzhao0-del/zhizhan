/* h7_m01_arch.c —— 任务 + 队列架构（STM32H7 / Cortex-M7）。
 * 采集任务投递样本，处理/通信任务消费；用队列解耦速率。 */
#include <stdint.h>
#include "app_api.h"

typedef struct { int16_t v; } sample_t;
static QueueHandle_t g_q;

static void acq_task(void *arg) {
    sample_t s = {0};
    (void)arg;
    for (;;) {
        (void)xQueueSend(g_q, &s, pdMS_TO_TICKS(5));
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
static void proc_task(void *arg) {
    sample_t s;
    (void)arg;
    for (;;) {
        if (xQueueReceive(g_q, &s, portMAX_DELAY) == pdTRUE) { /* 处理 */ }
    }
}
void h7_arch_start(void) {
    g_q = xQueueCreate(8u, (uint32_t)sizeof(sample_t));
    (void)xTaskCreate(acq_task,  "acq",  512u, 0, 4u, 0);
    (void)xTaskCreate(proc_task, "proc", 512u, 0, 3u, 0);
}
