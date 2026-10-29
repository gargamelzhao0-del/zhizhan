# 构建与依赖管理

```zhizhan-anchor
m05
```



构建的目标是 **可复现** ：声明依赖、锁定版本、增量与缓存加速、失败可定位。依赖有拓扑顺序，成环则无法构建。

 

> 前置：会用 make 或编译命令构建简单项目。 · ◷ 约 42 分钟 · ◈ Windows/macOS/Linux 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能声明依赖、锁定版本，按依赖拓扑增量构建并记录工具链，实现可复现构建。

 

本章速览




- 构建要可复现：声明依赖 \+ 锁版本 \+ 记录工具链。

- 依赖有拓扑顺序，成环不可构建。

- 增量与缓存加速。

 

```zhizhan-anchor
m05-build
```



```zhizhan-anchor
m05-build-t
```



## 5.1 依赖拓扑与可复现



构建按依赖拓扑顺序：无依赖者最先。依赖成环则无法构建。目标可复现：声明依赖、锁定版本、记录工具链与选项。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  依赖拓扑排序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="依赖拓扑排序" preserveAspectRatio="xMidYMid meet"><rect x="95" y="44" width="190" height="50" rx="7" class="sv-cyn-s"></rect><text x="190.0" y="66" text-anchor="middle" class="sv-lbl-hi">util</text><path d="M287,69 H303" class="sv-arrow"></path><rect x="305" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">lib</text><path d="M497,69 H513" class="sv-arrow"></path><rect x="515" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="610.0" y="66" text-anchor="middle" class="sv-lbl-hi">app</text></svg>
```



util（无依赖）→ lib → app；每个目标在其依赖之后构建。成环即失败。



表 5.1 构建五概念



| 概念 | 作用 | 要点 |
| --- | --- | --- |
| 依赖声明 | 记录构建输入 | 不隐藏依赖 |
| 锁定 | 固定版本 | 锁文件 |
| 增量 | 只重编变化 | .o/.d 依赖 |
| 缓存 | 加速 | 命中率 |
| 可复现 | 同输入同产物 | 记录工具链 |



CMakeLists.txt 节选CMake

 

```text
cmake_minimum_required(VERSION 3.16)
project(app C)
add_executable(app main.c net.c util.c)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 -Wall")
```

声明式构建，依赖顺序自动处理，选项显式



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：构建顺序



下面这段程序按依赖拓扑得到构建顺序：



host\_build.cC

 

```text
/* host_build.c —— 构建依赖拓扑与可复现（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_build.c -o host_build && ./host_build
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; const char *dep; } tgt_t;
int main(void) {
    int ok = 1;
    tgt_t T[] = { {"app", "lib"}, {"lib", "util"}, {"util", 0} };
    int n = 3, order[3], done[3] = {0,0,0}, oc = 0;
    for (int step = 0; step < n; step++) {
        for (int i = 0; i < n; i++) {
            if (done[i]) continue;
            if (!T[i].dep) { done[i] = 1; order[oc++] = i; break; }
            for (int j = 0; j < n; j++) if (strcmp(T[j].name, T[i].dep) == 0 && done[j]) { done[i] = 1; order[oc++] = i; break; }
        }
    }
    printf("构建顺序:");
    for (int i = 0; i < oc; i++) printf(" %s", T[order[i]].name);
    printf("\n");
    if (!(oc == 3 && strcmp(T[order[0]].name, "util") == 0)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

依赖拓扑排序模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_build.c -o labs/host_build && ./labs/host_build
构建顺序: util lib app
RESULT: PASS
```



无依赖者 util 最先，顺序 util→lib→app；依赖遗漏或成环即失败。



表 5.2 依赖情形



| 情形 | 结果 | 处理 |
| --- | --- | --- |
| 无依赖 | 可选 | 直接编 |
| 线性依赖 | 拓扑序 | 按序编 |
| 依赖环 | 失败 | 拆模块 |
| 版本不锁 | 不可复现 | 锁文件 |



```zhizhan-anchor
m05-lock
```



```zhizhan-anchor
m05-lock-t
```



## 5.3 锁定与记录工具链



把依赖写进声明式文件并生成锁文件；交叉编译工具链与选项显式记录；产物带版本与校验以便追溯。



CMakeLists.txt 节选CMake

 

```text
cmake_minimum_required(VERSION 3.16)
project(app C)
add_executable(app main.c net.c util.c)   # 依赖顺序由 CMake 处理
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 -Wall")  # 选项显式记录
```

声明式构建 \+ 显式选项；依赖顺序自动处理



表 5.3 可复现构建



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 声明依赖 | 输入明确 | 隐藏依赖 |
| 锁文件 | 版本固定 | 漂移 |
| 记录工具链 | 可复现 | 同输入不同产物 |
| 增量/缓存 | 提速 | 全量重编 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与三平台对照



构建自检：依赖声明、版本锁定、工具链记录、可复现。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  全量 vs 增量构建（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="全量 vs 增量构建（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">全量</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(相对时间)</text><text x="12" y="67" class="sv-lbl">增量</text><rect x="150" y="50" width="109" height="18" rx="4" class="sv-grn-s"></rect><text x="267" y="67" class="sv-lbl-hi">20(相对时间)</text></svg>
```



增量构建只重编变化部分，显著节省时间；前提是依赖关系正确（.d 文件）。



表 5.4 三平台构建



| 平台 | 构建系统 | 说明 |
| --- | --- | --- |
| Windows | MSVC/CMake | 路径/工具链 |
| macOS | clang/CMake | Xcode CLT |
| Linux | gcc/make/CMake | 最常用 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **依赖未声明** ：换机编不过。

- **不锁版本** ：行为漂移。

- **全量重编** ：效率低。

- **工具链未记录** ：产物不可复现。



◆ 自测 · Module 05（先答再看）




1. 为什么要生成“锁文件”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"声明式依赖只给范围，锁文件固定到具体版本/哈希，保证任何机器装出同样的依赖，从而可复现构建。"}
   ```

2. 依赖成环会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无法确定构建顺序，构建失败。需要拆分模块或消除循环依赖。"}
   ```

3. 增量构建的前提是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"正确的依赖关系记录（如 .d 文件/构建系统图）。依赖错会导致“改了没重编”或“没改却重编”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目声明依赖并生成锁文件、记录工具链版本，验证换机可复现同一产物。



核对与延伸：[GNU Make 手册](https://www.gnu.org/software/make/manual/) · [CMake 文档](https://cmake.org/documentation/)

 

动手练习



运行 ` labs/host_build.c `：按依赖拓扑得到构建顺序。



**检查结果：** 构建顺序=util lib app（无依赖者 util 最先）；无遗漏、无环。

 

迁移练习：把本章的“能声明依赖、锁定版本，按依赖拓扑增量构建并记录工具链，实现可复现构建。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b16-m05","criterion":"构建顺序=util lib app（无依赖者 util 最先）；无遗漏、无环。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b16-guide)
