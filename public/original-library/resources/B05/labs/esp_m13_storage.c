/* esp_m13_storage.c — ESP32 存储：分区表 + NVS/SPIFFS/LittleFS
 * 与 STM32 直接擦写 Flash 不同，ESP32 把 Flash 划分成多个分区，各挂不同文件系统。 */
#include <stdint.h>
#include <stddef.h>

/* partitions.csv 里定义分区，例如：
 *   nvs,      data, nvs,     0x9000,  0x6000
 *   spiffs,   data, spiffs,  0x10000, 0x100000
 * 应用用 esp_partition_find_first 找到分区，再挂载文件系统。 */
typedef int esp_err_t;
typedef struct {
    int      (*read)(uint32_t offset, void *buf, uint32_t len);
    esp_err_t (*write)(uint32_t offset, const void *buf, uint32_t len);
    esp_err_t (*erase_range)(uint32_t offset, uint32_t len);
} esp_partition_t;

extern esp_err_t nvs_flash_init(void);
extern esp_err_t esp_vfs_spiffs_register(const void *cfg);   /* 或 esp_littlefs 挂载 */

/* 键值参数用 NVS（内部自带磨损均衡与掉电安全）；大文件用 SPIFFS/LittleFS 分区 */
esp_err_t esp_storage_init(void)
{
    esp_err_t a = nvs_flash_init();
    if (a != 0) { return a; }
    return esp_vfs_spiffs_register((const void *)0);
}

/* 追加日志的提交语义与 STM32/H7 相同：擦除态→提交魔数（只清位）。
 * ESP32 的 NVS 已经把这一步封装好了，多数场景不必自己写。 */
int esp_log_commit(uint16_t *valid_word)
{
    if (valid_word == NULL || *valid_word != 0xFFFFu) { return -1; }
    *valid_word = 0xA5A5u;
    return 0;
}
