# FFT 与频谱分析

```zhizhan-anchor
m05
```



频域分析把时域信号分解成频率成分： **DFT/FFT、频率分辨率、窗函数** 是关键。分辨率 ≈ fs/N。

 

> 前置：理解复数/三角函数，读过 M01 采样。 · ◷ 约 44 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能对信号做 DFT/FFT 并正确加窗、读频率分辨率与峰值。

 

本章速览




- FFT 前加窗减少泄漏；分辨率≈fs/N。

- 点数决定分辨率，不能靠插值。

- 峰值检测找主频/谐波。

 

```zhizhan-anchor
m05-fft
```



```zhizhan-anchor
m05-fft-t
```



## 5.1 DFT/FFT、分辨率、窗



DFT/FFT 把时域分解成频率成分。分辨率 ≈ fs/N（由点数决定，不是靠插值）；非整周期截断会产生泄漏，要加窗。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  DFT 峰值（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="DFT 峰值（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">bin0</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-box"></rect><text x="160" y="43" class="sv-lbl-hi">0(×10⁻²)</text><text x="12" y="67" class="sv-lbl">bin2 峰值</text><rect x="150" y="50" width="533" height="18" rx="4" class="sv-grn-s"></rect><text x="691" y="67" class="sv-lbl-hi">400(×10⁻²)</text><text x="12" y="91" class="sv-lbl">bin4</text><rect x="150" y="74" width="2" height="18" rx="4" class="sv-box"></rect><text x="160" y="91" class="sv-lbl-hi">0(×10⁻²)</text></svg>
```



对 bin=2 的余弦做 DFT，峰值出现在 bin=2、幅度 4.00；分辨率 Δf=fs/N。



表 5.1 频域五概念



| 概念 | 含义 | 注意 |
| --- | --- | --- |
| DFT/FFT | 时→频 | FFT 是快速算法 |
| 分辨率 | fs/N | 点数决定 |
| 泄漏 | 非整周期截断 | 加窗 |
| 窗函数 | 抑制泄漏 | 主瓣/旁瓣权衡 |
| 峰值 | 主频 | 找局部最大 |



dft.c 节选C

 

```text
X[k] = sum x[n]*exp(-j*2*pi*k*n/N);    // DFT
mag = 2*sqrt(re*re + im*im)/N;         // 单边幅度
/* 非整周期截断要加窗；分辨率 df=fs/N */
```

DFT 求幅度；非整周期加窗；分辨率=fs/N



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：峰值检测



下面这段程序对 bin=2 的余弦做 DFT 并找峰值：



host\_dft.cC

 

```text
/* host_dft.c —— DFT 幅度与峰值检测（N=8）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_dft.c -o host_dft -lm && ./host_dft
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    int N = 8;
    double x[8];
    for (int n=0;n<N;n++) x[n] = cos(2*3.14159265358979*2*n/N);   /* 频率 bin=2 */
    int peak = 0; double pmax = 0;
    for (int k=0;k<N;k++) {
        double re=0, im=0;
        for (int n=0;n<N;n++){ re += x[n]*cos(2*3.14159265358979*k*n/N); im -= x[n]*sin(2*3.14159265358979*k*n/N); }
        double mag = sqrt(re*re+im*im);
        if (mag > pmax) { pmax = mag; peak = k; }
    }
    printf("峰值 bin=%d（期望 2）幅度=%.2f\n", peak, pmax);
    if (peak != 2) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

DFT/峰值检测模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_dft.c -o labs/host_dft && ./labs/host_dft
峰值 bin=2（期望 2）幅度=4.00
RESULT: PASS
```



N=8、输入 bin=2 余弦，峰值出现在 bin=2、幅度 4.00；分辨率 Δf=fs/N。



表 5.2 频谱结果



| 量 | 公式 | 值 |
| --- | --- | --- |
| 峰值 bin | 局部最大 | 2 |
| 幅度 | 2·\|X\[k\]\|/N | 4.00 |
| 分辨率 | fs/N | Δf |
| 窗 | 抑制泄漏 | 按需 |



```zhizhan-anchor
m05-window
```



```zhizhan-anchor
m05-window-t
```



## 5.3 加窗与读数



分析前要加窗减少泄漏；分辨率由 N 决定，不是靠“插值”提高。峰值检测用于找主频/谐波，是振动/音频诊断的基础。



dft.c 节选C

 

```text
X[k] = Σ x[n]·e^{-j2πkn/N};            // DFT
mag = 2*sqrt(re*re + im*im)/N;         // 单边幅度
/* 非整周期截断要加窗；分辨率 Δf=fs/N */
```

DFT 求幅度；非整周期加窗；分辨率=fs/N



表 5.3 频谱实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 加窗 | 抑泄漏 | 频谱糊 |
| 点数 N | 提分辨率 | 点数不足 |
| 前置抗混叠 | 防假峰 | 混叠 |
| bin→Hz | 换算 | 把 bin 当 Hz |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



频谱自检：加窗、点数足够、无混叠、bin 换算正确。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  频谱分析流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="频谱分析流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">采样</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">加窗</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">DFT</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">峰值/换算</text></svg>
```



采样（抗混叠）→ 加窗 → DFT/FFT → 求幅度 → 找峰值 → bin→Hz。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 加窗 | 抑泄漏 | 不加窗 |
| 点数 | ≥周期数 | 分辨率不足 |
| 混叠 | 前置滤波 | 假峰 |
| 换算 | bin×fs/N | 把 bin 当 Hz |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **不加窗** ：泄漏导致频谱糊。

- **点数不足** ：分辨率不够。

- **混叠未滤** ：频谱有假峰。

- **把 bin 当 Hz** ：换算错。



◆ 自测 · Module 05（先答再看）




1. 频率分辨率由什么决定？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"由采样率与点数决定，分辨率 ≈ fs/N。想提高分辨率要么加长采样（增大 N），要么降低 fs（同时要满足 Nyquist）。"}
   ```

2. 为什么频谱分析前要加窗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"非整周期截断会造成频谱泄漏（能量扩散）。加窗抑制旁瓣，让峰值更清晰、幅度更准。"}
   ```

3. bin 如何换算成频率？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"频率 = bin × fs/N。把 bin 直接当 Hz 是常见错误。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对你一段振动/音频信号做 FFT：加窗、读分辨率与峰值，并换算成 Hz。



核对与延伸：[PySDR](https://pysdr.org/) · [CMSIS-DSP 文档](https://arm-software.github.io/CMSIS-DSP/main/)

 

动手练习



运行 ` labs/host_dft.c `：对 bin=2 的余弦做 DFT 并找峰值。



**检查结果：** 峰值出现在 bin=2、幅度=4.00；分辨率 Δf=fs/N。

 

迁移练习：把本章的“能对信号做 DFT/FFT 并正确加窗、读频率分辨率与峰值。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m05","criterion":"峰值出现在 bin=2、幅度=4.00；分辨率 Δf=fs/N。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
