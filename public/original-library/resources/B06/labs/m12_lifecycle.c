/* m12_lifecycle.c —— 任务生命周期：创建 / 挂起 / 恢复 / 删除（Cortex-M3）。
 * 删除前必须先释放它持有的资源（锁、内存、句柄），否则别的任务会被永久阻塞。 */
#include "rtos_api.h"

static TaskHandle_t g_worker;
static SemaphoreHandle_t g_lock;

static void worker(void *arg) {
    (void)arg;
    for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); }
}

void m12_create(void) {
    g_lock = xSemaphoreCreateMutex();
    (void)xTaskCreate(worker, "worker", 256u, 0, 2u, &g_worker);
}
void m12_stop(void) {
    if (g_worker) { vTaskSuspend(g_worker); }     /* 暂停：保留栈与状态 */
}
void m12_resume(void) {
    if (g_worker) { vTaskResume(g_worker); }
}
void m12_destroy(void) {
    if (g_worker) {
        vTaskDelete(g_worker);                    /* 确保它不再持有 g_lock */
        g_worker = 0;
    }
}
