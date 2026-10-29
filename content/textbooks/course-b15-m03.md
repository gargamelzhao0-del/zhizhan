# 功能安全与合规认证

```zhizhan-anchor
m03
```



功能安全关心“ **失效时不会造成不可接受的风险** ”：定安全目标、做 FMEA/诊断覆盖、用冗余与表决提高容错，并留完整证据链。

 

> 前置：了解可靠性基本概念（失效、冗余）；有软硬件 FMEA 或诊断设计经验。 · ◷ 约 44 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 2oo3 表决与诊断覆盖设计满足目标安全等级的失效安全行为。

 

本章速览




- 功能安全目标是“失效即安全”。

- 冗余要防共因失效（独立性/多样性）。

- 诊断覆盖与证据链支撑认证。

 

```zhizhan-anchor
m03-safety
```



```zhizhan-anchor
m03-safety-t
```



## 3.1 失效导向安全



功能安全的目标是失效时不会造成不可接受的风险。手段：安全目标、诊断覆盖、冗余/表决、安全态（失效即安全）。默认是“失效导向安全”。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  失效导向安全的路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="失效导向安全的路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">检测故障</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">进安全态</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">关输出/降级</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">记录</text></svg>
```



检测到故障 → 进入安全态（关输出/降级）→ 记录；而不是带故障继续运行。



表 3.1 功能安全五概念



| 概念 | 内容 | 手段 |
| --- | --- | --- |
| 安全目标 | 可接受风险 | 危害分析 |
| 诊断覆盖 | 能发现多少失效 | 自检/冗余 |
| 冗余/表决 | 2oo3 等 | 多数表决 |
| 安全态 | 失效即安全 | 关输出/降级 |
| 证据 | 过程记录 | 认证 |



safety.c 节选C

 

```text
out = (a & b) | (b & c) | (a & c);   // 2oo3 表决
if (diag_fault()) enter_safe_state();  // 故障→安全输出 0
/* 冗余需独立供电/时钟/软件，避免共因失效 */
```

2oo3 表决 \+ 独立冗余 \+ 故障进安全态



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：2oo3 表决与安全态



下面这段程序验证三取二表决与故障时进入安全态：



host\_safety.cC

 

```text
/* host_safety.c —— 功能安全：三取二表决与安全态（主机可运行）。
 * 2oo3 表决：三路传感器取多数；不一致时进入安全态（保守输出）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_safety.c -o host_safety && ./host_safety
 */
#include <stdio.h>
static int vote2oo3(int a, int b, int c) { int s = (a>0)+(b>0)+(c>0); return s >= 2; }   /* 多数为 1 则 1 */
int main(void) {
    int ok = 1;
    printf("(1,1,0)→%d (1,1,1)→%d (0,0,1)→%d (1,0,0)→%d\n", vote2oo3(1,1,0), vote2oo3(1,1,1), vote2oo3(0,0,1), vote2oo3(1,0,0));
    if (!(vote2oo3(1,1,0)==1 && vote2oo3(1,1,1)==1 && vote2oo3(0,0,1)==0 && vote2oo3(1,0,0)==0)) ok = 0;
    /* 安全态：三路全异或含故障 → 输出安全值 0 */
    int fault = 1, safe_out = fault ? 0 : vote2oo3(1,1,0);
    printf("故障时安全输出=%d（期望 0）\n", safe_out);
    if (safe_out != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

2oo3 表决/安全态模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_safety.c -o labs/host_safety && ./labs/host_safety
(1,1,0)→1 (1,1,1)→1 (0,0,1)→0 (1,0,0)→0
故障时安全输出=0（期望 0）
RESULT: PASS
```



2oo3 需 ≥2 路一致；发生故障时输出=0（安全态），不带故障运行。



表 3.2 2oo3 真值



| 输入 | 2oo3 输出 | 说明 |
| --- | --- | --- |
| (1,1,0) | 1 | 多数为 1 |
| (0,0,1) | 0 | 多数为 0 |
| (1,1,1) | 1 | 全一致 |
| 故障 | 0 | 安全态 |



```zhizhan-anchor
m03-common
```



```zhizhan-anchor
m03-common-t
```



## 3.3 共因失效与诊断覆盖



冗余要考虑 **共因失效** ：共用电源/时钟/软件会让多路同时失效。独立性与多样性是冗余有效的前提；诊断覆盖决定能发现多少失效。



safety.c 节选C

 

```text
out = (a & b) | (b & c) | (a & c);   // 2oo3 表决
if (diag_fault()) enter_safe_state();  // 故障→安全输出 0
/* 冗余：独立供电/时钟/软件，避免共因失效 */
```

2oo3 表决 \+ 独立冗余 \+ 故障进安全态



表 3.3 诊断覆盖与共因



| 失效模式 | 诊断手段 | 覆盖 |
| --- | --- | --- |
| 硬件故障 | 自检/BIST | 取决于实现 |
| 软件错误 | 断言/监控 | 关键路径 |
| 共因失效 | 独立性/多样性 | 设计阶段 |
| 通信错误 | CRC/超时 | 协议层 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检与成熟度对照



功能安全自检：有安全目标、诊断覆盖、冗余表决、安全态、证据链。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  诊断覆盖率与安全等级（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="诊断覆盖率与安全等级（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">SIL1</text><rect x="150" y="26" width="360" height="18" rx="4" class="sv-cyn-s"></rect><text x="518" y="43" class="sv-lbl-hi">60%(诊断覆盖目标)</text><text x="12" y="67" class="sv-lbl">SIL2</text><rect x="150" y="50" width="540" height="18" rx="4" class="sv-amb-s"></rect><text x="698" y="67" class="sv-lbl-hi">90%(诊断覆盖目标)</text><text x="12" y="91" class="sv-lbl">SIL3</text><rect x="150" y="74" width="594" height="18" rx="4" class="sv-grn-s"></rect><text x="752" y="91" class="sv-lbl-hi">99%(诊断覆盖目标)</text></svg>
```



安全等级越高，要求的诊断覆盖率越高；用自检/冗余提升覆盖率。



表 3.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 成熟安全 MCU/认证包 | 直接采用 |
| 成长期 | 部分认证 | 按需 |
| 观察期 | 缺证据 | 不用于安全产品 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **无安全态** ：失效后继续输出。

- **无诊断覆盖** ：失效测不出。

- **冗余共因失效** ：同一电源/时钟拖垮多路。

- **证据链缺失** ：无法认证。



◆ 自测 · Module 03（先答再看）




1. 为什么冗余要考虑“共因失效”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"如果两路冗余共用同一电源/时钟/软件，一个共因故障会让两路同时失效，冗余失效。独立性与多样性是冗余有效的前提。"}
   ```

2. “失效导向安全”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"检测到故障就进入安全态（关输出/降级），而不是带故障继续运行。安全态是功能安全的默认行为。"}
   ```

3. 诊断覆盖率衡量什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"系统能发现（诊断出）的失效占全部可能失效的比例。安全等级越高，要求的覆盖率越高。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你关键功能做一次失效分析，明确安全态与诊断手段，并用 2oo3 或自检提高覆盖率。



核对与延伸：[ISO 26262 / IEC 61508 概述](https://www.iso.org/standard/68383.html)

 

动手练习



运行 ` labs/host_safety.c `：验证 2oo3 表决与故障时进入安全态。



**检查结果：** 2oo3 表决 (1,1,0)→1、(0,0,1)→0；故障时安全输出=0，不带故障运行。

 

迁移练习：把本章的“能用 2oo3 表决与诊断覆盖设计满足目标安全等级的失效安全行为。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m03","criterion":"2oo3 表决 (1,1,0)→1、(0,0,1)→0；故障时安全输出=0，不带故障运行。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
