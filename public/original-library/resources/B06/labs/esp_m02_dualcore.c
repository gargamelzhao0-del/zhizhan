/* esp_m02_dualcore.c —— 双核：把任务固定到指定核（ESP32 / Xtensa LX6）。
 * ESP32 有 2 个核，xTaskCreatePinnedToCore 的最后参数就是亲和核。 */
#include "esp_idf_api.h"
#include "rtos_api.h"

static void worker(void *arg) {
    (void)arg;
    for (;;) { vTaskDelay(pdMS_TO_TICKS(10)); }
}

void esp_m02_pin_cores(void) {
    TaskHandle_t a = 0, b = 0;
    (void)xTaskCreatePinnedToCore(worker, "acq",  4096u, 0, 3u, &a, 0);  /* 核 0：采集 */
    (void)xTaskCreatePinnedToCore(worker, "link", 4096u, 0, 3u, &b, 1);  /* 核 1：通信 */
}

/* 当前任务运行在哪个核（用于确认亲和是否生效） */
BaseType_t esp_m02_where(void) { return xPortGetCoreID(); }
