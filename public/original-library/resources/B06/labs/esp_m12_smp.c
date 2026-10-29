/* esp_m12_smp.c —— SMP 与亲和（ESP32 / Xtensa）。
 * 任务可固定到某个核也可迁移；核间共享数据必须用 spinlock/原子，per-core 数据不要跨核访问。 */
#include <stdint.h>
#include "esp_idf_api.h"
#include "rtos_api.h"

static portMUX_TYPE g_spin = portMUX_INITIALIZER_UNLOCKED;
static volatile uint32_t g_cross;

static void core0_only(void *arg) {
    (void)arg;
    for (;;) {
        portENTER_CRITICAL(&g_spin);
        g_cross++;                      /* 跨核共享：短临界区 + 自旋锁 */
        portEXIT_CRITICAL(&g_spin);
        vTaskDelay(1);
    }
}
void esp_m12_start(void) {
    TaskHandle_t h = 0;
    (void)xTaskCreatePinnedToCore(core0_only, "c0", 4096u, 0, 3u, &h, 0);
}
