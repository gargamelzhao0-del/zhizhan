/* m19_wifi_at.c — B05-M19 WiFi（STM32 外接 WiFi 模组，AT 指令，如 ESP-AT）
 * 单片机侧只做两件事：发 AT 指令、解析返回；联网协议栈在模组里。 */
#include "stm32f103_regs.h"
#include <string.h>

extern int uart_at_send(const char *cmd);          /* 经 USART 发出，带 \r\n */
extern int uart_at_read(char *buf, int max, int timeout_ms);

/* 连接 AP：AT+CWJAP="ssid","pass" → 等 "OK" / "WIFI GOT IP" */
int wifi_at_join(const char *ssid, const char *pass)
{
    char cmd[96];
    int n = 0;
    const char *p = "AT+CWJAP=\"";
    while (*p && n < 90) { cmd[n++] = *p++; }
    while (*ssid && n < 90) { cmd[n++] = *ssid++; }
    cmd[n++] = '"'; cmd[n++] = ','; cmd[n++] = '"';
    while (*pass && n < 90) { cmd[n++] = *pass++; }
    cmd[n++] = '"';                                /* 收尾引号：AT+CWJAP="ssid","pass" */
    cmd[n] = '\0';
    if (uart_at_send(cmd) != 0) { return -1; }

    char rsp[128];
    for (int i = 0; i < 20; ++i) {                 /* 最多等 ~20 次 */
        int r = uart_at_read(rsp, sizeof(rsp), 1000);
        if (r > 0 && (strstr(rsp, "WIFI GOT IP") || strstr(rsp, "OK"))) { return 0; }
        if (r > 0 && strstr(rsp, "FAIL")) { return -2; }
    }
    return -3;                                     /* 超时：检查波特率/电源/天线 */
}
