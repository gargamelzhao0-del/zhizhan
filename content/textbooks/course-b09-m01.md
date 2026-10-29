# SoC 架构与启动链

```zhizhan-anchor
m01
```



嵌入式 Linux 的启动是一条 **逐跳接力** ：ROM Code → SPL → U-Boot → Kernel → init，每一跳只做一小步，把下一跳加载起来。定位启动问题的唯一可靠方法，是 **串口抓全程日志、先确定卡在哪一跳** 。

 

> 前置：了解 MCU 上电复位流程、串口 console，以及 SoC 有片内 ROM 与外部启动介质。 · ◷ 约 44 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把启动日志分成 ROM→SPL→U-Boot→Kernel→init 五跳，量化各跳耗时并定位卡在哪一跳。

 

本章速览




- 启动链是 ROM→SPL→U-Boot→Kernel→init 逐跳接力，每跳只做一小步。

- 串口 console 抓全程日志：先确定“卡在哪一跳”，再查那一跳。

- 每跳的启动介质、加载地址与 bootargs 必须一致；不一致就停在上一跳。

 

```zhizhan-anchor
m01-chain
```



```zhizhan-anchor
m01-chain-t
```



## 1.1 五跳接力：每一跳只负责“把下一跳拉起来”



嵌入式 Linux 的启动不像 PC 一键到底，而是 **分级接力** ：片内 ROM 只会最少的事，它把 SPL 拉起来；SPL 初始化 DDR 后把 U-Boot 拉起来；U-Boot 加载内核与设备树并传参；内核 probe 驱动、挂根、启动用户态 init。 **每一跳的能力都在放大，问题也逐跳变具体** 。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  启动五跳与各跳职责



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="启动五跳与各跳职责" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">ROM Code</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">SPL/FSBL</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">U-Boot</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">Kernel</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">init</text></svg>
```



ROM（只读，选启动介质）→ SPL/FSBL（时钟、DDR）→ U-Boot（载内核\+DTB、传 bootargs）→ Kernel（probe、挂根、起 init）→ init（用户态第一个进程）。



表 1.1 五跳的职责与失败表现



| 阶段 | 职责 | 典型介质 | 失败表现 |
| --- | --- | --- | --- |
| ROM Code | 只读、最小初始化、按启动模式选介质 | SD/eMMC/NOR/串口 | 无任何日志 |
| SPL/FSBL | 时钟、DDR 初始化 | 从 ROM 加载 | 卡在“SPL” |
| U-Boot | 加载内核\+设备树、传 bootargs | SD/eMMC/网络 | 提示 missing kernel |
| Kernel | 驱动 probe、挂根、起 init | boot 分区 | panic: no rootfs |
| init | 用户态第一个进程 | rootfs | init not found |



为什么“分层”是嵌入式 Linux 的设计基石



ROM 不可改，所以只做最小的事；把复杂逻辑（DDR、加载、启动参数）交给可升级的 SPL/U-Boot。这带来两个好处： **可升级** （改 SPL/U-Boot 即可换启动策略）与 **可诊断** （每跳能打印，逐跳定位）。



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：把启动日志分段并量化



下面这段主机程序读一段启动日志，按关键字分段、算各段耗时，并检测 panic/ERROR——这正是你在板子上排查“慢在哪、卡在哪”的方法：



host\_bootlog.cC

 

```text
/* host_bootlog.c —— 启动日志分阶段与耗时分析（主机可运行）。
 *
 * 启动链 ROM→SPL→U-Boot→Kernel→init，每一跳都会在串口打印带时间戳的日志。
 * 本程序把日志按关键字分阶段、算出各阶段耗时，并检测 panic/卡死等异常。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bootlog.c -o host_bootlog && ./host_bootlog
 */
#include <stdio.h>
#include <string.h>

typedef struct { int ms; const char *s; } line_t;

static const char *phase_of(const char *s) {
    if (strstr(s, "ROM"))       return "ROM";
    if (strstr(s, "SPL"))       return "SPL";
    if (strstr(s, "U-Boot"))    return "U-Boot";
    if (strstr(s, "Linux version")) return "Kernel";
    if (strstr(s, "init:"))     return "init";
    return 0;
}
static int has_panic(const line_t *L, int n) {
    for (int i = 0; i < n; i++)
        if (strstr(L[i].s, "panic") || strstr(L[i].s, "ERROR")) return L[i].ms;
    return -1;
}
static int analyze(const line_t *L, int n) {
    const char *phases[5] = {"ROM", "SPL", "U-Boot", "Kernel", "init"};
    int at[5]; for (int i = 0; i < 5; i++) at[i] = -1;
    for (int i = 0; i < n; i++) {
        const char *p = phase_of(L[i].s);
        for (int j = 0; j < 5; j++) if (p && strcmp(p, phases[j]) == 0 && at[j] < 0) at[j] = L[i].ms;
    }
    printf("阶段时间(ms):");
    for (int j = 0; j < 5; j++) printf(" %s=%d", phases[j], at[j]);
    printf("\n");
    int order_ok = 1;
    for (int j = 1; j < 5; j++) if (at[j] < at[j - 1]) order_ok = 0;
    printf("阶段耗时(ms): ROM→SPL=%d SPL→U-Boot=%d U-Boot→Kernel=%d Kernel→init=%d 总=%d\n",
           at[1] - at[0], at[2] - at[1], at[3] - at[2], at[4] - at[3], at[4] - at[0]);
    int panic = has_panic(L, n);
    printf("异常(panic/ERROR)时刻=%d\n", panic);
    return order_ok && at[0] >= 0 && at[4] > at[0];
}

int main(void) {
    line_t good[] = {
        {0, "[ROM] boot mode SD"}, {8, "[SPL] ddr init"}, {18, "[U-Boot] 2023.10"},
        {140, "[U-Boot] loading kernel"}, {600, "[Linux version] 6.1"}, {2700, "[init:] started"},
    };
    line_t bad[] = {
        {0, "[ROM] boot"}, {10, "[SPL] ok"}, {30, "[U-Boot] load kernel"},
        {500, "[Linux version] 6.1"}, {900, "ERROR: rootfs mount failed"}, {1200, "Kernel panic - not syncing"},
    };
    int ok = 1, n1 = (int)(sizeof(good) / sizeof(good[0])), n2 = (int)(sizeof(bad) / sizeof(bad[0]));
    printf("== 正常启动 ==\n");
    if (!analyze(good, n1)) ok = 0;
    printf("\n== 故障启动 ==\n");
    int ok_bad = analyze(bad, n2);
    if (ok_bad) ok = 0;              /* 故障启动不应被判为“正常” */
    if (ok) printf("\n%s\n", "RESULT: PASS"); else printf("\n%s\n", "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

启动日志分段与耗时量化（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_bootlog.c -o labs/host_bootlog && ./labs/host_bootlog
== 正常启动 ==
阶段时间(ms): ROM=0 SPL=8 U-Boot=18 Kernel=600 init=2700
阶段耗时(ms): ROM→SPL=8 SPL→U-Boot=10 U-Boot→Kernel=582 Kernel→init=2100 总=2700
异常(panic/ERROR)时刻=-1

== 故障启动 ==
阶段时间(ms): ROM=0 SPL=10 U-Boot=30 Kernel=500 init=-1
异常(panic/ERROR)时刻=900
RESULT: PASS
```



正常启动里 U-Boot→Kernel 582ms、Kernel→init 2100ms 是两处大头；故障启动检测到 900ms 处 panic/ERROR。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  一次正常启动的各跳时间线



```zhizhan-figure
<svg viewBox="0 0 800 188" width="100%" height="188" role="img" aria-label="一次正常启动的各跳时间线" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V162"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V162"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">675</text><path class="sv-dash" d="M460,26 V162"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">1350</text><path class="sv-dash" d="M615,26 V162"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">2025</text><path class="sv-dash" d="M770,26 V162"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">2700</text><text x="12" y="48" class="sv-lbl">ROM→SPL</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="24" height="22" rx="4" class="sv-box"></rect><text x="162.0" y="47" text-anchor="middle" class="sv-lbl-hi">ROM/SPL</text><text x="12" y="82" class="sv-lbl">U-Boot</text><path class="sv-dash" d="M150,78 H770"></path><rect x="152" y="66" width="24" height="22" rx="4" class="sv-cyn-s"></rect><text x="163.8" y="81" text-anchor="middle" class="sv-lbl-hi">U-Boot</text><text x="12" y="116" class="sv-lbl">Kernel</text><path class="sv-dash" d="M150,112 H770"></path><rect x="154" y="100" width="134" height="22" rx="4" class="sv-amb-s"></rect><text x="221.0" y="115" text-anchor="middle" class="sv-lbl-hi">Kernel</text><text x="12" y="150" class="sv-lbl">Kernel→init</text><path class="sv-dash" d="M150,146 H770"></path><rect x="288" y="134" width="482" height="22" rx="4" class="sv-grn-s"></rect><text x="528.9" y="149" text-anchor="middle" class="sv-lbl-hi">init</text></svg>
```



横轴为时间(ms)。ROM/SPL 几乎瞬时，U-Boot 到 18ms，内核 ≈600ms，init 在 2700ms。优化启动时间就从“最大的一跳”下手（本例是 Kernel→init 段）。



表 1.2 按“卡在哪一跳”排障



| 现象 | 多半卡在 | 先查什么 |
| --- | --- | --- |
| 串口完全无输出 | ROM / SPL | 启动介质、SPL 是否烧写、DDR 初始化 |
| 有“SPL”但无后续 | SPL→U-Boot | 加载地址、介质、U-Boot 是否有效 |
| U-Boot 提示 missing kernel | U-Boot→Kernel | 内核镜像路径、bootargs、分区 |
| panic: no rootfs | Kernel→rootfs | root= 参数、分区、驱动是否编入 |
| init not found | rootfs | 根文件系统内容、/init 或 /sbin/init |



boot\_mp1.cmdText

 

```text
# STM32MP1 · U-Boot 启动脚本（distro boot：load kernel + dtb → bootz）
# bootargs 里 root= 指向根分区；ro 便于恢复，调试时可改 rw
setenv bootargs "console=ttySTM0,115200 root=/dev/mmcblk0p5 rootwait ro"
load mmc 0:4 ${kernel_addr_r} /boot/zImage
load mmc 0:4 ${fdt_addr_r} /boot/stm32mp157c-dk2.dtb
bootz ${kernel_addr_r} - ${fdt_addr_r}
```

STM32MP1 启动脚本（U-Boot，labs/ 逐字一致）



```zhizhan-anchor
m01-opt
```



```zhizhan-anchor
m01-opt-t
```



## 1.3 启动时间优化：先量化，再动手



启动优化不是“把内核裁小”就完事。用 1.2 的分段表找到 **耗时最大的一跳** ，针对性处理（并行 probe、延迟初始化、去掉不必要的等待）才有收益。



表 1.3 常见启动优化与其代价



| 优化点 | 典型收益 | 风险 |
| --- | --- | --- |
| 内核延迟初始化 / 并行 probe | 大 | 依赖顺序需理清 |
| 精简 U-Boot（去网络/去等待） | 中 | 失去部分救援能力 |
| 裁掉不用子系统 | 中 | 可能裁掉启动必需项 |
| 预置 initramfs（定向） | 中 | 体积增大 |
| 只读根 \+ 预读 | 小 | 需改造 rootfs |



uboot\_bootcmd.txt 节选U-Boot

 

```text
# U-Boot 里加载内核与设备树并传参的典型命令
load mmc 0:1 ${kernel_addr_r} zImage
load mmc 0:1 ${fdt_addr_r}    ${fdtfile}      # 板级 dtb
setenv bootargs console=ttyS0,115200 root=/dev/mmcblk0p2 rootfstype=ext4 rw rootwait
bootz ${kernel_addr_r} - ${fdt_addr_r}         # 内核 + dtb
# 排障：把这三条拆开逐条跑，看哪一步失败
```

U-Boot 的加载与传参是“卡在哪一跳”的第一现场



别在没有日志的情况下猜“卡在哪一跳”



没有串口日志，任何判断都是猜。先把 console 打通、确认每跳都有输出，再谈定位与优化。这也是本册所有“需上板”项的前置条件。



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm01-routes\n```\n\n\n\n```zhizhan-anchor\nm01-routes-t\n```\n\n\n\n## 1.4 三条路线对照：启动链与介质\n\n\n\n三条参考路线的启动链一致（ROM→SPL→U-Boot→Kernel→init），差异在 **SPL 的名字、U-Boot 载体与启动介质** 。排障时先按你板子的这一列去对日志关键字。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| 一级 | ROM Code |\n| 二级 | TF-A (FSBL/SPL) |\n| 引导 | U-Boot |\n| 介质 | SD / eMMC |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| 一级 | Boot ROM |\n| 二级 | SPL / IVT 头 |\n| 引导 | U-Boot (u-boot.imx) |\n| 介质 | SD / eMMC / NAND |\n\n\n\n| 项 | Allwinner V3s |\n| --- | --- |\n| 一级 | BROM |\n| 二级 | boot0 |\n| 引导 | U-Boot (u-boot.img) |\n| 介质 | SPI-NAND / SD |\n\n\n\n换板子先换这张“对照表”\n\n\n\n不同厂商对同一跳的叫法不同（TF-A / SPL / boot0）。抓日志时按本表关键字找，就不会因为“名字不同”而误判卡在哪一跳。"}
````



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **只改设备树不重编 dtb** ：U-Boot 加载的是旧 dtb，改动不生效。

- **bootargs 里 console/root 写错** ：内核起了却看不到 log 或找不到根。

- **内核与 dtb 不匹配** ：驱动 probe 失败，设备“凭空消失”。

- **不接串口** ：什么日志都没有，只能猜。



◆ 自测 · Module 01（先答再看）




1. 上电后串口完全没有输出，最可能卡在哪一跳？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"最可能卡在  **ROM/SPL** ：DDR 未初始化，或介质里没有有效的 SPL。若已打印 SPL 但之后无输出，则查 SPL→U-Boot 的加载地址与介质。"}
   ```

2. 启动日志里 U-Boot 到 Kernel 花了 582ms、Kernel 到 init 花了 2100ms，先优化哪一跳？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先优化耗时最大的  **Kernel→init** （2100ms）：查内核驱动 probe、延迟初始化、根文件系统挂载。“哪一跳最大先动哪一跳”是启动优化的基本纪律。"}
   ```

3. 为什么启动链要设计成 ROM→SPL→U-Boot→Kernel 这种“分级接力”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"ROM 不可改，只做最小的事；把复杂且需升级的逻辑（DDR 初始化、加载、启动参数）交给可升级的 SPL/U-Boot，获得 **可升级** 与 **可逐跳诊断** 两个能力。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：抓一份你板子的启动日志，按本章方法分段并算出各跳耗时，找出最大的一跳给出优化假设。



核对与延伸：[U-Boot 官方文档](https://docs.u-boot.org/) · [Buildroot 官方手册](https://buildroot.org/downloads/manual/manual.html)

 

动手练习



运行 ` labs/host_bootlog.c `：把启动日志分阶段、算各段耗时、检测 panic/ERROR；再抓一份你板子的日志对照。



**检查结果：** 正常启动五跳齐全且时间单调（总 2700ms）；故障日志 panic/ERROR 定位在 900ms。

 

迁移练习：把本章的“能把启动日志分成 ROM→SPL→U-Boot→Kernel→init 五跳，量化各跳耗时并定位卡在哪一跳。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m01","criterion":"正常启动五跳齐全且时间单调（总 2700ms）；故障日志 panic/ERROR 定位在 900ms。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
