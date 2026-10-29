/* h7_m06_tls.c —— 应用层协议跑在 TCP/TLS 上（STM32H7 / Cortex-M7）。
 * TLS 握手要额外 RAM 与时间；MCU 上常用会话复用/精简套件降低开销。 */
#include <stdint.h>
#include <stddef.h>
#include "comm_api.h"

int tls_publish(const char *host, uint16_t port, const char *topic, const uint8_t *p, size_t n) {
    if (tcp_connect(host, port) != 0) return -1;   /* TLS 握手在连接层完成 */
    return mqtt_publish(topic, p, n, 1);
}
