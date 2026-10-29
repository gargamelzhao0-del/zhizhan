/* host_crypto.c —— 密码学工程使用：哈希 + HMAC 链与校验（主机可运行）。
 * 用简化哈希演示：HMAC 用于完整性/认证，哈希链用于防篡改序列。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_crypto.c -o host_crypto && ./host_crypto
 */
#include <stdio.h>
#include <stdint.h>
static uint32_t h(const uint8_t *p, int n, uint32_t seed) { uint32_t x = seed ^ 0x811c9dc5u; for (int i = 0; i < n; i++) { x ^= p[i]; x *= 16777619u; } return x; }
static uint32_t hmachain(uint32_t key, const uint8_t *msg, int n) { uint32_t inner = h(msg, n, key); uint8_t b[4] = { (uint8_t)inner, (uint8_t)(inner>>8), (uint8_t)(inner>>16), (uint8_t)(inner>>24) }; return h(b, 4, key); }
int main(void) {
    int ok = 1;
    uint32_t key = 0xA5A5A5A5u;
    const uint8_t m1[] = "firmware";
    uint32_t mac1 = hmachain(key, m1, 8), mac2 = hmachain(key, m1, 8);
    printf("HMAC 可复现=%d\n", mac1 == mac2);
    if (mac1 != mac2) ok = 0;
    uint8_t bad[] = "firmwarE";   /* 改一个字节 */
    uint32_t mac3 = hmachain(key, bad, 8);
    printf("篡改后 MAC 变化=%d（期望 1）\n", mac1 != mac3);
    if (mac1 == mac3) ok = 0;
    uint32_t wrongkey = hmachain(0x5A5A5A5Au, m1, 8);
    printf("错误密钥 MAC 不同=%d（期望 1）\n", mac1 != wrongkey);
    if (mac1 == wrongkey) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
