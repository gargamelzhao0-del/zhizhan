/* h7_m09_compare.c —— 同一块 H7 上三种内核的代码对照（FreeRTOS 侧）。
 *   FreeRTOS : xTaskCreate / xSemaphoreTake / taskENTER_CRITICAL(BASEPRI)
 *   RT-Thread: rt_thread_create / rt_sem_take / rt_enter_critical
 *   Zephyr   : k_thread_create / k_sem_take / irq_lock
 * 语义相近，差别在配置方式（宏/头文件 vs Kconfig/设备树）与调试工具。 */
#include "rtos_api.h"

static SemaphoreHandle_t g_lock;

static void cmp_task(void *arg) {
    (void)arg;
    for (;;) {
        (void)xSemaphoreTake(g_lock, portMAX_DELAY);
        /* 临界区 */
        (void)xSemaphoreGive(g_lock);
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

void h7_m09_compare(void) {
    g_lock = xSemaphoreCreateMutex();
    (void)xTaskCreate(cmp_task, "cmp", 256u, 0, 3u, 0);
}
