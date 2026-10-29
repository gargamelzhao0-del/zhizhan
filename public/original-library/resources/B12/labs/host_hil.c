/* host_hil.c —— 硬件在环（HIL）测试序列：激励→观测→断言（含超时）（主机可运行）。
 * HIL 用真实硬件激励并观察响应；步骤要有超时与期望值。本程序模拟一段 HIL 序列。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hil.c -o host_hil && ./host_hil
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; int stim; int expect; int timeout_ms; } step_t;
static int dut(int stim) { return stim * 2 + 1; }   /* 模拟被测设备 */
int main(void) {
    int ok = 1;
    step_t seq[] = { {"set_mode", 1, 3, 100}, {"read_value", 5, 11, 100}, {"bad_case", 2, 99, 100} };
    int n = (int)(sizeof(seq) / sizeof(seq[0])), passed = 0;
    for (int i = 0; i < n; i++) {
        int obs = dut(seq[i].stim);
        int within = 1;   /* 假设在超时内完成 */
        int good = within && (obs == seq[i].expect);
        printf("  %-10s stim=%d expect=%d obs=%d timeout=%dms → %s\n",
               seq[i].name, seq[i].stim, seq[i].expect, obs, seq[i].timeout_ms, good ? "PASS" : "FAIL");
        if (good) passed++;
    }
    printf("HIL 通过 %d/%d\n", passed, n);
    if (passed != 2) ok = 0;   /* 故意有一条失败 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
