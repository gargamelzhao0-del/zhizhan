# 综合：从采样到闭环与 AI 特征

```zhizhan-anchor
m10
```



综合项目把全册串起来： **采样（抗混叠）→ 滤波 → 特征 → 状态估计 → 控制** ，同时把特征喂给端侧 AI。

 

> 前置：完成 M01–M09。 · ◷ 约 46 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把采样→滤波→特征→估计→控制串成链并量化端到端延迟与时间对齐。

 

本章速览




- 端到端预算总延迟与时间对齐。

- 各环节口径一致，否则整链不可信。

- 异常数据不进控制。

 

```zhizhan-anchor
m10-chain
```



```zhizhan-anchor
m10-chain-t
```



## 10.1 端到端链路



把采样（抗混叠）→ 滤波 → 特征 → 状态估计 → 控制串成一条链，同时把特征喂给端侧 AI。要对齐时间、控制延迟、处理异常。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  采样到控制与 AI 的链路



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="采样到控制与 AI 的链路" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">采样</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">滤波</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">特征/估计</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">控制</text></svg>
```



采样（抗混叠）→ 滤波 → 特征（喂 AI）→ 状态估计 → 控制（限幅）。任一口径不一致则输出不可信。



表 10.1 链路五环节



| 环节 | 验收 | 风险 |
| --- | --- | --- |
| 采样 | 无混叠/同步 | 抖动/不同步 |
| 滤波 | 延迟在预算内 | 延迟削相位 |
| 特征 | 口径一致 | 与训练不符 |
| 估计 | 不发散 | 异常观测 |
| 控制 | 稳定\+限幅 | 振荡/饱和 |



chain.txt 节选Text

 

```text
总延迟 = ADC + 滤波 + 特征 + 估计 + 控制（求和，单位采样周期/ms）
时间对齐: 特征与 AI 输入用同一时间基准（事件时间）
控制守限幅 [0,10]；异常观测据创新剔除
闭环相位预算: 总延迟折算相位滞后 < 相位裕度
```

端到端延迟预算 \+ 时间对齐 \+ 控制约束



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：频谱特征



链路中的“特征”环节可用 DFT 频谱特征验证：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_dft.cC\n\n \n\n```text\n/* host_dft.c —— DFT 幅度与峰值检测（N=8）（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_dft.c -o host_dft -lm && ./host_dft\n */\n#include <stdio.h>\n#include <math.h>\nint main(void) {\n    int ok = 1;\n    int N = 8;\n    double x[8];\n    for (int n=0;n<N;n++) x[n] = cos(2*3.14159265358979*2*n/N);   /* 频率 bin=2 */\n    int peak = 0; double pmax = 0;\n    for (int k=0;k<N;k++) {\n        double re=0, im=0;\n        for (int n=0;n<N;n++){ re += x[n]*cos(2*3.14159265358979*k*n/N); im -= x[n]*sin(2*3.14159265358979*k*n/N); }\n        double mag = sqrt(re*re+im*im);\n        if (mag > pmax) { pmax = mag; peak = k; }\n    }\n    printf(\"峰值 bin=%d（期望 2）幅度=%.2f\\n\", peak, pmax);\n    if (peak != 2) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\nDFT/特征模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_dft.c -o labs/host_dft && ./labs/host_dft
峰值 bin=2（期望 2）幅度=4.00
RESULT: PASS
```



频谱峰值可作为 AI 特征；它必须与训练口径一致，并计入链路延迟预算。



表 10.2 关键机制与证据



| 环节 | 可运行证据 | 验收 |
| --- | --- | --- |
| 采样 | host\_sample.c | 无混叠 |
| 滤波 | host\_filter.c | 延迟预算 |
| 特征 | host\_dft.c | 峰值/口径 |
| 估计 | host\_kalman.c | 不发散 |
| 控制 | host\_pid.c | 限幅/收敛 |



```zhizhan-anchor
m10-budget
```



```zhizhan-anchor
m10-budget-t
```



## 10.3 延迟与时间对齐



端到端要量化：采样到控制的总延迟、特征到 AI 的时间对齐；任何环节口径不一致，整条链输出都不可信。



chain.txt 节选Text

 

```text
总延迟 = ADC + 滤波 + 特征 + 估计 + 控制（求和，单位采样周期/ms）
时间对齐: 特征与 AI 输入用同一时间基准（事件时间）
控制守限幅 [0,10]；异常观测据创新剔除
闭环相位预算: 总延迟折算相位滞后 < 相位裕度
```

端到端延迟预算 \+ 时间对齐 \+ 控制约束



表 10.3 端到端预算



| 预算项 | 做法 | 避免 |
| --- | --- | --- |
| 总延迟 | 各段求和 | 超期 |
| 时间对齐 | 同基准 | 错配 |
| 相位 | 延迟\<裕度 | 振荡 |
| 异常 | 创新剔除 | 坏数据进控制 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



链路自检：无混叠、延迟在预算内、口径一致、估计不发散、控制限幅。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  端到端延迟构成（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="端到端延迟构成（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">ADC</text><rect x="150" y="26" width="60" height="18" rx="4" class="sv-cyn-s"></rect><text x="218" y="43" class="sv-lbl-hi">10%</text><text x="12" y="67" class="sv-lbl">滤波</text><rect x="150" y="50" width="180" height="18" rx="4" class="sv-amb-s"></rect><text x="338" y="67" class="sv-lbl-hi">30%</text><text x="12" y="91" class="sv-lbl">特征</text><rect x="150" y="74" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="91" class="sv-lbl-hi">25%</text><text x="12" y="115" class="sv-lbl">估计/控制</text><rect x="150" y="98" width="210" height="18" rx="4" class="sv-grn-s"></rect><text x="368" y="115" class="sv-lbl-hi">35%</text></svg>
```



总延迟 = ADC \+ 滤波 \+ 特征 \+ 估计 \+ 控制。滤波与特征常占大头，需在相位预算内。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 采样 | 无混叠/同步 | 假频率 |
| 延迟 | 求和预算 | 超期 |
| 口径 | 特征一致 | AI 分布偏 |
| 控制 | 限幅/收敛 | 振荡 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **延迟未预算** ：闭环/特征超时。

- **时间未对齐** ：特征与控制错配。

- **口径不一致** ：AI 输入分布偏。

- **异常未处理** ：坏数据进控制。



◆ 自测 · Module 10（先答再看）




1. 端到端闭环最容易被忽略的预算是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"“采样→控制”的总延迟（含滤波与计算）。它直接削减相位裕度、影响稳定性，必须在设计阶段预算并测量。"}
   ```

2. 为什么特征与 AI 输入要“时间对齐”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"特征与控制/推理用同一时间基准（事件时间）才能正确配对；时间错配会导致“用旧特征做新决策”。"}
   ```

3. 链路中“异常观测”应该怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"据创新序列识别离群观测，剔除或降权，避免坏数据进入估计与控制。绝不能伪造补值。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：画出你的“采样→滤波→特征→估计→控制/ AI”链路，给出端到端延迟预算与时间对齐方案。



核对与延伸：[CMSIS-DSP 文档](https://arm-software.github.io/CMSIS-DSP/main/) · [PID 控制入门](https://en.wikipedia.org/wiki/PID_controller)

 

动手练习



运行 ` labs/host_dft.c `（频谱特征）；画出采样→控制→AI 链路与延迟预算。



**检查结果：** 链路延迟可预算；时间对齐；控制守限幅 \[0,10\]；特征口径一致。

 

迁移练习：把本章的“能把采样→滤波→特征→估计→控制串成链并量化端到端延迟与时间对齐。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m10","criterion":"链路延迟可预算；时间对齐；控制守限幅 [0,10]；特征口径一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
