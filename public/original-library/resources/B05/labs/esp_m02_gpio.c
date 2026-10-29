/* esp_m02_gpio.c — ESP32 GPIO：IO_MUX（电气/功能）+ GPIO Matrix（信号路由）
 * 与 STM32 的“AF 复用号”不同：外设信号要经 GPIO Matrix 交换到引脚。 */
#include "esp32_regs.h"

void esp_gpio2_out_init(void)
{
    GPIO_ENABLE_W1TS = (1u << 2);              /* 使能输出 */
    /* IO_MUX：MCU_SEL=0 选 GPIO 功能；驱动强度用 FUN_DRV（2 位） */
    IO_MUX_GPIO2_REG = (IO_MUX_GPIO2_REG & ~(0x7u << IO_MUX_MCU_SEL_SHIFT))
                     | (0u << IO_MUX_MCU_SEL_SHIFT);
}

/* 写 1 置位/清除，原子；语义与 STM32 的 BSRR 类似 */
void esp_led_on(void)  { GPIO_OUT_W1TS = (1u << 2); }
void esp_led_off(void) { GPIO_OUT_W1TC = (1u << 2); }

int esp_button_pressed(void) { return (GPIO_IN_REG & (1u << 0)) == 0u; }

/* 注意：GPIO34-39 只能输入、没有内部上下拉；GPIO16/17 在 WROVER 上被 PSRAM 占用。
 * 这些限制与 STM32 的“PC13/14/15 限 2MHz”一样，属于必须记住的引脚约束。 */
