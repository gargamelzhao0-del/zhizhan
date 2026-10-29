/* m08_stackcheck.c —— 栈溢出检测与钩子（Cortex-M3）。
 * configCHECK_FOR_STACK_OVERFLOW=2 时，切换时检查任务栈末端画好的哨兵值；
 * 一旦被破坏就调用本钩子。溢出后继续运行只会更糟，通常应记录并复位。 */
#include <stdint.h>
#include "rtos_api.h"

volatile const char *g_overflow_task;

void vApplicationStackOverflowHook(TaskHandle_t t, char *name) {
    (void)t;
    g_overflow_task = name;       /* 记录是哪个任务栈溢出 */
    for (;;) { }                  /* 现场保留，交给复位/看门狗 */
}

/* 运行中查询某任务栈的“历史最少剩余”（单位：字，需 ×4 得字节） */
uint32_t m08_stack_free_bytes(TaskHandle_t t) {
    return (uint32_t)uxTaskGetStackHighWaterMark(t) * 4u;
}
