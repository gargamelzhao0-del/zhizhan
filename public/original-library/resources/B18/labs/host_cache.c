/* host_cache.c —— 内存层次与局部性：命中/未命中成本模型（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cache.c -o host_cache && ./host_cache
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int cycles_hit = 1, cycles_miss = 50;
    /* 顺序访问（高局部性）：每 4 次 1 miss */
    long seq = (100/4)*cycles_miss + (100-100/4)*cycles_hit;
    /* 跳跃访问（低局部性）：每次都 miss */
    long jump = 100*cycles_miss;
    printf("顺序访问 100 次≈%ld cycle，跳跃访问≈%ld cycle\n", seq, jump);
    if (!(jump > seq * 2)) ok = 0;
    printf("结论：局部性决定平均访存成本\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
