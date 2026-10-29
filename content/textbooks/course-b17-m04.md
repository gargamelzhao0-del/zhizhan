# 时钟与最小系统

```zhizhan-anchor
m04
```



最小系统是“芯片能跑”的最小条件： **电源、晶振、复位、BOOT、调试口** 。晶振要按规格配负载电容并考虑起振。

 

> 前置：了解晶振/时钟源与芯片最小系统的组成。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按晶振规格计算负载电容 CL 并核对起振条件，搭出稳定最小系统。

 

本章速览




- 最小系统=电源\+晶振\+复位\+BOOT\+调试口。

- 负载电容按规格匹配，保证起振。

- 等 PLL 锁定再切换时钟。

 

```zhizhan-anchor
m04-min
```



```zhizhan-anchor
m04-min-t
```



## 4.1 最小系统与负载电容



最小系统 = 电源 \+ 晶振 \+ 复位 \+ BOOT \+ 调试口。晶振按规格配负载电容：CL=(C1·C2)/(C1\+C2)\+Cstray，不匹配会起振慢或不起振。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  最小系统的五个要素



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="最小系统的五个要素" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">电源</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">晶振 + 负载电容</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">复位</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="165.0" class="sv-lbl-hi">BOOT + 调试口</text></svg>
```



电源 → 晶振（含负载电容）→ 复位 → BOOT → 调试口。逐项确认后再等 PLL 锁定。



表 4.1 最小系统五要素



| 要素 | 内容 | 坑 |
| --- | --- | --- |
| 晶振 | 无源/有源 | 负载电容不匹配 |
| 负载电容 | CL=(C1·C2)/(C1\+C2)\+Cstray | 起振慢/不振 |
| PLL | 倍频 | 等待锁定 |
| BOOT | 启动模式 | 电平错 |
| 调试口 | SWD/JTAG | 接线过长 |



xtal.c 节选C

 

```text
double cl = (22e-12*22e-12)/(22e-12+22e-12) + 5e-12;  // 16.0pF
if (fabs(cl - 16e-12) <= 0.5e-12) ok = 1;              // 匹配规格
/* 起振后等 PLL 锁定再切时钟 */
```

负载电容匹配规格；起振后等 PLL 锁定



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：负载电容计算



下面这段程序按晶振规格计算负载电容：



host\_xtal.cC

 

```text
/* host_xtal.c —— 晶振负载电容计算与最小系统校核（主机可运行）。
 * 无源晶振负载电容：CL = (C1*C2)/(C1+C2) + Cstray；需与晶振规格 CL 匹配（常见 12–16pF）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_xtal.c -o host_xtal && ./host_xtal
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    float c1 = 22e-12f, c2 = 22e-12f, cstray = 5e-12f;   /* 两颗 22pF + 杂散 5pF */
    float cl = (c1 * c2) / (c1 + c2) + cstray;
    printf("C1=C2=%.0fpF Cstray=%.0fpF → CL=%.1fpF（期望 ~16）\n",
           c1 * 1e12f, cstray * 1e12f, cl * 1e12f);
    if (cl < 15.5e-12f || cl > 16.5e-12f) ok = 0;
    /* 与晶振规格（示例 CL=16pF）比较，偏差须在 ±0.5pF 内 */
    float cl_spec = 16e-12f;
    printf("晶振规格 CL=%.0fpF，匹配误差 %.1fpF（须 ≤0.5）\n",
           cl_spec * 1e12f, (cl - cl_spec) * 1e12f);
    if (cl < cl_spec - 0.5e-12f || cl > cl_spec + 0.5e-12f) ok = 0;
    printf("最小系统：电源 → 晶振 → 复位 → BOOT → 调试口，逐项确认后等 PLL 锁定\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

负载电容计算模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_xtal.c -o labs/host_xtal && ./labs/host_xtal
C1=C2=22pF Cstray=5pF → CL=16.0pF（期望 ~16）
晶振规格 CL=16pF，匹配误差 0.0pF（须 ≤0.5）
最小系统：电源 → 晶振 → 复位 → BOOT → 调试口，逐项确认后等 PLL 锁定
RESULT: PASS
```



CL=(C1·C2)/(C1\+C2)\+Cstray=16.0pF，匹配规格 16pF；起振后须等 PLL 锁定再切时钟。



表 4.2 负载电容计算



| 量 | 公式/值 | 判据 |
| --- | --- | --- |
| 负载电容 | (C1·C2)/(C1\+C2)\+Cstray | 16.0pF |
| 规格 | 16pF | 误差≤0.5 |
| 起振 | 需要时间/负阻 | 确认稳定 |
| PLL | 等待锁定 | 再切时钟 |



```zhizhan-anchor
m04-osc
```



```zhizhan-anchor
m04-osc-t
```



## 4.3 起振与稳定



起振需要时间与足够负阻；负载电容不匹配会“偶发不启动”。配上电顺序与等待 PLL 锁定，才能稳定启动。



xtal.c 节选C

 

```text
double cl = (22e-12 * 22e-12)/(22e-12 + 22e-12) + 5e-12;  // 16.0pF
if (fabs(cl - 16e-12) <= 0.5e-12) ok = 1;                // 匹配规格
/* 起振后等 PLL 锁定再切时钟 */
```

负载电容匹配规格；起振后等 PLL 锁定



表 4.3 起振与最小系统



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 匹配 CL | 稳定起振 | 偶发不启动 |
| 布线短/远离干扰 | 起振可靠 | 受干扰 |
| 等 PLL 锁定 | 切时钟成功 | 锁死 |
| BOOT 正确 | 启动模式 | 进不了用户代码 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



最小系统自检：电源/晶振/复位/BOOT/调试口逐项确认。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  负载电容匹配（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="负载电容匹配（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">计算 CL</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-grn-s"></rect><text x="638" y="43" class="sv-lbl-hi">16pF</text><text x="12" y="67" class="sv-lbl">规格</text><rect x="150" y="50" width="480" height="18" rx="4" class="sv-cyn-s"></rect><text x="638" y="67" class="sv-lbl-hi">16pF</text><text x="12" y="91" class="sv-lbl">容差</text><rect x="150" y="74" width="15" height="18" rx="4" class="sv-amb-s"></rect><text x="173" y="91" class="sv-lbl-hi">0.5pF</text></svg>
```



CL=16.0pF 与规格 16pF 匹配（误差 0.0），起振可靠；偏离会起振慢/不振。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 电源 | 量电压 | 无电怀疑固件 |
| 晶振 | 量起振 | 电容不匹配 |
| 复位 | 量电平 | 不可靠 |
| BOOT/调试 | 确认 | 模式/连线错 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **负载电容不匹配** ：起振慢或不振。

- **不等 PLL 锁定** ：切换时钟失败。

- **BOOT 电平错** ：启动模式错误。

- **调试口过长** ：连不上。



◆ 自测 · Module 04（先答再看）




1. 晶振“偶发不启动”常见原因是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"负载电容不匹配、起振余量不足、布线过长或受干扰。应核对晶振规格并测量起振时间与幅度。"}
   ```

2. 负载电容公式是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CL=(C1·C2)/(C1\\+C2)\\+Cstray。要让它匹配晶振规格（本例 16pF）。"}
   ```

3. 切到 PLL 时钟前必须做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"等待 PLL 锁定（PLLRDY）。未锁定就切换会导致系统不稳定或跑飞。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按你晶振规格算负载电容并核对最小系统五项（电源/晶振/复位/BOOT/调试口）。



核对与延伸：[ESP32 硬件设计指南](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/index.html)

 

动手练习



运行 ` labs/host_xtal.c `：按晶振规格计算负载电容并核对起振/最小系统。



**检查结果：** C1=C2=22pF、Cstray≈5pF → CL=16.0pF（匹配规格 16pF±0.5）；起振并等 PLL 锁定后切时钟。

 

迁移练习：把本章的“能按晶振规格计算负载电容 CL 并核对起振条件，搭出稳定最小系统。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m04","criterion":"C1=C2=22pF、Cstray≈5pF → CL=16.0pF（匹配规格 16pF±0.5）；起振并等 PLL 锁定后切时钟。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
