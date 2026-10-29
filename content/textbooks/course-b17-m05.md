# 模拟信号与采集前端

```zhizhan-anchor
m05
```



采集前端决定“测得到、测得准”： **分压/运放调理、阻抗匹配、抗混叠滤波、参考与分辨率** 。忽略源阻抗会引入误差。

 

> 前置：了解电阻分压与运放/ADC 的基本概念。 · ◷ 约 44 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计分压/调理与抗混叠前端，按参考电压算 LSB 并评估有效位。



```zhizhan-anchor
m05-knowledge-boundary
```



### 分辨率、准确度和有效位数分开



12 位 ADC 把满量程分成 4096 个码，不表示每个读数都精确到 1 LSB。参考电压、偏置、增益、噪声、源阻抗、采样时间和布局共同决定误差。用已知输入做偏置/增益标定，并在未用于标定的点上验证误差；只有重复性好不能证明准确。

 

本章速览




- 采集前端要匹配阻抗、抗混叠、参考干净。

- 先算 LSB 与量程再评估有效位。

- 采样时间要匹配源阻抗。

 

```zhizhan-anchor
m05-front
```



```zhizhan-anchor
m05-front-t
```



## 5.1 前端：分压/运放/抗混叠



采集前端把信号映射到 ADC 范围：分压/运放调理、阻抗匹配、抗混叠滤波、参考与分辨率。忽略源阻抗会因采样电容充不满而误差。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  采集前端信号链



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="采集前端信号链" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">传感器（源阻抗）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-cyn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">分压/运放调理</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">抗混叠滤波</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="165.0" class="sv-lbl-hi">ADC（参考/分辨率）</text></svg>
```



传感器 → 分压/运放 → 抗混叠滤波 → ADC（参考决定量程）。逐级都可能引入误差。



表 5.1 前端五要素



| 要素 | 作用 | 坑 |
| --- | --- | --- |
| 分压/运放 | 映射到 ADC 范围 | 超范围/增益错 |
| 源阻抗 | 影响采样时间 | 高阻抗采样不足 |
| 抗混叠 | 限制带宽 | 混叠 |
| 参考 | 决定量程 | 参考噪声 |
| 分辨率 | LSB | 噪声限制有效位 |



adc.c 节选C

 

```text
double vadc = 2048.0/4095.0*3.3;         // 1.650V
double vin  = vadc*(20e3+20e3)/20e3;      // 还原 3.301V
double lsb  = 3.3/4096.0;                 // 0.806mV
/* 抗混叠 fc 必须低于 Nyquist = fs/2 */
```

算 LSB/量程；抗混叠低于 Nyquist



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：分压还原与 LSB



下面这段程序验证分压还原与 LSB 计算：



host\_adc.cC

 

```text
/* host_adc.c —— 采集前端：分压/增益与 ADC 量化换算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_adc.c -o host_adc && ./host_adc
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 12 位 ADC, Vref=3.3V；输入经 2:1 分压（量程扩到 6.6V） */
    int raw = 2048;                       /* 半量程 */
    float vadc = raw * 3.3f / 4095.0f;
    float vin = vadc * 2.0f;              /* 还原分压 */
    printf("raw=%d → Vadc=%.3fV → Vin=%.3fV（期望 ~3.30）\n", raw, vadc, vin);
    if (vin < 3.25f || vin > 3.35f) ok = 0;
    float lsb = 3.3f/4095.0f;
    printf("LSB=%.3fmV（分辨率）\n", lsb*1000);
    if (lsb <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

分压还原/LSB 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_adc.c -o labs/host_adc && ./labs/host_adc
raw=2048 → Vadc=1.650V → Vin=3.301V（期望 ~3.30）
LSB=0.806mV（分辨率）
RESULT: PASS
```



raw=2048 → Vadc=1.650V，经分压比还原 Vin≈3.30V；12 位 理想量化步长 LSB=3.3/4096≈0.806mV；/4095 是端点映射约定。



表 5.2 换算与分辨率



| 量 | 公式 | 值 |
| --- | --- | --- |
| ADC 电压 | raw/4095·Vref | 1.650V |
| 还原输入 | ·分压比 | 3.301V |
| LSB | Vref/4096 | 0.806mV |
| 抗混叠 | fc\<Nyquist | 防混叠 |



```zhizhan-anchor
m05-noise
```



```zhizhan-anchor
m05-noise-t
```



## 5.3 噪声与有效位



先算 LSB 与量程，再评估噪声决定有效位数；采样时间要匹配源阻抗；抗混叠截止要低于 Nyquist。



adc.c 节选C

 

```text
double vadc = 2048.0 / 4095.0 * 3.3;      // 1.650V
double vin  = vadc * (20e3 + 20e3) / 20e3; // 还原 3.301V
double lsb  = 3.3 / 4096.0;               // 0.806mV
/* 抗混叠 fc 必须低于 Nyquist = fs/2 */
```

算 LSB/量程；抗混叠低于 Nyquist；采样匹配源阻抗



表 5.3 前端设计实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 匹配源阻抗 | 采样准确 | 充不满偏低 |
| 抗混叠 | 防混叠 | 假信号 |
| 参考去耦 | 低噪声 | 有效位下降 |
| 评估有效位 | 真实精度 | 理论位≠有效位 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



前端自检：量程匹配、阻抗匹配、抗混叠、参考干净、有效位明确。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  分压还原（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="分压还原（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">Vadc</text><rect x="150" y="26" width="283" height="18" rx="4" class="sv-cyn-s"></rect><text x="441" y="43" class="sv-lbl-hi">1650mV</text><text x="12" y="67" class="sv-lbl">Vin 还原</text><rect x="150" y="50" width="566" height="18" rx="4" class="sv-grn-s"></rect><text x="724" y="67" class="sv-lbl-hi">3301mV</text></svg>
```



ADC 读到 1.650V，经分压比还原输入 3.301V；LSB≈0.806mV 决定最小分辨。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 算 LSB | Vref/4096 | 忽略分辨率 |
| 查阻抗 | 源阻抗 vs 采样 | 采样不足 |
| 抗混叠 | fc\<Nyquist | 混叠 |
| 评估有效位 | 噪声实测 | 理论位误导 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **不匹配阻抗** ：采样不准。

- **超量程** ：削顶/损坏。

- **无抗混叠** ：高频混叠成假信号。

- **参考噪声大** ：有效位下降。



◆ 自测 · Module 05（先答再看）




1. 为什么高源阻抗会让 ADC 采样不准？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"采样电容充电受 RC 限制；源阻抗高、采样时间短就充不满，读数偏低。需加缓冲/延长采样时间。"}
   ```

2. 12 位、Vref=3.3V 的 LSB 是多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"LSB=Vref/4096≈0.806mV。它决定可分辨的最小电压变化。"}
   ```

3. 抗混叠滤波器的截止频率怎么定？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"要低于 Nyquist 频率（fs/2），把高于 Nyquist 的分量滤掉，避免混叠成假信号。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你采集前端核对分压/阻抗/抗混叠/参考，实测 LSB 与有效位。



核对与延伸：[NXP AN 模拟设计](https://www.nxp.com/)

 

动手练习



运行 ` labs/host_adc.c `：验证分压还原与 LSB 计算。



**检查结果：** raw=2048 → Vin=3.301V；理想量化步长 LSB=3.3/4096≈0.806mV；/4095 是端点映射约定；抗混叠截止须低于 Nyquist。

 

迁移练习：把本章的“能设计分压/调理与抗混叠前端，按参考电压算 LSB 并评估有效位。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m05","criterion":"raw=2048 → Vin=3.301V；理想量化步长 LSB=3.3/4096≈0.806mV；/4095 是端点映射约定；抗混叠截止须低于 Nyquist。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
