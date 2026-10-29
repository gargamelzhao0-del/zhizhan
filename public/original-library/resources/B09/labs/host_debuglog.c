/* host_debuglog.c —— 日志等级统计与告警（dmesg 语义，主机可运行）。
 *
 * 内核日志有等级（emerg/err/warn/info…）。系统层调试第一步是“按等级筛”，
 * 再判断是否达到告警条件。本程序统计各级别出现次数并给出告警结论。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_debuglog.c -o host_debuglog && ./host_debuglog
 */
#include <stdio.h>
#include <string.h>

static const char *level_of(const char *s) {
    if (strstr(s, "emerg")) return "emerg";
    if (strstr(s, "err"))   return "err";
    if (strstr(s, "warn"))  return "warn";
    if (strstr(s, "info"))  return "info";
    return "debug";
}
static int rank(const char *lvl) {
    if (strcmp(lvl, "emerg") == 0) return 0;
    if (strcmp(lvl, "err") == 0) return 3;
    if (strcmp(lvl, "warn") == 0) return 4;
    if (strcmp(lvl, "info") == 0) return 6;
    return 7;
}

int main(void) {
    const char *log[] = {
        "kern.info: Linux version 6.1.0",
        "kern.info: mmc0: SDHCI controller on 2190000.mmc",
        "kern.warn: mmc0: card lacks reliable write",
        "kern.err: mmc0: error -110 during read",
        "kern.err: EXT4-fs (mmcblk0p5): error loading journal",
        "kern.emerg: Kernel panic - not syncing",
    };
    int n = (int)(sizeof(log) / sizeof(log[0]));
    int cnt[8] = {0}, worst = 7;
    for (int i = 0; i < n; i++) {
        const char *l = level_of(log[i]);
        cnt[rank(l)]++;
        if (rank(l) < worst) worst = rank(l);
    }
    printf("统计: info=%d warn=%d err=%d emerg=%d\n", cnt[6], cnt[4], cnt[3], cnt[0]);
    printf("最严重级别=%s\n", worst == 0 ? "emerg" : worst == 3 ? "err" : worst == 4 ? "warn" : "info");

    int ok = 1;
    if (!(cnt[6] == 2 && cnt[4] == 1 && cnt[3] == 2 && cnt[0] == 1)) ok = 0;
    int alert = (cnt[0] > 0) || (cnt[3] > 0);
    printf("是否告警=%s（emerg/err 存在即告警）\n", alert ? "是" : "否");
    if (!alert) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
