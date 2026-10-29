/* esp_m10_node.c —— ESP32 端到端节点（Xtensa）：联网 + MQTT + OTA。
 * 运行中若收到固件：下载 → 写入备用分区 → 重启后确认或回滚。 */
#include "esp_comm.h"
#include "comm_api.h"

static void app_task(void *arg) {
    (void)arg;
    for (;;) {
        (void)mqtt_publish("dev/1/temp", (const uint8_t *)"23.5", 4u, 1);
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void esp_node_start(void) {
    (void)esp_netif_init();
    (void)esp_netif_create_default_wifi_sta();
    (void)mqtt_connect("node-1", 60u);
    (void)xTaskCreate(app_task, "app", 4096u, 0, 3u, 0);
}
