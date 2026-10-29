/* esp_m07_timer.c —— 深度睡眠与定时唤醒（ESP32 / Xtensa）。
 * 深度睡眠会丢失内存状态，唤醒等价于一次复位；睡眠前必须先保存关键状态。 */
#include <stdint.h>
#include "esp_idf_api.h"

void esp_sleep_until(uint64_t microseconds) {
    esp_sleep_enable_timer_wakeup(microseconds);
    esp_deep_sleep_start();            /* 不返回；唤醒后从复位向量重新开始 */
}
