# 项目结构、风格与规范

```zhizhan-anchor
m01
```



工程化第一步是让代码“ **可被他人维护** ”：统一的目录、命名、接口与错误码规范，加上能自动检查的门禁。规范不靠自觉，靠自动化。

 

> 前置：C 语言与一次完整的工程构建/评审经历。 · ◷ 约 42 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为一套嵌入式代码定出可自动检查的目录/命名/接口/提交规范。

 

本章速览




- 规范要能自动检查，评审只关注设计与逻辑。

- 统一目录/命名/接口/错误码，降低维护成本。

- 提交信息要能追溯变更。

 

```zhizhan-anchor
m01-rules
```



```zhizhan-anchor
m01-rules-t
```



## 1.1 让代码可维护的四类规范



工程化的第一步不是写业务，而是定“别人能接手”的规范：目录/模块、命名/风格、接口/错误码、文档/提交。把可机械检查的规则放进门禁，评审只关注设计与逻辑。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  规范的四层



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="规范的四层" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">目录/模块：分层与职责</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">命名/风格：统一前缀/行宽</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">接口/错误码：统一返回语义</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">文档/提交：可追溯</text></svg>
```



目录/模块（可定位）→ 命名/风格（可读）→ 接口/错误码（可判断）→ 文档/提交（可传承）。



表 1.1 四类规范



| 规范 | 内容 | 收益 |
| --- | --- | --- |
| 目录/模块 | 分层与职责边界 | 可定位、可替换 |
| 命名/风格 | 统一前缀、缩进、行宽 | 降低阅读成本 |
| 接口/错误码 | 统一返回与错误语义 | 上层可判断处理 |
| 文档/注释 | 接口说明与设计记录 | 可传承 |
| 提交规范 | 清晰的提交信息 | 可追溯与回滚 |



tree.txt 节选Text

 

```text
project/
  src/      # 业务与驱动（分层）
  include/  # 对外接口（含错误码定义）
  tests/    # 主机单测
  docs/     # 设计与接口文档
  tools/    # 门禁脚本/格式化
```

统一目录与职责边界，谁都能定位与替换



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：门禁判定



门禁把检查分为“硬性失败”与“警告”：硬性失败必须归零，警告只计数。下面这段程序跑出真实判定：



host\_gate.cC

 

```text
/* host_gate.c —— 自动化门禁：静态检查 + 测试结果的合并判定（主机可运行）。
 * CI 门禁把多项检查聚合：任一硬性检查失败则整体失败；警告不阻塞但计数。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_gate.c -o host_gate && ./host_gate
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; int hard; int ok; } check_t;
int main(void) {
    int ok = 1;
    check_t checks[] = {
        {"编译通过", 1, 1}, {"单元测试", 1, 1}, {"行宽<=100", 0, 0},
        {"无 TODO", 1, 1}, {"覆盖率>=80", 0, 1},
    };
    int n = (int)(sizeof(checks) / sizeof(checks[0])), hard_fail = 0, warn = 0;
    for (int i = 0; i < n; i++) {
        printf("  %-12s hard=%d ok=%d\n", checks[i].name, checks[i].hard, checks[i].ok);
        if (!checks[i].ok) { if (checks[i].hard) hard_fail++; else warn++; }
    }
    printf("硬性失败=%d 警告=%d → 门禁 %s\n", hard_fail, warn, hard_fail ? "FAIL" : "PASS");
    if (!(hard_fail == 0 && warn == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

门禁聚合模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_gate.c -o labs/host_gate && ./labs/host_gate
  编译通过 hard=1 ok=1
  单元测试 hard=1 ok=1
  行宽<=100  hard=0 ok=0
  无 TODO     hard=1 ok=1
  覆盖率>=80 hard=0 ok=1
硬性失败=0 警告=1 → 门禁 PASS
RESULT: PASS
```



硬性失败=0、警告=1（行宽、覆盖率）时门禁 PASS；只要硬性失败\>0 即 FAIL。



表 1.2 硬性与警告的区分



| 检查项 | 类型 | 通过条件 |
| --- | --- | --- |
| 编译/单测 | 硬性 | 必须 0 失败 |
| 无 TODO | 硬性 | 必须 0 |
| 行宽/风格 | 警告 | 计数不阻塞 |
| 覆盖率 | 警告→硬性 | 先软后硬 |



```zhizhan-anchor
m01-enforce
```



```zhizhan-anchor
m01-enforce-t
```



## 1.3 规范靠工具执行



写了规范没人执行等于没写。把行宽、命名、TODO 等交给工具自动检查；提交信息模板化；评审清单聚焦“设计与逻辑”。



review\_checklist.md 节选Text

 

```text
- [ ] 接口有文档与错误码说明
- [ ] 无 TODO / 无被忽略的警告
- [ ] 关键分支有测试
- [ ] 提交信息含“做了什么/为什么”与关联需求
- [ ] 无硬编码魔法数/未解释常量
```

评审清单只保留“工具查不了”的设计与逻辑项



表 1.3 规范的执行方式



| 规范 | 执行方式 | 工具 |
| --- | --- | --- |
| 行宽/风格 | 自动 | clang-format \+ CI |
| 命名/前缀 | 自动 | 脚本/正则 |
| TODO | 自动 | grep 门禁 |
| 接口/错误码 | 评审 | 人工 \+ 模板 |
| 提交信息 | 模板 | commit hook |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检与三路线对照



规范自检：是否有门禁、门禁是否进 CI、是否零硬性失败。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  规范落地的闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="规范落地的闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">定规范</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">工具化</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">进 CI</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">评审</text></svg>
```



定规范 → 工具化 → 进 CI → 零硬性失败 → 评审聚焦设计。



表 1.4 三路线工程实践



| 路线 | 工程实践 | 说明 |
| --- | --- | --- |
| MCU 工程 | Makefile \+ 脚本门禁 | 轻量 |
| Linux 工程 | CMake \+ clang-tidy | 成熟 |
| CI/自动化 | 流水线 \+ 门禁阈值 | 统一约束 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **规范只写在文档** ：无人执行。

- **命名/目录随意** ：新人无法定位。

- **错误码不统一** ：上层无法判断。

- **提交信息无意义** ：无法回溯。



◆ 自测 · Module 01（先答再看）




1. 为什么规范要“可自动检查”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"人工评审不稳定且有成本；可机械判定的规则交给工具，评审聚焦设计。规范只有可执行才可持续。"}
   ```

2. 门禁里“硬性失败”和“警告”有什么区别？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"硬性失败必须为 0，否则构建/合并失败；警告只计数、不阻塞（可先软后硬）。这类分级让门禁既严格又能渐进落地。"}
   ```

3. 评审清单为什么只保留“工具查不了”的项？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把形式项交给工具后，人能专注真正的设计与逻辑问题，避免把时间花在机器能判的地方。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目写一份“可自动检查”的规范清单，并把可机械判定的项接进门禁。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/)

 

动手练习



运行 ` labs/host_gate.c `：验证门禁对硬性失败/警告的区分与整体判定。



**检查结果：** 硬性失败=0、警告=1 时门禁 PASS；硬性失败\>0 即 FAIL。

 

迁移练习：把本章的“能为一套嵌入式代码定出可自动检查的目录/命名/接口/提交规范。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m01","criterion":"硬性失败=0、警告=1 时门禁 PASS；硬性失败>0 即 FAIL。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
