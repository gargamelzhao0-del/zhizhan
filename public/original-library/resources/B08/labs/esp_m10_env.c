/* esp_m10_env.c —— ESP32 综合项目 A：联网 + 上报 + OTA（Xtensa）。 */
#include "esp_app.h"
#include "app_api.h"

static void app_task(void *arg) {
    (void)arg;
    for (;;) {
        (void)esp_wifi_sta_get_rssi();
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void esp_env_start(void) {
    (void)xTaskCreate(app_task, "app", 4096u, 0, 3u, 0);
}
