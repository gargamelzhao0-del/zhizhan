/* m02_crc.c —— 硬件 CRC 与软件 CRC 并用（Cortex-M3）。
 * 硬件 CRC32：写数据寄存器，读结果；Modbus 用软件 CRC16（参数模型固定）。 */
#include <stdint.h>
#include "comm_api.h"
#include "stm32_comm.h"

uint32_t hw_crc32(const uint8_t *p, uint32_t n) {
    CRC_CR = 1u;                         /* RESET：清初值寄存器 */
    for (uint32_t i = 0; i < n; i++) { CRC_DR = p[i]; }
    return CRC_DR;
}

uint16_t frame_crc16(const uint8_t *p, uint32_t n) { return crc16_modbus(p, n); }
