# 特征提取与流式计算

```zhizhan-anchor
m06
```



特征把原始信号压缩成“可判别且算得起”的指标： **时域（RMS/峰峰值/峭度）、频域** 。流式实现要维护窗口状态。

 

> 前置：理解均值/方差，读过 M03 时域滤波。 · ◷ 约 44 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能计算 RMS/峰峰值/过零率/峭度并以窗口\+重叠方式流式维护。

 

本章速览




- 特征要可判别且算得起；口径与下游一致。

- 流式维护窗口状态、处理窗口未满。

- 按窗口\+重叠计算。

 

```zhizhan-anchor
m06-feat
```



```zhizhan-anchor
m06-feat-t
```



## 6.1 时域特征



特征把原始信号压缩成可判别且算得起的指标。RMS 对能量、峰峰值对冲击、过零率对频率成分、峭度对冲击/故障敏感。流式要维护窗口状态。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  正弦 vs 正弦\+冲击的特征（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="正弦 vs 正弦+冲击的特征（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">峰峰值</text><rect x="150" y="26" width="420" height="18" rx="4" class="sv-amb-s"></rect><text x="578" y="43" class="sv-lbl-hi">700(×10⁻²)</text><text x="12" y="67" class="sv-lbl">峭度×100</text><rect x="150" y="50" width="559" height="18" rx="4" class="sv-red-s"></rect><text x="717" y="67" class="sv-lbl-hi">931(×10⁻²)</text></svg>
```



叠加冲击后峰峰值 2.000→7.000、峭度 1.500→9.309（\>3 提示冲击），RMS 也上升。



表 6.1 时域/频域特征



| 特征 | 敏感于 | 成本 |
| --- | --- | --- |
| RMS | 能量 | 低 |
| 峰峰值 | 冲击 | 低 |
| 过零率 | 频率成分 | 低 |
| 峭度 | 冲击/故障 | 中 |
| 频谱峰 | 周期 | 中高 |



feat.c 节选C

 

```text
if (count < N) return;                 // 窗口未满不输出
rms = sqrt(sumsq / N);
kurt = moment4 / (rms*rms*rms*rms);     // 峭度>3 提示冲击
/* 窗口+重叠；口径与训练一致（B13 M03） */
```

窗口未满不输出；流式窗口与离线口径一致



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：正弦与冲击



下面这段程序计算正弦与“正弦\+冲击”的时域特征：



host\_feat.cC

 

```text
/* host_feat.c —— 时域特征：RMS/峰峰值/过零率/峭度（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_feat.c -o host_feat -lm && ./host_feat
 */
#include <stdio.h>
#include <math.h>

#define N 16
static const double PI = 3.14159265358979;

static void feat(const char *name, const double *x, int n) {
    double sum = 0; for (int i = 0; i < n; i++) sum += x[i];
    double mean = sum / n;
    double m2 = 0, m4 = 0, vmin = x[0], vmax = x[0];
    int zc = 0;
    for (int i = 0; i < n; i++) {
        double d = x[i] - mean; m2 += d*d; m4 += d*d*d*d;
        if (x[i] < vmin) vmin = x[i];
        if (x[i] > vmax) vmax = x[i];
        if (i > 0 && ((x[i-1] < 0) != (x[i] < 0))) zc++;   /* 过零率：符号翻转/(n-1) */
    }
    m2 /= n; m4 /= n;
    double rms = sqrt(m2 + mean*mean);            /* RMS 含直流分量 */
    double p2p = vmax - vmin;                     /* 峰峰值 */
    double zcr = (double)zc / (n - 1);            /* 过零率 ∈ [0,1] */
    double kurt = m4 / (m2*m2);                   /* 峭度（正态=3） */
    printf("%s: RMS=%.3f 峰峰值=%.3f 过零率=%.3f 峭度=%.3f\n", name, rms, p2p, zcr, kurt);
}

int main(void) {
    int ok = 1;
    double smooth[N], spiky[N];
    for (int i = 0; i < N; i++) {
        smooth[i] = sin(2*PI*i/8.0);   /* 2 个周期正弦 */
        spiky[i]  = smooth[i];
    }
    spiky[4] += 6.0;                   /* 叠加一个冲击，考察峭度敏感性 */

    printf("窗口 N=%d（单位：采样点）\n", N);
    feat("正弦      ", smooth, N);
    feat("正弦+冲击 ", spiky, N);

    /* 断言：正弦峭度≈1.5、冲击信号峭度>3（提示冲击/故障） */
    double ms=0, s2=0, s4=0; for (int i=0;i<N;i++){ s2+=smooth[i]*smooth[i]; s4+=smooth[i]*smooth[i]*smooth[i]*smooth[i]; } s2/=N; s4/=N; ms=s4/(s2*s2);
    double ps=0, p2=0, p4=0, mean=0; for (int i=0;i<N;i++) mean+=spiky[i]; mean/=N;
    for (int i=0;i<N;i++){ double d=spiky[i]-mean; p2+=d*d; p4+=d*d*d*d; } p2/=N; p4/=N; ps=p4/(p2*p2);
    if (fabs(ms-1.5) > 0.05) ok = 0;
    if (ps <= 3.0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时域特征模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_feat.c -o labs/host_feat && ./labs/host_feat
正弦      : RMS=0.707 峰峰值=2.000 过零率=0.200 峭度=1.500
正弦+冲击 : RMS=1.658 峰峰值=7.000 过零率=0.200 峭度=9.309
RESULT: PASS
```



同一窗口叠加冲击后：峰峰值 2.000→7.000、峭度 1.500→9.309（\>3 提示冲击）。



表 6.2 特征数值



| 特征 | 正弦 | 正弦\+冲击 |
| --- | --- | --- |
| RMS | 0.707 | 1.658 |
| 峰峰值 | 2.000 | 7.000 |
| 过零率 | 0.200 | 0.200 |
| 峭度 | 1.500 | 9.309 |



```zhizhan-anchor
m06-stream
```



```zhizhan-anchor
m06-stream-t
```



## 6.3 流式窗口与口径



特征口径必须与训练/下游一致；流式按窗口\+重叠计算，注意窗口未满与分块边界（启动时窗口不足会算错）。



feat.c 节选C

 

```text
if (count < N) return;                 // 窗口未满不输出
rms = sqrt(sumsq / N); kurt = moment4 / (rms*rms*rms*rms);
/* 窗口+重叠；口径与训练一致（B13 M03） */
```

窗口未满不输出；流式窗口与离线口径一致



表 6.3 流式特征实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 窗口\+重叠 | 边界连续 | 丢边界样本 |
| 窗口未满处理 | 口径正确 | 错误统计 |
| 口径一致 | 可训练/推理 | 分布偏移 |
| 算成本 | 在预算内 | 超算力 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



特征自检：口径一致、窗口状态正确、特征成本在预算内、边界连续。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  流式特征



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="流式特征" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">滑动窗口</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">算特征</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">窗口满输出</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">馈送下游</text></svg>
```



滑动窗口 → 计算特征（RMS/峭度…）→ 输出（窗口未满不输出）→ 馈送下游/AI。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 窗口 | 长度\+重叠 | 边界丢失 |
| 未满 | 不输出 | 错误统计 |
| 口径 | 与训练一致 | 偏移 |
| 成本 | 估 MAC | 超预算 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **口径不一致** ：训练/在线特征不同。

- **窗口状态错** ：流式结果与离线不符。

- **特征太贵** ：超算力预算。

- **不做重叠** ：边界样本丢失。



◆ 自测 · Module 06（先答再看）




1. 为什么流式特征要特别处理“窗口未满”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"启动时窗口数据不足，若照常计算会得到错误统计。应等待窗口填满或明确标注，保证在线与离线口径一致。"}
   ```

2. 哪个特征对“冲击/故障”最敏感？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"峭度（kurtosis）。正常信号峭度约 3，冲击会显著抬高（本例 1.5→9.3）；峰峰值也能反映冲击。"}
   ```

3. 为什么特征口径要与训练一致？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型按特定特征分布训练。在线口径不同会导致输入分布偏移，精度下降（见 B13）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你信号选一组特征（RMS/峰峰值/峭度）流式计算，并与离线/训练口径对齐。



核对与延伸：[CMSIS-DSP 文档](https://arm-software.github.io/CMSIS-DSP/main/) · [Smith 数字信号处理](https://www.dspguide.com/)

 

动手练习



运行 ` labs/host_feat.c `：计算正弦与“正弦\+冲击”的特征并对照期望值。



**检查结果：** N=16：正弦 RMS=0.707、峰峰值=2.000、过零率=0.200、峭度=1.500；叠加冲击后峭度 9.309。

 

迁移练习：把本章的“能计算 RMS/峰峰值/过零率/峭度并以窗口\+重叠方式流式维护。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m06","criterion":"N=16：正弦 RMS=0.707、峰峰值=2.000、过零率=0.200、峭度=1.500；叠加冲击后峭度 9.309。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
