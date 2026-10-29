/* m10_watchdog.c — B05-M10 看门狗与低功耗
 * IWDG 初始化/喂狗 + 复位原因判别 + STOP 低功耗。 */
#include "stm32f103_regs.h"

#define SCB_SCR  R32(0xE000ED10u)
#define SCB_SCR_SLEEPDEEP (1u << 2)

/* LSI≈40kHz，PR=/64 → 计数 625Hz；reload 12 位上限 4095 → 最长约 6.55 s */
void iwdg_init(uint16_t reload)
{
    IWDG_KR = IWDG_KEY_ENABLE;          /* 解锁 PR/RLR 写保护 */
    IWDG_PR = 4u;                       /* 预分频 /64 */
    while (IWDG_SR & IWDG_SR_PVU) {     /* 等预分频更新完成 */
    }
    IWDG_RLR = reload;
    while (IWDG_SR & IWDG_SR_RVU) {     /* 等重装值更新完成（漏了 RVU 会写入无效） */
    }
    IWDG_KR = IWDG_KEY_RELOAD;
    IWDG_KR = IWDG_KEY_START;           /* 启动后无法关闭，只能复位 */
}

void iwdg_feed(void) { IWDG_KR = IWDG_KEY_RELOAD; }

/* 复位原因：RCC_CSR 的位号容易记错，这里逐位核对（bit31..26 与 RMVF=bit24） */
const char *reset_cause_str(void)
{
    uint32_t csr = RCC_CSR;
    const char *s;
    if      (csr & RCC_CSR_IWDGRSTF) s = "独立看门狗";
    else if (csr & RCC_CSR_WWDGRSTF) s = "窗口看门狗";
    else if (csr & RCC_CSR_SFTRSTF)  s = "软件复位";
    else if (csr & RCC_CSR_PORRSTF)  s = "上电/掉电复位";
    else if (csr & RCC_CSR_PINRSTF)  s = "外部 NRST";
    else if (csr & RCC_CSR_LPWRRSTF) s = "低功耗复位";
    else                             s = "未知";
    RCC_CSR |= RCC_CSR_RMVF;            /* 写 1 清全部标志，避免跨复位残留误判 */
    return s;
}

/* 进入 STOP：保留 SRAM，唤醒后继续；唤醒源可为 EXTI 中断 */
void enter_stop_mode(void)
{
    PWR_CR |= PWR_CR_CWUF;                 /* 清唤醒标志 */
    PWR_CR &= ~PWR_CR_PDDS;                /* STOP（非 STANDBY） */
    PWR_CR |= PWR_CR_LPDS;                 /* 深度睡眠时稳压器低功耗 */
    SCB_SCR |= SCB_SCR_SLEEPDEEP;          /* 选择深度睡眠 */
    __asm volatile ("wfi");
    SCB_SCR &= ~SCB_SCR_SLEEPDEEP;
    PWR_CR &= ~PWR_CR_LPDS;
}

/* 在 STOP 前把现场写入备份寄存器（需先开 PWR/BKP 时钟并解锁 DBP） */
void backup_marker_write(uint32_t marker)
{
    RCC_APB1ENR |= RCC_APB1ENR_PWREN | RCC_APB1ENR_BKPEN;
    PWR_CR |= PWR_CR_DBP;                  /* 解锁备份域写保护 */
    BKP_DR1 = marker;
    b05_dsb();
}
