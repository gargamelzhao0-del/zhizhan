/* esp_app.h —— ESP-IDF（ESP32 / Xtensa）应用相关接口子集（仅声明）。 */
#ifndef ESP_APP_H
#define ESP_APP_H

#include <stdint.h>
#include <stddef.h>
#include "rtos_api.h"

typedef int esp_err_t;
#define ESP_OK 0

/* NVS 持久化 */
typedef int32_t nvs_handle_t;
esp_err_t nvs_open(const char *ns, int mode, nvs_handle_t *out);
esp_err_t nvs_set_blob(nvs_handle_t h, const char *key, const void *data, size_t len);
esp_err_t nvs_get_blob(nvs_handle_t h, const char *key, void *data, size_t *len);
esp_err_t nvs_set_u16(nvs_handle_t h, const char *key, uint16_t v);
esp_err_t nvs_get_u16(nvs_handle_t h, const char *key, uint16_t *v);
esp_err_t nvs_commit(nvs_handle_t h);

/* LEDC 硬件 PWM */
void ledc_set_duty(int speed_mode, int channel, uint32_t duty);
void ledc_update_duty(int speed_mode, int channel);
void ledc_timer_config(const void *cfg);
void ledc_channel_config(const void *cfg);

/* 电源与休眠 */
esp_err_t esp_sleep_enable_timer_wakeup(uint64_t us);
void      esp_deep_sleep_start(void);
void      esp_restart(void);
int64_t   esp_timer_get_time(void);

/* GPIO / 看门狗 */
typedef struct { int pin; int mode; } gpio_config_t;
esp_err_t gpio_set_level(int gpio, int level);
esp_err_t gpio_config(const gpio_config_t *cfg);
int       esp_task_wdt_add(void *handle);
int       esp_task_wdt_reset(void);

/* 无线（用于联网/上报） */
int esp_wifi_sta_get_rssi(void);

BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char *name, uint32_t stack,
                                   void *arg, UBaseType_t prio, TaskHandle_t *out, BaseType_t core);

/* LVGL（界面）—— 仅为示例声明 */
typedef struct { int dummy; } lv_disp_drv_t;
void *lv_obj_create(void *parent);
void  lv_label_set_text(void *label, const char *txt);
void  lv_timer_handler(void);

#endif /* ESP_APP_H */
