/* m10_node.c —— 可远程升级节点：轮询 + 升级并存（Cortex-M3）。
 * 共享同一路串口，用互斥量串行化；升级任务优先级低于轮询，避免长时间占线。 */
#include <stdint.h>
#include "comm_api.h"

static SemaphoreHandle_t g_uart;

static void poll_task(void *arg) {
    uint8_t req[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x01};
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_uart, portMAX_DELAY) == pdTRUE) {
            (void)uart_send(req, 6u);
            xSemaphoreGive(g_uart);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

static void ota_task(void *arg) {
    (void)arg;
    for (;;) {
        /* 收到升级命令后：ota_begin → ota_write 分块 → ota_finish（校验+切换） */
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void node_start(void) {
    g_uart = xSemaphoreCreateMutex();
    (void)xTaskCreate(poll_task, "poll", 512u, 0, 3u, 0);
    (void)xTaskCreate(ota_task,  "ota",  512u, 0, 2u, 0);
}
