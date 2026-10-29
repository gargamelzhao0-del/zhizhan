/* h7_m02_skeleton.c —— H7 工程骨架：统一断言与故障记录（Cortex-M7）。 */
#include "app_api.h"
#include "rtos_cm.h"

volatile uint32_t g_assert_line;
volatile const char *g_assert_file;

void app_assert_failed(const char *expr, const char *file, int line) {
    (void)expr;
    g_assert_file = file;
    g_assert_line = (uint32_t)line;
    cm_set_primask(1u);          /* 关中断，保留现场，交给看门狗复位 */
    for (;;) { }
}
