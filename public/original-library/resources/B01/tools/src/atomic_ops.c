/* atomic_ops.c — 原子操作到底落在什么硬件上
 *
 * §6.7 末尾留了一句"或改用原子指令（__atomic_fetch_add）"，没解释它在硬件上是什么。
 * 这份文件就是那句话的答案，分三层：
 *   ① volatile 什么都没挡住（拿它当基线）
 *   ② __atomic_* 在 M3 上是 LDREX/STREX 循环，在 M0 上是一个叫不出来的函数
 *   ③ 编译期就能问清楚"这个核锁不锁得住"
 *
 * 实测环境：GCC 13.3.1、-O2、cortex-m3 与 cortex-m0。
 */
#include <stdint.h>

typedef struct {
  volatile uint32_t head;
  volatile uint32_t tail;
} mp_rb_t;

/* ① 基线：volatile 只保证"每次都真去读写内存"，
 *    读-改-写这三步之间没有任何保护。 */
void counter_inc_volatile(volatile uint32_t *p) { *p += 1u; }

/* ② 用 CAS 循环"领号"：这是原子操作最一般的形态。
 *    成功就返回旧的 head；失败时 __atomic_compare_exchange_n 会把内存里的
 *    实际值写回 h，然后重试。 */
uint32_t rb_claim(mp_rb_t *rb)
{
  uint32_t h = __atomic_load_n(&rb->head, __ATOMIC_RELAXED);
  for (;;) {
    uint32_t next = h + 1u;
    if (__atomic_compare_exchange_n(&rb->head, &h, next, 0,
                                    __ATOMIC_RELAXED, __ATOMIC_RELAXED)) {
      return h;
    }
  }
}

/* ③ 同一件事的简洁写法。M3 上编出来的就是 LDREX/STREX 循环。 */
uint32_t rb_claim_fetch_add(mp_rb_t *rb)
{
  return __atomic_fetch_add(&rb->head, 1u, __ATOMIC_RELAXED);
}

/* ④ 只把内存序从 RELAXED 换成 SEQ_CST，其余一个字不改。
 *    M3 上多出来的是两条 dmb —— 内存序的全部代价就在这里。 */
uint32_t rb_claim_seq_cst(mp_rb_t *rb)
{
  return __atomic_fetch_add(&rb->head, 1u, __ATOMIC_SEQ_CST);
}

/* ⑤ 老名字：__sync_fetch_and_add 是 GCC 更早的那一套内建。
 *    它和 __atomic_* 走的是同一条降级路径 —— 放进来是为了回答
 *    "那我用老写法是不是就没事了"，答案是同一个链接错误。 */
uint32_t rb_claim_sync(mp_rb_t *rb)
{
  return __sync_fetch_and_add(&rb->head, 1u);
}

/* ⑥ 编译期就问清楚：4 字节的原子操作在这个核上锁不锁得住。
 *    M3 上这是真命题，直接过。M0 上是假命题 —— 于是这份文件在 M0 上
 *    连编都编不过，下面那些反汇编也就无从谈起。
 *    所以正文里的做法是【照实写、但按 __ARM_ARCH 让开】；
 *    想看让开之后那句断言真红一次，加 -DNO_ATOMIC_GUARD
 *    （门禁里有一条规格就是这么干的，正文那段红字就是这么来的）。 */
#if !defined(__ARM_ARCH) || (__ARM_ARCH >= 7) || defined(NO_ATOMIC_GUARD)
_Static_assert(__atomic_always_lock_free(4, 0),
               "no lock-free 4-byte atomics on this core");
#endif
