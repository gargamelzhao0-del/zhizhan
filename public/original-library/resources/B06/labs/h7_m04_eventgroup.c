/* h7_m04_eventgroup.c —— 事件组：一个任务等待多个事件同时满足（STM32H7）。
 * 比“多个信号量”更省对象，也便于表达“全部就绪才开始”。 */
#include <stdint.h>
#include "rtos_api.h"

#define EVT_NET  (1u << 0)
#define EVT_SENS (1u << 1)
#define EVT_CFG  (1u << 2)
static EventGroupHandle_t g_eg;

static void app(void *arg) {
    (void)arg;
    const EventBits_t need = EVT_NET | EVT_SENS | EVT_CFG;
    for (;;) {
        EventBits_t got = xEventGroupWaitBits(g_eg, need, pdFALSE, pdTRUE, pdMS_TO_TICKS(5000));
        if ((got & need) == need) {
            /* 三个前置都就绪：进入主流程 */
        } else {
            /* 超时：降级或重试 */
        }
    }
}

void h7_m04_create(void) {
    g_eg = xEventGroupCreate();
    (void)xTaskCreate(app, "app", 256u, 0, 3u, 0);
}
