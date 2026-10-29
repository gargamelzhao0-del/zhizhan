# 插值、拟合与校准

```zhizhan-anchor
m09
```



插值/拟合/校准把离散数据变成可用模型： **插值** 填充标定点之间， **拟合** 找关系， **校准** 修正系统误差。注意 **外插风险** 。

 

> 前置：理解线性函数与最小二乘，读过 M04/M08。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用标定数据拟合 y=kx\+b 得增益/偏置并检查残差，明确有效区间与外插风险。

 

本章速览




- 插值填区间内，拟合找关系，标定修系统误差。

- 外插风险大，要限定有效范围。

- 残差要看有无系统趋势。

 

```zhizhan-anchor
m09-interp
```



```zhizhan-anchor
m09-interp-t
```



## 9.1 插值、拟合、校准



插值填充标定点之间、拟合找关系、校准修正系统误差。标定方程 y=kx\+b 由数据拟合；插值只在标定区间内可信，外插必须谨慎并标注。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  标定区间与插值/外插



```zhizhan-figure
<svg viewBox="0 0 800 110" width="100%" height="110" role="img" aria-label="标定区间与插值/外插" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">区间内</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">区间外</text><text x="12" y="50" class="sv-lbl">插值</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">可信</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">谨慎/标注</text><text x="12" y="78" class="sv-lbl">示例</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">x=15→200</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">越界→降级</text></svg>
```



区间内插值可信；区间外为外插，误差不可控。必须在越界时降级/告警。



表 9.1 方法与应用



| 方法 | 用途 | 风险 |
| --- | --- | --- |
| 线性插值 | 标定表 | 区间外外插 |
| 多项式插值 | 光滑数据 | 过拟合/振荡 |
| 最小二乘 | 找线性关系 | 异常值影响 |
| 标定 | 增益/偏置 | 范围外无效 |
| 残差 | 评估质量 | 忽略趋势 |



calib.c 节选C

 

```text
double slope = (y1 - y0) / (x1 - x0);     // 两点标定增益
double offset = y0 - slope * x0;          // 偏置
if (x < X_MIN || x > X_MAX) return EXTRAPOLATE;  // 越界→降级
/* 检查残差：有系统趋势说明模型/范围不对 */
```

两点标定增益/偏置；越界外插须降级；查残差



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：插值与拟合



插值证据见 host\_search.c（x=15→200）；拟合证据见 host\_stats.c（斜率 2.000）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_search.cC\n\n \n\n```text\n/* host_search.c —— 二分查找与标定表线性插值（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_search.c -o host_search && ./host_search\n */\n#include <stdio.h>\nstatic int bsearch_int(const int *a, int n, int key) { int lo=0, hi=n-1; while (lo<=hi){ int m=(lo+hi)/2; if(a[m]==key) return m; if(a[m]<key) lo=m+1; else hi=m-1; } return -1; }\n/* 标定点 (x,y) 线性插值 */\nstatic float interp(const float *x, const float *y, int n, float xi) {\n    if (xi <= x[0]) return y[0];\n    if (xi >= x[n-1]) return y[n-1];\n    for (int i = 0; i < n-1; i++)\n        if (xi >= x[i] && xi <= x[i+1])\n            return y[i] + (y[i+1]-y[i]) * (xi-x[i]) / (x[i+1]-x[i]);\n    return y[n-1];\n}\nint main(void) {\n    int ok = 1;\n    int a[] = {1,3,5,7,9,11};\n    printf(\"查找 7 → 下标 %d（期望 3）\\n\", bsearch_int(a,6,7));\n    if (bsearch_int(a,6,7) != 3) ok = 0;\n    printf(\"查找 4 → %d（期望 -1）\\n\", bsearch_int(a,6,4));\n    if (bsearch_int(a,6,4) != -1) ok = 0;\n    float x[] = {0,10,20}, y[] = {0,100,300};\n    float v = interp(x,y,3,15);\n    printf(\"插值 x=15 → %.1f（期望 200.0）\\n\", v);\n    if (v < 199.9f || v > 200.1f) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n插值模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_search.c -o labs/host_search && ./labs/host_search
插值 x=15 → 200.0（期望 200.0）
RESULT: PASS
```



标定区间 \[0,20\] 内 x=15→200.0；区间外为外插，误差不可控，须标注并降级。



表 9.2 插值/拟合结果



| 情形 | 处理 | 输出 |
| --- | --- | --- |
| 区间内 | 线性插值 | 200.0 |
| 区间外 | 外插（标注） | 降级/告警 |
| 拟合 | 最小二乘 | k=2.000,b=0.000 |
| 残差 | 检查趋势 | 无系统趋势 |



```zhizhan-anchor
m09-calib
```



```zhizhan-anchor
m09-calib-t
```



## 9.3 校准与残差



标定方程 y=kx\+b 由数据拟合；残差要检查是否有系统趋势（隐含非线性或范围外）。外插必须标注并在越界时降级/告警。



calib.c 节选C

 

```text
double slope = (y1 - y0) / (x1 - x0);     // 两点标定增益
double offset = y0 - slope * x0;          // 偏置
if (x < X_MIN || x > X_MAX) return EXTRAPOLATE;  // 越界→降级
/* 检查残差：有系统趋势说明模型/范围不对 */
```

两点标定增益/偏置；越界外插须降级；查残差



表 9.3 校准实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 两点/多点标定 | 求增益/偏置 | 单点不可靠 |
| 限定区间 | 只区间内可信 | 盲目外插 |
| 查残差 | 发现偏差 | 忽略趋势 |
| 越界降级 | 安全 | 外插误差爆炸 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



校准自检：区间明确、残差无趋势、外插有策略、增益/偏置正确。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  标定区间与越界（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="标定区间与越界（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">区间内</text><rect x="150" y="26" width="257" height="18" rx="4" class="sv-grn-s"></rect><text x="415" y="43" class="sv-lbl-hi">15x</text><text x="12" y="67" class="sv-lbl">越界</text><rect x="150" y="50" width="514" height="18" rx="4" class="sv-red-s"></rect><text x="672" y="67" class="sv-lbl-hi">30x</text></svg>
```



x∈\[0,20\] 内插值可信（x=15→200）；越界外插误差不可控，须降级/告警。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 标定 | 拟合 kx\+b | 单点 |
| 区间 | 标注有效范围 | 外插 |
| 残差 | 查系统趋势 | 忽略 |
| 越界 | 降级/告警 | 继续外插 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **盲目外插** ：区间外误差爆炸。

- **高次插值振荡** ：Runge 现象。

- **异常值污染拟合** ：斜率错。

- **不看残差** ：模型偏差被忽略。



◆ 自测 · Module 09（先答再看）




1. 为什么标定要限定有效范围？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"标定关系通常只在测量区间内成立；区间外（外插）误差不可控，必须标注有效范围并在越界时降级/告警。"}
   ```

2. 残差有“系统趋势”说明什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型与实际关系不符（如实际非线性、或数据超出有效区间）。应改模型或限定范围，而不是忽略。"}
   ```

3. 高次多项式插值有什么风险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Runge 现象：高次插值在端点附近剧烈振荡，反而失真。通常用低次/分段插值更稳。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用你的标定数据拟合 y=kx\+b、画残差并标注有效区间，越界时给出降级/告警策略。



核对与延伸：[NumPy 数据类型](https://numpy.org/doc/stable/user/basics.types.html) · [Kalman/姿态基础](https://www.kalmanfilter.net/)

 

动手练习



运行 ` labs/host_search.c `（插值）；用 ` host_stats.c `（拟合）做标定并看残差。



**检查结果：** 插值 x=15→200.0（标定区间 \[0,20\] 内）；拟合斜率 2.000；残差无系统趋势，区间外仅外插并标注。

 

迁移练习：把本章的“能用标定数据拟合 y=kx\+b 得增益/偏置并检查残差，明确有效区间与外插风险。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m09","criterion":"插值 x=15→200.0（标定区间 [0,20] 内）；拟合斜率 2.000；残差无系统趋势，区间外仅外插并标注。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
