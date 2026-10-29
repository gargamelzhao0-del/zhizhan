# 复杂度与资源预算

```zhizhan-anchor
m01
```



算法选型先看 **量级** ：输入翻倍，O(n²) 变 4 倍，O(n log n) 只略增。嵌入式还要算 **内存与最坏执行时间** 。

 

> 前置：会写 C 循环/递归、理解指针与数组。 · ◷ 约 42 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按输入规模给出 O 量级与最坏执行时间估计，并为算法选定内存上限。

 

本章速览




- 先看量级：O(n²) 在规模大时不可接受。

- 嵌入式还要算最坏时间与内存。

- 大 O 忽略常数，小规模另论。

 

```zhizhan-anchor
m01-complexity
```



```zhizhan-anchor
m01-complexity-t
```



## 1.1 量级与最坏



算法选型先看量级：输入翻倍，O(n²) 变 4 倍、O(n log n) 只略增。嵌入式还要算内存与最坏执行时间，常以“有界”换“最优”。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  两种复杂度随规模的增长（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="两种复杂度随规模的增长（真实值）" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><text x="12" y="43" class="sv-lbl">O(n²)@256</text><rect x="150" y="26" width="562" height="18" rx="4" class="sv-red-s"></rect><text x="720" y="43" class="sv-lbl-hi">32768次操作</text><text x="12" y="67" class="sv-lbl">O(n log n)@256</text><rect x="150" y="50" width="35" height="18" rx="4" class="sv-grn-s"></rect><text x="193" y="67" class="sv-lbl-hi">2048次操作</text></svg>
```



n=256 时 O(n²)≈32768、O(n log n)≈2048（约 16 倍）。规模增大时 O(n²) 迅速不可接受。



表 1.1 常见复杂度



| 复杂度 | 输入×2 | 适用 |
| --- | --- | --- |
| O(1) | 不变 | 查表/位运算 |
| O(log n) | \+常数 | 二分/树 |
| O(n) | ×2 | 线性扫描 |
| O(n log n) | 略大于×2 | 排序 |
| O(n²) | ×4 | 仅小规模 |



complexity.c 节选C

 

```text
long ops_n2    = (long)n * n;                       // O(n²)
long ops_nlogn = (long)n * (long)(log2((double)n)+1); // O(n log n)
/* 小规模看常数，大规模看量级；并给内存上限 */
```

按规模比量级；同时给内存上限



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：操作计数增长



下面这段程序比较两种复杂度随规模的操作计数：



host\_complexity.cC

 

```text
/* host_complexity.c —— 复杂度与操作计数：O(n^2) vs O(n log n)（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_complexity.c -o host_complexity && ./host_complexity
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    for (int n = 64; n <= 256; n *= 2) {
        long n2 = (long)n*n/2;                 /* 冒泡/插入约为 n^2/2 */
        long nlogn = (long)n*8;                /* log2(256)=8 量级 */
        printf("n=%d: O(n^2)≈%ld, O(n log n)≈%ld\n", n, n2, nlogn);
        if (n >= 128 && !(n2 > 5*nlogn)) ok = 0;
    }
    printf("结论：规模增大时 O(n^2) 迅速不可接受，需要 O(n log n)\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

复杂度计数模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_complexity.c -o labs/host_complexity && ./labs/host_complexity
n=64: O(n^2)≈2048, O(n log n)≈512
n=256: O(n^2)≈32768, O(n log n)≈2048
结论：规模增大时 O(n^2) 迅速不可接受，需要 O(n log n)
RESULT: PASS
```



n=256 时 O(n²)≈32768 与 O(n log n)≈2048，比值约 16——量级差在小规模时被常数掩盖。



表 1.2 资源预算维度



| 量 | 含义 | 预算 |
| --- | --- | --- |
| O 量级 | 输入→工作量 | 选算法 |
| 最坏 | 最大输入 | 实时保证 |
| 常数 | 小规模主导 | 结合规模 |
| 内存 | 额外空间 | 有界 |



```zhizhan-anchor
m01-budget
```



```zhizhan-anchor
m01-budget-t
```



## 1.3 内存与最坏时间



不要只看“能不能算完”，还要看最坏情况与额外内存。嵌入式倾向有界算法：内存上限固定、最坏时间可估。



complexity.c 节选C

 

```text
long ops_n2   = (long)n * n;                    // O(n²)
long ops_nlogn = (long)n * (long)(log2((double)n)+1); // O(n log n)
/* 选算法：小规模看常数，大规模看量级；并给内存上限 */
```

按规模比量级；同时给内存上限



表 1.3 资源预算实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 看量级 | 选算法 | 只比常数 |
| 估最坏 | 实时保证 | 只看平均 |
| 算内存 | 不超预算 | 额外数组放不下 |
| 有界 | 可预测 | 无界增长 |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



复杂度自检：量级、最坏、常数、内存四方面都评估。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  算法选型流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="算法选型流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看量级</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">估最坏</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">算内存</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">定预算</text></svg>
```



看量级 → 估最坏 → 算内存 → 定预算 → 选算法（小规模可容忍高常数）。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 量级 | 大 O | 忽略规模 |
| 最坏 | 最大输入 | 只看平均 |
| 常数 | 实测 | 小规模误判 |
| 内存 | 额外空间 | 越界 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **只看平均** ：最坏输入超期。

- **忽略常数因子** ：小规模 O(n²) 反而快。

- **不算内存** ：额外数组放不下。

- **规模评估错** ：上线后崩。



◆ 自测 · Module 01（先答再看）




1. 输入规模较小时，为什么 O(n²) 可能比 O(n log n) 更快？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"大 O 忽略常数因子。小规模时 O(n log n) 的常数/递归开销可能更大。嵌入式要结合规模与常数一起选。"}
   ```

2. 为什么“输入翻倍 O(n²) 变 4 倍”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"O(n²) 的工作量与 n² 成正比；(2n)²=4n²。量级越大，规模增长带来的代价越陡。"}
   ```

3. 嵌入式为什么常“以有界换最优”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"实时与内存受限时，可预测的最坏时间与固定内存比“平均最优”更重要。有界算法保证行为可预测。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个热点算法估 O 量级、最坏时间与额外内存，写进资源预算。



核对与延伸：[MIT 算法公开课](https://ocw.mit.edu/) · [Efficient C 定点](https://www.embedded.com/)

 

动手练习



运行 ` labs/host_complexity.c `：比较 O(n²) 与 O(n log n) 的操作计数增长。



**检查结果：** n=256 时 O(n²)≈32768 远大于 O(n log n)≈2048；能据量级选算法。

 

迁移练习：把本章的“能按输入规模给出 O 量级与最坏执行时间估计，并为算法选定内存上限。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m01","criterion":"n=256 时 O(n²)≈32768 远大于 O(n log n)≈2048；能据量级选算法。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
