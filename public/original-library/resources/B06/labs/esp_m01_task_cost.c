/* esp_m01_task_cost.c —— 一个 RTOS 任务的 RAM 成本（ESP32 / XTensa）。
 * 每个任务有独立栈与 TCB；新建任务消耗的堆，就是“多任务”的价格。 */
#include <stdint.h>
#include "esp_idf_api.h"
#include "rtos_api.h"

static void idle_task(void *arg) {
    (void)arg;
    for (;;) { vTaskDelay(1); }
}

/* 返回新建一个 2048 字节栈任务所消耗的堆字节数（含 TCB 与本册内存分配开销） */
uint32_t esp_m01_task_cost(void) {
    uint32_t before = esp_get_free_heap_size();
    TaskHandle_t h = 0;
    (void)xTaskCreate(idle_task, "cost", 2048u, 0, 1u, &h);
    return before - esp_get_free_heap_size();
}
