/* m04_can.c —— bxCAN 初始化与发送（Cortex-M3）。
 * 位定时 500kbps（见 stm32_comm.h）；标准帧写入邮箱后置 TXRQ 触发发送。 */
#include <stdint.h>
#include "comm_api.h"
#include "stm32_comm.h"

void can500_init(void) {
    bxcan_set_500k();
    (void)can_accept_filter(0x100u, 0x700u);   /* 只收 0x100..0x1FF */
}

int can_tx_std(uint16_t id, const uint8_t *d, uint8_t dlc) {
    uint32_t lo = 0u, hi = 0u;
    for (int i = 0; i < 4; i++) {
        lo |= (uint32_t)((i < dlc) ? d[i] : 0u) << (8 * i);
        hi |= (uint32_t)((i + 4 < dlc) ? d[i + 4] : 0u) << (8 * i);
    }
    CAN1_TI0R  = ((uint32_t)id << 21);         /* 标准帧，ID 在 [31:21] */
    CAN1_TDT0R = dlc;
    CAN1_TDL0R = lo;
    CAN1_TDH0R = hi;
    CAN1_TI0R |= 0x1u;                         /* TXRQ：请求发送 */
    return 0;
}
