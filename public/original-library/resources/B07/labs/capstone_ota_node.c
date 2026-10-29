/* capstone_ota_node.c —— 贯穿项目骨架：可远程升级传感器节点（Cortex-M3 示范）。
 * 采样轮询（Modbus）与升级分块共用串口，用互斥量串行化；
 * 升级写入备用区，校验通过才切换；新固件自检通过前不确认（可回滚）。 */
#include <stdint.h>
#include "comm_api.h"
#include "rtos_cm.h"

static SemaphoreHandle_t g_bus;
static QueueHandle_t g_uplink;

typedef struct { uint16_t reg; uint16_t val; } sample_t;

static void poll_task(void *arg) {
    uint8_t req[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02};
    uint16_t c = crc16_modbus(req, 6);
    req[6] = (uint8_t)c; req[7] = (uint8_t)(c >> 8);
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_bus, pdMS_TO_TICKS(50)) == pdTRUE) {
            (void)uart_send(req, 8u);
            xSemaphoreGive(g_bus);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

static void ota_task(void *arg) {
    (void)arg;
    for (;;) {
        /* 收到命令：ota_begin(total, crc)；循环 uart_recv + ota_write；ota_finish() 校验并切换 */
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

static void mode_switch(int enter_ota) {
    cm_set_primask(enter_ota ? 1u : 0u);   /* 进入升级前后对关键窗口做保护（示意） */
}

void capstone_start(void) {
    g_bus = xSemaphoreCreateMutex();
    g_uplink = xQueueCreate(16u, (uint32_t)sizeof(sample_t));
    (void)g_uplink;
    (void)xTaskCreate(poll_task, "poll", 512u, 0, 3u, 0);
    (void)xTaskCreate(ota_task,  "ota",  768u, 0, 2u, 0);
    mode_switch(0);
}
