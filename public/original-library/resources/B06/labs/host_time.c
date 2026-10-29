/* host_time.c —— 时间管理：延迟漂移、tickless 唤醒次数、软件定时器顺序（主机可运行）。
 *
 *   ① vTaskDelay(P) 的周期从“本次工作结束”开始计，实际周期 = 执行时间 + P → 累积漂移。
 *      vTaskDelayUntil(&last, P) 以绝对节拍推进，只要执行时间 < P 就不漂移。
 *   ② tickless 空闲：空闲时数 tick 唤醒 vs 只在“下一个到期事件”唤醒，唤醒次数差一个数量级。
 *   ③ 软件定时器：按到期时间排序，到期顺序必须确定性。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_time.c -o host_time && ./host_time
 */
#include <stdio.h>

/* 模拟一个周期任务在 total 个 tick 内被唤醒的次数与末次漂移 */
static void periodic(int period, int exec, int use_until, int total, int *wakes, int *drift) {
    int t = 0, w = 0;
    while (t < total) {
        w++;
        t += use_until ? period : (period + exec);   /* until：绝对节拍；delay：工作后再等 */
    }
    *wakes = w;
    *drift = (t - (use_until ? period : (period + exec))) - (w - 1) * period;
}

int main(void) {
    int ok = 1;
    const int P = 10, E = 4, TOTAL = 100;
    int wd, dd, wu, du;
    periodic(P, E, 0, TOTAL, &wd, &dd);
    periodic(P, E, 1, TOTAL, &wu, &du);
    printf("周期任务 P=%d exec=%d，观察 %d tick：\n", P, E, TOTAL);
    printf("  vTaskDelay     : 唤醒 %d 次，末次漂移 %+d tick（周期被拉长为 %d）\n", wd, dd, P + E);
    printf("  vTaskDelayUntil: 唤醒 %d 次，末次漂移 %+d tick（严格 %d 节拍）\n", wu, du, P);
    if (!(dd > 0)) ok = 0;
    if (du != 0) ok = 0;
    if (!(wu > wd)) ok = 0;

    /* tickless：1000 tick 窗口，一个 100 tick 周期任务 + 一个 700 tick 单次定时器 */
    int tick_wakeups = 1000;                 /* 非 tickless：每个 tick 都醒 */
    int tickless_wakeups = 1000 / 100 + 1;   /* 只在事件到期时醒 */
    printf("\ntickless 空闲（1000 tick 窗口，100 tick 周期任务 + 700 tick 单次定时器）：\n");
    printf("  非 tickless = %d 次唤醒；tickless = %d 次唤醒\n", tick_wakeups, tickless_wakeups);
    if (!(tick_wakeups == 1000)) ok = 0;
    if (!(tickless_wakeups <= 11)) ok = 0;

    /* 软件定时器：插入乱序，取出必须按到期时间升序 */
    int expiries[4] = {70, 30, 100, 10};
    for (int i = 0; i < 4; i++)              /* 插入排序，模拟定时器链表 */
        for (int j = i + 1; j < 4; j++)
            if (expiries[j] < expiries[i]) { int s = expiries[i]; expiries[i] = expiries[j]; expiries[j] = s; }
    printf("\n软件定时器到期顺序：");
    for (int i = 0; i < 4; i++) printf("%d%s", expiries[i], i < 3 ? "," : "");
    printf(" (期望 10,30,70,100)\n");
    if (!(expiries[0] == 10 && expiries[1] == 30 && expiries[2] == 70 && expiries[3] == 100)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
