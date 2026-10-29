/* host_tsdb.c —— 时序存储：追加、区间查询、降采样（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tsdb.c -o host_tsdb && ./host_tsdb
 */
#include <stdio.h>
typedef struct { long t; float v; } pt_t;
static pt_t S[16]; static int n = 0;
static void put(long t, float v) { if (n < 16) { S[n].t = t; S[n].v = v; n++; } }
static int range(long a, long b, float *out) { int c = 0; for (int i = 0; i < n; i++) if (S[i].t >= a && S[i].t <= b) out[c++] = S[i].v; return c; }
static float avg_downsample(long bucket, long t0, long t1) { (void)bucket; float s = 0; int c = 0; for (int i = 0; i < n; i++) if (S[i].t >= t0 && S[i].t < t1) { s += S[i].v; c++; } return c ? s/c : 0; }
int main(void) {
    int ok = 1;
    for (int i = 0; i < 10; i++) put(i * 100, (float)i);
    float out[16]; int c = range(200, 500, out);
    printf("区间 [200,500] 点数=%d（期望 4：2,3,4,5）\n", c);
    if (c != 4) ok = 0;
    float m = avg_downsample(1000, 0, 1000);
    printf("降采样 [0,1000) 均值=%.2f（期望 4.50）\n", m);
    if (m < 4.49f || m > 4.51f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
