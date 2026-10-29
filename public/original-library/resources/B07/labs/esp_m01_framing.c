/* esp_m01_framing.c —— ESP32 侧 UART 收帧（Xtensa）。
 * UART 驱动按字节读，帧头/帧尾驱动状态机；长度与 CRC 交给协议层。 */
#include <stdint.h>
#include "esp_comm.h"
#include "comm_api.h"

void esp_uart_rx_task(void *arg) {
    uint8_t b;
    int in_frame = 0;
    (void)arg;
    for (;;) {
        if (uart_read_bytes(1, &b, 1u, portMAX_DELAY) == 1) {
            if (!in_frame && b == 0x7E) in_frame = 1;
            else if (in_frame && b == 0x7F) in_frame = 0;   /* 帧结束：进入处理 */
        }
    }
}
