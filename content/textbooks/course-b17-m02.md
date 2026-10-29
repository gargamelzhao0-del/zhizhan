# 数字电平与引脚电气

```zhizhan-anchor
m02
```



数字电路不是“理想的 0/1”：有 **门限电平、驱动能力、上升时间** 与 ESD 限制。开漏总线的高电平靠 **上拉电阻** 。

 

> 前置：了解逻辑 0/1 与输入门限（VIH/VIL）的基本概念。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按 VIH/VIL 与驱动能力配置上拉/开漏，用上升时间估算满足总线速率。

 

本章速览




- 数字电路有门限、驱动能力与上升时间。

- 开漏必须上拉；上升时间≈0.8473RC。

- 输入不能悬空。

 

```zhizhan-anchor
m02-level
```



```zhizhan-anchor
m02-level-t
```



## 2.1 门限、驱动、上升时间



数字电路有门限电平（VIH/VIL）、驱动能力（灌/拉电流）、上升时间与 ESD 限制。开漏只能拉低，高电平靠上拉电阻。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  开漏总线靠上拉充电



```zhizhan-figure
<svg viewBox="0 0 800 86" width="100%" height="86" role="img" aria-label="开漏总线靠上拉充电" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V60"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V60"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M460,26 V60"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M615,26 V60"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M770,26 V60"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><text x="12" y="48" class="sv-lbl">SCL/SDA</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="103" height="22" rx="4" class="sv-box"></rect><text x="201.7" y="47" text-anchor="middle" class="sv-lbl-hi">低</text><rect x="253" y="32" width="310" height="22" rx="4" class="sv-cyn-s"></rect><text x="408.3" y="47" text-anchor="middle" class="sv-lbl-hi">上升(RC)</text><rect x="563" y="32" width="207" height="22" rx="4" class="sv-grn-s"></rect><text x="666.7" y="47" text-anchor="middle" class="sv-lbl-hi">高</text></svg>
```



器件拉低=0；释放后由上拉电阻给总线电容充电上升，上升到门限才判高。RC 决定上升时间。



表 2.1 引脚电气五概念



| 概念 | 含义 | 影响 |
| --- | --- | --- |
| VIH/VIL | 输入门限 | 电平不够识别错 |
| 上拉/下拉 | 确定默认电平 | 悬空乱跳 |
| 开漏 | 只能拉低 | 高电平靠上拉 |
| 驱动电流 | 灌/拉能力 | 驱动 LED/总线 |
| 上升时间 | RC 充电 | 总线速率上限 |



pullup.c 节选C

 

```text
double tr = 0.8473 * 4700 * 30e-12;        // 4.7k / 30pF ≈ 119ns
if (tr < 300e-9) ok = 1;                   // 400kHz 快速模式
double il = 3.3 / 1000;                    // 1k 上拉低电平电流=3.3mA
```

按总线电容选上拉，兼顾速率与功耗



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：上拉与上升时间



下面这段程序验证上拉与上升时间估算：



host\_pullup.cC

 

```text
/* host_pullup.c —— 上拉电阻与开漏总线的上升时间估算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pullup.c -o host_pullup -lm && ./host_pullup
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    /* I2C 快速模式 400kHz 要求上升时间 < 300ns；t_r ≈ 0.8473*R*C */
    float R = 4700, C = 30e-12f;              /* 4.7k, 30pF */
    float tr = 0.8473f * R * C * 1e9f;          /* ns */
    printf("上拉 4.7k / 总线电容 30pF → 上升时间 ≈ %.0fns\n", tr);
    int fast_ok = tr < 300.0f;
    printf("满足 400kHz 快速模式(<300ns)=%d\n", fast_ok);
    if (!fast_ok) ok = 0;
    /* 上拉过小 → 功耗大（低电平时电流） */
    float i = 3.3f / 1000.0f;                    /* 1k 上拉 3.3V */
    printf("1k 上拉低电平电流=%.1fmA（功耗权衡）\n", i*1000);
    if (i <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

上拉/上升时间模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_pullup.c -o labs/host_pullup && ./labs/host_pullup
上拉 4.7k / 总线电容 30pF → 上升时间 ≈ 119ns
满足 400kHz 快速模式(<300ns)=1
1k 上拉低电平电流=3.3mA（功耗权衡）
RESULT: PASS
```



t\_r≈0.8473·R·C=119ns\<300ns（满足 400kHz）；1k 上拉低电平电流≈3.3mA（功耗权衡）。



表 2.2 上拉计算



| 参数 | 值 | 判据 |
| --- | --- | --- |
| 上拉 | 4.7k@100kHz / 2.2k@400kHz | 常见取值 |
| 上升时间 | 0.8473·R·C | 119ns |
| 快速模式 | t\_r\<300ns | 通过 |
| 低电平电流 | V/R | 3.3mA@1k |



```zhizhan-anchor
m02-choose
```



```zhizhan-anchor
m02-choose-t
```



## 2.3 上拉取舍与驱动



[I²C](term:i2c) 要按总线电容选上拉：上拉越大上升越慢（限制速率），越小功耗越大；驱动电流不能超引脚规格。



pullup.c 节选C

 

```text
double tr = 0.8473 * 4700 * 30e-12;        // 4.7k / 30pF ≈ 119ns
if (tr < 300e-9) ok = 1;                   // 400kHz 快速模式
double il = 3.3 / 1000;                    // 1k 上拉低电平电流=3.3mA
```

按总线电容选上拉，兼顾速率与功耗



表 2.3 上拉与驱动



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 上拉取值 | 匹配速率/功耗 | 过大上升慢 |
| 开漏\+上拉 | 线与总线 | 无上拉出不了高 |
| 驱动限流 | 不超引脚 | 超规格损坏 |
| 下拉/上拉 | 定默认电平 | 悬空乱跳 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



引脚自检：门限满足、上拉匹配、驱动不超限、上升时间达标。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  上升时间 vs 上拉（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="上升时间 vs 上拉（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">2.2k</text><rect x="150" y="26" width="112" height="18" rx="4" class="sv-grn-s"></rect><text x="270" y="43" class="sv-lbl-hi">56ns</text><text x="12" y="67" class="sv-lbl">4.7k</text><rect x="150" y="50" width="238" height="18" rx="4" class="sv-cyn-s"></rect><text x="396" y="67" class="sv-lbl-hi">119ns</text><text x="12" y="91" class="sv-lbl">10k</text><rect x="150" y="74" width="508" height="18" rx="4" class="sv-red-s"></rect><text x="666" y="91" class="sv-lbl-hi">254ns</text></svg>
```



上拉越大上升越慢；要在总线速率要求内，同时兼顾低电平电流功耗。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 门限 | 查 VIH/VIL | 电平不够 |
| 上拉 | 按电容算 | 过大过小 |
| 驱动 | 查灌/拉电流 | 超规格 |
| 上升时间 | 0.8473RC | 超速率上限 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **输入悬空** ：电平乱跳。

- **开漏无上拉** ：永远出不了高电平。

- **驱动超限** ：引脚电流超规格。

- **上拉过大且电容高** ：上升慢，通信失败。



◆ 自测 · Module 02（先答再看）




1. 开漏输出为什么一定要上拉？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"开漏只能把线拉低，释放后是高阻；没有上拉就无法提供高电平。上拉电阻决定上升时间与功耗。"}
   ```

2. 为什么上拉电阻“越大越好”是错的？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"上拉越大，RC 上升越慢，可能超过总线速率要求的上升时间；同时要兼顾低电平电流（功耗）。要按总线电容与速率取值。"}
   ```

3. 引脚驱动 LED 前要确认什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"引脚的灌/拉电流上限与 LED 电流需求。超规格会损坏引脚；不足则驱动不了，需要驱动级。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的开漏总线按总线电容算上升时间并选上拉，核对满足目标速率。



核对与延伸：[All About Circuits](https://www.allaboutcircuits.com/textbook/) · [ESP32 硬件设计指南](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/index.html)

 

动手练习



运行 ` labs/host_pullup.c `：验证上拉与上升时间估算满足快速模式。



**检查结果：** 4.7k/30pF → t\_r≈119ns \< 300ns（满足 400kHz 快速模式）；1k 上拉 3.3V 低电平电流≈3.3mA。

 

迁移练习：把本章的“能按 VIH/VIL 与驱动能力配置上拉/开漏，用上升时间估算满足总线速率。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m02","criterion":"4.7k/30pF → t_r≈119ns < 300ns（满足 400kHz 快速模式）；1k 上拉 3.3V 低电平电流≈3.3mA。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
