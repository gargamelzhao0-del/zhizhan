/* host_build.c —— 构建依赖拓扑与可复现（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_build.c -o host_build && ./host_build
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; const char *dep; } tgt_t;
int main(void) {
    int ok = 1;
    tgt_t T[] = { {"app", "lib"}, {"lib", "util"}, {"util", 0} };
    int n = 3, order[3], done[3] = {0,0,0}, oc = 0;
    for (int step = 0; step < n; step++) {
        for (int i = 0; i < n; i++) {
            if (done[i]) continue;
            if (!T[i].dep) { done[i] = 1; order[oc++] = i; break; }
            for (int j = 0; j < n; j++) if (strcmp(T[j].name, T[i].dep) == 0 && done[j]) { done[i] = 1; order[oc++] = i; break; }
        }
    }
    printf("构建顺序:");
    for (int i = 0; i < oc; i++) printf(" %s", T[order[i]].name);
    printf("\n");
    if (!(oc == 3 && strcmp(T[order[0]].name, "util") == 0)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
