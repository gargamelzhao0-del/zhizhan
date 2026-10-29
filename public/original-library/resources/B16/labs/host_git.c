/* host_git.c —— 内容寻址版本库：真实 Git blob 哈希（SHA-1）与提交链（主机可运行）。
 * Git 的对象名 = SHA1("<type> <len>\0" + 内容)；本程序实现 SHA-1 并据此计算 blob 名。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_git.c -o host_git && ./host_git
 */
#include <stdio.h>
#include <string.h>
#include <stdint.h>

/* ---- SHA-1（RFC 3174）---- */
typedef struct { uint32_t h[5]; uint64_t len; uint8_t buf[64]; size_t n; } sha1_t;
static uint32_t rol(uint32_t x, int n) { return (x << n) | (x >> (32 - n)); }
static void sha1_block(sha1_t *s, const uint8_t *p) {
    uint32_t w[80];
    for (int i = 0; i < 16; i++) w[i] = (uint32_t)p[i*4]<<24 | p[i*4+1]<<16 | p[i*4+2]<<8 | p[i*4+3];
    for (int i = 16; i < 80; i++) w[i] = rol(w[i-3]^w[i-8]^w[i-14]^w[i-16], 1);
    uint32_t a=s->h[0], b=s->h[1], c=s->h[2], d=s->h[3], e=s->h[4];
    for (int i = 0; i < 80; i++) {
        uint32_t f, k;
        if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        uint32_t t = rol(a,5) + f + e + k + w[i];
        e = d; d = c; c = rol(b,30); b = a; a = t;
    }
    s->h[0]+=a; s->h[1]+=b; s->h[2]+=c; s->h[3]+=d; s->h[4]+=e;
}
static void sha1_init(sha1_t *s) {
    s->h[0]=0x67452301; s->h[1]=0xEFCDAB89; s->h[2]=0x98BADCFE; s->h[3]=0x10325476; s->h[4]=0xC3D2E1F0;
    s->len=0; s->n=0;
}
static void sha1_update(sha1_t *s, const uint8_t *p, size_t n) {
    s->len += (uint64_t)n * 8;
    while (n) {
        size_t take = 64 - s->n; if (take > n) take = n;
        memcpy(s->buf + s->n, p, take); s->n += take; p += take; n -= take;
        if (s->n == 64) { sha1_block(s, s->buf); s->n = 0; }
    }
}
static void sha1_final(sha1_t *s, uint8_t out[20]) {
    uint64_t bits = s->len; uint8_t pad = 0x80;
    sha1_update(s, &pad, 1);
    uint8_t zero = 0; while (s->n != 56) sha1_update(s, &zero, 1);
    uint8_t lb[8];
    for (int i = 0; i < 8; i++) lb[i] = (uint8_t)(bits >> (56 - 8*i));
    sha1_update(s, lb, 8);
    for (int i = 0; i < 5; i++) { out[i*4]=s->h[i]>>24; out[i*4+1]=s->h[i]>>16; out[i*4+2]=s->h[i]>>8; out[i*4+3]=s->h[i]; }
}
/* Git blob 名：SHA1("blob <len>\0" + content) */
static void git_blob(const char *content, char hex[41]) {
    char hdr[32]; int hl = snprintf(hdr, sizeof(hdr), "blob %zu", strlen(content));
    sha1_t s; sha1_init(&s);
    sha1_update(&s, (const uint8_t*)hdr, (size_t)hl + 1);   /* 含结尾的 '\0' */
    sha1_update(&s, (const uint8_t*)content, strlen(content));
    uint8_t d[20]; sha1_final(&s, d);
    static const char *hx = "0123456789abcdef";
    for (int i = 0; i < 20; i++) { hex[i*2]=hx[d[i]>>4]; hex[i*2+1]=hx[d[i]&15]; }
    hex[40] = 0;
}
int main(void) {
    int ok = 1;
    char h1[41], h2[41], h3[41];
    git_blob("hello", h1); git_blob("hello", h2); git_blob("hello!", h3);
    printf("SHA1(\"blob 5\\0hello\") = %s\n", h1);
    printf("相同内容哈希相同=%d 不同内容哈希不同=%d\n", strcmp(h1,h2)==0, strcmp(h1,h3)!=0);
    /* 已知值：git hash-object 对 "hello" 的结果 */
    if (strcmp(h1, "b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0") != 0) ok = 0;
    if (!(strcmp(h1,h2)==0 && strcmp(h1,h3)!=0)) ok = 0;
    /* 提交链：提交对象记录父提交，形成可追溯历史 */
    struct { const char *id; const char *parent; } c1 = {"c1", "(root)"}, c2 = {"c2", "c1"};
    printf("提交链 %s(parent=%s) → %s(parent=%s)\n", c1.id, c1.parent, c2.id, c2.parent);
    if (strcmp(c2.parent, c1.id) != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
