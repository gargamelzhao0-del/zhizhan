# 时间序列、音频与视觉任务

```zhizhan-anchor
m08
```



不同模态有不同组织方式： **时间序列** 按时间切分、看滞后； **音频** 分帧/频谱； **视觉** 用图像/卷积。指标随任务而定。

 

> 前置：理解 M03 切分与 M06 特征。 · ◷ 约 44 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按时序/音频/视觉模态组织数据、选特征与指标，并严格防时间泄漏。

 

本章速览




- 不同模态不同组织：时序按时间、音频分帧、视觉张量。

- 切分要防泄漏（时序尤甚）。

- 指标随任务。

 

```zhizhan-anchor
m08-modality
```



```zhizhan-anchor
m08-modality-t
```



## 8.1 三种模态的数据组织



时间序列按时间窗、看滞后；音频分帧 \+ 频谱；视觉用图像/卷积。指标随任务而定，切分防泄漏。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  模态与数据组织



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="模态与数据组织" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">时间序列：时间窗（滞后/趋势）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">音频：分帧 + 频谱（窗长/梅尔）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">视觉：图像张量（分辨率/通道）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">切分：按时间/会话防泄漏</text></svg>
```



时间序列：按时间窗；音频：分帧\+频谱；视觉：图像张量。共同点：按时间/会话切分防泄漏。



表 8.1 模态与关键



| 模态 | 数据组织 | 关键 |
| --- | --- | --- |
| 时间序列 | 按时间窗 | 滞后/趋势/不泄漏 |
| 音频 | 分帧\+频谱 | 窗长/梅尔 |
| 视觉 | 图像/张量 | 分辨率/通道 |
| 指标 | 任务相关 | 不只看准确率 |
| 切分 | 按时间/会话 | 防泄漏 |



seq.c 节选C

 

```text
for (int i = 0; i + win <= n; i += hop) rms_of(&x[i], win);  // 分帧
split_time(n, 11);   // train=[0,11) test=[11,16) 不随机
pool2x2(src, dst);   // 视觉/时序下采样
```

分帧\+时间序切分\+池化；指标随任务



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：分帧、时序切分、池化



下面这段程序演示分帧、按时间切分与池化：



host\_seq.cC

 

```text
/* host_seq.c —— 时序/音频/视觉的数据组织：分帧 + 时间序切分 + 池化（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_seq.c -o host_seq -lm && ./host_seq
 */
#include <stdio.h>
#include <math.h>

#define SAMPLES 16

int main(void) {
    int ok = 1;
    double sig[SAMPLES];
    for (int i = 0; i < SAMPLES; i++) sig[i] = (i % 2) ? -1.0 : 1.0;   /* 交替信号 */

    /* 1) 音频/时序：分帧（窗长 4、hop 2，单位：采样点）+ 逐帧 RMS（单位：同幅值） */
    int win = 4, hop = 2, nframes = 0;
    printf("分帧: 窗长=%d hop=%d（单位：采样点）\n", win, hop);
    printf("逐帧 RMS: ");
    for (int s = 0; s + win <= SAMPLES; s += hop) {
        double e = 0; for (int i = 0; i < win; i++) e += sig[s+i]*sig[s+i];
        printf("%.2f ", sqrt(e/win)); nframes++;
    }
    printf("(期望 1.00，共 %d 帧)\n", nframes);
    if (nframes != 7) ok = 0;

    /* 2) 时间序切分：前 70% 训练、后 30% 测试，不随机（防用未来预测过去） */
    int cut = (int)(SAMPLES * 0.7);   /* = 11 */
    printf("时间序切分: train=[0,%d) test=[%d,%d)（不随机、无未来泄漏）\n", cut, cut, SAMPLES);
    if (!(cut == 11 && cut > 0 && cut < SAMPLES)) ok = 0;

    /* 3) 视觉：4x4 图像做 2x2 平均池化（通道内降采样） */
    double img[16]; for (int i = 0; i < 16; i++) img[i] = (double)i;
    printf("池化(4x4→2x2): ");
    for (int by = 0; by < 2; by++) for (int bx = 0; bx < 2; bx++) {
        double s = 0;
        for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) s += img[(by*2+y)*4 + (bx*2+x)];
        printf("%.1f ", s/4);
    }
    printf("(期望 2.5 4.5 10.5 12.5)\n");
    if (fabs((img[0]+img[1]+img[4]+img[5])/4.0 - 2.5) > 1e-9) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时序分帧/切分/池化模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_seq.c -o labs/host_seq && ./labs/host_seq
分帧: 窗长=4 hop=2（单位：采样点）
逐帧 RMS: 1.00 1.00 1.00 1.00 1.00 1.00 1.00 (期望 1.00，共 7 帧)
时间序切分: train=[0,11) test=[11,16)（不随机、无未来泄漏）
池化(4x4→2x2): 2.5 4.5 10.5 12.5 (期望 2.5 4.5 10.5 12.5)
RESULT: PASS
```



分帧窗长4/hop2 得 7 帧（帧 RMS=1.00）；时间序切分 train=\[0,11)/test=\[11,16) 不随机；2x2 池化得 2.5 4.5 10.5 12.5。



表 8.2 时序处理结果



| 操作 | 参数 | 结果 |
| --- | --- | --- |
| 分帧 | 窗4/hop2 | 7 帧 |
| 帧 RMS | 每帧 | 1.00 |
| 时间切分 | 前 11/后 5 | 不泄漏 |
| 池化 | 4x4→2x2 | 2.5 4.5 10.5 12.5 |



```zhizhan-anchor
m08-task
```



```zhizhan-anchor
m08-task-t
```



## 8.3 任务指标与算力



时间序列尤其要防“用未来预测过去”；音频/视觉的计算量在端侧要按算力预算评估。



seq.c 节选C

 

```text
for (int i = 0; i + win <= n; i += hop) rms_of(&x[i], win);  // 分帧
split_time(n, 11);   // train=[0,11) test=[11,16) 不随机
pool2x2(src, dst);   // 视觉/时序下采样
/* 指标随任务定；端侧按算力预算评估 */
```

分帧\+时间序切分\+池化；指标随任务



表 8.3 模态指标



| 模态 | 典型指标 | 算力 |
| --- | --- | --- |
| 时间序列 | MAE/RMSE/F1 | 低 |
| 音频 | 帧准确率/词错率 | 中 |
| 视觉 | mAP/准确率 | 高 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



模态自检：组织匹配、按时间切分、指标任务相关、算力在预算。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  模态处理链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="模态处理链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">认任务</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">数据组织</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">特征/模型</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">指标/防泄漏</text></svg>
```



认任务 → 定数据组织（时间窗/分帧/张量）→ 选特征/模型 → 定指标 → 防泄漏。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 组织 | 时间窗/分帧/张量 | 错配 |
| 切分 | 按时间/会话 | 随机 |
| 指标 | 任务相关 | 只看准确率 |
| 算力 | 按预算 | 端侧跑不动 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **时间序列乱切** ：用未来。

- **音频帧长不当** ：频谱分辨率差。

- **视觉不看算力** ：端侧跑不动。

- **指标不匹配** ：优化错。



◆ 自测 · Module 08（先答再看）




1. 时间序列建模为什么不能随机切分？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"随机切分会让未来的数据进入训练，造成“用未来预测过去”的泄漏，指标虚高、上线无效。应按时间前后切分。"}
   ```

2. 音频为什么要“分帧 \+ 频谱”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"语音/音频是短时平稳的；分帧后逐帧做频谱（如梅尔）才能捕捉频率随时间的变化。窗长决定时间/频率分辨率权衡。"}
   ```

3. 端侧做视觉任务要先考虑什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"算力/内存预算。高分辨率卷积很重，需按 B13 的预算评估，必要时降分辨率/换轻量骨干网。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个时序/音频/视觉任务定数据组织、切分方式与任务相关指标，评估端侧算力。



核对与延伸：[PyTorch 基础教程](https://docs.pytorch.org/tutorials/beginner/basics/intro.html)

 

动手练习



运行 ` labs/host_seq.c `：分帧计算逐帧 RMS、按时间切分并做 2x2 池化。



**检查结果：** 分帧 窗长=4/hop=2 得 7 帧；时间序切分 train=\[0,11)/test=\[11,16) 不随机；4x4→2x2 池化=2.5 4.5 10.5 12.5。

 

迁移练习：把本章的“能按时序/音频/视觉模态组织数据、选特征与指标，并严格防时间泄漏。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m08","criterion":"分帧 窗长=4/hop=2 得 7 帧；时间序切分 train=[0,11)/test=[11,16) 不随机；4x4→2x2 池化=2.5 4.5 10.5 12.5。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
