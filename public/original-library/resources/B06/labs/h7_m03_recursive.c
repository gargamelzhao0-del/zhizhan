/* h7_m03_recursive.c —— 递归互斥量（STM32H7 / Cortex-M7）。
 * 同一任务可重复 take，必须等量 give；适合“已持锁的函数又调用要锁的函数”。 */
#include "rtos_api.h"

static SemaphoreHandle_t g_rec;

static void inner(void) {
    (void)xSemaphoreTakeRecursive(g_rec, portMAX_DELAY);
    /* 需要同一把锁的内层操作 */
    (void)xSemaphoreGiveRecursive(g_rec);
}

static void outer(void *arg) {
    (void)arg;
    for (;;) {
        (void)xSemaphoreTakeRecursive(g_rec, portMAX_DELAY);
        inner();                               /* 再次获取同一把锁，计数 +1，不会自锁 */
        (void)xSemaphoreGiveRecursive(g_rec);  /* 计数归零才真正释放 */
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void h7_m03_create(void) {
    g_rec = xSemaphoreCreateRecursiveMutex();
    (void)xTaskCreate(outer, "outer", 256u, 0, 3u, 0);
}
