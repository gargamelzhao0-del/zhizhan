# 数据语义、时间与质量

```zhizhan-anchor
m09
```



数据“能存”不等于“能用”。语义层要明确 **单位/标定版本、事件时间与到达时间、质量标志** ，并处理重复/乱序/缺失。

 

> 前置：完成 M03（时序存储）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：检测重复/乱序/序号跳变并标注质量标志，使重复=1、乱序=1、跳变=3。



```zhizhan-anchor
m09-knowledge-boundary
```



### 事件时间和到达时间分开保存



设备单调时钟适合本机间隔，不能直接用来比较不同设备的绝对时间。事件时间来自采样，到达时间来自服务器；时钟同步误差、重启和序号回绕都要进入数据契约。P04 保留乱序记录并识别相同键的冲突载荷，分析时再按事件时间排序。

 

本章速览




- 分析用事件时间，运维看到达时间。

- 时钟同步 \+ 去重 \+ 乱序重排 \+ 缺口处理。

- 数据带质量标志。

 

```zhizhan-anchor
m09-sem
```



```zhizhan-anchor
m09-sem-t
```



## 9.1 事件时间 vs 到达时间、质量标志



用 **事件时间** 做分析与告警（数据实际发生的时间），用到达时间做运维；所有数据带 **质量标志** 。时间口径是数据平台的“地基”。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  事件时间与到达时间



```zhizhan-figure
<svg viewBox="0 0 800 154" width="100%" height="154" role="img" aria-label="事件时间与到达时间" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V128"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V128"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M460,26 V128"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M615,26 V128"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M770,26 V128"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><text x="12" y="48" class="sv-lbl">事件时间</text><path class="sv-dash" d="M150,44 H770"></path><rect x="253" y="32" width="52" height="22" rx="4" class="sv-grn-s"></rect><text x="279.2" y="47" text-anchor="middle" class="sv-lbl-hi">t_e</text><text x="12" y="82" class="sv-lbl">到达时间</text><path class="sv-dash" d="M150,78 H770"></path><rect x="615" y="66" width="52" height="22" rx="4" class="sv-amb-s"></rect><text x="640.8" y="81" text-anchor="middle" class="sv-lbl-hi">t_a</text><text x="12" y="116" class="sv-lbl">延迟</text><path class="sv-dash" d="M150,112 H770"></path><rect x="253" y="100" width="413" height="22" rx="4" class="sv-box"></rect><text x="460.0" y="115" text-anchor="middle" class="sv-lbl-hi">网络/网关延迟</text></svg>
```



数据在 t\_e 发生，因网络/网关延迟在 t\_a 到达。分析用 t\_e（稳定），运维看 t\_a（延迟）。



表 9.1 语义五问题



| 问题 | 含义 | 处理 |
| --- | --- | --- |
| 事件 vs 到达 | 采集时间 ≠ 入库时间 | 按事件时间排序 |
| 时钟漂移 | 设备时间不准 | NTP/校时 |
| 重复 | 重传导致 | 序列号去重 |
| 乱序 | 网络/网关导致 | 窗口重排 |
| 缺失 | 丢样 | 标记/插值 |



semantics.c 节选C

 

```text
if (seq == last) dup++;                 // 重复
if (seq < last)  reorder++;             // 乱序
if (seq != last + 1) jumps++;           // 序号跳变(含重/乱)
out.quality = (dup||reorder) ? Q_SUSPECT : Q_OK;
```

按序号检测重复/乱序/跳变并打质量标志



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：重复/乱序/跳变



下面这段程序检测重复、乱序与序号跳变（缺口）：



host\_semantics.cC

 

```text
/* host_semantics.c —— 数据语义：重复/缺失/乱序检测（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_semantics.c -o host_semantics && ./host_semantics
 */
#include <stdio.h>
typedef struct { long t; int seq; } rec_t;
int main(void) {
    int ok = 1;
    rec_t r[] = { {100,1},{200,2},{200,2},{400,4},{300,3} };  /* 重复/缺失3/乱序 */
    int n = (int)(sizeof(r)/sizeof(r[0]));
    int dup = 0, gap = 0, ooo = 0;
    for (int i = 1; i < n; i++) {
        if (r[i].t == r[i-1].t) dup++;
        if (r[i].t < r[i-1].t) ooo++;
        if (r[i].seq != r[i-1].seq + 1) gap++;
    }
    printf("重复=%d 乱序=%d 序号跳变=%d\n", dup, ooo, gap);
    if (!(dup == 1 && ooo == 1 && gap >= 2)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

数据语义检测模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_semantics.c -o labs/host_semantics && ./labs/host_semantics
重复=1 乱序=1 序号跳变=3
RESULT: PASS
```



“序号跳变=3”是跳变次数（含重复与乱序导致的序号不连续），与“缺失样本数”不是一回事。



表 9.2 语义指标口径



| 量 | 含义 | 注意 |
| --- | --- | --- |
| 重复 | 同序号多次 | 去重 |
| 乱序 | 序号非单调 | 重排 |
| 序号跳变 | 相邻号不连续次数 | 非缺失样本数 |
| 质量标志 | 可信度 | 下游据此使用 |



```zhizhan-anchor
m09-quality
```



```zhizhan-anchor
m09-quality-t
```



## 9.3 去重、重排、质量标志



处理顺序：按序列号去重 → 按事件时间窗口重排 → 缺失标记（不擅自插值）→ 打质量标志。下游按质量标志决定是否使用。



semantics.c 节选C

 

```text
if (seq == last_seq) dup++;                 // 重复
if (seq < last_seq)  reorder++;             // 乱序
if (seq != last_seq + 1) jumps++;           // 序号跳变(含重/乱)
out.quality = (dup||reorder) ? Q_SUSPECT : Q_OK;
```

按序号检测重复/乱序/跳变并打质量标志



表 9.3 质量处理步骤



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 去重 | 序列号 | 指标被放大 |
| 重排 | 事件时间窗口 | 顺序错 |
| 缺失 | 标记 | 擅自插值 |
| 质量 | 打标志 | 坏数据被当正常 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检与三级对照



语义自检：时间口径清楚、去重重排、质量标志齐全。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  脏数据检出（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="脏数据检出（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">重复</text><rect x="150" y="26" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="43" class="sv-lbl-hi">1次</text><text x="12" y="67" class="sv-lbl">乱序</text><rect x="150" y="50" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="67" class="sv-lbl-hi">1次</text><text x="12" y="91" class="sv-lbl">跳变</text><rect x="150" y="74" width="450" height="18" rx="4" class="sv-red-s"></rect><text x="608" y="91" class="sv-lbl-hi">3次</text></svg>
```



重复=1、乱序=1、跳变=3。检出并打标后，下游才能按质量决定是否使用。



表 9.4 三级语义



| 层级 | 语义角色 | 注意 |
| --- | --- | --- |
| 设备端 | 带时间戳/序号 | 时钟 |
| 边缘网关 | 去重/重排 | 窗口 |
| 云平台 | 质量/追溯 | 标定版本 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **混用事件/到达时间** ：分析口径错。

- **时钟不同步** ：时间线错乱。

- **不去重** ：指标被重复放大。

- **不标质量** ：坏数据被当正常用。



◆ 自测 · Module 09（先答再看）




1. 为什么分析要用“事件时间”而不是“到达时间”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"到达时间受网络/网关延迟影响，会随时间波动；事件时间是数据实际发生的时间，用它才能得到稳定的分析结果（到达时间用于运维观测）。"}
   ```

2. “序号跳变=3”等于“丢了 3 个样本”吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不等于。序号跳变是“相邻序号不连续的累计次数”，其中含重复与乱序导致的跳变，不是缺失样本的数量。口径要分清。"}
   ```

3. 为什么质量标志很重要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它告诉下游这条数据是否可信（重复/乱序/缺失）。不标质量，坏数据会被当正常数据用于分析与告警。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你数据加去重（序列号）、重排（事件时间窗口）与质量标志，并核对时间口径。



核对与延伸：[TimescaleDB 文档](https://docs.timescale.com/) · [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)

 

动手练习



运行 ` labs/host_semantics.c `：检测重复、乱序与序号跳变（缺口）。



**检查结果：** 重复=1 乱序=1 跳变=3（跳变含重复与乱序导致的序号不连续，非缺失样本数）。

 

迁移练习：把本章的“检测重复/乱序/序号跳变并标注质量标志，使重复=1、乱序=1、跳变=3。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m09","criterion":"重复=1 乱序=1 跳变=3（跳变含重复与乱序导致的序号不连续，非缺失样本数）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
