# 存储与分区

```zhizhan-anchor
m06
```



存储选型决定文件系统与升级方案： **eMMC/SD 用 EXT4/F2FS，原始 NAND 可采用 UBI\+UBIFS；NOR 按需求比较 JFFS2 等方案** 。分区要在 BSP 阶段定死，尤其给升级预留 A/B 与 recovery；否则升级失败无路可退。

 

> 前置：了解块设备、分区表与 EXT4/UBIFS 等文件系统差异。 · ◷ 约 42 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按介质选文件系统、规划分区与 A/B/recovery 落点，并机器校验 root= 指向真实根分区。

 

本章速览




- eMMC/SD 用 EXT4/F2FS，原始 NAND 可采用 UBI\+UBIFS；NOR 按需求比较 JFFS2 等方案。

- 分区要在 BSP 阶段定死：boot/rootfs/恢复/参数各自的落点。

- A/B 分区 \+ bootcount 回滚，是“升级不变砖”的落地方式。

 

```zhizhan-anchor
m06-media
```



```zhizhan-anchor
m06-media-t
```



## 6.1 介质 → 文件系统 → 升级落点



存储选型是三件事一起定： **介质** （eMMC/NAND/NOR）、 **文件系统** （EXT4/F2FS/UBIFS）、 **升级落点** （A/B 分区、recovery）。原始 NAND 通常需要坏块管理，NOR 的约束不同；按介质与需求选择文件系统；UBIFS 建在 UBI 上，由 UBI 处理相关坏块与磨损管理，JFFS2 则直接面向 MTD。



表 6.1 介质、文件系统与升级落点



| 介质 | 文件系统 | 特点 | 升级落点 |
| --- | --- | --- | --- |
| eMMC/SD | EXT4 / F2FS | 容量大、控制器处理坏块 | A/B 分区 |
| NAND | UBIFS | 需坏块与磨损管理 | A/B 卷 |
| NOR | UBIFS/JFFS2 | 容量小、可靠 | 双镜像 |
| RAM | tmpfs/initramfs | 易失，用于引导/恢复 | recovery |



一句话原则



“块设备可靠”用 EXT4/F2FS；“裸闪存有坏块”用 UBIFS/Ubi 层。把 ext4 直接放在裸 NAND 上，几乎必然在坏块出现时损坏。



```zhizhan-anchor
m06-part
```



```zhizhan-anchor
m06-part-t
```



## 6.2 分区规划：给升级留退路



分区表在 BSP 阶段定死。典型布局要预留  **A/B 根分区 \+ recovery \+ 数据分区** ，这样升级写“另一侧”、失败能回滚、最坏还能进 recovery。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  一个“可升级、可恢复”的分区布局



```zhizhan-figure
<svg viewBox="0 0 800 190" width="100%" height="190" role="img" aria-label="一个“可升级、可恢复”的分区布局" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">boot（内核 + dtb）</text><rect x="60" y="64" width="680" height="35" rx="6" class="sv-grn-s"></rect><text x="75" y="85.5" class="sv-lbl-hi">rootfs_a</text><rect x="60" y="103" width="680" height="35" rx="6" class="sv-grn-s"></rect><text x="75" y="124.5" class="sv-lbl-hi">rootfs_b</text><rect x="60" y="142" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="161.0" class="sv-lbl-hi">recovery（救援）</text><rect x="60" y="176" width="680" height="35" rx="6" class="sv-box"></rect><text x="75" y="197.5" class="sv-lbl-hi">data（持久数据）</text></svg>
```



boot（内核\+dtb）、rootfs\_a / rootfs\_b（双根，轮流升级）、recovery（救援）、data（用户数据）。A/B 双根是“升级不变砖”的物理基础。



partition\_imx.txtText

 

```text
# i.MX6ULL · SD 卡分区（DOS/MBR）
#  1  FAT32  boot   64MiB   zImage + imx6ull-*.dtb
#  2  ext4   rootfs 剩余    根文件系统
# Yocto 用 .wic 镜像把 boot 与 rootfs 一次写入，免手工分区：
#   bmaptool copy core-image-minimal-imx6ull14x14evk.wic.bz2 /dev/sdX
```

i.MX6ULL 分区表（labs/ 逐字一致）



mkfs\_and\_flash.txt 节选Shell

 

```text
# 按分区表格式化（类型要与 rootfstype 一致）
mkfs.ext4 /dev/mmcblk0p5      # rootfs_a
mkfs.ext4 /dev/mmcblk0p6      # rootfs_b
mkfs.ext4 /dev/mmcblk0p7      # data
# NAND 上则用 UBI 层：ubiformat + ubiattach + ubimkvol（不用 mkfs.ext4）
```

格式化类型必须与 rootfstype / 分区角色一致



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.3 真实证据：root= 校验



最常见的启动失败是 ` root= ` 指向不存在的分区或裸分区（如 ssbl）。把分区表与 ` root= ` 做一次机器校验，能在烧录前发现问题：



host\_partition.cC

 

```text
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
```

root= 与分区一致性校验（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_partition.c -o labs/host_partition && ./labs/host_partition
root=/dev/mmcblk0p5 → 分区 5：rootfs (ext4)
root=/dev/mmcblk0p7 → 不存在（期望“不存在/越界”被拒绝）
分区 3=ssbl 是否为裸分区（不可作 root）=是
RESULT: PASS
```



mmcblk0p5 命中 rootfs(ext4)；mmcblk0p7 越界被拒；分区 3 是裸分区（ssbl），不能当 root。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  烧录前的三步校验



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="烧录前的三步校验" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">解析 root=</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">查分区表</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验类型/裸分区</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">允许烧录</text></svg>
```



解析 root= → 查分区表是否越界/存在 → 校验文件系统类型与是否裸分区。三步都过，才可能正常挂根。



表 6.2 挂根前必查的四项



| 校验项 | 正确 | 错误后果 |
| --- | --- | --- |
| 分区存在 | 在表内 | 不存在 → panic |
| 非越界 | 索引 \< 分区数 | 越界 → panic |
| 非裸分区 | 含文件系统 | 裸分区（ssbl）→ 挂载失败 |
| 类型匹配 | 与 mkfs 一致 | rootfstype 错 → 挂载失败 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm06-routes\n```\n\n\n\n```zhizhan-anchor\nm06-routes-t\n```\n\n\n\n## 6.4 三条路线对照：分区与文件系统\n\n\n\n三条路线的介质与文件系统不同，但“A/B \\+ recovery”的退路一致。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| 介质 | eMMC/SD |\n| fs | ext4 |\n| 升级 | A/B \\+ recovery |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| 介质 | eMMC/NAND |\n| fs | ext4 / ubifs |\n| 升级 | A/B \\+ recovery |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| 介质 | SPI-NAND/SD |\n| fs | ubifs / ext4 |\n| 升级 | A/B \\+ recovery |"}
````



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **root= 指向裸分区** ：内核找不到文件系统，直接 panic。

- **NAND 直接 ext4** ：无坏块/磨损处理，很快损坏。

- **分区表与 U-Boot 环境不一致** ：升级写到错误分区。

- **未预留 recovery** ：升级失败后无路可退。



◆ 自测 · Module 06（先答再看）




1. NAND 上为什么通常用 UBIFS 而不是 EXT4？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"NAND 有坏块与擦写寿命限制，EXT4 假设块设备可靠；UBIFS 建在 UBI 之上，相关坏块管理与磨损均衡由 UBI 层提供；JFFS2 等方案需按需求比较。"}
   ```

2. root= 指向 ssbl（裸分区）会发生什么？为什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内核找不到文件系统，直接 panic。因为裸分区没有文件系统镜像，无法作为根挂载。"}
   ```

3. 为什么分区表要在 BSP 阶段就预留 A/B 与 recovery？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"A/B 双根让升级写“另一侧”，失败可回滚；recovery 提供最坏情况的救援入口。事后改动分区表代价极高，必须在早期定死。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：导出你板子的实际分区表，核对 root= 与 mkfs 类型，确认已预留 A/B 与 recovery。



核对与延伸：[Buildroot 官方手册](https://buildroot.org/downloads/manual/manual.html) · [SWUpdate 官方文档](https://sbabic.github.io/swupdate/)

 

动手练习



运行 ` labs/host_partition.c `：把 ` root= ` 解析为分区号，校验是否为真实根分区、是否误指裸分区。



**检查结果：** /dev/mmcblk0p5→rootfs(ext4) 正确；/dev/mmcblk0p7→不存在被拒绝；分区 3=ssbl 为裸分区不可作 root。

 

迁移练习：把本章的“能按介质选文件系统、规划分区与 A/B/recovery 落点，并机器校验 root= 指向真实根分区。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m06","criterion":"/dev/mmcblk0p5→rootfs(ext4) 正确；/dev/mmcblk0p7→不存在被拒绝；分区 3=ssbl 为裸分区不可作 root。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
