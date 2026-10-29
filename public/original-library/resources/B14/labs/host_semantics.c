/* host_semantics.c —— 数据语义：重复/缺失/乱序检测（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_semantics.c -o host_semantics && ./host_semantics
 */
#include <stdio.h>
typedef struct { long t; int seq; } rec_t;
int main(void) {
    int ok = 1;
    rec_t r[] = { {100,1},{200,2},{200,2},{400,4},{300,3} };  /* 重复/缺失3/乱序 */
    int n = (int)(sizeof(r)/sizeof(r[0]));
    int dup = 0, gap = 0, ooo = 0;
    for (int i = 1; i < n; i++) {
        if (r[i].t == r[i-1].t) dup++;
        if (r[i].t < r[i-1].t) ooo++;
        if (r[i].seq != r[i-1].seq + 1) gap++;
    }
    printf("重复=%d 乱序=%d 序号跳变=%d\n", dup, ooo, gap);
    if (!(dup == 1 && ooo == 1 && gap >= 2)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
