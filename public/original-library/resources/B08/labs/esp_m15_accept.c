/* esp_m15_accept.c —— ESP32 验收：运行时间与自检（Xtensa）。 */
#include "esp_app.h"
#include "app_api.h"

int esp_accept_selftest(void) {
    float t = 0.0f, r = 0.0f;
    if (esp_timer_get_time() < 0) return -1;      /* 时基异常 */
    if (sensor_read(&t, &r) != 0) return -2;      /* 传感器自检 */
    return 0;
}
