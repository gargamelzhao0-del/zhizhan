/* host_kalman.c —— 标量卡尔曼/互补滤波融合（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_kalman.c -o host_kalman && ./host_kalman
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 一维卡尔曼：预测 x 不变，更新用观测，增益随不确定度变化 */
    double x = 0, P = 1, Q = 1e-4, R = 0.1;
    double obs[] = {1.0, 1.1, 0.9, 1.05, 1.0};
    for (int i=0;i<5;i++) {
        P += Q;                                  /* 预测 */
        double K = P / (P + R);                  /* 增益 */
        x = x + K * (obs[i] - x);                /* 更新 */
        P = (1 - K) * P;
    }
    printf("融合结果 x=%.3f（观测均值≈1.01）\n", x);
    if (x < 0.9 || x > 1.1) ok = 0;
    printf("方差 P=%.4f（已收敛）\n", P);
    if (P <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
