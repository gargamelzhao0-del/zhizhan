/* m12_backoff.c —— 指数退避与有界离线缓存（Cortex-M3）。
 * 断网时不能死循环重连；缓存有上界，满了丢最旧并计数，避免 RAM 被吃光。 */
#include <stdint.h>
#include <string.h>
#include "comm_api.h"

uint32_t reconnect_backoff_ms(int attempt) {
    uint64_t v = 100ull << attempt;                 /* 100ms × 2^attempt */
    return v > 30000ull ? 30000u : (uint32_t)v;
}

#define CACHE_CAP 64
#define ITEM_LEN  32
typedef struct { uint8_t buf[CACHE_CAP][ITEM_LEN]; int n; uint32_t dropped; } offcache_t;

int cache_push(offcache_t *c, const uint8_t *d) {
    if (c->n == CACHE_CAP) {                         /* 满：丢最旧，计数 */
        memmove(c->buf[0], c->buf[1], (CACHE_CAP - 1) * ITEM_LEN);
        c->n = CACHE_CAP - 1;
        c->dropped++;
    }
    memcpy(c->buf[c->n++], d, ITEM_LEN);
    return 0;
}
