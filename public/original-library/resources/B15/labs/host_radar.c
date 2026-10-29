/* host_radar.c —— 技术雷达与选型：加权评分矩阵（主机可运行）。
 * 按权重给候选技术打分，避免“只看热度”。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_radar.c -o host_radar && ./host_radar
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 维度权重: 成熟度/生态/性能/迁移成本(越低越好，取负向) */
    int w[4] = {3, 3, 2, 2};
    int A[4] = {4, 4, 3, 4};     /* 技术 A */
    int B[4] = {5, 3, 5, 2};     /* 技术 B */
    int sa = 0, sb = 0, tw = 0;
    for (int i = 0; i < 4; i++) {
        int sign = (i == 3) ? -1 : 1;   /* 第 4 维“迁移成本”越低越好 */
        sa += sign * w[i] * A[i];
        sb += sign * w[i] * B[i];
        tw += w[i];
    }
    printf("A=%d B=%d 满分=%d\n", sa, sb, tw * 5);
    if (!(sa == 22 && sb == 30)) ok = 0;   /* A=3*4+3*4+2*3-2*4=22; B=3*5+3*3+2*5-2*2=30 */
    printf("结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
