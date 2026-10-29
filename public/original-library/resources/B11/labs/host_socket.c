/* host_socket.c —— 网络编程：TCP 字节流分帧（长度前缀 + 半包处理）（主机可运行）。
 * TCP 不保留消息边界：一次 recv 可能只收到半条。必须按长度前缀累积，凑齐才算一条消息。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_socket.c -o host_socket && ./host_socket
 */
#include <stdio.h>
#include <string.h>
typedef struct { unsigned char buf[128]; int len; } stream_t;
static int feed(stream_t *s, const unsigned char *d, int n) { memcpy(s->buf + s->len, d, n); s->len += n; return n; }
/* 尝试取出一条 [len][payload]，返回 1=取到 */
static int take(stream_t *s, char *out) {
    if (s->len < 1) return 0;
    int mlen = s->buf[0];
    if (s->len < 1 + mlen) return 0;                 /* 半包：等更多数据 */
    memcpy(out, s->buf + 1, mlen); out[mlen] = 0;
    memmove(s->buf, s->buf + 1 + mlen, s->len - 1 - mlen);
    s->len -= 1 + mlen;
    return 1;
}
int main(void) {
    int ok = 1; stream_t s; memset(&s, 0, sizeof(s)); char msg[64];
    unsigned char m1[] = {3, 'a', 'b', 'c'};
    unsigned char m2[] = {2, 'x', 'y'};
    feed(&s, m1, 4); feed(&s, m2, 3);
    if (!take(&s, msg) || strcmp(msg, "abc") != 0) ok = 0;
    printf("消息1=\"%s\"\n", msg);
    /* 半包：只喂第一条消息的前 2 字节 */
    stream_t h; memset(&h, 0, sizeof(h));
    feed(&h, m2, 1);
    printf("半包（只有长度）take=%d（期望 0）\n", take(&h, msg));
    if (take(&h, msg) != 0) ok = 0;
    feed(&h, m2 + 1, 2);
    if (!take(&h, msg) || strcmp(msg, "xy") != 0) ok = 0;
    printf("补齐后消息=\"%s\"\n", msg);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
