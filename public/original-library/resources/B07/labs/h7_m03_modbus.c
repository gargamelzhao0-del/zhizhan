/* h7_m03_modbus.c —— H7 侧解析 Modbus 响应（Cortex-M7）。
 * 校验整帧 CRC（含 CRC 再算应为 0）；功能码最高位置 1 表示异常。 */
#include <stdint.h>
#include "comm_api.h"

/* 返回 0=正常（regs[0..n) 有效），正数=异常码，-1=CRC 错 */
int h7_modbus_parse(const uint8_t *f, int n, uint16_t *regs, int max) {
    if (n < 5) return -1;
    uint16_t c = crc16_modbus(f, (size_t)(n - 2));
    if ((uint16_t)(f[n - 2] | (f[n - 1] << 8)) != c) return -1;   /* CRC 失败 */
    if (f[1] & 0x80) return f[2];                                  /* 异常响应 */
    int bc = f[2];
    int cnt = bc / 2;
    for (int i = 0; i < cnt && i < max; i++)
        regs[i] = (uint16_t)((f[3 + 2 * i] << 8) | f[4 + 2 * i]);   /* 线上大端 */
    return 0;
}
