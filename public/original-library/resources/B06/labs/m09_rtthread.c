/* m09_rtthread.c —— RT-Thread 侧写法（对象化 API）。
 * 线程有独立栈，信号量/互斥量都是内核对象，带名字便于 shell(msh) 调试。 */
#include "rtthread_api.h"

static rt_sem_t g_ready;

static void worker(void *param) {
    (void)param;
    for (;;) {
        rt_sem_take(g_ready, RT_WAITING_FOREVER);
        /* 事件处理 */
    }
}

void m09_rtthread_start(void) {
    g_ready = rt_sem_create("ready", 0, 0);
    rt_thread_t t = rt_thread_create("worker", worker, 0, 2048u, 10u, 20u);
    if (t) { (void)rt_thread_startup(t); }
}
