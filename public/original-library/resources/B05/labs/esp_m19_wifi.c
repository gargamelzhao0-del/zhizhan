/* esp_m19_wifi.c — B05-M19 WiFi（ESP32 为主）：Station 联网、RSSI、断线重连
 * ESP32 内置 WiFi（802.11 b/g/n）；联网是“事件驱动”的：初始化 → 配 SSID → 等事件。 */
#include <stdint.h>

typedef int esp_err_t;
typedef int wifi_mode_t;
typedef struct { uint8_t ssid[32]; uint8_t password[64]; } wifi_sta_config_t;

extern esp_err_t esp_netif_init(void);
extern esp_err_t esp_event_loop_create_default(void);
extern void *esp_netif_create_default_wifi_sta(void);
extern esp_err_t esp_wifi_init(const void *cfg);
extern esp_err_t esp_wifi_set_mode(wifi_mode_t mode);
extern esp_err_t esp_wifi_set_config(int iface, const void *conf);
extern esp_err_t esp_wifi_start(void);
extern esp_err_t esp_wifi_connect(void);
extern esp_err_t esp_wifi_sta_get_ap_info(void *ap_info);   /* 内含 rssi 字段 */

#define WIFI_MODE_STA 1
#define WIFI_IF_STA   0

int esp_wifi_sta_start(const char *ssid, const char *pass)
{
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();
    esp_wifi_init((const void *)0);
    esp_wifi_set_mode(WIFI_MODE_STA);

    wifi_sta_config_t c = { { 0 }, { 0 } };
    for (int i = 0; i < 32 && ssid[i]; ++i) { c.ssid[i] = (uint8_t)ssid[i]; }
    for (int i = 0; i < 64 && pass[i]; ++i) { c.password[i] = (uint8_t)pass[i]; }
    esp_wifi_set_config(WIFI_IF_STA, &c);
    esp_wifi_start();
    return esp_wifi_connect();
}

/* RSSI：信号强度（dBm）。重连策略：掉线事件里做指数退避，不要死循环狂连 */
int esp_wifi_rssi(void *ap_info) { return esp_wifi_sta_get_ap_info(ap_info); }
