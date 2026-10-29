/* m03_mutex.c —— 互斥量：保护临界资源并在阻塞时继承优先级（Cortex-M3）。
 * 互斥量 ≠ 二值信号量：它带所有权，configUSE_MUTEXES=1 时启用优先级继承。 */
#include "rtos_api.h"

static SemaphoreHandle_t g_mtx;

static void sensor_write(void *arg) {
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_mtx, pdMS_TO_TICKS(50)) == pdTRUE) {
            /* 临界区：读写共享缓存，越短越好 */
            xSemaphoreGive(g_mtx);
        } else {
            /* 拿不到锁不能死等：超时后降级或重试 */
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void m03_create(void) {
    g_mtx = xSemaphoreCreateMutex();
    (void)xTaskCreate(sensor_write, "sensor", 256u, 0, 3u, 0);
}
