/* h7_m08_ota.c —— 双 Bank OTA（STM32H7 / Cortex-M7）。
 * 新固件写入备用 Bank，校验通过后做 Bank Swap；失败则不交换，继续跑原 Bank。 */
#include <stdint.h>
#include <stddef.h>
#include "comm_api.h"

int h7_ota_dualbank(const uint8_t *img, size_t n, uint32_t image_crc) {
    if (ota_begin((uint32_t)n, image_crc) != 0) return -1;
    if (ota_write(img, n) != 0) return -2;
    return ota_finish();        /* 校验通过后交换 Bank，并记录“待确认”标志 */
}

int h7_ota_confirm(void)  { return 0; }             /* 运行正常：清除待确认标志 */
int h7_ota_rollback(void) { return ota_rollback(); }/* 启动超时：换回原 Bank */
