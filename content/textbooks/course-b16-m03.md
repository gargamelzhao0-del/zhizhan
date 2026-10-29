# Shell 与自动化脚本

```zhizhan-anchor
m03
```



自动化脚本要像代码一样严谨： **set -euo pipefail** 、正确引用变量、明确退出码、保持 **[幂等](term:idempotency)** ，并接入 CI。

 

> 前置：会写基本 shell 命令与变量。 · ◷ 约 42 分钟 · ◈ Windows/macOS/Linux 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写带 set -euo pipefail、正确引用、幂等的自动化脚本并接入 CI。

 

本章速览




- 脚本用 set -euo pipefail，变量加引号，失败即停。

- 脚本要幂等，可重复执行。

- 接入 CI，本地=CI。

 

```zhizhan-anchor
m03-strict
```



```zhizhan-anchor
m03-strict-t
```



## 3.1 set -euo pipefail



脚本第一行 shebang \+ 严格模式：` -e ` 命令失败即退出、` -u ` 未定义变量报错、` -o pipefail ` 管道任一失败即失败。让脚本“出错就停且不隐瞒”。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  严格模式的三道闸



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="严格模式的三道闸" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">-e 出错即停</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">-u 变量检查</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">-o pipefail</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">不静默失败</text></svg>
```



-e 出错即停、-u 未定义变量报错、-o pipefail 管道严格 → 脚本不静默失败。



表 3.1 脚本五要点



| 要点 | 做法 | 坑 |
| --- | --- | --- |
| 严格模式 | set -euo pipefail | 未定义变量/管道失败 |
| 引号 | "$var" | 空格/通配展开 |
| 错误处理 | 检查退出码 | 静默失败 |
| 幂等 | 可重复执行 | 重复运行出错 |
| CI | 脚本化步骤 | 本地能跑 CI 不能 |



ci.sh 节选Shell

 

```text
#!/usr/bin/env bash
set -euo pipefail
mkdir -p build && cd build        # 幂等：可重复执行
cmake .. && make -j"$(nproc)" && ctest
```

shebang\+严格模式\+幂等，接入 CI



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：脚本过语法检查



本册 Shell 片段 ` ci.sh `/` env.sh ` 经 ` bash -n ` 语法检查通过；退出码语义可运行证据见 host\_shell.c：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_shell.cC\n\n \n\n```text\n/* Pipeline status model; does not execute Bash or simulate all -e exceptions.\n * Default: final status. pipefail: rightmost nonzero status. */\n#include <stdio.h>\n#include <stddef.h>\nstatic int pipeline_status(const int *codes,size_t n,int pipefail) {\n    int result=0;\n    for(size_t i=0;i<n;++i) if(!pipefail || codes[i]!=0) result=codes[i];\n    return result;\n}\nint main(void) {\n    const int a[]={0,1,0},b[]={7,2,0};\n    int normal=pipeline_status(a,3,0),guarded=pipeline_status(a,3,1);\n    int rightmost=pipeline_status(b,3,1);\n    printf(\"default=%d pipefail=%d rightmost_failure=%d\\n\",normal,guarded,rightmost);\n    int ok=normal==0 && guarded==1 && rightmost==2;\n    puts(ok ? \"RESULT: PASS\" : \"RESULT: FAIL\"); return !ok;\n}\n```\n\n退出码语义模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_shell.c -o labs/host_shell && ./labs/host_shell
default=0 pipefail=1 rightmost_failure=2
RESULT: PASS
```



严格模式下中途失败整体失败并中止；这是脚本“出错就停”的基础。



表 3.2 脚本检查清单



| 检查 | 方法 | 通过标志 |
| --- | --- | --- |
| 语法 | bash -n | 返回码 0 |
| 严格模式 | 含 set -euo pipefail | 有 |
| 幂等 | 重复执行 | 不报错 |
| 退出码 | 失败返回非 0 | 可判断 |



```zhizhan-anchor
m03-idem
```



```zhizhan-anchor
m03-idem-t
```



## 3.3 引用、幂等与 CI



变量永远加引号；外部命令失败要有处理；脚本保持幂等（可重复执行）；把步骤脚本化以接入 CI。



ci.sh 节选Shell

 

```text
#!/usr/bin/env bash
set -euo pipefail
mkdir -p build && cd build        # 幂等：可重复执行
cmake .. && make -j"$(nproc)"
ctest --output-on-failure
```

shebang \+ 严格模式 \+ 幂等 \+ 脚本化步骤接入 CI



表 3.3 脚本工程化



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| "$var" | 防空格/通配 | 未加引号 |
| 幂等 | 重跑安全 | 重复即错 |
| 检查退出码 | 发现失败 | 静默 |
| 脚本化 | CI 可复现 | 手工步骤 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检与三平台对照



脚本自检：严格模式、引号、幂等、可 CI 化。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  严格模式拦截的问题（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="严格模式拦截的问题（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">-e</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-cyn-s"></rect><text x="638" y="43" class="sv-lbl-hi">40%问题拦截</text><text x="12" y="67" class="sv-lbl">-u</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="67" class="sv-lbl-hi">25%问题拦截</text><text x="12" y="91" class="sv-lbl">pipefail</text><rect x="150" y="74" width="420" height="18" rx="4" class="sv-grn-s"></rect><text x="578" y="91" class="sv-lbl-hi">35%问题拦截</text></svg>
```



-e 拦中途失败、-u 拦未定义变量、pipefail 拦管道掩盖——三者显著减少“静默失败”。



表 3.4 三平台脚本



| 平台 | shell | 注意 |
| --- | --- | --- |
| Windows | bash/git-bash | 换行/路径 |
| macOS | zsh/bash | 默认 zsh |
| Linux | bash | 最标准 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **无严格模式** ：出错继续跑，产出坏结果。

- **变量不加引号** ：空格/通配出错。

- **静默失败** ：以为成功。

- **不幂等** ：重跑出错。



◆ 自测 · Module 03（先答再看）




1. set -euo pipefail 分别解决什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"-e 命令失败即退出；-u 使用未定义变量报错；-o pipefail 管道任一失败即失败。三者结合让脚本“出错就停且不隐瞒”。"}
   ```

2. 为什么脚本要保持“幂等”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"自动化脚本常被重复执行（重试/CI）。幂等（可重复执行且结果一致）避免“重跑就出错”，也让恢复更简单。"}
   ```

3. 为什么变量要写成 "$var"？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不加引号会被 shell 按空格拆词并做通配展开，导致空值或含空格的值出错。加引号保持原样。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的一次性命令序列写成带 set -euo pipefail、幂等、经 bash -n 检查的脚本，并接入 CI。



核对与延伸：[GNU Bash 手册](https://www.gnu.org/software/bash/manual/)

 

动手练习



运行 ` labs/ci.sh `（真实脚本）与 ` labs/host_shell.c `（退出码语义）。



**检查结果：** ci.sh/env.sh 经 bash -n 通过；两脚本含 set -euo pipefail；重复执行不报错（幂等）。

 

迁移练习：把本章的“能写带 set -euo pipefail、正确引用、幂等的自动化脚本并接入 CI。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b16-m03","criterion":"ci.sh/env.sh 经 bash -n 通过；两脚本含 set -euo pipefail；重复执行不报错（幂等）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b16-guide)
