/* host_ringbuf.c — 可在主机运行的环形缓冲自检（gcc，非交叉）
 * 环形缓冲是纯逻辑，最适合先在 PC 上把边界测干净，再搬到 MCU。 */
#include <stdio.h>
#include <stdint.h>

#define RB_SIZE 8u   /* 2 的幂；留一格区分满/空，可用 7 格 */
typedef struct {
    volatile uint16_t head;
    volatile uint16_t tail;
    uint8_t buf[RB_SIZE];
} rb_t;

static int rb_push(rb_t *rb, uint8_t byte)
{
    uint16_t next = (uint16_t)((rb->head + 1u) & (RB_SIZE - 1u));
    if (next == rb->tail) {
        return 0;                        /* 满 */
    }
    rb->buf[rb->head] = byte;
    rb->head = next;
    return 1;
}

static int rb_pop(rb_t *rb, uint8_t *out)
{
    if (rb->head == rb->tail) {
        return 0;                        /* 空 */
    }
    *out = rb->buf[rb->tail];
    rb->tail = (uint16_t)((rb->tail + 1u) & (RB_SIZE - 1u));
    return 1;
}

int main(void)
{
    rb_t rb = { 0u, 0u, { 0u } };
    int failures = 0;
    uint8_t v = 0u;

    /* 空缓冲 pop 必须失败 */
    if (rb_pop(&rb, &v) != 0) { printf("FAIL empty pop\n"); failures++; }

    /* 填满：8 格只能存 7 个 */
    int pushed = 0;
    for (uint8_t i = 1u; i <= 10u; ++i) {
        pushed += rb_push(&rb, (uint8_t)(i * 10u));
    }
    printf("pushed=%d (expect 7)\n", pushed);
    if (pushed != 7) { failures++; }

    /* 顺序必须 FIFO：10,20,...,70 */
    int order_ok = 1;
    for (uint8_t expect = 10u; expect <= 70u; expect += 10u) {
        if (rb_pop(&rb, &v) != 1 || v != expect) { order_ok = 0; }
    }
    printf("fifo_order=%s\n", order_ok ? "ok" : "BAD");
    if (!order_ok) { failures++; }

    /* 反复回绕 100 次 */
    for (int i = 0; i < 100; ++i) {
        rb_push(&rb, (uint8_t)i);
        rb_pop(&rb, &v);
    }
    printf("wrap_cycles=100 ok\n");

    printf(failures ? "RESULT: FAIL (%d)\n" : "RESULT: PASS\n", failures);
    return failures ? 1 : 0;
}
