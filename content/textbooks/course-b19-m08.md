# 概率、统计与实验设计

```zhizhan-anchor
m08
```



统计把“感觉”变成“证据”： **均值/方差/标准差、分布与异常、样本量与显著性** ；实验设计要控制变量、有对照。

 

> 前置：理解均值/方差，知道抽样与误差。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能计算均值/标准差与最小二乘拟合，并按样本量/对照组设计可复现实验。

 

本章速览




- 统计给均值/方差/样本量，别只给均值。

- 实验要有对照、控制变量。

- 异常值用稳健统计判断。

 

```zhizhan-anchor
m08-stats
```



```zhizhan-anchor
m08-stats-t
```



## 8.1 统计量、分布、异常



统计把“感觉”变成“证据”：均值/方差/标准差、分布与异常、样本量与显著性。实验设计要控制变量、有对照。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  从数据到结论



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从数据到结论" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">统计量</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">分布/异常</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">对照实验</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">结论</text></svg>
```



算统计量（均值/方差）→ 看分布与异常 → 设计对照实验 → 判显著性 → 结论（含不确定性）。



表 8.1 统计五概念



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 均值/方差 | 集中/离散 | 受异常值影响 |
| 中位数/MAD | 稳健统计 | 抗异常 |
| 样本量 | 置信 | 太少不可靠 |
| 对照 | 排除干扰 | 控制变量 |
| 显著性 | 判差异 | 多重比较 |



stats.c 节选C

 

```text
double mean = sum / n;
double sd = sqrt(sqsum / (n - 1));       // 样本标准差
/* 最小二乘：k=Σ(x-x̄)(y-ȳ)/Σ(x-x̄)², b=ȳ-k·x̄ */
/* 报告须给 n 与条件；异常先用中位数/MAD 判 */
```

算均值/标准差与最小二乘；报告给样本量



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：均值/标准差与拟合



下面这段程序计算均值/标准差与最小二乘拟合：



host\_stats.cC

 

```text
/* host_stats.c —— 均值/标准差与最小二乘线性拟合（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_stats.c -o host_stats -lm && ./host_stats
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    double x[] = {1,2,3,4,5}, y[] = {2,4,6,8,10};   /* y=2x */
    int n = 5; double sx=0, sy=0, sxx=0, sxy=0;
    for (int i = 0; i < n; i++) { sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; }
    double slope = (n*sxy - sx*sy)/(n*sxx - sx*sx);
    double intercept = (sy - slope*sx)/n;
    printf("拟合 y=%.3f x + %.3f（期望 2.000 0.000）\n", slope, intercept);
    if (fabs(slope-2.0) > 1e-6 || fabs(intercept) > 1e-6) ok = 0;
    double my = sy/n, var = 0;
    for (int i = 0; i < n; i++) var += (y[i]-my)*(y[i]-my);
    printf("y 均值=%.1f 标准差=%.3f\n", my, sqrt(var/n));
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

统计/最小二乘模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_stats.c -o labs/host_stats && ./labs/host_stats
拟合 y=2.000 x + 0.000（期望 2.000 0.000）
y 均值=6.0 标准差=2.828
RESULT: PASS
```



最小二乘拟合得斜率 2.000、截距 0.000；y 均值 6.0、标准差 2.828（n=5）。



表 8.2 统计结果



| 量 | 公式 | 值 |
| --- | --- | --- |
| 均值 | Σy/n | 6.0 |
| 标准差 | √(Σ(y-ȳ)²/(n-1)) | 2.828 |
| 斜率 | 最小二乘 | 2.000 |
| 截距 | 最小二乘 | 0.000 |



```zhizhan-anchor
m08-design
```



```zhizhan-anchor
m08-design-t
```



## 8.3 实验设计与显著性



报告要给样本量、条件与不确定性；“跑 3 次都一样”不足以证明稳定。异常值先用稳健统计判断，再决定剔除或保留。



stats.c 节选C

 

```text
double mean = sum / n;
double sd = sqrt(sqsum / (n - 1));       // 样本标准差
/* 最小二乘：k=Σ(x-x̄)(y-ȳ)/Σ(x-x̄)², b=ȳ-k·x̄ */
/* 报告须给 n 与条件；异常先用中位数/MAD 判 */
```

算均值/标准差与最小二乘；报告给样本量与条件



表 8.3 实验设计实践



| 要求 | 做法 | 避免 |
| --- | --- | --- |
| 样本量 | 足够且注明 | 太少 |
| 对照 | 控制变量 | 把环境当效果 |
| 稳健 | 中位数/MAD | 被异常带偏 |
| 显著性 | α 校正 | 多重比较假阳性 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



统计自检：统计量正确、有样本量、有对照、结论含不确定性。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  均值与标准差（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="均值与标准差（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">均值</text><rect x="150" y="26" width="514" height="18" rx="4" class="sv-cyn-s"></rect><text x="672" y="43" class="sv-lbl-hi">60(×10⁻¹)</text><text x="12" y="67" class="sv-lbl">标准差</text><rect x="150" y="50" width="240" height="18" rx="4" class="sv-amb-s"></rect><text x="398" y="67" class="sv-lbl-hi">28(×10⁻¹)</text></svg>
```



y 均值 6.0、标准差 2.828（n=5）。标准差反映离散度，结论要带它。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 统计量 | 均值/标准差 | 只看均值 |
| 异常 | 稳健统计 | 被带偏 |
| 对照 | 控制变量 | 无对照 |
| 报告 | n \+ 条件 | 结论不可复现 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **样本太少** ：结论偶然。

- **无对照** ：把环境变化当效果。

- **被异常值带偏** ：均值失真。

- **多重比较不校正** ：假阳性。



◆ 自测 · Module 08（先答再看）




1. 为什么报告要写“样本量与条件”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"脱离样本量与条件，统计结论无法复现或推广。样本太少、条件不同都会导致结论不可靠。"}
   ```

2. 标准差和均值分别反映什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"均值反映集中趋势（中心），标准差反映离散程度（波动）。结论应同时给出两者。"}
   ```

3. 异常值应该怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先用稳健统计（中位数/MAD）判断是否异常，再决定剔除或保留，并记录理由。不要直接删掉可疑点。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对你一组测量数据算均值/标准差，用稳健统计判异常，并按样本量/对照写清结论。



核对与延伸：[NumPy 数据类型](https://numpy.org/doc/stable/user/basics.types.html) · [scikit-learn 常见陷阱](https://scikit-learn.org/stable/common_pitfalls.html)

 

动手练习



运行 ` labs/host_stats.c `：计算均值/标准差与最小二乘拟合。



**检查结果：** 拟合 y=2.000x\+0.000；y 均值=6.0、标准差=2.828（n=5）。

 

迁移练习：把本章的“能计算均值/标准差与最小二乘拟合，并按样本量/对照组设计可复现实验。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m08","criterion":"拟合 y=2.000x+0.000；y 均值=6.0、标准差=2.828（n=5）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
