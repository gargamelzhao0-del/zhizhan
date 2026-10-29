/* host_feature.c —— 时域特征：均值/去直流 RMS/峰值/峰峰值（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_feature.c -o host_feature && ./host_feature
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    float x[] = {1,2,3,4,5,6,7,8};
    int n = (int)(sizeof(x)/sizeof(x[0]));
    float sum = 0; for (int i = 0; i < n; i++) sum += x[i];
    float mean = sum / n;
    float ac = 0, peak = 0, vmin = x[0], vmax = x[0];
    for (int i = 0; i < n; i++) {
        float d = x[i]-mean; ac += d*d;
        float a = fabsf(d); if (a > peak) peak = a;
        if (x[i] < vmin) vmin = x[i];
        if (x[i] > vmax) vmax = x[i];
    }
    float rms = sqrtf(ac/n);
    float pp = vmax - vmin;            /* 峰峰值由数据计算，不是硬编码 */
    printf("mean=%.2f rms(ac)=%.3f peak=%.2f peak-peak=%.1f\n", mean, rms, peak, pp);
    if (fabsf(mean-4.5f) > 1e-4) ok = 0;
    if (fabsf(rms - 2.2913f) > 1e-3) ok = 0;   /* 去直流后 RMS = sqrt(5.25)=2.2913 */
    if (fabsf(peak-3.5f) > 1e-4) ok = 0;
    if (fabsf(pp-7.0f) > 1e-4) ok = 0;         /* max-min = 8-1 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
