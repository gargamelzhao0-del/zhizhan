/* esp_m02_crc.c —— ESP32 侧校验（Xtensa）。
 * Modbus 用软件 CRC16（查表）；固件镜像用 CRC32。二者参数模型必须与对端一致。 */
#include <stdint.h>
#include "esp_comm.h"
#include "comm_api.h"

uint16_t esp_modbus_crc(const uint8_t *p, size_t n) { return crc16_modbus(p, n); }
uint32_t esp_image_crc(const uint8_t *p, size_t n)  { return crc32_ieee(p, n); }
