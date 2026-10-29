/* host_heartbeat.c —— 多任务心跳监控与自恢复（主机可运行）。
 *
 * 每个关键任务周期性“打卡”；监控器检查是否超时。超时 → 记录故障并触发恢复；
 * 恢复次数有上界，超过则进入安全态（不再盲目重启）。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_heartbeat.c -o host_heartbeat && ./host_heartbeat
 */
#include <stdio.h>
#include <stdint.h>

#define NTASK 3
#define TIMEOUT 50
#define MAX_RECOVER 3

typedef struct { const char *name; uint32_t last_ping; uint32_t period; int stalled; } hb_t;

int main(void) {
    hb_t t[NTASK] = {{"sensor", 0, 10, 0}, {"control", 0, 5, 0}, {"comm", 0, 20, 0}};
    int recover = 0, detect_tick = -1;
    int ok = 1;

    for (uint32_t now = 0; now < 400; now++) {
        for (int i = 0; i < NTASK; i++) {
            /* 任务 2（control）从 tick 100 起卡死 */
            int failing = (i == 1 && now >= 100 && now < 200);
            if (!failing && (now % t[i].period) == 0) t[i].last_ping = now;
        }
        /* 监控：任一任务超时 */
        for (int i = 0; i < NTASK; i++) {
            if (!t[i].stalled && (now - t[i].last_ping) > TIMEOUT) {
                t[i].stalled = 1;
                if (detect_tick < 0) detect_tick = (int)now;
                if (recover < MAX_RECOVER) recover++;
                else { printf("超过最大恢复次数，进入安全态\n"); return 0; }
            }
            if (t[i].stalled && (now - t[i].last_ping) <= TIMEOUT) t[i].stalled = 0; /* 恢复打卡后清除 */
        }
    }

    printf("检测到 control 卡死的时刻=%d（≈ 最后一次打卡 95 + 超时 50 + 1）\n", detect_tick);
    printf("累计恢复次数=%d（上界 %d）\n", recover, MAX_RECOVER);

    if (!(detect_tick >= 145 && detect_tick <= 148)) ok = 0;
    if (recover < 1) ok = 0;
    if (recover > MAX_RECOVER) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
