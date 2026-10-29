/* esp_m12_layers.c — 同一“置位 LED”的三种写法（ESP32 版），用于跨平台体积对照 */
#include "esp32_regs.h"

/* 档 1：裸寄存器 */
void esp_led_reg(void) { GPIO_OUT_W1TS = (1u << 2); }

/* 档 2：内联封装（等价零开销） */
static inline void esp_gpio_set(uint32_t bits) { GPIO_OUT_W1TS = bits; }
void esp_led_inline(void) { esp_gpio_set(1u << 2); }

/* 档 3：IDF 驱动（运行期句柄 + 可能的多层校验，换可移植性） */
extern int gpio_set_level(int gpio_num, uint32_t level);
void esp_led_idf(void) { (void)gpio_set_level(2, 1); }

/* 与 STM32 一致的结论：内联封装通常零开销；句柄/驱动层在“运行期不可知”时才有成本，
 * 但 ESP-IDF 的驱动还额外带来跨芯片可移植性与一致性检查。 */
