# 电路基本量与测量

```zhizhan-anchor
m01
```



电路分析的起点是量： **电压、电流、电阻、功率** 。欧姆定律与分压/分流是最常用的两把工具。

 

> 前置：了解电压/电流/电阻的基本概念与万用表用法。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用欧姆定律/分压/分流先算后测，并用功率核算不超载。

 

本章速览




- 先算再测：欧姆定律与分压/分流算出预期值。

- LED/器件要限流，注意功率。

- 测量与计算不符先查接法/量程。

 

```zhizhan-anchor
m01-quant
```



```zhizhan-anchor
m01-quant-t
```



## 1.1 先算再测



电路分析的起点是量：电压、电流、电阻、功率。欧姆定律与分压/分流最常用。先算预期值，再用万用表/示波器验证——不符说明电路错或量程/接法错。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  先算后测



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="先算后测" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">算预期</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">测量</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">比较</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">查错</text></svg>
```



用欧姆定律/分压算出预期 → 万用表/示波器测量 → 与预期比较 → 一致则继续，不一致查电路/接法。



表 1.1 五个基本量



| 量 | 关系 | 单位 |
| --- | --- | --- |
| 电压 V | V=IR | V |
| 电流 I | I=V/R | A/mA/µA |
| 功率 P | P=VI=I²R | W/mW |
| 分压 | Vo=Vin·R2/(R1\+R2) | — |
| 分流 | 电流按电导分配 | — |



ohm.c 节选C

 

```text
double vr = 5.0 * 10e3 / (10e3 + 10e3);   // 分压 = 2.50V
double r  = (5.0 - 2.0) / 0.010;           // LED 限流 = 300Ω
double p  = 10.0 * 10.0 / 100.0;           // 功率 = 1.00W
```

先算分压/限流/功率，再选器件额定值



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：分压/限流/功率



下面这段程序验证分压、LED 限流与功率：



host\_ohm.cC

 

```text
/* host_ohm.c —— 欧姆定律/分压/LED 限流/功率（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ohm.c -o host_ohm && ./host_ohm
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    float vs = 5.0f, r1 = 10000, r2 = 10000;
    float vout = vs * r2 / (r1 + r2);
    printf("分压 10k/10k @5V → %.2fV（期望 2.50）\n", vout);
    if (vout < 2.49f || vout > 2.51f) ok = 0;
    /* LED 限流：5V - 2V = 3V, 目标 10mA → R=300Ω */
    float rled = (5.0f - 2.0f) / 0.010f;
    printf("LED 限流 R=%.0fΩ 功率=%.3fW\n", rled, (5.0f-2.0f)*0.010f);
    if (rled < 299 || rled > 301) ok = 0;
    /* 功耗：10V, 100Ω → 1W */
    float p = 10.0f*10.0f/100.0f;
    printf("功率 10V/100Ω = %.2fW（期望 1.00）\n", p);
    if (p < 0.99f || p > 1.01f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

欧姆定律/分压/功率模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ohm.c -o labs/host_ohm && ./labs/host_ohm
分压 10k/10k @5V → 2.50V（期望 2.50）
LED 限流 R=300Ω 功率=0.030W
功率 10V/100Ω = 1.00W（期望 1.00）
RESULT: PASS
```



分压 10k/10k@5V=2.50V；LED 5V-2V/10mA→R=300Ω；功率 10V/100Ω=1.00W。



表 1.2 常用计算



| 场景 | 计算 | 结果 |
| --- | --- | --- |
| 分压 | Vo=Vin·R2/(R1\+R2) | 2.50V |
| LED 限流 | R=(5-2)/10mA | 300Ω |
| 功率 | P=V²/R | 1.00W |



```zhizhan-anchor
m01-safety
```



```zhizhan-anchor
m01-safety-t
```



## 1.3 功率与限流



忘记限流会烧 LED/器件；忽略功率会让电阻过载发热。先算功率再选器件额定值。



ohm.c 节选C

 

```text
double vr = 5.0 * 10e3 / (10e3 + 10e3);   // 分压 = 2.50V
double r  = (5.0 - 2.0) / 0.010;           // LED 限流 = 300Ω
double p  = 10.0 * 10.0 / 100.0;           // 功率 = 1.00W
```

先算分压/限流/功率，再选器件额定值



表 1.3 计算与注意



| 量 | 公式 | 注意 |
| --- | --- | --- |
| 分压 | Vo=Vin·R2/(R1\+R2) | 负载效应 |
| 限流 | R=(Vin-Vf)/I | LED 压降 |
| 功率 | P=VI=I²R | 电阻额定 |
| 分流 | 按电导分配 | 并联电阻 |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



电路自检：先算、后测、量程正确、功率不超载。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  分压比与输出（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="分压比与输出（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">输入 5V</text><rect x="150" y="26" width="500" height="18" rx="4" class="sv-amb-s"></rect><text x="658" y="43" class="sv-lbl-hi">50(×10⁻¹V)</text><text x="12" y="67" class="sv-lbl">输出 2.5V</text><rect x="150" y="50" width="250" height="18" rx="4" class="sv-grn-s"></rect><text x="408" y="67" class="sv-lbl-hi">25(×10⁻¹V)</text></svg>
```



10k/10k 分压输出为输入的一半（2.50V@5V）；改变比例即改变输出。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 算 | 欧姆定律 | 不先算就测 |
| 测 | 万用表/示波器 | 量程/接法错 |
| 核功率 | P=VI | 电阻过载 |
| 限流 | LED/器件 | 烧毁 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **忘记限流** ：LED/器件烧毁。

- **量程/接法错** ：读数无效或短路。

- **忽略功率** ：电阻过载发热。

- **不先算就测** ：无法判断对错。



◆ 自测 · Module 01（先答再看）




1. 5V 点亮 2V 压降、10mA 的 LED，限流电阻取多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"R=(5−2)/0.01=300Ω。这是最基本也最常考的计算。"}
   ```

2. 为什么“先算再测”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先算得到预期值，测量后比较才能判断电路是否正确。不先算就无法分辨“读数对不对”。"}
   ```

3. 为什么电阻要考虑功率？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"电阻有额定功率，超过会发热甚至烧毁。用 P=VI=I²R 算实际功率再选器件。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：拿你手上一个电路（如分压/LED），先算电压电流功率，再用万用表验证。



核对与延伸：[All About Circuits](https://www.allaboutcircuits.com/textbook/)

 

动手练习



运行 ` labs/host_ohm.c `：验证分压、LED 限流与功率计算。



**检查结果：** 分压 10k/10k@5V=2.50V；LED 限流 R=300Ω 功率=0.030W；功率 10V/100Ω=1.00W。

 

迁移练习：把本章的“能用欧姆定律/分压/分流先算后测，并用功率核算不超载。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m01","criterion":"分压 10k/10k@5V=2.50V；LED 限流 R=300Ω 功率=0.030W；功率 10V/100Ω=1.00W。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
