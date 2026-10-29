/* h7_m01_clock.c — STM32H7 时钟：HSE→PLL1→SYSCLK，D1/D2/D3 三域分频
 * H7 的 PLL 有 DIVM/DIVN/DIVP，时钟按 D1/D2/D3 域分配，与 F1 的单 PLL 完全不同。
 * 目标 480 MHz（HSE=25MHz：DIVM1=5、DIVN1=192、DIVP1=2 → 5×192/2=480）。 */
#include "stm32h7_regs.h"

uint32_t h7_clock_480m(void)
{
    /* 1) 使能 HSE（HSEON=bit16，HSERDY=bit17，与 F1 相同） */
    H7_RCC_CR |= (1u << 16);
    for (uint32_t i = 0u; i < 0x20000u; ++i) {
        if (H7_RCC_CR & (1u << 17)) { break; }
    }
    if ((H7_RCC_CR & (1u << 17)) == 0u) { return 0u; }   /* 起振失败 */

    /* 2) 关键前置（顺序不能颠倒）：先升压到 VOS0 并设置 Flash 等待周期，
     *    再把任何分频器/开关动到高频，否则切到 480MHz 时取指会出错。
     *    下面两条为示意（真实值按 RM0433 的电压-频率表取）。 */
    R32(0x58024818u) = (3u << 14);   /* PWR_D3CR.VOS = VOS0（示意） */
    R32(0x52002000u) = (2u << 0);    /* FLASH_ACR.LATENCY = 2（示意） */

    /* 3) 总线分频：D1CPRE=/1、HPRE=/1；D2PPRE1=/2（APB1 上限低于 SYSCLK） */
    H7_RCC_D1CFGR = (0u << 0) | (0u << 4);
    H7_RCC_D2CFGR = (4u << 4);

    /* 4) PLL 输入=HSE，DIVM1=5（PLLSRC=10 在 bit[1:0]，DIVM1 在 bit[9:4]） */
    H7_RCC_PLLCKSELR = (2u << 0) | (5u << 4);

    /* 5) DIVN1=192（bit[8:0]）、DIVP1=2（bit[15:9]）；VCO=5×192=960MHz，输出 480MHz */
    H7_RCC_PLL1DIVR = (192u << 0) | (2u << 9);
    H7_RCC_CR |= H7_RCC_CR_PLL1ON;
    while ((H7_RCC_CR & H7_RCC_CR_PLL1RDY) == 0u) {
    }

    /* 6) SYSCLK=PLL1（RCC_CFGR.SW=3），并等 SWS 确认 */
    H7_RCC_CFGR = (H7_RCC_CFGR & ~0x7u) | 3u;
    while (((H7_RCC_CFGR >> 3) & 0x7u) != 3u) {
    }
    return 480000000u;
}

/* H7 的 CPU 有 16KB I-cache / D-cache，默认未开；开启后需注意 DMA 一致性 */
void h7_enable_caches(void)
{
    H7_SCB_CCR |= H7_SCB_CCR_ICACHE | H7_SCB_CCR_DCACHE;
    h7_dsb();
    h7_isb();
}
