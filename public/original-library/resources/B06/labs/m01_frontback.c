/* m01_frontback.c —— 前后台轮询 vs RTOS：响应抖动的来源（Cortex-M3）。
 * 用 DWT 周期计数器当硬件秒表，量化“慢任务阻塞快任务”的代价。 */
#include <stdint.h>
#include "rtos_cm.h"
#include "rtos_api.h"

#define DEMCR      (*(volatile uint32_t *)0xE000EDFCu)   /* 调试异常控制：bit24 = CYCCNT 使能 */
#define DWT_CYCCNT (*(volatile uint32_t *)0xE0001004u)   /* 周期计数器 */

void m01_cycles_on(void) { DEMCR |= (1u << 24); DWT_CYCCNT = 0u; }

volatile uint32_t g_fast_period;   /* 快任务两次被服务之间的间隔（周期） */

/* 前后台：快任务与慢任务挤在同一个循环里，慢任务直接把快任务的响应周期拉长 */
void m01_superloop(void) {
    for (;;) {
        uint32_t t0 = DWT_CYCCNT;
        g_fast_period = DWT_CYCCNT - t0;          /* 快任务：应立即处理 */
        uint32_t t1 = DWT_CYCCNT;
        while ((DWT_CYCCNT - t1) < 72000u) { }    /* 慢任务：约 1ms@72MHz 的阻塞 */
    }
}

/* RTOS：快任务独立调度，响应周期不再被慢任务决定 */
static void m01_fast_task(void *arg) {
    (void)arg;
    for (;;) { vTaskDelay(pdMS_TO_TICKS(1)); }
}
void m01_start(void) {
    TaskHandle_t h = 0;
    (void)xTaskCreate(m01_fast_task, "fast", 256u, 0, 2u, &h);
}
