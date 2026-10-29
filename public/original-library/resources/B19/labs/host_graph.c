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
