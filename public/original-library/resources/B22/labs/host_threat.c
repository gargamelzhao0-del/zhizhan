/* host_threat.c —— 威胁建模：攻击面与风险评分（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_threat.c -o host_threat && ./host_threat
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 资产: 暴露面(1-5) × 影响(1-5) = 风险 */
    int surface[4] = {5,3,2,1}, impact[4] = {5,4,3,5};
    const char *name[4] = {"网络接口","调试口","本地总线","物理外壳"};
    for (int i=0;i<4;i++) printf("  %-8s 风险=%d\n", name[i], surface[i]*impact[i]);
    /* 最高风险优先缓解 */
    int maxr = 0, mi = 0;
    for (int i=0;i<4;i++) if (surface[i]*impact[i] > maxr) { maxr = surface[i]*impact[i]; mi = i; }
    printf("最高风险: %s (%d)，优先缓解\n", name[mi], maxr);
    if (!(mi == 0 && maxr == 25)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
