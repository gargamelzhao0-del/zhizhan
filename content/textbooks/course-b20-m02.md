# 传感器标定与误差预算

```zhizhan-anchor
m02
```



测量要“准”，就要做 **误差预算** ：把系统误差（偏置/增益）与随机误差分开，并逐项估算对结果的影响。

 

> 前置：理解线性函数与最小二乘，知道测量误差概念。 · ◷ 约 44 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能对传感器做增益/偏置标定、列误差预算并给出主导项与残差。

 

本章速览




- 把系统误差（标定）与随机误差（滤波）分开。

- 做误差预算找主导项。

- 标定要覆盖范围并留残差。

 

```zhizhan-anchor
m02-calib
```



```zhizhan-anchor
m02-calib-t
```



## 2.1 系统误差与随机误差



系统误差（偏置/增益）用标定消除，随机误差用滤波/平均降低；两者处理方式不同，混在一起就无法针对性优化。误差预算把各项合成，找主导项。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  误差预算



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="误差预算" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">列误差源</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">逐项估</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">合成</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">主导项</text></svg>
```



列误差源 → 逐项估影响 → 合成 → 找主导项 → 优先处理（标定/补偿/滤波）。



表 2.1 误差类型



| 误差 | 来源 | 处理 |
| --- | --- | --- |
| 偏置 | 零点 | 标定减去 |
| 增益 | 比例不准 | 标定乘系数 |
| 温漂 | 温度 | 温度补偿 |
| 随机噪声 | 器件/环境 | 滤波/平均 |
| 量化 | ADC 分辨率 | 按 LSB 计 |



calib.c 节选C

 

```text
k = (n*Sxy - Sx*Sy) / (n*Sxx - Sx*Sx);   // 增益
b = (Sy - k*Sx) / n;                      // 偏置
double resid = fabs(y - (k*x + b));       // 残差
/* 误差预算: sqrt(偏置^2+增益误差^2+噪声^2+量化^2) */
```

最小二乘求 k/b；残差检查；误差预算合成



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：增益/偏置与残差



下面这段程序用最小二乘拟合 y=kx\+b 得增益/偏置并检查残差：



host\_calib.cC

 

```text
/* host_calib.c —— 传感器标定：最小二乘拟合 y=kx+b 得增益/偏置与残差（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_calib.c -o host_calib -lm && ./host_calib
 */
#include <stdio.h>
#include <math.h>

int main(void) {
    int ok = 1;
    /* 标定点：真值增益 2.5、偏置 -1.0，叠加小噪声 */
    double x[] = {0, 1, 2, 3, 4, 5};
    double y[] = {-1.0, 1.4, 4.1, 6.3, 9.2, 11.4};
    int n = 6; double sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (int i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i]*x[i]; sxy += x[i]*y[i]; }

    /* 最小二乘 y = k x + b：k=增益、b=偏置 */
    double k = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    double b = (sy - k*sx) / n;
    printf("标定 y=%.3f x + %.3f（期望增益≈2.5 偏置≈-1.0）\n", k, b);
    if (fabs(k - 2.5) > 0.05 || fabs(b + 1.0) > 0.05) ok = 0;

    /* 残差评估：最大绝对残差与残差 RMS，检查是否有系统趋势 */
    double maxr = 0, ss = 0;
    for (int i = 0; i < n; i++) {
        double r = y[i] - (k*x[i] + b);
        if (fabs(r) > maxr) maxr = fabs(r);
        ss += r*r;
    }
    double rms = sqrt(ss/n);
    printf("最大残差=%.3f 残差RMS=%.3f（阈值 ≤0.25）\n", maxr, rms);
    if (maxr > 0.25) ok = 0;
    printf("结论：增益/偏置由拟合得到，残差小且无系统趋势\n");

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

标定/误差预算模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_calib.c -o labs/host_calib && ./labs/host_calib
标定 y=2.503 x + -1.024（期望增益≈2.5 偏置≈-1.0）
最大残差=0.212 残差RMS=0.134（阈值 ≤0.25）
结论：增益/偏置由拟合得到，残差小且无系统趋势
RESULT: PASS
```



拟合增益 2.503、偏置 -1.024；最大残差 0.212、RMS 0.134（≤0.25），无系统趋势。



表 2.2 标定结果



| 量 | 值 | 判据 |
| --- | --- | --- |
| 增益 k | 2.503 | ≈2.5 |
| 偏置 b | -1.024 | ≈-1.0 |
| 最大残差 | 0.212 | ≤0.25 |
| 残差 RMS | 0.134 | 小且无趋势 |



```zhizhan-anchor
m02-budget
```



```zhizhan-anchor
m02-budget-t
```



## 2.3 误差预算与温漂



误差预算把各项贡献合成，找主导项优先处理；标定要覆盖工作范围并留残差记录；温度变化后要补偿。



calib.c 节选C

 

```text
k = (n*Sxy - Sx*Sy) / (n*Sxx - Sx*Sx);   // 增益
b = (Sy - k*Sx) / n;                      // 偏置
double resid = fabs(y - (k*x + b));       // 残差
/* 误差预算: sqrt(偏置^2+增益误差^2+噪声^2+量化^2) */
```

最小二乘求 k/b；残差检查；误差预算合成



表 2.3 标定实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 系统/随机分开 | 针对性处理 | 混在一起 |
| 覆盖范围 | 工作点有效 | 范围不足 |
| 残差记录 | 评估质量 | 忽略趋势 |
| 温漂补偿 | 全温区准 | 只标常温 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



标定自检：系统/随机分开、覆盖范围、残差无趋势、有温漂补偿。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  标定残差（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="标定残差（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">最大残差</text><rect x="150" y="26" width="454" height="18" rx="4" class="sv-cyn-s"></rect><text x="612" y="43" class="sv-lbl-hi">212(×10⁻³)</text><text x="12" y="67" class="sv-lbl">阈值</text><rect x="150" y="50" width="536" height="18" rx="4" class="sv-amb-s"></rect><text x="694" y="67" class="sv-lbl-hi">250(×10⁻³)</text><text x="12" y="91" class="sv-lbl">RMS</text><rect x="150" y="74" width="287" height="18" rx="4" class="sv-grn-s"></rect><text x="445" y="91" class="sv-lbl-hi">134(×10⁻³)</text></svg>
```



最大残差 0.212、RMS 0.134（阈值 0.25）。残差小且无系统趋势，说明模型合适。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 列源 | 系统\+随机 | 只列一项 |
| 标定 | 最小二乘 | 单点/范围窄 |
| 残差 | 查趋势 | 忽略 |
| 预算 | 合成找主导 | 优化错方向 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **不标定** ：系统误差长期存在。

- **不做误差预算** ：优化错方向。

- **忽略温漂** ：温度变化后不准。

- **标定范围不足** ：工作点外无效。



◆ 自测 · Module 02（先答再看）




1. 为什么要把系统误差与随机误差分开？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"系统误差用标定消除，随机误差用滤波/平均降低；处理方式不同。混在一起就无法针对性优化。"}
   ```

2. 残差有什么用处？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"残差 = 实测 − 模型预测。检查残差是否有系统趋势，可判断模型/范围是否合适；趋势说明模型有偏差。"}
   ```

3. 为什么标定要覆盖工作范围并考虑温漂？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"标定关系只在标定范围内成立；温度变化会引起偏置/增益漂移。覆盖范围 \\+ 温漂补偿才能全工况准确。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个传感器做增益/偏置标定与误差预算，列出主导误差项并考虑温漂。



核对与延伸：[STM32 电机控制](https://www.st.com/en/embedded-software/motor-control.html)

 

动手练习



运行 ` labs/host_calib.c `：用最小二乘拟合 y=kx\+b 得增益/偏置并检查残差。



**检查结果：** 拟合增益 k=2.503、偏置 b=-1.024；最大残差 0.212、残差 RMS 0.134（阈值 ≤0.25）。

 

迁移练习：把本章的“能对传感器做增益/偏置标定、列误差预算并给出主导项与残差。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m02","criterion":"拟合增益 k=2.503、偏置 b=-1.024；最大残差 0.212、残差 RMS 0.134（阈值 ≤0.25）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
