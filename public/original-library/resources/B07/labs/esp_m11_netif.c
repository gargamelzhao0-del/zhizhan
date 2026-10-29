/* esp_m11_netif.c —— netif 与 TCP（ESP32 / Xtensa）。
 * 分层：netif(IP 层) → WiFi 驱动 → socket/TCP。 */
#include "esp_comm.h"
#include "comm_api.h"

int esp_tcp_up(const char *host, uint16_t port) {
    (void)esp_netif_init();
    (void)esp_netif_create_default_wifi_sta();
    (void)esp_wifi_start();
    return tcp_connect(host, port);
}
