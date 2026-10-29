/* host_params.c —— 参数双副本 + 版本迁移 + 默认回退（主机可运行）。
 *
 * 参数存两份（A/B）各带 CRC；加载时选“校验通过且版本最新”的一份；
 * 版本升级时用迁移函数补默认值；两份都坏则回退默认值。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_params.c -o host_params && ./host_params
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

typedef struct { uint16_t magic; uint16_t ver; int16_t t_lo; int16_t t_hi; uint16_t crc; } p1_t;
typedef struct { uint16_t magic; uint16_t ver; int16_t t_lo; int16_t t_hi; uint16_t sample_ms; uint16_t crc; } p2_t;

typedef struct { int16_t t_lo, t_hi; uint16_t sample_ms; uint16_t ver; } cfg_t;

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) { c ^= p[i]; for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1); }
    return c;
}
#define MAGIC 0x51A2

static void p2_store(p2_t *p, cfg_t c) {
    p->magic = MAGIC; p->ver = c.ver; p->t_lo = c.t_lo; p->t_hi = c.t_hi; p->sample_ms = c.sample_ms;
    p->crc = crc16((const uint8_t *)p, 10);
}
static int p2_valid(const p2_t *p) { return p != NULL && p->magic == MAGIC && crc16((const uint8_t *)p, 10) == p->crc; }

/* 从 A/B 两份存储恢复；返回 0=正常，1=回退默认 */
static int params_load(const p2_t *A, const p2_t *B, const p1_t *OLD, cfg_t *out) {
    if (p2_valid(A) || p2_valid(B)) {
        const p2_t *p = p2_valid(A) ? A : B;
        out->t_lo = p->t_lo; out->t_hi = p->t_hi; out->sample_ms = p->sample_ms; out->ver = p->ver;
        return 0;
    }
    /* v1 迁移：结构更旧、缺 sample_ms → 补默认 */
    if (OLD != NULL && OLD->magic == MAGIC && crc16((const uint8_t *)OLD, 8) == OLD->crc) {
        out->t_lo = OLD->t_lo; out->t_hi = OLD->t_hi; out->sample_ms = 1000; out->ver = 2;
        return 0;
    }
    out->t_lo = -20; out->t_hi = 60; out->sample_ms = 1000; out->ver = 2;   /* 默认 */
    return 1;
}

int main(void) {
    cfg_t want = {-10, 85, 500, 2}, got;
    p2_t A, B; p2_store(&A, want); p2_store(&B, want);
    int ok = 1, r;

    r = params_load(&A, &B, NULL, &got);
    printf("两份都好：r=%d ver=%u t=[%d,%d] sample=%ums\n", r, got.ver, got.t_lo, got.t_hi, got.sample_ms);
    if (!(r == 0 && got.t_lo == -10 && got.t_hi == 85 && got.sample_ms == 500)) ok = 0;

    A.crc ^= 0xFF;                                   /* A 坏 → 用 B */
    r = params_load(&A, &B, NULL, &got);
    printf("A 损坏：r=%d sample=%ums（应回退到 B=500）\n", r, got.sample_ms);
    if (!(r == 0 && got.sample_ms == 500)) ok = 0;

    p1_t old = {MAGIC, 1, -5, 70, 0};
    old.crc = crc16((const uint8_t *)&old, 8);
    r = params_load(NULL, NULL, &old, &got);
    printf("只有 v1：r=%d ver=%u sample=%ums（迁移补默认 1000）\n", r, got.ver, got.sample_ms);
    if (!(r == 0 && got.ver == 2 && got.sample_ms == 1000 && got.t_hi == 70)) ok = 0;

    r = params_load(NULL, NULL, NULL, &got);
    printf("全坏：r=%d ver=%u sample=%ums t=[%d,%d]（回退默认）\n", r, got.ver, got.sample_ms, got.t_lo, got.t_hi);
    if (!(r == 1 && got.t_lo == -20 && got.t_hi == 60)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
