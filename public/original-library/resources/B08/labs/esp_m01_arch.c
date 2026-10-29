/* esp_m01_arch.c —— 任务化架构（ESP32 / Xtensa）。
 * 每个模块一个任务，用亲和把“采集”和“通信”分到不同核，接口仍是 {init, task}。 */
#include "esp_app.h"
#include "app_api.h"

/* 由外部提供：界面刷新（示例） */
int ui_refresh(void);

static void sensor_task(void *arg) { (void)arg; for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); } }
static void ui_task(void *arg)     { (void)arg; for (;;) { (void)ui_refresh(); vTaskDelay(pdMS_TO_TICKS(50)); } }
static void comm_task(void *arg)   { (void)arg; for (;;) { vTaskDelay(pdMS_TO_TICKS(1000)); } }

void esp_arch_start(void) {
    TaskHandle_t a = 0, b = 0;
    (void)xTaskCreatePinnedToCore(sensor_task, "sensor", 4096u, 0, 4u, &a, 0);
    (void)xTaskCreatePinnedToCore(ui_task,     "ui",     4096u, 0, 3u, &b, 1);
    (void)xTaskCreatePinnedToCore(comm_task,   "comm",   4096u, 0, 2u, &a, 1);
}
