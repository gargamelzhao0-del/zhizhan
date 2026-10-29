/* h7_m10_node.c —— H7 以太网节点：TCP 上报 + 双 Bank OTA（Cortex-M7）。
 * lwIP 的 pbuf 生命周期要管好：发送完成前不能释放/覆盖缓冲。 */
#include <stdint.h>
#include "comm_api.h"

static void report_task(void *arg) {
    (void)arg;
    for (;;) {
        if (tcp_connect("server.local", 1883u) == 0) {
            (void)mqtt_publish("dev/1/temp", (const uint8_t *)"23.5", 4u, 1);
        }
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void h7_node_start(void) {
    (void)xTaskCreate(report_task, "report", 1024u, 0, 3u, 0);
}
