/* esp_m09_zephyr.c —— Zephyr 侧写法（静态内核对象 + k_ 前缀 API）。
 * 内核对象在编译期定义，配置来自 Kconfig/设备树；线程栈也静态分配。 */
#include "zephyr_api.h"

K_SEM_DEFINE(g_ready, 0, 1);

static void worker(void *p1, void *p2, void *p3) {
    (void)p1; (void)p2; (void)p3;
    for (;;) {
        (void)k_sem_take(&g_ready, K_FOREVER);
        /* 事件处理 */
    }
}

static struct k_thread g_thread;
static K_THREAD_STACK_DEFINE(g_stack, 2048);

void esp_m09_start(void) {
    (void)k_thread_create(&g_thread, g_stack, K_THREAD_STACK_SIZEOF(g_stack),
                          worker, 0, 0, 0, 5, 0u, K_NO_WAIT);
}
