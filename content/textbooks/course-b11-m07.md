# 性能与资源

```zhizhan-anchor
m07
```



性能工作先 **量化预算** 再优化：CPU 占用 = 执行时间/周期；内存要留峰值余量；并设 **上限阈值 \+ 降级** ，而不是等 OOM/超期。

 

> 前置：Module 05 的线程与 Module 06 的服务运行。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为 CPU 占用与内存峰值设预算阈值，并在超限时触发降级而非崩溃。

 

本章速览




- 先建资源预算再优化，并设上界与降级。

- 测峰值不只测平均。

- 查泄漏与碎片，长跑验证。

 

```zhizhan-anchor
m07-budget
```



```zhizhan-anchor
m07-budget-t
```



## 7.1 先建预算，再优化



性能不是“感觉慢就展开循环”。先量化预算： **CPU 占用 = 执行时间/周期** ，内存要留峰值余量，IO 看等待时间。并设明确上限（如 CPU≤30%、内存峰值≤80%）。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  性能工作的顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="性能工作的顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">设预算</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">测量</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">优化</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">回归</text></svg>
```



设预算 → 测量找瓶颈 → 优化 → 回归对比基线。跳过“设预算/测量”就是瞎优化。



表 7.1 性能维度与工具



| 维度 | 工具 | 指标 |
| --- | --- | --- |
| CPU | top/perf | 占用率、热点函数 |
| 内存 | valgrind/ASAN | 泄漏、峰值 |
| IO | iostat/strace | 等待时间 |
| 启动 | systemd-analyze | 各阶段耗时 |
| 回归 | 基准脚本 | 与基线对比 |



measure.sh 节选Shell

 

```text
perf top -p $(pidof app)         # 采样热点
valgrind --leak-check=full ./app # 内存泄漏
pidstat -p $(pidof app) 1        # CPU/内存随时间
```

先测量定位瓶颈，再谈优化



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：预算判定



下面这段主机程序按 CPU 预算与内存阈值判定“是否可接受”：



host\_perf.cC

 

```text
/* host_perf.c —— 性能与资源：CPU 预算与内存峰值估算模型（主机可运行）。
 * 实时线程占 CPU 比例 = 执行时间/周期；内存峰值要留余量。本程序按预算判断是否可接受。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_perf.c -o host_perf && ./host_perf
 */
#include <stdio.h>
static int cpu_ok(int exec_us, int period_us, int budget_permille) { return exec_us * 1000 <= period_us * budget_permille; }
static int mem_ok(int peak_kb, int limit_kb) { return peak_kb * 100 <= limit_kb * 80; }
int main(void) {
    int ok = 1;
    printf("实时线程 200us/1ms → CPU 占用 %d‰（预算 300‰）：%s\n", 200*1000/1000, cpu_ok(200,1000,300)?"OK":"超预算");
    if (!cpu_ok(200, 1000, 300)) ok = 0;
    printf("实时线程 800us/1ms → %s（应超预算）\n", cpu_ok(800,1000,300)?"OK":"超预算");
    if (cpu_ok(800, 1000, 300)) ok = 0;
    printf("内存峰值 6000KB/8192KB → %s\n", mem_ok(6000,8192)?"OK":"超预算");
    if (!mem_ok(6000,8192)) ok = 0;
    printf("内存峰值 7500KB/8192KB → %s（应超预算）\n", mem_ok(7500,8192)?"OK":"超预算");
    if (mem_ok(7500,8192)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

CPU/内存预算模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_perf.c -o labs/host_perf && ./labs/host_perf
实时线程 200us/1ms → CPU 占用 200‰（预算 300‰）：OK
实时线程 800us/1ms → 超预算（应超预算）
内存峰值 6000KB/8192KB → OK
内存峰值 7500KB/8192KB → 超预算（应超预算）

RESULT: PASS
```



200us/1ms=200‰ 在预算内、800us/1ms 超预算；内存峰值超 8192KB 同理。预算是可判定的阈值。



表 7.2 预算与降级动作



| 指标 | 预算 | 超限动作 |
| --- | --- | --- |
| CPU 占用 | ≤300‰ | 降采样/降频 |
| 内存峰值 | ≤80% | 拒绝新任务/回收 |
| IO 等待 | 设上限 | 限流/异步 |
| 启动时间 | 设目标 | 裁剪/并发 |



```zhizhan-anchor
m07-leak
```



```zhizhan-anchor
m07-leak-t
```



## 7.3 泄漏与降级



长跑应用必须查泄漏与碎片；输入/负载不可控，所以要有 **资源上界 \+ 降级策略** （降采样/拒绝新任务/丢弃非关键），而不是等到 OOM。



guard.c 节选C

 

```text
if (cpu_permille() > CPU_BUDGET || mem_peak() > MEM_LIMIT) {
    degrade();      // 降采样/拒绝新任务，保持可用
}
/* 长跑用 valgrind/ASAN 查泄漏；设回归基线对比 */
```

超限即降级而非崩溃：保持系统可用是第一优先



表 7.3 资源风险与缓解



| 风险 | 检测 | 缓解 |
| --- | --- | --- |
| 内存泄漏 | valgrind/ASAN | 修复 \+ 上限 |
| 碎片 | 长跑观察 | 固定块池 |
| 峰值超限 | 峰值监控 | 降级/回收 |
| 回归 | 基准脚本 | CI 对比基线 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检与三路线对照



性能自检：有预算、有测量、有回归、有降级。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  优化前后的占用对比（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="优化前后的占用对比（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">优化前</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-red-s"></rect><text x="638" y="43" class="sv-lbl-hi">80‰(×10)</text><text x="12" y="67" class="sv-lbl">优化后</text><rect x="150" y="50" width="210" height="18" rx="4" class="sv-grn-s"></rect><text x="368" y="67" class="sv-lbl-hi">35‰(×10)</text><text x="12" y="91" class="sv-lbl">预算线</text><rect x="150" y="74" width="180" height="18" rx="4" class="sv-amb-s"></rect><text x="338" y="91" class="sv-lbl-hi">30‰(×10)</text></svg>
```



优化应使占用明显下降并稳定在预算内；若无变化，说明没找到真瓶颈或瓶颈在别处。



表 7.4 三路线性能工具



| 路线 | 性能工具 | 说明 |
| --- | --- | --- |
| Buildroot | perf 可选 | 需内核支持 |
| Yocto | perf/valgrind 配方 | 可定制 |
| Debian | perf/valgrind/ASAN | 工具最全 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **无预算就优化** ：不知道目标，改来改去。

- **只测平均不测峰值** ：峰值触发 OOM。

- **不查泄漏** ：长跑后内存耗尽。

- **无降级策略** ：超载时直接崩。



◆ 自测 · Module 07（先答再看）




1. 为什么要设“资源上界 \+ 降级”而不是只优化？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"输入/负载不可控。设上界并在超限时降级（拒绝/降采样）能让系统在极端情况下保持可用，而不是崩溃；优化只是把上界抬高。"}
   ```

2. 为什么内存要看峰值而不是平均值？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"OOM 由峰值触发。平均值正常但峰值超限照样被杀，所以要看峰值并留余量。"}
   ```

3. 性能优化前必做的一步是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"测量定位瓶颈（profiling）并设预算基线。没有测量，优化方向很可能错。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你服务设一个 CPU/内存预算阈值与降级策略，并加一个性能回归基线脚本。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/)

 

动手练习



运行 ` labs/host_perf.c `：按 CPU 预算与内存阈值判断是否可接受。



**检查结果：** CPU 200‰≤300‰ 通过、800‰ 超预算；内存示例采用 80% 预警线：6000KB 通过，7500KB 超过预警线但未触及 8192KB 硬上限。

 

迁移练习：把本章的“能为 CPU 占用与内存峰值设预算阈值，并在超限时触发降级而非崩溃。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m07","criterion":"CPU 200‰≤300‰ 通过、800‰ 超预算；内存示例采用 80% 预警线：6000KB 通过，7500KB 超过预警线但未触及 8192KB 硬上限。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
