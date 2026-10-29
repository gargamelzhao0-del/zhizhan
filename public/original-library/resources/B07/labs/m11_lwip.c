/* m11_lwip.c —— TCP 客户端（Cortex-M3，外挂 W5500 或内置 MAC+lwIP）。
 * 用 socket 风格接口；连接/发送/接收都要有超时，避免链路异常时卡死。 */
#include <stdint.h>
#include <string.h>
#include "comm_api.h"

int http_get(const char *host, uint16_t port) {
    const char *req = "GET / HTTP/1.0\r\n\r\n";
    uint8_t buf[128];
    if (tcp_connect(host, port) != 0) return -1;
    if (tcp_send((const uint8_t *)req, strlen(req)) < 0) return -2;
    int n = tcp_recv(buf, sizeof(buf), 3000u);
    return n;                       /* 返回收到的字节数，<0 为错误 */
}
