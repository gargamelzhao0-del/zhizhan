/* h7_m01_boot.c —— 启动 RTOS 前必须完成的配置（STM32H7 / Cortex-M7）。
 * 顺序很重要：开 FPU → 装时基 → 设中断优先级阈值 → 再启动调度器。 */
#include <stdint.h>
#include "rtos_cm.h"

#define CM_CPACR (*(volatile uint32_t *)0xE000ED88u)   /* 协处理器访问控制：CP10/CP11 开 FPU */

void h7_rtos_clock_init(uint32_t core_hz) {
    CM_CPACR |= (0xFu << 20);                 /* full access：允许 FPU 指令 */
    cm_dsb();
    cm_isb();

    CM_SYST_RVR = (core_hz / 1000u) - 1u;      /* 1kHz 系统节拍 */
    CM_SYST_CVR = 0u;
    CM_SYST_CSR = 0x7u;                        /* ENABLE | TICKINT | CLKSOURCE */

    cm_set_basepri(0x50u);                     /* configMAX_SYSCALL_INTERRUPT_PRIORITY */
}
