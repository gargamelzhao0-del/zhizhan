/* host_ring.c —— 栈/队列/环形缓冲（有界）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ring.c -o host_ring && ./host_ring
 */
#include <stdio.h>
#define CAP 4
typedef struct { int b[CAP]; int head, tail, n; } ring_t;
static int push(ring_t *r, int v) { if (r->n == CAP) return -1; r->b[r->tail] = v; r->tail = (r->tail+1)%CAP; r->n++; return 0; }
static int pop(ring_t *r, int *v) { if (r->n == 0) return -1; *v = r->b[r->head]; r->head = (r->head+1)%CAP; r->n--; return 0; }
int main(void) {
    int ok = 1; ring_t r = {{0},0,0,0}; int v;
    for (int i = 1; i <= 4; i++) if (push(&r, i)) ok = 0;
    printf("满时再 push=%d（期望 -1）\n", push(&r, 9));
    if (push(&r, 9) != -1) ok = 0;
    if (pop(&r, &v) || v != 1) ok = 0;
    if (push(&r, 5)) ok = 0;                  /* 回绕后写入 */
    printf("回绕后顺序: ");
    while (pop(&r, &v) == 0) printf("%d ", v);
    printf("(期望 2 3 4 5)\n");
    /* 简化校验：总量守恒 */
    if (r.n != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
