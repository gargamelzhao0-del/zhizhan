/* host_partition.c —— 分区表与 root= 设备一致性检查（主机可运行）。
 *
 * 内核 cmdline 的 root= 必须指向真实的根分区；写错索引会“找不到根”而 panic。
 * 本程序把分区名/文件系统与 root= 设备做映射校验。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_partition.c -o host_partition && ./host_partition
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *name; const char *fs; int idx; } part_t;
static const part_t PARTS[] = {
    {"fsbl1", "(raw)", 1}, {"ssbl", "(raw)", 3}, {"boot", "ext4", 4}, {"rootfs", "ext4", 5},
};
#define NP (int)(sizeof(PARTS) / sizeof(PARTS[0]))

/* 取设备名末尾的分区号：/dev/mmcblk0p5 → 5；/dev/sda2 → 2 */
static int dev_index(const char *dev) {
    int n = (int)strlen(dev), i = n;
    while (i > 0 && dev[i - 1] >= '0' && dev[i - 1] <= '9') i--;
    int v = 0;
    for (int k = i; k < n; k++) v = v * 10 + (dev[k] - '0');
    return v;
}
static const part_t *find_idx(int idx) {
    for (int i = 0; i < NP; i++) if (PARTS[i].idx == idx) return &PARTS[i];
    return 0;
}

int main(void) {
    int ok = 1;
    const char *root1 = "/dev/mmcblk0p5";
    const part_t *p = find_idx(dev_index(root1));
    printf("root=%s → 分区 %d：%s (%s)\n", root1, dev_index(root1),
           p ? p->name : "不存在", p ? p->fs : "-");
    if (!(p && strcmp(p->name, "rootfs") == 0 && strcmp(p->fs, "ext4") == 0)) ok = 0;

    const char *root2 = "/dev/mmcblk0p7";
    printf("root=%s → %s（期望“不存在/越界”被拒绝）\n", root2, find_idx(dev_index(root2)) ? "存在" : "不存在");
    if (find_idx(dev_index(root2)) != 0) ok = 0;

    int raw = find_idx(3)->name ? strcmp(find_idx(3)->fs, "(raw)") == 0 : 0;
    printf("分区 3=%s 是否为裸分区（不可作 root）=%s\n", find_idx(3)->name, raw ? "是" : "否");
    if (!raw) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
