# 特征与传统机器学习

```zhizhan-anchor
m04
```



传统 ML 在端侧仍很有价值： **特征 \+ 线性/逻辑回归/树**  往往足够且可解释、算得起。预处理（归一化）要与推理一致。

 

> 前置：会线性代数与概率基础，读过 M03。 · ◷ 约 42 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能提特征、做与推理一致的归一化并选传统模型（线性/逻辑回归/树）作基线。

 

本章速览




- 端侧先试传统模型：小、可解释、易调。

- 归一化等预处理必须与推理一致。

- 只有不够才上深网。

 

```zhizhan-anchor
m04-ml
```



```zhizhan-anchor
m04-ml-t
```



## 4.1 传统模型：够用、可解释、算得起



传统 ML 在端侧仍很有价值：特征 \+ 线性/逻辑回归/树往往足够且可解释、算得起。归一化参数必须与推理一致。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  从特征到模型



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从特征到模型" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">提特征</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">归一化</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">选模型</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">看重要性</text></svg>
```



提特征 → 归一化（与推理一致）→ 选模型（线性/逻辑回归/树）→ 看特征重要性 → 作为基线。



表 4.1 传统模型



| 模型 | 特点 | 适用 |
| --- | --- | --- |
| 线性/逻辑回归 | 简单可解释 | 线性可分 |
| 决策树 | 非线性、可解释 | 规则型 |
| 随机森林/GBDT | 强、较重 | 表格数据 |
| 特征重要性 | 解释 | 选特征 |
| 归一化 | 预处理 | 必须一致 |



linear.c 节选C

 

```text
z = (x - train_mean) / train_std;     // 归一化用训练集统计
y = w0 + w1*z1 + w2*z2;               // 线性模型
/* 特征重要性可解释；不够才上深网 */
```

归一化用训练集统计；线性模型可解释



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：线性模型



下面这段程序拟合线性模型（作为基线）：



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

线性模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_linear.c -o labs/host_linear && ./labs/host_linear
拟合 y=2.000 x + 1.000（期望 2.000 1.000）
RESULT: PASS
```



线性模型 w=2、b=1；算力小、可解释，作为基线；归一化参数须与推理一致。



表 4.2 模型取舍



| 模型 | 资源 | 可解释 |
| --- | --- | --- |
| 线性回归 | 极小 | 强 |
| 决策树 | 小 | 强 |
| GBDT/深网 | 大 | 弱 |



```zhizhan-anchor
m04-norm
```



```zhizhan-anchor
m04-norm-t
```



## 4.3 归一化与特征重要性



先试传统模型：算力小、可解释、易调试；只有不够时才上神经网络。归一化参数必须与推理一致。



linear.c 节选C

 

```text
z = (x - train_mean) / train_std;     // 归一化用训练集统计
y = w0 + w1*z1 + w2*z2;               // 线性模型
/* 特征重要性可解释；不够才上深网 */
```

归一化用训练集统计；线性模型可解释



表 4.3 传统 ML 实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 先传统模型 | 省算力/可解释 | 过度复杂 |
| 归一化一致 | 精度不降 | 现算统计 |
| 特征重要性 | 可解释 | 黑盒 |
| 按预算选 | 端侧可跑 | 超资源 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



模型自检：归一化一致、模型可解释、资源在预算、作为基线可对照。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  模型资源对比（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="模型资源对比（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">线性</text><rect x="150" y="26" width="27" height="18" rx="4" class="sv-grn-s"></rect><text x="185" y="43" class="sv-lbl-hi">5(相对资源)</text><text x="12" y="67" class="sv-lbl">树</text><rect x="150" y="50" width="82" height="18" rx="4" class="sv-cyn-s"></rect><text x="240" y="67" class="sv-lbl-hi">15(相对资源)</text><text x="12" y="91" class="sv-lbl">深网</text><rect x="150" y="74" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="91" class="sv-lbl-hi">100(相对资源)</text></svg>
```



线性/树资源极小，深网大；端侧常先用传统模型。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 特征 | 工程 | 原始直送 |
| 归一化 | 训练集统计 | 现算 |
| 模型 | 先传统 | 直接深网 |
| 解释 | 特征重要性 | 黑盒 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **归一化不一致** ：精度骤降。

- **跳过传统模型** ：过度复杂。

- **特征泄漏** ：用未来信息。

- **不解释** ：出错难查。



◆ 自测 · Module 04（先答再看）




1. 端侧为什么常说“先试传统模型”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"传统模型算力小、可解释、易调试；很多任务已够用。只有确实不够时才引入神经网络，避免无谓的资源与复杂度。"}
   ```

2. 归一化参数为什么必须与推理一致？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型在特定归一化分布下训练；推理端用不同均值/方差会导致输入分布偏移、精度骤降。"}
   ```

3. “特征重要性”有什么用途？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"解释模型、指导特征选择与排错。传统模型（线性/树）通常能给出可解释的重要性。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个任务先试传统模型（线性/树），核对归一化与推理一致并做基线对照。



核对与延伸：[scikit-learn 常见陷阱](https://scikit-learn.org/stable/common_pitfalls.html)

 

动手练习



运行 ` labs/host_linear.c `（线性模型）；为任务比较传统模型与深网的资源/效果。



**检查结果：** 线性模型拟合 w=2、b=1（与推理口径一致）；传统模型作为基线，特征重要性可解释。

 

迁移练习：把本章的“能提特征、做与推理一致的归一化并选传统模型（线性/逻辑回归/树）作基线。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m04","criterion":"线性模型拟合 w=2、b=1（与推理口径一致）；传统模型作为基线，特征重要性可解释。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
