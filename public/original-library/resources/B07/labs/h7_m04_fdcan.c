/* h7_m04_fdcan.c —— FDCAN 初始化骨架（STM32H7 / Cortex-M7）。
 * CAN-FD 支持更大载荷；位定时在 NBTP，收发描述符放在消息 RAM。 */
#include <stdint.h>
#include "comm_api.h"
#include "stm32_comm.h"

void h7_fdcan_init(void) {
    FDCAN_CCCR |= (1u << 0);            /* INIT：进入初始化 */
    FDCAN_CCCR |= (1u << 1);            /* CCE：允许写配置寄存器 */
    FDCAN_NBTP  = (4u << 16) | (14u << 8) | (1u << 0);   /* 示例：标称位定时字段 */
    FDCAN_CCCR &= ~(1u << 1);           /* 关闭配置使能 */
    FDCAN_CCCR &= ~(1u << 0);           /* 退出初始化 */
    while (FDCAN_CCCR & 1u) { }
}

uint32_t h7_fdcan_error_counters(void) {
    return FDCAN_PSR;                   /* 读取 REC/TEC 等错误计数用于总线诊断 */
}
