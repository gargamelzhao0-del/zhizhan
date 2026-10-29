# 问题定义与算法基线

```zhizhan-anchor
m01
```



ML 的第一步是 **把问题定义清楚** ：输入、输出、指标、约束。并 **先建简单基线** ，再判断是否值得上复杂模型。

 

> 前置：会基础统计与最小二乘，能用 C 做数值计算。 · ◷ 约 42 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把业务问题写成输入/输出/指标/约束，并建立可对照的简单基线。

 

本章速览




- 先定义问题：输入/输出/指标/约束。

- 先建简单基线再决定是否上复杂模型。

- 指标要业务相关。

 

```zhizhan-anchor
m01-problem
```



```zhizhan-anchor
m01-problem-t
```



## 1.1 定义问题、指标、约束



ML 第一步是把问题定义清楚：输入（特征/单位）、输出（类别/数值）、指标（业务相关）、约束（算力/延迟）。先建简单基线，再判断是否值得上复杂模型。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  从问题到基线



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从问题到基线" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">定义问题</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">指标</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">基线</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">是否上模型</text></svg>
```



定义输入/输出/指标/约束 → 建简单基线（阈值/线性/规则）→ 评估 → 决定是否上复杂模型。



表 1.1 问题定义五要素



| 要素 | 内容 | 坑 |
| --- | --- | --- |
| 输入 | 特征/单位 | 与现场不一致 |
| 输出 | 类别/数值 | 定义模糊 |
| 指标 | 业务相关 | 只看准确率 |
| 基线 | 阈值/线性 | 直接上深网 |
| 约束 | 算力/延迟 | 忽略部署 |



baseline.c 节选C

 

```text
k = (n*Sxy - Sx*Sy) / (n*Sxx - Sx*Sx);   // 斜率=2
b = (Sy - k*Sx) / n;                      // 截距=1
/* 基线=参照下界；模型须显著超过才值得部署 */
```

最小二乘线性基线 y=kx\+b；作为比较参照，不保证是其他模型性能的下界



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：线性基线



下面这段程序用最小二乘拟合一条线性基线：



host\_linear.cC

 

```text
/* host_linear.c —— 最小二乘线性回归（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_linear.c -o host_linear && ./host_linear
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    double x[]={0,1,2,3,4}, y[]={1,3,5,7,9};   /* y=2x+1 */
    int n=5; double sx=0,sy=0,sxx=0,sxy=0;
    for(int i=0;i<n;i++){sx+=x[i];sy+=y[i];sxx+=x[i]*x[i];sxy+=x[i]*y[i];}
    double w=(n*sxy-sx*sy)/(n*sxx-sx*sx), b=(sy-w*sx)/n;
    printf("拟合 y=%.3f x + %.3f（期望 2.000 1.000）\n", w, b);
    if (w<1.999||w>2.001||b<0.999||b>1.001) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
```

线性基线模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_linear.c -o labs/host_linear && ./labs/host_linear
拟合 y=2.000 x + 1.000（期望 2.000 1.000）
RESULT: PASS
```



线性基线 y=2.000x\+1.000（w=2、b=1，误差\<0.001），作为复杂模型的对照下界。



表 1.2 基线定义



| 要素 | 基线 | 说明 |
| --- | --- | --- |
| 输入 | x | 特征 |
| 输出 | y=kx\+b | 数值 |
| 指标 | 残差/误差 | 业务相关 |
| 基线 | 线性 | 参照下界 |



```zhizhan-anchor
m01-baseline
```



```zhizhan-anchor
m01-baseline-t
```



## 1.3 基线的价值



基线给出参照系：模型若不能显著超过基线，就不值得部署。很多端侧问题用阈值/线性/规则就能解决。



baseline.c 节选C

 

```text
k = (n*Sxy - Sx*Sy) / (n*Sxx - Sx*Sx);   // 斜率=2
b = (Sy - k*Sx) / n;                      // 截距=1
/* 基线=参照下界；模型须显著超过才值得部署 */
```

最小二乘线性基线 y=kx\+b；作为比较参照，不保证是其他模型性能的下界



表 1.3 基线实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 定义指标 | 业务对齐 | 只看准确率 |
| 建基线 | 参照 | 直接上深网 |
| 看约束 | 可部署 | 训好上不去 |
| 迭代 | 逐步改进 | 无验收 |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



问题自检：输入/输出/指标/约束清晰、有基线、可验收。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  基线 vs 复杂模型（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="基线 vs 复杂模型（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">阈值基线</text><rect x="150" y="26" width="420" height="18" rx="4" class="sv-amb-s"></rect><text x="578" y="43" class="sv-lbl-hi">70F1×100</text><text x="12" y="67" class="sv-lbl">复杂模型</text><rect x="150" y="50" width="504" height="18" rx="4" class="sv-grn-s"></rect><text x="662" y="67" class="sv-lbl-hi">84F1×100</text></svg>
```



模型须显著超过基线才值得其成本；基线本身可能已够用。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 输入 | 特征/单位 | 口径不一致 |
| 输出 | 明确 | 定义模糊 |
| 指标 | 业务相关 | 只看准确率 |
| 基线 | 简单方法 | 直接深网 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **指标与业务不符** ：优化错方向。

- **无基线** ：不知模型价值。

- **忽略部署约束** ：训好上不去。

- **问题定义模糊** ：无法验收。



◆ 自测 · Module 01（先答再看）




1. 为什么 ML 工程强调“先建基线”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"基线给出参照与下界；只有显著超过基线，复杂模型才值得其成本。很多问题基线（阈值/规则）本身已够用。"}
   ```

2. 定义 ML 问题至少要写清哪四件事？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"输入（特征/单位）、输出（类别/数值）、指标（业务相关）、约束（算力/延迟）。缺任一项都会导致优化错方向或训好上不去。"}
   ```

3. 为什么“只看准确率”可能误导？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"类别不平衡时全靠预测多数类也能高准确率。业务相关指标（precision/recall/F1/成本）才能反映真实价值。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把一个业务问题写成输入/输出/指标/约束，并给出一个可对照的简单基线。



核对与延伸：[Google ML 速查](https://developers.google.com/machine-learning/guides/rules-of-ml) · [scikit-learn 常见陷阱](https://scikit-learn.org/stable/common_pitfalls.html)

 

动手练习



运行 ` labs/host_linear.c `：用最小二乘拟合一条线性基线。



**检查结果：** 线性基线 y=2.000x\+1.000（w=2、b=1）；能作为复杂模型的对照。

 

迁移练习：把本章的“能把业务问题写成输入/输出/指标/约束，并建立可对照的简单基线。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m01","criterion":"线性基线 y=2.000x+1.000（w=2、b=1）；能作为复杂模型的对照。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
