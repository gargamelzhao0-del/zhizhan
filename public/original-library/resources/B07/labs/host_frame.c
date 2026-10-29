/* host_frame.c —— 帧解析状态机：转义、CRC、噪声重同步、序号去重（主机可运行）。
 *
 * 线格式：[SOF=0x7E] 转义后的 body [EOF=0x7F]，body = seq | len | payload | crc16。
 * 转义规则：0x7E/0x7F/0x7D 前插 0x7D，并把原字节异或 0x20。
 * 解析器逐字节喂入，必须做到：
 *   ① 从噪声中重新同步（不因一个坏字节丢掉后面的好帧）；
 *   ② CRC 失败计一次错误并继续；
 *   ③ 重复序号只处理一次（幂等）。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_frame.c -o host_frame && ./host_frame
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define SOF 0x7E
#define EOFB 0x7F
#define ESC 0x7D

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}

/* 构造一帧（含转义），返回字节数 */
static int make_frame(uint8_t seq, const uint8_t *pl, int pln, uint8_t *out) {
    uint8_t body[64]; int bn = 0;
    body[bn++] = seq;
    body[bn++] = (uint8_t)pln;
    memcpy(body + bn, pl, pln); bn += pln;
    uint16_t c = crc16(body, bn);
    body[bn++] = (uint8_t)(c & 0xFF);
    body[bn++] = (uint8_t)(c >> 8);
    int on = 0; out[on++] = SOF;
    for (int i = 0; i < bn; i++) {
        uint8_t b = body[i];
        if (b == SOF || b == EOFB || b == ESC) { out[on++] = ESC; out[on++] = (uint8_t)(b ^ 0x20); }
        else out[on++] = b;
    }
    out[on++] = EOFB;
    return on;
}

typedef struct {
    int state;            /* 0=等待 SOF, 1=收 body, 2=收到 ESC */
    uint8_t body[64]; int blen;
    uint8_t seq; uint8_t payload[32]; int plen;
    int good, crc_err, dup;
    uint8_t seen[4]; int seen_n;    /* 最近 4 个序号，用于去重 */
    uint8_t last_seq, last_payload[32]; int last_plen;   /* 最近“被接受”的帧 */
} parser_t;

static int already_seen(parser_t *P, uint8_t seq) {
    for (int i = 0; i < P->seen_n; i++) if (P->seen[i] == seq) return 1;
    return 0;
}
static void remember(parser_t *P, uint8_t seq) {
    if (P->seen_n < 4) P->seen[P->seen_n++] = seq;
    else { memmove(P->seen, P->seen + 1, 3); P->seen[3] = seq; }
}
/* 返回：1=产出帧, -1=CRC 错误, 0=无事件 */
static int feed(parser_t *P, uint8_t b) {
    if (P->state == 0) { if (b == SOF) { P->state = 1; P->blen = 0; } return 0; }
    if (b == ESC && P->state != 2) { P->state = 2; return 0; }
    if (P->state == 2) { b = (uint8_t)(b ^ 0x20); P->state = 1; }
    if (b == SOF) { P->state = 1; P->blen = 0; return 0; }   /* 中途遇到 SOF：重新开始 */
    if (b == EOFB) {
        P->state = 0;
        if (P->blen < 4) return 0;                            /* 太短：丢弃 */
        int dlen = P->blen - 2;
        if (crc16(P->body, dlen) != (uint16_t)(P->body[dlen] | (P->body[dlen + 1] << 8))) { P->crc_err++; return -1; }
        P->seq = P->body[0];
        P->plen = P->body[1];
        if (P->plen > (int)sizeof(P->payload) || P->plen + 2 != dlen) return 0;
        memcpy(P->payload, P->body + 2, P->plen);
        if (already_seen(P, P->seq)) { P->dup++; return 0; }
        remember(P, P->seq);
        P->last_seq = P->seq;
        P->last_plen = P->plen;
        memcpy(P->last_payload, P->payload, (size_t)P->plen);
        P->good++;
        return 1;
    }
    if (P->blen < (int)sizeof(P->body)) P->body[P->blen++] = b;
    else P->blen = 0;                                         /* 溢出：丢弃 */
    return 0;
}

int main(void) {
    parser_t P; memset(&P, 0, sizeof(P));
    uint8_t f1[64], f2[64], f3[64];
    const uint8_t pa[] = {'a', 'b', 'c'};
    const uint8_t pb[] = {'d', 'e'};
    int n1 = make_frame(1, pa, 3, f1);
    int n2 = make_frame(2, pb, 2, f2);
    int n3 = make_frame(3, pb, 2, f3);
    f2[2] ^= 0x01;                                            /* 破坏第 2 帧 → CRC 失败 */

    int got = 0, ev;
    uint8_t noise[] = {0x11, 0x22, 0x7E, 0x33};               /* 噪声里甚至混入一个 SOF */
    for (unsigned i = 0; i < sizeof(noise); i++) feed(&P, noise[i]);
    for (int i = 0; i < n1; i++) { ev = feed(&P, f1[i]); if (ev == 1) got++; }
    for (int i = 0; i < n2; i++) { ev = feed(&P, f2[i]); if (ev == 1) got++; }
    for (int i = 0; i < n3; i++) { ev = feed(&P, f3[i]); if (ev == 1) got++; }
    for (int i = 0; i < n1; i++) { ev = feed(&P, f1[i]); if (ev == 1) got++; }   /* 重复帧 */

    printf("产出帧=%d（期望 2：第 1、3 帧）  CRC 错误=%d（期望 1）  重复丢弃=%d（期望 1）\n",
           P.good, P.crc_err, P.dup);
    printf("最后被接受的帧：seq=%d payload=%c%c\n", P.last_seq, P.last_payload[0], P.last_payload[1]);

    int ok = 1;
    if (P.good != 2) ok = 0;
    if (P.crc_err != 1) ok = 0;
    if (P.dup != 1) ok = 0;
    if (!(P.last_seq == 3 && P.last_plen == 2 && P.last_payload[0] == 'd')) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
