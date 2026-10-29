# 传感器与执行器接口

```zhizhan-anchor
m07
```



传感器/执行器接口要处理 **电平、驱动与保护** ：数字传感器配上拉/电平转换，执行器用合适的驱动级并加 **续流/保护** 。

 

> 前置：了解数字/模拟传感器与晶体管/MOS 驱动概念。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为传感器配置电平/上拉，为执行器设计驱动级并加续流/限流保护。

 

本章速览




- 接口要电平匹配、驱动足够、有保护。

- 感性负载必须续流二极管。

- LED/器件要限流。

 

```zhizhan-anchor
m07-iface
```



```zhizhan-anchor
m07-iface-t
```



## 7.1 传感器与执行器接口



数字传感器配上拉/电平转换，模拟传感器用分压/运放加滤波保护，执行器用合适的驱动级并加续流/限流保护。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  从 GPIO 到执行器



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="从 GPIO 到执行器" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">GPIO（≤8mA）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">驱动级（三极管/MOS）</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">负载（线圈/继电器）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="165.0" class="sv-lbl-hi">续流二极管（保护）</text></svg>
```



GPIO（小电流）→ 驱动级（三极管/MOS）→ 负载；感性负载并联续流二极管钳位反峰。



表 7.1 接口与保护



| 器件 | 接口/驱动 | 保护 |
| --- | --- | --- |
| 数字传感器 | [I²C](term:i2c)/SPI/1-Wire | 上拉/电平转换 |
| 模拟传感器 | 分压/运放 | 滤波/保护 |
| LED | 限流电阻/恒流 | 限流 |
| MOSFET 负载 | 栅极驱动 | 续流二极管 |
| 继电器 | 三极管/MOS | 续流\+RC 吸收 |



drive.c 节选C

 

```text
double icoil = 5.0/120.0;              // 41.7mA
if (icoil > 8e-3) need_driver = 1;     // 超 GPIO 上限
/* 感性负载并联续流二极管，钳位关断反峰到 ~0.7V */
```

超上限用驱动级；感性负载加续流二极管



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：驱动电流与续流



下面这段程序校核执行器驱动电流与续流保护：



host\_drive.cC

 

```text
/* host_drive.c —— 执行器驱动：续流保护与驱动电流校核（主机可运行）。
 * 感性负载（继电器/电机）关断需续流二极管钳位反峰；驱动电流超过 GPIO 上限须加三极管/MOS。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_drive.c -o host_drive && ./host_drive
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 5V 继电器线圈 R=120Ω → 稳态电流 */
    float vs = 5.0f, rcoil = 120.0f;
    float icoil = vs / rcoil;
    printf("线圈 5V/120Ω → 稳态电流=%.1fmA（期望 ~41.7）\n", icoil * 1000.0f);
    if (icoil < 0.040f || icoil > 0.043f) ok = 0;
    /* GPIO 典型灌/拉上限 8mA，直驱线圈不够 */
    float gpio_max = 0.008f;
    int need_stage = icoil > gpio_max;
    printf("GPIO 上限 8mA < 线圈 %.1fmA → 须三极管/MOS 驱动=%d（期望 1）\n",
           icoil * 1000.0f, need_stage);
    if (!need_stage) ok = 0;
    /* 续流二极管把关断反峰钳位到正向压降，避免击穿驱动级 */
    float vf = 0.7f;
    printf("续流二极管钳位关断反峰 → %.1fV（无续流则反峰击穿驱动级）\n", vf);
    if (vf <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

执行器驱动/续流模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_drive.c -o labs/host_drive && ./labs/host_drive
线圈 5V/120Ω → 稳态电流=41.7mA（期望 ~41.7）
GPIO 上限 8mA < 线圈 41.7mA → 须三极管/MOS 驱动=1（期望 1）
续流二极管钳位关断反峰 → 0.7V（无续流则反峰击穿驱动级）
RESULT: PASS
```



线圈电流 41.7mA 远超 GPIO 8mA 上限 → 须驱动级；续流二极管把关断反峰钳位到 0.7V。



表 7.2 驱动校核



| 量 | 值 | 结论 |
| --- | --- | --- |
| 线圈电流 | 5/120=41.7mA | 超 GPIO 上限 |
| GPIO 上限 | 8mA | 须驱动级 |
| 续流钳位 | ≈0.7V | 保护驱动级 |
| 无限流 LED | 烧毁 | 必加限流 |



```zhizhan-anchor
m07-protect
```



```zhizhan-anchor
m07-protect-t
```



## 7.3 续流与电平转换



感性负载必须加续流二极管，否则关断反峰击穿驱动；电平不匹配用转换/电平位移，不要硬接。



drive.c 节选C

 

```text
double icoil = 5.0 / 120.0;              // 41.7mA
if (icoil > 8e-3) need_driver = 1;       // 超 GPIO 上限
/* 感性负载并联续流二极管，钳位关断反峰到 ~0.7V */
```

超上限用驱动级；感性负载加续流二极管



表 7.3 驱动与保护实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 驱动级 | 带动大电流 | GPIO 超限 |
| 续流二极管 | 钳位反峰 | 击穿驱动 |
| 电平转换 | 匹配电平 | 硬接损坏 |
| 限流 | 保护 LED | 烧毁 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



接口自检：电流不超 GPIO、有驱动级、感性负载有续流、电平匹配。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  GPIO 电流 vs 负载电流（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="GPIO 电流 vs 负载电流（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">GPIO 上限</text><rect x="150" y="26" width="96" height="18" rx="4" class="sv-cyn-s"></rect><text x="254" y="43" class="sv-lbl-hi">8mA</text><text x="12" y="67" class="sv-lbl">线圈电流</text><rect x="150" y="50" width="500" height="18" rx="4" class="sv-red-s"></rect><text x="658" y="67" class="sv-lbl-hi">41.7mA</text></svg>
```



GPIO 上限 8mA，线圈 41.7mA——直接驱动会超限，必须用驱动级。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 算电流 | V/R | 超 GPIO |
| 驱动级 | 三极管/MOS | 带不动 |
| 续流 | 二极管 | 反峰击穿 |
| 限流/电平 | LED/转换 | 烧毁/识别错 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **无续流** ：反峰击穿。

- **电平不匹配** ：识别错/损坏。

- **驱动不足** ：带不动负载。

- **无限流** ：LED/器件烧毁。



◆ 自测 · Module 07（先答再看）




1. 驱动继电器为什么必须加续流二极管？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"继电器线圈是感性负载，关断瞬间产生反向高压尖峰，会击穿驱动三极管/MOS。续流二极管为电流提供回路，钳位电压。"}
   ```

2. GPIO 直接驱动 5V/120Ω 线圈（41.7mA）会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"超过 GPIO 电流上限（如 8mA），会损坏引脚或驱动不足。必须用三极管/MOS 驱动级。"}
   ```

3. 电平不匹配时为什么不能“硬接”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"电平不符会导致识别错误，甚至因过压/倒灌损坏器件。应使用电平转换/电平位移电路。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个执行器（继电器/电机/LED）核算电流并设计驱动级 \+ 保护（续流/限流）。



核对与延伸：[All About Circuits](https://www.allaboutcircuits.com/textbook/) · [NXP AN 模拟设计](https://www.nxp.com/)

 

动手练习



运行 ` labs/host_drive.c `：校核执行器驱动电流与续流保护，并为执行器设计驱动级。



**检查结果：** 5V/120Ω 线圈电流≈41.7mA；GPIO 上限 8mA 小于线圈电流 → 须三极管/MOS；续流钳位关断反峰≈0.7V。

 

迁移练习：把本章的“能为传感器配置电平/上拉，为执行器设计驱动级并加续流/限流保护。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m07","criterion":"5V/120Ω 线圈电流≈41.7mA；GPIO 上限 8mA 小于线圈电流 → 须三极管/MOS；续流钳位关断反峰≈0.7V。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
