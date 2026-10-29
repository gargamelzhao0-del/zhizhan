/* m06_heap_static.c —— 静态创建任务：不碰堆（Cortex-M3）。
 * 栈与 TCB 在编译期分配；启动后不再 malloc，适合高可靠/安全场景。 */
#include <stdint.h>
#include "rtos_api.h"

static StackType_t g_stack[256];
static StaticTask_t g_tcb;

static void worker(void *arg) {
    (void)arg;
    for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); }
}

TaskHandle_t m06_create_static(void) {
    return xTaskCreateStatic(worker, "static", 256u, 0, 2u, g_stack, &g_tcb);
}
