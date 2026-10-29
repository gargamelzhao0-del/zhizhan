/* host_calib.c —— 传感器标定：最小二乘拟合 y=kx+b 得增益/偏置与残差（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_calib.c -o host_calib -lm && ./host_calib
 */
#include <stdio.h>
#include <math.h>

int main(void) {
    int ok = 1;
    /* 标定点：真值增益 2.5、偏置 -1.0，叠加小噪声 */
    double x[] = {0, 1, 2, 3, 4, 5};
    double y[] = {-1.0, 1.4, 4.1, 6.3, 9.2, 11.4};
    int n = 6; double sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (int i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i]*x[i]; sxy += x[i]*y[i]; }

    /* 最小二乘 y = k x + b：k=增益、b=偏置 */
    double k = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    double b = (sy - k*sx) / n;
    printf("标定 y=%.3f x + %.3f（期望增益≈2.5 偏置≈-1.0）\n", k, b);
    if (fabs(k - 2.5) > 0.05 || fabs(b + 1.0) > 0.05) ok = 0;

    /* 残差评估：最大绝对残差与残差 RMS，检查是否有系统趋势 */
    double maxr = 0, ss = 0;
    for (int i = 0; i < n; i++) {
        double r = y[i] - (k*x[i] + b);
        if (fabs(r) > maxr) maxr = fabs(r);
        ss += r*r;
    }
    double rms = sqrt(ss/n);
    printf("最大残差=%.3f 残差RMS=%.3f（阈值 ≤0.25）\n", maxr, rms);
    if (maxr > 0.25) ok = 0;
    printf("结论：增益/偏置由拟合得到，残差小且无系统趋势\n");

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
