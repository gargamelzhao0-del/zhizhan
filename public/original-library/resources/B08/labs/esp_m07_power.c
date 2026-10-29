/* esp_m07_power.c —— ESP32 低功耗休眠与定时唤醒（Xtensa）。
 * 深睡眠丢内存，唤醒等价复位；因此睡眠前先把状态写入 NVS/RTC。 */
#include "esp_app.h"
#include "app_api.h"

void esp_sleep_ms(uint32_t ms) {
    (void)power_set_mode(2);                              /* 进入 standby 记账 */
    (void)esp_sleep_enable_timer_wakeup((uint64_t)ms * 1000u);
    esp_deep_sleep_start();                               /* 不返回 */
}
