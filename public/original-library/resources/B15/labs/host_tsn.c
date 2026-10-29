/* host_tsn.c —— 实时以太网/确定性通信：时延与抖动统计、截止期判定（主机可运行）。
 * 给定一组周期性通信的采样时延（微秒），统计最小值/最大值/抖动（max-min），
 * 并判定是否满足确定性截止期要求（抖动≤50µs 且最大时延≤1000µs）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tsn.c -o host_tsn && ./host_tsn
 */
#include <stdio.h>

int main(void) {
    int ok = 1;
    const int lat[] = {960, 980, 1000, 990, 975, 995};   /* 采样时延 (µs) */
    int n = (int)(sizeof(lat) / sizeof(lat[0]));
    int mn = lat[0], mx = lat[0], sum = 0;
    for (int i = 0; i < n; i++) {
        if (lat[i] < mn) mn = lat[i];
        if (lat[i] > mx) mx = lat[i];
        sum += lat[i];
    }
    int jitter = mx - mn;                 /* 抖动 = 最大 - 最小 */
    int avg = sum / n;
    const int JITTER_LIMIT = 50;          /* 抖动上限 (µs) */
    const int DEADLINE = 1000;            /* 截止期/最大时延 (µs, 1ms 周期) */
    int jitter_ok = jitter <= JITTER_LIMIT;
    int deadline_ok = mx <= DEADLINE;
    printf("采样 n=%d 最小=%dµs 最大=%dµs 平均=%dµs 抖动=%dµs\n", n, mn, mx, avg, jitter);
    printf("抖动≤%dµs=%d 最大时延≤%dµs=%d\n", JITTER_LIMIT, jitter_ok, DEADLINE, deadline_ok);
    if (!(mn == 960 && mx == 1000 && jitter == 40)) ok = 0;
    if (!(jitter_ok && deadline_ok)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
