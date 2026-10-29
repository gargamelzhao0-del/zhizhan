/* m05_fromisr.c —— 中断与 RTOS 的边界（Cortex-M3）。
 * ISR 只做两件事：搬走数据、唤醒任务。临界区用 BASEPRI 只屏蔽到阈值，
 * 比阈值更紧急的中断仍可响应，实时性比“关总中断”好。 */
#include <stdint.h>
#include "rtos_cm.h"
#include "rtos_api.h"

static QueueHandle_t g_q;

void m05_isr_enqueue(uint16_t sample) {
    BaseType_t woken = pdFALSE;
    (void)xQueueSendFromISR(g_q, &sample, &woken);
    portYIELD_FROM_ISR(woken);
}

/* 任务里的短临界区：读一个共享寄存器 */
uint32_t m05_read_shared(volatile uint32_t *p) {
    uint32_t saved = cm_enter_critical();
    uint32_t v = *p;
    cm_exit_critical(saved);
    return v;
}

void m05_create(void) {
    g_q = xQueueCreate(8u, sizeof(uint16_t));
}
