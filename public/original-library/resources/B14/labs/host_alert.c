/* host_alert.c —— 告警规则：阈值 + 持续时长 + 迟滞（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_alert.c -o host_alert && ./host_alert
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    float hi = 80, lo = 75; int need = 3;      /* 超过 80 持续 3 次触发；低于 75 复位（迟滞） */
    float v[] = {70, 82, 85, 90, 78, 74};
    int n = (int)(sizeof(v)/sizeof(v[0])), over = 0, alarm = 0, resets = 0;
    for (int i = 0; i < n; i++) {
        if (v[i] > hi) { over++; if (over >= need) alarm = 1; }
        else if (v[i] < lo) { over = 0; if (alarm) { resets++; alarm = 0; } }
        printf("t=%d v=%.0f over=%d alarm=%d\n", i, v[i], over, alarm);
    }
    printf("触发=1 复位=%d（迟滞避免抖动）\n", resets);
    if (resets != 1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
