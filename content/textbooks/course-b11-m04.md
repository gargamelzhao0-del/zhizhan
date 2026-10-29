# 应用构建

```zhizhan-anchor
m04
```



构建要回答三件事：用什么构建系统、如何交叉编译、依赖与版本怎么管。目标是 **可复现** ：换台机器用同一套命令得到同一产物。

 

> 前置：Module 01–03 的可编译应用与头文件组织。 · ◷ 约 42 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写出依赖拓扑排序得到编译顺序、并检测依赖环的构建脚本/工具。

 

本章速览




- 构建要可复现：锁工具链与依赖、声明式构建。

- 依赖有拓扑顺序，成环无法构建。

- 产物带版本号便于追溯与回滚。

 

```zhizhan-anchor
m04-model
```



```zhizhan-anchor
m04-model-t
```



## 4.1 构建系统的取舍与依赖顺序



构建系统按项目规模选：Makefile（小、直接）、CMake（中大型、跨平台）、Meson（快、清晰）、包管理器配方（整系统集成）。依赖有先后：库先于使用它的模块编译，成环则不可构建。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  依赖拓扑排序的编译顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="依赖拓扑排序的编译顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">util</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">net</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">app</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">main</text></svg>
```



无依赖者最先：util → net → app → main。成环则无法构建，需拆分模块。



表 4.1 构建系统取舍



| 构建系统 | 特点 | 适用 |
| --- | --- | --- |
| Makefile | 直接、可控 | 小项目 |
| CMake | 跨平台、生态好 | 中大型项目 |
| Meson | 快、语法清晰 | 新项目 |
| 包管理器配方 | Buildroot/Yocto | 整系统集成 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：拓扑排序



下面这段主机程序按依赖图做拓扑排序，得到满足依赖的编译顺序：



host\_build.cC

 

```text
/* host_build.c —— 应用构建：按依赖拓扑排序的编译顺序（主机可运行）。
 * 多文件/多库构建要按依赖顺序编译；依赖成环则无法构建。本程序对构建目标做拓扑排序并检测环。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_build.c -o host_build && ./host_build
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; const char *deps[2]; } mod_t;
static mod_t M[] = {
    {"main", {"app", 0}}, {"app", {"net", "util"}}, {"net", {"util", 0}}, {"util", {0, 0}},
};
#define N 4
static int topo(int order[]) {
    int indeg[N] = {0}, done[N] = {0}, oc = 0;
    for (int i = 0; i < N; i++) for (int d = 0; d < 2 && M[i].deps[d]; d++) indeg[i]++;
    for (int s = 0; s < N; s++) {
        int pick = -1; for (int i = 0; i < N; i++) if (!done[i] && indeg[i] == 0) { pick = i; break; }
        if (pick < 0) return 0;
        done[pick] = 1; order[oc++] = pick;
        for (int i = 0; i < N; i++) for (int d = 0; d < 2 && M[i].deps[d]; d++) if (strcmp(M[i].deps[d], M[pick].name) == 0) indeg[i]--;
    }
    return 1;
}
int main(void) {
    int ok = 1, order[N];
    if (!topo(order)) ok = 0;
    printf("编译顺序:");
    for (int i = 0; i < N; i++) printf(" %s", M[order[i]].name);
    printf("\n");
    int pos[N]; for (int i = 0; i < N; i++) pos[order[i]] = i;
    for (int i = 0; i < N; i++) for (int d = 0; d < 2 && M[i].deps[d]; d++)
        for (int j = 0; j < N; j++) if (strcmp(M[j].name, M[i].deps[d]) == 0 && !(pos[j] < pos[i])) ok = 0;
    if (strcmp(M[order[0]].name, "util") != 0) ok = 0;   /* 无依赖者最先 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

依赖拓扑排序模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_build.c -o labs/host_build && ./labs/host_build
编译顺序: util net app main
RESULT: PASS
```



拓扑排序让每个模块都在其依赖之后编译；若有环则返回“不可构建”。



表 4.2 依赖情形



| 情形 | 结果 | 处理 |
| --- | --- | --- |
| 无依赖 | 可选 | 直接编 |
| 线性依赖 | 拓扑序 | 按序编 |
| 依赖环 | 不可构建 | 拆模块/去环 |
| 版本不锁 | 不可复现 | 锁工具链/依赖 |



```zhizhan-anchor
m04-detail
```



```zhizhan-anchor
m04-detail-t
```



## 4.3 交叉编译与可复现



交叉编译用目标工具链 \+ sysroot（B09 讲过“成对”）。可复现要 **锁工具链与依赖版本** 、用声明式构建、产物带版本号与校验。



Makefile 节选Makefile

 

```text
CC := arm-linux-gnueabihf-gcc
CFLAGS := -O2 -Wall -Wextra -Iinclude
app: main.o net.o util.o
	$(CC) $^ -o $@ -Wl,--gc-sections
# 产物带版本与校验，便于回滚/追溯
package: app
	cp app dist/app-$(VERSION) && sha256sum dist/app-$(VERSION) > dist/app-$(VERSION).sha256
```

交叉编译 \+ 版本化打包，构建可复现、可追溯



表 4.3 可复现构建的要素



| 要素 | 做法 | 目的 |
| --- | --- | --- |
| 工具链 | 固定版本 \+ sysroot | ABI 一致 |
| 依赖锁 | 锁定版本/校验和 | 可复现 |
| 产物版本 | 版本号 \+ 校验 | 回滚/追溯 |
| 构建描述 | 声明式（CMake/meson） | 少手写、可审计 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与三路线对照



构建自检聚焦“顺序正确、无环、可复现”：



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  构建耗时的三段（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="构建耗时的三段（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">配置</text><rect x="150" y="26" width="120" height="18" rx="4" class="sv-amb-s"></rect><text x="278" y="43" class="sv-lbl-hi">20%</text><text x="12" y="67" class="sv-lbl">编译</text><rect x="150" y="50" width="360" height="18" rx="4" class="sv-cyn-s"></rect><text x="518" y="67" class="sv-lbl-hi">60%</text><text x="12" y="91" class="sv-lbl">链接/打包</text><rect x="150" y="74" width="120" height="18" rx="4" class="sv-grn-s"></rect><text x="278" y="91" class="sv-lbl-hi">20%</text></svg>
```



配置/依赖解析、编译、链接与打包。优化通常先看依赖解析与编译并行度，而不是盲目换编译器。



CMakeLists.txt 节选CMake

 

```text
cmake_minimum_required(VERSION 3.16)
project(edge C)
add_executable(app main.c net.c util.c)
target_include_directories(app PRIVATE include)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 -Wall -Wextra")
```

声明式构建（CMake）：依赖与选项可审计、可复现



表 4.4 三路线构建



| 路线 | 构建系统 | SDK |
| --- | --- | --- |
| Buildroot | Makefile \+ 包 | 内置工具链 |
| Yocto | BitBake 配方 | meta-toolchain SDK |
| Debian | debuild/apt | 交叉工具链 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **依赖顺序错** ：链接报未定义符号。

- **依赖成环** ：无法构建或需拆分模块。

- **依赖版本不锁** ：换环境行为不同。

- **产物无版本** ：无法追溯与回滚。



◆ 自测 · Module 04（先答再看）




1. 为什么构建要“可复现”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只有可复现才能定位回归、审计与回滚。锁定工具链/依赖版本、用声明式构建、产物留版本号是基础。"}
   ```

2. 依赖图成环会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无法确定编译顺序，构建失败；需要拆分模块或消除循环依赖。"}
   ```

3. 交叉编译时“工具链 \+ sysroot 成对”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"编译器与目标头/库必须来自同一套，否则 ABI/库版本错配，表现为能链接但一跑就崩（见 B09）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你项目的构建加一个依赖拓扑检查与版本化打包步骤，确保换台机器可复现。



核对与延伸：[POSIX / pthreads](https://pubs.opengroup.org/onlinepubs/9699919799/)

 

动手练习



运行 ` labs/host_build.c `：按依赖拓扑排序得到编译顺序，并检测环。



**检查结果：** 编译顺序 util net app main 满足全部依赖；存在依赖环时判定为不可构建。

 

迁移练习：把本章的“能写出依赖拓扑排序得到编译顺序、并检测依赖环的构建脚本/工具。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m04","criterion":"编译顺序 util net app main 满足全部依赖；存在依赖环时判定为不可构建。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
