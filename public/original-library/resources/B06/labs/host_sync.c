/* host_sync.c —— 优先级反转与优先级继承的定量模型（主机可运行）。
 *
 * 场景（经典的三任务反转）：低优先级 L 先拿到互斥量，进入临界区；
 * 中优先级 M 就绪后不停抢占 L；高优先级 H 随后也要这把锁，于是被卡在 L 后面。
 *   · 关闭优先级继承：M 一直霸占 CPU，L 无法推进，H 被“无关的” M 拖住 —— 无界反转。
 *   · 打开优先级继承：H 阻塞在锁上时，L 临时继承 H 的优先级，立刻抢回 CPU 完成临界区，
 *     H 很快拿到锁 —— 反转被“限制在一个临界区以内”。
 *
 * 模型是逐 tick 的固定优先级调度；数字来自本程序真实运行，不是估算。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sync.c -o host_sync && ./host_sync
 */
#include <stdio.h>
#include <string.h>

#define T_MAX 200

enum { ST_OFF = 0, ST_READY, ST_DONE };
typedef struct {
    const char *name;
    int base_prio;   /* 越小越紧急 */
    int releases_at;
    int work;        /* 还需执行的 tick */
    int needs_mutex; /* 是否要拿互斥量 */
    int state;
    int blocked;     /* 阻塞在互斥量上 */
    int holds_mutex;
} task_t;

static int g_inversion, g_release_tick, g_acquire_tick;

static int run(int use_pi) {
    task_t T[3] = {
        {"L_low",  3, 0, 6, 1, ST_READY, 0, 0},
        {"M_mid",  2, 1, 20, 0, ST_OFF,   0, 0},
        {"H_high", 1, 2, 1, 1, ST_OFF,   0, 0},
    };
    int locked = 0, owner = -1;   /* 互斥量 */
    int t, acquire = -1;

    for (t = 0; t < T_MAX; t++) {
        int i;
        /* 释放事件 */
        for (i = 0; i < 3; i++)
            if (t == T[i].releases_at) T[i].state = ST_READY;

        /* L 在 t=0 先拿到锁（它是唯一在 t=0 就绪的任务） */
        if (t == 0) { locked = 1; owner = 0; T[0].holds_mutex = 1; }

        /* H 尝试拿锁 */
        if (T[2].state == ST_READY && T[2].needs_mutex && !T[2].holds_mutex) {
            if (!locked) { locked = 1; owner = 2; T[2].holds_mutex = 1; acquire = t; }
            else T[2].blocked = 1;
        }
        /* 锁被释放：让阻塞的等待者下一 tick 能再次尝试 */
        if (!locked) T[2].blocked = 0;

        /* 计算有效优先级：持锁者若有等待者，继承其中最高的（数值最小的）优先级 */
        int eff[3];
        for (i = 0; i < 3; i++) eff[i] = T[i].base_prio;
        if (use_pi && locked && owner >= 0) {
            for (i = 0; i < 3; i++)
                if (T[i].blocked && T[i].base_prio < eff[owner]) eff[owner] = T[i].base_prio;
        }

        /* 选择就绪、未完成、未阻塞、且有效优先级最高的任务 */
        int pick = -1;
        for (i = 0; i < 3; i++) {
            if (T[i].state != ST_READY || T[i].work <= 0 || T[i].blocked) continue;
            if (pick < 0 || eff[i] < eff[pick]) pick = i;
        }
        if (pick < 0) continue;
        T[pick].work--;

        if (T[pick].work == 0) {
            if (T[pick].holds_mutex) { locked = 0; owner = -1; T[pick].holds_mutex = 0; }
            T[pick].state = ST_DONE;
        }
    }
    g_release_tick = 2;                 /* H 在 t=2 就绪并开始等待 */
    g_acquire_tick = acquire;
    g_inversion = acquire - g_release_tick;
    return g_inversion;
}

int main(void) {
    int no_pi = run(0);
    printf("关闭优先级继承：H 从 t=2 等到 t=%d 拿到锁，反转=%d tick\n", g_acquire_tick, no_pi);
    int with_pi = run(1);
    printf("开启优先级继承：H 从 t=2 等到 t=%d 拿到锁，反转=%d tick\n", g_acquire_tick, with_pi);

    int ok = 1;
    if (!(no_pi > 15)) ok = 0;          /* 无界：被中优先级任务长时间拖住 */
    if (!(with_pi <= 6)) ok = 0;        /* 有界：约等于一个临界区（6 tick） */
    if (!(with_pi < no_pi)) ok = 0;
    printf("\n结论：优先级继承把反转从 %d tick 限制到 %d tick（临界区本身 6 tick）。\n", no_pi, with_pi);
    printf("%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
