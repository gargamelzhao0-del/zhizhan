# 可追溯与合规

```zhizhan-anchor
m07
```



可追溯性把“ **需求 ↔ 设计 ↔ 代码 ↔ 测试** ”连起来：每条需求都能查到实现与验证，这是合规（功能安全/认证）与责任界定的基础。

 

> 前置：Module 05 版本管理与 Module 06 产测记录。 · ◷ 约 42 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能建立需求↔设计↔代码↔测试的追溯矩阵，计算覆盖率并显式列出未覆盖项。

 

本章速览




- 需求↔设计↔代码↔测试连成追溯矩阵。

- 未覆盖需求必须显式列出并处理。

- 合规是贯穿开发留证据，不是最后补文档。

 

```zhizhan-anchor
m07-model
```



```zhizhan-anchor
m07-model-t
```



## 7.1 追溯矩阵：需求↔设计↔代码↔测试



每条需求都要能查到它的设计、实现与验证。合规不是最后补文档，而是 **贯穿开发留证据** ；未覆盖的需求要显式列出并处理。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  追溯链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="追溯链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">需求</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">设计</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">代码</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">测试/证据</text></svg>
```



需求 → 设计 → 代码 → 测试 → 证据；任一环断裂就是合规缺口。



表 7.1 追溯链与证据



| 环节 | 连线 | 证据 |
| --- | --- | --- |
| 需求→设计 | 设计记录 | 设计文档 |
| 设计→代码 | 提交/模块 | 版本记录 |
| 代码→测试 | 测试用例 | 测试报告 |
| 风险 | FMEA/阈值 | 风险记录 |
| 豁免 | 偏离说明 | 豁免记录 |



trace\_update.c 节选C

 

```text
for (int i=0;i<nreq;i++)
  if (!req[i].design || !req[i].code || !req[i].test)
    report_gap(req[i].id);   // 未覆盖需求显式列出
/* 覆盖率 = 已覆盖需求 / 总需求 */
```

追溯矩阵：任一环缺失即记为合规缺口



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：覆盖率与未覆盖项



下面这段主机程序计算需求覆盖率并显式列出未覆盖项：



host\_trace.cC

 

```text
/* host_trace.c —— 需求到测试的可追溯矩阵与覆盖率（主机可运行）。
 * 每条需求应有至少一个测试覆盖；列出未覆盖项，避免“测了很多但关键需求没测”。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_trace.c -o host_trace && ./host_trace
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *id; int covered; } req_t;
int main(void) {
    int ok = 1;
    req_t reqs[] = { {"REQ-01", 1}, {"REQ-02", 1}, {"REQ-03", 0}, {"REQ-04", 1}, {"REQ-05", 0} };
    int n = (int)(sizeof(reqs) / sizeof(reqs[0])), cov = 0;
    printf("未覆盖需求: ");
    for (int i = 0; i < n; i++) { if (reqs[i].covered) cov++; else printf("%s ", reqs[i].id); }
    printf("\n");
    int pct = cov * 100 / n;
    printf("覆盖 %d/%d = %d%%\n", cov, n, pct);
    if (!(cov == 3 && pct == 60)) ok = 0;
    if (pct < 100) printf("门禁：未达标（嵌入式关键需求建议 100%%）\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

需求覆盖矩阵模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_trace.c -o labs/host_trace && ./labs/host_trace
未覆盖需求: REQ-03 REQ-05 
覆盖 3/5 = 60%
门禁：未达标（嵌入式关键需求建议 100%）
RESULT: PASS
```



覆盖 3/5=60%；未覆盖项被显式列出；低于目标判“未达标”——缺口可见才能被处理。



表 7.2 覆盖率与动作



| 结果 | 含义 | 动作 |
| --- | --- | --- |
| 覆盖=100% | 无缺口 | 可发布 |
| \<100% | 有未覆盖 | 补测/接受风险/取消 |
| 未覆盖项 | 显式列出 | 不得隐藏 |
| 豁免 | 记录理由 | 审核可解释 |



```zhizhan-anchor
m07-acts
```



```zhizhan-anchor
m07-acts-t
```



## 7.3 变更与豁免记录



变更要留“改了什么、验证了没有”；豁免要记录理由。合规证据是“随开发产生”的，不是事后补的。



trace\_matrix.csv 节选CSV

 

```text
需求,设计,代码,测试,状态
REQ-01,DES-01,src/a.c,test_a,已覆盖
REQ-03,,, ,未覆盖(缺口)
REQ-05,DES-05,src/e.c, ,未覆盖(缺口)
```

追溯矩阵：每条需求对应设计/代码/测试，缺口显式可见



表 7.3 合规证据



| 记录 | 内容 | 用途 |
| --- | --- | --- |
| 变更记录 | 改了什么 \+ 验证 | 回归/审计 |
| 风险记录 | FMEA/阈值 | 优先级 |
| 豁免记录 | 偏离 \+ 理由 | 审核解释 |
| 测试报告 | 用例 \+ 结果 | 证据 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检与三路线对照



合规自检：追溯矩阵完整、覆盖率达标、缺口与豁免可见。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  需求覆盖率与目标（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="需求覆盖率与目标（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">当前覆盖</text><rect x="150" y="26" width="327" height="18" rx="4" class="sv-amb-s"></rect><text x="485" y="43" class="sv-lbl-hi">60%</text><text x="12" y="67" class="sv-lbl">目标</text><rect x="150" y="50" width="545" height="18" rx="4" class="sv-grn-s"></rect><text x="703" y="67" class="sv-lbl-hi">100%</text></svg>
```



关键需求目标 100%；本例 60% 未达标，必须先处理缺口或显式接受风险。



表 7.4 三路线合规



| 路线 | 合规实践 | 说明 |
| --- | --- | --- |
| MCU 工程 | 追溯矩阵 \+ 测试报告 | 功能安全常用 |
| Linux 工程 | SBOM/来源 \+ 测试 | 供应链 |
| CI/自动化 | 自动生成追溯/覆盖率 | 证据自动化 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **需求无实现/无测试** ：合规缺口。

- **变更无记录** ：无法证明“改了什么、验证了没有”。

- **豁免不记录** ：审核时无法解释。

- **最后补文档** ：与实际实现不符。



◆ 自测 · Module 07（先答再看）




1. 为什么“未覆盖需求”必须显式列出？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"隐藏的假设最危险。显式列出未覆盖项，团队才能决定“补测/接受风险/取消需求”并留证据，否则合规与质量都有盲区。"}
   ```

2. 追溯矩阵要连起哪几环？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"需求 ↔ 设计 ↔ 代码 ↔ 测试（\\+ 证据）。每条需求都能查到实现与验证。"}
   ```

3. 为什么合规证据不能“最后补”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"事后补的文档往往与实际实现不符，也无法证明验证过程。合规证据应随开发自然产生。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的功能建一张需求↔设计↔代码↔测试的追溯矩阵，列出并处理所有未覆盖项。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/) · [MISRA C](https://misra.org.uk/)

 

动手练习



运行 ` labs/host_trace.c `：计算需求覆盖率并列出未覆盖项。



**检查结果：** 覆盖 3/5=60%；未覆盖项 REQ-03、REQ-05 被列出；\<100% 判未达标。

 

迁移练习：把本章的“能建立需求↔设计↔代码↔测试的追溯矩阵，计算覆盖率并显式列出未覆盖项。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m07","criterion":"覆盖 3/5=60%；未覆盖项 REQ-03、REQ-05 被列出；<100% 判未达标。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
