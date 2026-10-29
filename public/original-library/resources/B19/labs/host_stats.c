/* host_stats.c —— 均值/标准差与最小二乘线性拟合（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_stats.c -o host_stats -lm && ./host_stats
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    double x[] = {1,2,3,4,5}, y[] = {2,4,6,8,10};   /* y=2x */
    int n = 5; double sx=0, sy=0, sxx=0, sxy=0;
    for (int i = 0; i < n; i++) { sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; }
    double slope = (n*sxy - sx*sy)/(n*sxx - sx*sx);
    double intercept = (sy - slope*sx)/n;
    printf("拟合 y=%.3f x + %.3f（期望 2.000 0.000）\n", slope, intercept);
    if (fabs(slope-2.0) > 1e-6 || fabs(intercept) > 1e-6) ok = 0;
    double my = sy/n, var = 0;
    for (int i = 0; i < n; i++) var += (y[i]-my)*(y[i]-my);
    printf("y 均值=%.1f 标准差=%.3f\n", my, sqrt(var/n));
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
