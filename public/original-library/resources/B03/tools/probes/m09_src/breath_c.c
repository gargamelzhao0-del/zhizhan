/* 定时器 PWM 呼吸灯：同一功能，C 版 */
#include <stdint.h>

void breath_c(volatile uint32_t *arr, uint32_t period) {
    for (uint32_t d = 0; d < period; d++) {
        *arr = d;
        for (volatile uint32_t i = 0; i < period; i++) { }   /* 忙等 */
    }
}
