/* host_latency.c —— 推理延迟预算：逐层耗时求和与截止期判定（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_latency.c -o host_latency && ./host_latency
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int layers_us[] = {50, 180, 300, 120, 40};   /* 教学预设值，不是设备推理测量 */
    int n = (int)(sizeof(layers_us)/sizeof(layers_us[0]));
    int total = 0; for (int i = 0; i < n; i++) total += layers_us[i];
    int deadline = 800;
    printf("预设层耗时预算=%dus 截止期=%dus → %s\n", total, deadline, total <= deadline ? "满足" : "超期");
    if (total != 690) ok = 0;
    if (!(total <= deadline)) ok = 0;
    printf("最重层占 %.0f%%（优化优先它）\n", 300.0*100/total);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
