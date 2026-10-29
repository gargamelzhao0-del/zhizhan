# 启动、存储与系统恢复实战

```zhizhan-anchor
m10
```



把前 9 章收口成一条实战主线： **构建 → 烧录 → 启动 → 只读根 → A/B 升级 → 恢复** 。每一步都要有日志，以及“卡住时怎么办”。目标只有一个： **升级不变砖** 。

 

> 前置：完成 M01–M09，掌握启动链、根文件系统、A/B 升级与恢复概念。 · ◷ 约 46 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把“构建→烧录→启动→只读根→A/B 升级→recovery 恢复”串成一条升级不变砖的闭环。

 

本章速览




- 实战主线：构建 → 烧录 → 启动 → 只读根 → A/B 升级 → 恢复。

- 每一步都要有日志与“卡住时怎么办”；recovery 分区是最后的保险。

- 启动时间用日志逐跳量化，优化收益最大的那一跳。

 

```zhizhan-anchor
m10-cpio
```



```zhizhan-anchor
m10-cpio-t
```



## 10.1 initramfs/cpio：最小的引导与恢复盘



initramfs 就是一个  **cpio(newc) 归档** ：内核把它解到内存里当根，常用于引导内存盘与 recovery。理解它的打包格式，是构造最小恢复系统的基础。



host\_cpio.cC

 

```text
/* host_cpio.c —— cpio newc 归档打包/解包（initramfs 模型，主机可运行）。
 *
 * initramfs 就是一个 cpio(newc) 归档：内核把它解到内存里当根。本程序打包两个文件，
 * 再按 newc 格式解析回来，验证魔数、文件名与内容。
 *
 * newc 头：magic(6) + 13×8 位十六进制字段(104) + name(namesize，按 4 对齐) + data(按 4 对齐)。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cpio.c -o host_cpio && ./host_cpio
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static int put_header(char *out, const char *name, unsigned mode, unsigned size, unsigned ino) {
    unsigned namesize = (unsigned)strlen(name) + 1;
    sprintf(out, "070701%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x",
            ino, mode, 0u, 0u, 1u, 0u, size, 0u, 0u, 0u, 0u, namesize, 0u);
    memcpy(out + 110, name, namesize);
    int total = 110 + (int)namesize;
    while (total % 4) out[total++] = 0;
    return total;
}
static unsigned get_hex(const char *p) {
    char hx[9]; memcpy(hx, p, 8); hx[8] = 0;
    unsigned v = 0; sscanf(hx, "%x", &v); return v;
}

int main(void) {
    int ok = 1;
    char arc[512]; int an = 0;
    const char *nm1 = "init", *nm2 = "etc/fstab";
    const char *d1 = "#!/bin/sh\n", *d2 = "/dev/root / ext4 ro 0 1\n";
    unsigned s1 = (unsigned)strlen(d1), s2 = (unsigned)strlen(d2);

    an += put_header(arc + an, nm1, 0100755u, s1, 1u);
    memcpy(arc + an, d1, s1); an += (int)s1; while (an % 4) arc[an++] = 0;
    an += put_header(arc + an, nm2, 0100644u, s2, 2u);
    memcpy(arc + an, d2, s2); an += (int)s2; while (an % 4) arc[an++] = 0;
    an += put_header(arc + an, "TRAILER!!!", 0u, 0u, 0u);
    printf("打包：%d 字节，含 %s(%u) 与 %s(%u)\n", an, nm1, s1, nm2, s2);
    if (an <= 0 || memcmp(arc, "070701", 6) != 0) ok = 0;

    int off = 0, count = 0;
    while (off + 110 <= an) {
        if (memcmp(arc + off, "070701", 6) != 0) { ok = 0; break; }
        unsigned size = get_hex(arc + off + 54);       /* 第 7 个字段：filesize */
        unsigned nsize = get_hex(arc + off + 94);      /* 第 12 个字段：namesize */
        const char *name = arc + off + 110;
        if (strcmp(name, "TRAILER!!!") == 0) break;
        int name_total = 110 + (int)nsize;              /* 头 110 + 名字，再按 4 对齐 */
        while (name_total % 4) name_total++;
        int data_off = off + name_total;
        printf("  解出: %s size=%u data=\"%.*s\"\n", name, size, (int)size, arc + data_off);
        if (strcmp(name, nm1) == 0 && (size != s1 || memcmp(arc + data_off, d1, s1) != 0)) ok = 0;
        if (strcmp(name, nm2) == 0 && (size != s2 || memcmp(arc + data_off, d2, s2) != 0)) ok = 0;
        count++;
        off = data_off + (int)((size + 3u) & ~3u);
    }
    printf("解出文件数=%d（期望 2）\n", count);
    if (count != 2) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

cpio(newc) 打包/解包（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_cpio.c -o labs/host_cpio && ./labs/host_cpio
打包：396 字节，含 init(10) 与 etc/fstab(24)
  解出: init size=10 data="#!/bin/sh
"
  解出: etc/fstab size=24 data="/dev/root / ext4 ro 0 1
"
解出文件数=2（期望 2）
RESULT: PASS
```



newc 归档能正确打包并逐字解出——这就是内核拿来当临时根的那种格式。



表 10.1 内存盘/归档的用途



| 用途 | 内容 | 特点 |
| --- | --- | --- |
| 引导用 initramfs | 最小 init \+ 挂根所需模块 | 先起来再切到真实根 |
| recovery 盘 | 救援工具 \+ 恢复脚本 | 独立于 A/B，最坏兜底 |
| 只读根的可写层 | （非 cpio）overlay | 见 M05 |



```zhizhan-anchor
m10-ab
```



```zhizhan-anchor
m10-ab-t
```



## 10.2 A/B 升级与 bootcount：失败自动回滚



A/B 升级的核心是： **永不覆盖正在运行的分区** ，写“另一侧”；新分区第一次启动可能失败，用 ` bootcount ` 记录尝试次数，超过阈值就切回旧分区——实现“失败自动回滚”。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  A/B 切换与回滚状态机



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="A/B 切换与回滚状态机" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">运行 A</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">写入 B</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">试运行 B</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">成功确认</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">失败回滚 A</text></svg>
```



当前跑 A → 写入 B → 标记 B 为待验证并置 bootcount → 重启试运行 B（成功则 confirm）→ 若连续失败达阈值则切回 A。全程不覆盖正在运行的分区。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  A/B \+ recovery 的分区角色



```zhizhan-figure
<svg viewBox="0 0 800 180" width="100%" height="180" role="img" aria-label="A/B + recovery 的分区角色" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="43" rx="6" class="sv-grn-s"></rect><text x="75" y="55.7" class="sv-lbl-hi">rootfs_a（当前）</text><rect x="60" y="77" width="680" height="43" rx="6" class="sv-cyn-s"></rect><text x="75" y="103.0" class="sv-lbl-hi">rootfs_b（待升级）</text><rect x="60" y="125" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="143.7" class="sv-lbl-hi">bootcount/bootstate</text><rect x="60" y="159" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="177.7" class="sv-lbl-hi">recovery（救援，独立）</text></svg>
```



rootfs\_a / rootfs\_b 轮流当“当前/待升级”；bootcount 记录尝试；recovery 独立兜底。三者配合才构成“升级不变砖”。



表 10.2 每个环节都要有兜底



| 环节 | 手段 | 兜底 |
| --- | --- | --- |
| 启动 | 串口日志逐跳 | recovery 介质 |
| 根文件系统 | 只读根 \+ overlay | 覆盖式恢复 |
| 升级 | A/B \+ bootcount | 自动回滚 |
| 恢复 | recovery 分区 | 重刷整镜像 |
| 崩溃 | pstore 保留日志 | 定位根因 |



```zhizhan-anchor
m10-recovery
```



```zhizhan-anchor
m10-recovery-t
```



## 10.3 recovery：最坏情况的兜底



recovery 是独立于 A/B 的救援入口：当两侧都坏、或升级脚本本身出错时，能起来一个最小系统去重刷镜像或恢复根。没有 recovery，一旦两侧都坏就只能返厂。



abupdate\_mp1.shShell

 

```text
#!/bin/sh
# STM32MP1 · A/B 根分区切换（U-Boot 侧用 bootcount + upgrade_available 判定）
# 正在跑 rootfsA(/dev/mmcblk0p5)，把新镜像写进 rootfsB(/dev/mmcblk0p6)
set -e
dd if=rootfsB.ext4 of=/dev/mmcblk0p6 bs=4M conv=fsync
sync

# 让 U-Boot 下次从 B 启动，并允许一次失败自动回退
fw_setenv upgrade_available 1
fw_setenv bootcount 0
fw_setenv bootslot B
reboot
```

STM32MP1 A/B 升级脚本（labs/ 逐字一致）



recovery\_v3s.shShell

 

```text
#!/bin/sh
# Allwinner V3s · 恢复介质与只读根恢复
# 从 SD 卡的 recovery 分区（p3）覆盖损坏的 rootfs（p2），再切回正常启动
set -e
mkdir -p /mnt/rec /mnt/root
mount /dev/mmcblk0p3 /mnt/rec
mount /dev/mmcblk0p2 /mnt/root
rsync -a --delete /mnt/rec/rootfs/ /mnt/root/
sync
umount /mnt/root /mnt/rec
reboot
```

V3s recovery 脚本（labs/ 逐字一致）



表 10.3 恢复场景与手段



| 恢复场景 | 手段 | 前提 |
| --- | --- | --- |
| 新固件启动失败 | bootcount 回滚 | A/B \+ bootstate |
| 根被改坏 | recovery 覆盖恢复 | recovery 分区/tmpfs |
| 整机不启动 | recovery 重刷镜像 | 可用启动介质 |
| 偶发崩溃 | pstore 取日志 | ramoops 已配置 |



```zhizhan-anchor
m10-close
```



```zhizhan-anchor
m10-close-t
```



## 10.4 闭环：升级不变砖的检查清单



把“构建→烧录→启动→只读根→A/B 升级→恢复”逐环检查一遍，任何一环缺兜底，都可能在现场变成砖。



表 10.4 升级不变砖检查清单



| 检查项 | 通过标准 |
| --- | --- |
| 不覆盖运行分区 | 升级只写另一侧 |
| 有回滚机制 | bootcount \+ bootstate 生效 |
| 有 recovery | 独立分区/tmpfs 可启动 |
| 根可恢复 | 只读根 \+ overlay，重启即恢复 |
| 有日志留存 | pstore/ramoops 已配置 |
| 可复现 | 镜像/脚本版本化（M09） |



这一册真正训练的能力



不是记住某块板的参数，而是 **拿到任意 SoC 与硬件，都能按“启动链→设备树→内核→rootfs→存储→升级/恢复”搭起一套可启动、可诊断、可升级不变砖的系统** 。换块板子，换的只是三路线对照表里的那一列。



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm10-routes\n```\n\n\n\n```zhizhan-anchor\nm10-routes-t\n```\n\n\n\n## 10.5 三条路线对照：升级与恢复\n\n\n\n三条路线的升级脚本与恢复方式不同，但“A/B \\+ bootcount \\+ recovery”的闭环一致。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| 升级 | abupdate\\_mp1.sh |\n| 回滚 | bootcount |\n| 恢复 | recovery |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| 升级 | abupdate\\_imx.sh |\n| 回滚 | bootcount |\n| 恢复 | recovery |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| 升级 | A/B 脚本 |\n| 回滚 | bootcount |\n| 恢复 | recovery\\_v3s.sh |"}
````



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.6 常见误区与排障



失败路径与排障




- **升级覆盖正在运行的分区** ：断电即砖；必须写另一侧 A/B。

- **无 bootcount 回滚** ：坏固件反复启动失败，无法自愈。

- **只读根可写层未持久化** ：重启后配置全丢。

- **没有 recovery** ：两侧都坏就只能返厂。



◆ 自测 · Module 10（先答再看）




1. A/B 升级时，为什么要配合 bootcount？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"新分区第一次启动可能失败。bootcount 记录启动尝试，超过阈值就切回旧分区，实现“失败自动回滚”，避免坏固件把设备卡死。"}
   ```

2. 为什么升级“永不覆盖正在运行的分区”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"覆盖运行中的分区时断电就会变砖，且没有退路。写“另一侧”再切换，才能在失败时回滚。"}
   ```

3. 为什么必须有 recovery？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"A/B 都可能被写坏或升级脚本出错。recovery 是独立兜底入口，能起来最小系统重刷/恢复，避免“返厂”这一最后手段。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：照表 10.4 的检查清单审计你项目的升级方案，补齐缺失的兜底项，并做一次“断电中断升级”的演练。



核对与延伸：[SWUpdate 官方文档](https://sbabic.github.io/swupdate/) · [RAUC 官方文档](https://rauc.readthedocs.io/)

 

动手练习



运行 ` labs/host_cpio.c ` 打包/解包 newc 归档；结合 ` labs/abupdate_mp1.sh ` 与 ` labs/recovery_v3s.sh ` 理解升级与恢复。



**检查结果：** cpio 打包=396 字节、解出文件数=2（逐字一致）；A/B 脚本具备切换与 bootcount 回滚语义；recovery 能覆盖恢复。

 

迁移练习：把本章的“能把“构建→烧录→启动→只读根→A/B 升级→recovery 恢复”串成一条升级不变砖的闭环。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m10","criterion":"cpio 打包=396 字节、解出文件数=2（逐字一致）；A/B 脚本具备切换与 bootcount 回滚语义；recovery 能覆盖恢复。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
