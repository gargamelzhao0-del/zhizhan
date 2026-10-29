# PCB、EMC 与首板检查

```zhizhan-anchor
m09
```



PCB 与 EMC 的核心是 **控制回流路径与回路面积** ：完整地平面、短回流、就近去耦、高速线参考平面连续。

 

> 前置：了解 PCB 布局、地平面与 EMC 的基本概念。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按回流路径/回路面积规划叠层与去耦，并按清单逐项检查首板。

 

本章速览




- PCB/EMC 核心是控制回流与回路面积。

- 地平面完整、去耦就近、参考连续。

- 首板按清单逐级确认。

 

```zhizhan-anchor
m09-pcb
```



```zhizhan-anchor
m09-pcb-t
```



## 9.1 回流路径与回路面积



EMC 的核心是控制回流路径：完整地平面给回流最短路径，回路面积小则辐射/敏感度低；高速线参考平面要连续，地被割裂会迫使回流绕行。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  回流路径与回路面积



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="回流路径与回路面积" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">信号线（去路）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">完整地平面（回流）</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">回路面积（越小越好）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="165.0" class="sv-lbl-hi">地割裂 → 绕行/辐射</text></svg>
```



完整地平面 → 回流就近返回、回路面积小；地割裂 → 回流绕远、回路大、EMC 差。



表 9.1 PCB/EMC 五要素



| 要素 | 要点 | 坑 |
| --- | --- | --- |
| 叠层/地 | 完整地平面 | 地被割裂 |
| 回路面积 | 越小越好 | 大回路=辐射/敏感 |
| 去耦 | 就近引脚 | 离太远无效 |
| 回流 | 沿最小阻抗返回 | 跨分割 |
| EMC | 辐射/抗扰 | 只堆器件不控布局 |



layout.txt 节选Text

 

```text
完整地平面：回流走最短路径，回路面积最小
去耦电容贴芯片电源引脚，地回路最短
高速线参考平面连续，不跨地分割
终端匹配 z0，减少反射/EMI
```

完整地平面\+短回流\+就近去耦\+连续参考



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：阻抗/反射直觉



用终端/反射模型理解“阻抗不匹配”的危害（PCB 走线同理）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_term.cC\n\n \n\n```text\n/* host_term.c —— 总线终端与反射：传输线阻抗匹配（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_term.c -o host_term && ./host_term\n */\n#include <stdio.h>\n#include <math.h>\nint main(void) {\n    int ok = 1;\n    /* 特征阻抗 120Ω 的 CAN 总线：两端各 120Ω 终端，等效 60Ω */\n    float z0 = 120.0f, rterm = 120.0f;\n    float z_eff = 1.0f/(1.0f/rterm + 1.0f/rterm);\n    printf(\"两端 120Ω 终端 → 等效 %.0fΩ（应匹配 z0=120Ω 的差分）\\n\", z_eff);\n    /* 反射系数：负载 ZL 与 z0 */\n    float zl_bad = 1000.0f;\n    float gamma = (zl_bad - z0) / (zl_bad + z0);\n    printf(\"失配负载 1k 的反射系数=%.2f（越接近 0 越好）\\n\", gamma);\n    if (fabsf(gamma) < 0.5f) ok = 0;              /* 失配明显 */\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n终端/反射模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_term.c -o labs/host_term && ./labs/host_term
两端 120Ω 终端 → 等效 60Ω
失配负载 1k 的反射系数=0.79
RESULT: PASS
```



阻抗不匹配会产生反射（系数 0.79）；PCB 走线/终端要匹配特征阻抗以控反射与 EMI。



表 9.2 布局与阻抗



| 项 | 做法 | 目的 |
| --- | --- | --- |
| 地平面 | 完整 | 回流最短 |
| 去耦 | 贴引脚 | 瞬态供电 |
| 参考平面 | 连续 | 无跨分割 |
| 终端 | 匹配 z0 | 减反射 |



```zhizhan-anchor
m09-first
```



```zhizhan-anchor
m09-first-t
```



## 9.3 首板检查清单



首板按“电源→时钟→复位→调试→外设”顺序逐项确认；每级用测量取证，避免在错误分支浪费时间。



firstboard.txt 节选Text

 

```text
1) 电源: 量 VDD/VCORE 在规格、纹波可接受
2) 时钟: 晶振起振、PLL 锁定
3) 复位: 电平正确、复脉冲正常
4) 调试: SWD/JTAG 连通
5) 外设: 关键总线波形正常
```

首板按电源→时钟→复位→调试→外设逐级检查



表 9.3 首板分级检查



| 级 | 检查 | 依据 |
| --- | --- | --- |
| 电源 | VDD/VCORE/纹波 | 电压/示波器 |
| 时钟 | 起振/PLL | 频率计 |
| 复位 | 电平/脉冲 | 示波器 |
| 外设 | 总线波形 | 示波器/逻辑分析仪 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



PCB 自检：地完整、回路小、去耦就近、参考连续、首板逐项检查。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  回路面积与辐射（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="回路面积与辐射（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">小回路</text><rect x="150" y="26" width="120" height="18" rx="4" class="sv-grn-s"></rect><text x="278" y="43" class="sv-lbl-hi">20(相对辐射)</text><text x="12" y="67" class="sv-lbl">大回路</text><rect x="150" y="50" width="540" height="18" rx="4" class="sv-red-s"></rect><text x="698" y="67" class="sv-lbl-hi">90(相对辐射)</text></svg>
```



回路面积越大，辐射与敏感度越高。完整地平面 \+ 短回流能显著降低回路面积。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 地平面 | 完整连续 | 被割裂 |
| 去耦 | 贴引脚 | 远离 |
| 参考 | 连续 | 跨分割 |
| 首板 | 逐级检查 | 乱查 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **地平面割裂** ：回流绕远，辐射/误码。

- **去耦远离** ：瞬态供电差。

- **回路面积大** ：EMC 差。

- **跳过检查** ：首板问题排查低效。



◆ 自测 · Module 09（先答再看）




1. 为什么“地平面完整”对 EMC 很重要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"完整地平面给回流电流提供最短路径，回路面积小、辐射与敏感度低。地被割裂会迫使回流绕行、增大回路，恶化 EMC。"}
   ```

2. 为什么高速线不能“跨地分割”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"跨分割会让回流绕远、回路面积骤增，导致阻抗突变/辐射/误码。高速线参考平面必须连续。"}
   ```

3. 首板检查为什么要按“电源→时钟→复位→调试→外设”顺序？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"这是依赖顺序：没有电源/时钟/复位，后面都无从谈起。按序逐级取证能最快收敛，避免在错误分支浪费时间。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按“回流路径/回路面积”审查你一块 PCB 的布局，并用首板清单逐项检查。



核对与延伸：[ESP32 硬件设计指南](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/index.html)

 

动手练习



运行 ` labs/host_term.c `（阻抗/反射直觉）；按检查清单逐项核对首板。



**检查结果：** 地平面完整、去耦就近、关键线参考平面连续；终端等效 60Ω、失配反射系数=0.79；首板检查逐项通过。

 

迁移练习：把本章的“能按回流路径/回路面积规划叠层与去耦，并按清单逐项检查首板。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m09","criterion":"地平面完整、去耦就近、关键线参考平面连续；终端等效 60Ω、失配反射系数=0.79；首板检查逐项通过。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
