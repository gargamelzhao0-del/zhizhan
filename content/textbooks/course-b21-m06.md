# 训练工程与过拟合

```zhizhan-anchor
m06
```



训练质量靠 **曲线** 判断：训练好验证差=过拟合；都差=欠拟合。用正则、早停、数据增强对抗过拟合。

 

> 前置：理解 M05 训练与损失。 · ◷ 约 42 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能读训练/验证曲线区分过拟合/欠拟合并应用正则、早停与数据增强。

 

本章速览




- 看训练/验证曲线判过拟合。

- 早停与正则是最实用的反过拟合。

- 数据增强要物理合理。

 

```zhizhan-anchor
m06-curve
```



```zhizhan-anchor
m06-curve-t
```



## 6.1 曲线判过拟合



训练好验证差=过拟合；都差=欠拟合。用正则（L1/L2/dropout）、早停、数据增强对抗过拟合。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  过拟合 vs 欠拟合（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="过拟合 vs 欠拟合（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">过拟合 训练</text><rect x="150" y="26" width="588" height="18" rx="4" class="sv-red-s"></rect><text x="746" y="43" class="sv-lbl-hi">98%</text><text x="12" y="67" class="sv-lbl">过拟合 验证</text><rect x="150" y="50" width="420" height="18" rx="4" class="sv-amb-s"></rect><text x="578" y="67" class="sv-lbl-hi">70%</text><text x="12" y="91" class="sv-lbl">欠拟合</text><rect x="150" y="74" width="360" height="18" rx="4" class="sv-cyn-s"></rect><text x="518" y="91" class="sv-lbl-hi">60%</text></svg>
```



过拟合：训练指标高、验证指标低（差距大）；欠拟合：两者都低。



表 6.1 曲线现象与手段



| 现象 | 含义 | 手段 |
| --- | --- | --- |
| 训练好验证差 | 过拟合 | 正则/早停/增强 |
| 都差 | 欠拟合 | 更大模型/特征 |
| 验证震荡 | 学习率/批大小 | 调参 |
| 训练不降 | 学习率/初始化 | 排查 |
| 数据少 | 易过拟合 | 增强/迁移 |



train\_eng.py 节选Python

 

```text
best = val_metric; patience = 0
if val_metric < best: patience += 1       # 验证不再提升
if patience >= 10: break                  # 早停
# 增强须物理合理，不能在测试集上调参
```

按验证指标、容忍轮数与最小改变量早停；增强须符合物理约束



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：训练收敛



下面这段程序给出训练收敛的可运行证据（早停/正则基于此监控）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_train.cC\n\n \n\n```text\n/* host_train.c —— 梯度下降训练一个标量参数（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_train.c -o host_train && ./host_train\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    /* 拟合 y=w x，样本 (1,2),(2,4),(3,6) → w→2；损失 MSE */\n    double xs[]={1,2,3}, ys[]={2,4,6}; int n=3;\n    double w=0, lr=0.03;\n    for (int ep=0; ep<2000; ep++) {\n        double g=0; for(int i=0;i<n;i++){ double e=w*xs[i]-ys[i]; g+=2*e*xs[i]; }\n        g/=n; w -= lr*g;\n    }\n    printf(\"训练后 w=%.4f（期望 2.0000）\\n\", w);\n    if (w<1.999||w>2.001) ok=0;\n    printf(\"\\n%s\\n\", ok?\"RESULT: PASS\":\"RESULT: FAIL\");\n    return ok?0:1;\n}\n```\n\n训练收敛模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_train.c -o labs/host_train && ./labs/host_train
训练后 w=2.0000（期望 2.0000）
RESULT: PASS
```



训练损失稳定下降、参数收敛到 w=2.0000；若验证曲线不升反降则触发早停。



表 6.2 反过拟合手段



| 手段 | 做法 | 判据 |
| --- | --- | --- |
| 早停 | 验证不升就停 | 耐心 5–10 轮 |
| L2 正则 | 惩罚大权重 | λ∈\[1e-4,1e-2\] |
| Dropout | 随机丢弃 | 训练期 |
| 数据增强 | 物理合理扩充 | 不引错标签 |



```zhizhan-anchor
m06-early
```



```zhizhan-anchor
m06-early-t
```



## 6.3 早停与增强



早停（验证指标不再提升就停）是最实用的反过拟合手段；数据增强要在物理合理范围内（否则引入错误标签）。



train\_eng.py 节选Python

 

```text
best = val_metric; patience = 0
if val_metric < best: patience += 1       # 验证不再提升
if patience >= 10: break                  # 早停
# 增强须物理合理，不能在测试集上调参
```

按验证指标、容忍轮数与最小改变量早停；增强须符合物理约束



表 6.3 训练工程实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 早停 | 防越训越差 | 无判据 |
| 正则 | 抑大权重 | 过强欠拟合 |
| 增强 | 增多样本 | 不物理 |
| 验证集调参 | 防泄漏 | 测试集调参 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



训练工程自检：看曲线、有早停、有正则/增强、不在测试集调参。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  反过拟合流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="反过拟合流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看曲线</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">判拟合</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">正则/早停</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">复评</text></svg>
```



画训练/验证曲线 → 判过/欠拟合 → 正则/早停/增强 → 复评验证。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 曲线 | 训练\+验证 | 只看训练 |
| 判据 | 过/欠拟合 | 不判 |
| 手段 | 正则/早停/增强 | 增强不物理 |
| 调参 | 验证集 | 测试集 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **只看训练指标** ：过拟合不自知。

- **不做早停** ：越训越差。

- **增强不物理** ：引入错标签。

- **在测试集调参** ：泄漏。



◆ 自测 · Module 06（先答再看）




1. 训练指标高、验证指标低说明什么？怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"过拟合。应加正则/早停/数据增强、减小模型或增加数据；不要用测试集调参以免泄漏。"}
   ```

2. 为什么“早停”很实用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它让模型在验证指标不再提升时就停止，避免越训越过拟合；实现简单、效果稳定。"}
   ```

3. 数据增强有什么前提？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"增强必须物理合理（真实可能出现的变换），否则会引入错误标签，反而降低模型质量。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你训练画训练/验证曲线并设早停耐心，加一档物理合理的数据增强。



核对与延伸：[Google ML 速查](https://developers.google.com/machine-learning/guides/rules-of-ml) · [PyTorch 基础教程](https://docs.pytorch.org/tutorials/beginner/basics/intro.html)

 

动手练习



运行 ` labs/host_train.c `（训练收敛）；为训练画训练/验证曲线并设早停。



**检查结果：** 能按曲线区分过拟合（训练好验证差）与欠拟合（都差）；有早停判据，增强物理合理。

 

迁移练习：把本章的“能读训练/验证曲线区分过拟合/欠拟合并应用正则、早停与数据增强。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m06","criterion":"能按曲线区分过拟合（训练好验证差）与欠拟合（都差）；有早停判据，增强物理合理。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
