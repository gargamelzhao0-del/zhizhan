# 电源、去耦与复位

```zhizhan-anchor
m03
```



电源是硬件的地基： **LDO/DCDC 选型、去耦布局、纹波与上电时序、复位** 。很多“偶发怪问题”根源在电源与地。

 

> 前置：了解电源/地概念与基本滤波、复位。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按纹波/瞬态需求布去耦并设计可靠复位，估算 RC 时间常数与截止频率。

 

本章速览




- 电源是地基：去耦就近、地回路短。

- 复位要可靠，欠压进安全态。

- 多电源域注意上电时序。

 

```zhizhan-anchor
m03-power
```



```zhizhan-anchor
m03-power-t
```



## 3.1 电源、去耦、复位



电源是硬件地基：LDO/DCDC 选型、去耦布局、纹波与上电时序、复位。去耦电容要尽量靠近芯片电源引脚，地回路要短；复位要可靠并考虑欠压。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  电源到芯片的去耦



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="电源到芯片的去耦" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">电源 / LDO-DCDC</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">体电容（bulk）</text><rect x="60" y="98" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="124.0" class="sv-lbl-hi">就近去耦（贴引脚）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="165.0" class="sv-lbl-hi">芯片（VDD/VSS）</text></svg>
```



电源 → 体电容 → 就近去耦（贴引脚）→ 芯片。走线电感会削弱去耦效果，越远越无效。



表 3.1 电源五要素



| 要素 | 作用 | 坑 |
| --- | --- | --- |
| LDO/DCDC | 稳压 | 效率/纹波 |
| 去耦 | 就近供瞬时电流 | 远离引脚无效 |
| 纹波 | 电源噪声 | 影响 ADC/射频 |
| 上电时序 | 多电源域 | 顺序错锁死 |
| 复位 | 保证初始状态 | 无复位/抖动 |



rc.c 节选C

 

```text
double tau = 10e3 * 1e-6;              // 0.0100s
double fc  = 1.0 / (2*M_PI*tau);       // 15.9Hz
/* 复位 RC 延时 ~5τ；去耦电容贴引脚、地回路最短 */
```

RC 计算复位延时/滤波；去耦就近



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：RC 时间常数与截止频率



下面这段程序验证 RC 时间常数与滤波截止频率：



host\_rc.cC

 

```text
/* host_rc.c —— RC 时间常数与滤波截止频率（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_rc.c -o host_rc -lm && ./host_rc
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    float r = 10000, c = 1e-6f;
    float tau = r * c;
    printf("R=10k C=1uF → tau=%.4fs\n", tau);
    if (fabsf(tau - 0.01f) > 1e-5f) ok = 0;
    float fc = 1.0f/(2.0f*3.14159265f*r*c);
    printf("截止频率 fc=%.1fHz（期望 ~15.9）\n", fc);
    if (fabsf(fc - 15.9f) > 0.2f) ok = 0;
    /* 5tau 达到约 99.3% */
    printf("5tau 后充电到约 %.1f%%\n", (1-expf(-5))*100);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

RC 时间常数/截止频率模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_rc.c -o labs/host_rc && ./labs/host_rc
R=10k C=1uF → tau=0.0100s
截止频率 fc=15.9Hz（期望 ~15.9）
5tau 后充电到约 99.3%
RESULT: PASS
```



τ=RC=10.0ms、fc=1/(2πRC)≈15.9Hz；5τ 后充电约 99.3%（复位/滤波的时域依据）。



表 3.2 RC 计算



| 量 | 公式 | 值 |
| --- | --- | --- |
| 时间常数 | τ=RC | 10.0ms |
| 截止频率 | fc=1/(2πRC) | 15.9Hz |
| 5τ 充电 | ≈99.3% | 稳定 |
| 复位延时 | 依 τ | 可靠复位 |



```zhizhan-anchor
m03-reset
```



```zhizhan-anchor
m03-reset-t
```



## 3.3 去耦与复位设计



去耦就近引脚、地回路最短；复位用上拉\+电容或专用复位芯片，并考虑欠压时进入安全状态。



rc.c 节选C

 

```text
double tau = 10e3 * 1e-6;              // 0.0100s
double fc  = 1.0 / (2*M_PI*tau);       // 15.9Hz
/* 复位：RC 上电复位延时 ~5τ；去耦电容贴引脚、地回路最短 */
```

RC 计算复位延时/滤波；去耦就近



表 3.3 电源与复位实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 就近去耦 | 瞬态供电 | 离引脚远 |
| 短地回路 | 降噪声/EMC | 长回路 |
| 可靠复位 | 初始状态 | 无复位/抖动 |
| 欠压保护 | 安全态 | 带病运行 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



电源自检：去耦就近、复位可靠、纹波可控、上电时序正确。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  RC 充电曲线关键点（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="RC 充电曲线关键点（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">1τ 63%</text><rect x="150" y="26" width="378" height="18" rx="4" class="sv-cyn-s"></rect><text x="536" y="43" class="sv-lbl-hi">63%</text><text x="12" y="67" class="sv-lbl">3τ 95%</text><rect x="150" y="50" width="570" height="18" rx="4" class="sv-amb-s"></rect><text x="728" y="67" class="sv-lbl-hi">95%</text><text x="12" y="91" class="sv-lbl">5τ 99.3%</text><rect x="150" y="74" width="594" height="18" rx="4" class="sv-grn-s"></rect><text x="752" y="91" class="sv-lbl-hi">99%</text></svg>
```



1τ=63%、5τ≈99.3%。复位延时与滤波带宽都基于 τ=RC。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 纹波 | 示波器测 | 影响 ADC/射频 |
| 去耦 | 就近\+短地 | 远离无效 |
| 复位 | RC/专用芯片 | 不可靠 |
| 时序 | 多电源域顺序 | 锁死 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **去耦太远** ：瞬态供电不足，随机复位。

- **地回路长** ：噪声大、EMC 差。

- **复位不可靠** ：偶发不启动。

- **上电时序错** ：多电源域器件锁死。



◆ 自测 · Module 03（先答再看）




1. 为什么去耦电容必须靠近电源引脚？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"去耦是为芯片瞬态电流就近供电；走线电感会削弱效果，离得越远越无效。布局上应紧贴引脚并短接地。"}
   ```

2. RC 时间常数与截止频率的关系？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"τ=RC；fc=1/(2πRC)。τ 决定充放电快慢（如复位延时），fc 决定滤波带宽。"}
   ```

3. 多电源域器件为什么要注意上电时序？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"某些器件要求电源按特定顺序上电，否则内部电路可能闩锁/锁死。要按手册的时序设计（或加时序控制）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你板子核对去耦布局（是否贴引脚）、复位可靠性与多电源域上电时序。



核对与延伸：[TI 电源设计参考](https://www.ti.com/power-management/overview.html) · [ESP32 硬件设计指南](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/index.html)

 

动手练习



运行 ` labs/host_rc.c `：验证 RC 时间常数与滤波截止频率。



**检查结果：** R=10k、C=1uF → τ=10.0ms、fc≈15.9Hz；5τ 后充电约 99.3%。

 

迁移练习：把本章的“能按纹波/瞬态需求布去耦并设计可靠复位，估算 RC 时间常数与截止频率。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m03","criterion":"R=10k、C=1uF → τ=10.0ms、fc≈15.9Hz；5τ 后充电约 99.3%。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
