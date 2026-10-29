/* host_platform.c —— platform driver 匹配与 deferred probe 模型（主机可运行）。
 *
 * 内核按 compatible 把设备与驱动绑定；若某设备的依赖尚未就绪，则返回 -EPROBE_DEFER，稍后重试。
 * 本程序验证：匹配成功 → probe；依赖未就绪 → deferred；无匹配 → unbound。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_platform.c -o host_platform && ./host_platform
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *compatible; const char *drv; } match_t;
static const match_t MATCH[] = { {"v,dev-a", "drvA"}, {"v,dev-b", "drvB"} };
#define NM (int)(sizeof(MATCH) / sizeof(MATCH[0]))

typedef struct { const char *name; const char *compat; const char *dep; int probed; int deferred; } dev_t;
static dev_t DEV[] = {
    {"dev-b@0", "v,dev-b", "v,dev-a", 0, 0},
    {"dev-a@1", "v,dev-a", 0,         0, 0},
    {"dev-c@2", "v,dev-c", 0,         0, 0},
};
#define NDV (int)(sizeof(DEV) / sizeof(DEV[0]))

static const char *drv_for(const char *c) { for (int i = 0; i < NM; i++) if (strcmp(MATCH[i].compatible, c) == 0) return MATCH[i].drv; return 0; }
static int dep_ready(const char *dep) { if (!dep) return 1; for (int i = 0; i < NDV; i++) if (strcmp(DEV[i].compat, dep) == 0) return DEV[i].probed; return 0; }

int main(void) {
    int ok = 1;
    /* 第一遍：dev-b 的依赖 dev-a 尚未 probe → deferred */
    for (int i = 0; i < NDV; i++) {
        const char *d = drv_for(DEV[i].compat);
        if (!d) { printf("%-8s unbound（无匹配驱动）\n", DEV[i].name); continue; }
        if (!dep_ready(DEV[i].dep)) { DEV[i].deferred = 1; printf("%-8s deferred（依赖 %s 未就绪）\n", DEV[i].name, DEV[i].dep); continue; }
        DEV[i].probed = 1; printf("%-8s probe → %s\n", DEV[i].name, d);
    }
    if (DEV[1].probed != 1) ok = 0;      /* dev-a 已 probe */
    if (DEV[0].probed != 0 || DEV[0].deferred != 1) ok = 0;

    /* 第二遍：重试 deferred */
    printf("-- 重试 deferred --\n");
    for (int i = 0; i < NDV; i++)
        if (DEV[i].deferred && dep_ready(DEV[i].dep)) { DEV[i].probed = 1; printf("%-8s probe → %s\n", DEV[i].name, drv_for(DEV[i].compat)); }
    if (DEV[0].probed != 1) ok = 0;

    printf("最终：probed=%d unbound=1\n", DEV[0].probed + DEV[1].probed);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
