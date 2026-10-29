/* host_queue.c —— 队列 / 事件组的语义模型（主机可运行）。
 *
 * 覆盖 RTOS 队列最容易被想当然的三件事：
 *   ① 拷贝语义：入队的是“值”，不是指针；之后改原变量不影响队列里的副本。
 *   ② 满/空边界：满时 send 返回失败（不是覆盖）；空时 recv 返回失败。
 *   ③ FromISR 唤醒：中断里 send，只有在“有更高优先级任务在等”时才设置
 *      xHigherPriorityTaskWoken，据此决定是否 portYIELD_FROM_ISR。
 *   ④ 事件组：按位与/或等待与超时。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_queue.c -o host_queue && ./host_queue
 */
#include <stdio.h>

#define QCAP 4
typedef struct { int buf[QCAP]; int head, tail, count; } queue_t;

static void q_init(queue_t *q) { q->head = q->tail = q->count = 0; }
static int  q_send(queue_t *q, int v) {
    if (q->count == QCAP) return 0;               /* 满：拒绝，不覆盖 */
    q->buf[q->tail] = v; q->tail = (q->tail + 1) % QCAP; q->count++; return 1;
}
static int  q_recv(queue_t *q, int *v) {
    if (q->count == 0) return 0;                  /* 空：失败 */
    *v = q->buf[q->head]; q->head = (q->head + 1) % QCAP; q->count--; return 1;
}
/* 中断上下文版本：receiver_waiting 表示是否有更高优先级任务正阻塞在“收”上 */
static int  q_send_from_isr(queue_t *q, int v, int receiver_waiting, int *higher_woken) {
    *higher_woken = 0;
    if (q->count == QCAP) return 0;
    q_send(q, v);
    if (receiver_waiting) *higher_woken = 1;      /* 唤醒后需要 portYIELD_FROM_ISR */
    return 1;
}

/* 事件组：32 位标志 + 等待/超时 */
typedef struct { unsigned bits; } evt_t;
static void evt_set(evt_t *e, unsigned mask) { e->bits |= mask; }
static void evt_clear(evt_t *e, unsigned mask) { e->bits &= ~mask; }
/* 返回 1 表示满足（所有 clear_on_exit 位都置位），0 表示超时 */
static int evt_wait(evt_t *e, unsigned mask, int timeout_ticks, int *waited) {
    int t;
    for (t = 0; t <= timeout_ticks; t++) {
        if ((e->bits & mask) == mask) { *waited = t; return 1; }
    }
    *waited = timeout_ticks; return 0;
}

int main(void) {
    queue_t q; int v, ok = 1;

    q_init(&q);
    /* ① 拷贝语义 */
    int src = 100;
    q_send(&q, src);
    src = 999;                                     /* 改原变量 */
    q_recv(&q, &v);
    printf("拷贝语义：入队 100 后改原变量为 999，出队得到 %d\n", v);
    if (v != 100) ok = 0;

    /* ② 满/空边界 */
    q_init(&q);
    for (int i = 1; i <= QCAP; i++) if (!q_send(&q, i)) ok = 0;
    printf("满队列：已装 %d 项，再 send 返回 %s\n", QCAP, q_send(&q, 99) ? "成功" : "失败(正确)");
    if (q_send(&q, 99)) ok = 0;

    q_recv(&q, &v); q_recv(&q, &v);                /* 取走 1、2 */
    q_send(&q, 5); q_send(&q, 6);                  /* 空出两格再入 5、6 */
    int seq[6], n = 0;
    while (q_recv(&q, &v)) seq[n++] = v;
    printf("FIFO 顺序：");
    for (int i = 0; i < n; i++) printf("%d%s", seq[i], i + 1 < n ? "," : "");
    printf(" (期望 3,4,5,6)\n");
    if (!(n == 4 && seq[0] == 3 && seq[1] == 4 && seq[2] == 5 && seq[3] == 6)) ok = 0;

    /* ③ FromISR 唤醒标志 */
    q_init(&q);
    int woken = -1;
    q_send_from_isr(&q, 7, 0, &woken);
    printf("FromISR：无等待者 → higher_woken=%d (期望 0)\n", woken);
    if (woken != 0) ok = 0;
    q_send_from_isr(&q, 8, 1, &woken);
    printf("FromISR：有高优先级等待者 → higher_woken=%d (期望 1)\n", woken);
    if (woken != 1) ok = 0;

    /* ④ 事件组 */
    evt_t e = {0};
    evt_set(&e, 0x1);
    evt_set(&e, 0x4);
    int waited = 0;
    int r = evt_wait(&e, 0x5, 10, &waited);
    printf("事件组：等待 0x5 → %s，等了 %d tick\n", r ? "满足" : "超时", waited);
    if (!(r == 1 && waited == 0)) ok = 0;
    evt_clear(&e, 0x1);
    if ((e.bits & 0x1) != 0) ok = 0;
    r = evt_wait(&e, 0x2, 5, &waited);
    printf("事件组：等待未置位的 0x2 → %s，等了 %d tick\n", r ? "满足" : "超时", waited);
    if (!(r == 0 && waited == 5)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
