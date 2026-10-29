# Linux 命令行与文件系统

```zhizhan-anchor
m02
```



命令行是工程效率的核心： **文件/权限、管道与重定向、查找与文本处理、进程管理** 。掌握这些能替代大量手工操作。

 

> 前置：了解文件/目录概念与基本命令（ls/cat/grep）。 · ◷ 约 42 分钟 · ◈ Windows/macOS/Linux 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用管道、重定向与退出码组合命令，正确处理 stdout/stderr 与 pipefail。

 

本章速览




- 命令行核心：文件权限、管道重定向、查找文本、进程。

- 退出码与 stdout/stderr 是两回事。

- 管道默认取最后一个退出码，严格需 pipefail。

 

```zhizhan-anchor
m02-cli
```



```zhizhan-anchor
m02-cli-t
```



## 2.1 管道、重定向与退出码



关键认知：退出码与 stdout/stderr 是两回事。管道会把多个工具串起来，但退出码默认取最后一个（需 ` set -o pipefail ` 才严格）。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  管道的退出码语义



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="管道的退出码语义" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">命令A</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">命令B</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">命令C</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">退出码=最后/pipefail</text></svg>
```



A | B | C：默认退出码取最后一个命令 C；pipefail 时任一失败即整体失败。



表 2.1 命令行五类任务



| 任务 | 常用 | 要点 |
| --- | --- | --- |
| 文件/权限 | ls/chmod/chown/ln | 权限位与软/硬链接 |
| 管道 | \| | 组合小工具 |
| 重定向 | \> \>\> 2\> | stdout/stderr 分开 |
| 查找文本 | find/grep/sed/awk | 批量处理 |
| 进程 | ps/top/kill/jobs | 信号与前后台 |



shell.sh 节选Shell

 

```text
ls | grep "\\.c$" | sort          # 组合小工具
build 1>out.log 2>err.log         # stdout/stderr 分开
set -o pipefail                    # 管道严格
```

stdout/stderr 分开；pipefail 让管道中途失败可见



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：退出码语义



下面这段程序是退出码语义模型（不真实执行命令）：



host\_shell.cC

 

```text
/* Pipeline status model; does not execute Bash or simulate all -e exceptions.
 * Default: final status. pipefail: rightmost nonzero status. */
#include <stdio.h>
#include <stddef.h>
static int pipeline_status(const int *codes,size_t n,int pipefail) {
    int result=0;
    for(size_t i=0;i<n;++i) if(!pipefail || codes[i]!=0) result=codes[i];
    return result;
}
int main(void) {
    const int a[]={0,1,0},b[]={7,2,0};
    int normal=pipeline_status(a,3,0),guarded=pipeline_status(a,3,1);
    int rightmost=pipeline_status(b,3,1);
    printf("default=%d pipefail=%d rightmost_failure=%d\n",normal,guarded,rightmost);
    int ok=normal==0 && guarded==1 && rightmost==2;
    puts(ok ? "RESULT: PASS" : "RESULT: FAIL"); return !ok;
}
```

退出码语义模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_shell.c -o labs/host_shell && ./labs/host_shell
default=0 pipefail=1 rightmost_failure=2
RESULT: PASS
```



默认管道取最后一个命令退出码；pipefail 使管道返回最右侧非零状态；单独 set -e 不能发现被末尾成功命令掩盖的失败。errexit 还有 if/&& 等上下文例外。真实解释器实验见 labs/pipeline\_probe.sh。



表 2.2 退出码语义



| 情形 | 退出码 | 说明 |
| --- | --- | --- |
| 全成功 | 0 | 成功 |
| 末命令失败 | 非 0 | 默认反映末命令 |
| 中间失败 | 默认 0（掩盖） | 需 pipefail |
| set -e 中途失败 | 非 0 并中止 | 出错即停 |



```zhizhan-anchor
m02-stdio
```



```zhizhan-anchor
m02-stdio-t
```



## 2.3 stdout/stderr 与组合



stdout 是数据、stderr 是诊断，要分开重定向（` 2> `）；用管道组合小工具替代手工操作。



shell.sh 节选Shell

 

```text
ls | grep "\.c$" | sort          # 组合小工具
build 1>out.log 2>err.log         # stdout/stderr 分开
set -o pipefail                    # 管道严格
cat a | false | sort; echo $?       # 默认 0（末命令），加 pipefail 后非 0
```

stdout/stderr 分开；pipefail 让管道中途失败可见



表 2.3 stdout/stderr 与组合



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 2\> 分流向 | 日志不污染 | 混用 |
| pipefail | 中间失败可见 | 被掩盖 |
| 检查退出码 | 发现错误 | 只看输出 |
| 小工具组合 | 效率 | 大脚本堆砌 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检与三平台对照



命令行自检：理解退出码、分开流向、组合小工具、定位进程。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  退出码语义（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="退出码语义（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">全成功</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="43" class="sv-lbl-hi">0退出码</text><text x="12" y="67" class="sv-lbl">中途失败(set-e)</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-red-s"></rect><text x="458" y="67" class="sv-lbl-hi">1退出码</text></svg>
```



全成功=0；set -e 中途失败=1 并中止。退出码是脚本判断成败的依据。



表 2.4 三平台命令行



| 平台 | 差异 | 注意 |
| --- | --- | --- |
| Windows | cmd/PowerShell | 分号/管道语义不同 |
| macOS | BSD 工具 | sed/grep 参数差异 |
| Linux | GNU 工具 | 最全 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **只看 stdout 不看退出码** ：错误被忽略。

- **stderr 与 stdout 混用** ：日志污染。

- **管道不 pipefail** ：中间失败被掩盖。

- **权限/链接理解错** ：脚本行为异常。



◆ 自测 · Module 02（先答再看）




1. 默认管道的退出码取自哪个命令？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"默认取最后一个命令的退出码；前面命令失败会被掩盖。要严格需 ` set -o pipefail `。"}
   ```

2. stdout 与 stderr 为什么要分开重定向？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"stdout 是数据、stderr 是诊断。混在一起会污染日志/被下游工具当数据误处理。用 ` 2> ` 分开。"}
   ```

3. 退出码为 0 表示什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"约定上表示命令成功。脚本据此判断成败；非 0 表示失败（具体值有不同含义）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你手工做的重复操作改成“管道 \+ 重定向 \+ 退出码检查”的组合命令，并加 pipefail。



核对与延伸：[GNU Bash 手册](https://www.gnu.org/software/bash/manual/)

 

动手练习



运行 ` labs/host_shell.c `（退出码语义模型）与 ` labs/env.sh `（真实命令行）。



**检查结果：** 管道 \[ls|grep|sort\] 退出码=0；set -e -o pipefail 下 \[cat|false|sort\] 退出码=1 并中止；env.sh 打印真实 PATH/命令。

 

迁移练习：把本章的“能用管道、重定向与退出码组合命令，正确处理 stdout/stderr 与 pipefail。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b16-m02","criterion":"管道 [ls|grep|sort] 退出码=0；set -e -o pipefail 下 [cat|false|sort] 退出码=1 并中止；env.sh 打印真实 PATH/命令。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b16-guide)
