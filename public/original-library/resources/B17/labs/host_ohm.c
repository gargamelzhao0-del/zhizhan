/* host_ohm.c —— 欧姆定律/分压/LED 限流/功率（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ohm.c -o host_ohm && ./host_ohm
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    float vs = 5.0f, r1 = 10000, r2 = 10000;
    float vout = vs * r2 / (r1 + r2);
    printf("分压 10k/10k @5V → %.2fV（期望 2.50）\n", vout);
    if (vout < 2.49f || vout > 2.51f) ok = 0;
    /* LED 限流：5V - 2V = 3V, 目标 10mA → R=300Ω */
    float rled = (5.0f - 2.0f) / 0.010f;
    printf("LED 限流 R=%.0fΩ 功率=%.3fW\n", rled, (5.0f-2.0f)*0.010f);
    if (rled < 299 || rled > 301) ok = 0;
    /* 功耗：10V, 100Ω → 1W */
    float p = 10.0f*10.0f/100.0f;
    printf("功率 10V/100Ω = %.2fW（期望 1.00）\n", p);
    if (p < 0.99f || p > 1.01f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
