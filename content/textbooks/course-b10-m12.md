# 电源管理与驱动生命周期

```zhizhan-anchor
m12
```



Runtime PM 用 **引用计数** 决定设备“该不该上电”：有人用就 active，引用归零才 suspend。它与驱动的 open/close、probe/remove 生命周期耦合，是实现低功耗而不错乱的关键。

 

> 前置：Module 05 probe 与 Module 06 资源/时钟。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 runtime PM 引用计数实现“有引用即 active、归零即 suspend”，并与 probe/remove 正确衔接。

 

本章速览




- runtime PM 用引用计数决定 active/suspended；get/put 必须配对。

- suspend/resume 要保存与恢复上下文，失败要上报。

- autosuspend 超时参数要按器件特性给。

 

```zhizhan-anchor
m12-pm
```



```zhizhan-anchor
m12-pm-t
```



## 12.1 Runtime PM：引用计数决定上电



设备不是在 probe 后就一直开着。 **Runtime PM**  用引用计数管理：` pm_runtime_get_sync ` 增计数并唤醒，` pm_runtime_put ` 减计数，归零后空闲计时到点就自动挂起。这样既低功耗，又在有人用时保证 active。



表 12.1 Runtime PM 常用 API



| API | 作用 | 注意 |
| --- | --- | --- |
| pm\_runtime\_enable | 使能 runtime PM | probe 里调用 |
| pm\_runtime\_get\_sync | 增引用并唤醒 | 可能睡眠，禁原子上下文 |
| pm\_runtime\_put | 减引用 | 归零后可能挂起 |
| pm\_runtime\_get\_if\_in\_use | 仅在用中时取引用 | 返回 0/−EAGAIN 判断 |
| pm\_runtime\_set\_active | 标记运行态 | 初始状态设置 |



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：引用计数驱动的状态迁移



下面这段程序把“get→active、put 未归零仍 active、归零→suspend”的真实状态迁移跑出来：



host\_pm.cC

 

```text
/* host_pm.c —— 运行时电源管理（runtime PM）状态机模型（主机可运行）。
 * 引用计数>0 → active；=0 且超时 → suspended；resume 再计数。驱动在 suspend/resume 回调里保存/恢复。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pm.c -o host_pm && ./host_pm
 */
#include <stdio.h>
typedef enum { SUSPENDED, ACTIVE } pm_state_t;
typedef struct { int usage; pm_state_t st; int suspends, resumes; } pm_t;
void pm_get(pm_t *p) { if (p->usage++ == 0) { p->st = ACTIVE; p->resumes++; } }
void pm_put(pm_t *p) { if (p->usage > 0) p->usage--; if (p->usage == 0) { p->st = SUSPENDED; p->suspends++; } }
int main(void) {
    int ok = 1; pm_t p = {0, SUSPENDED, 0, 0};
    pm_get(&p); pm_get(&p);
    printf("两次 get：usage=%d state=%s resumes=%d\n", p.usage, p.st == ACTIVE ? "ACTIVE" : "SUSPENDED", p.resumes);
    if (!(p.usage == 2 && p.st == ACTIVE && p.resumes == 1)) ok = 0;
    pm_put(&p);
    printf("一次 put：usage=%d state=%s（仍 ACTIVE）\n", p.usage, p.st == ACTIVE ? "ACTIVE" : "SUSPENDED");
    if (!(p.usage == 1 && p.st == ACTIVE)) ok = 0;
    pm_put(&p);
    printf("usage 归零：state=%s suspends=%d（期望 SUSPENDED，1）\n", p.st == ACTIVE ? "ACTIVE" : "SUSPENDED", p.suspends);
    if (!(p.usage == 0 && p.st == SUSPENDED && p.suspends == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

Runtime PM 引用计数模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_pm.c -o labs/host_pm && ./labs/host_pm
两次 get：usage=2 state=ACTIVE resumes=1
一次 put：usage=1 state=ACTIVE（仍 ACTIVE）
usage 归零：state=SUSPENDED suspends=1（期望 SUSPENDED，1）
RESULT: PASS
```



第一次 get 触发 resume（resumes=1）；只减到 1 仍 active；归零才 suspend（suspends=1）。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  引用计数与状态迁移



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="引用计数与状态迁移" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">suspend</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">get→active</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">put&gt;0 仍active</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">put=0→suspend</text></svg>
```



get\_sync：suspend→active（首次触发 resume）；put：active 且计数\>0 仍 active；put 到 0 → 空闲计时到点 → suspend。



```zhizhan-anchor
m12-detail
```



```zhizhan-anchor
m12-detail-t
```



## 12.3 与生命周期耦合：open/close、probe/remove



runtime PM 通常与 open/close 绑定：` open ` 里 get、` close ` 里 put。` probe ` 里 enable 并设初始 active；` remove ` 里 disable。系统级 ` suspend/resume ` 与 runtime PM 是两套机制，需分别实现。



表 12.2 PM 与生命周期的衔接



| 生命周期 | 要做的事 | 常见错误 |
| --- | --- | --- |
| probe | pm\_runtime\_enable \+ set\_active | 忘 enable 导致回调不触发 |
| open | pm\_runtime\_get\_sync | 不 get 就访问硬件 |
| close | pm\_runtime\_put | 不 put 设备永不挂起 |
| remove | pm\_runtime\_disable | 残留回调 |
| 系统 suspend | 实现 suspend/resume 回调 | 与 runtime 混淆 |



pm\_open.c 节选C

 

```text
static int my_open(struct inode *i, struct file *f) {
    int r = pm_runtime_get_sync(dev);   // 唤醒并增引用
    if (r < 0) { pm_runtime_put_noidle(dev); return r; }
    return 0;
}
static int my_release(struct inode *i, struct file *f) {
    pm_runtime_put(dev);                // 减引用，归零后自动挂起
    return 0;
}
```

open=get、close=put；get 失败要 put\_noidle 回滚



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm12-routes\n```\n\n\n\n```zhizhan-anchor\nm12-routes-t\n```\n\n\n\n## 12.4 三条内核路线对照：电源域\n\n\n\n三条路线的 PM 框架一致（runtime PM），差异在电源域/regulator 节点。\n\n\n\n表 12.3 三条路线的电源域\n\n\n\n| 内核路线 | PM 框架 | 电源域 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | runtime PM | regulator \\+ PWR | mainline |\n| i.MX6ULL | runtime PM | regulator (GPC) | BSP mainline |\n| V3s | runtime PM | regulator (AXP) | sunxi |"}
````



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.5 PM 自检



Runtime PM 的问题多表现为“功耗下不来”或“访问时设备已挂起”。自检看引用计数与状态：



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  PM 状态与引用计数



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="PM 状态与引用计数" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">usage_count &gt; 0 → ACTIVE</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">usage_count = 0 → 可挂起</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">SUSPENDED（省电）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">漏 get/put → 访问异常或功耗高</text></svg>
```



ACTIVE ⇄ SUSPENDED 由 usage\_count 驱动：\>0 active、=0 且空闲到点才 suspend。漏 put 会永久 active；漏 get 会在 suspend 时访问硬件。



表 12.4 PM 现象与原因



| 现象 | 原因 | 核查 |
| --- | --- | --- |
| 功耗下不来 | 漏 put，永久 active | 核对 open/close 配对 |
| 访问就崩 | 漏 get，设备 suspend | 访问前 get\_sync |
| 不自动挂起 | 未 enable 或未设 allow | probe 里 pm\_runtime\_enable |
| 计数不归零 | 错误路径漏 put | 每步失败都要回滚引用 |



pm\_check.sh 节选Shell

 

```text
cat /sys/kernel/debug/pm_genpd/*/        # 电源域状态
cat /sys/bus/platform/devices/*/power/runtime_status   # ACTIVE/SUSPENDED
cat /sys/bus/platform/devices/*/power/runtime_usage   # 引用计数
```

从 sysfs/debugfs 看 runtime PM 计数与状态



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.6 常见误区与排障



失败路径与排障




- **不 get 就访问硬件** ：设备处于 suspend，访问异常。

- **不 put** ：设备永不挂起，功耗下不来。

- **在原子上下文调 get\_sync** ：它可能睡眠，非法。

- **混淆 runtime PM 与系统 suspend** ：回调实现错位。



◆ 自测 · Module 12（先答再看）




1. Runtime PM 的引用计数归零后会发生什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"设备可被自动挂起（经历空闲计时后进入 suspend）。只要还有人持有引用，就保持 active。"}
   ```

2. 为什么 open 里通常要 pm\_runtime\_get\_sync？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"设备可能处于 suspend。get\\_sync 会唤醒它并增加引用，保证访问硬件时处于 active；close 时对应 put。"}
   ```

3. pm\_runtime\_get\_sync 为什么不能在原子上下文调用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它可能睡眠（等待设备唤醒/同步），原子上下文（如中断上半部）禁止睡眠。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你驱动接上 runtime PM：probe enable、open get、close put、remove disable，并测量空闲功耗变化。



核对与延伸：[Linux 内核文档 · Runtime PM](https://www.kernel.org/doc/html/latest/power/runtime_pm.html) · [Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html)

 

动手练习



运行 ` labs/host_pm.c `：验证两次 get→active、一次 put→仍 active、归零→suspend。



**检查结果：** 两次 get：usage=2、state=ACTIVE、resumes=1；一次 put：usage=1 仍 ACTIVE；归零：SUSPENDED、suspends=1。

 

迁移练习：把本章的“能用 runtime PM 引用计数实现“有引用即 active、归零即 suspend”，并与 probe/remove 正确衔接。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m12","criterion":"两次 get：usage=2、state=ACTIVE、resumes=1；一次 put：usage=1 仍 ACTIVE；归零：SUSPENDED、suspends=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
