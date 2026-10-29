/* h7_m10_env.c —— H7 综合项目 A：采集 + 存储 + 以太网上报（Cortex-M7）。 */
#include <stdint.h>
#include "app_api.h"

static QueueHandle_t g_log;

void h7_env_start(void) {
    g_log = xQueueCreate(16u, (uint32_t)sizeof(float));
    (void)g_log;
    (void)xTaskCreate((TaskFunction_t)0, "env", 512u, 0, 3u, 0);
}
