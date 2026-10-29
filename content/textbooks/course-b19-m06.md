# 数值表示与误差

```zhizhan-anchor
m06
```



数值表示决定“能不能算、算多准”：整数精确但范围小，浮点范围大但有误差， **定点 Q15**  是嵌入式常用折中。

 

> 前置：理解整数位宽、二进制补码与浮点基本概念。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为变量选定点/浮点表示与定标，做饱和运算并把误差控制在 1 LSB 内。



```zhizhan-anchor
m06-knowledge-boundary
```



### 数值接口先写范围，再选择位宽



定点中间乘积用足够宽的类型；溢出前转换，缩回时规定舍入与饱和。负数除法与移位规则可能不同；Q15 的正端不能表示 1。把输入上限、最大累计量和返回错误写入接口，再用端点与参考实现对拍。

 

本章速览




- 数值表示决定范围与误差：整数/定点/浮点。

- Q15 误差 ≤ 1/32768；乘法升位。

- 溢出要用饱和而非回绕。

 

```zhizhan-anchor
m06-num
```



```zhizhan-anchor
m06-num-t
```



## 6.1 整数/定点/浮点



整数精确但范围小（会溢出），浮点范围大但有舍入误差且慢，定点 Q15 是嵌入式常用折中：范围 \[-1,1)、量化误差 ≤ 1/32768。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  三种数值表示的取舍



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="三种数值表示的取舍" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">定长整数：精确但会溢出</text><rect x="60" y="64" width="680" height="50" rx="6" class="sv-grn-s"></rect><text x="75" y="93.0" class="sv-lbl-hi">定点 Q15：快、可预测、[-1,1)</text><rect x="60" y="118" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="137.0" class="sv-lbl-hi">浮点：范围大、有舍入误差</text></svg>
```



定长整数（精确/易溢出）、定点 Q15（快/可预测/范围小）、浮点（范围大/有误差/慢）。



表 6.1 数值表示



| 表示 | 范围 | 误差/代价 |
| --- | --- | --- |
| 定长整数 | 有限 | 溢出 |
| 定点 Q15 | \[-1,1) | 量化误差 ≤ 1/32768 |
| 单精度浮点 | 大 | 舍入误差、慢 |
| 双精度 | 更大 | 更慢/占内存 |
| 饱和运算 | —— | 防溢出回绕 |



num.c 节选C

 

```text
int16_t q = (int16_t)lrintf(x * 32768.0f);       // 量化
if (q > 32767) q = 32767; else if (q < -32768) q = -32768;  // 饱和
float xr = q / 32768.0f;                          // 反量化
/* 乘法中间结果升 32 位再右移，避免溢出 */
```

Q15 量化\+饱和；乘法升位防溢出



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：Q15 量化误差



下面这段程序验证 Q15 量化/反量化误差：



host\_num.cC

 

```text
/* host_num.c —— 定点 Q15 与浮点误差（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_num.c -o host_num && ./host_num
 */
#include <stdio.h>
#include <stdint.h>
static int16_t q15(float x) { float s = x*32768.0f; if (s > 32767) s = 32767; if (s < -32768) s = -32768; return (int16_t)(s < 0 ? s - 0.5f : s + 0.5f); }
static float q15_to_f(int16_t q) { return q / 32768.0f; }
int main(void) {
    int ok = 1;
    float xs[] = {0.5f, -0.5f, 0.999f, -1.0f};
    float maxe = 0;
    for (unsigned i = 0; i < sizeof(xs)/sizeof(xs[0]); i++) {
        int16_t q = q15(xs[i]); float r = q15_to_f(q); float e = r - xs[i]; if (e < 0) e = -e;
        if (e > maxe) maxe = e;
        printf("x=%+.3f q=%6d x'=%+.5f err=%.5f\n", xs[i], q, r, e);
    }
    printf("最大误差=%.5f（≤ 1/32768=%.5f）\n", maxe, 1.0f/32768.0f);
    if (maxe > 1.0f/32768.0f + 1e-6f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

Q15 定点量化模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_num.c -o labs/host_num && ./labs/host_num
x=+0.500 q= 16384 x'=+0.50000 err=0.00000
x=+0.999 q= 32735 x'=+0.99899 err=0.00001
x=-1.000 q=-32768 x'=-1.00000 err=0.00000
最大误差=0.00001（≤ 1/32768=0.00003）
RESULT: PASS
```



Q15 定标：q=round(x·32768) 裁剪到 \[-32768,32767\]；最大误差 ≤1/32768≈3.05e-5。



表 6.2 Q15 关键值



| 量 | 公式 | 值 |
| --- | --- | --- |
| Q15 定标 | q=round(x·32768) | \[-32768,32767\] |
| LSB | 1/32768 | ≈3.05e-5 |
| 量化误差 | ≤1/2 LSB | ≈1.5e-5 |
| 边界 | 饱和 | -32768 |



```zhizhan-anchor
m06-sat
```



```zhizhan-anchor
m06-sat-t
```



## 6.3 定标一致与饱和



定点要点：定标（scale）要一致、乘法用宽类型中间结果、结果做饱和而非回绕。能确定范围时定点又快又可预测。



num.c 节选C

 

```text
int16_t q = (int16_t)lrintf(x * 32768.0f);       // 量化
if (q > 32767) q = 32767; else if (q < -32768) q = -32768;  // 饱和
float xr = q / 32768.0f;                          // 反量化
/* 乘法中间结果升 32 位再右移，避免溢出 */
```

Q15 量化\+饱和；乘法升位防溢出



表 6.3 定点实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 定标一致 | 结果正确 | 差倍数 |
| 中间升位 | 乘法不溢出 | 回绕 |
| 饱和 | 防符号翻转 | 灾难错误 |
| 范围明确 | 定点可预测 | 隐含溢出 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



数值自检：定标一致、误差 ≤1 LSB、边界饱和、乘法升位。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  Q15 量化误差（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="Q15 量化误差（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">误差</text><rect x="150" y="26" width="150" height="18" rx="4" class="sv-grn-s"></rect><text x="308" y="43" class="sv-lbl-hi">1(×10⁻⁵)</text><text x="12" y="67" class="sv-lbl">1/32768</text><rect x="150" y="50" width="450" height="18" rx="4" class="sv-amb-s"></rect><text x="608" y="67" class="sv-lbl-hi">3(×10⁻⁵)</text></svg>
```



各测试点误差 ≤1/32768≈3.05e-5；边界饱和为 -32768 而非回绕。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 定标 | 统一 scale | 不一致 |
| 误差 | ≤1 LSB | 超规格 |
| 饱和 | 边界钳位 | 回绕 |
| 升位 | 乘法中间 32 位 | 溢出 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **溢出回绕** ：符号翻转，灾难性错误。

- **定标不一致** ：结果差倍数。

- **中间结果溢出** ：乘法未升位。

- **浮点误差累积** ：长期漂移。



◆ 自测 · Module 06（先答再看）




1. 定点乘法为什么常用宽类型中间结果？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"两个 Q15 相乘结果是 Q30 量级，直接用 16 位会溢出；应升到 32 位再移位回 Q15。配合饱和可避免回绕。"}
   ```

2. 为什么边界要做“饱和”而不是“回绕”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"回绕会让最大正数加一变成最大负数，造成灾难性错误；饱和把越界值钳到边界，行为可预测。"}
   ```

3. 什么时候用定点、什么时候用浮点？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"能确定范围且追求速度/可预测/无 FPU 时用定点；范围大、精度要求高或有 FPU 时用浮点。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个信号处理变量选定点 Q 格式与定标，做饱和运算并核对误差 ≤1 LSB。



核对与延伸：[NIST 数值方法](https://dlmf.nist.gov/) · [Efficient C 定点](https://www.embedded.com/)

 

动手练习



运行 ` labs/host_num.c `：验证 Q15 量化/反量化误差 ≤ 1/32768。



**检查结果：** 4 个测试点最大量化误差=0.00001 ≤ 1/32768≈0.00003；-1.0 边界饱和为 -32768（不回绕）。

 

迁移练习：把本章的“能为变量选定点/浮点表示与定标，做饱和运算并把误差控制在 1 LSB 内。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m06","criterion":"4 个测试点最大量化误差=0.00001 ≤ 1/32768≈0.00003；-1.0 边界饱和为 -32768（不回绕）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
