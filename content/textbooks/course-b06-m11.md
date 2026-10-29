# 实时预算与可调度性

```zhizhan-anchor
m11
```



周期与截止期；执行预算；阻塞；过载与抖动；利用率界；响应时间分析。

 

> 前置：了解周期/截止期与优先级分配（RM），会读任务执行时间。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能计算利用率与响应时间分析，在最坏情况下判定一组任务是否满足截止期。

 

本章速览




- 利用率 U=ΣC/T 是快速筛查；U ≤ n(2^{1/n}−1) 一定可调度（RM），但超界未必不可调度。

- 响应时间分析 R\_i = C\_i \+ Σceil(R\_i/T\_j)·C\_j 迭代到不动点，R\_i ≤ T\_i 才可调度。

- WCET 靠测量并覆盖最坏分支，不是平均时间；要给阻塞与抖动留余量。

 

```zhizhan-anchor
m11-rm
```



```zhizhan-anchor
m11-rm-t
```



## 11.1 利用率界与响应时间分析



实时性不是“跑得快”，而是最坏情况下仍满足截止期。快速筛查用利用率 U=ΣC\_i/T\_i；RM 的界 n(2^{1/n}−1) 是充分条件，超界未必不可调度，需做精确响应时间分析。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  RM 利用率界随任务数下降



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="RM 利用率界随任务数下降" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">n=1</text><rect x="150" y="26" width="571" height="18" rx="4" class="sv-grn-s"></rect><text x="729" y="43" class="sv-lbl-hi">1000(×10⁻³)</text><text x="12" y="67" class="sv-lbl">n=3</text><rect x="150" y="50" width="446" height="18" rx="4" class="sv-amb-s"></rect><text x="604" y="67" class="sv-lbl-hi">780(×10⁻³)</text><text x="12" y="91" class="sv-lbl">n→∞</text><rect x="150" y="74" width="396" height="18" rx="4" class="sv-red-s"></rect><text x="554" y="91" class="sv-lbl-hi">693(×10⁻³)</text></svg>
```



n=1 界=1.000、n=3 界=0.780、n→∞ 界≈0.693。超过界只是“不保证”，要做 RTA。



表 11.1 RM 利用率界



| 任务数 n | RM 利用率界 n(2^{1/n}−1) |
| --- | --- |
| 1 | 1.000 |
| 2 | 0.828 |
| 3 | 0.780 |
| 4 | 0.757 |
| →∞ | 0.693 |



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：超界仍可调度



下面这段主机程序穷举任务集，找出“U 超界但 RTA 仍可调度”的例子：



host\_rm.cC

 

```text
/* host_rm.c —— 实时预算与可调度性：利用率界、响应时间分析（主机可运行）。
 *
 *   ① 利用率界 U ≤ n(2^{1/n}-1) 是“充分不必要”：超过它未必不可调度。
 *      本程序用穷举找到一组“U 超过界、但响应时间分析(RTA)仍然可调度”的任务集。
 *   ② 响应时间分析：R_i = C_i + Σ_{j<i} ceil(R_i / T_j)·C_j，迭代到不动点，R_i ≤ T_i 即可调度。
 *   ③ U > 1 一定不可调度。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_rm.c -o host_rm && ./host_rm
 */
#include <stdio.h>
#include <math.h>

static int cdiv(int a, int b) { return (a + b - 1) / b; }

/* 返回最低优先级任务的响应时间；-1 表示某一级不满足截止期 */
static int rta(const int *C, const int *T, int n, int *out_R) {
    for (int i = 0; i < n; i++) {
        int R = C[i], guard = 0;
        for (;;) {
            int nr = C[i];
            for (int j = 0; j < i; j++) nr += cdiv(R, T[j]) * C[j];
            if (nr == R) break;
            R = nr;
            if (++guard > 10000 || R > T[i]) return -1;
        }
        if (R > T[i]) return -1;
        out_R[i] = R;
    }
    return 0;
}

int main(void) {
    int ok = 1, found = 0;
    int C[3], T[3], R[3];

    printf("穷举 n=3（C≤4, T≤12，按周期升序=优先级降序），寻找“U 超界但可调度”的例子：\n");
    for (int c1 = 1; c1 <= 4 && !found; c1++)
    for (int c2 = 1; c2 <= 4 && !found; c2++)
    for (int c3 = 1; c3 <= 4 && !found; c3++)
    for (int t1 = 2; t1 <= 12 && !found; t1++)
    for (int t2 = t1 + 1; t2 <= 12 && !found; t2++)
    for (int t3 = t2 + 1; t3 <= 12 && !found; t3++) {
        C[0]=c1;C[1]=c2;C[2]=c3; T[0]=t1;T[1]=t2;T[2]=t3;
        double U = (double)c1/t1 + (double)c2/t2 + (double)c3/t3;
        double bound = 3.0 * (pow(2.0, 1.0/3.0) - 1.0);
        if (U <= bound || U >= 0.95) continue;
        if (rta(C, T, 3, R) == 0) {
            printf("  找到：C/T = (%d,%d,%d)/(%d,%d,%d)，U=%.4f > 界 %.4f\n",
                   c1, c2, c3, t1, t2, t3, U, bound);
            printf("  响应时间 R = (%d,%d,%d)，均 ≤ 各自周期 → 可调度\n", R[0], R[1], R[2]);
            found = 1;
        }
    }
    if (!found) ok = 0;

    /* 反证：U>1 必然不可调度 */
    int C2[2] = {3, 4}, T2[2] = {4, 5}, R2[2] = {0,0};
    double U2 = 3.0/4.0 + 4.0/5.0;
    int r = rta(C2, T2, 2, R2);
    printf("\nU>1 的例子：(3,4),(4,5) → U=%.2f，RTA 结果=%s（期望不可调度）\n",
           U2, r == 0 ? "可调度" : "不可调度");
    if (U2 > 1.0 && r == 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

RM/RTA 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_rm.c -o labs/host_rm && ./labs/host_rm
找到：C/T = (1,1,1)/(2,3,9)，U=0.9444 > 界 0.7798
  响应时间 R = (1,2,6)，均 ≤ 各自周期 → 可调度
U>1 的例子：(3,4),(4,5) → U=1.55，RTA 结果=不可调度
RESULT: PASS
```



U=0.9444 超界 0.7798 但 R=(1,2,6) 均 ≤ 周期即可调度；U=1.55\>1 判不可调度。



表 11.2 可调度性判定



| 实例 | U | R | 判定 |
| --- | --- | --- | --- |
| (1,1,1)/(2,3,9) | 0.9444 | (1,2,6) | 可调度 |
| 界 | 0.7798 | — | 充分 |
| U\>1 例子 | 1.55 | — | 不可调度 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm11-plat\n```\n\n\n\n```zhizhan-anchor\nm11-plat-t\n```\n\n\n\n## 11.3 三平台对照：RTA/WCET\n\n\n\nRTA 与 WCET 与平台无关，但 WCET 测量用 DWT(M3/M7) 或计时器(ESP32)。\n\n\n\nm11\\_wcet.cC\n\n \n\n```text\n/* m11_wcet.c —— 用 DWT 周期计数器测 WCET（Cortex-M3）。\n * WCET 关注“最坏一次”，不是平均；要用能覆盖最坏输入/分支的测试。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n\n#define DEMCR      (*(volatile uint32_t *)0xE000EDFCu)\n#define DWT_CYCCNT (*(volatile uint32_t *)0xE0001004u)\n\nvolatile uint32_t g_wcet_cycles;\n\nvoid m11_wcet_on(void) { DEMCR |= (1u << 24); DWT_CYCCNT = 0u; }\n\nvoid m11_wcet_sample(uint32_t (*job)(void)) {\n    uint32_t t0 = DWT_CYCCNT;\n    (void)job();\n    uint32_t dt = DWT_CYCCNT - t0;\n    if (dt > g_wcet_cycles) { g_wcet_cycles = dt; }   /* 取最大，不是平均 */\n}\n```\n\nSTM32F103 · WCET\n\n\n\nesp\\_m11\\_rm.cC\n\n \n\n```text\n/* esp_m11_rm.c —— 利用率与 RM 界的速查（ESP32 / Xtensa）。\n * 任务按周期升序 = 优先级降序；先算 U=ΣC/T，再对最低优先级做响应时间分析。 */\n#include <stdint.h>\n#include \"rtos_api.h\"\n\n/* 例：C/T = (1,2),(1,3),(1,9)，U=0.944 > 界 0.780，但 R=(1,2,6) 均 ≤ 周期 → 可调度 */\nvoid esp_m11_table(void) {\n    const uint32_t C[3] = {1u, 1u, 1u};\n    const uint32_t T[3] = {2u, 3u, 9u};\n    uint32_t u_milli = 0u;\n    for (int i = 0; i < 3; i++) { u_milli += (C[i] * 1000u) / T[i]; }\n    (void)u_milli;      /* 上板可打印核对：应为 944‰ */\n}\n```\n\nESP32 · RTA\n\n\n\nh7\\_m11\\_rm.cC\n\n \n\n```text\n/* h7_m11_rm.c —— 响应时间分析（STM32H7 / Cortex-M7）。\n * R_i = C_i + Σ_{j<i} ceil(R_i / T_j)·C_j，迭代到不动点；R_i ≤ T_i 才可调度。 */\n#include <stdint.h>\n\nstatic uint32_t ceil_div(uint32_t a, uint32_t b) { return (a + b - 1u) / b; }\n\nint h7_rm_schedulable(const uint32_t *C, const uint32_t *T, unsigned n) {\n    for (unsigned i = 0; i < n; i++) {\n        uint32_t R = C[i];\n        for (unsigned guard = 0; guard < 10000u; guard++) {\n            uint32_t nr = C[i];\n            for (unsigned j = 0; j < i; j++) { nr += ceil_div(R, T[j]) * C[j]; }\n            if (nr == R) { break; }\n            R = nr;\n            if (R > T[i]) { return 0; }\n        }\n        if (R > T[i]) { return 0; }\n    }\n    return 1;\n}\n```\n\nSTM32H7 · RTA\n\n\n\n表 11.3 三平台预算\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| WCET 测量 | DWT CYCCNT | esp\\_timer | DWT CYCCNT |\n| RTA | 公式 | 公式 | 公式 |\n| 预算 | 指令×CPI/频率 | 同 | 同 |\n| 余量 | 含阻塞/抖动 | 同 | 同 |"}
````



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检



可调度性自检：WCET 覆盖最坏、算 U、做 RTA、留阻塞/抖动余量。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  可调度性判定流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="可调度性判定流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">测 WCET</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">算 U</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">RTA</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">判定</text></svg>
```



测 WCET → 算 U → 若 U≤界则可调度；否则做 RTA → R\_i≤T\_i 则可调度。



表 11.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| WCET | 最坏分支 | 用平均 |
| U | ΣC/T | 只用界 |
| RTA | 迭代到不动点 | 超界即判死 |
| 余量 | 阻塞/抖动 | 漏算 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **用平均时间当 WCET** ：最坏分支才决定截止期。

- **把“U 超界”直接判死** ：界是充分的，超界要做 RTA。

- **漏算阻塞与抖动** ：等锁/关中断/cache miss 都会加进 R\_i。

- **忽略中断占用** ：高频中断吃掉的 CPU 也是预算。



◆ 自测 · Module 11（先答再看）




1. 三个任务 U=0.9，能否说“一定不可调度”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能。RM 界 0.780 是充分条件，U=0.9 超界只是“界不保证”，还要做响应时间分析；很多任务集超界仍可调度（本例 U=0.944 就可调度）。"}
   ```

2. 为什么 WCET 不能用平均时间？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"截止期由最坏那一次决定。平均时间掩盖最坏分支/访存/中断干扰，据此设计会超期。"}
   ```

3. RTA 里除了执行时间还要计入什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"高优先级任务的干扰、等锁的阻塞、关中断与 cache miss 的抖动、以及中断占用。漏算会导致“算着可调度、实际超期”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对你一组周期任务测 WCET、算利用率并做响应时间分析，给出可调度性结论与余量。



核对与延伸：[Liu & Layland · Rate Monotonic Scheduling](https://en.wikipedia.org/wiki/Rate-monotonic_scheduling) · [FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html)

 

动手练习



运行 ` labs/host_rm.c `：找出“U 超界但仍可调度”的例子；编译 h7\_m11\_rm.c。



**检查结果：** 找到 U=0.9444\>界 0.7798 但 R=(1,2,6) 均可调度的实例；U\>1 判不可调度。

 

迁移练习：把本章的“能计算利用率与响应时间分析，在最坏情况下判定一组任务是否满足截止期。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m11","criterion":"找到 U=0.9444>界 0.7798 但 R=(1,2,6) 均可调度的实例；U>1 判不可调度。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
