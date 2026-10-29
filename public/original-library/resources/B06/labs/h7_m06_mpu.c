/* h7_m06_mpu.c —— 用 MPU 给内核数据/任务栈加保护（STM32H7 / Cortex-M7）。
 * 越界写会触发 MemManage 异常，比“魔数检查”更及时。寄存器布局以 M7 为例（示意）。 */
#include <stdint.h>
#include "rtos_cm.h"

#define MPU_CTRL (*(volatile uint32_t *)0xE000ED94u)
#define MPU_RNR  (*(volatile uint32_t *)0xE000ED98u)
#define MPU_RBAR (*(volatile uint32_t *)0xE000ED9Cu)
#define MPU_RASR (*(volatile uint32_t *)0xE000EDA0u)

void h7_mpu_guard_region(uint32_t base, uint32_t attr) {
    MPU_RNR  = 0u;                 /* 选区域 0 */
    MPU_RBAR = base & 0xFFFFFFE0u; /* 32 字节对齐基址 */
    MPU_RASR = attr;               /* 由调用者给出大小/权限/使能位 */
    MPU_CTRL = 0x5u;               /* ENABLE | PRIVDEFENA */
    cm_dsb();
    cm_isb();
}
