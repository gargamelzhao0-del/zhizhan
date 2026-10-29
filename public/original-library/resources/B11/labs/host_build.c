/* host_build.c —— 应用构建：按依赖拓扑排序的编译顺序（主机可运行）。
 * 多文件/多库构建要按依赖顺序编译；依赖成环则无法构建。本程序对构建目标做拓扑排序并检测环。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_build.c -o host_build && ./host_build
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; const char *deps[2]; } mod_t;
static mod_t M[] = {
    {"main", {"app", 0}}, {"app", {"net", "util"}}, {"net", {"util", 0}}, {"util", {0, 0}},
};
#define N 4
static int topo(int order[]) {
    int indeg[N] = {0}, done[N] = {0}, oc = 0;
    for (int i = 0; i < N; i++) for (int d = 0; d < 2 && M[i].deps[d]; d++) indeg[i]++;
    for (int s = 0; s < N; s++) {
        int pick = -1; for (int i = 0; i < N; i++) if (!done[i] && indeg[i] == 0) { pick = i; break; }
        if (pick < 0) return 0;
        done[pick] = 1; order[oc++] = pick;
        for (int i = 0; i < N; i++) for (int d = 0; d < 2 && M[i].deps[d]; d++) if (strcmp(M[i].deps[d], M[pick].name) == 0) indeg[i]--;
    }
    return 1;
}
int main(void) {
    int ok = 1, order[N];
    if (!topo(order)) ok = 0;
    printf("编译顺序:");
    for (int i = 0; i < N; i++) printf(" %s", M[order[i]].name);
    printf("\n");
    int pos[N]; for (int i = 0; i < N; i++) pos[order[i]] = i;
    for (int i = 0; i < N; i++) for (int d = 0; d < 2 && M[i].deps[d]; d++)
        for (int j = 0; j < N; j++) if (strcmp(M[j].name, M[i].deps[d]) == 0 && !(pos[j] < pos[i])) ok = 0;
    if (strcmp(M[order[0]].name, "util") != 0) ok = 0;   /* 无依赖者最先 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
