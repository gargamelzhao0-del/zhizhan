/* host_sample.c —— 采样与混叠：Nyquist 与混叠频率计算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sample.c -o host_sample && ./host_sample
 */
#include <stdio.h>
#include <math.h>
static double alias(double f, double fs) { double a = fmod(f, fs); if (a > fs/2) a = fs - a; return a; }
int main(void) {
    int ok = 1;
    double fs = 1000;      /* 采样率 1kHz，Nyquist 500Hz */
    printf("Nyquist=%.0fHz\n", fs/2);
    printf("输入 100Hz → 观测 %.0fHz（无混叠）\n", alias(100, fs));
    if (fabs(alias(100,fs)-100) > 1e-9) ok = 0;
    printf("输入 1200Hz → 观测 %.0fHz（混叠到 200Hz）\n", alias(1200, fs));
    if (fabs(alias(1200,fs)-200) > 1e-9) ok = 0;
    printf("结论：超过 Nyquist 的信号会混叠成假频率\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
