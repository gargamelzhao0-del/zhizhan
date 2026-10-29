/* host_ringlog.c —— 环形日志 + 掉电提交（主机可运行）。
 *
 * 存储只能把位从 1 写成 0。做法：每条记录带 seq + CRC；写完记录后才写“提交标记”。
 * 掉电发生在“写记录”和“写提交标记”之间时，恢复后该记录因无提交标记而被跳过。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ringlog.c -o host_ringlog && ./host_ringlog
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define N 4
typedef struct { uint8_t seq; int16_t v; uint8_t committed; uint16_t crc; } rec_t;

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) { c ^= p[i]; for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1); }
    return c;
}
static uint16_t rec_crc(const rec_t *r) { return crc16((const uint8_t *)r, 4); }  /* seq+v+crc 前的 4 字节 */

typedef struct { rec_t slot[N]; int head; int written; int committed; } log_t;

static void log_write(log_t *L, uint8_t seq, int16_t v, int powerfail_before_commit) {
    rec_t *r = &L->slot[L->head];
    memset(r, 0, sizeof(*r));
    r->seq = seq; r->v = v;
    r->crc = rec_crc(r);
    L->written++;
    if (powerfail_before_commit) return;      /* 掉电：未写提交标记 */
    r->committed = 1;
    L->committed++;
    L->head = (L->head + 1) % N;
}
/* 恢复：只把“有提交标记且 CRC 正确”的记录算作有效 */
static int log_recover(const log_t *L, int16_t *out, int max) {
    int n = 0;
    for (int i = 0; i < N; i++) {
        const rec_t *r = &L->slot[i];
        if (r->committed && rec_crc(r) == r->crc) {
            if (n < max) out[n] = r->v;
            n++;
        }
    }
    return n;
}

int main(void) {
    log_t L; memset(&L, 0, sizeof(L));
    int16_t out[N];
    int ok = 1;

    log_write(&L, 1, 100, 0);
    log_write(&L, 2, 200, 0);
    log_write(&L, 3, 300, 1);          /* 第 3 条写完但提交前掉电 */
    int valid = log_recover(&L, out, N);
    printf("写完 3 条（第 3 条掉电于提交前）→ 有效记录 %d 条：", valid);
    for (int i = 0; i < valid; i++) printf("%d ", out[i]);
    printf("\n");
    if (valid != 2) ok = 0;
    if (!(out[0] == 100 && out[1] == 200)) ok = 0;

    /* 提交标记被破坏 → CRC 不符也跳过 */
    L.slot[0].crc ^= 0xFF;
    int v2 = log_recover(&L, out, N);
    printf("损坏第 1 条后 → 有效记录 %d 条（期望 1）\n", v2);
    if (v2 != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
