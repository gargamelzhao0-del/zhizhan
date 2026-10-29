/* esp_m04_timer.c — ESP32 PWM：常用 LEDC 硬件 PWM，而非通用定时器比较输出
 * 与 STM32 的“TIMx + CCR 比较”不同，LEDC 有独立的分频与占空比寄存器。 */
#include "esp32_regs.h"

/* ESP-IDF：ledc_setup(channel, freq_hz, resolution_bits) 返回实际频率 */
extern int ledc_setup(int channel, uint32_t freq_hz, int resolution_bits);
extern int ledcAttachPin(int pin, int channel);
extern int ledcWrite(int channel, uint32_t duty);

uint32_t esp_ledc_init(int channel, int pin, uint32_t freq_hz, int bits)
{
    uint32_t real_freq = (uint32_t)ledc_setup(channel, freq_hz, bits);
    (void)ledcAttachPin(pin, channel);
    return real_freq;   /* 注意：实际频率可能与请求值不同，必须回读 */
}

void esp_ledc_duty(int channel, uint32_t duty) { (void)ledcWrite(channel, duty); }

/* 若需精确计时的通用定时器，用 GPTimer（gptimer_new_timer/gptimer_set_alarm_action），
 * 那是另一套 API；LEDC 只负责 PWM。 */
