/* esp_m03_modbus.c —— ESP32 侧发 Modbus 请求（Xtensa）。
 * 组帧逻辑与设备端一致；发送走 UART 驱动。 */
#include <stdint.h>
#include "esp_comm.h"
#include "comm_api.h"

int esp_modbus_read(uint8_t addr, uint16_t reg, uint16_t qty) {
    uint8_t f[8];
    f[0] = addr; f[1] = 0x03;
    f[2] = (uint8_t)(reg >> 8); f[3] = (uint8_t)reg;
    f[4] = (uint8_t)(qty >> 8); f[5] = (uint8_t)qty;
    uint16_t c = crc16_modbus(f, 6);
    f[6] = (uint8_t)c; f[7] = (uint8_t)(c >> 8);
    return uart_write_bytes(1, f, 8u);
}
