/* host_perf.c —— 性能预算：CPI/周期与吞吐估算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_perf.c -o host_perf && ./host_perf
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 指令数 × CPI / 频率 = 时间 */
    long instr = 1000000;      /* 1M 指令 */
    float cpi = 1.5f, freq_mhz = 72.0f;
    float time_ms = (float)instr * cpi / (freq_mhz * 1e6f) * 1000.0f;
    printf("1M 指令 @72MHz CPI=1.5 → %.2fms\n", time_ms);
    if (time_ms < 20.0f || time_ms > 21.0f) ok = 0;
    /* 内存墙：访存慢会显著拉高 CPI */
    printf("note: cache miss 会抬升有效 CPI，预算要含访存\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
