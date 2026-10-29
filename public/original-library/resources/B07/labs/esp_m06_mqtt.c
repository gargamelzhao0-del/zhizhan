/* esp_m06_mqtt.c —— ESP32 上先联网再发 MQTT（Xtensa）。
 * 分层：netif/WiFi → MQTT 客户端 → 应用。连接失败要交给重连策略。 */
#include "esp_comm.h"
#include "comm_api.h"

void esp_mqtt_up(void) {
    (void)esp_netif_init();
    (void)esp_netif_create_default_wifi_sta();
    (void)mqtt_connect("node-1", 60u);
}

int esp_mqtt_temp(const char *topic, int mv) {
    uint8_t pl[12];
    int n = 0;
    pl[n++] = (uint8_t)('0' + (mv / 1000) % 10);
    pl[n++] = (uint8_t)('0' + (mv / 100) % 10);
    pl[n++] = '.';
    pl[n++] = (uint8_t)('0' + (mv / 10) % 10);
    return mqtt_publish(topic, pl, (size_t)n, 1);
}
