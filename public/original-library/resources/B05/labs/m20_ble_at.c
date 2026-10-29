/* m20_ble_at.c — B05-M20 蓝牙（STM32 外接 BLE 模组，AT 指令，如 HC-05/BLE 透传模块）
 * 单片机把 BLE 模块当“透传串口”：AT 配置后，收发即 GATT 通知/写入。 */
#include "stm32f103_regs.h"
#include <string.h>

extern int uart_at_send(const char *cmd);
extern int uart_at_read(char *buf, int max, int timeout_ms);

/* 配置：AT+NAME、AT+ROLE=0(从机)、AT+BAUD；成功后进入透传 */
int ble_at_setup(const char *name)
{
    if (uart_at_send("AT+ROLE=0") != 0) { return -1; }   /* 从机 */
    char cmd[48]; int n = 0;
    const char *p = "AT+NAME";
    while (*p && n < 40) { cmd[n++] = *p++; }
    while (*name && n < 40) { cmd[n++] = *name++; }
    cmd[n] = '\0';
    if (uart_at_send(cmd) != 0) { return -2; }
    char rsp[64];
    if (uart_at_read(rsp, sizeof(rsp), 1000) <= 0) { return -3; }
    return strstr(rsp, "OK") ? 0 : -4;
}

/* 透传发送：连接建立后，写入就是 GATT Notify */
extern int uart_send(const uint8_t *buf, int n);
int ble_at_send(const uint8_t *buf, int n) { return uart_send(buf, n); }
