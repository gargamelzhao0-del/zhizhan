/* host_bootlog.c —— 启动日志分阶段与耗时分析（主机可运行）。
 *
 * 启动链 ROM→SPL→U-Boot→Kernel→init，每一跳都会在串口打印带时间戳的日志。
 * 本程序把日志按关键字分阶段、算出各阶段耗时，并检测 panic/卡死等异常。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bootlog.c -o host_bootlog && ./host_bootlog
 */
#include <stdio.h>
#include <string.h>

typedef struct { int ms; const char *s; } line_t;

static const char *phase_of(const char *s) {
    if (strstr(s, "ROM"))       return "ROM";
    if (strstr(s, "SPL"))       return "SPL";
    if (strstr(s, "U-Boot"))    return "U-Boot";
    if (strstr(s, "Linux version")) return "Kernel";
    if (strstr(s, "init:"))     return "init";
    return 0;
}
static int has_panic(const line_t *L, int n) {
    for (int i = 0; i < n; i++)
        if (strstr(L[i].s, "panic") || strstr(L[i].s, "ERROR")) return L[i].ms;
    return -1;
}
static int analyze(const line_t *L, int n) {
    const char *phases[5] = {"ROM", "SPL", "U-Boot", "Kernel", "init"};
    int at[5]; for (int i = 0; i < 5; i++) at[i] = -1;
    for (int i = 0; i < n; i++) {
        const char *p = phase_of(L[i].s);
        for (int j = 0; j < 5; j++) if (p && strcmp(p, phases[j]) == 0 && at[j] < 0) at[j] = L[i].ms;
    }
    printf("阶段时间(ms):");
    for (int j = 0; j < 5; j++) printf(" %s=%d", phases[j], at[j]);
    printf("\n");
    int order_ok = 1;
    for (int j = 1; j < 5; j++) if (at[j] < at[j - 1]) order_ok = 0;
    printf("阶段耗时(ms): ROM→SPL=%d SPL→U-Boot=%d U-Boot→Kernel=%d Kernel→init=%d 总=%d\n",
           at[1] - at[0], at[2] - at[1], at[3] - at[2], at[4] - at[3], at[4] - at[0]);
    int panic = has_panic(L, n);
    printf("异常(panic/ERROR)时刻=%d\n", panic);
    return order_ok && at[0] >= 0 && at[4] > at[0];
}

int main(void) {
    line_t good[] = {
        {0, "[ROM] boot mode SD"}, {8, "[SPL] ddr init"}, {18, "[U-Boot] 2023.10"},
        {140, "[U-Boot] loading kernel"}, {600, "[Linux version] 6.1"}, {2700, "[init:] started"},
    };
    line_t bad[] = {
        {0, "[ROM] boot"}, {10, "[SPL] ok"}, {30, "[U-Boot] load kernel"},
        {500, "[Linux version] 6.1"}, {900, "ERROR: rootfs mount failed"}, {1200, "Kernel panic - not syncing"},
    };
    int ok = 1, n1 = (int)(sizeof(good) / sizeof(good[0])), n2 = (int)(sizeof(bad) / sizeof(bad[0]));
    printf("== 正常启动 ==\n");
    if (!analyze(good, n1)) ok = 0;
    printf("\n== 故障启动 ==\n");
    int ok_bad = analyze(bad, n2);
    if (ok_bad) ok = 0;              /* 故障启动不应被判为“正常” */
    if (ok) printf("\n%s\n", "RESULT: PASS"); else printf("\n%s\n", "RESULT: FAIL");
    return ok ? 0 : 1;
}
