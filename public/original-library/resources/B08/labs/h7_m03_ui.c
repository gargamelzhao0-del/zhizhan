/* h7_m03_ui.c —— H7 界面：旋转编码器 + OLED 文本（Cortex-M7）。 */
#include "app_api.h"

static int g_pos;

void h7_encoder_delta(int d) { g_pos += d; }
int  h7_encoder_pos(void) { return g_pos; }

void h7_oled_show(const char *s) {
    (void)display_clear();
    (void)display_text(0, 0, s);
    (void)display_flush();
}
