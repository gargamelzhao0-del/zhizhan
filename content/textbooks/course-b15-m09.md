# 形式化方法与高可靠设计

```zhizhan-anchor
m09
```



形式化方法用 **数学化的不变量与契约** 提高可靠性：断言、契约式设计、模型检验、运行时监控。在嵌入式里的现实用法是“关键模块 \+ 不变量”。

 

> 前置：掌握状态机与并发基本概念；有断言/单元测试实践经验。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为关键模块提炼不变量并用断言/运行时监控在违反时进入安全态。

 

本章速览




- 关键模块用不变量\+断言/监控。

- 违约即进入安全态并记录。

- 务实落地，不过度形式化。

 

```zhizhan-anchor
m09-formal
```



```zhizhan-anchor
m09-formal-t
```



## 9.1 不变量、契约、运行时监控



形式化方法把“始终成立的条件”显式化：不变量、契约（前置/后置）、模型检验、运行时监控。嵌入式里的现实用法是关键模块 \+ 不变量 \+ 断言。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  不变量与安全态



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="不变量与安全态" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">不变量</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">断言/监控</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">违反?</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">安全态/记录</text></svg>
```



定义不变量 → 断言/监控检查 → 违反则进安全态并记录（而非带病继续）。



表 9.1 形式化方法



| 方法 | 内容 | 落地 |
| --- | --- | --- |
| 不变量 | 始终成立的条件 | 断言/监控 |
| 契约 | 前置/后置/不变式 | 模块边界 |
| 模型检验 | 穷举状态 | 关键协议 |
| 静态验证 | 编译期证明 | 小关键代码 |
| 运行时监控 | 在线检查 | 安全态 |



invariant.c 节选C

 

```text
assert(state == IDLE || state == RUN);   // 不变量
if (violated()) { enter_safe_state(); log_ts(); }  // 违反→安全态
/* 关键模块 2~3 条不变量，运行期持续检查 */
```

关键模块不变量 \+ 运行期监控 \+ 违反进安全态



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：表决与安全态



下面这段程序验证 2oo3 表决与故障时进入安全态：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_safety.cC\n\n \n\n```text\n/* host_safety.c —— 功能安全：三取二表决与安全态（主机可运行）。\n * 2oo3 表决：三路传感器取多数；不一致时进入安全态（保守输出）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_safety.c -o host_safety && ./host_safety\n */\n#include <stdio.h>\nstatic int vote2oo3(int a, int b, int c) { int s = (a>0)+(b>0)+(c>0); return s >= 2; }   /* 多数为 1 则 1 */\nint main(void) {\n    int ok = 1;\n    printf(\"(1,1,0)→%d (1,1,1)→%d (0,0,1)→%d (1,0,0)→%d\\n\", vote2oo3(1,1,0), vote2oo3(1,1,1), vote2oo3(0,0,1), vote2oo3(1,0,0));\n    if (!(vote2oo3(1,1,0)==1 && vote2oo3(1,1,1)==1 && vote2oo3(0,0,1)==0 && vote2oo3(1,0,0)==0)) ok = 0;\n    /* 安全态：三路全异或含故障 → 输出安全值 0 */\n    int fault = 1, safe_out = fault ? 0 : vote2oo3(1,1,0);\n    printf(\"故障时安全输出=%d（期望 0）\\n\", safe_out);\n    if (safe_out != 0) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n表决/安全态模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_safety.c -o labs/host_safety && ./labs/host_safety
(1,1,0)→1 (1,1,1)→1 (0,0,1)→0 (1,0,0)→0
故障时安全输出=0（期望 0）
RESULT: PASS
```



不变量“至少 2 路一致才输出 1”由表决实现；违反（故障）时输出 0 进安全态。



表 9.2 不变量示例



| 不变量示例 | 含义 | 违反动作 |
| --- | --- | --- |
| send 与 ack 配对 | 收发一致 | 复位状态 |
| 状态转移合法 | 只走定义迁移 | 拒绝\+记录 |
| 输出 ≥2 路一致 | 2oo3 | 进安全态 |
| 资源不双重释放 | 无悬空 | 断言失败 |



```zhizhan-anchor
m09-practical
```



```zhizhan-anchor
m09-practical-t
```



## 9.3 务实落地



务实做法：对状态机、协议、并发等关键部分定义不变量并用断言/监控执行；违反立即进入安全态并记录。避免“过度形式化”（成本远超收益）。



invariant.c 节选C

 

```text
assert(state == IDLE || state == RUN);   // 不变量
if (violated()) { enter_safe_state(); log_ts(); }  // 违反→安全态
/* 关键模块 2~3 条不变量，运行期持续检查 */
```

关键模块的不变量 \+ 运行期监控 \+ 违反进安全态



表 9.3 务实落地要点



| 做法 | 收益 | 避免 |
| --- | --- | --- |
| 关键模块不变量 | 显式化假设 | 整系统形式化 |
| 断言/监控 | 运行期检查 | 生产全去掉 |
| 进安全态 | 失效安全 | 带病继续 |
| 记录 | 可追溯 | 静默失败 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检与成熟度对照



形式化自检：有明确不变量、运行期监控、违反进安全态。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  不变量与安全等级（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="不变量与安全等级（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">不变量覆盖</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-grn-s"></rect><text x="638" y="43" class="sv-lbl-hi">80%</text><text x="12" y="67" class="sv-lbl">监控在线</text><rect x="150" y="50" width="600" height="18" rx="4" class="sv-cyn-s"></rect><text x="758" y="67" class="sv-lbl-hi">100%</text></svg>
```



关键不变量覆盖越全、监控越到位，失效被及时拦截的概率越高。



表 9.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 断言\+监控 | 广泛应用 |
| 成长期 | 模型检验工具 | 关键协议 |
| 观察期 | 全形式化 | 特高风险 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **无关键不变量** ：隐含假设不被检查。

- **断言在生产全去掉** ：失去监控。

- **契约与实现脱节** ：文档化契约无效。

- **过度形式化** ：成本远超收益。



◆ 自测 · Module 09（先答再看）




1. 嵌入式里“不变量 \+ 断言”最实用的点是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把隐含的正确性假设显式化并在运行期检查；一旦违反立刻进入安全态并记录，比“出问题了再猜”可靠得多。"}
   ```

2. 为什么“生产版本去掉所有断言”是危险的？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"断言是运行期不变量检查。全去掉就失去了对关键假设的监控，问题会静默发生而非被及时拦截。"}
   ```

3. “过度形式化”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"对整系统做重形式化验证，成本远超收益。务实做法是只对状态机、协议、并发等关键部分做不变量/监控。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你关键状态机写 2~3 条不变量并加断言/监控，违反时进入安全态并记录时间戳。



核对与延伸：[ISO 26262 / IEC 61508 概述](https://www.iso.org/standard/68383.html)

 

动手练习



运行 ` labs/host_safety.c `（表决与安全态）；为你的状态机写 2~3 条不变量并加断言。



**检查结果：** 关键不变量被断言/监控；违反时进入安全态、安全输出=0 并记录；2oo3 示例 (1,1,0)→1。

 

迁移练习：把本章的“能为关键模块提炼不变量并用断言/运行时监控在违反时进入安全态。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m09","criterion":"关键不变量被断言/监控；违反时进入安全态、安全输出=0 并记录；2oo3 示例 (1,1,0)→1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
