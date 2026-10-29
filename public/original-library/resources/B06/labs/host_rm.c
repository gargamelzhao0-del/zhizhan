/* host_rm.c —— 实时预算与可调度性：利用率界、响应时间分析（主机可运行）。
 *
 *   ① 利用率界 U ≤ n(2^{1/n}-1) 是“充分不必要”：超过它未必不可调度。
 *      本程序用穷举找到一组“U 超过界、但响应时间分析(RTA)仍然可调度”的任务集。
 *   ② 响应时间分析：R_i = C_i + Σ_{j<i} ceil(R_i / T_j)·C_j，迭代到不动点，R_i ≤ T_i 即可调度。
 *   ③ U > 1 一定不可调度。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_rm.c -o host_rm && ./host_rm
 */
#include <stdio.h>
#include <math.h>

static int cdiv(int a, int b) { return (a + b - 1) / b; }

/* 返回最低优先级任务的响应时间；-1 表示某一级不满足截止期 */
static int rta(const int *C, const int *T, int n, int *out_R) {
    for (int i = 0; i < n; i++) {
        int R = C[i], guard = 0;
        for (;;) {
            int nr = C[i];
            for (int j = 0; j < i; j++) nr += cdiv(R, T[j]) * C[j];
            if (nr == R) break;
            R = nr;
            if (++guard > 10000 || R > T[i]) return -1;
        }
        if (R > T[i]) return -1;
        out_R[i] = R;
    }
    return 0;
}

int main(void) {
    int ok = 1, found = 0;
    int C[3], T[3], R[3];

    printf("穷举 n=3（C≤4, T≤12，按周期升序=优先级降序），寻找“U 超界但可调度”的例子：\n");
    for (int c1 = 1; c1 <= 4 && !found; c1++)
    for (int c2 = 1; c2 <= 4 && !found; c2++)
    for (int c3 = 1; c3 <= 4 && !found; c3++)
    for (int t1 = 2; t1 <= 12 && !found; t1++)
    for (int t2 = t1 + 1; t2 <= 12 && !found; t2++)
    for (int t3 = t2 + 1; t3 <= 12 && !found; t3++) {
        C[0]=c1;C[1]=c2;C[2]=c3; T[0]=t1;T[1]=t2;T[2]=t3;
        double U = (double)c1/t1 + (double)c2/t2 + (double)c3/t3;
        double bound = 3.0 * (pow(2.0, 1.0/3.0) - 1.0);
        if (U <= bound || U >= 0.95) continue;
        if (rta(C, T, 3, R) == 0) {
            printf("  找到：C/T = (%d,%d,%d)/(%d,%d,%d)，U=%.4f > 界 %.4f\n",
                   c1, c2, c3, t1, t2, t3, U, bound);
            printf("  响应时间 R = (%d,%d,%d)，均 ≤ 各自周期 → 可调度\n", R[0], R[1], R[2]);
            found = 1;
        }
    }
    if (!found) ok = 0;

    /* 反证：U>1 必然不可调度 */
    int C2[2] = {3, 4}, T2[2] = {4, 5}, R2[2] = {0,0};
    double U2 = 3.0/4.0 + 4.0/5.0;
    int r = rta(C2, T2, 2, R2);
    printf("\nU>1 的例子：(3,4),(4,5) → U=%.2f，RTA 结果=%s（期望不可调度）\n",
           U2, r == 0 ? "可调度" : "不可调度");
    if (U2 > 1.0 && r == 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
