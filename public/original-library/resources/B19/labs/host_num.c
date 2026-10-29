/* host_num.c —— 定点 Q15 与浮点误差（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_num.c -o host_num && ./host_num
 */
#include <stdio.h>
#include <stdint.h>
static int16_t q15(float x) { float s = x*32768.0f; if (s > 32767) s = 32767; if (s < -32768) s = -32768; return (int16_t)(s < 0 ? s - 0.5f : s + 0.5f); }
static float q15_to_f(int16_t q) { return q / 32768.0f; }
int main(void) {
    int ok = 1;
    float xs[] = {0.5f, -0.5f, 0.999f, -1.0f};
    float maxe = 0;
    for (unsigned i = 0; i < sizeof(xs)/sizeof(xs[0]); i++) {
        int16_t q = q15(xs[i]); float r = q15_to_f(q); float e = r - xs[i]; if (e < 0) e = -e;
        if (e > maxe) maxe = e;
        printf("x=%+.3f q=%6d x'=%+.5f err=%.5f\n", xs[i], q, r, e);
    }
    printf("最大误差=%.5f（≤ 1/32768=%.5f）\n", maxe, 1.0f/32768.0f);
    if (maxe > 1.0f/32768.0f + 1e-6f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
