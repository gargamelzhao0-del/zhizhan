/* m14_ui_state.c —— 界面与应用状态分离（Cortex-M3）。
 * 状态结构是唯一真值；渲染函数只读状态、不反向改业务。 */
#include "app_api.h"

typedef struct { float temp; int16_t rh; ui_state_t st; } app_state_t;
static app_state_t g_state;

void ui_set_temp(float t) { g_state.temp = t; }
void ui_set_state(ui_state_t s) { g_state.st = s; }

/* 渲染：从状态读，输出到显示；不含业务逻辑 */
void ui_render(void) {
    char b[8] = "-----";
    b[0] = (char)('0' + (int)g_state.st);       /* 用状态码占位显示 */
    (void)display_clear();
    (void)display_text(0, 0, b);
    (void)display_flush();
}
