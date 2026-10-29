# FIR 与 IIR

```zhizhan-anchor
m04
```



FIR 无反馈（一定稳定、可线性相位、阶数高）；IIR 有反馈（低阶高效、但要注意 **极点与稳定性** ）。

 

> 前置：会差分方程与循环，理解单位阶跃响应。 · ◷ 约 44 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现 FIR/IIR 差分方程并检查 IIR 极点稳定性与系数量化误差。

 

本章速览




- FIR 无反馈稳定可线性相位；IIR 低阶高效但查极点。

- 实现即差分方程；系数量化注意精度。

- 按频响需求选阶数。

 

```zhizhan-anchor
m04-fir
```



```zhizhan-anchor
m04-fir-t
```



## 4.1 FIR vs IIR



FIR 无反馈（一定稳定、可线性相位、阶数高）；IIR 有反馈（低阶高效、但要注意极点与稳定性）。实现就是差分方程。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  FIR 与 IIR 的结构



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="FIR 与 IIR 的结构" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">输入 x[n]</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">FIR：Σa·x</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">IIR：Σb·y</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">输出 y[n]</text></svg>
```



FIR：只累加输入（无反馈）→ 稳定/线性相位；IIR：还累加输出（有反馈）→ 需查极点。



表 4.1 FIR/IIR 对比



| 类型 | 特点 | 注意 |
| --- | --- | --- |
| FIR | 无反馈、线性相位 | 阶数/延迟高 |
| IIR | 低阶高效 | 极点稳定/非线性相位 |
| 差分方程 | y\[n\]=Σa x \+ Σb y | 系数与实现 |
| 稳定性 | 极点单位圆内 | IIR 必查 |
| 量化 | 系数定点 | 精度/极限环 |



fir.c 节选C

 

```text
y = (x[n]+x[n-1]+x[n-2])/3;            // 3 点 FIR
y = 0.5*y_prev + 0.5*x;                 // 一阶 IIR (极点 0.5)
/* IIR：极点须 |p|<1；定系数注意量化误差/极限环 */
```

FIR 无反馈；IIR 有反馈需查极点稳定性



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：FIR 与 IIR 响应



下面这段程序验证 FIR 输出与 IIR 一阶阶跃响应：



host\_fir.cC

 

```text
/* host_fir.c —— FIR/IIR 差分方程（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_fir.c -o host_fir && ./host_fir
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 3 点滑动平均 FIR: y[n]=(x[n]+x[n-1]+x[n-2])/3 */
    int x[] = {0,0,6,6,6,0,0};
    int n = 7;
    printf("FIR 输出: ");
    for (int i=2;i<n;i++) printf("%d ", (x[i]+x[i-1]+x[i-2])/3);
    printf("(期望 2 4 6 4 2)\n");
    /* IIR 一阶：y[n]=0.5y[n-1]+0.5x[n] */
    double y = 0;
    printf("IIR 阶跃响应: ");
    for (int i=0;i<5;i++){ y = 0.5*y + 0.5*1.0; printf("%.3f ", y); }
    printf("(趋向 1)\n");
    if (y < 0.9 || y > 1.0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

FIR/IIR 差分方程模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_fir.c -o labs/host_fir && ./labs/host_fir
FIR 输出: 2 4 6 4 2 (期望 2 4 6 4 2)
IIR 阶跃响应: 0.500 0.750 0.875 0.938 0.969 (趋向 1)
RESULT: PASS
```



3 点 FIR 对 {0,0,6,6,6,0,0} 输出 2 4 6 4 2；IIR 一阶阶跃趋于 1（0.500→0.969）。



表 4.2 响应结果



| 类型 | 输入 | 输出 |
| --- | --- | --- |
| FIR | {0,0,6,6,6,0,0} | 2 4 6 4 2 |
| IIR 阶跃 | 一步 | 0.500→0.969 |
| IIR 极点 | 0.5 | 单位圆内 |
| 稳定性 | \|p\|\<1 | 收敛 |



```zhizhan-anchor
m04-stable
```



```zhizhan-anchor
m04-stable-t
```



## 4.3 稳定性与量化



FIR 只累加输入，IIR 还累加输出。IIR 系数做定点时要注意量化误差与稳定性（极点须在单位圆内）。



fir.c 节选C

 

```text
y = (x[n]+x[n-1]+x[n-2])/3;            // 3 点 FIR
y = 0.5*y_prev + 0.5*x;                 // 一阶 IIR (极点 0.5)
/* IIR：极点须 |p|<1；定系数注意量化误差/极限环 */
```

FIR 无反馈；IIR 有反馈需查极点稳定性



表 4.3 FIR/IIR 实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| FIR 无反馈 | 必稳定 | 阶数/延迟 |
| IIR 低阶 | 高效 | 极点外→发散 |
| 查极点 | 稳定 | IIR 不稳 |
| 量化注意 | 频响/极限环 | 精度损失 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



滤波自检：FIR/IIR 选型、IIR 极点稳定、系数精度、响应符合预期。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  IIR 一阶阶跃响应（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="IIR 一阶阶跃响应（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">step1</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-cyn-s"></rect><text x="458" y="43" class="sv-lbl-hi">500(×10⁻³)</text><text x="12" y="67" class="sv-lbl">step3</text><rect x="150" y="50" width="525" height="18" rx="4" class="sv-amb-s"></rect><text x="683" y="67" class="sv-lbl-hi">875(×10⁻³)</text><text x="12" y="91" class="sv-lbl">step5</text><rect x="150" y="74" width="581" height="18" rx="4" class="sv-grn-s"></rect><text x="739" y="91" class="sv-lbl-hi">969(×10⁻³)</text></svg>
```



一阶 IIR 阶跃 0.500→0.969，趋向 1；说明极点 0.5 在单位圆内，稳定。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 选型 | FIR/IIR | 不看需求 |
| 极点 | \|p\|\<1 | IIR 发散 |
| 量化 | 检查频响 | 极限环 |
| 响应 | 对拍预期 | 偏差容忍 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **IIR 不稳定** ：极点在外，输出发散。

- **系数量化误差** ：频响偏移/极限环。

- **FIR 阶数不够** ：过渡带太宽。

- **不改线性相位却需要它** ：波形失真。



◆ 自测 · Module 04（先答再看）




1. FIR 与 IIR 最本质的区别是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"FIR 只有前馈（无反馈），所以一定稳定且可线性相位；IIR 有反馈，低阶即可陡峭但必须检查极点稳定性。"}
   ```

2. IIR 稳定的条件是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"所有极点都在单位圆内（|p|\\<1）。极点在外或接近 1 会导致输出发散或长时间振荡。"}
   ```

3. 什么时候优先选 FIR？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"需要线性相位（波形不失真）、要求绝对稳定、或系数需易量化时，选 FIR（代价是阶数/延迟高）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一路信号选 FIR 或 IIR，写差分方程并核对 IIR 极点稳定性与系数精度。



核对与延伸：[CMSIS-DSP 文档](https://arm-software.github.io/CMSIS-DSP/main/) · [Smith 数字信号处理](https://www.dspguide.com/)

 

动手练习



运行 ` labs/host_fir.c `：验证 FIR 滑动平均输出与 IIR 一阶阶跃响应。



**检查结果：** FIR 对 {0,0,6,6,6,0,0} 输出 2 4 6 4 2；IIR 一阶阶跃 0.500→0.969 趋向 1。

 

迁移练习：把本章的“能实现 FIR/IIR 差分方程并检查 IIR 极点稳定性与系数量化误差。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m04","criterion":"FIR 对 {0,0,6,6,6,0,0} 输出 2 4 6 4 2；IIR 一阶阶跃 0.500→0.969 趋向 1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
