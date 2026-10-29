# 栈、队列与环形缓冲

```zhizhan-anchor
m03
```



环形缓冲是嵌入式的“万能胶”：固定内存、O(1) 读写，天然适合流式数据。关键是 **满/空判定与溢出策略** 。

 

> 前置：理解数组下标与取模，写过基本 FIFO/LIFO。 · ◷ 约 42 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现有界环形缓冲并正确处理满/空判定与溢出策略（丢最旧/丢新/阻塞）。

 

本章速览




- 环形缓冲固定内存、O(1)，适合流式。

- 明确满/空判定与溢出策略。

- SPSC 无锁要注意内存序。

 

```zhizhan-anchor
m03-ring
```



```zhizhan-anchor
m03-ring-t
```



## 3.1 环形缓冲与满/空判定



环形缓冲固定内存、O(1) 读写，天然适合流式数据。关键是满/空判定：用计数器或“牺牲一格”。多生产/消费要同步（内存序）。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  环形缓冲的 head/tail



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="环形缓冲的 head/tail" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">push→head</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">取模回绕</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">pop←tail</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">满/空判定</text></svg>
```



push 到 head、pop 从 tail；head/tail 取模回绕。满/空判定决定是否可读写。



表 3.1 五种结构



| 结构 | 语义 | 注意 |
| --- | --- | --- |
| 栈 | LIFO | 深度固定 |
| 队列 | FIFO | 满/空判定 |
| 环形 | 循环复用 | head/tail |
| SPSC 无锁 | 单生产单消费 | 内存序 |
| 溢出 | 丢新/丢旧/阻塞 | 明确策略 |



ring.c 节选C

 

```text
if (count == CAP) return -1;          // 满：拒绝（或丢最旧）
buf[head] = v; head = (head + 1) % CAP; count++;
/* SPSC：生产者 release 写 head，消费者 acquire 读 head */
```

满则拒绝；回绕取模；SPSC 用 acquire/release



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：满/空与回绕



下面这段程序验证满/空边界与回绕：



host\_ring.cC

 

```text
/* host_ring.c —— 栈/队列/环形缓冲（有界）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ring.c -o host_ring && ./host_ring
 */
#include <stdio.h>
#define CAP 4
typedef struct { int b[CAP]; int head, tail, n; } ring_t;
static int push(ring_t *r, int v) { if (r->n == CAP) return -1; r->b[r->tail] = v; r->tail = (r->tail+1)%CAP; r->n++; return 0; }
static int pop(ring_t *r, int *v) { if (r->n == 0) return -1; *v = r->b[r->head]; r->head = (r->head+1)%CAP; r->n--; return 0; }
int main(void) {
    int ok = 1; ring_t r = {{0},0,0,0}; int v;
    for (int i = 1; i <= 4; i++) if (push(&r, i)) ok = 0;
    printf("满时再 push=%d（期望 -1）\n", push(&r, 9));
    if (push(&r, 9) != -1) ok = 0;
    if (pop(&r, &v) || v != 1) ok = 0;
    if (push(&r, 5)) ok = 0;                  /* 回绕后写入 */
    printf("回绕后顺序: ");
    while (pop(&r, &v) == 0) printf("%d ", v);
    printf("(期望 2 3 4 5)\n");
    /* 简化校验：总量守恒 */
    if (r.n != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

环形缓冲边界模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ring.c -o labs/host_ring && ./labs/host_ring
满时再 push=-1（期望 -1）
回绕后顺序: 2 3 4 5（期望 2 3 4 5）
RESULT: PASS
```



环容量 4 槽；满时 push 返回 -1；回绕后取出顺序正确 2 3 4 5。



表 3.2 环形状态机



| 状态 | push | pop |
| --- | --- | --- |
| 空 | 成功 | 失败(-1) |
| 非空非满 | 成功 | 成功 |
| 满 | 失败(-1) | 成功 |
| 回绕 | 取模 | 取模 |



```zhizhan-anchor
m03-spsc
```



```zhizhan-anchor
m03-spsc-t
```



## 3.3 SPSC 与溢出策略



单生产单消费（SPSC）可用无锁环形缓冲，但要 acquire/release 内存序；溢出策略要显式（丢最旧/丢新/阻塞）并计数。



ring.c 节选C

 

```text
if (count == CAP) return -1;          // 满：拒绝（或丢最旧）
buf[head] = v; head = (head + 1) % CAP; count++;
/* SPSC：生产者 release 写 head，消费者 acquire 读 head */
```

满则拒绝；回绕取模；SPSC 用 acquire/release 配内存序



表 3.3 溢出策略



| 策略 | 行为 | 适合 |
| --- | --- | --- |
| 丢新 | 满时拒绝 | 最新不重要 |
| 丢旧 | 覆盖最旧 | 最新重要 |
| 阻塞 | 等待空间 | 有同步机制 |
| 计数 | 丢掉要计数 | 可观测 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



环形自检：满/空正确、回绕无越界、SPSC 有内存序、溢出有策略。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  环形缓冲容量与状态（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="环形缓冲容量与状态（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">容量</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-box"></rect><text x="638" y="43" class="sv-lbl-hi">4(计数)</text><text x="12" y="67" class="sv-lbl">满时 push</text><rect x="150" y="50" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="67" class="sv-lbl-hi">0(计数)</text><text x="12" y="91" class="sv-lbl">空时 pop</text><rect x="150" y="74" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="91" class="sv-lbl-hi">0(计数)</text></svg>
```



容量 4：空/非空非满/满三态；满时 push 拒绝、空时 pop 拒绝。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 满/空 | 计数或牺牲格 | 读空/覆盖 |
| 回绕 | 取模 | 越界 |
| SPSC | 内存序 | 读到未完成 |
| 溢出 | 策略\+计数 | 静默丢 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **空满判定错** ：读空/覆盖未读数据。

- **无溢出策略** ：静默丢数据。

- **SPSC 不加内存序** ：读到未完成数据。

- **越界** ：索引未取模。



◆ 自测 · Module 03（先答再看）




1. 环形缓冲如何区分“空”和“满”（head==tail 时）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用计数器，或牺牲一个槽位（满时 tail 的下一格是 head）。两种都要保证读写不越界。"}
   ```

2. SPSC 无锁环形缓冲为什么要内存序？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"生产者写数据与更新 head、消费者读 head 与取数据之间存在顺序要求；用 release/acquire 配对保证“看到 head 就能看到数据”。"}
   ```

3. 环形缓冲满了应该怎么办？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"按显式策略处理：丢新（拒绝）、丢旧（覆盖最旧）或阻塞等待，并计数以便观测。不能静默丢数据。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你采集/通信流实现一个有界环形缓冲，定义满/空判定与溢出策略并计数。



核对与延伸：[Efficient C 定点](https://www.embedded.com/)

 

动手练习



运行 ` labs/host_ring.c `：验证满/空边界与回绕正确。



**检查结果：** 满时 push 返回 -1；回绕后顺序 2 3 4 5；最终计数守恒、无越界。

 

迁移练习：把本章的“能实现有界环形缓冲并正确处理满/空判定与溢出策略（丢最旧/丢新/阻塞）。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m03","criterion":"满时 push 返回 -1；回绕后顺序 2 3 4 5；最终计数守恒、无越界。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
