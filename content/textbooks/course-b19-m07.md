# 线性代数与坐标变换

```zhizhan-anchor
m07
```



坐标变换是机器人/姿态/图形的数学基础： **旋转矩阵、平移、齐次坐标** ；旋转矩阵是 **正交** 的（保长度、可逆）。

 

> 前置：会矩阵乘法，理解三角函数与向量。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用旋转矩阵与齐次坐标实现坐标变换，并用正交性（RᵀR=I）校验/求逆。

 

本章速览




- 坐标变换用旋转矩阵（正交）\+齐次坐标。

- 矩阵乘法不可交换，注意顺序。

- 正交性可校验/求逆。

 

```zhizhan-anchor
m07-vec
```



```zhizhan-anchor
m07-vec-t
```



## 7.1 旋转矩阵与齐次坐标



旋转矩阵、平移、齐次坐标。旋转矩阵正交（保长度、可逆，R⁻¹=Rᵀ），用齐次坐标把旋转与平移统一成矩阵乘法。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  旋转矩阵与齐次坐标



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="旋转矩阵与齐次坐标" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">旋转 R=[[c,-s],[s,c]]</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">正交 c²+s²=1（保长度）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">平移需齐次坐标（多一维）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">多传感器姿态融合</text></svg>
```



2D 旋转 R=\[\[c,-s\],\[s,c\]\]，c²\+s²=1（正交）；平移需齐次坐标把旋转\+平移统一。



表 7.1 坐标变换五概念



| 概念 | 作用 | 性质 |
| --- | --- | --- |
| 向量/矩阵 | 表示与运算 | 乘法不可交换 |
| 旋转矩阵 | 旋转变换 | 正交、行列式=1 |
| 平移 | 位置变化 | 需齐次坐标统一 |
| 齐次坐标 | 统一旋转\+平移 | 多一维 |
| 姿态融合 | 多传感器 | 旋转叠加 |



vec.c 节选C

 

```text
double c=cos(th), s=sin(th);
double x2 = x*c - y*s, y2 = x*s + y*c;   // 旋转
/* 正交性 c²+s²=1；求逆用转置 Rᵀ；平移用齐次坐标 */
```

旋转公式 \+ 正交性校验；只有正交矩阵的逆等于转置



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：旋转与正交性



下面这段程序验证旋转与正交性：



host\_vec.cC

 

```text
/* host_vec.c —— 线性代数与坐标变换：二维旋转矩阵（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_vec.c -o host_vec -lm && ./host_vec
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    double deg = 90.0, th = deg*3.14159265358979/180.0;
    double c = cos(th), s = sin(th);
    double x = 1, y = 0;
    double xr = c*x - s*y, yr = s*x + c*y;
    printf("旋转 (1,0) 90° → (%.3f, %.3f)（期望 (0,1)）\n", xr, yr);
    if (fabs(xr) > 1e-9 || fabs(yr-1.0) > 1e-9) ok = 0;
    /* 旋转矩阵正交：R^T R = I */
    double d = c*c + s*s;
    printf("R 正交性 c^2+s^2=%.3f（期望 1.000）\n", d);
    if (fabs(d-1.0) > 1e-9) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

旋转/正交性模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_vec.c -o labs/host_vec && ./labs/host_vec
旋转 (1,0) 90° → (0.000, 1.000)（期望 (0,1)）
R 正交性 c^2+s^2=1.000（期望 1.000）
RESULT: PASS
```



旋转 90° 把 (1,0) 变 (0.000,1.000)（误差\<1e-9）；正交性 c²\+s²=1.000。



表 7.2 旋转与正交



| 量 | 公式 | 值 |
| --- | --- | --- |
| 旋转 | x'=x·c-y·s | (0,1)@90° |
| 正交 | c²\+s²=1 | 1.000 |
| 行列式 | det(R)=1 | 保长度/朝向 |
| 逆 | R⁻¹=Rᵀ | 省计算 |



```zhizhan-anchor
m07-fuse
```



```zhizhan-anchor
m07-fuse-t
```



## 7.3 姿态融合基础



用齐次坐标统一旋转与平移；旋转矩阵正交性可用于校验与求逆（R⁻¹=Rᵀ）。这是 IMU 姿态/坐标系变换的数学基础。



vec.c 节选C

 

```text
double c=cos(th), s=sin(th);
double x2 = x*c - y*s, y2 = x*s + y*c;   // 旋转
/* 正交性 c²+s²=1；求逆用转置 Rᵀ；平移用齐次坐标 */
```

旋转公式 \+ 正交性校验；只有正交矩阵的逆等于转置



表 7.3 坐标变换实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 正交校验 | 防漂移 | 忽略归一 |
| 转置求逆 | 省计算 | 数值求逆 |
| 齐次坐标 | 统一变换 | 平移当线性 |
| 乘法顺序 | 复合变换 | 顺序反 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



坐标变换自检：旋转正确、正交性好、顺序正确、平移用齐次坐标。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  正交性校验（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="正交性校验（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">c²+s²</text><rect x="150" y="26" width="571" height="18" rx="4" class="sv-grn-s"></rect><text x="729" y="43" class="sv-lbl-hi">1000(×10⁻³)</text><text x="12" y="67" class="sv-lbl">期望 1</text><rect x="150" y="50" width="571" height="18" rx="4" class="sv-cyn-s"></rect><text x="729" y="67" class="sv-lbl-hi">1000(×10⁻³)</text></svg>
```



c²\+s²=1.000，说明旋转矩阵正交（保长度）；偏离则误差累积。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 旋转 | R·x | 公式错 |
| 正交 | c²\+s²=1 | 忽略归一 |
| 顺序 | 矩阵相乘 | 顺序反 |
| 平移 | 齐次坐标 | 当线性 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **矩阵乘法顺序错** ：变换结果反。

- **忘记正交归一** ：误差累积漂移。

- **平移当线性变换** ：需齐次坐标。

- **数值累积误差** ：长期失准。



◆ 自测 · Module 07（先答再看）




1. 旋转矩阵为什么可以“转置求逆”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"旋转矩阵是正交矩阵（RᵀR=I），其逆等于转置。这既省计算又便于校验姿态。"}
   ```

2. 为什么平移要用齐次坐标？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"平移不是线性变换（不能用矩阵乘法直接表示点位移）。齐次坐标多一维，把旋转\\+平移统一成矩阵乘法。"}
   ```

3. 为什么姿态解算要定期校验正交性？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"数值累积误差会让旋转矩阵偏离正交（c²\\+s²≠1），导致尺度/朝向漂移。定期归一/正交化可纠正。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用旋转矩阵 \+ 齐次坐标实现一次坐标变换，并用正交性校验结果。



核对与延伸：[NIST 数值方法](https://dlmf.nist.gov/) · [NumPy 数据类型](https://numpy.org/doc/stable/user/basics.types.html)

 

动手练习



运行 ` labs/host_vec.c `：验证旋转 (1,0)90°→(0,1) 与正交性。



**检查结果：** 旋转 (1,0)90°→(0,1)（|误差|\<1e-9）；正交性 c²\+s²=1.000。

 

迁移练习：把本章的“能用旋转矩阵与齐次坐标实现坐标变换，并用正交性（RᵀR=I）校验/求逆。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m07","criterion":"旋转 (1,0)90°→(0,1)（|误差|<1e-9）；正交性 c²+s²=1.000。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
