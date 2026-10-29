# 神经网络与训练机制

```zhizhan-anchor
m05
```



神经网络是“可学习的函数”： **前向计算 \+ 反向传播求梯度 \+ 梯度下降更新** 。训练就是让损失下降的过程。

 

> 前置：理解线性模型与梯度概念，读过 M04。 · ◷ 约 44 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现前向/反向传播与梯度下降训练，并选合适学习率/批大小。

 

本章速览




- 训练=前向\+反向传播\+梯度下降。

- 学习率过大发散、过小慢。

- 损失要与任务匹配。

 

```zhizhan-anchor
m05-nn
```



```zhizhan-anchor
m05-nn-t
```



## 5.1 前向/反向/梯度下降



神经网络是可学习的函数：前向计算输出、反向传播求梯度、梯度下降更新参数。训练就是让损失下降。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  训练循环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="训练循环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">前向</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">损失</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">反向/梯度</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">更新</text></svg>
```



前向计算 → 计算损失 → 反向传播求梯度 → 更新参数 → 循环（损失下降）。



表 5.1 训练五概念



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 激活 | 非线性 | 过饱和梯度消失 |
| 损失 | 衡量误差 | 与任务匹配 |
| 梯度下降 | 更新参数 | 学习率 |
| 学习率 | 步长 | 过大发散/过小慢 |
| 批大小 | 稳定性/显存 | 影响收敛 |



train.c 节选C

 

```text
for (int it = 0; it < 2000; it++) {
    double g = 2 * (w * x - y) * x;   // 梯度
    w -= 0.03 * g;                     // 梯度下降
}
```

前向→梯度→更新；学习率控制步长



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：梯度下降收敛



下面这段程序用梯度下降训练标量参数 w：



host\_train.cC

 

```text
/* host_train.c —— 梯度下降训练一个标量参数（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_train.c -o host_train && ./host_train
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 拟合 y=w x，样本 (1,2),(2,4),(3,6) → w→2；损失 MSE */
    double xs[]={1,2,3}, ys[]={2,4,6}; int n=3;
    double w=0, lr=0.03;
    for (int ep=0; ep<2000; ep++) {
        double g=0; for(int i=0;i<n;i++){ double e=w*xs[i]-ys[i]; g+=2*e*xs[i]; }
        g/=n; w -= lr*g;
    }
    printf("训练后 w=%.4f（期望 2.0000）\n", w);
    if (w<1.999||w>2.001) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
```

梯度下降模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_train.c -o labs/host_train && ./labs/host_train
训练后 w=2.0000（期望 2.0000）
RESULT: PASS
```



对 (1,2)(2,4)(3,6) 训练 w：lr=0.03、2000 轮收敛到 w=2.0000。



表 5.2 训练超参



| 超参 | 值 | 作用 |
| --- | --- | --- |
| 学习率 | 0.03 | 步长 |
| 轮数 | 2000 | 收敛 |
| 批大小 | — | 稳定性 |
| 损失 | MSE | 与任务匹配 |



```zhizhan-anchor
m05-lr
```



```zhizhan-anchor
m05-lr-t
```



## 5.3 学习率与批大小



训练核心是让损失稳定下降：学习率过大发散、过小太慢；配合验证集判断是否过拟合。



train.c 节选C

 

```text
for (int it = 0; it < 2000; it++) {
    double g = 2 * (w * x - y) * x;   // 梯度
    w -= 0.03 * g;                     // 梯度下降
}
/* 学习率过大发散、过小慢；用验证集判过拟合 */
```

前向→梯度→更新；学习率控制步长



表 5.3 训练现象与调整



| 现象 | 原因 | 调整 |
| --- | --- | --- |
| 损失发散 | 学习率过大 | 减小 lr |
| 收敛太慢 | 学习率过小 | 增大/调度 |
| 震荡 | lr/批大小 | 调参 |
| 训练好验证差 | 过拟合 | 正则/早停 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



训练自检：损失下降、学习率合适、有验证集、不发散。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  梯度下降收敛（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="梯度下降收敛（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">初值</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-box"></rect><text x="160" y="43" class="sv-lbl-hi">0(×10⁻³)</text><text x="12" y="67" class="sv-lbl">训练后</text><rect x="150" y="50" width="545" height="18" rx="4" class="sv-grn-s"></rect><text x="703" y="67" class="sv-lbl-hi">1000(×10⁻³)</text><text x="12" y="91" class="sv-lbl">期望 w=2</text><rect x="150" y="74" width="545" height="18" rx="4" class="sv-cyn-s"></rect><text x="703" y="91" class="sv-lbl-hi">1000(×10⁻³)</text></svg>
```



训练从初值收敛到 w=2.0000；损失随轮数下降。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 前向 | 算输出 | 公式错 |
| 梯度 | 反向传播 | 梯度错 |
| 更新 | 学习率 | 过大/小 |
| 验证 | 判过拟合 | 只看训练 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **学习率过大** ：损失发散。

- **过小** ：训练太慢/陷局部。

- **损失与任务不符** ：优化错目标。

- **不设验证集** ：过拟合。



◆ 自测 · Module 05（先答再看）




1. 梯度下降的“学习率”控制什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"每一步参数更新的步长。过大导致震荡/发散，过小导致收敛慢。常用学习率调度/自适应优化器改善。"}
   ```

2. 训练损失发散通常先怀疑什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"学习率过大。先减小学习率（或加梯度裁剪），再核对数据归一化与梯度计算是否正确。"}
   ```

3. 为什么必须设验证集？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用验证集判断是否过拟合、选超参。只用训练指标会导致过拟合而不自知，测试集又不该反复使用。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个小网络实现梯度下降训练，调学习率使损失稳定下降并用验证集监控。



核对与延伸：[PyTorch 基础教程](https://docs.pytorch.org/tutorials/beginner/basics/intro.html)

 

动手练习



运行 ` labs/host_train.c `：梯度下降训练标量参数 w→2。



**检查结果：** 梯度下降 2000 轮（lr=0.03）收敛到 w=2.0000。

 

迁移练习：把本章的“能实现前向/反向传播与梯度下降训练，并选合适学习率/批大小。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m05","criterion":"梯度下降 2000 轮（lr=0.03）收敛到 w=2.0000。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
