/* m06_link.c —— 上报策略与有界离线缓存（Cortex-M3）。
 * 断网时入缓存并计数；恢复后按序补传，绝不无限堆积。 */
#include <stdint.h>
#include "app_api.h"

#define QCAP 32
typedef struct { uint8_t buf[QCAP][16]; int n; uint32_t dropped; } offq_t;

int link_enqueue(offq_t *q, const uint8_t *d) {
    if (q->n >= QCAP) { q->dropped++; return -1; }   /* 满：丢新并计数 */
    for (int i = 0; i < 16; i++) q->buf[q->n][i] = d[i];
    q->n++;
    return 0;
}
int link_pending(const offq_t *q) { return q->n; }
