/* host_filter.c —— 时域滤波：均值/中值/EMA（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_filter.c -o host_filter && ./host_filter
 */
#include <stdio.h>
static int med3(int a,int b,int c){ if((a<=b&&b<=c)||(c<=b&&b<=a))return b; if((b<=a&&a<=c)||(c<=a&&a<=b))return a; return c; }
int main(void) {
    int ok = 1;
    int x[] = {10,10,100,10,10};    /* 中间一个尖峰 */
    int n = 5, sum = 0;
    for (int i=0;i<n;i++) sum += x[i];
    printf("均值=%.1f（被尖峰拉高）\n", sum/(double)n);
    int med = med3(x[1],x[2],x[3]);
    printf("中值(窗口)=%d（抗尖峰）\n", med);
    if (med != 10) ok = 0;
    double ema = 10, alpha = 0.2;
    for (int i=0;i<n;i++) ema = alpha*x[i] + (1-alpha)*ema;
    printf("EMA(alpha=0.2)末值=%.2f（平滑）\n", ema);
    if (ema <= 10 || ema >= 100) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
