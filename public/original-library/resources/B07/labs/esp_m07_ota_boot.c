/* esp_m07_ota_boot.c —— 选择下一次启动分区（ESP32 / Xtensa）。
 * ESP32 无传统 Bootloader 跳转代码：用分区表 + esp_ota_set_boot_partition。 */
#include "esp_comm.h"

int esp_boot_set_next(void) {
    const esp_partition_t *next = esp_ota_get_next_update_partition(0);
    if (!next) return -1;
    return (int)esp_ota_set_boot_partition(next);
}
