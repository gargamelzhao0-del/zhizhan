/* esp_m13_params.c —— ESP32 参数持久化（NVS blob + 版本）（Xtensa）。 */
#include "esp_app.h"

int esp_params_save(const void *p, size_t n) {
    nvs_handle_t h;
    if (nvs_open("cfg", 1, &h) != ESP_OK) return -1;
    if (nvs_set_blob(h, "p", p, n) != ESP_OK) return -2;
    return (int)nvs_commit(h);
}

int esp_params_load(void *p, size_t *n) {
    nvs_handle_t h;
    if (nvs_open("cfg", 1, &h) != ESP_OK) return -1;
    return (int)nvs_get_blob(h, "p", p, n);
}
