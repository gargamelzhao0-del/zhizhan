/* rtos_xt.h —— ESP32（Xtensa LX6）特殊寄存器访问与 per-core 临界区帮助。
 * 只覆盖 RTOS 端口层用到的：CCCOUNT 计时、PS 状态、INTENABLE/INT/CLEAR 中断屏蔽、WAITI 休眠。
 * Xtensa 用 RSR/WSR 访问特殊寄存器（对应 Cortex-M 的 MRS/MSR）。 */
#ifndef RTOS_XT_H
#define RTOS_XT_H

#include <stdint.h>

static inline uint32_t xt_rsr_ccount(void) { uint32_t v; __asm__ volatile ("rsr.ccount %0" : "=a"(v)); return v; }
static inline uint32_t xt_rsr_ps(void)     { uint32_t v; __asm__ volatile ("rsr.ps %0"     : "=a"(v)); return v; }
static inline void     xt_wsr_intclear(uint32_t v) { __asm__ volatile ("wsr.intclear %0" :: "a"(v) : "memory"); }
static inline void     xt_waiti(void)      { __asm__ volatile ("waiti 0"); }

/* 读-修改-写 INTENABLE：关掉某些中断源（对应 per-core 临界区） */
static inline uint32_t xt_get_intenable(void) { uint32_t v; __asm__ volatile ("rsr.intenable %0" : "=a"(v)); return v; }
static inline void     xt_set_intenable(uint32_t v) { __asm__ volatile ("wsr.intenable %0" :: "a"(v) : "memory"); }

#endif /* RTOS_XT_H */
