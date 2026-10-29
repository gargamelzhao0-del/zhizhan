/* host_tls.c —— TLS 握手要素与证书校验流程的最小模型（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tls.c -o host_tls && ./host_tls
 */
#include <stdio.h>
#include <string.h>
typedef struct {
    const char *ver;            /* 协商版本，如 TLS1.2 / TLS1.3 */
    const char *host;           /* 客户端期望主机名 */
    const char *san;            /* 证书 SAN（此处简化为单个主机名） */
    int chain_ok;               /* 证书链是否可信（1=是） */
    long now;                   /* 当前时刻（秒） */
    long not_before, not_after; /* 证书有效期（秒） */
} tls_t;
/* 返回 0=接受；非 0=拒绝，并给出首个失败项的原因码 */
static int verify(const tls_t *c) {
    if (!(strcmp(c->ver, "TLS1.2") == 0 || strcmp(c->ver, "TLS1.3") == 0)) return 1; /* 版本 ≥1.2 */
    if (!c->chain_ok) return 2;                                                        /* 证书链 */
    if (strcmp(c->host, c->san) != 0) return 3;                                        /* 主机名 */
    if (c->now < c->not_before || c->now > c->not_after) return 4;                     /* 有效期 */
    return 0;
}
int main(void) {
    int ok = 1;
    tls_t good = { "TLS1.3", "api.example.com", "api.example.com", 1, 1000, 900, 2000 };
    tls_t bad_old = { "TLS1.0", "api.example.com", "api.example.com", 1, 1000, 900, 2000 };
    int r1 = verify(&good), r2 = verify(&bad_old);
    printf("合法连接: %s（原因码 %d）\n", r1 == 0 ? "接受" : "拒绝", r1);
    printf("非法连接(TLS1.0): %s（原因码 %d）\n", r2 == 0 ? "接受" : "拒绝", r2);
    if (!(r1 == 0 && r2 == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
