/* esp_m14_lvgl.c —— ESP32 用 LVGL 渲染（Xtensa）。
 * 界面任务只做“重绘一帧”，业务状态由上层更新。 */
#include "esp_app.h"
#include "app_api.h"

void esp_ui_task(void *arg) {
    (void)arg;
    for (;;) {
        lv_timer_handler();                  /* 处理一帧事件与刷新 */
        vTaskDelay(pdMS_TO_TICKS(30));
    }
}
