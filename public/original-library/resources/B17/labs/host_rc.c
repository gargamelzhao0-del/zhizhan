/* host_rc.c —— RC 时间常数与滤波截止频率（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_rc.c -o host_rc -lm && ./host_rc
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    float r = 10000, c = 1e-6f;
    float tau = r * c;
    printf("R=10k C=1uF → tau=%.4fs\n", tau);
    if (fabsf(tau - 0.01f) > 1e-5f) ok = 0;
    float fc = 1.0f/(2.0f*3.14159265f*r*c);
    printf("截止频率 fc=%.1fHz（期望 ~15.9）\n", fc);
    if (fabsf(fc - 15.9f) > 0.2f) ok = 0;
    /* 5tau 达到约 99.3% */
    printf("5tau 后充电到约 %.1f%%\n", (1-expf(-5))*100);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
