# 接口电路与总线物理层

```zhizhan-anchor
m06
```



同一协议在不同物理层表现不同：UART 电平、[I²C](term:i2c) 开漏、SPI 推挽、CAN 差分。关键在 **驱动、终端与共地** ——很多“偶尔出错”是物理层问题。

 

> 前置：了解 UART/I2C/SPI/CAN 的协议与物理层概念。 · ◷ 约 42 分钟 · ◈ 数字/模拟/电源对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按总线选电平/驱动与终端匹配，识别共地/隔离/防护问题。

 

本章速览




- 总线物理层决定“偶尔出错”。

- CAN 两端 120Ω 终端；开漏要上拉。

- 跨地电位差用隔离。

 

```zhizhan-anchor
m06-phy
```



```zhizhan-anchor
m06-phy-t
```



## 6.1 物理层：驱动、终端、共地



同一协议在不同物理层表现不同。CAN 两端各 120Ω 终端匹配特征阻抗、减少反射；跨地电位差大时用隔离。物理层问题常表现为“偶尔出错”。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  CAN 差分与终端



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="CAN 差分与终端" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">节点 A（120Ω 终端）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">差分传输线 z0=120Ω</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">节点 B（120Ω 终端）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="165.0" class="sv-lbl-hi">失配 → 反射</text></svg>
```



CANH/CANL 差分传输；两端各 120Ω 终端匹配 z0，减少反射；差分驱动器看到 60Ω 并联负载。



表 6.1 总线物理层



| 总线 | 物理层要点 | 常见故障 |
| --- | --- | --- |
| UART | 电平/共地 | 电平不符/地漂 |
| I²C | 开漏\+上拉 | 上拉/电容 |
| SPI | 推挽/片选 | 片选/速率 |
| CAN | 差分\+120Ω 终端 | 缺终端/反射 |
| 隔离 | 光耦/数字隔离 | 地环路 |



term.c 节选C

 

```text
double z_par = 120.0*120.0/(120.0+120.0);        // 60Ω
double gamma = (1000.0-120.0)/(1000.0+120.0);     // 0.79
/* 匹配时 gamma≈0；失配 → 反射 → 误码 */
```

两端终端匹配 z0；失配反射系数大



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：终端与反射



下面这段程序验证终端等效阻抗与失配反射系数：



host\_term.cC

 

```text
/* host_term.c —— 总线终端与反射：传输线阻抗匹配（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_term.c -o host_term && ./host_term
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    /* 特征阻抗 120Ω 的 CAN 总线：两端各 120Ω 终端，等效 60Ω */
    float z0 = 120.0f, rterm = 120.0f;
    float z_eff = 1.0f/(1.0f/rterm + 1.0f/rterm);
    printf("两端 120Ω 终端 → 等效 %.0fΩ（应匹配 z0=120Ω 的差分）\n", z_eff);
    /* 反射系数：负载 ZL 与 z0 */
    float zl_bad = 1000.0f;
    float gamma = (zl_bad - z0) / (zl_bad + z0);
    printf("失配负载 1k 的反射系数=%.2f（越接近 0 越好）\n", gamma);
    if (fabsf(gamma) < 0.5f) ok = 0;              /* 失配明显 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

终端/反射模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_term.c -o labs/host_term && ./labs/host_term
两端 120Ω 终端 → 等效 60Ω（应匹配 z0=120Ω 的差分）
失配负载 1k 的反射系数=0.79（越接近 0 越好）
RESULT: PASS
```



两端各 120Ω 各匹配本端；差分驱动器看到 60Ω 并联负载。失配 1k 反射系数 0.79（越接近 0 越好）。



表 6.2 终端与反射



| 情形 | 等效/系数 | 判定 |
| --- | --- | --- |
| 两端 120Ω | 差分 60Ω | 匹配 |
| 失配 1k | 反射系数 0.79 | 差 |
| 匹配 | 反射系数≈0 | 好 |
| 缺终端 | 反射大 | 误码 |



```zhizhan-anchor
m06-iso
```



```zhizhan-anchor
m06-iso-t
```



## 6.3 隔离与共地



长线/多节点/高速要关注终端与拓扑；跨地电位差大时用隔离（光耦/数字隔离）避免地环路。



term.c 节选C

 

```text
double z_par = 120.0 * 120.0 / (120.0 + 120.0);   // 60Ω
double gamma = (1000.0 - 120.0) / (1000.0 + 120.0); // 0.79
/* 匹配时 gamma≈0；缺终端/失配 → 反射 → 误码 */
```

两端终端匹配 z0；失配反射系数大



表 6.3 物理层实践



| 场景 | 做法 | 避免 |
| --- | --- | --- |
| 长线/多节点 | 正确终端\+拓扑 | 反射/误码 |
| 地电位差大 | 隔离 | 地环路 |
| ESD | 防护器件 | 接口损坏 |
| 共地 | 单点/星形地 | 地漂移 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



物理层自检：终端匹配、共地良好、必要隔离、ESD 防护。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  反射系数（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="反射系数（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">匹配</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="43" class="sv-lbl-hi">0(×10⁻²)</text><text x="12" y="67" class="sv-lbl">失配 1k</text><rect x="150" y="50" width="474" height="18" rx="4" class="sv-red-s"></rect><text x="632" y="67" class="sv-lbl-hi">79(×10⁻²)</text></svg>
```



匹配时反射系数≈0；失配 1k 时 0.79，反射严重会导致误码。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 终端 | 测 120Ω×2 | 缺终端 |
| 共地 | 测地电位差 | 地漂移 |
| 隔离 | 按需 | 地环路 |
| 防护 | ESD 器件 | 接口损坏 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **缺终端** ：反射导致误码。

- **共地不良** ：地电位差误触发。

- **无隔离** ：地环路烧接口。

- **ESD 防护缺失** ：接口易损。



◆ 自测 · Module 06（先答再看）




1. CAN 为什么两端各要 120Ω 终端？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"匹配传输线特征阻抗、吸收反射，保证信号完整；缺终端会因反射产生误码，高速/长线时更明显。"}
   ```

2. 为什么长线/多节点要关注“拓扑”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"拓扑（总线型 vs 星形）与分支线长度会影响反射与信号质量。总线型 \\+ 正确终端是 CAN 的推荐拓扑。"}
   ```

3. 跨地电位差大时为什么用隔离？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"地电位差会形成地环路电流，干扰通信甚至烧接口。隔离（光耦/数字隔离）切断电气连接，消除地环路。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你 CAN/RS-485 总线核对两端终端与共地/隔离，用示波器看波形确认无反射。



核对与延伸：[I²C 总线规范 UM10204](https://www.nxp.com/docs/en/user-guide/UM10204.pdf) · [CAN 物理层与终端](https://www.ti.com/lit/an/slla270/slla270.pdf)

 

动手练习



运行 ` labs/host_term.c `：验证终端等效阻抗与失配反射系数。



**检查结果：** 每端 120Ω 各匹配本端 z0=120Ω，差分看到 60Ω 并联负载；失配 1k 负载反射系数=0.79。

 

迁移练习：把本章的“能按总线选电平/驱动与终端匹配，识别共地/隔离/防护问题。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b17-m06","criterion":"每端 120Ω 各匹配本端 z0=120Ω，差分看到 60Ω 并联负载；失配 1k 负载反射系数=0.79。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b17-guide)
