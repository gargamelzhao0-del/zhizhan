/* esp_m03_intr.c — ESP32 中断：没有 NVIC，用中断分配器把外设信号绑到某个核
 * 与 Cortex-M 的“固定向量 + 优先级分组”是两种模型。 */
#include "esp32_regs.h"

typedef void (*esp_isr_t)(void *arg);

/* ESP-IDF：esp_intr_alloc(source, flags, handler, arg, handle) */
extern int esp_intr_alloc(int source, int flags, esp_isr_t handler, void *arg, void **handle);
extern void esp_intr_free(void *handle);

int esp_bind_isr(int source, esp_isr_t handler, void *arg)
{
    return esp_intr_alloc(source, 0, handler, arg, (void **)0);
}

/* 双核：可指定 ISR 跑在 PRO_CPU(0) 或 APP_CPU(1)。
 * 跨核/与任务共享数据时，用 memw 或原子，而不是像 Cortex-M 那样只靠 PRIMASK。 */
void esp_isr_memory_barrier(void) { esp_memw(); }

/* 关中断用临界区（portENTER_CRITICAL），它不是简单的“关全局中断”语义 */
extern void esp_port_enter_critical(void);
extern void esp_port_exit_critical(void);
void esp_critical_demo(void) { esp_port_enter_critical(); esp_memw(); esp_port_exit_critical(); }
