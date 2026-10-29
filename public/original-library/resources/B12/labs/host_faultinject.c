/* host_faultinject.c —— 故障注入与恢复统计（主机可运行）。
 * 主动注入故障（总线错误/超时/断网），验证系统能恢复并统计恢复率。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_faultinject.c -o host_faultinject && ./host_faultinject
 */
#include <stdio.h>
typedef enum { F_HW, F_TIMEOUT, F_NET } fault_t;
static int recover(fault_t f) { return (f == F_TIMEOUT) ? 1 : (f == F_NET ? 1 : 0); }  /* 硬件故障模拟不可恢复 */
int main(void) {
    int ok = 1, injected = 0, recovered = 0;
    fault_t faults[] = { F_TIMEOUT, F_NET, F_TIMEOUT, F_HW, F_NET };
    int n = (int)(sizeof(faults) / sizeof(faults[0]));
    for (int i = 0; i < n; i++) { injected++; if (recover(faults[i])) recovered++; }
    printf("注入=%d 恢复=%d 恢复率=%d%%\n", injected, recovered, recovered * 100 / injected);
    if (!(recovered == 4 && injected == 5)) ok = 0;
    int fail_rate = (injected - recovered) * 100 / injected;
    printf("未恢复率=%d%%（需记录并人工介入）\n", fail_rate);
    if (fail_rate != 20) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
