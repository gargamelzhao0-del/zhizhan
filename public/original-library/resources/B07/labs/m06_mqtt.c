/* m06_mqtt.c —— 发布一条 MQTT 消息（Cortex-M3）。
 * 主题/载荷与 QoS 由应用决定；连接与重连策略单独管理（见 M12）。 */
#include <stdint.h>
#include "comm_api.h"

static int fmt_milli(int mv, uint8_t *out) {
    int n = 0;
    if (mv < 0) { out[n++] = '-'; mv = -mv; }
    out[n++] = (uint8_t)('0' + (mv / 10000) % 10);
    out[n++] = (uint8_t)('0' + (mv / 1000) % 10);
    out[n++] = '.';
    out[n++] = (uint8_t)('0' + (mv / 100) % 10);
    out[n++] = (uint8_t)('0' + (mv / 10) % 10);
    return n;
}

int mqtt_pub_temp(const char *topic, int mv) {
    uint8_t pl[12];
    int n = fmt_milli(mv, pl);
    return mqtt_publish(topic, pl, (size_t)n, 1);   /* QoS1：至少一次 */
}
