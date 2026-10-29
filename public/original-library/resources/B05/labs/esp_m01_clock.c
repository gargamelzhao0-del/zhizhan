/* esp_m01_clock.c — ESP32 时钟：XTAL 40MHz → PLL → CPU 240MHz，APB 80MHz
 * 与 STM32 不同：ESP32 的外设时钟大多“复位默认已开”，只有部分需 DPORT 级门控。 */
#include "esp32_regs.h"

extern uint32_t esp_clk_cpu_freq(void);   /* ESP-IDF 提供 */
extern uint32_t esp_clk_apb_freq(void);

uint32_t esp_cpu_mhz(void) { return esp_clk_cpu_freq() / 1000000u; }
uint32_t esp_apb_mhz(void) { return esp_clk_apb_freq() / 1000000u; }

/* 按位使能外设时钟（DPORT），并用 memw 保证顺序——这是 Xtensa 的屏障 */
void esp_periph_enable_bit(uint32_t bit)
{
    DPORT_PERIP_CLK_EN_REG |= (1u << bit);
    esp_memw();
}

/* CPU 频率可在 80/160/240MHz 间切换，并影响功耗与实时性（对比 STM32 的固定 PLL 档） */
extern int esp_pm_configure(const void *cfg);
int esp_power_set(void) { return esp_pm_configure((const void *)0); }
