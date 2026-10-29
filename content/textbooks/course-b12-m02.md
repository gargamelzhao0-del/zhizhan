# 静态分析与自动化门禁

```zhizhan-anchor
m02
```



静态分析在“运行之前”抓问题：编译警告、clang-tidy/cppcheck、MISRA。关键是 **把分析接入 CI 并设为门禁** ，而不是偶尔手动跑一次。

 

> 前置：Module 01 的规范与门禁概念。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把 -Wall -Wextra -Werror 与 clang-tidy/cppcheck 接入 CI 并设硬性/警告阈值。

 

本章速览




- 静态分析接进 CI 并设为门禁，才可持续。

- 保持零警告基线，新警告才显眼。

- 门禁阈值务实：硬性错误必须为 0。

 

```zhizhan-anchor
m02-tools
```



```zhizhan-anchor
m02-tools-t
```



## 2.1 静态分析工具箱



静态分析在运行前抓问题：编译警告（-Wall -Wextra -Werror）、clang-tidy、cppcheck、MISRA。收尾靠 **格式化** 统一风格并由 CI 校验。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  CI 门禁流水线



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="CI 门禁流水线" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">编译</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">静态分析</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">格式化</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">单测</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">门禁</text></svg>
```



拉代码 → 编译(-Werror) → 静态分析(clang-tidy/cppcheck) → 格式化校验 → 单测/覆盖率 → 门禁判定。



表 2.1 静态分析工具



| 工具 | 抓什么 | 注意 |
| --- | --- | --- |
| -Wall -Wextra -Werror | 常见错误 | 零警告基线 |
| clang-tidy | 风格/潜在 bug | 规则集裁剪 |
| cppcheck | 未初始化/越界 | 误报要屏蔽 |
| MISRA | 安全编码子集 | 裁剪与豁免记录 |
| 格式化 | style 自动统一 | CI 校验 |



gate.sh 节选Shell

 

```text
make CFLAGS='-Wall -Wextra -Werror'    # 零警告基线
clang-tidy src/*.c                     # 潜在 bug
cppcheck --error-exitcode=1 src        # 未初始化/越界
clang-format --dry-run -Werror src/*.c # 风格校验
```

把编译/静态/格式统一上门禁，硬性失败即阻断



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：门禁阈值聚合



不同检查按“硬性/警告”聚合，最终给出统一判定：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_gate.cC\n\n \n\n```text\n/* host_gate.c —— 自动化门禁：静态检查 + 测试结果的合并判定（主机可运行）。\n * CI 门禁把多项检查聚合：任一硬性检查失败则整体失败；警告不阻塞但计数。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_gate.c -o host_gate && ./host_gate\n */\n#include <stdio.h>\n#include <string.h>\ntypedef struct { const char *name; int hard; int ok; } check_t;\nint main(void) {\n    int ok = 1;\n    check_t checks[] = {\n        {\"编译通过\", 1, 1}, {\"单元测试\", 1, 1}, {\"行宽<=100\", 0, 0},\n        {\"无 TODO\", 1, 1}, {\"覆盖率>=80\", 0, 1},\n    };\n    int n = (int)(sizeof(checks) / sizeof(checks[0])), hard_fail = 0, warn = 0;\n    for (int i = 0; i < n; i++) {\n        printf(\"  %-12s hard=%d ok=%d\\n\", checks[i].name, checks[i].hard, checks[i].ok);\n        if (!checks[i].ok) { if (checks[i].hard) hard_fail++; else warn++; }\n    }\n    printf(\"硬性失败=%d 警告=%d → 门禁 %s\\n\", hard_fail, warn, hard_fail ? \"FAIL\" : \"PASS\");\n    if (!(hard_fail == 0 && warn == 1)) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n门禁阈值聚合模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_gate.c -o labs/host_gate && ./labs/host_gate
硬性失败=0 警告=1 → 门禁 PASS
RESULT: PASS
```



硬性失败（编译/单测）必须 0；风格/覆盖率先作警告（=1）不阻塞，落地后再收紧。



表 2.2 门禁阈值的落地



| 阈值 | 含义 | 落地节奏 |
| --- | --- | --- |
| 硬性=0 | 编译/单测必须过 | 一开始就严 |
| 警告先软 | 风格/覆盖先计数 | 逐步收紧 |
| 零警告基线 | 新警告即显眼 | 保持清洁 |
| 误报屏蔽 | 显式记录原因 | 不放养 |



```zhizhan-anchor
m02-ci
```



```zhizhan-anchor
m02-ci-t
```



## 2.3 接进 CI 才有效



静态分析不进 CI 就形同虚设。把命令写进流水线、结果作为门禁；误报 **显式屏蔽并记录原因** ，不能靠“习惯性忽略”。



ci.yml 节选YAML

 

```text
stages: [build, analyze, test]
build:   script: [ "make CFLAGS='-Wall -Wextra -Werror'" ]
analyze: script: [ "clang-tidy src/*.c", "cppcheck --error-exitcode=1 src" ]
test:    script: [ "./run_unit", "gcov -b" ]
# 任一 stage 失败即阻断合并（门禁）
```

把编译/静态/单测串成 CI，失败即阻断



表 2.3 常见陷阱与对策



| 问题 | 后果 | 对策 |
| --- | --- | --- |
| 分析不进 CI | 形同虚设 | 接入流水线 |
| 误报太多 | 团队放弃 | 裁剪规则 \+ 记录豁免 |
| 习惯性忽略 | 真问题被压掉 | 禁用全局忽略 |
| 无零警告基线 | 新警告被淹没 | 保持 0 警告 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检与三路线对照



门禁自检：是否接入 CI、是否有零警告基线、误报是否被记录。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  问题发现成本随阶段上升（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="问题发现成本随阶段上升（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">编译/静态</text><rect x="150" y="26" width="55" height="18" rx="4" class="sv-grn-s"></rect><text x="213" y="43" class="sv-lbl-hi">10(相对)</text><text x="12" y="67" class="sv-lbl">单测</text><rect x="150" y="50" width="136" height="18" rx="4" class="sv-cyn-s"></rect><text x="294" y="67" class="sv-lbl-hi">25(相对)</text><text x="12" y="91" class="sv-lbl">HIL/板测</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="91" class="sv-lbl-hi">55(相对)</text><text x="12" y="115" class="sv-lbl">现场</text><rect x="150" y="98" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="115" class="sv-lbl-hi">100(相对)</text></svg>
```



静态分析/编译期发现成本最低；到现场发现成本最高。门禁把问题左移。



表 2.4 三路线门禁



| 路线 | CI/门禁 | 说明 |
| --- | --- | --- |
| MCU 工程 | 脚本 \+ 交叉编译门禁 | 轻量 |
| Linux 工程 | clang-tidy \+ 单测 | 成熟 |
| CI/自动化 | 流水线 \+ 阈值 | 统一 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **警告一堆没人管** ：真问题被淹没。

- **静态分析不进 CI** ：形同虚设。

- **盲目开 MISRA 全量** ：误报太多，团队放弃。

- **靠忽略压制误报** ：真问题也被压掉。



◆ 自测 · Module 02（先答再看）




1. 为什么建议“零警告基线”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"警告堆积会让新警告不再被注意；保持零警告，任何新警告都显眼，能及时处理。"}
   ```

2. 静态分析结果为什么必须进 CI？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不进 CI 就只能靠人偶尔跑，久而久之形同虚设。作为门禁才能强制每次提交达标。"}
   ```

3. 误报应该怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"显式屏蔽并记录原因（为什么是误报），而不是全局关规则或习惯性忽略，否则真问题也会被压掉。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把 -Wall -Wextra -Werror 与 clang-tidy/cppcheck 接进你项目的 CI，并设硬性/警告阈值。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/) · [clang-tidy 文档](https://clang.llvm.org/extra/clang-tidy/)

 

动手练习



运行 ` labs/host_gate.c `（门禁聚合模型）；为你的项目接入一条 CI 流水线并定义门禁阈值。



**检查结果：** 硬性失败=0 方能通过、警告计数（=1）不阻塞；静态分析结果聚合成统一门禁。

 

迁移练习：把本章的“能把 -Wall -Wextra -Werror 与 clang-tidy/cppcheck 接入 CI 并设硬性/警告阈值。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m02","criterion":"硬性失败=0 方能通过、警告计数（=1）不阻塞；静态分析结果聚合成统一门禁。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
