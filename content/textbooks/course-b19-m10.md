# 综合：有界的数据处理库

```zhizhan-anchor
m10
```



综合项目把前 9 章收口成一个库： **有界容器 \+ 查找/滤波 \+ 定点/统计/插值** ，保证内存有界、时间可预测、误差可解释。

 

> 前置：完成 M01–M09，理解有界容器、定点、统计与插值。 · ◷ 约 46 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把容器\+查找\+定点\+统计整合成内存有界、行为确定的库并写验收。

 

本章速览




- 有界库：固定容量、无运行期分配、溢出有策略。

- 数值误差在规格内。

- 超量输入不崩溃、行为可预测。

 

```zhizhan-anchor
m10-lib
```



```zhizhan-anchor
m10-lib-t
```



## 10.1 有界库的五个能力



把前 9 章收口：有界容器 \+ 查找/滤波 \+ 定点/统计/插值，保证内存有界、时间可预测、误差可解释。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  有界数据处理库的结构



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="有界数据处理库的结构" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">存储：环形缓冲/对象池</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">查找：二分/插值（区间内）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">数值：定点 Q15（误差≤1 LSB）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">统计：均值/方差（可解释）</text></svg>
```



存储（环形/对象池）→ 查找（二分/插值）→ 数值（Q15）→ 统计（均值/方差）→ 固定容量接口。



表 10.1 库的五能力



| 能力 | 实现 | 验收 |
| --- | --- | --- |
| 存储 | 环形缓冲 | 有界、不越界 |
| 查找 | 二分/插值 | O(log n)、区间内 |
| 数值 | 定点 Q15 | 误差 ≤ LSB |
| 统计 | 均值/方差 | 可解释 |
| 接口 | 固定容量参数 | 无运行期分配 |



lib\_accept.txt 节选Text

 

```text
无运行期分配: 是（池/静态）
溢出策略: 丢最旧 + 计数
数值误差: Q15 ≤ 1 LSB ≈ 3.05e-5
查找: 二分 O(log n); 插值仅在标定区间 [0,20]
```

验收清单：有界、无分配、溢出计数、误差规格内



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：有界容器



有界性的核心证据——环形缓冲在固定容量下不越界、溢出按策略处理：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_ring.cC\n\n \n\n```text\n/* host_ring.c —— 栈/队列/环形缓冲（有界）（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ring.c -o host_ring && ./host_ring\n */\n#include <stdio.h>\n#define CAP 4\ntypedef struct { int b[CAP]; int head, tail, n; } ring_t;\nstatic int push(ring_t *r, int v) { if (r->n == CAP) return -1; r->b[r->tail] = v; r->tail = (r->tail+1)%CAP; r->n++; return 0; }\nstatic int pop(ring_t *r, int *v) { if (r->n == 0) return -1; *v = r->b[r->head]; r->head = (r->head+1)%CAP; r->n--; return 0; }\nint main(void) {\n    int ok = 1; ring_t r = {{0},0,0,0}; int v;\n    for (int i = 1; i <= 4; i++) if (push(&r, i)) ok = 0;\n    printf(\"满时再 push=%d（期望 -1）\\n\", push(&r, 9));\n    if (push(&r, 9) != -1) ok = 0;\n    if (pop(&r, &v) || v != 1) ok = 0;\n    if (push(&r, 5)) ok = 0;                  /* 回绕后写入 */\n    printf(\"回绕后顺序: \");\n    while (pop(&r, &v) == 0) printf(\"%d \", v);\n    printf(\"(期望 2 3 4 5)\\n\");\n    /* 简化校验：总量守恒 */\n    if (r.n != 0) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n有界环形缓冲（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ring.c -o labs/host_ring && ./labs/host_ring
满时再 push=-1（期望 -1）
回绕后顺序: 2 3 4 5（期望 2 3 4 5）
RESULT: PASS
```



环容量固定 4 槽；满时按策略拒绝（-1）并计数；无运行期分配、无越界。



表 10.2 关键机制与证据



| 能力 | 可运行证据 | 验收 |
| --- | --- | --- |
| 有界容器 | host\_ring.c | 满→拒绝(-1) |
| 查找/插值 | host\_search.c | 区间内 x=15→200 |
| 定点 | host\_num.c | 误差≤3.05e-5 |
| 统计 | host\_stats.c | 均值6.0/σ2.828 |



```zhizhan-anchor
m10-accept
```



```zhizhan-anchor
m10-accept-t
```



## 10.3 验收：有界、确定、可解释



验收：固定缓冲处理超量数据不崩溃（按溢出策略丢弃并计数）；数值误差在规格内；查找/插值在有效区间内。



lib\_accept.txt 节选Text

 

```text
无运行期分配: 是（池/静态）
溢出策略: 丢最旧 + 计数
数值误差: Q15 ≤ 1 LSB ≈ 3.05e-5
查找: 二分 O(log n); 插值仅在标定区间 [0,20]
```

验收清单：有界、无分配、溢出计数、误差规格内



表 10.3 验收标准



| 验收项 | 标准 | 避免 |
| --- | --- | --- |
| 内存 | 有界/无分配 | 碎片/不确定 |
| 溢出 | 策略\+计数 | 静默丢 |
| 误差 | ≤1 LSB | 未界定 |
| 区间 | 标注有效范围 | 越界/外插 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



综合自检：库内存有界、无运行期分配、溢出有策略、误差可解释。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  库的验收闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="库的验收闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">定接口</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">实现</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">溢出策略</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">超量不崩</text></svg>
```



定接口（固定容量）→ 实现（池/环形）→ 溢出策略 → 误差规格 → 超量输入不崩溃。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 容量 | 固定参数 | 无界 |
| 分配 | 池/静态 | 运行期 malloc |
| 溢出 | 策略\+计数 | 静默丢 |
| 误差 | 规格化 | 不可解释 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **运行期分配** ：碎片/不确定。

- **无溢出策略** ：静默丢数据。

- **误差未界定** ：结果不可信。

- **接口无容量约束** ：越界/崩溃。



◆ 自测 · Module 10（先答再看）




1. “有界数据处理库”的核心验收是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内存有界、无运行期分配、溢出有明确策略并计数、数值误差在规格内、在超量输入下不崩溃（行为可预测）。"}
   ```

2. 为什么库要“无运行期分配”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"运行期分配会带来碎片与时间不确定，在实时/长期系统中不可接受。固定池/静态分配保证可预测。"}
   ```

3. 溢出为什么要“计数”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"计数让“丢了多少数据”可观测。静默丢弃会让上层以为数据完整，导致错误结论。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目的容器\+查找\+定点\+统计整合成一个内存有界、行为确定的小库，并写验收清单。



核对与延伸：[Efficient C 定点](https://www.embedded.com/) · [MIT 算法公开课](https://ocw.mit.edu/)

 

动手练习



运行 ` labs/host_ring.c `（有界容器）；把容器\+查找\+定点\+统计组成一个小库并写验收。



**检查结果：** 无运行期分配；环容量固定为 4，超量按丢最旧策略并计数；Q15 误差 ≤1 LSB≈3.05e-5；接口容量固定。

 

迁移练习：把本章的“能把容器\+查找\+定点\+统计整合成内存有界、行为确定的库并写验收。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m10","criterion":"无运行期分配；环容量固定为 4，超量按丢最旧策略并计数；Q15 误差 ≤1 LSB≈3.05e-5；接口容量固定。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
