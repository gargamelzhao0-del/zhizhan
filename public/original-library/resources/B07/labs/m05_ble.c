/* m05_ble.c —— 外挂 BLE 透传模组（Cortex-M3）。
 * 用 AT 指令复位并开启广播，随后进入透传：应用只管收发串口。 */
#include <stdint.h>
#include <string.h>
#include "comm_api.h"

static const char *AT_RESET = "AT+RST\r\n";
static const char *AT_ADV   = "AT+ADV=1\r\n";

int ble_module_start(void) {
    (void)uart_send((const uint8_t *)AT_RESET, strlen(AT_RESET));
    (void)uart_send((const uint8_t *)AT_ADV, strlen(AT_ADV));
    return 0;   /* 之后按透传模式收发 */
}
