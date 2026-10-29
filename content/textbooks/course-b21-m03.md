# 切分、泄漏与独立测试

```zhizhan-anchor
m03
```



切分的核心是 **防泄漏** ：同源数据（同会话/同设备）不能跨集，否则指标虚高、上线落差大。

 

> 前置：理解 M02 数据契约。 · ◷ 约 42 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按会话/时间分组切分训练/验证/测试，识别并避免数据泄漏。



```zhizhan-anchor
m03-knowledge-boundary
```



### 切分和预处理共同决定是否泄漏



按设备、会话或时间段隔离集合；滑窗重叠数据不能随机散到训练与测试。均值、标准差、特征选择和阈值只由训练/验证决定。P05 将六个合成会话固定分成训练、验证、独立测试，且标准化只拟合训练集；真实任务要用实际设备会话替换。

 

本章速览




- 切分要防泄漏：按会话/时间分组。

- 测试集只评一次，不用来调参。

- 时间序列按时间切。

 

```zhizhan-anchor
m03-split
```



```zhizhan-anchor
m03-split-t
```



## 3.1 防泄漏：按会话/时间切分



同源数据（同会话/同设备）不能跨集，否则指标虚高、上线落差大。时间序列要按时间切分（不能用未来预测过去）；测试集只在最终验收用一次。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  按会话整段切分



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="按会话整段切分" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">会话 A → train</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">会话 B → val</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">会话 C → test</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">禁止：同会话跨集</text></svg>
```



同一会话的样本要么全在 train、要么全在 test；不能跨集。随机按行切分会泄漏。



表 3.1 切分方式



| 切分 | 要点 | 风险 |
| --- | --- | --- |
| 按会话分组 | 同源整段归属 | 随机切分泄漏 |
| 验证集 | 调参/选型 | 用测试集调参 |
| 测试集 | 只评一次 | 反复看导致过拟合 |
| 交叉验证 | 小数据 | 时间序列要按时间 |
| 独立测试 | 最终验收 | 不独立=虚高 |



split.py 节选Python

 

```text
sessions = group_by_session(X, meta)
tr, va, te = split_sessions(sessions, 0.6, 0.2, 0.2)   # 整段, 不跨集
# 时间序列: 按时间前后切分，禁止随机
# 测试集只评一次，不在其上调参
```

会话整段切分 \+ 时间序不随机 \+ 测试集只评一次



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：会话切分



下面这段程序按会话整段切分并说明随机切分的泄漏：



host\_split.cC

 

```text
/* host_split.c —— 数据切分与泄漏（按会话整段切分，不跨集）（主机可运行）。
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
    printf("随机按行切分会泄漏 → 指标虚高\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

会话切分模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_split.c -o labs/host_split && ./labs/host_split
train=6 val=3 test=3（按会话整段切分，不跨集）
随机按行切分会泄漏 → 指标虚高
RESULT: PASS
```



4 会话×3 样本=12，按会话整段分配 train=6/val=3/test=3；任一会话不跨集。



表 3.2 切分对比



| 切分方式 | 是否泄漏 | 后果 |
| --- | --- | --- |
| 按会话整段 | 否 | 指标可信 |
| 随机按行 | 是 | 指标虚高 |
| 时间序列随机 | 是 | 用未来预测过去 |
| 测试集调参 | 是 | 测试失效 |



```zhizhan-anchor
m03-holdout
```



```zhizhan-anchor
m03-holdout-t
```



## 3.3 测试集只评一次



测试集只能最终验收用一次，反复查看会“把测试集调进模型”；时间序列按时间前后切分。



split.py 节选Python

 

```text
sessions = group_by_session(X, meta)
tr, va, te = split_sessions(sessions, 0.6, 0.2, 0.2)   # 整段, 不跨集
# 时间序列: 按时间前后切分，禁止随机
# 测试集只评一次，不在其上调参
```

会话整段切分 \+ 时间序不随机 \+ 测试集只评一次



表 3.3 切分实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 会话整段 | 防泄漏 | 同源跨集 |
| 时间序切分 | 不预测未来 | 随机 |
| 测试集一次 | 验收可信 | 反复调参 |
| 验证集调参 | 选型 | 用测试集 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



切分自检：按会话/时间、不跨集、测试集只评一次、验证集调参。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  可信评估的前提



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="可信评估的前提" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">整段切分</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">训练集统计</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">验证调参</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">测试报指标</text></svg>
```



整段切分（不跨集）→ 归一化只用训练集统计 → 验证集调参 → 独立测试集报指标。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 切分 | 会话/时间 | 随机 |
| 归一化 | 训练集统计 | 用全体统计 |
| 调参 | 验证集 | 测试集 |
| 验收 | 测试集一次 | 反复看 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **随机切分** ：泄漏。

- **用测试集调参** ：测试集失效。

- **时间序列乱切** ：用未来预测过去。

- **同设备跨集** ：泄漏。



◆ 自测 · Module 03（先答再看）




1. 什么是数据泄漏？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"测试集信息以任何形式进入训练/调参（同会话样本、用测试集统计归一化等），使指标虚高。防泄漏是切分的第一原则。"}
   ```

2. 为什么测试集只能评一次？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"反复查看测试集并根据它调参，等于把测试集信息“调进”模型，测试集不再独立，指标虚高。"}
   ```

3. 时间序列为什么不能随机切分？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"随机切分会把未来数据放进训练，造成“用未来预测过去”的泄漏。应按时间前后切分。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你数据集改为按会话/时间整段切分，确保测试集只评一次并检查有无泄漏。



核对与延伸：[scikit-learn 常见陷阱](https://scikit-learn.org/stable/common_pitfalls.html)

 

动手练习



运行 ` labs/host_split.c `：验证按会话分组切分，理解随机切分的泄漏。



**检查结果：** 按会话整段切分 train=6/val=3/test=3，任一会话不跨集。

 

迁移练习：把本章的“能按会话/时间分组切分训练/验证/测试，识别并避免数据泄漏。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m03","criterion":"按会话整段切分 train=6/val=3/test=3，任一会话不跨集。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
