/* esp_m21_ota.c — B05-M21 OTA / 网络升级与回滚（ESP32 原生 A/B 分区）
 * 流程：写新固件到备用分区 → 校验 → 切启动分区 → 重启；新固件首次启动若不自证，可回滚。 */
#include <stdint.h>

typedef int esp_err_t;
typedef void *esp_ota_handle_t;
typedef void *esp_partition_t;

extern const esp_partition_t *esp_ota_get_next_update_partition(const void *start);
extern esp_err_t esp_ota_begin(const esp_partition_t *p, unsigned image_size, esp_ota_handle_t *out);
extern esp_err_t esp_ota_write(esp_ota_handle_t h, const void *data, unsigned size);
extern esp_err_t esp_ota_end(esp_ota_handle_t h);
extern esp_err_t esp_ota_set_boot_partition(const esp_partition_t *p);
extern esp_err_t esp_ota_mark_app_valid_cancel_rollback(void);
extern esp_err_t esp_ota_mark_app_invalid_rollback_and_reboot(void);

/* 分块写：每块都要检查返回值；中途断电，下次重新开始（备用分区不生效） */
int esp_ota_apply(const uint8_t *image, unsigned len, unsigned chunk)
{
    const esp_partition_t *target = esp_ota_get_next_update_partition((void *)0);
    if (target == (void *)0) { return -1; }
    esp_ota_handle_t h = (void *)0;
    if (esp_ota_begin(target, len, &h) != 0) { return -2; }
    for (unsigned off = 0; off < len; off += chunk) {
        unsigned n = (len - off < chunk) ? (len - off) : chunk;
        if (esp_ota_write(h, image + off, n) != 0) { return -3; }   /* 写入失败需中止 */
    }
    if (esp_ota_end(h) != 0) { return -4; }          /* 校验镜像 */
    if (esp_ota_set_boot_partition(target) != 0) { return -5; }
    return 0;                                        /* 返回后重启即运行新固件 */
}

/* 新固件启动并联网自检通过后调用：确认本次升级，取消回滚 */
int esp_ota_confirm(void) { return esp_ota_mark_app_valid_cancel_rollback(); }
