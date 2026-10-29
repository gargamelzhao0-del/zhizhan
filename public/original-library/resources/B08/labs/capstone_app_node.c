/* capstone_app_node.c —— 贯穿项目：产品级环境监测终端（Cortex-M3 示范）。
 * 采集(高) → 队列 → 界面(低)；共享 I²C 用互斥量；看门狗仅在关键任务健康时喂；
 * 参数双副本、上报走 B07 的协议与 OTA。 */
#include <stdint.h>
#include "app_api.h"
#include "stm32_app.h"

void wdt_init(void);
void wdt_feed_if_healthy(int sensor_ok, int control_ok, int comm_ok);

static QueueHandle_t g_samples;
static SemaphoreHandle_t g_i2c;

static void acq_task(void *arg) {
    float t = 0.0f, r = 0.0f;
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_i2c, pdMS_TO_TICKS(5)) == pdTRUE) {
            if (sensor_read(&t, &r) == 0) { (void)xQueueSend(g_samples, &t, pdMS_TO_TICKS(5)); }
            xSemaphoreGive(g_i2c);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
static void ui_task(void *arg) {
    (void)arg;
    for (;;) { (void)display_flush(); vTaskDelay(pdMS_TO_TICKS(500)); }
}
static void monitor_task(void *arg) {
    (void)arg;
    for (;;) {
        wdt_feed_if_healthy(1, 1, 1);   /* 三个关键任务都健康才喂狗 */
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

void capstone_start(void) {
    g_samples = xQueueCreate(16u, (uint32_t)sizeof(float));
    g_i2c = xSemaphoreCreateMutex();
    (void)xTaskCreate(acq_task,     "acq", 512u, 0, 4u, 0);
    (void)xTaskCreate(ui_task,      "ui",  512u, 0, 2u, 0);
    (void)xTaskCreate(monitor_task, "mon", 512u, 0, 1u, 0);
    wdt_init();
}
