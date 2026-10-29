/* host_fir.c —— FIR/IIR 差分方程（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_fir.c -o host_fir && ./host_fir
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 3 点滑动平均 FIR: y[n]=(x[n]+x[n-1]+x[n-2])/3 */
    int x[] = {0,0,6,6,6,0,0};
    int n = 7;
    printf("FIR 输出: ");
    for (int i=2;i<n;i++) printf("%d ", (x[i]+x[i-1]+x[i-2])/3);
    printf("(期望 2 4 6 4 2)\n");
    /* IIR 一阶：y[n]=0.5y[n-1]+0.5x[n] */
    double y = 0;
    printf("IIR 阶跃响应: ");
    for (int i=0;i<5;i++){ y = 0.5*y + 0.5*1.0; printf("%.3f ", y); }
    printf("(趋向 1)\n");
    if (y < 0.9 || y > 1.0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
