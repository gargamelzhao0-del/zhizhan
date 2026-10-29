/* esp_m08_wdt.c —— ESP32 任务看门狗与自恢复（Xtensa）。
 * 只监控注册过的关键任务；喂狗由被监控任务自己完成。 */
#include "esp_app.h"

void esp_wdt_watch_current(void) { (void)esp_task_wdt_add(0); }
void esp_wdt_kick(void) { (void)esp_task_wdt_reset(); }

void esp_recover_reset(void) { esp_restart(); }   /* 自恢复的最后手段：复位 */
