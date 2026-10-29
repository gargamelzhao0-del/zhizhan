/* h7_m10_priority.c —— 优先级分配原则（STM32H7 / Cortex-M7）。
 * 越“靠近截止期、越不能被延迟”的任务优先级越高；共享资源时注意优先级反转。 */
#include "rtos_api.h"

void h7_m10_assign(void) {
    /* 例：控制周期 1ms > 通信 10ms > 显示 100ms */
    (void)xTaskCreate((TaskFunction_t)0, "ctrl", 512u, 0, 5u, 0);
    (void)xTaskCreate((TaskFunction_t)0, "comm", 512u, 0, 3u, 0);
    (void)xTaskCreate((TaskFunction_t)0, "disp", 256u, 0, 1u, 0);
}
