/* h7_m14_ui.c —— H7 帧缓冲 + 脏标志刷新（Cortex-M7）。
 * 只有状态变化时标记脏，刷新函数在脏时才真正推屏，降低总线与 CPU 开销。 */
#include "app_api.h"

static volatile int g_dirty = 1;

void h7_ui_mark_dirty(void) { g_dirty = 1; }

int h7_ui_flush(void) {
    if (!g_dirty) return 0;          /* 无变化：跳过刷新 */
    g_dirty = 0;
    return (int)display_flush();
}
