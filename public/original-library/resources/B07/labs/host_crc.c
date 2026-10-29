/* host_crc.c —— 校验和/CRC8/CRC16/CRC32：位运算版与查表版等价性（主机可运行）。
 *
 * 覆盖协议里最常见的三种 CRC 参数模型，并用标准检查值 "123456789" 断言：
 *   CRC-8   (poly 0x07, init 0x00)            → 0xF4
 *   CRC-16/MODBUS (poly 0xA001 反射, init 0xFFFF) → 0x4B37
 *   CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) → 0x29B1
 *   CRC-32/ISO-HDLC (poly 0xEDB88320 反射)    → 0xCBF43926
 * 同时验证“查表版 == 位运算版”，这是把 CRC 换成查表/硬件前必须先做的对拍。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_crc.c -o host_crc && ./host_crc
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint8_t crc8_bit(const uint8_t *p, int n) {
    uint8_t c = 0x00;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 0x80) ? (uint8_t)((c << 1) ^ 0x07) : (uint8_t)(c << 1);
    }
    return c;
}
static uint16_t crc16_modbus_bit(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}
static uint16_t crc16_ccitt_bit(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= (uint16_t)(p[i] << 8);
        for (int b = 0; b < 8; b++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
    }
    return c;
}
static uint32_t crc32_bit(const uint8_t *p, int n) {
    uint32_t c = 0xFFFFFFFFu;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? ((c >> 1) ^ 0xEDB88320u) : (c >> 1);
    }
    return c ^ 0xFFFFFFFFu;
}

/* 查表版：先建表，再按字节喂入 */
static uint16_t tbl16[256];
static void build_table16(void) {
    for (int i = 0; i < 256; i++) {
        uint16_t c = (uint16_t)i;
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
        tbl16[i] = c;
    }
}
static uint16_t crc16_modbus_tab(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) c = (uint16_t)((c >> 8) ^ tbl16[(c ^ p[i]) & 0xFF]);
    return c;
}

int main(void) {
    const char *s = "123456789";
    const uint8_t *p = (const uint8_t *)s;
    int n = (int)strlen(s);
    int ok = 1;

    uint8_t c8 = crc8_bit(p, n);
    uint16_t m = crc16_modbus_bit(p, n);
    uint16_t cc = crc16_ccitt_bit(p, n);
    uint32_t c32 = crc32_bit(p, n);
    printf("检查值 \"%s\"：CRC8=0x%02X  CRC16/MODBUS=0x%04X  CRC16/CCITT=0x%04X  CRC32=0x%08X\n",
           s, c8, m, cc, c32);
    if (c8 != 0xF4) ok = 0;
    if (m != 0x4B37) ok = 0;
    if (cc != 0x29B1) ok = 0;
    if (c32 != 0xCBF43926u) ok = 0;

    build_table16();
    uint16_t mt = crc16_modbus_tab(p, n);
    printf("查表版 CRC16/MODBUS=0x%04X（应与位运算版一致）\n", mt);
    if (mt != m) ok = 0;

    /* 单比特错误必须改变 CRC（否则检错能力有问题） */
    uint8_t bad[9];
    memcpy(bad, s, 9);
    bad[3] ^= 0x01;
    printf("翻转 1 位后 CRC16/MODBUS=0x%04X（应与原始不同）\n", crc16_modbus_bit(bad, n));
    if (crc16_modbus_bit(bad, n) == m) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
