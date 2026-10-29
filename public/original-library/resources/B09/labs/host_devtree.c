/* host_devtree.c —— 设备树语义模型：路径查找 + compatible 匹配 + status（主机可运行）。
 *
 * 内核用“节点路径 + 属性”描述硬件；驱动靠 compatible 匹配设备，status=disabled 表示不使能。
 * 本程序用一个内存中的树模型验证：① 按路径找到节点；② compatible 匹配；③ 只对 enabled 节点驱动。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_devtree.c -o host_devtree && ./host_devtree
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *k; const char *v; } prop_t;
typedef struct { const char *name; const char *parent; prop_t props[4]; int np; } node_t;

static node_t tree[] = {
    {"/", 0, {{0, 0}}, 0},
    {"soc", "/", {{0, 0}}, 0},
    {"uart@40011000", "soc", {{"compatible", "st,stm32-uart"}, {"status", "okay"}}, 2},
    {"i2c@40012000", "soc", {{"compatible", "st,stm32-i2c"}, {"status", "disabled"}}, 2},
};
#define NN (int)(sizeof(tree) / sizeof(tree[0]))

/* 构造节点的全路径：/soc/uart@40011000 */
static void full_path(const node_t *n, char *out) {
    if (n->parent == 0) { strcpy(out, "/"); return; }
    for (int i = 0; i < NN; i++) {
        if (&tree[i] == n) continue;
        if (strcmp(tree[i].name, n->parent) == 0) {
            char up[128];
            full_path(&tree[i], up);
            if (strcmp(up, "/") == 0) snprintf(out, 128, "/%s", n->name);
            else snprintf(out, 128, "%s/%s", up, n->name);
            return;
        }
    }
    strcpy(out, "/?");
}
static const node_t *dt_find(const char *path) {
    char buf[128];
    for (int i = 0; i < NN; i++) { full_path(&tree[i], buf); if (strcmp(buf, path) == 0) return &tree[i]; }
    return 0;
}
static const char *dt_prop(const node_t *n, const char *k) {
    for (int i = 0; i < n->np; i++) if (strcmp(n->props[i].k, k) == 0) return n->props[i].v;
    return 0;
}
static int dt_is_enabled(const node_t *n) {
    const char *s = dt_prop(n, "status");
    return (s == 0 || strcmp(s, "okay") == 0);     /* 缺省为 enabled */
}
static int dt_compatible(const node_t *n, const char *drv) {
    const char *c = dt_prop(n, "compatible");
    return c && strcmp(c, drv) == 0;
}

int main(void) {
    int ok = 1, probed = 0;
    const node_t *u = dt_find("/soc/uart@40011000");
    char buf[128];
    if (u) { full_path(u, buf); printf("找到节点: %s  compatible=%s  status=%s\n",
             buf, dt_prop(u, "compatible"), dt_prop(u, "status") ? dt_prop(u, "status") : "okay"); }
    if (!u) ok = 0;
    if (!(u && dt_compatible(u, "st,stm32-uart"))) ok = 0;
    if (!(u && dt_is_enabled(u))) ok = 0;

    const node_t *i2c = dt_find("/soc/i2c@40012000");
    printf("i2c 节点 status=%s → 驱动%s\n", i2c ? dt_prop(i2c, "status") : "?",
           (i2c && dt_is_enabled(i2c)) ? "探测" : "跳过（disabled）");
    if (!(i2c && !dt_is_enabled(i2c))) ok = 0;

    for (int i = 0; i < NN; i++) if (dt_is_enabled(&tree[i]) && dt_prop(&tree[i], "compatible")) probed++;
    printf("可被 compatible 匹配且 enabled 的节点数=%d（期望 1：uart）\n", probed);
    if (probed != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
