# 数组、链表与容器

```zhizhan-anchor
m02
```



容器选择的核心是 **布局与局部性** ：数组连续（cache 友好、随机访问 O(1)），链表插入方便但局部性差、指针开销大。

 

> 前置：掌握数组与指针、结构体，理解连续内存与随机访问。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为给定访问模式选择数组/链表/对象池，并实现固定容量、无运行期分配的容器。

 

本章速览




- 容器选择看布局与局部性。

- 嵌入式倾向固定容量\+对象池，避免碎片。

- 链表局部性差、指针开销大。

 

```zhizhan-anchor
m02-containers
```



```zhizhan-anchor
m02-containers-t
```



## 2.1 布局与局部性



数组连续（cache 友好、随机访问 O(1)），链表插入 O(1) 但局部性差、指针开销大。嵌入式倾向固定容量 \+ 对象池：无运行期分配、无碎片、行为可预测。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  数组 vs 链表的内存布局



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="数组 vs 链表的内存布局" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="54.0" class="sv-lbl-hi">数组：连续、cache 友好</text><rect x="60" y="74" width="680" height="40" rx="6" class="sv-red-s"></rect><text x="75" y="98.0" class="sv-lbl-hi">链表：节点分散 + 指针</text><rect x="60" y="118" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="137.0" class="sv-lbl-hi">对象池：固定块、无碎片</text></svg>
```



数组：元素连续，cache 友好；链表：节点分散 \+ next 指针，局部性差。



表 2.1 容器对比



| 容器 | 随机访问 | 插入 | 嵌入式 |
| --- | --- | --- | --- |
| 数组 | O(1) | O(n) | 常用、cache 友好 |
| 链表 | O(n) | O(1) | 局部性差、指针开销 |
| 动态数组 | O(1) | 摊还 O(1) | 需管理增长 |
| 对象池 | — | O(1) | 固定内存、无碎片 |
| 侵入式链表 | — | O(1) | 零额外分配 |



pool.c 节选C

 

```text
node_t *p = pool_alloc(&pool);          // 固定池，满则 NULL
if (!p) return ERR_POOL_FULL;            // 显式失败，不崩溃
p->next = list_head; list_head = p;      // 侵入式：next 在对象里
```

固定池分配（满即 NULL）\+ 侵入式链表零额外分配



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：对象池与侵入式链表



下面这段程序验证对象池满时失败、侵入式链表遍历与回收复用：



host\_container.cC

 

```text
/* host_container.c —— 固定容量对象池 + 侵入式链表（有界，无运行期分配）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_container.c -o host_container && ./host_container
 */
#include <stdio.h>

#define POOL_CAP 4
typedef struct node { struct node *next; int val; } node_t;

/* 对象池：POOL_CAP 个固定对象，空闲链用侵入式 next 串起，回收即可复用 */
static node_t pool[POOL_CAP];
static node_t *free_list = NULL;   /* 空闲对象链（侵入式：借对象自身的 next） */
static int used = 0;               /* 已分配计数 */

static void pool_init(void) {
    free_list = NULL;
    for (int i = POOL_CAP - 1; i >= 0; i--) { pool[i].next = free_list; free_list = &pool[i]; }
    used = 0;
}
static node_t *pool_alloc(int v) {          /* 固定内存：满时返回 NULL，绝不运行期 malloc */
    if (!free_list) return NULL;
    node_t *n = free_list; free_list = n->next; n->next = NULL; n->val = v; used++;
    return n;
}
static void pool_free(node_t *n) { n->next = free_list; free_list = n; used--; }

int main(void) {
    int ok = 1;
    pool_init();

    /* 1) 固定容量：连发 POOL_CAP 个后，再分配应为 NULL（分配失败，无碎片） */
    node_t *head = NULL;
    for (int i = 1; i <= POOL_CAP; i++) {
        node_t *n = pool_alloc(i);
        if (!n) { ok = 0; continue; }
        n->next = head; head = n;           /* 头插，构成侵入式链表（零额外分配） */
    }
    node_t *over = pool_alloc(99);
    printf("池容量=%d，满后再分配=%s（期望 NULL）\n", POOL_CAP, over ? "非空" : "NULL");
    if (over != NULL) ok = 0;

    /* 2) 侵入式链表遍历：头插 1..4 → 遍历顺序 4 3 2 1，节点数=4、元素和=10 */
    int sum = 0, cnt = 0;
    printf("遍历: ");
    for (node_t *q = head; q; q = q->next) { printf("%d ", q->val); sum += q->val; cnt++; }
    printf("(期望 4 3 2 1)\n");
    printf("节点数=%d 元素和=%d（期望 4 10）\n", cnt, sum);
    if (cnt != POOL_CAP || sum != 10) ok = 0;

    /* 3) 回收一个后可再分配（地址复用同一固定池，无运行期分配） */
    pool_free(head);
    printf("释放 1 个后 used=%d（期望 3）\n", used);
    if (used != 3) ok = 0;
    node_t *again = pool_alloc(7);
    printf("回收后可再分配: val=%d（期望 7）\n", again ? again->val : -1);
    if (!again || again->val != 7) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

对象池/侵入式链表模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_container.c -o labs/host_container && ./labs/host_container
池容量=4，满后再分配=NULL（期望 NULL）
节点数=4 元素和=10（期望 4 10）
释放 1 个后 used=3（期望 3）
回收后可再分配: val=7（期望 7）
RESULT: PASS
```



池容量 4，满后返回 NULL；链表遍历 4 节点、和=10；释放后可复用（val=7）。



表 2.2 对象池 vs malloc



| 特性 | 对象池 | malloc |
| --- | --- | --- |
| 时间 | 确定 | 不确定 |
| 碎片 | 无 | 有 |
| 失败行为 | 返回 NULL | 返回 NULL/崩溃 |
| 适合 | 实时/长期 | 启动期 |



```zhizhan-anchor
m02-pool
```



```zhizhan-anchor
m02-pool-t
```



## 2.3 固定容量与侵入式



对象池预分配固定内存、无碎片、分配时间确定；侵入式链表把 next 指针放进对象本身，零额外分配。



pool.c 节选C

 

```text
node_t *p = pool_alloc(&pool);          // 固定池，满则 NULL
if (!p) return ERR_POOL_FULL;            // 显式失败，不崩溃
p->next = list_head; list_head = p;      // 侵入式：next 在对象里
```

固定池分配（满即 NULL）\+ 侵入式链表零额外分配



表 2.3 嵌入式容器实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 固定容量 | 无碎片/可预测 | 运行期分配 |
| 对象池 | 分配时间确定 | malloc 抖动 |
| 侵入式链表 | 零额外分配 | 额外节点开销 |
| 对齐 | 访问性能 | 非对齐异常 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



容器自检：容量有界、无运行期分配、成功/失败行为明确、对齐正确。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  容器选型



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="容器选型" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看访问模式</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">选结构</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">定容量</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">验行为</text></svg>
```



访问模式？随机多→数组；频繁插入→链表/侵入式；实时/长期→对象池。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 容量 | 固定 | 无界增长 |
| 分配 | 池/静态 | 运行期 malloc |
| 失败 | 返回 NULL | 静默崩溃 |
| 对齐 | 按平台 | 非对齐 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **运行期动态分配** ：碎片与不确定。

- **链表到处用** ：cache 差、指针开销。

- **无界容器** ：内存耗尽。

- **忽略对齐** ：访问异常/性能差。



◆ 自测 · Module 02（先答再看）




1. 为什么嵌入式常用“对象池”而不是到处 malloc？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"对象池预分配固定内存、无碎片、分配时间确定；适合实时与长期运行系统。malloc/free 的时间不确定且会碎片化。"}
   ```

2. 数组相比链表的核心优势是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"连续内存带来 cache 友好与 O(1) 随机访问；链表插入虽 O(1)，但局部性差、指针开销大。"}
   ```

3. “侵入式链表”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把 next 指针放进对象结构体本身，节点即对象，无需为链表节点额外分配内存，零额外开销。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目里一处运行期 malloc 改为固定对象池，并核对容量与对齐。



核对与延伸：[Efficient C 定点](https://www.embedded.com/)

 

动手练习



运行 ` labs/host_container.c `：验证固定容量对象池满时分配失败、侵入式链表遍历与回收复用。



**检查结果：** 池容量 4，满后再分配返回 NULL；侵入式链表遍历节点数=4、元素和=10；释放后可再分配成功（val=7）。

 

迁移练习：把本章的“能为给定访问模式选择数组/链表/对象池，并实现固定容量、无运行期分配的容器。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m02","criterion":"池容量 4，满后再分配返回 NULL；侵入式链表遍历节点数=4、元素和=10；释放后可再分配成功（val=7）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
