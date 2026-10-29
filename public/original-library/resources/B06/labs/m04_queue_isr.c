/* m04_queue_isr.c —— 队列按值拷贝 + 中断里入队（Cortex-M3）。
 * 中断只做“搬数据 + 设唤醒标志”；FromISR 后按标志决定是否 portYIELD_FROM_ISR。 */
#include <stdint.h>
#include "rtos_api.h"

typedef struct { uint16_t adc; uint32_t tick; } sample_t;
static QueueHandle_t g_q;

void m04_uart_isr(void) {
    sample_t s;
    BaseType_t woken = pdFALSE;
    s.adc  = 0x0FFFu;                     /* 从外设寄存器取样本 */
    s.tick = xTaskGetTickCount();
    (void)xQueueSendFromISR(g_q, &s, &woken);
    portYIELD_FROM_ISR(woken);            /* 唤醒了更高优先级任务就立刻切换 */
}

static void consumer(void *arg) {
    sample_t s;
    (void)arg;
    for (;;) {
        if (xQueueReceive(g_q, &s, portMAX_DELAY) == pdTRUE) {
            /* 处理样本；队列已拷贝，s 是安全副本 */
        }
    }
}

void m04_create(void) {
    g_q = xQueueCreate(16u, (uint32_t)sizeof(sample_t));
    (void)xTaskCreate(consumer, "cons", 256u, 0, 4u, 0);
}
