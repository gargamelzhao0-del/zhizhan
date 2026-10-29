/* esp_m05_wifi.c —— 内置 WiFi 联网与 RSSI（ESP32 / Xtensa）。
 * 初始化 netif → 启动 WiFi → 配置 SSID → 连接；RSSI 用于链路质量评估与重连决策。 */
#include "esp_comm.h"

static wifi_config_t g_cfg = { .ssid = "lab-ap", .password = "12345678" };

void esp_wifi_up(void) {
    (void)esp_netif_init();
    (void)esp_netif_create_default_wifi_sta();
    (void)esp_wifi_start();
    (void)esp_wifi_set_config(0, &g_cfg);
    (void)esp_wifi_connect();
}

int esp_rssi(void) { return esp_wifi_sta_get_rssi(); }
