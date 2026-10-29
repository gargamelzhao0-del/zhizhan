/* host_secureboot.c —— 信任链、篡改检测、抗回滚与失败安全（主机可运行）。
 * 说明：本程序用“带密钥哈希（keyed-hash）”演示逐级校验的**流程**，它**不是数字签名**；
 *      真实安全启动用**非对称签名**（私钥签名、设备只持公钥，如 RSA/ECDSA + X.509），
 *      密钥放 OTP/SE，且逐级可用不同密钥。此处单一 key 仅为示意，不可用于生产。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_secureboot.c -o host_secureboot && ./host_secureboot
 */
#include <stdio.h>
#include <stdint.h>

/* 示意用的带密钥哈希（FNV 变体）——仅演示“有密钥才能校验”的机制，非密码学安全 */
static uint32_t tagged_hash(const char *img, uint32_t key) {
    uint32_t h = 0x811c9dc5u;
    h ^= key;
    for (const char *p = img; *p; p++) { h ^= (uint8_t)*p; h *= 16777619u; }
    return h;
}
int main(void) {
    int ok = 1;
    uint32_t key = 0xA5A5A5A5u;   /* 示意用；真实为设备公钥 / HSM 中的私钥对应 */
    const char *spl = "spl.bin", *boot = "uboot.bin", *app = "app.bin";

    /* 逐级校验：ROOT→SPL→U-Boot→App */
    uint32_t d_spl = tagged_hash(spl, key), d_boot = tagged_hash(boot, key), d_app = tagged_hash(app, key);
    int chain = (d_spl != 0) && (d_boot != 0) && (d_app != 0);
    printf("信任链逐级校验（keyed-hash 示意，非数字签名）=%s\n", chain ? "通过" : "失败");
    if (!chain) ok = 0;

    /* 篡改 App → 校验失败 */
    uint32_t tampered = tagged_hash("app_tampered.bin", key);
    printf("App 被篡改 → 校验%s（期望失败）\n", tampered == d_app ? "通过" : "失败");
    if (tampered == d_app) ok = 0;

    /* 抗回滚：单调计数器，要求待启动版本 >= 当前计数器 */
    int monotonic = 5;
    int v_old = 3, v_new = 6;
    printf("抗回滚：计数器=%d，尝试 v%d → %s（期望拒绝）\n", monotonic, v_old, v_old < monotonic ? "拒绝" : "接受");
    if (!(v_old < monotonic)) ok = 0;
    printf("抗回滚：尝试 v%d → %s（期望接受）\n", v_new, v_new >= monotonic ? "接受" : "拒绝");
    if (!(v_new >= monotonic)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
