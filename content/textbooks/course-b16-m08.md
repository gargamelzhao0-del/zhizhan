# 综合：可复现工程模板

```zhizhan-anchor
m08
```



综合项目把环境与工具串成一个模板： **环境声明 \+ 脚本 \+ Git 历史 \+ 构建依赖 \+ Python 工具 \+ 证据** ，目标是“换台机器按 README 一键复现”。

 

> 前置：完成 M01–M07，具备环境/脚本/版本/构建/打包基础。 · ◷ 约 46 分钟 · ◈ Windows/macOS/Linux 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把环境声明、脚本、Git 标签、依赖锁与证据整合为换机按 README 一键复现的模板。

 

本章速览




- 可复现模板：环境声明\+脚本\+Git\+依赖锁\+证据。

- 验收 = 干净机器一键复现。

- 失败要明确报错。

 

```zhizhan-anchor
m08-template
```



```zhizhan-anchor
m08-template-t
```



## 8.1 模板的六个产物



把环境与工具串成模板：环境声明 \+ 脚本 \+ Git 历史/标签 \+ 构建依赖锁 \+ Python 工具 \+ 证据。验收标准是“干净机器按 README 一键复现”。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  可复现工程模板的组成



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="可复现工程模板的组成" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">环境声明（工具/版本）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">脚本（严格模式/幂等）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">版本（Git 标签）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">构建（依赖锁）</text></svg>
```



环境声明 → 脚本（set -euo pipefail）→ 版本（Git 标签）→ 构建（依赖锁）→ 工具（venv）→ 证据（手册/源码）。



表 8.1 模板五产物



| 产物 | 内容 | 验收 |
| --- | --- | --- |
| 环境声明 | 工具版本/路径 | 文档\+脚本 |
| 脚本 | set -euo pipefail | 可重复 |
| 版本 | Git 标签 | 可追溯 |
| 构建 | 依赖锁 | 可复现 |
| 证据 | 手册/源码引用 | 可复核 |



README.md 节选Text

 

```text
# 快速开始
1. 环境: gcc>=13, cmake>=3.16 (见 labs/env.sh)
2. 依赖: python -m venv .venv && pip install -r requirements.txt
3. 构建: ./ci.sh
4. 验证: ctest   # 与 tag v1.3.0 一致
```

README 一步不跳；脚本严格\+[幂等](term:idempotency)；产物与标签一致



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：构建顺序与工具



模板的可复现性由“依赖拓扑 \+ 记录工具链”保证；用构建顺序与工具核查验证：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_build.cC\n\n \n\n```text\n/* host_build.c —— 构建依赖拓扑与可复现（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_build.c -o host_build && ./host_build\n */\n#include <stdio.h>\n#include <string.h>\ntypedef struct { const char *name; const char *dep; } tgt_t;\nint main(void) {\n    int ok = 1;\n    tgt_t T[] = { {\"app\", \"lib\"}, {\"lib\", \"util\"}, {\"util\", 0} };\n    int n = 3, order[3], done[3] = {0,0,0}, oc = 0;\n    for (int step = 0; step < n; step++) {\n        for (int i = 0; i < n; i++) {\n            if (done[i]) continue;\n            if (!T[i].dep) { done[i] = 1; order[oc++] = i; break; }\n            for (int j = 0; j < n; j++) if (strcmp(T[j].name, T[i].dep) == 0 && done[j]) { done[i] = 1; order[oc++] = i; break; }\n        }\n    }\n    printf(\"构建顺序:\");\n    for (int i = 0; i < oc; i++) printf(\" %s\", T[order[i]].name);\n    printf(\"\\n\");\n    if (!(oc == 3 && strcmp(T[order[0]].name, \"util\") == 0)) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n依赖拓扑排序模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_build.c -o labs/host_build && ./labs/host_build
构建顺序: util lib app
RESULT: PASS
```



依赖顺序 util→lib→app（3 个目标）；记录工具链版本后，干净机器可复现同一产物。



表 8.2 模板的关键机制



| 环节 | 可运行证据 | 验收 |
| --- | --- | --- |
| 构建顺序 | host\_build.c | util→lib→app |
| 环境核查 | host\_env.c | PATH/版本 |
| 依赖锁 | 锁文件 | 可复现 |
| 脚本 | bash -n | 严格模式 |



```zhizhan-anchor
m08-readme
```



```zhizhan-anchor
m08-readme-t
```



## 8.3 README 与一键复现



README 要一步不跳：环境要求、依赖安装、构建命令、验证步骤。脚本幂等、失败返回非零。



README.md 节选Text

 

```text
# 快速开始
1. 环境: gcc >=13, cmake >=3.16, python >=3.10 (见 labs/env.sh)
2. 依赖: python -m venv .venv && pip install -r requirements.txt
3. 构建: ./ci.sh        # set -euo pipefail，幂等
4. 验证: ctest --output-on-failure   # 与 tag v1.3.0 一致
```

README 一步不跳；脚本严格\+幂等；产物与标签一致



表 8.3 模板要素与避免



| 要素 | 做法 | 避免 |
| --- | --- | --- |
| README | 一步不跳 | 新人跑不起来 |
| 脚本幂等 | 可重复执行 | 重跑出错 |
| 依赖锁 | 固定版本 | 产物不一致 |
| 证据 | 引用来源 | 决策不可复核 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检与三平台对照



模板自检：干净机器按 README 复现、脚本幂等、产物与标签一致、证据可复核。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  一键复现流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一键复现流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">README</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">装环境</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">装依赖</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">构建/验证</text></svg>
```



读 README → 装环境（env.sh）→ 装依赖（锁文件）→ 构建（ci.sh）→ 验证（与 tag 一致）。



表 8.4 三平台复现



| 平台 | 复现要点 | 注意 |
| --- | --- | --- |
| Windows | git-bash/MSVC | 换行/路径 |
| macOS | clang/venv | 架构 |
| Linux | gcc/CMake | 标准 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **README 不全** ：新人跑不起来。

- **脚本不幂等** ：重复执行出错。

- **依赖未锁** ：产物不一致。

- **无证据** ：决策不可复核。



◆ 自测 · Module 08（先答再看）




1. “可复现工程模板”最重要的验收是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"在干净机器上按 README 一步不跳地构建出与标签一致的产物。这检验了环境声明、脚本、依赖与版本管理是否真正到位。"}
   ```

2. 为什么模板里的脚本要“幂等”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一键复现常被重复执行（重试/CI）。幂等让脚本可安全重跑，避免“跑第二遍就错”。"}
   ```

3. 模板为什么要包含“证据”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把关键决策的手册/源码依据与最小验证记录下来，团队可复核、可传承，避免“作者走了就没人懂”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的项目搭一套可复现模板（README\+env.sh\+ci.sh\+依赖锁\+Git 标签），在干净目录从零复现一次。



核对与延伸：[GNU Make 手册](https://www.gnu.org/software/make/manual/) · [CMake 文档](https://cmake.org/documentation/)

 

动手练习



运行 ` labs/host_build.c `（构建顺序）；按模板在干净目录走一遍“从零复现”。



**检查结果：** 构建顺序 util→lib→app；干净机器按 README 复现出与 tag 一致的产物；脚本幂等、失败返回非零。

 

迁移练习：把本章的“能把环境声明、脚本、Git 标签、依赖锁与证据整合为换机按 README 一键复现的模板。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b16-m08","criterion":"构建顺序 util→lib→app；干净机器按 README 复现出与 tag 一致的产物；脚本幂等、失败返回非零。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b16-guide)
