/* atomic_m0_safe.c — 没有 LDREX/STREX 的核上，"领号"这一步怎么写
 *
 * 上面那份 atomic_ops.c 在 M0 上【编得过、链不过】—— 这是这一节的核心结论。
 * 那 M0 上到底该怎么办？答案不是"换一个更基础的原子函数"（工具链里根本没有），
 * 而是回到最老的办法：关中断 → 读-改-写 → 恢复中断。
 *
 * 实测环境：GCC 13.3.1、-O2、cortex-m3 与 cortex-m0（两份核都能链过）。
 */
#include <stdint.h>

typedef struct {
  volatile uint32_t head;
  volatile uint32_t tail;
} mp_rb_t;

uint32_t rb_claim_primask(mp_rb_t *rb)
{
  uint32_t primask, h;
  __asm__ volatile ("mrs %0, primask" : "=r" (primask));   /* 先存下旧值 */
  __asm__ volatile ("cpsid i" ::: "memory");               /* 关中断 */
  h = rb->head;
  rb->head = h + 1u;                                       /* 这三行现在是一体的 */
  __asm__ volatile ("msr primask, %0" :: "r" (primask) : "memory");
  return h;
}
