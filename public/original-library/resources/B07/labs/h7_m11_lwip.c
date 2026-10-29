/* h7_m11_lwip.c —— lwIP 分层概念（STM32H7 / Cortex-M7）。
 * 应用用 netconn/socket；pbuf 由协议栈管理，发送完成前缓冲不能复用。 */
#include <stdint.h>
#include "comm_api.h"

int lwip_send_hello(const char *host, uint16_t port) {
    const uint8_t msg[] = "hello";
    if (tcp_connect(host, port) != 0) return -1;
    return tcp_send(msg, sizeof(msg) - 1u);
}

/* ARP 失败/端口不通/超时是三层不同的故障，应分别有观测点（M09） */
int lwip_probe(const char *host, uint16_t port) { return tcp_connect(host, port); }
