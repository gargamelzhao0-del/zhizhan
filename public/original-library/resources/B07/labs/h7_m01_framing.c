/* h7_m01_framing.c —— H7 侧批量收帧（Cortex-M7）。
 * 用 DMA + 空闲中断拿到一整块字节，再按帧头切分；比逐字节中断省中断开销。 */
#include <stdint.h>
#include <stddef.h>
#include "comm_api.h"

void h7_uart_rx_full_callback(const uint8_t *buf, size_t n) {
    size_t off = 0;
    while (off < n) {
        if (buf[off] != 0x7E) { off++; continue; }   /* 找帧头 */
        /* 从 off 起解析一帧：长度字段 → CRC 校验 → 提交，失败则 off++ 重同步 */
        break;
    }
}
