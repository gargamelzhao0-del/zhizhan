/* esp_m16_io.c — B05-M16 输入输出电气类型（ESP32）
 * ESP32 有 2 路 8 位 DAC、LEDC PWM、触摸/ADC 输入；GPIO 开漏用 IO_MUX。 */
#include "esp32_regs.h"

typedef enum { ESP_DAC_CH1 = 0, ESP_DAC_CH2 = 1 } esp_dac_ch_t;
extern int dac_output_enable(esp_dac_ch_t ch);
extern int dac_output_voltage(esp_dac_ch_t ch, uint8_t value);   /* 0..255 */
extern int dac_output_disable(esp_dac_ch_t ch);

int esp_dac_init(esp_dac_ch_t ch) { return dac_output_enable(ch); }

/* 8 位 DAC：0..255 → 0..VDD（与 STM32 的 12 位不同，量程/分辨率都要换算） */
int esp_dac_set(esp_dac_ch_t ch, uint8_t code) { return dac_output_voltage(ch, code); }

/* 开漏输出：IO_MUX 里选功能，输出类型由外设/矩阵决定；这里给出 GPIO 使能 */
void esp_gpio_out_enable(uint32_t pin) { GPIO_ENABLE_W1TS = (1u << pin); }
