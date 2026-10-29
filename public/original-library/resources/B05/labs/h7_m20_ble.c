/* h7_m20_ble.c — B05-M20 蓝牙 / BLE（STM32H7）
 * H7 可用 BlueNRG 等 BLE 协处理器（SPI/UART），或 WB 系列内置。这里是“模组 + 命令”的骨架。 */
#include "stm32h7_regs.h"
#include <string.h>

extern int uart_at_send(const char *cmd);
extern int uart_at_read(char *buf, int max, int timeout_ms);

/* BlueNRG 风格：初始化 → 设名 → 广播 → 连接后更新参数 */
int ble_h7_start(const char *name)
{
    if (uart_at_send("AT+BLEINIT=2") != 0) { return -1; }   /* 作为外设 */
    char cmd[64]; int n = 0;
    const char *p = "AT+BLENAME=";
    while (*p && n < 56) { cmd[n++] = *p++; }
    while (*name && n < 56) { cmd[n++] = *name++; }
    cmd[n] = '\0';
    if (uart_at_send(cmd) != 0) { return -2; }
    char rsp[64];
    if (uart_at_read(rsp, sizeof(rsp), 1000) <= 0) { return -3; }
    return uart_at_send("AT+BLEADVSTART");                 /* 开始广播 */
}
