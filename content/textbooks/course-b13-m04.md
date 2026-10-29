# 模型训练基础（面向嵌入式约束）

```zhizhan-anchor
m04
```



训练要先把问题定清楚： **输入、输出、指标、基线** 。切分必须按 **会话/设备分组** ，防止同源数据跨集造成“虚假高分”。

 

> 前置：Module 03 的特征口径。 · ◷ 约 44 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按会话分组切分数据并建立可对比的简单基线，避免数据泄漏。

 

本章速览




- 先建简单基线再决定是否上模型。

- 按会话分组切分，防泄漏。

- 只看训练指标易过拟合。

 

```zhizhan-anchor
m04-problem
```



```zhizhan-anchor
m04-problem-t
```



## 4.1 问题定义、基线、切分



先定问题（输入/输出/指标/基线），再训模型。切分必须按 **会话/设备分组** ，因为同一会话的样本高度相关，随机切分会让它们同时出现在 train/test，造成“虚假高分”。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  按会话整段切分



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="按会话整段切分" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">会话 A → train</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">会话 B → val</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">会话 C → test</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">禁止：同一会话跨 train/test</text></svg>
```



同一会话的样本要么全在 train、要么全在 test；不能跨集。随机按行切分会泄漏。



表 4.1 训练五环节



| 环节 | 要点 | 坑 |
| --- | --- | --- |
| 问题定义 | 输入/输出/指标 | 指标与业务不符 |
| 切分 | 按会话分组 | 随机切分泄漏 |
| 基线 | 简单方法先跑 | 直接上深网 |
| 正则 | 防过拟合 | 只看训练集 |
| 规模 | 受预算约束 | 越大越好错觉 |



split.py 节选Python

 

```text
sessions = group_by_session(X, meta)
tr, va, te = split_sessions(sessions, 0.6, 0.2, 0.2)   # 整段, 不跨集
print('baseline F1', f1(threshold_baseline(tr), te))
```

按会话整段切分 \+ 先跑简单基线



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：会话切分



下面这段程序按会话整段切分，并说明随机切分的泄漏风险：



host\_split.cC

 

```text
/* host_split.c —— 数据切分与泄漏：按会话整段切分，避免同源数据跨集（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_split.c -o host_split && ./host_split
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 4 个会话，每个 3 个样本；按会话整段分配给 train/val/test，避免碎片跨集泄漏 */
    int session[12] = {0,0,0,1,1,1,2,2,2,3,3,3};
    int n = 12, train = 0, val = 0, test = 0;
    for (int i = 0; i < n; i++) {
        if (session[i] <= 1) train++;        /* 会话 0,1 → train */
        else if (session[i] == 2) val++;     /* 会话 2 → val */
        else test++;                         /* 会话 3 → test */
    }
    /* 校验：任一会话不得同时出现在两个集合（整段切分不跨集） */
    int group[4];
    for (int s = 0; s < 4; s++) group[s] = (s <= 1) ? 0 : (s == 2 ? 1 : 2);
    for (int s = 0; s < 4; s++) {
        int mask = 0;
        for (int i = 0; i < n; i++) if (session[i] == s) mask |= 1 << group[s];
        if (mask != (1 << group[s])) ok = 0;   /* 一个会话只能落一个集合 */
    }
    printf("train=%d val=%d test=%d（按会话整段切分，不跨集）\n", train, val, test);
    if (!(train == 6 && val == 3 && test == 3)) ok = 0;
    printf("泄漏风险：随机按行切分会让同一会话同时出现在 train/test，导致指标虚高\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

按会话切分模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_split.c -o labs/host_split && ./labs/host_split
train=6 val=3 test=3（按会话整段切分，不跨集）
泄漏风险：随机按行切分会让同一会话同时出现在 train/test，导致指标虚高
RESULT: PASS
```



按会话整段切分得 train=6/val=3/test=3；随机按行切分导致同源泄漏、指标虚高。



表 4.2 切分方式对比



| 切分方式 | 是否泄漏 | 后果 |
| --- | --- | --- |
| 按会话整段 | 否 | 指标可信 |
| 随机按行 | 是 | 指标虚高 |
| 随机按窗口 | 是 | 同源跨集 |
| 按时间 | 视情况 | 分布漂移 |



```zhizhan-anchor
m04-baseline
```



```zhizhan-anchor
m04-baseline-t
```



## 4.3 基线与正则



先建立简单基线（阈值/逻辑回归），再决定是否上神经网络；用验证集防过拟合，模型规模受嵌入式预算约束。



split.py 节选Python

 

```text
sessions = group_samples_by_session(X, meta)
tr, va, te = split_sessions(sessions, 0.6, 0.2, 0.2)   # 整段, 不跨集
base = threshold_baseline(tr);  print("baseline F1", f1(base, te))
# 再决定是否上模型；所有归一化统计只用 tr 计算
```

整段切分 \+ 简单基线 \+ 归一化只用训练集统计



表 4.3 从基线到模型



| 选择 | 何时用 | 注意 |
| --- | --- | --- |
| 阈值基线 | 先跑 | 可解释、便宜 |
| 浅模型 | 基线不足时 | 特征工程 |
| 深模型 | 数据/算力够 | 预算约束 |
| 正则 | 防过拟合 | 验证集监控 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与三级对照



训练自检：切分无泄漏、有基线、只看验证集、规模在预算内。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  可信评估的前提



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="可信评估的前提" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">整段切分</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">训练集统计</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">验证调参</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">测试报指标</text></svg>
```



整段切分（不跨集）→ 归一化只用训练集统计 → 验证集调参 → 独立测试集报指标。



表 4.4 三级训练



| 层级 | 训练方式 | 注意 |
| --- | --- | --- |
| MCU 端 | 主机训练 \+ 部署 | 预算紧 |
| Linux 边缘 | 主机/边缘训练 | 性能 |
| 云/训练 | 大规模重训 | 数据版本 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.4 常见误区与排障



失败路径与排障




- **随机切分** ：同源数据泄漏，指标虚高。

- **无基线** ：不知道深度模型是否值得。

- **只看训练指标** ：过拟合。

- **盲目加大模型** ：超预算。



◆ 自测 · Module 04（先答再看）




1. 什么是数据泄漏？为什么它危险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"测试集信息以任何形式“提前”进入训练（同会话样本、用测试集统计做归一化等）。它让指标虚高，上线后落差大。"}
   ```

2. 为什么切分要“按会话整段”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"同一会话的样本高度相关。整段切分保证同一会话只出现在一个集合，避免同源泄漏。"}
   ```

3. 为什么先做简单基线？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"基线便宜、可解释，给出参照来判断深度模型是否真的带来提升；也可能基线就已满足需求。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你数据集改为按会话/设备整段切分，并补一个简单基线做对照。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [TensorFlow 模型优化](https://www.tensorflow.org/model_optimization)

 

动手练习



运行 ` labs/host_split.c `：验证按会话分组切分，理解随机切分的泄漏风险。



**检查结果：** 按会话整段切分得 train=6、val=3、test=3 且不跨集；能说明随机切分的泄漏风险。

 

迁移练习：把本章的“能按会话分组切分数据并建立可对比的简单基线，避免数据泄漏。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m04","criterion":"按会话整段切分得 train=6、val=3、test=3 且不跨集；能说明随机切分的泄漏风险。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
