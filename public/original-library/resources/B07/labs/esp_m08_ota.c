/* esp_m08_ota.c —— ESP32 原生 OTA（Xtensa）。
 * 写备用分区 → 校验 → 设置启动分区；启动后未调用 mark_valid 会触发回滚。 */
#include "esp_comm.h"

int esp_ota_apply(const uint8_t *img, size_t n) {
    esp_ota_handle_t h;
    const esp_partition_t *p = esp_ota_get_next_update_partition(0);
    if (!p) return -1;
    if (esp_ota_begin(p, n, &h) != ESP_OK) return -2;
    if (esp_ota_write(h, img, n) != ESP_OK) return -3;
    if (esp_ota_end(h) != ESP_OK) return -4;
    if (esp_ota_set_boot_partition(p) != ESP_OK) return -5;
    return 0;
}

void esp_ota_confirm(void) { (void)esp_ota_mark_app_valid_cancel_rollback(); }
void esp_ota_reject(void)  { (void)esp_ota_mark_app_invalid_rollback_and_reboot(); }
