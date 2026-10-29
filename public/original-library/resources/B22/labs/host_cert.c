/* host_cert.c —— 证书校验流程模型：链 / 有效期 / 主机名 / 吊销（主机可运行）。
 * 说明：本程序只演示 TLS 证书校验的**判定流程与顺序**（用固定测试向量），
 *      不做任何密码学运算，也不解析真实 X.509；真实校验请用 mbedTLS/OpenSSL 等成熟库
 *      并**开启全部检查**（链、有效期、主机名、吊销），绝不可在代码里关闭校验。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cert.c -o host_cert && ./host_cert
 */
#include <stdio.h>
#include <string.h>
typedef struct {
    const char *label;
    const char *cert_host;   /* 证书里的 CN/SAN */
    const char *conn_host;   /* 实际连接的主机名 */
    long now;                /* 设备当前时间（UNIX 秒） */
    int revoked;             /* 是否在吊销列表 */
    int chain_ok;            /* 证书链能否到受信根 */
    int expect_ok;           /* 期望结果 */
} case_t;
static int verify(const case_t *c, long nb, long na) {
    if (!c->chain_ok) return 0;                       /* 1) 链到受信根 */
    if (c->now < nb || c->now > na) return 0;         /* 2) 有效期（依赖正确的设备时间） */
    if (strcmp(c->cert_host, c->conn_host) != 0) return 0; /* 3) 主机名匹配 */
    if (c->revoked) return 0;                         /* 4) 吊销检查 */
    return 1;
}
int main(void) {
    int ok = 1;
    long nb = 1600000000L, na = 1800000000L;
    case_t cs[] = {
        {"正常",       "api.example.com", "api.example.com", 1700000000L, 0, 1, 1},
        {"链不可信",   "api.example.com", "api.example.com", 1700000000L, 0, 0, 0},
        {"已过期",     "api.example.com", "api.example.com", 1900000000L, 0, 1, 0},
        {"主机名不符", "api.example.com", "evil.example.com", 1700000000L, 0, 1, 0},
        {"已吊销",     "api.example.com", "api.example.com", 1700000000L, 1, 1, 0},
    };
    for (unsigned i = 0; i < sizeof(cs)/sizeof(cs[0]); i++) {
        int r = verify(&cs[i], nb, na);
        printf("%-10s → %s（期望 %s）\n", cs[i].label, r ? "接受" : "拒绝", cs[i].expect_ok ? "接受" : "拒绝");
        if (r != cs[i].expect_ok) ok = 0;
    }
    printf("结论：“关闭证书验证”= 给中间人开门；设备时间错也会导致有效期校验失败\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
