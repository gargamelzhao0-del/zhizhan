# 内核配置与启动

```zhizhan-anchor
m04
```



内核配置 =  **defconfig \+ 片段** 。关掉用不到的子系统既能缩小镜像，也能缩短启动（少 probe、少初始化）。但配置里藏着 Kconfig 的  **select/depends on**  依赖陷阱——本章把它显式跑出来。

 

> 前置：了解 Kconfig 体系、defconfig 与内核启动参数（bootargs）。 · ◷ 约 42 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 defconfig\+片段裁剪内核、设对 bootargs，并检测 select 引起的“被选中但依赖未满足”冲突。

 

本章速览




- 内核配置 = defconfig \+ 片段裁剪；关掉不用的子系统能显著缩短启动时间。

- 启动参数（bootargs）决定 console/root/init；写错就起不来。

- initramfs 适合早期根与恢复；常规根在块设备上，便于升级。

 

```zhizhan-anchor
m04-config
```



```zhizhan-anchor
m04-config-t
```



## 4.1 配置从哪里来：defconfig \+ 片段



内核配置不要从零手配。惯例是 **取 SoC 官方 defconfig 作基线** ，再用 **配置片段** 打开/关闭少量项，并把片段纳入版本管理。这样升级内核时冲突最小、也最可复现。



表 4.1 内核配置的五要素



| 要素 | 做法 | 注意 |
| --- | --- | --- |
| defconfig | 从 SoC 官方配置起 | 不要从零手配 |
| 裁剪 | 关无用于系统/文件系统 | 别裁掉启动必需项 |
| bootargs | console/root/init | 与 U-Boot、设备树保持一致 |
| 早期根 | initramfs | 适合引导/恢复，常规根在块设备 |
| 启动时间 | 逐跳量化 | 优先优化最大的一跳 |



kernel\_imx.cfgText

 

```text
# i.MX6ULL · 内核配置片段
CONFIG_SOC_IMX6ULL=y
CONFIG_SERIAL_IMX=y
CONFIG_MMC_SDHCI_ESDHC_IMX=y
CONFIG_EXT4_FS=y
CONFIG_USB_GADGET=y
# 设备树随内核一起编：CONFIG_OF + 具体 dts 在 arch/arm/boot/dts/Makefile
```

i.MX6ULL 内核配置片段（labs/ 逐字一致）



```zhizhan-anchor
m04-kconfig
```



```zhizhan-anchor
m04-kconfig-t
```



## 4.2 依赖陷阱：select 与 depends on



Kconfig 有两类依赖：` depends on `（本符号依赖别人）与 ` select `（本符号强制打开别人）。 **select 会把被选中符号打开，但如果它的 depends on 没满足，就形成“被选中却依赖不满足”的冲突** ——这类问题在厂商 defconfig 里也常见。



host\_kconfig.cC

 

```text
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
```

Kconfig select 展开与冲突检测（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_kconfig.c -o labs/host_kconfig && ./labs/host_kconfig
请求 {C}：
启用: B C 
  冲突: B 依赖 A，但 A 未启用
请求 {A,C}：
启用: A B C 
RESULT: PASS
```



请求 {C} 时 C 选中 B，但 B 依赖 A 未启用 → 报冲突；补上 A 后（{A,C}）展开为 A B C 且无冲突。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  select 展开与冲突



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="select 展开与冲突" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">请求</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">展开 select</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">检查 depends on</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">冲突/通过</text></svg>
```



请求某符号 → 展开它的 select → 得到启用集合 → 检查每个被选符号的 depends on 是否满足 → 不满足即冲突。补上缺失依赖后集合自洽。



把这条用进工程



拿到一份“能编过”的 defconfig 不等于“依赖自洽”。用 ` scripts/kconfig ` 或构建系统的依赖检查跑一遍，能提前抓到“被选中但依赖未满足”的隐患——它常在运行期才以诡异行为暴露。



```zhizhan-anchor
m04-boot
```



```zhizhan-anchor
m04-boot-t
```



## 4.3 启动参数与 root：三处要保持一致



` bootargs ` 决定内核怎么找根、输出到哪。它可能来自 U-Boot、设备树 ` /chosen/bootargs ` 或内核内建—— **三处冲突时优先级容易误判** ，务必只保留一处为准。



表 4.2 关键 bootargs 与后果



| 参数 | 作用 | 写错的后果 |
| --- | --- | --- |
| console= | 内核日志输出设备 | 看不到启动日志 |
| root= | 根文件系统位置 | panic: no rootfs |
| rootfstype= | 根文件系统类型 | 挂载失败 |
| init= | 第一个用户态程序 | 找不到 init |
| rw/ro | 根是否可写 | 只读根下写文件失败 |



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  bootargs 的三个值分别指向什么



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="bootargs 的三个值分别指向什么" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="33" rx="6" class="sv-cyn-s"></rect><text x="75" y="50.7" class="sv-lbl-hi">console= → 串口/显示</text><rect x="60" y="67" width="680" height="33" rx="6" class="sv-grn-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">root= → 根分区设备</text><rect x="60" y="105" width="680" height="33" rx="6" class="sv-amb-s"></rect><text x="75" y="125.3" class="sv-lbl-hi">rootfstype= → 文件系统类型</text></svg>
```



console 决定日志去哪（出不来日志先查它）；root 指向根分区（要与真实分区一致）；rootfstype 要与 mkfs 的类型一致。三者任一错，都表现为“起不来或看不到”。



bootargs.txt 节选Text

 

```text
# 三处只保留一处为准（示例：以 U-Boot 的 bootargs 为准）
console=ttySTM0,115200 root=/dev/mmcblk0p2 rootfstype=ext4 rw rootwait
# root= 必须与真实分区一致；rootfstype 与 mkfs 的类型一致；
# 只读根方案用 ro + overlayfs/只读 rootfs。
```

console/root/rootfstype 三件套要和实际硬件、分区一致



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm04-routes\n```\n\n\n\n```zhizhan-anchor\nm04-routes-t\n```\n\n\n\n## 4.4 三条路线对照：内核配置与 bootargs\n\n\n\n三条路线的内核配置入口不同，但都要守住“ **defconfig\\+片段、bootargs 三件套一致** ”。对照时重点看 console/root/rootfstype 的取值。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| 配置 | defconfig \\+ fragment |\n| console | ttySTM0,115200 |\n| root | /dev/mmcblk0p2 ext4 |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| 配置 | defconfig \\+ .cfg |\n| console | ttymxc0,115200 |\n| root | /dev/mmcblk1p2 ext4 |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| 配置 | defconfig \\+ .cfg |\n| console | ttyS0,115200 |\n| root | /dev/mmcblk0p2 ext4 |"}
````



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **裁剪掉启动必需项** ：如根文件系统驱动，直接 panic。

- **bootargs 与设备树冲突** ：两处都写，行为取决于优先级，容易误判。

- **select 隐藏依赖** ：配置看似成功，运行期异常。

- **不做启动时间量化** ：优化靠感觉，收益不确定。



◆ 自测 · Module 04（先答再看）




1. 为什么“把内核裁到最小”不一定启动最快？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"启动时间由“初始化 \\+ probe”主导，体积只影响加载。有些裁剪会让系统改用更慢的通用驱动，反而更慢；要逐跳量化再优化。"}
   ```

2. Kconfig 里 select 与 depends on 有什么区别？会带来什么风险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"` depends on ` 是本符号依赖别人；` select ` 是本符号强制打开别人。风险：select 打开了某符号，但它的 depends on 未满足 → “被选中却依赖不满足”的冲突。"}
   ```

3. console/root/rootfstype 三处冲突会怎样？怎么避免？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"冲突会导致看不到日志、挂不到根或挂载失败。避免方法：只保留一处为准（通常 U-Boot 的 bootargs），并确保与真实分区、mkfs 类型一致。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用你板子的 defconfig 跑一次依赖检查，找出任意一处“被选中但依赖未满足”的符号并给出最小修复片段。



核对与延伸：[Buildroot 官方手册](https://buildroot.org/downloads/manual/manual.html) · [Linux 内核 · 设备树用法](https://www.kernel.org/doc/html/latest/devicetree/usage-model.html)

 

动手练习



运行 ` labs/host_kconfig.c `：解析请求集合、展开 select，并检测“被选中但依赖未满足”的冲突。



**检查结果：** 请求 {C} 时展开 select 得到 B、C 并报“B 依赖 A 未启用”冲突；补上 A 后（{A,C}）无冲突。

 

迁移练习：把本章的“能用 defconfig\+片段裁剪内核、设对 bootargs，并检测 select 引起的“被选中但依赖未满足”冲突。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m04","criterion":"请求 {C} 时展开 select 得到 B、C 并报“B 依赖 A 未启用”冲突；补上 A 后（{A,C}）无冲突。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
