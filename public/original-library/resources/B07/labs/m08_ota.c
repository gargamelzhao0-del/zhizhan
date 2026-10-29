/* m08_ota.c —— 串口分块 OTA（Cortex-M3）。
 * 边收边写；任一步失败或超时都保留旧固件；全部写完并校验通过才切换。 */
#include <stdint.h>
#include <stddef.h>
#include "comm_api.h"

int ota_over_uart(uint32_t total, uint32_t crc) {
    uint8_t buf[256];
    if (ota_begin(total, crc) != 0) return -1;
    uint32_t got = 0;
    while (got < total) {
        int n = uart_recv(buf, sizeof(buf), 5000u);
        if (n <= 0) return -2;                      /* 超时：回滚 */
        if (ota_write(buf, (size_t)n) != 0) return -3;
        got += (uint32_t)n;
    }
    return ota_finish();                            /* 校验 + 切换 */
}
