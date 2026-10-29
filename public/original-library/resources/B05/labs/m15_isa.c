/* m15_isa.c — B05-M15 指令集与调用约定（STM32F103 / Cortex-M3，Thumb-2）
 * 供反汇编观察：AAPCS 下参数走 r0..r3、返回 r0；-Os 会生成 Thumb-2 混合宽度指令。 */
#include "stm32f103_regs.h"

/* 一条 C 语句如何落到指令：这里用 objdump 看到 mul/umull + add */
int isa_add_mul(int a, int b, int c) { return a + b * c; }

uint32_t isa_pack(uint16_t hi, uint16_t lo) { return ((uint32_t)hi << 16) | lo; }

/* 向量表重定位（bootloader / OTA 的基础；也是“中断跑飞”的常见原因） */
void isa_relocate_vectors(const void *table)
{
    SCB_VTOR = (uint32_t)(uintptr_t)table;
    b05_dsb();
    b05_isb();
}

/* 原子读改写之外：读取当前栈指针，理解 MSP/PSP 与调用约定 */
uint32_t isa_read_sp(void)
{
    uint32_t sp;
    __asm volatile ("mov %0, sp" : "=r"(sp));
    return sp;
}
