/* esp_m03_critical.c —— 双核临界区必须用 portMUX（ESP32 / Xtensa）。
 * 单核只关中断就够；双核还要阻止另一个核同时进入，所以用 portMUX_TYPE。 */
#include "esp_idf_api.h"

static portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;
static volatile int g_shared = 0;

void esp_shared_bump(void) {
    portENTER_CRITICAL(&g_mux);
    g_shared++;                       /* 临界区：本核不被调度打断，且另一个核被挡在自旋锁外 */
    portEXIT_CRITICAL(&g_mux);
}

int esp_shared_read(void) {
    int v;
    portENTER_CRITICAL(&g_mux);
    v = g_shared;
    portEXIT_CRITICAL(&g_mux);
    return v;
}
