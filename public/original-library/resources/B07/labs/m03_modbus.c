/* m03_modbus.c —— 组 Modbus RTU 请求并发送（Cortex-M3）。
 * 帧：addr|func|reg_hi|reg_lo|qty_hi|qty_lo|crc_lo|crc_hi。 */
#include <stdint.h>
#include "comm_api.h"

int modbus_read_holding(uint8_t addr, uint16_t reg, uint16_t qty) {
    uint8_t f[8];
    f[0] = addr;
    f[1] = 0x03;                         /* 功能码：读保持寄存器 */
    f[2] = (uint8_t)(reg >> 8);
    f[3] = (uint8_t)reg;
    f[4] = (uint8_t)(qty >> 8);
    f[5] = (uint8_t)qty;
    uint16_t c = crc16_modbus(f, 6);
    f[6] = (uint8_t)(c & 0xFF);          /* Modbus：CRC 低字节在前 */
    f[7] = (uint8_t)(c >> 8);
    return uart_send(f, 8u);
}
