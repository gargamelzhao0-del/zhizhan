/* rtos_cm.h —— Cortex-M（M3/M7）内核外设与临界区帮助函数。
 * 只覆盖 RTOS 端口层真正用到的：NVIC/SysTick/ICSR/SHPR/PRIMASK/BASEPRI/FPU/DSB-ISB。
 * 内存映射地址取自 ARMv7-M 架构手册（SCS 区 0xE000E000）。 */
#ifndef RTOS_CM_H
#define RTOS_CM_H

#include <stdint.h>

/* ---- 系统控制空间（SCS）关键寄存器 ---- */
#define CM_ICSR    (*(volatile uint32_t *)0xE000ED04u)   /* 中断控制与状态：PENDSVSET=bit28 */
#define CM_VTOR    (*(volatile uint32_t *)0xE000ED08u)   /* 向量表偏移 */
#define CM_SHPR2   (*(volatile uint32_t *)0xE000ED1Cu)   /* 含 SVCall 优先级 */
#define CM_SHPR3   (*(volatile uint32_t *)0xE000ED20u)   /* 含 PendSV/SysTick 优先级 */
#define CM_SYST_CSR (*(volatile uint32_t *)0xE000E010u)
#define CM_SYST_RVR (*(volatile uint32_t *)0xE000E014u)  /* 重装载值 */
#define CM_SYST_CVR (*(volatile uint32_t *)0xE000E018u)

#define CM_ICSR_PENDSVSET (1u << 28)

/* ---- 内核专用寄存器访问（都是 MRS/MSR/CPS，不是内存映射） ---- */
static inline uint32_t cm_get_primask(void) { uint32_t r; __asm volatile ("mrs %0, primask" : "=r"(r)); return r; }
static inline void     cm_set_primask(uint32_t r) { __asm volatile ("msr primask, %0" :: "r"(r) : "memory"); }
static inline uint32_t cm_get_basepri(void) { uint32_t r; __asm volatile ("mrs %0, basepri" : "=r"(r)); return r; }
static inline void     cm_set_basepri(uint32_t r) { __asm volatile ("msr basepri, %0" :: "r"(r) : "memory"); }
static inline uint32_t cm_get_ipsr(void) { uint32_t r; __asm volatile ("mrs %0, ipsr" : "=r"(r)); return r; }
static inline void     cm_dsb(void) { __asm volatile ("dsb" ::: "memory"); }
static inline void     cm_isb(void) { __asm volatile ("isb" ::: "memory"); }

/* ---- 临界区：用 BASEPRI 只屏蔽“优先级数值 ≥ 阈值”的中断，更紧急的仍可响应 ---- */
static inline uint32_t cm_enter_critical(void) {
    uint32_t saved = cm_get_basepri();
    cm_set_basepri(0x50u);          /* configMAX_SYSCALL_INTERRUPT_PRIORITY 对应的 BASEPRI 值 */
    return saved;
}
static inline void cm_exit_critical(uint32_t saved) { cm_set_basepri(saved); }

/* ---- 触发一次上下文切换（真正的切换在 PendSV 异常里做） ---- */
static inline void cm_pend_pendsv(void) {
    cm_dsb();
    CM_ICSR = CM_ICSR_PENDSVSET;
    cm_isb();
}

/* ---- Cortex-M7：FPU 上下文（S0–S15 + FPSCR）；M3 无 FPU，勿用 ---- */
static inline void cm_fpu_save(void) { __asm volatile ("vpush {s0-s15}" ::: "memory"); }
static inline void cm_fpu_restore(void) { __asm volatile ("vpop {s0-s15}" ::: "memory"); }

#endif /* RTOS_CM_H */
