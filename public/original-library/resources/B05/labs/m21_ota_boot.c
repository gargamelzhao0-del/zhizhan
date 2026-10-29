/* m21_ota_boot.c — B05-M21 OTA（STM32F103 自研 Bootloader：校验 + 跳转 + 回滚标志） */
#include "stm32f103_regs.h"

#define APP_BASE 0x08004000u          /* App 从 16KB 处开始，Bootloader 占前 16KB */
typedef void (*app_entry_t)(void);

/* CRC32（与 App 端一致）；用于判断镜像完整，避免跳到半包 */
uint32_t crc32_bytes(const uint8_t *p, uint32_t n)
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

/* 校验 App：栈顶必须落在 SRAM、复位向量必须落在 Flash 的 App 区 */
int ota_boot_validate(uint32_t app_base)
{
    uint32_t sp = *(volatile uint32_t *)app_base;
    uint32_t pc = *(volatile uint32_t *)(app_base + 4u);
    if (sp < 0x20000000u || sp > 0x20010000u) { return -1; }
    if (pc < app_base || pc > 0x08040000u) { return -2; }
    return 0;
}

void ota_boot_jump(uint32_t app_base)
{
    uint32_t sp = *(volatile uint32_t *)app_base;
    uint32_t pc = *(volatile uint32_t *)(app_base + 4u);
    /* 跳转前必须关中断并（真实工程里）复位外设/清挂起，避免 App 启动瞬间被旧中断打断 */
    __asm volatile ("cpsid i" ::: "memory");
    SCB_VTOR = app_base;                       /* App 的向量表 */
    b05_dsb(); b05_isb();
    __asm volatile ("msr msp, %0" :: "r"(sp)); /* 先设栈顶 */
    ((app_entry_t)pc)();                       /* 再跳复位向量 */
}

/* 升级请求标志：由 App 写入备份寄存器，Bootloader 读后决定是否进入升级 */
void ota_request_upgrade(uint32_t token) { BKP_DR1 = token; }
int  ota_upgrade_pending(void) { return BKP_DR1 == 0x5AA50F0Fu; }
void ota_clear_upgrade(void) { BKP_DR1 = 0u; }
