/* host_hetero.c —— 异构多核/加速器：任务分配与负载均衡（主机可运行）。
 * 把任务按成本分配到能力不同的核/加速器，最小化最大完成时间（简化贪心）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hetero.c -o host_hetero && ./host_hetero
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int cost[] = {5, 3, 4, 2};              /* 4 个任务成本 */
    int n = 4, core[2] = {0, 0};            /* 2 个核负载 */
    for (int i = 0; i < n; i++) core[core[0] <= core[1] ? 0 : 1] += cost[i];   /* 贪心分给较空核 */
    int makespan = core[0] > core[1] ? core[0] : core[1];
    printf("负载 核0=%d 核1=%d makespan=%d\n", core[0], core[1], makespan);
    if (makespan != 7) ok = 0;              /* 5+2=7 与 3+4=7 */
    printf("较单核总成本=%d 缩短=%d%%\n", 14, (14-makespan)*100/14);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
