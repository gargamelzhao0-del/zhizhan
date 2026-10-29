/* host_feat.c —— 时域特征：RMS/峰峰值/过零率/峭度（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_feat.c -o host_feat -lm && ./host_feat
 */
#include <stdio.h>
#include <math.h>

#define N 16
static const double PI = 3.14159265358979;

static void feat(const char *name, const double *x, int n) {
    double sum = 0; for (int i = 0; i < n; i++) sum += x[i];
    double mean = sum / n;
    double m2 = 0, m4 = 0, vmin = x[0], vmax = x[0];
    int zc = 0;
    for (int i = 0; i < n; i++) {
        double d = x[i] - mean; m2 += d*d; m4 += d*d*d*d;
        if (x[i] < vmin) vmin = x[i];
        if (x[i] > vmax) vmax = x[i];
        if (i > 0 && ((x[i-1] < 0) != (x[i] < 0))) zc++;   /* 过零率：符号翻转/(n-1) */
    }
    m2 /= n; m4 /= n;
    double rms = sqrt(m2 + mean*mean);            /* RMS 含直流分量 */
    double p2p = vmax - vmin;                     /* 峰峰值 */
    double zcr = (double)zc / (n - 1);            /* 过零率 ∈ [0,1] */
    double kurt = m4 / (m2*m2);                   /* 峭度（正态=3） */
    printf("%s: RMS=%.3f 峰峰值=%.3f 过零率=%.3f 峭度=%.3f\n", name, rms, p2p, zcr, kurt);
}

int main(void) {
    int ok = 1;
    double smooth[N], spiky[N];
    for (int i = 0; i < N; i++) {
        smooth[i] = sin(2*PI*i/8.0);   /* 2 个周期正弦 */
        spiky[i]  = smooth[i];
    }
    spiky[4] += 6.0;                   /* 叠加一个冲击，考察峭度敏感性 */

    printf("窗口 N=%d（单位：采样点）\n", N);
    feat("正弦      ", smooth, N);
    feat("正弦+冲击 ", spiky, N);

    /* 断言：正弦峭度≈1.5、冲击信号峭度>3（提示冲击/故障） */
    double ms=0, s2=0, s4=0; for (int i=0;i<N;i++){ s2+=smooth[i]*smooth[i]; s4+=smooth[i]*smooth[i]*smooth[i]*smooth[i]; } s2/=N; s4/=N; ms=s4/(s2*s2);
    double ps=0, p2=0, p4=0, mean=0; for (int i=0;i<N;i++) mean+=spiky[i]; mean/=N;
    for (int i=0;i<N;i++){ double d=spiky[i]-mean; p2+=d*d; p4+=d*d*d*d; } p2/=N; p4/=N; ps=p4/(p2*p2);
    if (fabs(ms-1.5) > 0.05) ok = 0;
    if (ps <= 3.0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
