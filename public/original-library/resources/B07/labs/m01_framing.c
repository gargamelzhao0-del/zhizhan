/* m01_framing.c —— 设备侧帧解析状态机（Cortex-M3）。
 * SOF(0x7E)…EOF(0x7F)；长度与 CRC 由协议层校验。逐字节喂入，溢出即放弃本帧。 */
#include <stdint.h>
#include "comm_api.h"

typedef struct { uint8_t buf[64]; int n; int in; } fparse_t;

int frame_feed(fparse_t *p, uint8_t b) {
    if (!p->in) { if (b == 0x7E) { p->in = 1; p->n = 0; } return 0; }
    if (b == 0x7F) { p->in = 0; return p->n >= 4 ? 1 : 0; }
    if (p->n < (int)sizeof(p->buf)) p->buf[p->n++] = b;
    else { p->in = 0; }                 /* 溢出：放弃本帧，等下一个 SOF */
    return 0;
}

void uart_rx_task(void *arg) {
    fparse_t fp; uint8_t b; (void)arg;
    fp.in = 0; fp.n = 0;
    for (;;) {
        if (uart_recv(&b, 1u, portMAX_DELAY) == 1) {
            if (frame_feed(&fp, b)) { /* 一帧完整：交给协议层 */ }
        }
    }
}
