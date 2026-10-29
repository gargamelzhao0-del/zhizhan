/* esp_m18_eth.c — B05-M18 以太网（ESP32 内置 EMAC + 外接 PHY，如 LAN8720）
 * 用 ESP-IDF 的 esp_eth + esp_netif：装驱动、起 netif、拿 IP。 */
#include <stdint.h>

typedef int esp_err_t;
typedef void *esp_eth_handle_t;
typedef void *esp_netif_t;

extern esp_err_t esp_netif_init(void);
extern esp_err_t esp_event_loop_create_default(void);
extern esp_netif_t esp_netif_create_default_eth(const void *eth_config);
extern esp_err_t esp_eth_driver_install(const void *config, esp_eth_handle_t *out);
extern esp_err_t esp_eth_start(esp_eth_handle_t h);
extern void *esp_eth_phy_new_lan87xx(const void *phy_config);   /* RMII PHY */

extern esp_netif_t g_esp_netif;

/* 返回 0 表示驱动已装并启动；IP 由 DHCP 事件回调拿到 */
int esp_eth_bringup(const void *mac_config, const void *phy_config)
{
    esp_netif_init();
    esp_event_loop_create_default();
    g_esp_netif = esp_netif_create_default_eth((const void *)0);
    (void)esp_eth_phy_new_lan87xx(phy_config);
    esp_eth_handle_t h = (void *)0;
    if (esp_eth_driver_install(mac_config, &h) != 0) { return -1; }
    return esp_eth_start(h);
}

/* 与 lwIP/socket 的应用层用法和 STM32 一致：网口之上就是标准 TCP/IP */
extern int lwip_socket(int domain, int type, int protocol);
int esp_tcp_socket(void) { return lwip_socket(2, 1, 0); }
