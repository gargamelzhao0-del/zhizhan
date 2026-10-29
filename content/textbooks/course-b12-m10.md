# 需求、接口与风险驱动测试

```zhizhan-anchor
m10
```



测试设计从 **需求与风险** 出发：把需求量化成可测标准，按风险排序，优先测“最可能坏且后果最重”的部分。

 

> 前置：Module 07 追溯矩阵与 Module 09 选型。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把需求量化成可测验收标准，按 FMEA 风险排序并用等价类/边界值/状态迁移设计用例。

 

本章速览




- 需求要量化成可测标准，按风险优先测。

- 边界值与非法事件回报最高。

- 需求-风险-测试连成矩阵。

 

```zhizhan-anchor
m10-model
```



```zhizhan-anchor
m10-model-t
```



## 10.1 量化需求与风险优先



把需求量化成可测的验收标准，按风险（FMEA/RPN）排序，优先测高风险；再依追溯矩阵保证每条需求都有测试。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  从需求到测试



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从需求到测试" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">量化需求</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">接口契约</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">风险排序</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">用例设计</text></svg>
```



量化需求 → 定接口契约 → 排风险优先级 → 设计用例（等价类/边界/状态迁移）→ 追溯。



表 10.1 测试设计方法



| 方法 | 适用 | 要点 |
| --- | --- | --- |
| 等价类 | 输入分组 | 每类取代表 |
| 边界值 | 临界 | min-1/min/max/max\+1 |
| 状态迁移 | 状态机 | 覆盖迁移与非法事件 |
| 错误路径 | 异常 | 超时/资源耗尽 |
| 风险优先 | FMEA | 高 RPN 先测 |



boundary.c 节选C

 

```text
test(min_-1); test(min); test(max); test(max+1);   // 边界值
test(valid_rep); test(invalid_rep);                 // 等价类
test(trans_ok);  test(illegal_event_rejected);      // 状态迁移
```

边界值 \+ 等价类 \+ 状态迁移（含非法事件）



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：需求覆盖矩阵



追溯矩阵把需求、测试与覆盖率连起来，未覆盖项显式可见：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_trace.cC\n\n \n\n```text\n/* host_trace.c —— 需求到测试的可追溯矩阵与覆盖率（主机可运行）。\n * 每条需求应有至少一个测试覆盖；列出未覆盖项，避免“测了很多但关键需求没测”。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_trace.c -o host_trace && ./host_trace\n */\n#include <stdio.h>\n#include <string.h>\ntypedef struct { const char *id; int covered; } req_t;\nint main(void) {\n    int ok = 1;\n    req_t reqs[] = { {\"REQ-01\", 1}, {\"REQ-02\", 1}, {\"REQ-03\", 0}, {\"REQ-04\", 1}, {\"REQ-05\", 0} };\n    int n = (int)(sizeof(reqs) / sizeof(reqs[0])), cov = 0;\n    printf(\"未覆盖需求: \");\n    for (int i = 0; i < n; i++) { if (reqs[i].covered) cov++; else printf(\"%s \", reqs[i].id); }\n    printf(\"\\n\");\n    int pct = cov * 100 / n;\n    printf(\"覆盖 %d/%d = %d%%\\n\", cov, n, pct);\n    if (!(cov == 3 && pct == 60)) ok = 0;\n    if (pct < 100) printf(\"门禁：未达标（嵌入式关键需求建议 100%%）\\n\");\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n需求覆盖矩阵模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_trace.c -o labs/host_trace && ./labs/host_trace
未覆盖需求: REQ-03 REQ-05 
覆盖 3/5 = 60%
门禁：未达标（嵌入式关键需求建议 100%）
RESULT: PASS
```



每条需求应映射到测试；本例覆盖 3/5=60%，未覆盖项列出——据此补齐高风险需求的用例。



表 10.2 按风险分配测试投入



| 风险级别 | RPN | 测试投入 |
| --- | --- | --- |
| 高 | 高 | 优先、充分覆盖 |
| 中 | 中 | 常规覆盖 |
| 低 | 低 | 抽样覆盖 |



```zhizhan-anchor
m10-design
```



```zhizhan-anchor
m10-design-t
```



## 10.3 用例设计：边界与状态



绝大多数错误在临界（空/满、最小/最大、相等/越界）与状态机的非法事件。边界值与状态迁移用少量用例覆盖最易错区域，回报最高。



test\_design.c 节选C

 

```text
/* 边界值 */
test(min_-1); test(min); test(max); test(max+1);
/* 等价类 */
test(valid_representative); test(invalid_representative);
/* 状态迁移：含非法事件 */
test(state_transition_ok); test(illegal_event_rejected);
```

边界值 \+ 等价类 \+ 状态迁移（含非法事件）



表 10.3 边界值清单



| 边界 | 用例 | 理由 |
| --- | --- | --- |
| 最小/最大 | min/max | 临界 |
| 越界 | min-1/max\+1 | 越界处理 |
| 空/满 | empty/full | 队列/缓冲 |
| 相等/不等 | ==/!= | 比较逻辑 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检与三路线对照



测试设计自检：需求可测、风险有排序、边界与非法事件覆盖、追溯完整。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  风险驱动测试的闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="风险驱动测试的闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">需求</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">风险排序</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">用例</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">执行/追溯</text></svg>
```



需求 → 风险排序 → 用例设计 → 执行 → 覆盖反馈 → 追溯矩阵更新。



表 10.4 三路线测试设计



| 路线 | 测试设计 | 说明 |
| --- | --- | --- |
| MCU 工程 | 主机 \+ HIL \+ 边界 | 按风险 |
| Linux 工程 | pytest/框架 \+ 场景 | 成熟 |
| CI/自动化 | 用例库 \+ 覆盖率门禁 | 统一 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **需求不可测** ：无法判定完成。

- **只测边界不清的用例** ：漏等价类。

- **不排风险** ：把时间花在低风险处。

- **不覆盖非法事件** ：状态机异常路径漏测。



◆ 自测 · Module 10（先答再看）




1. 为什么“边界值”测试回报高？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"绝大多数错误发生在临界（空/满、最小/最大、相等/越界）。边界值用少量用例覆盖最易出错区域，回报最高。"}
   ```

2. 风险驱动测试里“高风险先测”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"按 FMEA/RPN 排序，优先测“发生概率高且后果重”的部分，把有限测试资源投在收益最大的地方。"}
   ```

3. 状态机测试为什么要覆盖“非法事件”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"异常/非法事件往往暴露状态机漏洞。只测正常迁移会漏掉拒绝非法事件、状态保持等关键路径。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的功能写一张“需求-风险-测试”表，用边界值与状态迁移补足高风险用例。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/) · [cppcheck 文档](https://cppcheck.sourceforge.io/)

 

动手练习



运行 ` labs/host_trace.c `（需求覆盖矩阵）；为你的功能写一张“需求-风险-测试”表。



**检查结果：** 每条需求有量化标准与≥1 个测试；高 RPN 先覆盖；覆盖 3/5=60% 且未覆盖项列出。

 

迁移练习：把本章的“能把需求量化成可测验收标准，按 FMEA 风险排序并用等价类/边界值/状态迁移设计用例。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m10","criterion":"每条需求有量化标准与≥1 个测试；高 RPN 先覆盖；覆盖 3/5=60% 且未覆盖项列出。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
