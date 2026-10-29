/* host_backoff.c —— 断网重连的指数退避、去重缓存与幂等（主机可运行）。
 *
 *   ① 指数退避：退避 = min(base × 2^attempt, cap)，避免断网时雪崩式重连。
 *   ② 有界去重缓存：只保留最近 N 条消息 id，防止重复执行；缓存满则淘汰最旧。
 *   ③ 幂等：同一条命令重复到达，状态只应改变一次。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_backoff.c -o host_backoff && ./host_backoff
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint32_t backoff_ms(int attempt, uint32_t base, uint32_t cap) {
    uint64_t v = (uint64_t)base << attempt;          /* base × 2^attempt */
    return v > cap ? cap : (uint32_t)v;
}

#define CACHE 4
typedef struct { int id[CACHE]; int n; } cache_t;
static int cache_has(cache_t *c, int id) {
    for (int i = 0; i < c->n; i++) if (c->id[i] == id) return 1;
    return 0;
}
static void cache_put(cache_t *c, int id) {
    if (c->n < CACHE) c->id[c->n++] = id;
    else { memmove(c->id, c->id + 1, (CACHE - 1) * sizeof(int)); c->id[CACHE - 1] = id; }
}

int main(void) {
    int ok = 1;

    printf("指数退避（base=100ms, cap=30000ms）：");
    uint32_t last = 0;
    for (int a = 0; a <= 10; a++) {
        uint32_t v = backoff_ms(a, 100, 30000);
        printf("%ums%s", v, a < 10 ? ", " : "\n");
        if (a > 0 && v < last) ok = 0;               /* 必须非递减 */
        if (v > 30000u) ok = 0;                      /* 不超过 cap */
        last = v;
    }
    if (backoff_ms(0, 100, 30000) != 100 || backoff_ms(9, 100, 30000) != 30000) ok = 0;

    cache_t c; memset(&c, 0, sizeof(c));
    for (int id = 1; id <= 5; id++) cache_put(&c, id);
    printf("去重缓存（容量 %d，插入 1..5）：has(1)=%d（应 0，已淘汰）has(3)=%d（应 1）has(5)=%d（应 1）\n",
           CACHE, cache_has(&c, 1), cache_has(&c, 3), cache_has(&c, 5));
    if (cache_has(&c, 1) != 0 || cache_has(&c, 3) != 1 || cache_has(&c, 5) != 1) ok = 0;

    /* 幂等：命令 id=42 重复 3 次，状态只应 +1 */
    int state = 0;
    cache_t seen; memset(&seen, 0, sizeof(seen));
    for (int i = 0; i < 3; i++) {
        if (!cache_has(&seen, 42)) { state += 1; cache_put(&seen, 42); }
    }
    printf("幂等：命令 id=42 重复 3 次 → state=%d（期望 1）\n", state);
    if (state != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
