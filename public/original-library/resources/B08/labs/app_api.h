/* app_api.h —— 本册自带的“应用层”接口子集（仅声明，供交叉编译做语法/调用约定验证）。
 * 覆盖按键/显示/存储/传感/电机/电源/参数；真实平台上由 HAL/IDF/驱动提供。 */
#ifndef APP_API_H
#define APP_API_H

#include <stdint.h>
#include <stddef.h>
#include "rtos_api.h"

typedef enum { KEY_NONE = 0, KEY_SHORT, KEY_LONG, KEY_DOUBLE } key_event_t;
typedef enum { ST_BOOT = 0, ST_IDLE, ST_RUN, ST_FAULT, ST_SLEEP } ui_state_t;

int  key_poll(key_event_t *out);            /* 1=有事件 */

int  display_clear(void);
int  display_text(int x, int y, const char *s);
int  display_flush(void);

int  storage_read(uint32_t addr, void *buf, size_t n);
int  storage_write(uint32_t addr, const void *buf, size_t n);
int  storage_sync(void);

int  sensor_read(float *temp_c, float *rh_pct);
int  motor_set_pwm(int permille);           /* 0..1000 */
int  motor_get_encoder(void);

int  power_set_mode(int mode);              /* 0=run 1=stop 2=standby */
uint32_t power_microamp(void);

int  params_load(void);
int  params_save(void);

#endif /* APP_API_H */
