/* host_py.c —— Python 环境：依赖版本解析（选择满足约束的最高版本）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_py.c -o host_py && ./host_py
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int versions[] = {1, 2, 3};
    int lo = 1, hi = 2;                 /* 约束: >=1, <=2 */
    int pick = -1;
    for (unsigned i = 0; i < sizeof(versions)/sizeof(versions[0]); i++)
        if (versions[i] >= lo && versions[i] <= hi) pick = versions[i];
    printf("约束 >=%d, <=%d → 选 %d（期望 2）\n", lo, hi, pick);
    if (pick != 2) ok = 0;
    printf("锁定后写入 requirements/锁文件以复现\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
