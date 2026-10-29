/* m09_board.c —— 首板上电自检顺序（Cortex-M3）。
 * 顺序：电源稳定 → 时钟起振 → 调试口可用 → 逐个外设探测。 */
#include "app_api.h"

int board_bringup(void) {
    float t = 0.0f, rh = 0.0f;
    if (sensor_read(&t, &rh) != 0) return -1;   /* 传感器无响应：先查供电/上拉/地址 */
    if (display_clear() != 0) return -2;         /* 显示无响应：查电源与 SPI/I²C */
    (void)display_text(0, 0, "OK");
    return (int)display_flush();
}
