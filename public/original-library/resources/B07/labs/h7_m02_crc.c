/* h7_m02_crc.c —— H7 侧校验（Cortex-M7）。
 * 除软件 CRC16 外，镜像完整性用 CRC32；若用硬件 CRC 单元，注意它是共享外设，
 * 多任务/多核并发使用要加锁，且改写前必须复位初值。 */
#include <stdint.h>
#include "comm_api.h"

uint16_t h7_frame_crc16(const uint8_t *p, size_t n) { return crc16_modbus(p, n); }
uint32_t h7_image_crc32(const uint8_t *p, size_t n) { return crc32_ieee(p, n); }
