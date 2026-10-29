/* host_quant.c —— int8 量化/反量化、误差上界与越界裁剪（主机可运行）。
 * 量化：q = clamp(round(x/scale) + zero_point, -128, 127)，反量化 x' = (q - zero_point)*scale。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_quant.c -o host_quant && ./host_quant
 */
#include <stdio.h>
#include <math.h>
static int clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }
int main(void) {
    int ok = 1;
    float scale = 0.02f; int zp = 0;
    /* 含网格外的值（产生非零误差）与超出可表示范围的值（触发裁剪） */
    float xs[] = {0.0f, 0.5f, -0.5f, 1.0f, -1.0f, 0.011f, 3.0f, -3.0f};
    float maxerr_in = 0.0f;
    int clamped = 0;
    for (unsigned i = 0; i < sizeof(xs)/sizeof(xs[0]); i++) {
        int raw = (int)lroundf(xs[i]/scale) + zp;
        int q = clamp(raw, -128, 127);
        int in_range = (raw >= -128 && raw <= 127);
        if (!in_range) clamped++;
        float xr = (q - zp) * scale;
        float e = fabsf(xr - xs[i]);
        if (in_range && e > maxerr_in) maxerr_in = e;
        printf("x=%+.3f q=%4d%s x'=%+.3f err=%.4f\n", xs[i], q, in_range ? "   " : " clamp", xr, e);
    }
    printf("范围内最大误差=%.4f（≤ scale/2=%.3f）；被裁剪样本数=%d（期望 2）\n",
           maxerr_in, scale/2, clamped);
    if (maxerr_in > scale/2 + 1e-6) ok = 0;
    if (clamped != 2) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
