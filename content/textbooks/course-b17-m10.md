# 综合：新板上电与故障树

```zhizhan-anchor
m10
```



综合项目把测量与电路知识变成 **故障树** ：从“现象”逐级判断到根因，每一步都有测量依据。

 

> 前置：完成 M01–M09，具备电源/时钟/复位/测量与板级基础。 · ◷ 约 46 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按现象→检查→依据构建故障树，先测量再判断，快速收敛到根因。

 

本章速览




- 新板上电按故障树逐级排查。

- 先测量再判断，别靠换件试错。

- 现象→检查→依据 形成故障树。

 

```zhizhan-anchor
m10-tree
```



```zhizhan-anchor
m10-tree-t
```



## 10.1 先测量再判断



把测量与电路知识变成故障树：从现象逐级判断到根因，每一步都有测量依据。关键是“先测量再判断”，避免在错误分支浪费时间。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  新板上电故障树



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="新板上电故障树" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">电源/复位</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">时钟/BOOT</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">调试口</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">外设总线</text></svg>
```



完全没反应→查电源/复位；不启动→查时钟/BOOT；连不上调试→查调试口/供电；外设不工作→查供电/总线。



表 10.1 现象→检查→依据



| 现象 | 先查 | 依据 |
| --- | --- | --- |
| 完全没反应 | 电源/复位 | 电压/复位电平 |
| 不启动 | 时钟/BOOT | 起振/启动模式 |
| 连不上调试 | 调试口/供电 | SWD/电压 |
| 外设不工作 | 供电/总线/复用 | 波形/电平 |
| 偶发异常 | 电源/地/EMC | 纹波/回流 |



faulttree.txt 节选Text

 

```text
完全没反应 -> 量 VDD/VCORE -> 无电则查供电/短路
不启动 -> 量晶振起振/PLL -> 不起则查负载电容
连不上调试 -> 量 SWD 电压/信号 -> 检查接线长度
外设不工作 -> 示波器看总线波形 -> 查终端/复用
```

现象→检查→依据，逐级取证到根因



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：基本计算



故障树每一步都要有计算/测量依据；用基本计算模型验证：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_ohm.cC\n\n \n\n```text\n/* host_ohm.c —— 欧姆定律/分压/LED 限流/功率（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ohm.c -o host_ohm && ./host_ohm\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    float vs = 5.0f, r1 = 10000, r2 = 10000;\n    float vout = vs * r2 / (r1 + r2);\n    printf(\"分压 10k/10k @5V → %.2fV（期望 2.50）\\n\", vout);\n    if (vout < 2.49f || vout > 2.51f) ok = 0;\n    /* LED 限流：5V - 2V = 3V, 目标 10mA → R=300Ω */\n    float rled = (5.0f - 2.0f) / 0.010f;\n    printf(\"LED 限流 R=%.0fΩ 功率=%.3fW\\n\", rled, (5.0f-2.0f)*0.010f);\n    if (rled < 299 || rled > 301) ok = 0;\n    /* 功耗：10V, 100Ω → 1W */\n    float p = 10.0f*10.0f/100.0f;\n    printf(\"功率 10V/100Ω = %.2fW（期望 1.00）\\n\", p);\n    if (p < 0.99f || p > 1.01f) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n欧姆定律/分压/功率模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ohm.c -o labs/host_ohm && ./labs/host_ohm
分压 10k/10k @5V → 2.50V（期望 2.50）
LED 限流 R=300Ω 功率=0.030W
功率 10V/100Ω = 1.00W（期望 1.00）
RESULT: PASS
```



排查中的分压/限流/功率计算都有预期值，与实测比较才能判断对错。



表 10.2 每级的依据



| 级 | 检查 | 计算/测量依据 |
| --- | --- | --- |
| 电源 | 电压/纹波 | 分压/功率 |
| 时钟 | 起振/PLL | 频率 |
| 复位 | 电平/脉冲 | RC/阈值 |
| 外设 | 波形 | 终端/电平 |



```zhizhan-anchor
m10-practice
```



```zhizhan-anchor
m10-practice-t
```



## 10.3 故障树实践



每一级都用电压/波形/连通性取证；常见现象到根因要有映射，避免每次从零开始。



faulttree.txt 节选Text

 

```text
完全没反应 → 量 VDD/VCORE → 无电则查供电/短路
不启动 → 量晶振起振/PLL → 不起则查负载电容
连不上调试 → 量 SWD 电压/信号 → 检查接线长度
外设不工作 → 示波器看总线波形 → 查终端/复用
```

现象→检查→依据，逐级取证到根因



表 10.3 故障树实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 先测量 | 取证 | 凭猜换件 |
| 按序排查 | 效率 | 乱查 |
| 记录依据 | 可复盘 | 经验流失 |
| 维护故障树 | 复用 | 每次从零 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



故障树自检：覆盖各级、每级有依据、按序排查、可复盘。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  首板问题分布（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="首板问题分布（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">电源/焊接</text><rect x="150" y="26" width="240" height="18" rx="4" class="sv-red-s"></rect><text x="398" y="43" class="sv-lbl-hi">40%</text><text x="12" y="67" class="sv-lbl">时钟</text><rect x="150" y="50" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="67" class="sv-lbl-hi">25%</text><text x="12" y="91" class="sv-lbl">复位</text><rect x="150" y="74" width="120" height="18" rx="4" class="sv-cyn-s"></rect><text x="278" y="91" class="sv-lbl-hi">20%</text><text x="12" y="115" class="sv-lbl">其他</text><rect x="150" y="98" width="90" height="18" rx="4" class="sv-box"></rect><text x="248" y="115" class="sv-lbl-hi">15%</text></svg>
```



首板问题多集中在电源/焊接/时钟/复位；按序排查能最快定位。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 定现象 | 分类 | 描述含糊 |
| 按序查 | 电源→时钟→复位 | 乱查 |
| 取证 | 电压/波形/连通 | 凭猜 |
| 收敛 | 到根因 | 换件试错 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **无顺序乱查** ：效率低。

- **不测量凭猜** ：换零件试错。

- **跳过电源/时钟** ：在错误分支浪费时间。

- **不做故障树** ：每次从零开始。



◆ 自测 · Module 10（先答再看）




1. 新板“完全没反应”，第一级查什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"电源与复位。先量 VDD/VCORE 是否在规格、复位电平是否正确，再查晶振与调试口；不要在没电源的情况下怀疑固件。"}
   ```

2. 为什么故障树要“先测量再判断”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"测量取证能把判断建立在事实上，避免凭经验换件试错（既慢又可能引入新问题）。"}
   ```

3. “外设不工作”一般先查什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"供电、总线波形、引脚复用。用示波器/逻辑分析仪看总线是否有正确波形，再查复用配置与外设使能。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你板子画一张“现象→检查→依据”的故障树，并做一次新板上电按序排查演练。



核对与延伸：[All About Circuits](https://www.allaboutcircuits.com/textbook/) · [TI 电源设计参考](https://www.ti.com/power-management/overview.html)

 

动手练习



运行 ` labs/host_ohm.c `（基本计算）；为你的板子画“现象→检查→依据”的故障树。



**检查结果：** 故障树覆盖电源→时钟→复位→调试→外设，每级有测量依据；基本计算与 host\_ohm.c 一致。

 

迁移练习：把本章的“能按现象→检查→依据构建故障树，先测量再判断，快速收敛到根因。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m10","criterion":"故障树覆盖电源→时钟→复位→调试→外设，每级有测量依据；基本计算与 host_ohm.c 一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
