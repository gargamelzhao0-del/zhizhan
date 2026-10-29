# 系统层调试

```zhizhan-anchor
m07
```



系统层调试有固定顺序： **先看日志等级，再谈性能与调用，最后是崩溃现场** 。不要一上来就翻几千行日志。本章把 dmesg/ftrace/perf/strace/pstore 用成一套可执行的流程。

 

> 前置：会用 dmesg、ps 等基础命令查看内核日志与进程状态。 · ◷ 约 42 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按日志等级定位问题、用 ftrace/strace/perf 分析卡顿与调用，并用 pstore 保留崩溃现场。

 

本章速览




- dmesg 有等级，先看 ERR/WARN；ftrace/perf 抓延迟与热点。

- strace 定位卡在哪个系统调用；/proc 与 /sys 查运行期真实状态。

- 内核崩溃用 pstore/ramoops 保留现场，重启后还能看到上次日志。

 

```zhizhan-anchor
m07-order
```



```zhizhan-anchor
m07-order-t
```



## 7.1 调试有顺序：日志 → 性能 → 调用 → 崩溃



面对“系统不正常”，正确的顺序是： **先按等级筛内核日志** （设备 probe/挂载失败多在此），再谈性能（ftrace/perf），再跟系统调用（strace），最后是崩溃现场（pstore）。顺序错了，就是在噪声里找信号。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  系统层调试的决策顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="系统层调试的决策顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">dmesg 按等级</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">ftrace/perf</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">strace</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">pstore 现场</text></svg>
```



看日志（有没有明确错误）→ 有则定位；无则看性能（卡顿/占用）→ 再看 syscall（卡在哪个调用）→ 仍有偶发崩溃就用 pstore 保留现场。



表 7.1 工具与场景对应



| 工具 | 看什么 | 场景 |
| --- | --- | --- |
| dmesg | 内核日志（按等级筛） | 设备 probe/挂载失败 |
| ftrace | 函数/调度延迟 | 实时性与卡顿 |
| perf | 采样热点 | CPU 占用高 |
| strace | 系统调用与耗时 | 程序卡在哪个 syscall |
| pstore/ramoops | 上次崩溃日志 | 重启后定位 panic |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：日志等级统计与告警



日志不是“越全越好”。按等级统计并给出告警判定，才能一眼看出“严不严重”：



host\_debuglog.cC

 

```text
/* host_debuglog.c —— 日志等级统计与告警（dmesg 语义，主机可运行）。
 *
 * 内核日志有等级（emerg/err/warn/info…）。系统层调试第一步是“按等级筛”，
 * 再判断是否达到告警条件。本程序统计各级别出现次数并给出告警结论。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_debuglog.c -o host_debuglog && ./host_debuglog
 */
#include <stdio.h>
#include <string.h>

static const char *level_of(const char *s) {
    if (strstr(s, "emerg")) return "emerg";
    if (strstr(s, "err"))   return "err";
    if (strstr(s, "warn"))  return "warn";
    if (strstr(s, "info"))  return "info";
    return "debug";
}
static int rank(const char *lvl) {
    if (strcmp(lvl, "emerg") == 0) return 0;
    if (strcmp(lvl, "err") == 0) return 3;
    if (strcmp(lvl, "warn") == 0) return 4;
    if (strcmp(lvl, "info") == 0) return 6;
    return 7;
}

int main(void) {
    const char *log[] = {
        "kern.info: Linux version 6.1.0",
        "kern.info: mmc0: SDHCI controller on 2190000.mmc",
        "kern.warn: mmc0: card lacks reliable write",
        "kern.err: mmc0: error -110 during read",
        "kern.err: EXT4-fs (mmcblk0p5): error loading journal",
        "kern.emerg: Kernel panic - not syncing",
    };
    int n = (int)(sizeof(log) / sizeof(log[0]));
    int cnt[8] = {0}, worst = 7;
    for (int i = 0; i < n; i++) {
        const char *l = level_of(log[i]);
        cnt[rank(l)]++;
        if (rank(l) < worst) worst = rank(l);
    }
    printf("统计: info=%d warn=%d err=%d emerg=%d\n", cnt[6], cnt[4], cnt[3], cnt[0]);
    printf("最严重级别=%s\n", worst == 0 ? "emerg" : worst == 3 ? "err" : worst == 4 ? "warn" : "info");

    int ok = 1;
    if (!(cnt[6] == 2 && cnt[4] == 1 && cnt[3] == 2 && cnt[0] == 1)) ok = 0;
    int alert = (cnt[0] > 0) || (cnt[3] > 0);
    printf("是否告警=%s（emerg/err 存在即告警）\n", alert ? "是" : "否");
    if (!alert) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

日志分级统计与告警判定（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_debuglog.c -o labs/host_debuglog && ./labs/host_debuglog
统计: info=2 warn=1 err=2 emerg=1
最严重级别=emerg
是否告警=是（emerg/err 存在即告警）
RESULT: PASS
```



按等级计数后可快速判断严重程度；出现 emerg/err 即告警——不必逐行读完才判断。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  一段日志的等级分布（真实统计）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="一段日志的等级分布（真实统计）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">info</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-box"></rect><text x="458" y="43" class="sv-lbl-hi">2</text><text x="12" y="67" class="sv-lbl">warn</text><rect x="150" y="50" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="67" class="sv-lbl-hi">1</text><text x="12" y="91" class="sv-lbl">err</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-red-s"></rect><text x="458" y="91" class="sv-lbl-hi">2</text><text x="12" y="115" class="sv-lbl">emerg</text><rect x="150" y="98" width="150" height="18" rx="4" class="sv-red-s"></rect><text x="308" y="115" class="sv-lbl-hi">1</text></svg>
```



info=2、warn=1、err=2、emerg=1。看到 emerg/err 就应先告警并定位，而不是被大量 info 淹没。



表 7.2 日志等级与处理优先级



| 等级 | 含义 | 处理 |
| --- | --- | --- |
| emerg/alert/crit | 系统不可用 | 立即告警、优先处理 |
| err | 错误 | 定位并修复 |
| warn | 警告 | 关注趋势，不一定阻塞 |
| info/debug | 信息 | 排查时按需查看 |



```zhizhan-anchor
m07-tools
```



```zhizhan-anchor
m07-tools-t
```



## 7.3 ftrace / perf / strace：各管一段



三类问题的工具不同： **卡顿/延迟** 看 ftrace（函数与调度轨迹）； **CPU 占用高** 用 perf 采样热点； **程序卡住** 用 strace 跟系统调用。用错工具，等于白忙。



表 7.3 按现象选工具



| 现象 | 首选工具 | 典型输出 |
| --- | --- | --- |
| 启动慢/卡顿 | ftrace (function\_graph) | 函数耗时、调度延迟 |
| CPU 某进程高 | perf top / record | 热点函数占比 |
| 程序挂起不动 | strace -tt -T | 停在哪个 syscall 及耗时 |
| IO 等待 | ps (D 状态) \+ iostat | IO 阻塞 |
| 偶发 panic | pstore/ramoops | 上次崩溃日志 |



debug\_imx.shShell

 

```text
#!/bin/sh
# i.MX6ULL · 性能与调用分析
# 1) 采样热点
perf top -g

# 2) 跟踪系统调用（定位卡在哪个 syscall）
strace -f -tt -T /usr/bin/edge-app 2>&1 | tail -40

# 3) 内核崩溃现场：pstore/ramoops 里的上一次日志
cat /sys/fs/pstore/console-ramoops 2>/dev/null || echo "no ramoops"
```

i.MX6ULL 调试脚本（labs/ 逐字一致）



```zhizhan-anchor
m07-pstore
```



```zhizhan-anchor
m07-pstore-t
```



## 7.4 pstore/ramoops：让崩溃“有遗言”



内核 panic 后默认重启，日志就没了。` pstore/ramoops ` 把上次日志写进内存保留区，重启后仍可读——这是定位“偶发 panic”的关键。



ramoops.txt 节选Text

 

```text
# 内核 cmdline 预留一段内存给 ramoops
ramoops.mem_address=0x8ff00000 ramoops.mem_size=0x100000 ramoops.record_size=0x40000
# 挂载 pstore，读上次崩溃日志
mount -t pstore pstore /sys/fs/pstore
cat /sys/fs/pstore/console-ramoops-0     # 上一次的 dmesg
```

内存保留区把崩溃日志带到下次启动，偶发问题也能复盘



调试也要“可复现”



把用到的 ftrace 选项、strace 过滤、ramoops 配置写成脚本（如 ` debug_*.sh `），下次一键复跑。调试配置本身也应版本化。



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm07-routes\n```\n\n\n\n```zhizhan-anchor\nm07-routes-t\n```\n\n\n\n## 7.5 三条路线对照：调试入口\n\n\n\n三条路线的串口设备名与调试脚本不同，但工具与顺序一致。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| console | ttySTM0 |\n| 脚本 | debug\\_mp1.sh |\n| pstore | ramoops 可用 |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| console | ttymxc0 |\n| 脚本 | debug\\_imx.sh |\n| pstore | ramoops 可用 |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| console | ttyS0 |\n| 脚本 | debug\\_v3s.sh |\n| pstore | ramoops 可用 |"}
````



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.6 常见误区与排障



失败路径与排障




- **只看尾部日志** ：真正的第一条错误往往在前面，被淹没。

- **把 warn 当 err** ：误判严重程度，浪费排查方向。

- **没有崩溃保留机制** ：偶发 panic 复现困难。

- **perf/strace 环境与现场不同** ：结论不可迁移。



◆ 自测 · Module 07（先答再看）




1. 应用“卡住不动”，dmesg 看不到问题，下一步做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用 ` strace -tt -T ` 跟它停在哪个系统调用，或用 ` ps ` 看进程状态（D 状态多为 IO 等待）。"}
   ```

2. 为什么不能“只看 dmesg 最后几行”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"真正的第一条错误往往在前面，被后续大量日志淹没。应按等级筛、从最早的 err/emerg 看起。"}
   ```

3. pstore/ramoops 解决什么问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"默认 panic 后重启日志即丢；ramoops 把上次日志写进内存保留区，重启后仍能读，让“偶发 panic”可复盘。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你板子准备一份调试脚本（console \+ 日志等级筛 \+ pstore 读取），并版本化。



核对与延伸：[Linux 内核 · pstore/ramoops](https://www.kernel.org/doc/html/latest/admin-guide/ramoops.html)

 

动手练习



运行 ` labs/host_debuglog.c `：按等级统计日志并给出告警判定。



**检查结果：** 各级别计数 info=2/warn=1/err=2/emerg=1；最严重=emerg；出现 emerg/err 即告警=是。

 

迁移练习：把本章的“能按日志等级定位问题、用 ftrace/strace/perf 分析卡顿与调用，并用 pstore 保留崩溃现场。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m07","criterion":"各级别计数 info=2/warn=1/err=2/emerg=1；最严重=emerg；出现 emerg/err 即告警=是。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
