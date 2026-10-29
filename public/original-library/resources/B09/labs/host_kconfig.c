/* host_kconfig.c —— Kconfig 依赖/选择解析（主机可运行）。
 *
 * 内核配置里：`depends on` 表示前置必须满足；`select` 会强制打开另一个符号（可能绕过其依赖）。
 * 本程序解析一个请求集合，展开 select，并检测“被选中但依赖未满足”的冲突。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_kconfig.c -o host_kconfig && ./host_kconfig
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *sym; const char *dep; const char *sel; } opt_t;
static opt_t O[] = {
    {"A", 0,   0  },
    {"B", "A", 0  },     /* B depends on A */
    {"C", 0,   "B"},     /* C selects B（即使 B 的依赖未满足也会被选中） */
};
#define NO (int)(sizeof(O) / sizeof(O[0]))

static int find(const char *s) { for (int i = 0; i < NO; i++) if (strcmp(O[i].sym, s) == 0) return i; return -1; }

/* 解析请求：展开 select，返回冲突数并打印启用集合 */
static int resolve(const char *const *req, int nr) {
    int on[8] = {0};
    for (int i = 0; i < nr; i++) { int k = find(req[i]); if (k >= 0) on[k] = 1; }
    int changed = 1;
    while (changed) {                    /* 展开 select */
        changed = 0;
        for (int i = 0; i < NO; i++)
            if (on[i] && O[i].sel) { int k = find(O[i].sel); if (k >= 0 && !on[k]) { on[k] = 1; changed = 1; } }
    }
    printf("启用: ");
    for (int i = 0; i < NO; i++) if (on[i]) printf("%s ", O[i].sym);
    printf("\n");
    int conflicts = 0;
    for (int i = 0; i < NO; i++)
        if (on[i] && O[i].dep && !on[find(O[i].dep)]) {
            printf("  冲突: %s 依赖 %s，但 %s 未启用\n", O[i].sym, O[i].dep, O[i].dep);
            conflicts++;
        }
    return conflicts;
}

int main(void) {
    int ok = 1;
    printf("请求 {C}：\n");
    const char *r1[] = {"C"};
    int c1 = resolve(r1, 1);
    if (c1 != 1) ok = 0;                 /* C 选中 B，但 A 未启用 → 冲突 */

    printf("请求 {A,C}：\n");
    const char *r2[] = {"A", "C"};
    int c2 = resolve(r2, 2);
    if (c2 != 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
