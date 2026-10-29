# 状态机、图与调度

```zhizhan-anchor
m05
```



状态机与图是“有结构的行为”：状态机描述转移，图描述依赖/连通； **拓扑排序** 解决依赖顺序， **BFS**  解决最短路。

 

> 前置：会写 switch/转移表，理解队列与栈。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把协议/模式建模为状态机，用图表示依赖并做拓扑排序与 BFS 最短路。

 

本章速览




- 状态机描述行为，图描述依赖/连通。

- 拓扑排序解依赖，BFS 解无权最短路。

- 有环则不可拓扑排序。

 

```zhizhan-anchor
m05-graph
```



```zhizhan-anchor
m05-graph-t
```



## 5.1 状态机与图



状态机描述转移，图描述依赖/连通。拓扑排序解决依赖顺序，BFS 在无权图给最短路。依赖调度本质就是拓扑排序：有环则不可调度。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  拓扑排序与 BFS



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="拓扑排序与 BFS" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">入度=0 队列</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">出队输出</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">减少后继入度</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">拓扑序/最短路</text></svg>
```



拓扑排序按入度出队得到依赖顺序；BFS 从源点按层扩展得无权最短路。



表 5.1 结构与算法



| 结构 | 用途 | 算法 |
| --- | --- | --- |
| 状态机 | 协议/模式 | 转移表 |
| 邻接矩阵 | 稠密图 | O(V²) 遍历 |
| 邻接表 | 稀疏图 | 省内存 |
| 拓扑排序 | 依赖/构建 | 入度法 |
| BFS/DFS | 最短/连通 | 队列/栈 |



graph.c 节选C

 

```text
while (queue_not_empty())
  for (each v with indeg==0) { out[u++]=v; for (w in adj[v]) if (--indeg[w]==0) push(w); }
/* out 数 < V 则有环；BFS 按层扩展给无权最短路 */
```

入度法拓扑排序可检测环；BFS 在无权图或等权图上给出最少边数路径



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：拓扑序与最短路



下面这段程序验证拓扑排序与 BFS 最短路：



host\_graph.cC

 

```text
/* host_graph.c —— 图：拓扑排序与 BFS 最短路（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_graph.c -o host_graph && ./host_graph
 */
#include <stdio.h>
#include <string.h>
#define N 5
static int adj[N][N] = {
    /* 0->1, 0->2, 1->3, 2->3, 3->4 */
    {0,1,1,0,0},{0,0,0,1,0},{0,0,0,1,0},{0,0,0,0,1},{0,0,0,0,0}
};
static int bfs(int s, int t) {
    int dist[N]; for (int i=0;i<N;i++) dist[i]=-1;
    int q[N], h=0, tl=0; dist[s]=0; q[tl++]=s;
    while (h<tl) { int u=q[h++]; for (int v=0;v<N;v++) if (adj[u][v] && dist[v]<0){dist[v]=dist[u]+1;q[tl++]=v;} }
    return dist[t];
}
int main(void) {
    int ok = 1;
    /* 拓扑排序（入度为 0 依次输出） */
    int indeg[N]; memset(indeg,0,sizeof(indeg));
    for (int u=0;u<N;u++) for (int v=0;v<N;v++) if (adj[u][v]) indeg[v]++;
    int order[N], oc=0;
    for (int step=0; step<N; step++) { for (int i=0;i<N;i++) if (!indeg[i]){ indeg[i]=-1; order[oc++]=i; for(int v=0;v<N;v++) if(adj[i][v]) indeg[v]--; break; } }
    printf("拓扑序: "); for (int i=0;i<oc;i++) printf("%d ", order[i]); printf("\n");
    if (!(oc==5 && order[0]==0 && order[4]==4)) ok = 0;
    printf("0→4 BFS 最短路=%d（期望 3）\n", bfs(0,4));
    if (bfs(0,4) != 3) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

拓扑排序/BFS 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_graph.c -o labs/host_graph && ./labs/host_graph
拓扑序: 0 1 2 3 4 
0→4 BFS 最短路=3（期望 3）
RESULT: PASS
```



拓扑序 5 个节点、无环；BFS 0→4 最短路=3 跳（无权图，单位是边数）。



表 5.2 结果



| 量 | 值 | 说明 |
| --- | --- | --- |
| 节点 | 5 | 无环 |
| 拓扑序 | 0 1 2 3 4 | 依赖顺序 |
| BFS 最短路 | 3 跳 | 无权图 |
| 有环 | 不可调度 | 需拆分 |



```zhizhan-anchor
m05-sched
```



```zhizhan-anchor
m05-sched-t
```



## 5.3 依赖调度



依赖调度就是拓扑排序：有环不可调度。BFS 在无权图给最短路，DFS 适合连通/回溯。状态机要有默认分支处理异常事件。



graph.c 节选C

 

```text
while (queue_not_empty())
    for (each v with indeg==0) { out[u++]=v; for (w in adj[v]) if (--indeg[w]==0) push(w); }
/* 若 out 数 < V 则有环；BFS 按层扩展给无权最短路 */
```

入度法拓扑排序（可检测环）；BFS 按层给最短路



表 5.3 调度与遍历



| 问题 | 方法 | 注意 |
| --- | --- | --- |
| 依赖顺序 | 拓扑排序 | 有环即失败 |
| 无权最短路 | BFS | 加权图不适用 |
| 连通/回溯 | DFS | 栈深度 |
| 异常事件 | 状态机默认分支 | 不丢入未知 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



图自检：无环、拓扑序正确、BFS 最短路正确、状态机有默认分支。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  拓扑排序与环检测（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="拓扑排序与环检测（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">输出节点</text><rect x="150" y="26" width="500" height="18" rx="4" class="sv-grn-s"></rect><text x="658" y="43" class="sv-lbl-hi">5个</text><text x="12" y="67" class="sv-lbl">节点总数</text><rect x="150" y="50" width="500" height="18" rx="4" class="sv-cyn-s"></rect><text x="658" y="67" class="sv-lbl-hi">5个</text></svg>
```



无环则输出全部节点；有环则输出数 \< V，判定不可调度。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 建图 | 邻接表/矩阵 | 稀疏用矩阵 |
| 拓扑 | 入度法 | 忽略环 |
| BFS | 按层 | 当加权最短路 |
| 状态机 | 默认分支 | 丢入未知 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **忽略环** ：拓扑排序失败/死循环。

- **邻接矩阵太浪费** ：稀疏图内存爆。

- **BFS 当加权最短路** ：结果错。

- **状态机无默认分支** ：异常丢入未知。



◆ 自测 · Module 05（先答再看）




1. 拓扑排序失败的常见原因是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"图中存在环（循环依赖）。此时无法确定顺序，应检测并拆分/消除环。"}
   ```

2. 什么时候用 BFS、什么时候用 DFS？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无权图最短路用 BFS（按层扩展）；连通性/回溯/拓扑（DFS 版）用 DFS。加权最短路要用 Dijkstra 等而非 BFS。"}
   ```

3. 状态机为什么要有“默认分支”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"处理未预期的输入/事件，避免落入未定义状态。默认分支可做安全处理与日志，而不是“丢入未知”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的协议/模式建模为状态机，把依赖画成图做一次拓扑排序与环检测。



核对与延伸：[MIT 算法公开课](https://ocw.mit.edu/)

 

动手练习



运行 ` labs/host_graph.c `：验证拓扑排序与 BFS 最短路。



**检查结果：** 拓扑序输出 5 个节点且首=0、末=4（无环）；BFS 0→4 最短路=3 跳。

 

迁移练习：把本章的“能把协议/模式建模为状态机，用图表示依赖并做拓扑排序与 BFS 最短路。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m05","criterion":"拓扑序输出 5 个节点且首=0、末=4（无环）；BFS 0→4 最短路=3 跳。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
