/* esp_m03_ui.c —— ESP32 界面：GPIO 读按键 + LVGL 渲染（Xtensa）。 */
#include "esp_app.h"
#include "app_api.h"

static gpio_config_t g_btn = { .pin = 0, .mode = 0 };

void esp_ui_init(void) { (void)gpio_config(&g_btn); }

void esp_ui_render(const char *txt) {
    void *lbl = lv_obj_create(0);
    lv_label_set_text(lbl, txt);
    lv_timer_handler();                 /* 刷新一帧 */
}
