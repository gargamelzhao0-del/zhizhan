/* h7_m19_wifi.c — B05-M19 WiFi（STM32H7 外接 WiFi 模组，AT 指令）
 * 与 F1 同样的“AT 指令”路线；H7 常配合 Wi-Fi 协处理器或走 SDIO/SPI 的 Wi-Fi 芯片。 */
#include "stm32h7_regs.h"
#include <string.h>

extern int uart_at_send(const char *cmd);
extern int uart_at_read(char *buf, int max, int timeout_ms);

/* 查询连接状态：AT+CWJAP? 或 AT+CIPSTATUS */
int wifi_h7_query_ip(char *ip_out, int cap)
{
    if (uart_at_send("AT+CIPSTA?") != 0) { return -1; }
    char rsp[160];
    int r = uart_at_read(rsp, sizeof(rsp), 1500);
    if (r <= 0) { return -2; }
    char *p = strstr(rsp, "ip:\"");
    if (!p) { return -3; }
    p += 4;
    int n = 0;
    while (*p && *p != '"' && n < cap - 1) { ip_out[n++] = *p++; }
    ip_out[n] = '\0';
    return 0;
}
