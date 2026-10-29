/* h7_m10_watchdog.c — STM32H7 看门狗与低功耗：IWDG 寄存器与 F1 相同，低功耗分域不同
 * H7 有 D1/D2/D3 与 DSTANDBY/SRDSB1 等位，STOP/STANDBY 的保留范围比 F1 复杂。 */
#include "stm32h7_regs.h"

#define H7_IWDG_BASE 0x58004800u
#define H7_IWDG_KR   R32(H7_IWDG_BASE + 0x00u)
#define H7_IWDG_PR   R32(H7_IWDG_BASE + 0x04u)
#define H7_IWDG_RLR  R32(H7_IWDG_BASE + 0x08u)
#define H7_IWDG_SR   R32(H7_IWDG_BASE + 0x0Cu)
#define H7_PWR_CPUCR R32(0x58024810u)

void h7_iwdg_init(uint16_t reload)
{
    H7_IWDG_KR = 0x5555u;                    /* 解锁 */
    H7_IWDG_PR = 4u;                         /* /64 */
    while (H7_IWDG_SR & (1u << 0)) { }       /* PVU */
    H7_IWDG_RLR = reload;
    while (H7_IWDG_SR & (1u << 1)) { }       /* RVU */
    H7_IWDG_KR = 0xAAAAu;                    /* 重装 */
    H7_IWDG_KR = 0xCCCCu;                    /* 启动 */
}

void h7_iwdg_feed(void) { H7_IWDG_KR = 0xAAAAu; }

/* 复位原因：H7 在 RCC_RSR（与 F1 的 RCC_CSR 不同），位义也不同 */
uint32_t h7_reset_flags(void) { return R32(0x58024484u); }   /* RCC_RSR */

/* 进入 D1/D2 STOP：CPUCR 置 PDDS_D1/D2 等（此处示意，完整序列见 RM0433） */
void h7_enter_stop(void)
{
    H7_PWR_CPUCR |= (1u << 0);               /* PDDS_D1 */
    __asm volatile ("wfi");
}
