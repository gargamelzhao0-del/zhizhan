/* host_initdeps.c —— init 服务依赖排序与故障传播（主机可运行）。
 *
 * SysV/systemd 都要按依赖启动服务。本程序做拓扑排序，验证顺序满足依赖；
 * 再让一个被依赖的服务失败，验证其下游不会被“假装启动”。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_initdeps.c -o host_initdeps && ./host_initdeps
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *name; const char *deps[2]; int fail; } svc_t;

static int idx_of(svc_t *s, int n, const char *name) {
    for (int i = 0; i < n; i++) if (strcmp(s[i].name, name) == 0) return i;
    return -1;
}
/* 返回 1=排序成功，0=存在环 */
static int topo(svc_t *s, int n, int *order) {
    int indeg[8] = {0}, done[8] = {0}, oc = 0;
    for (int i = 0; i < n; i++) for (int d = 0; d < 2 && s[i].deps[d]; d++) indeg[i]++;
    for (int step = 0; step < n; step++) {
        int pick = -1;
        for (int i = 0; i < n; i++) if (!done[i] && indeg[i] == 0) { pick = i; break; }
        if (pick < 0) return 0;                    /* 有环 */
        done[pick] = 1; order[oc++] = pick;
        for (int i = 0; i < n; i++)
            for (int d = 0; d < 2 && s[i].deps[d]; d++)
                if (strcmp(s[i].deps[d], s[pick].name) == 0) indeg[i]--;
    }
    return 1;
}

int main(void) {
    svc_t S[5] = {
        {"sysinit", {0, 0}, 0},
        {"network", {"sysinit", 0}, 0},
        {"sshd",    {"network", 0}, 0},
        {"mqtt",    {"network", 0}, 0},
        {"ui",      {"sysinit", 0}, 0},
    };
    int n = 5, order[8], ok = 1;

    if (!topo(S, n, order)) ok = 0;
    printf("启动顺序:");
    for (int i = 0; i < n; i++) printf(" %s", S[order[i]].name);
    printf("\n");
    /* 校验：每个服务的依赖都在它之前 */
    int pos[8]; for (int i = 0; i < n; i++) pos[order[i]] = i;
    for (int i = 0; i < n; i++)
        for (int d = 0; d < 2 && S[i].deps[d]; d++) {
            int j = idx_of(S, n, S[i].deps[d]);
            if (!(pos[j] < pos[i])) ok = 0;
        }

    /* 故障传播：network 失败 → sshd/mqtt 不应启动 */
    S[idx_of(S, n, "network")].fail = 1;
    int started[8] = {0};
    for (int k = 0; k < n; k++) {
        int i = order[k], good = !S[i].fail;
        for (int d = 0; d < 2 && S[i].deps[d]; d++) {
            int j = idx_of(S, n, S[i].deps[d]);
            if (!started[j]) good = 0;
        }
        started[i] = good;
    }
    printf("network 失败后已启动:");
    for (int i = 0; i < n; i++) if (started[i]) printf(" %s", S[i].name);
    printf("\n");
    if (started[idx_of(S, n, "network")]) ok = 0;
    if (started[idx_of(S, n, "sshd")] || started[idx_of(S, n, "mqtt")]) ok = 0;
    if (!started[idx_of(S, n, "sysinit")] || !started[idx_of(S, n, "ui")]) ok = 0;

    /* 环检测 */
    svc_t C[2] = { {"a", {"b", 0}, 0}, {"b", {"a", 0}, 0} };
    int ord2[4];
    printf("环依赖 topo 返回=%d（期望 0）\n", topo(C, 2, ord2));
    if (topo(C, 2, ord2) != 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
