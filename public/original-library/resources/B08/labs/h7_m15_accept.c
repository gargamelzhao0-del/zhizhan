/* h7_m15_accept.c —— H7 验收：复位来源与资源预算（Cortex-M7）。 */
#include "stm32_app.h"

int h7_accept_reset_clean(void) {
    return (RCC_CSR & (1u << 29)) ? 0 : 1;   /* 不应是看门狗复位：1=干净 */
}

int h7_accept_nvic_prio_ok(uint32_t basepri) {
    return (basepri == 0x50u) ? 1 : 0;       /* 与 configMAX_SYSCALL_INTERRUPT_PRIORITY 一致 */
}
