/* m12_battery.c —— 综合项目 C：低功耗电池设备（Cortex-M3）。
 * 每个周期：唤醒 → 采样 → 上报 → 回睡；把“醒着的时间”压到最短。 */
#include <stdint.h>
#include "app_api.h"

void battery_cycle_once(void) {
    float t = 0.0f, rh = 0.0f;
    (void)sensor_read(&t, &rh);          /* 醒来后尽快完成必要动作 */
    (void)power_set_mode(2);             /* 进入 standby */
}
