/* rtthread_api.h —— RT-Thread 侧用到的接口子集（仅声明，供交叉编译验证）。 */
#ifndef RTTHREAD_API_H
#define RTTHREAD_API_H

#include <stdint.h>

struct rt_thread;
struct rt_sem;

typedef struct rt_thread *rt_thread_t;
typedef struct rt_sem    *rt_sem_t;
typedef int               rt_err_t;
typedef uint32_t          rt_tick_t;

#define RT_WAITING_FOREVER (-1)
#define RT_EOK             0

rt_thread_t rt_thread_create(const char *name, void (*entry)(void *), void *param,
                             uint32_t stack, uint8_t prio, uint32_t tick);
rt_err_t    rt_thread_startup(rt_thread_t t);
rt_err_t    rt_thread_delete(rt_thread_t t);
rt_err_t    rt_thread_delay(rt_tick_t tick);

rt_sem_t    rt_sem_create(const char *name, int value, uint8_t flag);
rt_err_t    rt_sem_take(rt_sem_t s, int32_t timeout);
rt_err_t    rt_sem_release(rt_sem_t s);
rt_err_t    rt_sem_delete(rt_sem_t s);

#endif /* RTTHREAD_API_H */
