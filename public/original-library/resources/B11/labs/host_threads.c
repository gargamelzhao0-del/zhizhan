/* host_threads.c —— 实时性与多线程：真实 pthread 竞态与加锁模型（主机可运行）。
 *
 * 无锁共享计数的“读-改-写”不是原子操作，两线程并发会丢失更新；用 pthread_mutex_t
 * 保护临界区后结果精确。本程序用真实 pthread_create 起两个线程，并用 pthread_barrier
 * 强制两线程“先都读、再都写”，从而稳定复现一次丢失更新。
 *
 * 编译运行（POSIX 线程，显式链接可加 -pthread）：
 *   gcc -std=c11 -Wall -Wextra -O2 host_threads.c -o host_threads -pthread && ./host_threads
 * 在 glibc ≥ 2.34 / 现代 winpthreads 上 pthread 已随 libc 默认链接，故 gcc -std=c11 -O2 亦可编过。
 */
#include <stdio.h>
#include <pthread.h>

static int raw = 0;                        /* 无锁共享计数 */
static pthread_barrier_t bar;              /* 强制两线程都读完后才写 */
static int locked_count = 0;               /* 互斥保护的计数 */
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;

/* 无锁 +1：读 → 同步 → 写回，后写覆盖先写 → 丢失更新 */
static void *raw_inc(void *arg) {
    (void)arg;
    int tmp = raw;                         /* 读 */
    pthread_barrier_wait(&bar);            /* 两线程都读完再继续 */
    raw = tmp + 1;                         /* 写回（非原子） */
    return 0;
}

/* 加锁 +500：临界区内自增，串行且不丢失 */
static void *locked_inc(void *arg) {
    (void)arg;
    for (int i = 0; i < 500; i++) {
        pthread_mutex_lock(&m);
        locked_count++;
        pthread_mutex_unlock(&m);
    }
    return 0;
}

int main(void) {
    int ok = 1;
    pthread_t t1, t2;

    /* 无锁：两线程各 +1，barrier 强制都先读到 0，最终只保留一次 +1 */
    pthread_barrier_init(&bar, 0, 2);
    pthread_create(&t1, 0, raw_inc, 0);
    pthread_create(&t2, 0, raw_inc, 0);
    pthread_join(t1, 0);
    pthread_join(t2, 0);
    printf("无锁两线程各 +1（barrier 强制都先读）：期望 2，实际 %d（丢失更新）\n", raw);
    if (raw != 1) ok = 0;

    /* 加锁：两线程各 +500，互斥保护下必须恰好 1000 */
    pthread_create(&t1, 0, locked_inc, 0);
    pthread_create(&t2, 0, locked_inc, 0);
    pthread_join(t1, 0);
    pthread_join(t2, 0);
    printf("加锁自增 2×500：实际 %d（期望 1000）\n", locked_count);
    if (locked_count != 1000) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
