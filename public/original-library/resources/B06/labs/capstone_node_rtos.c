/* capstone_node_rtos.c —— 贯穿项目骨架：环境采集终端的 RTOS 化（Cortex-M3 示范）。
 * sensor(高) → queue → process(中) → queue → comms(低)；I²C 用互斥量保护，通信任务负责上报与喂狗。 */
#include <stdint.h>
#include "rtos_api.h"
#include "rtos_cm.h"

typedef struct { int16_t t; uint16_t v; } sample_t;
static QueueHandle_t g_raw, g_tx;
static SemaphoreHandle_t g_i2c;

static void sensor_task(void *arg) {
    sample_t s; (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_i2c, pdMS_TO_TICKS(5)) == pdTRUE) {
            s.t = 0; s.v = 0;                              /* 读传感器 */
            (void)xSemaphoreGive(g_i2c);
            (void)xQueueSend(g_raw, &s, pdMS_TO_TICKS(5));
        }
        vTaskDelay(pdMS_TO_TICKS(100));                    /* 100ms 采样周期 */
    }
}
static void process_task(void *arg) {
    sample_t s; (void)arg;
    for (;;) {
        if (xQueueReceive(g_raw, &s, portMAX_DELAY) == pdTRUE) {
            (void)xQueueSend(g_tx, &s, pdMS_TO_TICKS(50));
        }
    }
}
static void comms_task(void *arg) {
    sample_t s; (void)arg;
    for (;;) {
        if (xQueueReceive(g_tx, &s, pdMS_TO_TICKS(1000)) == pdTRUE) {
            /* 上报成功后才喂狗；超时说明链路异常 */
        }
    }
}
void capstone_start(void) {
    g_raw = xQueueCreate(8u, (uint32_t)sizeof(sample_t));
    g_tx  = xQueueCreate(8u, (uint32_t)sizeof(sample_t));
    g_i2c = xSemaphoreCreateMutex();
    (void)xTaskCreate(sensor_task,  "sensor",  512u, 0, 4u, 0);
    (void)xTaskCreate(process_task, "process", 512u, 0, 3u, 0);
    (void)xTaskCreate(comms_task,   "comms",   768u, 0, 2u, 0);
}
