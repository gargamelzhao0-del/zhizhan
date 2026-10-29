/* host_abi.c —— 调用约定模型：参数走寄存器、返回值、栈（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_abi.c -o host_abi && ./host_abi
 */
#include <stdio.h>
typedef struct { int r[4]; int sp; int stack[16]; } vm_t;
static int call(vm_t *v, int a0, int a1, int a2, int a3, int a4) {
    v->r[0]=a0; v->r[1]=a1; v->r[2]=a2; v->r[3]=a3;   /* 前 4 个参数进 r0–r3 */
    v->stack[v->sp++] = a4;                            /* 第 5 个参数走栈 */
    return v->r[0]+v->r[1]+v->r[2]+v->r[3]+a4;
}
int main(void) {
    int ok = 1; vm_t v = {{0,0,0,0}, 0, {0}};
    int r = call(&v, 1, 2, 3, 4, 5);
    printf("参数 r0=%d r1=%d r2=%d r3=%d 返回 r0=%d（期望 15）\n", v.r[0], v.r[1], v.r[2], v.r[3], r);
    if (r != 15) ok = 0;
    printf("第 5 个参数在栈顶=%d（第 5 个起走栈）\n", v.stack[v.sp-1]);
    if (v.stack[v.sp-1] != 5) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
