/* esp_m08_wdt.c —— 任务看门狗（ESP32 / Xtensa）。
 * 只监控注册过的关键任务；喂狗应由被监控任务自己做，而不是在别的任务里统一喂。 */
#include <stdint.h>
#include "esp_idf_api.h"

void esp_wdt_watch_current(void) {
    (void)esp_task_wdt_add(0);        /* 0 = 当前任务 */
}

void esp_wdt_kick(void) {
    (void)esp_task_wdt_reset();
}
