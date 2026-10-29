/* host_ipc.c —— 进程间通信：管道/环形缓冲的生产者-消费者模型（主机可运行）。
 * 管道是字节流；共享内存在多进程下要自己同步。本程序模拟有界 FIFO 的 push/pop 与阻塞语义。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ipc.c -o host_ipc && ./host_ipc
 */
#include <stdio.h>
#define CAP 4
typedef struct { int buf[CAP]; int head, tail, count; } fifo_t;
static int push(fifo_t *q, int v) { if (q->count == CAP) return -1; q->buf[q->tail] = v; q->tail = (q->tail + 1) % CAP; q->count++; return 0; }
static int pop(fifo_t *q, int *v) { if (q->count == 0) return -1; *v = q->buf[q->head]; q->head = (q->head + 1) % CAP; q->count--; return 0; }
int main(void) {
    int ok = 1; fifo_t q = {{0}, 0, 0, 0};
    for (int i = 1; i <= 4; i++) if (push(&q, i) != 0) ok = 0;
    printf("填满后 count=%d，再 push: %d（期望 -1 满）\n", q.count, push(&q, 9));
    if (push(&q, 9) != -1) ok = 0;
    int v = 0, good = 1;
    for (int i = 1; i <= 4; i++) { if (pop(&q, &v) != 0 || v != i) good = 0; }
    printf("按序取出=%s  count=%d（期望 1..4、0）\n", good ? "是" : "否", q.count);
    if (!good || q.count != 0) ok = 0;
    printf("空时 pop: %d（期望 -1 空）\n", pop(&q, &v));
    if (pop(&q, &v) != -1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
