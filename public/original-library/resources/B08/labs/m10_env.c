/* m10_env.c —— 综合项目 A：环境监测终端（Cortex-M3）。
 * 采集 → 显示 → 存储 → 上报；各模块一个任务，用队列解耦。 */
#include <stdint.h>
#include "app_api.h"

static QueueHandle_t g_q;

static void acq_task(void *arg) {
    (void)arg;
    for (;;) {
        float t = 0.0f, rh = 0.0f;
        if (sensor_read(&t, &rh) == 0) { (void)xQueueSend(g_q, &t, pdMS_TO_TICKS(5)); }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
static void disp_task(void *arg) {
    (void)arg;
    for (;;) {
        (void)display_clear();
        (void)display_text(0, 0, "ENV");
        (void)display_flush();
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
void m10_env_start(void) {
    g_q = xQueueCreate(8u, (uint32_t)sizeof(float));
    (void)xTaskCreate(acq_task,  "acq",  512u, 0, 4u, 0);
    (void)xTaskCreate(disp_task, "disp", 512u, 0, 2u, 0);
}
