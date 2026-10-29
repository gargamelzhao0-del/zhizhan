/* esp_m05_adc.c — ESP32 ADC：SAR ADC 由 RTC 控制器管理，需先设衰减获得合适量程
 * 与 STM32 固定 VREF 不同，ESP32 用“衰减档”把量程拉到约 0..3.3V（不同芯片为 ~2.5V）。 */
#include "esp32_regs.h"

typedef enum { ESP_ADC_ATTEN_0DB = 0, ESP_ADC_ATTEN_11DB = 3 } esp_adc_atten_t;

extern int  adc1_config_width(int width_bits);
extern int  adc1_config_channel_atten(int channel, esp_adc_atten_t atten);
extern int  adc1_get_raw(int channel);
extern int  esp_adc_cal_raw_to_voltage(int raw, const void *chars);

int esp_adc1_init(int width_bits)
{
    (void)adc1_config_width(width_bits);                 /* 通常 12 位 */
    return adc1_config_channel_atten(0, ESP_ADC_ATTEN_11DB); /* 通道 0，约 0..3.3V */
}

int esp_adc1_read(void) { return adc1_get_raw(0); }

/* 换算必须带校准：ESP32 的 ADC 非线性明显，IDF 提供 esp_adc_cal 按 eFuse 校准值换算 */
int esp_adc1_read_mv(const void *chars)
{
    return esp_adc_cal_raw_to_voltage(adc1_get_raw(0), chars);
}
