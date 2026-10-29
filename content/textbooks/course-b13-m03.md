# 特征工程与信号处理

```zhizhan-anchor
m03
```



特征把原始信号变成“模型能学且算得起”的形式：要同时考虑 **区分度与计算成本** ，并保证训练与推理的 **特征口径完全一致** 。

 

> 前置：Module 02 的数据契约。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能选一组兼顾区分度与计算成本的特征，并让训练与推理口径完全一致。

 

本章速览




- 特征要兼顾区分度与计算成本。

- 训练与推理特征/归一化必须一致。

- 流式特征要维护窗口状态。

 

```zhizhan-anchor
m03-feat
```



```zhizhan-anchor
m03-feat-t
```



## 3.1 特征：区分度 × 计算成本



特征选择的两个轴： **区分度** （能不能分开）与 **计算成本** （算不算得起）。时域特征便宜、频域贵但强；窗口/归一化必须与训练一致。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  特征的区分度与成本（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="特征的区分度与成本（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">峰峰/峭度</text><rect x="150" y="26" width="420" height="18" rx="4" class="sv-grn-s"></rect><text x="578" y="43" class="sv-lbl-hi">70(区分度)</text><text x="12" y="67" class="sv-lbl">分窗统计</text><rect x="150" y="50" width="330" height="18" rx="4" class="sv-cyn-s"></rect><text x="488" y="67" class="sv-lbl-hi">55(区分度)</text><text x="12" y="91" class="sv-lbl">FFT/PSD</text><rect x="150" y="74" width="270" height="18" rx="4" class="sv-amb-s"></rect><text x="428" y="91" class="sv-lbl-hi">45(区分度)</text></svg>
```



峰峰值/峭度对冲击区分度高且便宜；FFT/PSD 区分度高但成本中高。按预算取舍。



表 3.1 特征取舍



| 特征 | 区分度 | 成本 |
| --- | --- | --- |
| 均值/RMS | 中 | 低 |
| 峰峰值/峭度 | 高（冲击） | 低 |
| FFT/PSD | 高（周期） | 中高 |
| 过零率 | 中 | 低 |
| 分窗统计 | 高 | 中 |



feat.c 节选C

 

```text
feat.mean = mean(x, N);
feat.rms  = rms_ac(x, N);       // 去直流
feat.peak = peak_ac(x, N);
feat.x    = (feat.rms - tr_mean) / tr_std;  // 训练集归一化参数
```

时域特征便宜；归一化必须用训练集参数



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：时域特征



下面这段程序计算时域特征，作为训练与推理的同一口径基准：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_feature.cC\n\n \n\n```text\n/* host_feature.c —— 时域特征：均值/去直流 RMS/峰值/峰峰值（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_feature.c -o host_feature && ./host_feature\n */\n#include <stdio.h>\n#include <math.h>\nint main(void) {\n    int ok = 1;\n    float x[] = {1,2,3,4,5,6,7,8};\n    int n = (int)(sizeof(x)/sizeof(x[0]));\n    float sum = 0; for (int i = 0; i < n; i++) sum += x[i];\n    float mean = sum / n;\n    float ac = 0, peak = 0, vmin = x[0], vmax = x[0];\n    for (int i = 0; i < n; i++) {\n        float d = x[i]-mean; ac += d*d;\n        float a = fabsf(d); if (a > peak) peak = a;\n        if (x[i] < vmin) vmin = x[i];\n        if (x[i] > vmax) vmax = x[i];\n    }\n    float rms = sqrtf(ac/n);\n    float pp = vmax - vmin;            /* 峰峰值由数据计算，不是硬编码 */\n    printf(\"mean=%.2f rms(ac)=%.3f peak=%.2f peak-peak=%.1f\\n\", mean, rms, peak, pp);\n    if (fabsf(mean-4.5f) > 1e-4) ok = 0;\n    if (fabsf(rms - 2.2913f) > 1e-3) ok = 0;   /* 去直流后 RMS = sqrt(5.25)=2.2913 */\n    if (fabsf(peak-3.5f) > 1e-4) ok = 0;\n    if (fabsf(pp-7.0f) > 1e-4) ok = 0;         /* max-min = 8-1 */\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n时域特征计算（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_feature.c -o labs/host_feature && ./labs/host_feature
mean=4.50 rms(ac)=2.291 peak=3.50 peak-peak=7.0
RESULT: PASS
```



同一段信号在训练与推理都算出同一组特征——口径一致是精度的前提。



表 3.2 训练/推理一致性清单



| 环节 | 必须一致 | 不一致后果 |
| --- | --- | --- |
| 窗口 | 长度/重叠 | 特征分布偏移 |
| 归一化 | 均值/方差 | 输入偏移 |
| 去直流 | 是否去 | 特征偏差 |
| 单位 | 量纲 | 全错 |



```zhizhan-anchor
m03-stream
```



```zhizhan-anchor
m03-stream-t
```



## 3.3 流式计算与窗口状态



流式特征要维护窗口状态（环形缓冲），处理“窗口未满”“分块边界”；归一化参数必须来自训练集。



stream\_feat.c 节选C

 

```text
ring_push(&buf, sample);
if (ring_count(&buf) < WIN) return;      // 窗口未满不输出
feat.rms = rms_ac(buf.data, WIN);
feat.peak = peak_ac(buf.data, WIN);
feat.x = (feat.rms - train_mean) / train_std;  // 用训练集的归一化参数
```

流式窗口状态 \+ 训练集归一化参数



表 3.3 流式特征要点



| 问题 | 处理 | 注意 |
| --- | --- | --- |
| 窗口未满 | 不输出 | 避免假特征 |
| 分块边界 | 重叠窗 | 边界一致 |
| 归一化 | 用训练集参数 | 不可现算 |
| 成本 | 估算 MAC | 在预算内 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检与三级对照



特征自检：口径一致、成本在预算内、流式状态正确。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  从信号到特征



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从信号到特征" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">去直流</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">分窗</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">提特征</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">归一化</text></svg>
```



原始信号 → 去直流 → 分窗 → 时域/频域特征 → 归一化 → 输入模型。每步都要与训练一致。



表 3.4 三级特征选择



| 层级 | 常用特征 | 成本 |
| --- | --- | --- |
| MCU 端 | 时域（RMS/峰峰） | 低 |
| Linux 边缘 | 时域\+FFT | 中 |
| 云/训练 | 任意/自动特征 | 高 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.4 常见误区与排障



失败路径与排障




- **训练/推理特征不一致** ：精度骤降。

- **归一化参数不一致** ：输入分布偏移。

- **特征太贵** ：延迟超预算。

- **不做窗口状态** ：流式结果与离线不一致。



◆ 自测 · Module 03（先答再看）




1. 为什么归一化参数必须与训练时一致？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型是在特定输入分布下训练的。推理时用不同均值/方差，输入分布偏移，等价于“喂了模型没见过的数据”，精度下降。"}
   ```

2. 选特征时要同时看哪两个轴？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"区分度（能不能分开）与计算成本（算不算得起）。只追区分度可能超预算，只看成本可能学不动。"}
   ```

3. 流式特征为什么必须维护窗口状态？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"在线数据是一段段来的；窗口未满不能输出，分块边界要与离线一致，否则流式结果与训练口径不符。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你信号列一张“特征 × 区分度 × 成本”表，并核对训练与推理的特征与归一化口径完全一致。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [scikit-learn 常见陷阱](https://scikit-learn.org/stable/common_pitfalls.html)

 

动手练习



运行 ` labs/host_feature.c `：验证时域特征计算；为你的信号选一组特征并估算成本。



**检查结果：** 时域特征正确（mean=4.50、ac-RMS=2.291、peak=3.50、peak-peak=7.0）；口径一致；窗口状态可维护。

 

迁移练习：把本章的“能选一组兼顾区分度与计算成本的特征，并让训练与推理口径完全一致。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m03","criterion":"时域特征正确（mean=4.50、ac-RMS=2.291、peak=3.50、peak-peak=7.0）；口径一致；窗口状态可维护。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
