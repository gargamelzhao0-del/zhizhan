# 示波器与逻辑分析仪

```zhizhan-anchor
m08
```



测量工具决定“看得见看不见”： **带宽、采样率、触发方式、探头接地** 。逻辑分析仪擅长协议解码，示波器擅长模拟与时序细节。

 

> 前置：会使用示波器/逻辑分析仪的基本功能。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按信号选探头/带宽与采样率、设置触发捕获偶发事件，并用逻辑分析仪解码协议。

 

本章速览




- 测量工具：带宽/采样/触发/探头接地。

- 数字边沿按上升时间选系统带宽；不要仅看时钟基频。

- 协议问题用逻辑分析仪解码。

 

```zhizhan-anchor
m08-tools
```



```zhizhan-anchor
m08-tools-t
```



## 8.1 带宽、采样、触发、接地



带宽不足会平滑掉真实边沿、甚至把探头振铃当信号；采样不足会混叠；触发决定能否捕获偶发。接地线要短。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  边沿的可测与不可测



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="边沿的可测与不可测" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">10</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">40</text><text x="12" y="48" class="sv-lbl">真实</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="155" height="22" rx="4" class="sv-grn-s"></rect><text x="227.5" y="47" text-anchor="middle" class="sv-lbl-hi">陡</text><text x="12" y="82" class="sv-lbl">带宽不足</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="465" height="22" rx="4" class="sv-red-s"></rect><text x="382.5" y="81" text-anchor="middle" class="sv-lbl-hi">被抹平</text></svg>
```



足够带宽能重建真实边沿；带宽不足把边沿“抹平”，误导判断。



表 8.1 测量工具



| 工具 | 擅长 | 注意 |
| --- | --- | --- |
| 示波器 | 模拟/时序/抖动 | 带宽/探头 |
| 逻辑分析仪 | 多路数字/解码 | 只判高低 |
| 探头 | 信号接入 | 接地线要短 |
| 触发 | 捕获事件 | 单次/边沿 |
| 采样 | 重建波形 | Nyquist |



scope.txt 节选Text

 

```text
选带宽 >=5× 信号频率；采样率 >2× 最高分量
接地弹簧要短；协议用逻辑分析仪解码
偶发用单次/边沿触发；看抖动/眼图评估信号质量
```

按上升时间选带宽、采样留余量、短接地、正确触发



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：RC 带宽直觉



用 RC 模型建立“时间常数↔带宽”的直觉（示波器测边沿时的参照）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_rc.cC\n\n \n\n```text\n/* host_rc.c —— RC 时间常数与滤波截止频率（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_rc.c -o host_rc -lm && ./host_rc\n */\n#include <stdio.h>\n#include <math.h>\nint main(void) {\n    int ok = 1;\n    float r = 10000, c = 1e-6f;\n    float tau = r * c;\n    printf(\"R=10k C=1uF → tau=%.4fs\\n\", tau);\n    if (fabsf(tau - 0.01f) > 1e-5f) ok = 0;\n    float fc = 1.0f/(2.0f*3.14159265f*r*c);\n    printf(\"截止频率 fc=%.1fHz（期望 ~15.9）\\n\", fc);\n    if (fabsf(fc - 15.9f) > 0.2f) ok = 0;\n    /* 5tau 达到约 99.3% */\n    printf(\"5tau 后充电到约 %.1f%%\\n\", (1-expf(-5))*100);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\nRC 时间常数/带宽模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_rc.c -o labs/host_rc && ./labs/host_rc
R=10k C=1uF → tau=0.0100s
截止频率 fc=15.9Hz（期望 ~15.9）
5tau 后充电到约 99.3%
RESULT: PASS
```



τ=RC 与 fc=1/(2πRC) 给出边沿时间与带宽的关系；据此判断示波器带宽是否足够。



表 8.2 测量选取规则



| 规则 | 取值 | 说明 |
| --- | --- | --- |
| 带宽 | ≥5× 信号频率 | 重建边沿 |
| 采样率 | \>2× 最高分量 | Nyquist |
| 接地线 | 尽量短 | 避免振铃 |
| 触发 | 边沿/单次 | 抓偶发 |



```zhizhan-anchor
m08-decode
```



```zhizhan-anchor
m08-decode-t
```



## 8.3 协议解码与抖动



协议问题用逻辑分析仪解码更直观；高速信号看抖动/眼图；注意测量引入的寄生（探头接地过长会看到振铃）。



scope.txt 节选Text

 

```text
选带宽 >=5× 信号频率；采样率 >2× 最高分量
```

接地弹簧要短；协议用逻辑分析仪解码 偶发用单次/边沿触发；看抖动/眼图评估信号质量



表 8.3 按问题选工具



| 问题 | 工具 | 做法 |
| --- | --- | --- |
| 协议错 | 逻辑分析仪 | 解码 |
| 边沿怪 | 示波器 | 短接地 |
| 偶发 | 单次触发 | 条件触发 |
| 抖动 | 眼图 | 统计 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



测量自检：带宽/采样足够、接地短、触发设对、协议可解码。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  带宽需求（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="带宽需求（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">信号 10M</text><rect x="150" y="26" width="100" height="18" rx="4" class="sv-cyn-s"></rect><text x="258" y="43" class="sv-lbl-hi">10MHz</text><text x="12" y="67" class="sv-lbl">5× 带宽</text><rect x="150" y="50" width="500" height="18" rx="4" class="sv-grn-s"></rect><text x="658" y="67" class="sv-lbl-hi">50MHz</text></svg>
```



10MHz/50MHz 仅为基频经验示例。数字信号更应按上升时间选型；近似单极点响应有 t\_r≈0.35/BW，探头与示波器共同影响测量。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 估频率 | 最高分量 | 只看基频 |
| 选带宽 | ≥5× | 边沿失真 |
| 选采样 | \>2×(Nyquist) | 混叠 |
| 触发 | 边沿/单次 | 抓不到偶发 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **带宽不足** ：看不到真实边沿。

- **采样不足** ：混叠误判。

- **接地线过长** ：测到振铃。

- **触发设置错** ：抓不到偶发。



◆ 自测 · Module 08（先答再看）




1. 为什么数字信号不能只按时钟基频选择示波器带宽？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"边沿含高频分量，应按允许的上升时间误差选择探头与示波器的总带宽。单极点近似 t\\_r≈0.35/BW 只是估算；采样率、触发与记录长度也必须满足目标。"}
   ```

2. 探头接地线为什么必须短？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"过长的接地引线有电感，会与探头形成振铃，测到的不是真实信号。用短接地弹簧。"}
   ```

3. 协议问题为什么优先用逻辑分析仪？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"逻辑分析仪多路采样并可直接解码协议，能直观看到帧/位，比用示波器肉眼判高低高效。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用示波器按“上升时间选带宽、采样留余量、短接地”测一次你板的边沿，并与计算对照。



核对与延伸：[All About Circuits](https://www.allaboutcircuits.com/textbook/)

 

动手练习



运行 ` labs/host_rc.c `（时间常数/带宽直觉）；用示波器测一次真实上升沿并与计算对照。



**检查结果：** RC 模型 τ=10.0ms、fc≈15.9Hz 正确；按边沿上升时间和探头/示波器总响应选带宽；采样率、存储深度与触发能保留所需事件，Nyquist 只是带限重建的理论下限。

 

迁移练习：把本章的“能按信号选探头/带宽与采样率、设置触发捕获偶发事件，并用逻辑分析仪解码协议。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m08","criterion":"RC 模型 τ=10.0ms、fc≈15.9Hz 正确；按边沿上升时间和探头/示波器总响应选带宽；采样率、存储深度与触发能保留所需事件，Nyquist 只是带限重建的理论下限。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
