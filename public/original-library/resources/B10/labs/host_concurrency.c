/* host_concurrency.c —— 并发与锁：锁顺序与死锁检测模型（主机可运行）。
 *
 * 内核里最贵的 bug 是并发：多把锁的获取顺序不一致就会死锁；自旋锁里睡眠会崩。
 * 本程序用“等待图 + 环检测”判定两种顺序是否死锁，并演示“自旋锁不可睡眠”。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_concurrency.c -o host_concurrency && ./host_concurrency
 */
#include <stdio.h>
#include <string.h>

/* 锁管理器：记录“谁在等谁” */
static int wait_for[8];   /* wait_for[i]=j：任务 i 等待任务 j 持有的锁 */

static int has_cycle(int n) {
    for (int i = 0; i < n; i++) {
        int cur = i, steps = 0;
        while (cur >= 0 && wait_for[cur] >= 0 && steps <= n) {
            cur = wait_for[cur];
            steps++;
            if (cur == i) return 1;
        }
    }
    return 0;
}

int main(void) {
    int ok = 1, n = 2;
    /* 情形 1：两个任务都按 A→B 顺序取锁 */
    wait_for[0] = -1; wait_for[1] = -1;
    printf("一致顺序 A→B：cycle=%d（期望 0）\n", has_cycle(n));
    if (has_cycle(n) != 0) ok = 0;

    /* 情形 2：T0 持 A 等 B，T1 持 B 等 A → 环 */
    wait_for[0] = 1; wait_for[1] = 0;
    printf("交叉顺序 A→B 与 B→A：cycle=%d（期望 1，检测到死锁）\n", has_cycle(n));
    if (has_cycle(n) != 1) ok = 0;

    /* 自旋锁不可睡眠：临界区内调用可能睡眠的函数即命中 BUG（正向判定） */
    int spinlock_held = 1, may_sleep = 1;
    int bug = spinlock_held && may_sleep;
    printf("自旋锁内调用可能睡眠函数 → BUG=%d（期望 1，命中即 BUG）\n", bug);
    if (bug != 1) ok = 0;
    /* 互斥锁（可睡眠）里睡眠是允许的 */
    int mutex_held = 1, sleep_in_mutex = 1;
    printf("互斥锁内睡眠 → 允许=%d（期望 1）\n", mutex_held && sleep_in_mutex);
    if (!(mutex_held && sleep_in_mutex)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
