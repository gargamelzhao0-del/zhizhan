/* host_term.c —— 总线终端与反射：传输线阻抗匹配（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_term.c -o host_term && ./host_term
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    /* 特征阻抗 120Ω 的 CAN 总线：两端各 120Ω 终端，等效 60Ω */
    float z0 = 120.0f, rterm = 120.0f;
    float z_eff = 1.0f/(1.0f/rterm + 1.0f/rterm);
    printf("两端 120Ω 终端 → 等效 %.0fΩ（应匹配 z0=120Ω 的差分）\n", z_eff);
    /* 反射系数：负载 ZL 与 z0 */
    float zl_bad = 1000.0f;
    float gamma = (zl_bad - z0) / (zl_bad + z0);
    printf("失配负载 1k 的反射系数=%.2f（越接近 0 越好）\n", gamma);
    if (fabsf(gamma) < 0.5f) ok = 0;              /* 失配明显 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
