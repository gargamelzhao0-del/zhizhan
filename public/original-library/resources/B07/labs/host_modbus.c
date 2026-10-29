/* host_modbus.c —— Modbus RTU 帧构造/解析与 CRC 自洽（主机可运行）。
 *
 * Modbus RTU 的不变量：把 CRC 也算进去后，整帧再算一遍 CRC16/MODBUS 必须等于 0。
 * 本程序据此校验请求帧，并解析一条正常响应与一条异常响应。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_modbus.c -o host_modbus && ./host_modbus
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}
static int append_crc(uint8_t *f, int n) {
    uint16_t c = crc16(f, n);
    f[n++] = (uint8_t)(c & 0xFF);        /* Modbus：低字节在前 */
    f[n++] = (uint8_t)(c >> 8);
    return n;
}
static void print_hex(const char *tag, const uint8_t *p, int n) {
    printf("%s", tag);
    for (int i = 0; i < n; i++) printf("%02X%s", p[i], i + 1 < n ? " " : "");
    printf("\n");
}

int main(void) {
    int ok = 1, n;
    uint8_t req[16];

    /* 请求：从站 1，功能 0x03（读保持寄存器），起始 0x0000，数量 0x000A */
    n = 0;
    req[n++] = 0x01; req[n++] = 0x03;
    req[n++] = 0x00; req[n++] = 0x00;
    req[n++] = 0x00; req[n++] = 0x0A;
    n = append_crc(req, n);
    print_hex("请求帧: ", req, n);
    printf("整帧 CRC 自洽（含 CRC 再算=0）：%s\n", crc16(req, n) == 0 ? "是" : "否");
    if (n != 8 || crc16(req, n) != 0) ok = 0;

    /* 正常响应：01 03 04 AA BB CC DD + CRC → 两个 16 位寄存器 0xAABB、0xCCDD（线上大端） */
    uint8_t resp[16]; int rn = 0;
    resp[rn++] = 0x01; resp[rn++] = 0x03; resp[rn++] = 0x04;
    resp[rn++] = 0xAA; resp[rn++] = 0xBB; resp[rn++] = 0xCC; resp[rn++] = 0xDD;
    rn = append_crc(resp, rn);
    print_hex("响应帧: ", resp, rn);
    if (crc16(resp, rn) != 0) ok = 0;
    int bc = resp[2];
    uint16_t v0 = (uint16_t)((resp[3] << 8) | resp[4]);
    uint16_t v1 = (uint16_t)((resp[5] << 8) | resp[6]);
    printf("字节数=%d 寄存器0=0x%04X 寄存器1=0x%04X（期望 0xAABB / 0xCCDD）\n", bc, v0, v1);
    if (!(bc == 4 && v0 == 0xAABB && v1 == 0xCCDD)) ok = 0;

    /* 异常响应：功能码最高位置 1，异常码 0x02（非法数据地址） */
    uint8_t exc[8]; int en = 0;
    exc[en++] = 0x01; exc[en++] = 0x83; exc[en++] = 0x02;
    en = append_crc(exc, en);
    print_hex("异常帧: ", exc, en);
    int is_exc = (exc[1] & 0x80) != 0;
    printf("是否异常响应=%s 异常码=0x%02X（期望异常、0x02）\n", is_exc ? "是" : "否", exc[2]);
    if (!(is_exc && exc[2] == 0x02)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
