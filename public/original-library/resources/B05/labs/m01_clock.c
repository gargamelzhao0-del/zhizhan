/* m01_clock.c — B05-M01 时钟树与启动
 * HSE 8 MHz → PLL ×9 → SYSCLK 72 MHz；SysTick 1 ms；MCO 输出验证。
 * 编译：arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -ffreestanding -Wall -Wextra -c
 * 目标板频率测量需上板（示波器/频率计读 MCO），正文如实标注。 */
#include "stm32f103_regs.h"

volatile uint32_t g_systick_ms;

/* 带超时的 HSE 起振等待：晶体坏/虚焊时不能死等，否则整机卡在启动 */
static int hse_ready(void)
{
    return (RCC_CR & RCC_CR_HSERDY) != 0u;
}

uint32_t clock_init_72m(void)
{
    /* 1) 使能 HSE（8 MHz 晶振，最常见的外部时钟源） */
    RCC_CR |= RCC_CR_HSEON;
    for (uint32_t i = 0u; i < 0x20000u && !hse_ready(); ++i) {
        /* 空转等待；真实工程这里改为计数 + 失败回退 */
    }
    if (!hse_ready()) {
        return 0u; /* 起振失败：由调用者决定回退 HSI，而不是继续跑 */
    }

    /* 2) Flash 等待周期：72 MHz 需 2 个等待周期（RM0008 FLASH_ACR.LATENCY） */
    R32(FLASH_BASE + 0x00u) = (1u << 4) | (2u << 0); /* PRFTBE=1, LATENCY=2 */

    /* 3) 总线分频：HPRE=/1、PPRE1=/2（APB1 ≤ 36 MHz）、PPRE2=/1（APB2 = 72 MHz） */
    RCC_CFGR = (0u << 4) | (4u << 8) | (0u << 11);

    /* 4) PLL：HSE 不分频作输入，倍频 ×9（PLLMUL=0111） */
    RCC_CFGR = (RCC_CFGR & ~((0xFu << 18) | RCC_CFGR_PLLSRC | RCC_CFGR_PLLXTPRE))
             | RCC_CFGR_PLLSRC | (7u << 18);
    RCC_CR |= RCC_CR_PLLON;
    while ((RCC_CR & RCC_CR_PLLRDY) == 0u) {
    }

    /* 5) 切换 SYSCLK 到 PLL，并等待 SWS 确认 */
    RCC_CFGR = (RCC_CFGR & ~RCC_CFGR_SW) | 0x2u;
    while ((RCC_CFGR & RCC_CFGR_SWS) != (0x2u << 2)) {
    }
    return 72000000u;
}

void systick_init_1ms(uint32_t sysclk_hz)
{
    SYST_RVR = sysclk_hz / 1000u - 1u;
    SYST_CVR = 0u;
    SYST_CSR = SYST_CSR_CLKSOURCE | SYST_CSR_TICKINT | SYST_CSR_ENABLE;
}

void SysTick_Handler(void)
{
    g_systick_ms++;
}

/* MCO 输出：MCO 引脚受 GPIO 输出能力限制（F1 引脚最高 50 MHz），
 * 不能直接输出 72 MHz，因此选 PLL/2 = 36 MHz（MCO[2:0]=111）验证 PLL 是否锁定。 */
void mco_output_pa8(void)
{
    RCC_APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_AFIOEN;
    GPIOA->CRH = (GPIOA->CRH & ~(0xFu << 0))
               | ((uint32_t)GPIO_CNF_AF_PP << 2)
               | (uint32_t)GPIO_MODE_OUT_50M;                 /* PA8 复用推挽 */
    RCC_CFGR = (RCC_CFGR & ~(0x7u << 24)) | (0x7u << 24);    /* MCO = PLL/2 */
}

uint32_t clock_now_mhz(void)
{
    switch (RCC_CFGR & RCC_CFGR_SWS) {
    case (0x0u << 2): return 8u;   /* HSI */
    case (0x1u << 2): return 8u;   /* HSE 直连 */
    case (0x2u << 2): return 72u;  /* PLL */
    default:          return 0u;
    }
}
