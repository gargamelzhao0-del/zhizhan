# 数据采集与工程

```zhizhan-anchor
m02
```



模型的上限由数据决定。数据工程要管住 **契约（单位/量程/采样率）、质量（时间戳/丢样）、标注一致性、版本与可回放** 。

 

> 前置：Module 01 的算力预算。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能定义数据契约（单位/量程/采样率）并保证数据可确定性回放。

 

本章速览




- 数据契约（单位/量程/采样率）必须明确。

- 记录质量标志，坏数据不进训练。

- 数据要能确定性回放。

 

```zhizhan-anchor
m02-contract
```



```zhizhan-anchor
m02-contract-t
```



## 2.1 数据契约与质量



数据工程要管住：契约（单位/量程/采样率）、质量（时间戳/丢样/重复）、标注一致性、版本与可回放。没有数据契约的后果是“训练很好、现场不对”。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  数据工程的四个关卡



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="数据工程的四个关卡" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">契约：单位/量程/采样率</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">质量：时间戳/丢样/重复</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">标注：一致性/边界</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">版本 + 确定性回放</text></svg>
```



契约（单位/量程/采样率）→ 质量（时间戳/丢样）→ 标注一致 → 版本/回放。任一关失守，模型上限被拉低。



表 2.1 数据工程五要素



| 要素 | 内容 | 风险 |
| --- | --- | --- |
| 契约 | 单位/量程/采样率 | 单位错导致全错 |
| 质量 | 时间戳/丢样/重复 | 训练被污染 |
| 标注 | 一致性/边界 | 标签噪声 |
| 版本 | 数据\+预处理版本 | 不可复现 |
| 回放 | 确定性重放 | 无法定位 |



contract.h 节选C

 

```text
typedef struct { const char *unit; float range[2]; uint32_t fs_hz; } data_contract_t;
data_contract_t C = { "g", {-16,16}, 200 };   // 单位/量程/采样率
/* 每条样本另带 timestamp 与 quality_flag */
```

把单位/量程/采样率写成契约，训练与现场一致



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：特征口径一致



下面这段程序计算时域特征（数值均为同一量纲），用于核对训练与推理口径：



host\_feature.cC

 

```text
/* host_feature.c —— 时域特征：均值/去直流 RMS/峰值/峰峰值（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_feature.c -o host_feature && ./host_feature
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    float x[] = {1,2,3,4,5,6,7,8};
    int n = (int)(sizeof(x)/sizeof(x[0]));
    float sum = 0; for (int i = 0; i < n; i++) sum += x[i];
    float mean = sum / n;
    float ac = 0, peak = 0, vmin = x[0], vmax = x[0];
    for (int i = 0; i < n; i++) {
        float d = x[i]-mean; ac += d*d;
        float a = fabsf(d); if (a > peak) peak = a;
        if (x[i] < vmin) vmin = x[i];
        if (x[i] > vmax) vmax = x[i];
    }
    float rms = sqrtf(ac/n);
    float pp = vmax - vmin;            /* 峰峰值由数据计算，不是硬编码 */
    printf("mean=%.2f rms(ac)=%.3f peak=%.2f peak-peak=%.1f\n", mean, rms, peak, pp);
    if (fabsf(mean-4.5f) > 1e-4) ok = 0;
    if (fabsf(rms - 2.2913f) > 1e-3) ok = 0;   /* 去直流后 RMS = sqrt(5.25)=2.2913 */
    if (fabsf(peak-3.5f) > 1e-4) ok = 0;
    if (fabsf(pp-7.0f) > 1e-4) ok = 0;         /* max-min = 8-1 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时域特征计算（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_feature.c -o labs/host_feature && ./labs/host_feature
mean=4.50 rms(ac)=2.291 peak=3.50 peak-peak=7.0
RESULT: PASS
```



mean/ac-RMS/peak/peak-peak 口径固定；训练与推理必须用同一口径，否则特征分布偏移。



表 2.2 时域特征口径



| 特征 | 公式 | 口径 |
| --- | --- | --- |
| mean | Σx/N | 含直流 |
| rms(ac) | √(Σ(x-mean)²/N) | 去直流 |
| peak | max\|x-mean\| | 去直流 |
| peak-peak | max-min | 原始 |



```zhizhan-anchor
m02-replay
```



```zhizhan-anchor
m02-replay-t
```



## 2.2 质量标志与确定性回放



每条数据要带质量标志（时间戳、丢样、重复），坏数据不进训练集。数据要能被确定性回放，才能复现实验与回归。



contract.json 节选JSON

 

```text
{ "unit": "g", "range": [-16, 16], "fs_hz": 200,
  "timestamp": "monotonic_us", "quality_flag": ["ok","drop","dup"],
  "preproc_version": "pp-1.3", "seed": 42 }
```

把单位/量程/采样率/时间戳/质量标志/预处理版本写进契约



表 2.3 数据质量与回放



| 做法 | 目的 | 注意 |
| --- | --- | --- |
| 质量标志 | 过滤坏数据 | 丢样要标记 |
| 确定性回放 | 可复现/回归 | 固定随机种子 |
| 版本记录 | 数据\+预处理 | 一起管理 |
| 标注规范 | 一致/边界 | 多人一致 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.3 自检与三级对照



数据自检：契约明确、质量可筛、可确定性回放。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  数据问题对模型上限的影响（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="数据问题对模型上限的影响（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">契约正确</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-grn-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(相对上限)</text><text x="12" y="67" class="sv-lbl">有噪声</text><rect x="150" y="50" width="382" height="18" rx="4" class="sv-amb-s"></rect><text x="540" y="67" class="sv-lbl-hi">70(相对上限)</text><text x="12" y="91" class="sv-lbl">契约错</text><rect x="150" y="74" width="109" height="18" rx="4" class="sv-red-s"></rect><text x="267" y="91" class="sv-lbl-hi">20(相对上限)</text></svg>
```



契约错/标注噪声/泄漏都会拉低上限；数据问题无法靠换模型弥补。



表 2.4 三级数据来源



| 层级 | 数据来源 | 注意 |
| --- | --- | --- |
| MCU 端 | 传感器流 | 量程/采样率 |
| Linux 边缘 | 文件/网络 | 时间戳对齐 |
| 云/训练 | 汇总数据集 | 版本与隐私 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.4 常见误区与排障



失败路径与排障




- **无数据契约** ：训练与现场口径不一致。

- **不记质量标志** ：坏数据进训练集。

- **标注不一致** ：标签噪声拉低上限。

- **不可回放** ：无法复现与回归。



◆ 自测 · Module 02（先答再看）




1. 为什么“数据可确定性回放”很重要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它让实验结果可复现、差分可比较、回归可自动。否则每次结果不同，无法判断是模型改动还是数据变化导致。"}
   ```

2. “训练很好、现场不对”最常见的原因是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"现场数据的单位/量程/采样率与训练不同（缺少数据契约）。特征口径不一致会让输入分布偏移。"}
   ```

3. 质量标志（时间戳/丢样/重复）为什么重要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"坏数据进入训练集会污染标签与分布；用质量标志过滤，保证训练数据干净。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目写一份数据契约（单位/量程/采样率/时间戳/质量标志/预处理版本），并确保可回放。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [CMSIS-NN](https://arm-software.github.io/CMSIS-NN/)

 

动手练习



运行 ` labs/host_feature.c `：计算均值/去直流 RMS/峰值，验证特征口径一致。



**检查结果：** mean=4.50、ac-RMS=2.291、peak=3.50、peak-peak=7.0；训练与推理口径一致。

 

迁移练习：把本章的“能定义数据契约（单位/量程/采样率）并保证数据可确定性回放。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m02","criterion":"mean=4.50、ac-RMS=2.291、peak=3.50、peak-peak=7.0；训练与推理口径一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
