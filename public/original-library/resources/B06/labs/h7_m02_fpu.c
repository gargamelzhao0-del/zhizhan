/* h7_m02_fpu.c —— Cortex-M7 的 FPU 上下文（lazy stacking）。
 * 只有真正用过 FPU 的任务才需要保存 S0-S15；端口层按需 vpush/vpop，
 * 不用浮点的任务不为 FPU 付切换成本。 */
#include <stdint.h>
#include "rtos_cm.h"

volatile uint32_t h7_fpu_ready = 0u;

void h7_fpu_init(void) {
    (*(volatile uint32_t *)0xE000ED88u) |= (0xFu << 20);   /* CPACR：使能 CP10/CP11 */
    cm_dsb();
    cm_isb();
    h7_fpu_ready = 1u;
}

void h7_fpu_context_save(void)    { cm_fpu_save(); }
void h7_fpu_context_restore(void) { cm_fpu_restore(); }
