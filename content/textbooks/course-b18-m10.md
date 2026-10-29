# 综合：同一数据通路的跨平台分析

```zhizhan-anchor
m10
```



本章把 M01–M09 串成一条可复用的方法：选一条真实数据通路（采样→滤波→上报），沿  **ISA → 访存 → cache → 保护 → 性能**  逐层量化，最后给出 **条件化结论** ——不是“谁最快”，而是“在什么约束下选谁”。

 

> 前置：完成 M01–M09，具备 ISA/访存/cache/性能基础。 · ◷ 约 46 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能对一条数据通路沿 ISA→访存→cache→保护→性能逐层量化，产出有依据、条件化的跨平台结论。

 

本章速览




- 跨平台分析沿 ISA→访存→cache→性能逐层。

- 结论要条件化，不是“谁最快”。

- 量化\+约束才有工程意义。

 

```zhizhan-anchor
m10-method
```



```zhizhan-anchor
m10-method-t
```



## 10.1 方法：沿五层逐层量化



跨平台对比不是拍脑袋。按固定五层走一遍，每层都问“这一层谁有优势、依据是什么”：ISA（指令数/调用约定）、访存（带宽/延迟）、cache（有无/命中）、保护（权限/隔离）、性能（CPI/时间）。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  同一条数据通路的五层分析路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="同一条数据通路的五层分析路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">ISA</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">访存</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">cache</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">保护</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">性能</text></svg>
```



采样→滤波→上报 是贯穿案例。逐层分析：ISA 决定指令与调用；访存决定带宽/延迟；cache 决定命中；保护决定隔离；性能把所有层汇总成预算。



表 10.1 五层分析清单



| 层 | 关注 | 量化对象 | 来自哪章 |
| --- | --- | --- | --- |
| ISA | 指令数/调用约定 | 指令条数、ABI 差异 | M02/M08 |
| 访存 | 带宽/延迟 | 每字节成本、总线层次 | M01/M04 |
| cache | 有无/命中 | 命中率、miss 惩罚 | M04/M06 |
| 保护 | 权限/隔离 | MPU/MMU 开销与能力 | M05 |
| 性能 | CPI/时间 | 时间 = 指令×CPI/频率 | M09 |



```zhizhan-anchor
m10-case
```



```zhizhan-anchor
m10-case-t
```



## 10.2 贯穿案例：采样→滤波→上报 的预算



以 Cortex-M @72MHz 为例，滤波回路 1M 指令、CPI=1.5：时间 = 1e6×1.5/72e6 ≈ 20.8ms。若把滤波缓冲改成连续访问（M04），miss 减少、有效 CPI 下降；若把控制回路放 TCM（M01），访问不确定性与抖动下降；[DMA](term:dma) 搬运上报数据（M06）释放 CPU——这些改动都能在预算里体现。



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_perf.cC\n\n \n\n```text\n/* host_perf.c —— 性能预算：CPI/周期与吞吐估算（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_perf.c -o host_perf && ./host_perf\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    /* 指令数 × CPI / 频率 = 时间 */\n    long instr = 1000000;      /* 1M 指令 */\n    float cpi = 1.5f, freq_mhz = 72.0f;\n    float time_ms = (float)instr * cpi / (freq_mhz * 1e6f) * 1000.0f;\n    printf(\"1M 指令 @72MHz CPI=1.5 → %.2fms\\n\", time_ms);\n    if (time_ms < 20.0f || time_ms > 21.0f) ok = 0;\n    /* 内存墙：访存慢会显著拉高 CPI */\n    printf(\"note: cache miss 会抬升有效 CPI，预算要含访存\\n\");\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n预算模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_perf.c -o labs/host_perf && ./labs/host_perf
1M 指令 @72MHz CPI=1.5 → 20.83ms
note: cache miss 会抬升有效 CPI，预算要含访存
RESULT: PASS
```



同一通路：改布局（M04）降 CPI、放 TCM（M01）降抖动、用 DMA（M06）省 CPU——都能量化。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  滤波回路预算：CPI 变化带来的时间差（同一代码）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="滤波回路预算：CPI 变化带来的时间差（同一代码）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">理想 CPI=1</text><rect x="150" y="26" width="168" height="18" rx="4" class="sv-grn-s"></rect><text x="326" y="43" class="sv-lbl-hi">14ms</text><text x="12" y="67" class="sv-lbl">实测 CPI=1.5</text><rect x="150" y="50" width="252" height="18" rx="4" class="sv-amb-s"></rect><text x="410" y="67" class="sv-lbl-hi">21ms</text><text x="12" y="91" class="sv-lbl">含 miss CPI=3</text><rect x="150" y="74" width="504" height="18" rx="4" class="sv-red-s"></rect><text x="662" y="91" class="sv-lbl-hi">42ms</text></svg>
```



占位为明显示意：CPI=1 理想 → 13.9ms；CPI=1.5 实测 → 20.8ms；含 miss 有效 CPI=3 → 41.7ms。说明“访存决定 CPI”，是跨平台性能差异的主因之一。



```zhizhan-anchor
m10-verdict
```



```zhizhan-anchor
m10-verdict-t
```



## 10.3 结论怎么写：条件化，不绝对



跨平台分析的产出不是“谁最快”，而是“在什么约束下选谁”。把约束（数据规模、实时性、功耗）写进结论，把依据（各层量化）列出来，结论才对别人有用。



verdict\_template.txt 节选Text

 

```text
在 数据规模=<N>、实时性=<截止期/抖动>、功耗=<预算> 约束下：
  <架构A> 更合适。依据：
   ISA: <指令数/ABI 差异>  访存: <带宽/延迟>  cache: <命中/有无>
   保护: <权限/隔离>       性能: <CPI/时间预算>
  反例边界: 当 <条件变化> 时，优势可能反转（给失效条件）
```

条件化结论 = 约束 \+ 各层依据 \+ 失效边界



表 10.2 结论形式的优劣



| 结论形式 | 好/坏 | 原因 |
| --- | --- | --- |
| “A 比 B 快” | 坏 | 无约束、无依据，不可用 |
| “在 N\<1k、抖动\<50us 时选 A” | 好 | 有条件、可验证 |
| “A 一定更好” | 坏 | 绝对化，忽略平台差异 |
| “A 在数据小、B 在数据大时更优” | 好 | 给出反转边界 |



```zhizhan-anchor
m10-review
```



```zhizhan-anchor
m10-review-t
```



## 10.4 复核清单：交付前逐条过



表 10.3 跨平台分析交付自检



| 检查项 | 通过标准 |
| --- | --- |
| 每层有量化 | ISA/访存/cache/保护/性能都有数字或依据 |
| 证据可复现 | 命令 \+ 真实输出（labs/ 脚本） |
| 结论有条件 | 写成“在…约束下选…”，含失效边界 |
| 与实际一致 | 主机可验证项已实跑；“需上板”项如实标注 |
| 贯穿一致 | 与 M01–M09 的结论不冲突 |



portable\_budget.c 节选C

 

```text
// 用可移植原语 + 统一计时，让同一份分析代码跑在两平台上
uint64_t cyc = now_cycles();           // DWT(Cortex-M) / rdcycle(RISC-V)
run_workload();
cyc = now_cycles() - cyc;
double ms = (double)cyc / FREQ_HZ * 1000.0;
printf("%s: %.3f ms  (%llu cyc)\n", PLATFORM, ms, (unsigned long long)cyc);
```

同一份预算/计时框架可在两平台复用，便于同口径对比



表 10.4 单平台 vs 跨平台的口径差异



| 对比项 | 只测单平台 | 跨平台同口径 |
| --- | --- | --- |
| 计时源 | 本平台计数 | 统一抽象 now\_cycles |
| 编译选项 | 随手 | 固定 -O2、同优化档 |
| 工作集 | 随意 | 同一数据规模 |
| 结论 | “谁快” | 条件化 \+ 失效边界 |



这一册真正训练的能力



不是记住某颗芯片的参数，而是 **拿到任意一条数据通路、任意两类架构，都能沿五层量化并给出条件化结论** 。这套方法可以直接迁移到选型、评审与性能攻坚。



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **只比“谁快”** ：忽略约束与能效，结论无用。

- **不量化** ：结论无依据，无法复现。

- **只看指令数** ：忽略访存/cache。

- **结论绝对化** ：换场景即失效。

- **把“需上板”项当成已实测** ：数据可信度崩坏。



◆ 自测 · Module 10（先答再看）




1. 跨平台分析的正确结论形式是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"条件化：“在 数据规模/实时性/功耗 约束下，架构 A 更合适”，并列各层依据与失效边界。“谁最快”没有工程意义。"}
   ```

2. 同一段滤波代码，为什么在不同芯片上时间差很多？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"主要差在  **CPI** （受 cache 命中、访存层次影响）与频率。指令数可能相近，但 miss 会把有效 CPI 抬高数倍，时间随之变化。"}
   ```

3. 交付跨平台对比前，最关键的自检是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"证据可复现（命令\\+真实输出）且结论有条件、与 M01–M09 不冲突；“需上板”的项如实标注，不把估算当实测。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：选你手上真实的一条数据通路，按本章五层做一次跨平台对比，产出一页含约束与失效边界的条件化结论。



核对与延伸：[RISC-V 规范](https://riscv.org/technical/specifications/) · [CS:APP 计算机系统](https://csapp.cs.cmu.edu/)

 

动手练习



用本章模板与你自己的真实数据，产出一张“同通路×三平台”的条件化对比表。



**检查结果：** 对比表每层有量化依据（ISA/访存/cache/保护/性能）；结论写成“在…约束下选…”，非绝对化。

 

迁移练习：把本章的“能对一条数据通路沿 ISA→访存→cache→保护→性能逐层量化，产出有依据、条件化的跨平台结论。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m10","criterion":"对比表每层有量化依据（ISA/访存/cache/保护/性能）；结论写成“在…约束下选…”，非绝对化。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
