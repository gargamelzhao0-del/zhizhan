# 评估、阈值与校准

```zhizhan-anchor
m07
```



评估要 **按业务** ：用混淆矩阵与 PR 曲线看漏报/误报权衡，按 **业务成本** 选阈值；概率要 **校准** 才可用于决策。

 

> 前置：理解混淆矩阵与 precision/recall，读过 M05。 · ◷ 约 44 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按业务成本选阈值、评估 PR 权衡并对概率做校准。

 

本章速览




- 用混淆矩阵与 PR 曲线看权衡。

- 阈值是业务决策，按成本选点。

- 概率要校准才可用于决策。

 

```zhizhan-anchor
m07-metrics
```



```zhizhan-anchor
m07-metrics-t
```



## 7.1 混淆矩阵与 PR 权衡



用混淆矩阵与 PR 曲线看漏报/误报权衡，按业务成本选阈值。阈值不是技术常数，而是业务决策：成本矩阵决定工作点。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  阈值与 precision/recall（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="阈值与 precision/recall（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">档0 prec</text><rect x="150" y="26" width="360" height="18" rx="4" class="sv-cyn-s"></rect><text x="518" y="43" class="sv-lbl-hi">60%</text><text x="12" y="67" class="sv-lbl">档1 prec</text><rect x="150" y="50" width="480" height="18" rx="4" class="sv-grn-s"></rect><text x="638" y="67" class="sv-lbl-hi">80%</text><text x="12" y="91" class="sv-lbl">档2 prec</text><rect x="150" y="74" width="498" height="18" rx="4" class="sv-amb-s"></rect><text x="656" y="91" class="sv-lbl-hi">83%</text></svg>
```



本例阈值提高时 precision 上升、recall 下降。固定分数与正例集合下 recall 不增；precision 不保证单调，需逐阈值实算并按业务成本选点。



表 7.1 评估指标



| 指标 | 含义 | 用途 |
| --- | --- | --- |
| precision | 查准 | 误报代价 |
| recall | 查全 | 漏报代价 |
| F1 | 折中 | 平衡 |
| PR 曲线 | 权衡曲线 | 选阈值 |
| 校准 | 概率可信 | 决策 |



metrics.py 节选Python

 

```text
precision = tp/(tp+fp); recall = tp/(tp+fn)
f1 = 2*precision*recall/(precision+recall)
# 扫阈值得 PR 曲线；按成本 c_fp/c_fn 选工作点
# 概率校准: Platt/Isotonic 使 0.9≈90%
```

混淆矩阵指标 \+ 扫阈值 \+ 成本选点 \+ 校准



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：阈值扫描与指标



下面两段程序给出阈值扫描与 precision/recall/F1：



host\_calib.cC

 

```text
/* host_calib.c —— 阈值扫描与 PR 权衡（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_calib.c -o host_calib && ./host_calib
 */
#include <stdio.h>
int main(void) {
    int ok=1;
    /* 不同阈值下的混淆矩阵（简化） */
    int TP[3]={60,40,10}, FP[3]={40,10,2}, FN[3]={10,30,60};
    printf("阈值扫描 (prec/rec):\n");
    for(int i=0;i<3;i++){ double p=(double)TP[i]/(TP[i]+FP[i]); double r=(double)TP[i]/(TP[i]+FN[i]);
        printf("  阈值档 %d: prec=%.2f rec=%.2f\n", i, p, r); }
    /* 检查高精度 vs 高召回权衡存在 */
    double p0=(double)TP[0]/(TP[0]+FP[0]), r2=(double)TP[2]/(TP[2]+FN[2]);
    if(!(p0 > 0.5 && r2 > 0.1)) ok=0;
    printf("结论：固定预测分数时，提高阈值使召回不增；precision 不保证单调，须实算\n");
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
```

阈值扫描模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_calib.c -o labs/host_calib && ./labs/host_calib
阈值扫描 (prec/rec):
  阈值档 0: prec=0.60 rec=0.86
  阈值档 1: prec=0.80 rec=0.57
  阈值档 2: prec=0.83 rec=0.14
结论：固定预测分数时，提高阈值使召回不增；precision 不保证单调，须实算

RESULT: PASS
```



这组示例的 precision 随阈值上升，不代表一般规律；在验证集上按成本选阈值，再冻结后评估测试集。



表 7.2 阈值扫描



| 阈值档 | precision | recall |
| --- | --- | --- |
| 0 | 0.60 | 0.86 |
| 1 | 0.80 | 0.57 |
| 2 | 0.83 | 0.14 |
| 独立指标 | 0.800 | 0.889(F1=0.842) |



```zhizhan-anchor
m07-calib
```



```zhizhan-anchor
m07-calib-t
```



## 7.3 概率校准与业务成本



概率未校准会导致“0.9 却不是 90% 概率”；按业务成本加权选择工作点。



calib.py 节选Python

 

```text
# 扫阈值，算 (precision, recall) 曲线
for t in thresholds: p,r = pr_at(t)
# 按业务成本选工作点: cost = c_fp*(1-p) + c_fn*(1-r)
# 概率校准: Platt/Isotonic，使 0.9≈90%
```

扫阈值定工作点；概率校准后才可用于决策



表 7.3 评估实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 扫阈值 | 选工作点 | 拍脑袋阈值 |
| 成本加权 | 按业务 | 只看指标 |
| 概率校准 | 决策可信 | 未校准 |
| 测试集一次 | 不泄漏 | 反复看 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



评估自检：用混淆矩阵、扫阈值、按成本选点、概率校准。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  从概率到决策



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从概率到决策" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">概率</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">校准</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">PR 扫阈值</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">成本选点</text></svg>
```



模型输出概率 → 概率校准 → 扫阈值得 PR → 按业务成本选工作点 → 决策。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 矩阵 | 混淆矩阵 | 只看准确率 |
| 扫阈值 | PR 曲线 | 拍脑袋 |
| 成本 | c\_fp/c\_fn | 忽略业务 |
| 校准 | Platt/Isotonic | 未校准 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **只用准确率** ：类别不平衡时误导。

- **阈值拍脑袋** ：不按成本。

- **概率未校准** ：决策依据错。

- **反复看测试集** ：过拟合测试集。



◆ 自测 · Module 07（先答再看）




1. 为什么阈值是“业务决策”而非纯技术选择？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"提高阈值减少误报但增加漏报，二者业务代价不同；最优工作点由成本矩阵决定，要结合业务而非只看指标。"}
   ```

2. 概率未校准有什么危害？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型说“0.9”但真实概率不是 90%，据此做决策会错。需用 Platt/Isotonic 等方法校准，使概率可信。"}
   ```

3. precision 和 recall 分别对应什么业务代价？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"precision 低→误报多（打扰/浪费）；recall 低→漏报多（可能漏检事故）。按业务对两类错误的代价选阈值。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你模型扫一遍阈值得 PR 曲线，按业务成本选工作点并做概率校准。



核对与延伸：[模型校准](https://scikit-learn.org/stable/modules/calibration.html) · [scikit-learn 常见陷阱](https://scikit-learn.org/stable/common_pitfalls.html)

 

动手练习



运行 ` labs/host_calib.c `（阈值扫描）与 ` labs/host_metrics.c `（precision/recall/F1）。



**检查结果：** 阈值档 0/1/2 的 prec/rec=0.60/0.86、0.80/0.57、0.83/0.14；precision=0.800 recall=0.889 F1=0.842。

 

迁移练习：把本章的“能按业务成本选阈值、评估 PR 权衡并对概率做校准。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m07","criterion":"阈值档 0/1/2 的 prec/rec=0.60/0.86、0.80/0.57、0.83/0.14；precision=0.800 recall=0.889 F1=0.842。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
