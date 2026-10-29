/* host_mmu.c —— MMU：虚拟到物理翻译与权限检查（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_mmu.c -o host_mmu && ./host_mmu
 */
#include <stdio.h>
typedef struct { unsigned va, pa, size; int r, w, x; } pte_t;
static pte_t T[] = { {0x0000,0x8000,0x1000,1,0,1}, {0x1000,0x9000,0x1000,1,1,0} };
static int translate(unsigned va, int want_write, unsigned *pa) {
    for (unsigned i = 0; i < sizeof(T)/sizeof(T[0]); i++)
        if (va >= T[i].va && va < T[i].va + T[i].size) {
            if (want_write && !T[i].w) return -1;      /* 权限错误 */
            *pa = T[i].pa + (va - T[i].va); return 0;
        }
    return -2;                                          /* 缺页/未映射 */
}
int main(void) {
    int ok = 1; unsigned pa;
    int r1 = translate(0x0004, 0, &pa); printf("读 0x0004 → pa=0x%X（r=%d）\n", pa, r1);
    if (!(r1 == 0 && pa == 0x8004)) ok = 0;
    int r2 = translate(0x0004, 1, &pa); printf("写只读页 → r=%d（期望 -1 权限故障）\n", r2);
    if (r2 != -1) ok = 0;
    int r3 = translate(0x5000, 0, &pa); printf("未映射 → r=%d（期望 -2）\n", r3);
    if (r3 != -2) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
