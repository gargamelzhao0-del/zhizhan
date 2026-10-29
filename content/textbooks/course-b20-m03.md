# 时域滤波

```zhizhan-anchor
m03
```



时域滤波简单高效： **滑动平均** 平滑但怕尖峰， **中值** 抗脉冲， **EMA**  只需一个状态、延迟可调。

 

> 前置：理解序列与循环缓冲，知道均值。 · ◷ 约 42 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现滑动平均/中值/EMA 并在平滑度、抗脉冲与延迟之间权衡。

 

本章速览




- 时域滤波：均值平滑、中值抗尖峰、EMA 省状态。

- 滤波有延迟，闭环里会削相位裕度。

- 权衡平滑/延迟/抗噪。

 

```zhizhan-anchor
m03-filter
```



```zhizhan-anchor
m03-filter-t
```



## 3.1 三种时域滤波



滑动平均平滑但怕尖峰，中值抗脉冲，EMA 只需一个状态、延迟可调。滤波都有延迟：闭环里滤波延迟会削减相位裕度（可能引起振荡）。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  尖峰对不同滤波的影响（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="尖峰对不同滤波的影响（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">均值</text><rect x="150" y="26" width="560" height="18" rx="4" class="sv-red-s"></rect><text x="718" y="43" class="sv-lbl-hi">280(×10⁻¹)</text><text x="12" y="67" class="sv-lbl">中值</text><rect x="150" y="50" width="200" height="18" rx="4" class="sv-grn-s"></rect><text x="358" y="67" class="sv-lbl-hi">100(×10⁻¹)</text><text x="12" y="91" class="sv-lbl">EMA</text><rect x="150" y="74" width="430" height="18" rx="4" class="sv-amb-s"></rect><text x="588" y="91" class="sv-lbl-hi">215(×10⁻¹)</text></svg>
```



序列 {10,10,100,10,10}：均值 28.0 被尖峰拉高、中值 10 抗脉冲、EMA 21.52 平滑。



表 3.1 时域滤波对比



| 滤波 | 特点 | 代价 |
| --- | --- | --- |
| 滑动平均 | 平滑 | 延迟、怕尖峰 |
| 中值 | 抗脉冲 | 排序开销 |
| EMA | 少状态 | 相位延迟 |
| 加权平均 | 可调 | 设计权重 |
| 滤波延迟 | 固有 | 影响闭环相位 |



filter.c 节选C

 

```text
ema = alpha*x + (1-alpha)*ema;             // EMA 递推
median = median_of(window, N);             // 中值抗脉冲
/* 闭环中滤波延迟会削相位裕度，需权衡平滑与延迟 */
```

EMA 单状态递推；中值抗脉冲；注意延迟



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：均值/中值/EMA



下面这段程序对比三种滤波对尖峰的表现：



host\_filter.cC

 

```text
/* host_filter.c —— 时域滤波：均值/中值/EMA（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_filter.c -o host_filter && ./host_filter
 */
#include <stdio.h>
static int med3(int a,int b,int c){ if((a<=b&&b<=c)||(c<=b&&b<=a))return b; if((b<=a&&a<=c)||(c<=a&&a<=b))return a; return c; }
int main(void) {
    int ok = 1;
    int x[] = {10,10,100,10,10};    /* 中间一个尖峰 */
    int n = 5, sum = 0;
    for (int i=0;i<n;i++) sum += x[i];
    printf("均值=%.1f（被尖峰拉高）\n", sum/(double)n);
    int med = med3(x[1],x[2],x[3]);
    printf("中值(窗口)=%d（抗尖峰）\n", med);
    if (med != 10) ok = 0;
    double ema = 10, alpha = 0.2;
    for (int i=0;i<n;i++) ema = alpha*x[i] + (1-alpha)*ema;
    printf("EMA(alpha=0.2)末值=%.2f（平滑）\n", ema);
    if (ema <= 10 || ema >= 100) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时域滤波模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_filter.c -o labs/host_filter && ./labs/host_filter
均值=28.0（被尖峰拉高）
中值(窗口)=10（抗尖峰）
EMA(alpha=0.2)末值=21.52（平滑）
RESULT: PASS
```



同样含尖峰的序列：均值被拉高、中值抗脉冲、EMA 平滑但仍有滞后。



表 3.2 输出对比



| 滤波 | 序列 | 输出 |
| --- | --- | --- |
| 均值 | {10,10,100,10,10} | 28.0 |
| 中值 | 窗口 | 10 |
| EMA(α=0.2) | 递推 | 21.52 |
| 权衡 | 平滑/延迟 | 按场景 |



```zhizhan-anchor
m03-delay
```



```zhizhan-anchor
m03-delay-t
```



## 3.3 延迟与权衡



滤波都有延迟：闭环里滤波延迟会削减相位裕度。选择滤波要在“平滑度/延迟/抗噪”之间权衡。



filter.c 节选C

 

```text
ema = alpha*x + (1-alpha)*ema;             // EMA 递推
median = median_of(window, N);             // 中值抗脉冲
/* 闭环中滤波延迟会削相位裕度，需权衡平滑与延迟 */
```

EMA 单状态递推；中值抗脉冲；注意延迟



表 3.3 滤波选择



| 目标 | 选择 | 避免 |
| --- | --- | --- |
| 平滑 | 平均/EMA | 窗口过大延迟 |
| 抗脉冲 | 中值 | 用均值 |
| 少状态 | EMA | 大窗口 |
| 闭环 | 控制延迟 | 延迟削相位 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



滤波自检：选型匹配、延迟在预算内、抗脉冲正确、边界处理对。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  滤波选型



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="滤波选型" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看噪声</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">看状态</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">选滤波</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">控延迟</text></svg>
```



有脉冲噪声？→ 中值；要少状态？→ EMA；要最平滑？→ 平均；闭环要控延迟。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 噪声类型 | 脉冲→中值 | 均值抗脉冲 |
| 延迟 | 在预算内 | 削相位 |
| 状态 | EMA 少状态 | 大窗口 |
| 边界 | 处理启动瞬态 | 瞬态大 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **滤波延迟影响闭环** ：振荡/失稳。

- **用均值抗尖峰** ：脉冲被摊开。

- **窗口太大** ：响应慢。

- **边界处理错** ：启动瞬态大。



◆ 自测 · Module 03（先答再看）




1. 为什么闭环里要小心滤波延迟？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"滤波引入相位滞后，会降低相位裕度，使系统更易振荡。要在平滑与延迟之间权衡，必要时补偿。"}
   ```

2. 抗脉冲噪声应该用什么滤波？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"中值滤波。它对脉冲（尖峰）不敏感，而滑动平均会被尖峰拉高。"}
   ```

3. EMA 的优点是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只需一个状态（上一个输出），计算/内存开销小，且 α 可调平滑程度；代价是相位延迟。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一路含脉冲噪声的信号选滤波（如中值），并核对滤波延迟在你的闭环预算内。



核对与延伸：[Smith 数字信号处理](https://www.dspguide.com/) · [CMSIS-DSP 文档](https://arm-software.github.io/CMSIS-DSP/main/)

 

动手练习



运行 ` labs/host_filter.c `：对比均值被尖峰拉高、中值抗尖峰、EMA 平滑。



**检查结果：** 序列 {10,10,100,10,10}：均值 28.0、窗口中值 10、EMA(α=0.2) 末值 21.52。

 

迁移练习：把本章的“能实现滑动平均/中值/EMA 并在平滑度、抗脉冲与延迟之间权衡。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m03","criterion":"序列 {10,10,100,10,10}：均值 28.0、窗口中值 10、EMA(α=0.2) 末值 21.52。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
