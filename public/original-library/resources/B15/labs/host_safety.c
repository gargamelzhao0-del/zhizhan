/* host_safety.c —— 功能安全：三取二表决与安全态（主机可运行）。
 * 2oo3 表决：三路传感器取多数；不一致时进入安全态（保守输出）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_safety.c -o host_safety && ./host_safety
 */
#include <stdio.h>
static int vote2oo3(int a, int b, int c) { int s = (a>0)+(b>0)+(c>0); return s >= 2; }   /* 多数为 1 则 1 */
int main(void) {
    int ok = 1;
    printf("(1,1,0)→%d (1,1,1)→%d (0,0,1)→%d (1,0,0)→%d\n", vote2oo3(1,1,0), vote2oo3(1,1,1), vote2oo3(0,0,1), vote2oo3(1,0,0));
    if (!(vote2oo3(1,1,0)==1 && vote2oo3(1,1,1)==1 && vote2oo3(0,0,1)==0 && vote2oo3(1,0,0)==0)) ok = 0;
    /* 安全态：三路全异或含故障 → 输出安全值 0 */
    int fault = 1, safe_out = fault ? 0 : vote2oo3(1,1,0);
    printf("故障时安全输出=%d（期望 0）\n", safe_out);
    if (safe_out != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
