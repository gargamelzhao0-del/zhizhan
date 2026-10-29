/* esp_m05_isr.c —— ESP32 的中断服务程序（Xtensa）。
 * ISR 必须放 IRAM（IRAM_ATTR），且只能调用 FromISR 版 API。 */
#include <stdint.h>
#include "esp_idf_api.h"
#include "rtos_api.h"

static QueueHandle_t g_q;

void IRAM_ATTR esp_gpio_isr(void *arg) {
    BaseType_t woken = pdFALSE;
    uint32_t level = 1u;
    (void)arg;
    (void)xQueueSendFromISR(g_q, &level, &woken);
    if (woken == pdTRUE) { portYIELD_FROM_ISR(woken); }
}

void esp_m05_install(void) {
    g_q = xQueueCreate(8u, (uint32_t)sizeof(uint32_t));
}
