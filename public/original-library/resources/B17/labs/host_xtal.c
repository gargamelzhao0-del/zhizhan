/* host_xtal.c —— 晶振负载电容计算与最小系统校核（主机可运行）。
 * 无源晶振负载电容：CL = (C1*C2)/(C1+C2) + Cstray；需与晶振规格 CL 匹配（常见 12–16pF）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_xtal.c -o host_xtal && ./host_xtal
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    float c1 = 22e-12f, c2 = 22e-12f, cstray = 5e-12f;   /* 两颗 22pF + 杂散 5pF */
    float cl = (c1 * c2) / (c1 + c2) + cstray;
    printf("C1=C2=%.0fpF Cstray=%.0fpF → CL=%.1fpF（期望 ~16）\n",
           c1 * 1e12f, cstray * 1e12f, cl * 1e12f);
    if (cl < 15.5e-12f || cl > 16.5e-12f) ok = 0;
    /* 与晶振规格（示例 CL=16pF）比较，偏差须在 ±0.5pF 内 */
    float cl_spec = 16e-12f;
    printf("晶振规格 CL=%.0fpF，匹配误差 %.1fpF（须 ≤0.5）\n",
           cl_spec * 1e12f, (cl - cl_spec) * 1e12f);
    if (cl < cl_spec - 0.5e-12f || cl > cl_spec + 0.5e-12f) ok = 0;
    printf("最小系统：电源 → 晶振 → 复位 → BOOT → 调试口，逐项确认后等 PLL 锁定\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
