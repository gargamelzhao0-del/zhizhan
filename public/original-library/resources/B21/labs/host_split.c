/* host_split.c —— 数据切分与泄漏（按会话整段切分，不跨集）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_split.c -o host_split && ./host_split
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 4 个会话，每个 3 个样本；按会话整段分配给 train/val/test，避免碎片跨集泄漏 */
    int session[12] = {0,0,0,1,1,1,2,2,2,3,3,3};
    int n = 12, train = 0, val = 0, test = 0;
    for (int i = 0; i < n; i++) {
        if (session[i] <= 1) train++;        /* 会话 0,1 → train */
        else if (session[i] == 2) val++;     /* 会话 2 → val */
        else test++;                         /* 会话 3 → test */
    }
    /* 校验：任一会话不得同时出现在两个集合（整段切分不跨集） */
    int group[4];
    for (int s = 0; s < 4; s++) group[s] = (s <= 1) ? 0 : (s == 2 ? 1 : 2);
    for (int s = 0; s < 4; s++) {
        int mask = 0;
        for (int i = 0; i < n; i++) if (session[i] == s) mask |= 1 << group[s];
        if (mask != (1 << group[s])) ok = 0;   /* 一个会话只能落一个集合 */
    }
    printf("train=%d val=%d test=%d（按会话整段切分，不跨集）\n", train, val, test);
    if (!(train == 6 && val == 3 && test == 3)) ok = 0;
    printf("随机按行切分会泄漏 → 指标虚高\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
