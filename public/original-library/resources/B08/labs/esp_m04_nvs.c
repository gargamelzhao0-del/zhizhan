/* esp_m04_nvs.c —— ESP32 用 NVS 持久化（Xtensa）。
 * NVS 自带磨损均衡与掉电安全；写入后必须 commit 才落盘。 */
#include "esp_app.h"
#include "app_api.h"

int esp_store_sample(uint16_t v) {
    nvs_handle_t h;
    if (nvs_open("log", 1, &h) != ESP_OK) return -1;
    if (nvs_set_u16(h, "s", v) != ESP_OK) return -2;
    return (int)nvs_commit(h);
}
