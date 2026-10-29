# 采样、时基与混叠

```zhizhan-anchor
m01
```



采样第一原则： **采样率 \> 2×最高频率（Nyquist）** ，否则高频会“混叠”成假低频。采样 **时基抖动** 同样引入误差。

 

> 前置：理解正弦/频率，会写 ADC 采样循环。 · ◷ 约 44 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按 Nyquist 选采样率、设计前置抗混叠滤波并量化时基抖动影响。



```zhizhan-anchor
m01-knowledge-boundary
```



### 采样条件比 Nyquist 口号更重要



Nyquist 条件针对带限信号。现实传感器的高频噪声仍可混叠，需要模拟抗混叠与适当采样。采样率 100 Hz 时，90 Hz 分量可能表现为 10 Hz；采集后再低通不能还原已经混叠的来源。实验应改变输入频率，查看采样序列和频谱。

 

本章速览




- 采样率须 \> 2×最高频率，否则混叠。

- 抗混叠滤波放在 ADC 前。

- 时基抖动与多通道同步要保证。

 

```zhizhan-anchor
m01-sample
```



```zhizhan-anchor
m01-sample-t
```



## 1.1 Nyquist 与混叠



采样第一原则：采样率 \> 2×最高频率，否则高频会混叠成假低频。采样时基抖动同样引入误差。抗混叠滤波器要放在 ADC 之前。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  抗混叠滤波在 ADC 之前



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="抗混叠滤波在 ADC 之前" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="60" y="30" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">信号（含带外）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">抗混叠低通（fc ≤ fs/2）</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">ADC（fs）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="165.0" class="sv-lbl-hi">不带滤波 → 混叠</text></svg>
```



信号 → 抗混叠低通（截止 ≤ Nyquist）→ ADC。带外成分被滤掉，避免折叠成假频率。



表 1.1 采样五概念



| 概念 | 含义 | 处理 |
| --- | --- | --- |
| Nyquist | fs/2 | 不低于 2×信号带宽 |
| 混叠 | 高频变假低频 | 抗混叠滤波 |
| 抖动 | 采样时刻不准 | 稳定时基 |
| 过采样 | fs 远高于需求 | 平均/降噪 |
| 同步 | 多通道对齐 | 共用时基 |



sample.c 节选C

 

```text
double nyq = fs / 2.0;                       // 500Hz
double obs = fabs(f - fs);                   // 1200-1000=200（镜像）
/* 抗混叠滤波器截止 <= Nyquist 且置于 ADC 之前 */
```

超过 Nyquist 的频率镜像折叠；滤波须前置



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：混叠



下面这段程序验证混叠：



host\_sample.cC

 

```text
/* host_sample.c —— 采样与混叠：Nyquist 与混叠频率计算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sample.c -o host_sample && ./host_sample
 */
#include <stdio.h>
#include <math.h>
static double alias(double f, double fs) { double a = fmod(f, fs); if (a > fs/2) a = fs - a; return a; }
int main(void) {
    int ok = 1;
    double fs = 1000;      /* 采样率 1kHz，Nyquist 500Hz */
    printf("Nyquist=%.0fHz\n", fs/2);
    printf("输入 100Hz → 观测 %.0fHz（无混叠）\n", alias(100, fs));
    if (fabs(alias(100,fs)-100) > 1e-9) ok = 0;
    printf("输入 1200Hz → 观测 %.0fHz（混叠到 200Hz）\n", alias(1200, fs));
    if (fabs(alias(1200,fs)-200) > 1e-9) ok = 0;
    printf("结论：超过 Nyquist 的信号会混叠成假频率\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

采样/混叠模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sample.c -o labs/host_sample && ./labs/host_sample
Nyquist=500Hz
输入 100Hz → 观测 100Hz（无混叠）
输入 1200Hz → 观测 200Hz（混叠到 200Hz）
结论：超过 Nyquist 的信号会混叠成假频率
RESULT: PASS
```



fs=1000Hz→Nyquist=500Hz；1200Hz 混叠到 |1200−1000|=200Hz；100Hz 无混叠。



表 1.2 混叠示例



| 输入 | fs=1000Hz | 结果 |
| --- | --- | --- |
| 100Hz | \< Nyquist | 无混叠 |
| 1200Hz | \> Nyquist | 混叠到 200Hz |
| Nyquist | 500Hz | 边界 |
| 过采样 | fs 高 | 降噪但降带宽 |



```zhizhan-anchor
m01-jitter
```



```zhizhan-anchor
m01-jitter-t
```



## 1.3 抖动与过采样



采样时基抖动会让采样时刻不准，信噪比下降；过采样 \+ 平均能降噪但降低有效带宽。多通道要共用时基保证相位对齐。



sample.c 节选C

 

```text
double nyq = fs / 2.0;                       // 500Hz
double obs = fabs(f - fs);                   // 1200-1000=200（镜像）
/* 抗混叠滤波器截止 <= Nyquist 且置于 ADC 之前 */
```

超过 Nyquist 的频率镜像折叠；滤波须前置



表 1.3 采样实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| fs\>2×带宽 | 不混叠 | 采样率不足 |
| 前置抗混叠 | 滤带外 | 折叠 |
| 稳定时基 | 低抖动 | SNR 下降 |
| 多通道共时基 | 相位对齐 | 关系错 |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



采样自检：fs 满足 Nyquist、有前置抗混叠、时基稳定、多通道同步。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  混叠后的观测频率（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="混叠后的观测频率（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">100Hz 输入</text><rect x="150" y="26" width="240" height="18" rx="4" class="sv-grn-s"></rect><text x="398" y="43" class="sv-lbl-hi">100Hz</text><text x="12" y="67" class="sv-lbl">1200Hz 观测</text><rect x="150" y="50" width="480" height="18" rx="4" class="sv-red-s"></rect><text x="638" y="67" class="sv-lbl-hi">200Hz</text></svg>
```



100Hz 正常；1200Hz 混叠为 200Hz 假频率——只能靠抗混叠滤波避免。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 选 fs | \>2×带宽 | 混叠 |
| 滤波 | 前置 | 带外折叠 |
| 时基 | 稳定 | 抖动 |
| 同步 | 共时基 | 相位错 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **采样率不足** ：混叠出假频率。

- **无抗混叠滤波** ：带外噪声折叠进来。

- **时基抖动** ：信噪比下降。

- **多通道不同步** ：相位关系错。



◆ 自测 · Module 01（先答再看）




1. 1kHz 采样一个 1200Hz 信号会看到什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"混叠到 200Hz（fs−f 的镜像）。这是采样定理的直接后果，只能靠抗混叠滤波器避免。"}
   ```

2. 抗混叠滤波器为什么要放在 ADC 之前？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"要在采样前把超过 Nyquist 的成分滤掉，否则它们会折叠成带内假频率，事后无法去除。"}
   ```

3. 过采样 \+ 平均的好处与代价？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"好处是降噪（平均抑制随机噪声）；代价是降低有效带宽、增加数据量与计算。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按你信号带宽选采样率（\>2×），设计前置抗混叠滤波并核对时基抖动。



核对与延伸：[Smith 数字信号处理](https://www.dspguide.com/) · [PySDR](https://pysdr.org/)

 

动手练习



运行 ` labs/host_sample.c `：验证 1200Hz 在 1kHz 采样下混叠到 200Hz。



**检查结果：** Nyquist=500Hz；1200Hz 输入混叠到 200Hz；100Hz 无混叠。

 

迁移练习：把本章的“能按 Nyquist 选采样率、设计前置抗混叠滤波并量化时基抖动影响。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m01","criterion":"Nyquist=500Hz；1200Hz 输入混叠到 200Hz；100Hz 无混叠。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
