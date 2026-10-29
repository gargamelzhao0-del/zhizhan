# Linux 使用与系统机制桥接

```zhizhan-anchor
m08
```



把系统“用起来”绕不开五件事： **权限、进程、挂载、设备节点、网络与服务** 。这些既是日常操作，也是排障入口。本章从“最小权限”讲到“启动脚本的分词陷阱”，把用户态基础打牢。

 

> 前置：会用 ls/chmod/ps/mount/ip，并了解用户、权限与进程概念。 · ◷ 约 44 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按最小权限运行应用、托管服务、使用只读根\+overlay，并正确处理设备节点、网络与启动脚本。

 

本章速览




- 权限、进程、挂载、设备节点、网络与服务，是把系统“用起来”的五件事。

- 原则：最小权限、非 root 跑应用、设备节点属主正确。

- 服务托管（systemd/SysV）要配重启限速，避免重启风暴。

 

```zhizhan-anchor
m08-perm
```



```zhizhan-anchor
m08-perm-t
```



## 8.1 权限最小化：别用 root 跑应用



嵌入式设备一旦被攻破，root 应用等于把整机交出去。原则是： **应用非 root、按需最小权限** ；需要访问的设备用 udev 规则赋权或 Linux capability，而不是整机 root。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  从“整机 root”到“最小权限”



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="从“整机 root”到“最小权限”" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">整机 root（危险）</text><rect x="60" y="64" width="680" height="40" rx="6" class="sv-cyn-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">普通用户 + 设备赋权</text><rect x="60" y="108" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="132.0" class="sv-lbl-hi">能力位/能力最小集</text><rect x="60" y="152" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="171.0" class="sv-lbl-hi">只读系统盘（更小爆炸半径）</text></svg>
```



把权限收敛到应用真正需要的那一点：普通用户运行 \+ 设备节点按 udev 赋权 \+ 能力位而非 root \+ 只读系统盘。



表 8.1 用户态五件事



| 主题 | 关键点 | 常用命令/机制 |
| --- | --- | --- |
| 权限 | 最小权限、非 root 跑应用 | chown/chmod、udev 规则、capability |
| 进程 | 状态、资源、重启策略 | ps/top/kill、重启限速 |
| 挂载 | 只读根 \+ overlay、fstab | mount -o remount,ro |
| 设备节点 | 属主/权限、udev | ls -l /dev/spidev\* |
| 网络/服务 | ip、DNS、服务托管 | ip/systemctl |



udev\_spi.rules 节选Text

 

```text
# 让普通用户组可访问 SPI 设备，而不是给应用 root
SUBSYSTEM=="spidev", GROUP="spiusers", MODE="0660"
# 需要更高权限时用能力位，例如允许绑定低端口：
# setcap cap_net_bind_service=+ep /usr/bin/myapp
```

用 udev 赋权/能力位替代整机 root



```zhizhan-anchor
m08-proc
```



```zhizhan-anchor
m08-proc-t
```



## 8.2 进程与服务：托管与重启限速



应用不该自己 “while(1) 重启”。交给 init/systemd 托管：崩溃自动拉起、按依赖排序、并设置 **重启限速** 避免崩溃风暴耗尽资源。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  服务托管：启动、依赖与重启限速



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="服务托管：启动、依赖与重启限速" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">按依赖启动</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">服务运行</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">崩溃重启</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">限速保护</text></svg>
```



init 按依赖启动服务 → 服务崩溃 → 托管方按策略重启 → 达到限速阈值则停止尝试并报错。既自愈，又不失控。



表 8.2 进程/服务托管方式



| 手段 | 作用 | 注意 |
| --- | --- | --- |
| systemd service | 托管、依赖、重启 | Restart= 与限速成对使用 |
| SysV 脚本 | 简单启动脚本 | 依赖靠命名约定 |
| busybox init | 极简 inittab | 适合最小系统 |
| 重启限速 | 防重启风暴 | StartLimitIntervalSec/Burst |



myapp.service 节选systemd

 

```text
[Unit]
Description=my app
After=network-online.target

[Service]
ExecStart=/usr/bin/myapp
Restart=on-failure
RestartSec=2
StartLimitIntervalSec=30
StartLimitBurst=5      # 30s 内最多重启 5 次，防风暴

[Install]
WantedBy=multi-user.target
```

托管 \+ 重启限速：既自愈又不失控



```zhizhan-anchor
m08-shell
```



```zhizhan-anchor
m08-shell-t
```



## 8.3 启动脚本的分词陷阱（真实证据）



一个被低估的细节是  **Shell 分词** ：引号内空格不分割、反斜杠转义、管道是独立 token。启动脚本里写错一个引号，就可能让服务“无声地起不来”。下面把分词规则真实跑出来：



host\_shellparse.cC

 

```text
/* host_shellparse.c —— 命令行分词（Shell 语义模型，主机可运行）。
 *
 * Shell 分词的规则并不简单：引号内空格不分割、反斜杠转义、管道是独立 token。
 * 本程序实现一个最小分词器，验证引号/转义/管道的处理。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_shellparse.c -o host_shellparse && ./host_shellparse
 */
#include <stdio.h>
#include <string.h>

#define MAXTOK 16

/* 返回 token 数；token 指向内部静态缓冲 */
static int tokenize(const char *s, char tok[][64]) {
    int n = 0, i = 0, ti = 0, in_s = 0, in_d = 0, esc = 0;
    for (; s[i]; i++) {
        char c = s[i];
        if (esc) { tok[n][ti++] = c; esc = 0; continue; }
        if (c == '\\' && !in_s) { esc = 1; continue; }        /* 反斜杠转义（单引号内不转义） */
        if (c == '\'' && !in_d) { in_s = !in_s; continue; }
        if (c == '"' && !in_s) { in_d = !in_d; continue; }
        if (!in_s && !in_d && (c == ' ' || c == '\t')) {
            if (ti) { tok[n][ti] = 0; n++; ti = 0; }
            continue;
        }
        if (!in_s && !in_d && c == '|') {                     /* 管道是独立 token */
            if (ti) { tok[n][ti] = 0; n++; ti = 0; }
            tok[n][0] = '|'; tok[n][1] = 0; n++;
            continue;
        }
        tok[n][ti++] = c;
    }
    if (ti) { tok[n][ti] = 0; n++; }
    return n;
}

int main(void) {
    char tok[MAXTOK][64];
    const char *cmd = "echo \"a b\" c\\ d | grep x";
    int n = tokenize(cmd, tok), ok = 1;
    printf("命令: %s\n分词(%d):", cmd, n);
    for (int i = 0; i < n; i++) printf(" [%s]", tok[i]);
    printf("\n");
    if (n != 6) ok = 0;
    const char *want[6] = {"echo", "a b", "c d", "|", "grep", "x"};
    for (int i = 0; i < 6 && i < n; i++) if (strcmp(tok[i], want[i]) != 0) ok = 0;

    char tok2[MAXTOK][64];
    int n2 = tokenize("cat '/etc/passwd'", tok2);
    printf("分词2(%d): [%s] [%s]（单引号内不转义）\n", n2, tok2[0], n2 > 1 ? tok2[1] : "");
    if (!(n2 == 2 && strcmp(tok2[1], "/etc/passwd") == 0)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

Shell 分词规则模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_shellparse.c -o labs/host_shellparse && ./labs/host_shellparse
命令: echo "a b" c\ d | grep x
分词(6): [echo] [a b] [c d] [|] [grep] [x]
分词2(2): [cat] [/etc/passwd]（单引号内不转义）
RESULT: PASS
```



双引号内空格保留为一个 token、反斜杠转义空格、管道是独立 token。脚本写错引号 → 参数个数不对 → 服务异常。



表 8.3 常见分词规则



| 写法 | 分词结果 | 说明 |
| --- | --- | --- |
| "a b" | 一个 token "a b" | 双引号保留空格 |
| 'a b' | 一个 token "a b" | 单引号不转义 |
| c\\ d | 一个 token "c d" | 反斜杠转义 |
| a b | 两个 token | 空格分隔 |
| x \| y | 三个 token | 管道是独立 token |



init\_mp1.shShell

 

```text
#!/bin/sh
# STM32MP1 · Buildroot /etc/init.d/rcS：最小挂载 + 交给 init
# 只读根 + overlay 时，先挂 tmpfs 覆盖可写目录
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev 2>/dev/null
mkdir -p /run /tmp /overlay
mount -t tmpfs none /run
mount -t tmpfs none /tmp
exec /sbin/init
```

STM32MP1 init 脚本（labs/ 逐字一致）



```zhizhan-anchor
m08-run
```



```zhizhan-anchor
m08-run-t
```



## 8.4 挂载与设备节点：只读根怎么落地



“只读根 \+ overlay”要落到 fstab 与启动脚本：根只读挂载、写入落 overlay、设备节点由 devtmpfs/udev 提供。运行时临时需要写系统盘，用 ` mount -o remount,rw / ` 但要清楚它在破坏可恢复性。



表 8.4 挂载与设备操作



| 操作 | 命令 | 风险/说明 |
| --- | --- | --- |
| 只读挂载根 | mount -o remount,ro / | 恢复可恢复性 |
| 临时可写 | mount -o remount,rw / | 破坏可恢复性，慎用 |
| 查看设备 | ls -l /dev/spidev\* | 看属主/权限 |
| 挂载 overlay | mount -t overlay ... | 需 lower/upper/work |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-routes\n```\n\n\n\n```zhizhan-anchor\nm08-routes-t\n```\n\n\n\n## 8.5 三条路线对照：用户态差异\n\n\n\n三条路线的 init 与设备命名不同，但用户态原则（最小权限、服务托管、只读根）一致。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| init | systemd |\n| 设备 | /dev/spidev0.0 |\n| 服务 | systemd unit |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| init | systemd |\n| 设备 | /dev/spidev\\* |\n| 服务 | systemd unit |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| init | busybox/SysV |\n| 设备 | /dev/spidev\\* |\n| 服务 | SysV 脚本 |"}
````



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.6 常见误区与排障



失败路径与排障




- **用 root 跑应用** ：一个漏洞就是整机沦陷。

- **设备节点属主错** ：普通用户打不开 /dev/spidev\*。

- **脚本引号/转义写错** ：启动脚本无声失败，服务起不来。

- **服务无重启限速** ：崩溃后重启风暴，耗尽资源。



◆ 自测 · Module 08（先答再看）




1. 为什么嵌入式设备通常不让应用以 root 运行？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"最小权限原则。应用被攻破时非 root 能限制破坏范围；需要访问的设备用 udev 规则赋权或 capability，而不是整机 root。"}
   ```

2. 启动脚本里 \`echo "a b"\` 与 \`echo a b\` 有什么区别？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"前者是一个参数 “a b”，后者是两个参数 “a”“b”。分词规则不同会导致参数个数与内容不同，脚本逻辑随之出错。"}
   ```

3. 服务托管时为什么必须配重启限速？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则崩溃的服务会被无限重启，形成“重启风暴”，耗尽 CPU/IO。限速（如 30s 内最多 5 次）既保留自愈，又避免失控。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把项目里以 root 运行的应用改为最小权限（非 root \+ udev 赋权/能力位），并给服务加重启限速。



核对与延伸：[systemd 官方文档](https://www.freedesktop.org/software/systemd/man/)

 

动手练习



运行 ` labs/host_shellparse.c ` 验证引号/转义/管道分词；并对全部 ` labs/*.sh ` 做 ` bash -n `。



**检查结果：** 引号内空格不分割、反斜杠转义生效、管道为独立 token（示例分词=6、单引号样例=2）；所有 Shell 片段过 bash -n。

 

迁移练习：把本章的“能按最小权限运行应用、托管服务、使用只读根\+overlay，并正确处理设备节点、网络与启动脚本。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m08","criterion":"引号内空格不分割、反斜杠转义生效、管道为独立 token（示例分词=6、单引号样例=2）；所有 Shell 片段过 bash -n。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
