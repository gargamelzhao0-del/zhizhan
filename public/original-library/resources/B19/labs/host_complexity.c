/* host_complexity.c —— 复杂度与操作计数：O(n^2) vs O(n log n)（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_complexity.c -o host_complexity && ./host_complexity
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    for (int n = 64; n <= 256; n *= 2) {
        long n2 = (long)n*n/2;                 /* 冒泡/插入约为 n^2/2 */
        long nlogn = (long)n*8;                /* log2(256)=8 量级 */
        printf("n=%d: O(n^2)≈%ld, O(n log n)≈%ld\n", n, n2, nlogn);
        if (n >= 128 && !(n2 > 5*nlogn)) ok = 0;
    }
    printf("结论：规模增大时 O(n^2) 迅速不可接受，需要 O(n log n)\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
