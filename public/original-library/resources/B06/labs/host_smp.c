/* host_smp.c —— 多核/并发下的共享计数：丢失更新与自旋锁（主机可运行）。
 *
 * 用真实 C11 原子操作演示两件事：
 *   ① 非原子的“读-改-写”：两个核交错执行时会丢失更新（最终值小于实际自增次数）。
 *   ② 用 atomic_flag 自旋锁或 atomic_fetch_add 保护后，计数严格正确。
 * 模型用“手工交错的步骤”表达两核并发；讨论的是内存序与互斥，不绑定具体指令。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_smp.c -o host_smp && ./host_smp
 */
#include <stdio.h>
#include <stdatomic.h>

int main(void) {
    int ok = 1;

    /* ① 非原子：两核都先读 0，各自 +1 后写回，最终只有 1（丢失一次自增） */
    int counter = 0, a_read, b_read;
    a_read = counter;      /* 核 A 读 */
    b_read = counter;      /* 核 B 读（A 尚未写回） */
    counter = a_read + 1;  /* 核 A 写 */
    counter = b_read + 1;  /* 核 B 写，覆盖了 A 的结果 */
    printf("非原子读改写：期望 2，实际 %d（丢失更新）\n", counter);
    if (counter != 1) ok = 0;

    /* ② atomic_fetch_add：每次自增原子完成，不丢 */
    atomic_int ac = 0;
    atomic_fetch_add(&ac, 1);   /* 核 A */
    atomic_fetch_add(&ac, 1);   /* 核 B */
    printf("atomic_fetch_add：期望 2，实际 %d\n", atomic_load(&ac));
    if (atomic_load(&ac) != 2) ok = 0;

    /* ③ 自旋锁：临界区内 +1，语义上等价于关调度/关中断的短临界区 */
    atomic_flag lock = ATOMIC_FLAG_INIT;
    int guarded = 0;
    for (int i = 0; i < 1000; i++) {
        while (atomic_flag_test_and_set_explicit(&lock, memory_order_acquire)) { /* spin */ }
        guarded++;                                   /* 临界区：只允许一个核进入 */
        atomic_flag_clear_explicit(&lock, memory_order_release);
    }
    printf("自旋锁保护的自增 1000 次：实际 %d\n", guarded);
    if (guarded != 1000) ok = 0;

    /* ④ 内存序对照：relaxed 只保证原子性，不保证跨线程可见顺序 */
    atomic_int seq = 0;
    atomic_store_explicit(&seq, 1, memory_order_relaxed);
    atomic_store_explicit(&seq, 2, memory_order_release);
    printf("release 存储后 relaxed 读 = %d（同线程内可见）\n", atomic_load_explicit(&seq, memory_order_relaxed));
    if (atomic_load_explicit(&seq, memory_order_relaxed) != 2) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
