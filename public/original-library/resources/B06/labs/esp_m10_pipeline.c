/* esp_m10_pipeline.c —— 双核流水线（ESP32 / Xtensa）。
 * 采集固定到核 0，通信固定到核 1，减少彼此干扰；中间用队列交接。 */
#include <stdint.h>
#include "esp_idf_api.h"
#include "rtos_api.h"

static QueueHandle_t g_q;

static void acq(void *arg) {
    (void)arg;
    for (;;) {
        int v = 0;
        (void)xQueueSend(g_q, &v, pdMS_TO_TICKS(5));
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
static void link(void *arg) {
    int v;
    (void)arg;
    for (;;) {
        if (xQueueReceive(g_q, &v, portMAX_DELAY) == pdTRUE) { /* 上报 */ }
    }
}
void esp_m10_start(void) {
    TaskHandle_t a = 0, b = 0;
    g_q = xQueueCreate(16u, (uint32_t)sizeof(int));
    (void)xTaskCreatePinnedToCore(acq,  "acq",  4096u, 0, 4u, &a, 0);
    (void)xTaskCreatePinnedToCore(link, "link", 4096u, 0, 3u, &b, 1);
}
