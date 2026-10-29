# 性能预算与测量

```zhizhan-anchor
m09
```



优化最容易错的第一步是“不测就改”。本章给出一套可算、可测的预算方法： **时间 = 指令数 × CPI ÷ 频率** ，先测量找热点，再用 Amdahl 定律判断优化的上限，最后看实时系统要的 WCET。

 

> 前置：了解指令/时钟周期与基本 profiling 概念。 · ◷ 约 42 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按预算公式估算时间，用 profiling 定位热点，并用 Amdahl 定律判断“值不值得优化”。

 

本章速览




- 时间=指令数×CPI/频率；先测再优化。

- 实时看 WCET 不看平均。

- Amdahl 定律：只优化一部分，整体提升有上限。

 

```zhizhan-anchor
m09-budget
```



```zhizhan-anchor
m09-budget-t
```



## 9.1 先建预算：时间 = 指令数 × CPI ÷ 频率



性能不是玄学。三个因子即可估算： **指令数** （算法与编译优化决定）、 **CPI** （每条指令平均周期，受访存/cache 影响）、 **频率** （时钟）。改动任一项都能算出差多少——这就是“预算”的意义：先算，再看要不要测。



表 9.1 性能的三个因子



| 因子 | 由什么决定 | 怎么改小 |
| --- | --- | --- |
| 指令数 | 算法复杂度、编译优化 | 换算法、-O2/-Os、去冗余 |
| CPI | 访存、cache、流水线 | 提升局部性、减少分支 |
| 频率 | 芯片与功耗预算 | 换器件 / 提频（功耗代价） |
| 并发 | 多核/多发射 | 并行化、向量化 |



host\_perf.cC

 

```text
/* host_perf.c —— 性能预算：CPI/周期与吞吐估算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_perf.c -o host_perf && ./host_perf
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 指令数 × CPI / 频率 = 时间 */
    long instr = 1000000;      /* 1M 指令 */
    float cpi = 1.5f, freq_mhz = 72.0f;
    float time_ms = (float)instr * cpi / (freq_mhz * 1e6f) * 1000.0f;
    printf("1M 指令 @72MHz CPI=1.5 → %.2fms\n", time_ms);
    if (time_ms < 20.0f || time_ms > 21.0f) ok = 0;
    /* 内存墙：访存慢会显著拉高 CPI */
    printf("note: cache miss 会抬升有效 CPI，预算要含访存\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

周期预算模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_perf.c -o labs/host_perf && ./labs/host_perf
1M 指令 @72MHz CPI=1.5 → 20.83ms
note: cache miss 会抬升有效 CPI，预算要含访存
RESULT: PASS
```



1e6 × 1.5 ÷ 72e6 = 20.83ms。若 miss 把有效 CPI 抬到 3，同样代码要 41.7ms——量级差异。



```zhizhan-anchor
m09-measure
```



```zhizhan-anchor
m09-measure-t
```



## 9.2 再测量：profiling 找热点



预算告诉你“大概多少”，profiling 告诉你“花在哪”。两种手段： **采样** （周期性看 PC，开销小、统计意义）与 **插桩** （在函数进出打点，精确但扰动大）。先采样定位热点，再对热点插桩细看。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  性能优化的正确顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="性能优化的正确顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">测量</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">定位热点</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">判瓶颈</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">优化</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">回归</text></svg>
```



先测量定位热点 → 判断瓶颈类型（算力/带宽/延迟）→ 针对性优化 → 回归对比。跳过第一步就会“优化了不重要的地方”。



表 9.2 测量手段与取舍



| 手段 | 优点 | 缺点 | 适用 |
| --- | --- | --- | --- |
| 采样 profiler | 开销小、全局 | 热点统计、有偏差 | 首次定位 |
| 插桩计时 | 精确到函数 | 扰动大、可能改行为 | 热点细分 |
| DWT/PMU 计数器 | 硬件级、周期精确 | 依赖平台 | 微架构分析 |
| GPIO 翻转 \+ 示波器 | 真实时序、含中断 | 需硬件 | 实时/抖动 |



profile.c 节选C

 

```text
// 极简插桩：记录进入/退出，统计每段耗时（生产用 DWT->CYCCNT）
uint32_t t0 = DWT->CYCCNT;
hot_loop();
uint32_t dt = DWT->CYCCNT - t0;      // 精确到 CPU 周期
printf("hot_loop: %u cycles (%u us @72MHz)\n", dt, dt / 72);
```

先采样找热点，再对热点用硬件计数器精确计时



```zhizhan-anchor
m09-amdahl
```



```zhizhan-anchor
m09-amdahl-t
```



## 9.3 Amdahl 定律：优化的上限在哪



只优化系统的一部分，整体提速有上限：若某部分占比 p、提速 s，则整体加速 ` 1 / ((1-p) + p/s) `。这解释了“局部优化怎么努力都提升有限”。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  Amdahl 定律：某部分占比越高，整体收益越大



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="Amdahl 定律：某部分占比越高，整体收益越大" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">占比 10% × 10</text><rect x="150" y="26" width="110" height="18" rx="4" class="sv-box"></rect><text x="268" y="43" class="sv-lbl-hi">110%</text><text x="12" y="67" class="sv-lbl">占比 50% × 10</text><rect x="150" y="50" width="182" height="18" rx="4" class="sv-amb-s"></rect><text x="340" y="67" class="sv-lbl-hi">182%</text><text x="12" y="91" class="sv-lbl">占比 90% × 10</text><rect x="150" y="74" width="526" height="18" rx="4" class="sv-grn-s"></rect><text x="684" y="91" class="sv-lbl-hi">526%</text></svg>
```



纵轴为整体加速比；横轴示例为“被优化部分占比 10%/50%/90%”在“该部分提速 10×”下的整体收益。占比 10% 时整体最多约 1.10×——先优化占比最大的一段。



一句话：先找占比最大的热点



Amdahl 定律说“优化占比小的地方收益有限”。所以别凭直觉优化“看起来复杂的函数”，先用 profiling 找出 **真正吃时间** 的那段。



```zhizhan-anchor
m09-wcet
```



```zhizhan-anchor
m09-wcet-t
```



## 9.4 实时系统要 WCET，不是平均值



实时性关心“ **最坏情况也满足截止期** ”。平均时间会掩盖偶发的长分支、cache miss、中断干扰，所以调度分析要用  **WCET** （最坏执行时间），并覆盖最坏分支与最坏访存路径。



表 9.3 实时指标



| 概念 | 关心 | 风险 |
| --- | --- | --- |
| 平均时间 | 吞吐 | 掩盖最坏，实时失效 |
| WCET | 最坏可调度 | 分析保守/难测 |
| 抖动 (jitter) | 响应一致性 | 中断/缓存干扰 |
| CPI 波动 | 访存不确定性 | miss 推高有效 CPI |



wcet\_measure.c 节选C

 

```text
// 测最坏而非平均：连续 N 次取最大值，并制造最坏访存/branch
uint32_t worst = 0;
for (int i = 0; i < N; i++) {
  uint32_t t0 = DWT->CYCCNT;
  task_worst_case();               // 覆盖最坏分支
  uint32_t dt = DWT->CYCCNT - t0;
  if (dt > worst) worst = dt;      // 记录 WCET
}
// 再叠加最坏中断抢占，评估截止期余量
```

实时性能看最坏值；测平均会掩盖偶发超期



表 9.4 性能工作的常见错误与正解



| 问题 | 错误做法 | 正确做法 |
| --- | --- | --- |
| 估时间 | 整数除法随手算 | 统一单位、核对量级、再实测 |
| 找热点 | 凭直觉 | profiling 采样定位 |
| 实时 | 用平均时间 | 用 WCET \+ 抖动 |
| 基准 | 换环境直接比 | 固定环境、可复跑命令 |



实时里“偶发”才是常态



平均 10ms、最坏 30ms 的任务，在截止期 20ms 的系统里 **会失效** 。实时设计要按最坏路径（含 cache miss、中断抢占）核算，而不是拿平均值交差。



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **不测就优化** ：方向错，白忙。

- **只看平均** ：实时场景下最坏分支超期。

- **基准环境不一致** ：不同环境数字不可比。

- **忽略访存** ：CPU 预算达标但带宽不够。

- **用整数除法估时间** ：忘把单位/四舍五入对齐，估值离谱。



◆ 自测 · Module 09（先答再看）




1. 时间 = 指令数 × CPI ÷ 频率，三项分别是多少时最容易成为瓶颈？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"指令数由算法决定；CPI 受访存/cache 影响；频率受功耗限制。访存密集时 CPI 往往成主导（如 cache miss 把 CPI 抬高数倍）。"}
   ```

2. Amdahl 定律为什么说“只优化一小部分收益有限”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"因为整体加速受“未被优化部分”拖累：` 1/((1-p)+p/s) `。被优化部分占比 p 越小，整体提速越接近 1。应先优化占比最大的热点。"}
   ```

3. 实时系统为什么用 WCET 而不是平均时间？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"实时要求“最坏也满足截止期”。平均时间掩盖偶发的最坏分支/访存/中断干扰，据此设计会导致截止期失效。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对你项目最热的函数做一次真实测量（硬件计数器或 GPIO\+示波器），用 WCET 视角记录最坏值而非平均。



核对与延伸：[CS:APP 计算机系统](https://csapp.cs.cmu.edu/) · [ARM Cortex-M 文档](https://developer.arm.com/documentation/)

 

动手练习



运行 ` labs/host_perf.c `：按指令数/CPI/频率估算时间。



**检查结果：** 1M 指令 @72MHz、CPI=1.5 → 20.83ms；能说明 cache miss 如何抬升有效 CPI。

 

迁移练习：把本章的“能按预算公式估算时间，用 profiling 定位热点，并用 Amdahl 定律判断“值不值得优化”。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m09","criterion":"1M 指令 @72MHz、CPI=1.5 → 20.83ms；能说明 cache miss 如何抬升有效 CPI。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
