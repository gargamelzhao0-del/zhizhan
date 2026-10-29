# 根文件系统

```zhizhan-anchor
m05
```



内核挂上根之后，把控制权交给 ` init `，从此进入用户态世界。最小根文件系统 =  **busybox \+ init \+ fstab \+ 设备节点 \+ 库** ；任一缺失，就停在 “No init found” 或“找不到库”。本章还把“服务按依赖顺序启动”与“只读根 \+ overlayfs”讲清。

 

> 前置：了解 Linux 根目录结构、动态库依赖与 init 进程。 · ◷ 约 44 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能组织最小根文件系统、按依赖顺序拉起服务，并用只读根\+overlay 实现可恢复、易升级。

 

本章速览




- 最小根文件系统 = busybox \+ init \+ fstab \+ 设备节点 \+ 库依赖。

- init 系统：SysV 简单，systemd 功能全但重；嵌入式常二选一。

- 只读根 \+ overlayfs：系统可恢复，写入落在可写层，升级更简单。

 

```zhizhan-anchor
m05-min
```



```zhizhan-anchor
m05-min-t
```



## 5.1 最小根文件系统：内核之后的世界



内核把根挂上后，会执行 ` /sbin/init `（或 bootargs 里的 ` init= `）。要让系统“活过来”，根里必须有五件东西： **busybox（提供 sh/ls/mount 等）、init、fstab、必要的设备节点、动态库** 。少任何一件，都会表现为“起不来”。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  最小根文件系统的目录骨架



```zhizhan-figure
<svg viewBox="0 0 800 190" width="100%" height="190" role="img" aria-label="最小根文件系统的目录骨架" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="47" rx="6" class="sv-grn-s"></rect><text x="75" y="57.3" class="sv-lbl-hi">/bin /sbin（busybox + applet 链接）</text><rect x="60" y="81" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="99.7" class="sv-lbl-hi">/etc（fstab、init 脚本）</text><rect x="60" y="115" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="133.7" class="sv-lbl-hi">/lib（动态库 .so）</text><rect x="60" y="149" width="680" height="47" rx="6" class="sv-box"></rect><text x="75" y="176.0" class="sv-lbl-hi">/proc /sys /dev（内核接口）</text></svg>
```



必需目录：/bin /sbin（busybox 与 applet 链接）、/etc（fstab/init 脚本）、/lib（.so）、/proc /sys /dev（内核与设备接口）。任一缺失，很多服务启动即失败。



表 5.1 最小集合五要素



| 要素 | 作用 | 常见问题 |
| --- | --- | --- |
| busybox | 提供 sh/ls/mount 等 applet | applet 链接缺失 |
| init | 用户态第一个进程 | 路径不对 / 缺依赖 |
| fstab | 开机挂载约定 | 与 root= 不一致 |
| 库 | 动态链接所需 .so | sysroot 库未拷入 |
| 设备节点 | 访问内核设备 | 属主/权限错（见 M08） |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：最小集合自检



把“必需目录/文件/链接”做成一份检查清单，就能在打包阶段抓出残缺 rootfs：



host\_rootfs.cC

 

```text
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
```

根文件系统最小集合自检（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_rootfs.c -o labs/host_rootfs && ./labs/host_rootfs
完整 rootfs 自检：
  错误数=0（期望 0）
残缺 rootfs 自检：
  缺目录: /proc
  缺文件: /etc/fstab
  /bin/sh 指向 busybox，但 busybox 不存在
  错误数=3（期望 ≥3）
RESULT: PASS
```



完整布局 0 错误；残缺布局精确报出“缺 /proc、缺 /etc/fstab、/bin/sh 悬空”三类问题——这正是 rootfs 自检该抓的。



```zhizhan-anchor
m05-init
```



```zhizhan-anchor
m05-init-t
```



## 5.3 init 与服务：按依赖顺序拉起



init 起来后要按 **依赖顺序** 启动服务：网络先于依赖它的服务；被依赖的服务失败时，下游不应“假装启动”。这是一个拓扑排序问题，“有环”本身就是配置错误。



host\_initdeps.cC

 

```text
/* host_initdeps.c —— init 服务依赖排序与故障传播（主机可运行）。
 *
 * SysV/systemd 都要按依赖启动服务。本程序做拓扑排序，验证顺序满足依赖；
 * 再让一个被依赖的服务失败，验证其下游不会被“假装启动”。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_initdeps.c -o host_initdeps && ./host_initdeps
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *name; const char *deps[2]; int fail; } svc_t;

static int idx_of(svc_t *s, int n, const char *name) {
    for (int i = 0; i < n; i++) if (strcmp(s[i].name, name) == 0) return i;
    return -1;
}
/* 返回 1=排序成功，0=存在环 */
static int topo(svc_t *s, int n, int *order) {
    int indeg[8] = {0}, done[8] = {0}, oc = 0;
    for (int i = 0; i < n; i++) for (int d = 0; d < 2 && s[i].deps[d]; d++) indeg[i]++;
    for (int step = 0; step < n; step++) {
        int pick = -1;
        for (int i = 0; i < n; i++) if (!done[i] && indeg[i] == 0) { pick = i; break; }
        if (pick < 0) return 0;                    /* 有环 */
        done[pick] = 1; order[oc++] = pick;
        for (int i = 0; i < n; i++)
            for (int d = 0; d < 2 && s[i].deps[d]; d++)
                if (strcmp(s[i].deps[d], s[pick].name) == 0) indeg[i]--;
    }
    return 1;
}

int main(void) {
    svc_t S[5] = {
        {"sysinit", {0, 0}, 0},
        {"network", {"sysinit", 0}, 0},
        {"sshd",    {"network", 0}, 0},
        {"mqtt",    {"network", 0}, 0},
        {"ui",      {"sysinit", 0}, 0},
    };
    int n = 5, order[8], ok = 1;

    if (!topo(S, n, order)) ok = 0;
    printf("启动顺序:");
    for (int i = 0; i < n; i++) printf(" %s", S[order[i]].name);
    printf("\n");
    /* 校验：每个服务的依赖都在它之前 */
    int pos[8]; for (int i = 0; i < n; i++) pos[order[i]] = i;
    for (int i = 0; i < n; i++)
        for (int d = 0; d < 2 && S[i].deps[d]; d++) {
            int j = idx_of(S, n, S[i].deps[d]);
            if (!(pos[j] < pos[i])) ok = 0;
        }

    /* 故障传播：network 失败 → sshd/mqtt 不应启动 */
    S[idx_of(S, n, "network")].fail = 1;
    int started[8] = {0};
    for (int k = 0; k < n; k++) {
        int i = order[k], good = !S[i].fail;
        for (int d = 0; d < 2 && S[i].deps[d]; d++) {
            int j = idx_of(S, n, S[i].deps[d]);
            if (!started[j]) good = 0;
        }
        started[i] = good;
    }
    printf("network 失败后已启动:");
    for (int i = 0; i < n; i++) if (started[i]) printf(" %s", S[i].name);
    printf("\n");
    if (started[idx_of(S, n, "network")]) ok = 0;
    if (started[idx_of(S, n, "sshd")] || started[idx_of(S, n, "mqtt")]) ok = 0;
    if (!started[idx_of(S, n, "sysinit")] || !started[idx_of(S, n, "ui")]) ok = 0;

    /* 环检测 */
    svc_t C[2] = { {"a", {"b", 0}, 0}, {"b", {"a", 0}, 0} };
    int ord2[4];
    printf("环依赖 topo 返回=%d（期望 0）\n", topo(C, 2, ord2));
    if (topo(C, 2, ord2) != 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

服务启动依赖排序（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_initdeps.c -o labs/host_initdeps && ./labs/host_initdeps
启动顺序: sysinit network sshd mqtt ui
network 失败后已启动: sysinit ui
环依赖 topo 返回=0（期望 0）
RESULT: PASS
```



正常时按依赖拓扑排序启动；network 失败后只启动不依赖它的组；检测到环依赖时拓扑排序返回 0（报错）。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  init 拉起服务的依赖顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="init 拉起服务的依赖顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">sysinit</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">network</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">sshd / mqtt</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">ui</text></svg>
```



sysinit（建立 /proc /sys）→ network → 依赖网络的服务（sshd/mqtt/ui）。下游依赖未就绪就不该启动；依赖成环则配置有误。



表 5.2 三种 init 的取舍



| init 系统 | 特点 | 适合 |
| --- | --- | --- |
| SysV init | 脚本简单、依赖靠命名约定 | 小系统、启动脚本少 |
| systemd | 依赖管理、服务托管、重启限速 | 功能多、要长期维护 |
| busybox init | 极简、inittab | 最小恢复/引导系统 |



```zhizhan-anchor
m05-ro
```



```zhizhan-anchor
m05-ro-t
```



## 5.4 只读根 \+ overlayfs：可恢复、易升级



让系统盘 **只读** 、把写入落到可写 overlay 层：重启即恢复到出厂状态，升级只需替换只读镜像。这是嵌入式“升级不变砖”的基础，与 M10 的 A/B 升级配套。



表 5.3 根文件系统写策略



| 方案 | 写入落点 | 优点 | 注意 |
| --- | --- | --- | --- |
| 只读根 \+ overlay | 可写层（tmpfs/分区） | 可恢复、易升级 | 可写层持久化策略 |
| 可写根 | 根分区 | 简单 | Flash 磨损、易被改坏 |
| tmpfs 根（initramfs） | 内存 | 快、无需块设备 | 掉电全丢，适合恢复 |



fstab.txt 节选fstab

 

```text
# 只读根 + 可写 overlay 的典型挂载思路
/dev/root  /      ext4    ro            0 1
overlay    /data  overlay lowerdir=/,upperdir=/data/up,workdir=/data/work 0 0
proc       /proc  proc    defaults      0 0
devtmpfs   /dev   devtmpfs mode=0755    0 0
```

根只读、写入落 overlay；/proc /dev 由内核/设备提供



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm05-routes\n```\n\n\n\n```zhizhan-anchor\nm05-routes-t\n```\n\n\n\n## 5.5 三条路线对照：rootfs 与 init\n\n\n\n三条路线的 rootfs 组织与 init 选择不同，但“最小集合 \\+ 依赖顺序”的要求一致。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| 构建 | Yocto |\n| init | systemd |\n| rootfs | 只读 \\+ overlay |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| 构建 | Yocto |\n| init | systemd |\n| rootfs | ext4 rw/ro |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| 构建 | Buildroot |\n| init | busybox/SysV |\n| rootfs | 只读 \\+ overlay |"}
````



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.6 常见误区与排障



失败路径与排障




- **缺 /proc /sys /dev** ：很多服务启动即失败。

- **busybox applet 链接缺失** ：/bin/sh 打不开，init 直接失败。

- **动态库没进 rootfs** ：程序报 “not found” 却不是缺可执行文件。

- **可写根 \+ 频繁写** ：Flash 寿命骤降；应只读根 \+ overlay。



◆ 自测 · Module 05（先答再看）




1. “Kernel panic: No init found” 常见原因有哪些？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"init 路径与 bootargs 的 ` init= ` 不一致、init 缺可执行权限、init 依赖的库缺失，或根根本没挂上（root= 错）。逐项排查即可。"}
   ```

2. 为什么“服务启动顺序”要用依赖排序，而不能只按文件名排序？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"下游服务依赖上游（如依赖网络）。只按名称排序会让下游在依赖未就绪时启动而失败；依赖成环则是配置错误，拓扑排序能直接报出。"}
   ```

3. 只读根 \+ overlay 相比可写根，核心好处是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"重启即恢复（写入落可写层）、升级只需换只读镜像、减少 Flash 磨损。代价是需要设计可写层的持久化策略。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目 rootfs 的必需目录/文件/库列成一份自检清单，脚本化跑一遍，确保打包前 0 错误。



核对与延伸：[BusyBox 官方站点](https://busybox.net/) · [systemd 官方文档](https://www.freedesktop.org/software/systemd/man/)

 

动手练习



运行 ` labs/host_rootfs.c ` 校验最小集合，` labs/host_initdeps.c ` 验证启动依赖顺序。



**检查结果：** 完整布局错误数=0；残缺布局报出缺目录/缺文件与 /bin/sh 指向不存在的 busybox；启动顺序 sysinit network sshd mqtt ui。

 

迁移练习：把本章的“能组织最小根文件系统、按依赖顺序拉起服务，并用只读根\+overlay 实现可恢复、易升级。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m05","criterion":"完整布局错误数=0；残缺布局报出缺目录/缺文件与 /bin/sh 指向不存在的 busybox；启动顺序 sysinit network sshd mqtt ui。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
