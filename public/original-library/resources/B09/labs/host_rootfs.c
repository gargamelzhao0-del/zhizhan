/* host_rootfs.c —— 根文件系统布局自检（主机可运行）。
 *
 * init 之前要求最小根文件系统就位：关键目录、init、fstab、以及 busybox 的 applet 链接。
 * 缺目录或链接指向不存在的 busybox 都会导致启动失败（“No init found”）。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_rootfs.c -o host_rootfs && ./host_rootfs
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *path; const char *target; } ent_t;   /* target!=0 表示符号链接 */

static const char *REQ_DIRS[] = {"/bin", "/etc", "/lib", "/dev", "/proc", "/sys", "/usr"};
static const char *REQ_FILES[] = {"/sbin/init", "/etc/fstab"};

static int has_path(const ent_t *e, int n, const char *p) {
    for (int i = 0; i < n; i++) if (strcmp(e[i].path, p) == 0) return 1;
    return 0;
}
static const ent_t *find(const ent_t *e, int n, const char *p) {
    for (int i = 0; i < n; i++) if (strcmp(e[i].path, p) == 0) return &e[i];
    return 0;
}
/* 返回错误数，并打印每个问题 */
static int check(const ent_t *e, int n) {
    int errs = 0;
    for (unsigned i = 0; i < sizeof(REQ_DIRS) / sizeof(REQ_DIRS[0]); i++)
        if (!has_path(e, n, REQ_DIRS[i])) { printf("  缺目录: %s\n", REQ_DIRS[i]); errs++; }
    for (unsigned i = 0; i < sizeof(REQ_FILES) / sizeof(REQ_FILES[0]); i++)
        if (!has_path(e, n, REQ_FILES[i])) { printf("  缺文件: %s\n", REQ_FILES[i]); errs++; }
    /* busybox applet：/bin/sh 应是指向 busybox 的符号链接，且 busybox 存在 */
    const ent_t *sh = find(e, n, "/bin/sh");
    if (!sh) { printf("  缺 /bin/sh\n"); errs++; }
    else if (sh->target) {
        if (!has_path(e, n, "/bin/busybox")) { printf("  /bin/sh 指向 %s，但 busybox 不存在\n", sh->target); errs++; }
    }
    return errs;
}

int main(void) {
    ent_t good[] = {
        {"/bin", 0}, {"/etc", 0}, {"/lib", 0}, {"/dev", 0}, {"/proc", 0}, {"/sys", 0}, {"/usr", 0},
        {"/sbin/init", 0}, {"/etc/fstab", 0}, {"/bin/busybox", 0}, {"/bin/sh", "busybox"},
    };
    ent_t bad[] = {
        {"/bin", 0}, {"/etc", 0}, {"/lib", 0}, {"/dev", 0}, {"/sys", 0}, {"/usr", 0},   /* 缺 /proc */
        {"/sbin/init", 0}, {"/bin/sh", "busybox"},                                       /* 缺 fstab、busybox */
    };
    int ok = 1, e1, e2;
    printf("完整 rootfs 自检：\n");
    e1 = check(good, (int)(sizeof(good) / sizeof(good[0])));
    printf("  错误数=%d（期望 0）\n", e1);
    if (e1 != 0) ok = 0;

    printf("残缺 rootfs 自检：\n");
    e2 = check(bad, (int)(sizeof(bad) / sizeof(bad[0])));
    printf("  错误数=%d（期望 ≥3）\n", e2);
    if (e2 < 3) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
