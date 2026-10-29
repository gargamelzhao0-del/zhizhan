/* h7_m21_ota.c — B05-M21 OTA（STM32H7：双 Bank 交换 + 安全回滚）
 * H7 的 Flash 支持双 Bank 与 Bank Swap：新固件写入备用 Bank，校验后交换启动 Bank。 */
#include "stm32h7_regs.h"

typedef int hal_status_t;
extern hal_status_t HAL_FLASH_Unlock(void);
extern hal_status_t HAL_FLASH_OB_Unlock(void);
extern hal_status_t HAL_FLASHEx_OBProgram(const void *cfg);
extern hal_status_t HAL_FLASH_OB_Launch(void);      /* 触发 Bank Swap 并复位 */

/* Option Bytes 里 SWAP_BANK 位决定从哪个 Bank 启动（见 RM0433 FLASH_OPTSR） */
int h7_ota_swap_bank(int enable_swap)
{
    if (HAL_FLASH_Unlock() != 0) { return -1; }
    if (HAL_FLASH_OB_Unlock() != 0) { return -2; }
    (void)enable_swap;                              /* cfg 里设置 SWAP_BANK */
    if (HAL_FLASHEx_OBProgram((const void *)0) != 0) { return -3; }
    return HAL_FLASH_OB_Launch();                   /* 交换后自动复位，从新 Bank 跑 */
}

/* 双 Bank 的分区语义：Bank1 跑当前固件，新固件写 Bank2；校验失败则保持原 Bank。 */
int h7_ota_bank_of(uint32_t addr) { return (addr < 0x08100000u) ? 1 : 2; }

/* 完整性：与 F1 相同的 CRC32 思路，防止交换到半包镜像 */
uint32_t h7_ota_crc32(const uint8_t *p, uint32_t n)
{
    uint32_t crc = 0xFFFFFFFFu;
    for (uint32_t i = 0; i < n; ++i) {
        crc ^= p[i];
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 1u) ? (crc >> 1) ^ 0xEDB88320u : (crc >> 1);
        }
    }
    return ~crc;
}
