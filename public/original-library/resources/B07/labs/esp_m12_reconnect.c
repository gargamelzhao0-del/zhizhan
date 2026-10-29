/* esp_m12_reconnect.c —— 断连事件触发指数退避重连（ESP32 / Xtensa）。
 * 连接失败/断开时不要立刻重连，按退避时间等待并更新状态。 */
#include "esp_comm.h"
#include "comm_api.h"

static uint32_t backoff_ms(int attempt) {
    uint32_t v = 100u << attempt;
    return v > 30000u ? 30000u : v;
}

void esp_on_disconnect(int *attempt) {
    uint32_t wait = backoff_ms(*attempt);
    (*attempt)++;
    vTaskDelay(pdMS_TO_TICKS(wait));
    (void)esp_wifi_connect();
    if (*attempt > 8) *attempt = 8;      /* 退避封顶，避免无限增长 */
}
