/* zephyr_api.h —— Zephyr 侧用到的接口子集（仅声明，供交叉编译验证）。 */
#ifndef ZEPHYR_API_H
#define ZEPHYR_API_H

#include <stdint.h>
#include <stddef.h>

struct k_thread { uint32_t dummy; };
struct k_sem    { unsigned int count; unsigned int limit; };

#define K_FOREVER (-1)
#define K_NO_WAIT 0

#define K_THREAD_STACK_DEFINE(name, size) char name[size]
#define K_THREAD_STACK_SIZEOF(name)       (sizeof(name))
#define K_SEM_DEFINE(name, init, lim)     struct k_sem name = { (unsigned)(init), (unsigned)(lim) }

int  k_thread_create(struct k_thread *t, void *stack, size_t size,
                     void (*entry)(void *, void *, void *),
                     void *p1, void *p2, void *p3, int prio, uint32_t options, int32_t delay);
int  k_sem_take(struct k_sem *s, int32_t timeout);
void k_sem_give(struct k_sem *s);

#endif /* ZEPHYR_API_H */
