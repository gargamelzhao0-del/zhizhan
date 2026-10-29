/* host_perf.c —— 性能与资源：CPU 预算与内存峰值估算模型（主机可运行）。
 * 实时线程占 CPU 比例 = 执行时间/周期；内存峰值要留余量。本程序按预算判断是否可接受。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_perf.c -o host_perf && ./host_perf
 */
#include <stdio.h>
static int cpu_ok(int exec_us, int period_us, int budget_permille) { return exec_us * 1000 <= period_us * budget_permille; }
static int mem_ok(int peak_kb, int limit_kb) { return peak_kb * 100 <= limit_kb * 80; }
int main(void) {
    int ok = 1;
    printf("实时线程 200us/1ms → CPU 占用 %d‰（预算 300‰）：%s\n", 200*1000/1000, cpu_ok(200,1000,300)?"OK":"超预算");
    if (!cpu_ok(200, 1000, 300)) ok = 0;
    printf("实时线程 800us/1ms → %s（应超预算）\n", cpu_ok(800,1000,300)?"OK":"超预算");
    if (cpu_ok(800, 1000, 300)) ok = 0;
    printf("内存峰值 6000KB/8192KB → %s\n", mem_ok(6000,8192)?"OK":"超预算");
    if (!mem_ok(6000,8192)) ok = 0;
    printf("内存峰值 7500KB/8192KB → %s（应超预算）\n", mem_ok(7500,8192)?"OK":"超预算");
    if (mem_ok(7500,8192)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
