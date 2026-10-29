/* host_pullup.c —— 上拉电阻与开漏总线的上升时间估算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pullup.c -o host_pullup -lm && ./host_pullup
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    /* I2C 快速模式 400kHz 要求上升时间 < 300ns；t_r ≈ 0.8473*R*C */
    float R = 4700, C = 30e-12f;              /* 4.7k, 30pF */
    float tr = 0.8473f * R * C * 1e9f;          /* ns */
    printf("上拉 4.7k / 总线电容 30pF → 上升时间 ≈ %.0fns\n", tr);
    int fast_ok = tr < 300.0f;
    printf("满足 400kHz 快速模式(<300ns)=%d\n", fast_ok);
    if (!fast_ok) ok = 0;
    /* 上拉过小 → 功耗大（低电平时电流） */
    float i = 3.3f / 1000.0f;                    /* 1k 上拉 3.3V */
    printf("1k 上拉低电平电流=%.1fmA（功耗权衡）\n", i*1000);
    if (i <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
