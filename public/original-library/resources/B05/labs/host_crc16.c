/* host_crc16.c — CRC16-CCITT(FALSE) 自检（gcc 主机运行）
 * 与“设备端存储/协议校验”共用同一算法，用已知向量 0x29B1 对齐。 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint16_t crc16_ccitt(const uint8_t *p, uint32_t n)
{
    uint16_t crc = 0xFFFFu;
    for (uint32_t i = 0u; i < n; ++i) {
        crc ^= (uint16_t)p[i] << 8;
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 0x8000u) ? (uint16_t)((crc << 1) ^ 0x1021u)
                                  : (uint16_t)(crc << 1);
        }
    }
    return crc;
}

int main(void)
{
    const char *check = "123456789";
    uint16_t got = crc16_ccitt((const uint8_t *)check, (uint32_t)strlen(check));
    printf("crc16(\"%s\") = 0x%04X (expect 0x29B1)\n", check, got);
    int ok = (got == 0x29B1u);
    printf(ok ? "RESULT: PASS\n" : "RESULT: FAIL\n");
    return ok ? 0 : 1;
}
