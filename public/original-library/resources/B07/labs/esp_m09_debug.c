/* esp_m09_debug.c —— ESP32 链路诊断（Xtensa）。
 * WiFi 看 RSSI 与断连事件；配合 idf.py monitor 的日志与抓包定位问题。 */
#include "esp_comm.h"

int esp_link_rssi(void) { return esp_wifi_sta_get_rssi(); }

/* RSSI 分级：低于 -80dBm 视为弱链路，应降速或换信道（经验阈值） */
int esp_link_quality(void) {
    int r = esp_link_rssi();
    if (r >= -60) return 2;
    if (r >= -80) return 1;
    return 0;
}
