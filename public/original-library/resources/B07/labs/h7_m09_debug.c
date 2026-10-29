/* h7_m09_debug.c —— FDCAN 错误计数（STM32H7 / Cortex-M7）。
 * PSR 里有 TEC/REC 与总线状态位：错误计数持续上升说明终端电阻/线缆/波特率有问题。 */
#include <stdint.h>
#include "comm_api.h"
#include "stm32_comm.h"

uint32_t h7_can_error_state(void) { return FDCAN_PSR; }

/* 提取接收/发送错误计数（示意字段，实际位域见参考手册） */
int h7_can_rec_error_count(void) { return (int)((FDCAN_PSR >> 8) & 0x7Fu); }
int h7_can_tec_error_count(void) { return (int)((FDCAN_PSR >> 16) & 0xFFu); }
