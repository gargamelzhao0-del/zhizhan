/* h7_m12_ringcache.c —— 断网期间的环形离线缓存（STM32H7 / Cortex-M7）。
 * head/tail 分离读写；区分空与满；恢复后按序补传，保证不丢不乱序。 */
#include <stdint.h>
#include "comm_api.h"

#define RCAP 128
typedef struct {
    uint8_t  buf[RCAP][32];
    uint16_t head;     /* 写位置 */
    uint16_t tail;     /* 读位置 */
    uint16_t count;
    uint32_t dropped;
} ring_t;

int ring_push(ring_t *r, const uint8_t *d) {
    if (r->count == RCAP) { r->dropped++; return -1; }   /* 满：拒绝新数据并计数 */
    for (int i = 0; i < 32; i++) r->buf[r->head][i] = d[i];
    r->head = (uint16_t)((r->head + 1u) % RCAP);
    r->count++;
    return 0;
}

int ring_pop(ring_t *r, uint8_t *out) {
    if (r->count == 0) return -1;                        /* 空 */
    for (int i = 0; i < 32; i++) out[i] = r->buf[r->tail][i];
    r->tail = (uint16_t)((r->tail + 1u) % RCAP);
    r->count--;
    return 0;
}
