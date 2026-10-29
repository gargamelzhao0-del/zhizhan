/* m03_ui.c —— 按键事件驱动的菜单栈（Cortex-M3）。
 * 长按返回上一级、短按进入下一级；界面逻辑只消费“语义事件”，不碰原始电平。 */
#include "app_api.h"

#define MENU_DEPTH 4
static int g_stack[MENU_DEPTH];
static int g_top;

void ui_init(void) { g_top = 0; }

void ui_on_key(key_event_t k) {
    if (k == KEY_LONG)  { if (g_top > 0) g_top--; }
    if (k == KEY_SHORT) { if (g_top < MENU_DEPTH - 1) g_stack[g_top++] = 0; }
    if (k == KEY_DOUBLE) { g_top = 0; }          /* 双击回主界面 */
}

int ui_depth(void) { return g_top; }
