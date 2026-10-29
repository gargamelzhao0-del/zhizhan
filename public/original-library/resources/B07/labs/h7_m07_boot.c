/* h7_m07_boot.c —— H7 跳转到 App（Cortex-M7）。
 * 除向量表/栈外，还要在跳转前关闭 I/D-Cache，避免与 App 的 cache 配置冲突。 */
#include <stdint.h>
#include "comm_api.h"
#include "rtos_cm.h"

#define SCB_CCR (*(volatile uint32_t *)0xE000ED14u)

void h7_jump_to_app(uint32_t base) {
    uint32_t sp = *(volatile uint32_t *)base;
    uint32_t pc = *(volatile uint32_t *)(base + 4u);
    cm_set_primask(1u);                                 /* 关中断 */
    SCB_CCR &= ~((1u << 16) | (1u << 17));              /* 关 D-Cache / I-Cache */
    CM_VTOR = base;                                     /* 重定位向量表 */
    cm_dsb();
    cm_isb();
    __asm volatile ("msr msp, %0" :: "r"(sp) :);
    ((void (*)(void))pc)();                             /* 跳转，不返回 */
}
