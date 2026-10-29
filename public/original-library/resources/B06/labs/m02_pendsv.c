/* m02_pendsv.c —— 上下文切换发生在 PendSV（Cortex-M3）。
 * 关键点：PendSV 设为最低优先级，保证所有中断处理完后才切换；
 * 硬件已自动压栈 r0-r3/r12/lr/pc/xPSR，端口层只需保存 r4-r11 并切换 PSP。 */
#include <stdint.h>
#include "rtos_cm.h"

typedef struct { uint32_t *sp; } tcb_t;    /* 这里只留栈指针，够讲清切换 */
tcb_t * volatile pxCurrent = 0;            /* 当前任务 */
tcb_t * volatile pxNext    = 0;            /* 下一个任务 */

__attribute__((naked)) void PendSV_Handler(void) {
    __asm volatile(
        ".syntax unified\n"
        "mrs   r0, psp\n"
        "isb\n"
        "stmdb r0!, {r4-r11}\n"        /* 保存被调者保存寄存器 */
        "ldr   r1, =pxCurrent\n"
        "ldr   r2, [r1]\n"
        "str   r0, [r2]\n"             /* pxCurrent->sp = r0 */
        "ldr   r3, =pxNext\n"
        "ldr   r2, [r3]\n"
        "str   r2, [r1]\n"             /* pxCurrent = pxNext */
        "ldr   r0, [r2]\n"             /* r0 = pxNext->sp */
        "ldmia r0!, {r4-r11}\n"
        "msr   psp, r0\n"
        "isb\n"
        "bx    lr\n");
}

/* SysTick 每 tick 选出下一个任务，然后挂起 PendSV 让切换在最低优先级发生 */
void SysTick_Handler(void) {
    pxNext = pxCurrent;
    cm_pend_pendsv();
}
