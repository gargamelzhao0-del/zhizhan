/* host_version.c —— 版本与发布策略：语义化版本比较与升级准入（主机可运行）。
 * 语义化版本 major.minor.patch；升级不降级、跨大版本需迁移。本程序比较与准入判定。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_version.c -o host_version && ./host_version
 */
#include <stdio.h>
static int cmp(int a, int b, int c, int x, int y, int z) {
    if (a != x) return a < x ? -1 : 1;
    if (b != y) return b < y ? -1 : 1;
    if (c != z) return c < z ? -1 : 1;
    return 0;
}
/* 1=允许，0=同版/更旧，-1=需先迁移 */
static int allow(int ca, int cb, int cc, int ia, int ib, int ic, int maj_max) {
    int c = cmp(ca, cb, cc, ia, ib, ic);
    if (c >= 0) return 0;
    if (ia - ca > maj_max) return -1;
    return 1;
}
int main(void) {
    int ok = 1;
    printf("1.2.3 vs 1.3.0 → %d（期望 -1 更旧）\n", cmp(1,2,3,1,3,0));
    if (cmp(1,2,3,1,3,0) != -1) ok = 0;
    printf("2.0.0 vs 1.9.9 → %d（期望 1 更新）\n", cmp(2,0,0,1,9,9));
    if (cmp(2,0,0,1,9,9) != 1) ok = 0;
    printf("同版准入=%d（期望 0）\n", allow(1,2,3,1,2,3,1));
    if (allow(1,2,3,1,2,3,1) != 0) ok = 0;
    printf("跨 2 个主版本准入=%d（期望 -1 需迁移）\n", allow(1,0,0,3,0,0,1));
    if (allow(1,0,0,3,0,0,1) != -1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
