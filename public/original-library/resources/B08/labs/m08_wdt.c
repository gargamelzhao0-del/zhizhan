/* m08_wdt.c —— 独立看门狗：按“所有关键任务都健康”才喂狗（Cortex-M3）。 */
#include "app_api.h"
#include "stm32_app.h"

void wdt_init(void) {
    IWDG_KR = IWDG_KEY_ENABLE;     /* 使能 */
    IWDG_PR = 4u;                  /* 预分频 */
    IWDG_RLR = 0xFFFu;             /* 重装载：约 1s+ */
    iwdg_kick();
}

void wdt_feed_if_healthy(int sensor_ok, int control_ok, int comm_ok) {
    if (sensor_ok && control_ok && comm_ok) iwdg_kick();   /* 任一心跳丢失则不喂 */
}
