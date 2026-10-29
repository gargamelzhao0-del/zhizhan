/* m07_bootloader.c —— 从 Bootloader 跳转到 App（Cortex-M3）。
 * 顺序关键：校验栈指针 → 关中断 → 重定位向量表(VTOR) → 屏障 → 设 MSP → 跳转。 */
#include <stdint.h>
#include "comm_api.h"
#include "rtos_cm.h"

#define APP_BASE 0x08008000u
typedef void (*app_entry_t)(void);

int jump_to_app(void) {
    uint32_t sp = *(volatile uint32_t *)APP_BASE;
    uint32_t pc = *(volatile uint32_t *)(APP_BASE + 4u);
    if ((sp & 0x2FFE0000u) != 0x20000000u) return -1;   /* 栈指针必须落在 SRAM */
    cm_set_primask(1u);                                 /* 关所有可屏蔽中断 */
    CM_VTOR = APP_BASE;                                 /* App 的向量表在 App 区开头 */
    cm_dsb();
    cm_isb();
    __asm volatile ("msr msp, %0" :: "r"(sp) :);        /* 切到 App 的栈 */
    ((app_entry_t)pc)();                                /* 跳转，不返回 */
    return 0;
}
