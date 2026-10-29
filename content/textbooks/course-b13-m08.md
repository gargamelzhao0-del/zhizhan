# 典型应用

```zhizhan-anchor
m08
```



端侧 AI 的典型任务各有特性：关键词唤醒重 **延迟与误唤醒** ，异常检测重 **漏报** ，姿态识别重 **精度与帧率** 。指标要按业务定。

 

> 前置：Module 04 的数据切分。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用混淆矩阵与业务阈值说明 precision/recall/F1 及漏报/误报的取舍。

 

本章速览




- 不同任务指标不同，按业务定。

- 用混淆矩阵讲清漏报/误报。

- 阈值是业务决策。

 

```zhizhan-anchor
m08-task
```



```zhizhan-anchor
m08-task-t
```



## 8.1 任务特性与关键指标



不同任务的指标侧重不同：关键词唤醒重延迟与误唤醒；异常检测重漏报（安全）；姿态识别重精度与帧率；预测性维护重提前量与准确。



表 8.1 任务与指标



| 任务 | 关键指标 | 权衡 |
| --- | --- | --- |
| 关键词唤醒 | 误唤醒率/延迟 | 灵敏 vs 误唤醒 |
| 异常检测 | 漏报/误报 | 安全 vs 打扰 |
| 姿态识别 | 精度/帧率 | 精度 vs 速度 |
| 预测性维护 | 提前量/准确 | 提前 vs 准确 |



metrics.c 节选C

 

```text
precision = (float)tp/(tp+fp);
recall    = (float)tp/(tp+fn);
f1 = 2*precision*recall/(precision+recall);
printf("FNrate=%.3f FPrate=%.3f\n", (float)fn/(fn+tp), (float)fp/(fp+tn));
```

混淆矩阵算 precision/recall/F1 与漏报/误报率



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：混淆矩阵指标



下面这段程序计算 precision/recall/F1 与漏报/误报率：



host\_metrics.cC

 

```text
/* host_metrics.c —— 分类指标：混淆矩阵 → precision/recall/F1（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_metrics.c -o host_metrics && ./host_metrics
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    /* TP=40 FP=10 FN=5 TN=45 */
    int TP=40, FP=10, FN=5, TN=45;
    float prec = (float)TP/(TP+FP);
    float rec = (float)TP/(TP+FN);
    float f1 = 2*prec*rec/(prec+rec);
    float acc = (float)(TP+TN)/(TP+FP+FN+TN);
    printf("precision=%.3f recall=%.3f F1=%.3f acc=%.3f\n", prec, rec, f1, acc);
    if (fabsf(prec-0.8f) > 1e-3 || fabsf(rec-0.8889f) > 1e-3) ok = 0;
    if (fabsf(f1-0.8421f) > 1e-3 || fabsf(acc-0.85f) > 1e-3) ok = 0;
    printf("漏报率(FN rate)=%.3f 误报率(FP rate)=%.3f（按业务权衡阈值）\n", (float)FN/(TP+FN), (float)FP/(FP+TN));
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

分类指标模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_metrics.c -o labs/host_metrics && ./labs/host_metrics
precision=0.800 recall=0.889 F1=0.842 acc=0.850
漏报率(FN rate)=0.111 误报率(FP rate)=0.182（按业务权衡阈值）
RESULT: PASS
```



混淆矩阵给出 precision/recall/F1 与漏报率/误报率；阈值调整是业务决策。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  混淆矩阵与指标



```zhizhan-figure
<svg viewBox="0 0 800 110" width="100%" height="110" role="img" aria-label="混淆矩阵与指标" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">预测正</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">预测负</text><text x="12" y="50" class="sv-lbl">实际正</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">TP</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">FN 漏报</text><text x="12" y="78" class="sv-lbl">实际负</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">FP 误报</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">TN</text></svg>
```



TP/FP/FN/TN 四格；precision=TP/(TP\+FP)、recall=TP/(TP\+FN)、漏报率=FN/(FN\+TP)、误报率=FP/(FP\+TN)。



```zhizhan-anchor
m08-thresh
```



```zhizhan-anchor
m08-thresh-t
```



## 8.3 业务阈值：漏报 vs 误报



阈值是业务决策：异常检测通常优先压低漏报（安全），关键词唤醒优先压低误唤醒（打扰）。用混淆矩阵讲清楚代价。



metrics.py 节选Python

 

```text
tp, fp, fn, tn = confusion(y, yhat)
precision = tp/(tp+fp); recall = tp/(tp+fn)
f1 = 2*precision*recall/(precision+recall)
print("FN rate", fn/(fn+tp), "FP rate", fp/(fp+tn))  # 按业务权衡阈值
```

用混淆矩阵算全套指标，按业务设阈值



表 8.4 阈值对指标的影响



| 阈值方向 | precision | recall | 漏报 | 误报 |
| --- | --- | --- | --- | --- |
| 更灵敏 | 降 | 升 | 少 | 多 |
| 更保守 | 升 | 降 | 多 | 少 |
| 平衡 | 中 | 中 | 中 | 中 |



表 8.2 按业务选阈值方向



| 业务 | 优先 | 阈值方向 |
| --- | --- | --- |
| 异常检测 | 压低漏报 | 更灵敏 |
| 关键词唤醒 | 压低误唤醒 | 更保守 |
| 姿态识别 | 平衡精度/帧率 | 中等 |
| 维护 | 提前量 | 按成本 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检与三级对照



指标自检：用混淆矩阵、报漏报/误报、阈值按业务、测端到端延迟。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  precision/recall/F1（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="precision/recall/F1（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">precision</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-cyn-s"></rect><text x="638" y="43" class="sv-lbl-hi">80%</text><text x="12" y="67" class="sv-lbl">recall</text><rect x="150" y="50" width="534" height="18" rx="4" class="sv-grn-s"></rect><text x="692" y="67" class="sv-lbl-hi">89%</text><text x="12" y="91" class="sv-lbl">F1</text><rect x="150" y="74" width="504" height="18" rx="4" class="sv-amb-s"></rect><text x="662" y="91" class="sv-lbl-hi">84%</text><text x="12" y="115" class="sv-lbl">acc</text><rect x="150" y="98" width="510" height="18" rx="4" class="sv-box"></rect><text x="668" y="115" class="sv-lbl-hi">85%</text></svg>
```



precision=0.800、recall=0.889、F1=0.842。三者要一起看，不能只看准确率。



表 8.3 三级任务指标



| 层级 | 任务 | 指标侧重 |
| --- | --- | --- |
| MCU 端 | 关键词/异常 | 延迟/漏报 |
| Linux 边缘 | 姿态/视觉 | 精度/帧率 |
| 云/训练 | 训练评估 | 全指标 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.4 常见误区与排障



失败路径与排障




- **只看准确率** ：类别不平衡时误导。

- **混淆漏报与误报** ：业务代价不同。

- **阈值拍脑袋** ：不按业务权衡。

- **不测端到端延迟** ：实时性失守。



◆ 自测 · Module 08（先答再看）




1. 异常检测中为什么“漏报率”常比“误报率”更重要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"漏报意味着真正的异常没被发现，后果可能是事故；误报只是打扰。所以要按业务后果设阈值，通常优先压低漏报。"}
   ```

2. 为什么“只看准确率”会误导？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"类别不平衡时，全靠预测多数类也能有高准确率。要看 precision/recall/F1 与漏报/误报率。"}
   ```

3. precision 和 recall 分别衡量什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"precision 衡量“报出来的有多准”（TP/(TP\\+FP)）；recall 衡量“真正例抓到了多少”（TP/(TP\\+FN)）。两者此消彼长，按业务取舍。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用混淆矩阵报告你模型的 precision/recall/F1 与漏报/误报率，并说明阈值是按什么业务定的。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_metrics.c `：计算 precision/recall/F1 与漏报/误报率。



**检查结果：** precision=0.800、recall=0.889、F1=0.842、acc=0.850；漏报率 0.111 与误报率 0.182 可区分。

 

迁移练习：把本章的“能用混淆矩阵与业务阈值说明 precision/recall/F1 及漏报/误报的取舍。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m08","criterion":"precision=0.800、recall=0.889、F1=0.842、acc=0.850；漏报率 0.111 与误报率 0.182 可区分。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
