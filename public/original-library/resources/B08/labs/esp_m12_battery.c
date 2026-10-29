/* esp_m12_battery.c —— ESP32 低功耗电池设备（Xtensa）。
 * 深睡眠 + 定时唤醒；醒来读电池与传感器、上报一次后立刻回睡。 */
#include "esp_app.h"
#include "app_api.h"

void esp_battery_cycle(uint32_t awake_ms) {
    (void)esp_wifi_sta_get_rssi();                       /* 上报前确认链路 */
    (void)power_set_mode(2);
    (void)esp_sleep_enable_timer_wakeup((uint64_t)awake_ms * 1000u);
    esp_deep_sleep_start();
}
