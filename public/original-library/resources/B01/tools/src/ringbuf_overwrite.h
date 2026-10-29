/* ringbuf_overwrite.h — 满了就覆盖最旧的：生产者永不阻塞
 *
 * 和 6.7 那个 ringbuf.h 只差一条政策：满时是"拒绝写入"还是"挤掉最旧的"。
 * 听起来像改一个 if，实际上下面三件事会一起改掉 ——
 * 这也正是覆盖式缓冲区没法靠"在旧实现上改一行"得到的原因。
 *
 *   ① head / tail 必须【自由回绕】（只增不减），掩码留到算下标那一刻才用；
 *      否则回绕之后差值不再携带"落后多少"的信息。
 *   ② "丢了多少"不需要额外计数器：无符号差值减容量，就是答案。
 *   ③ 消费者的位置随时可能失效，只能在每次取数据时现场对账。
 *
 * 串口 DMA、音频流、"只关心最新一帧"的传感器读数，都是这个取舍：
 * 宁可丢最旧的，也不要让生产者（往往是中断或 DMA）阻塞或失败。
 */
#ifndef RINGBUF_OVERWRITE_H
#define RINGBUF_OVERWRITE_H

#include <stdint.h>
#include <stddef.h>

#define OVRB_SIZE  256u                 /* 必须是 2 的幂 */
_Static_assert((OVRB_SIZE & (OVRB_SIZE - 1u)) == 0u,
               "OVRB_SIZE 必须是 2 的幂，否则算下标就退化成取模");

typedef struct {
    uint8_t          *buf;
    uint32_t          mask;             /* 容量 - 1 */
    volatile uint32_t head;             /* 自由回绕，只由生产者写 */
    uint32_t          tail;             /* 自由回绕，只由消费者写 */
} ovrb_t;

/* 生产者：永不失败、永不阻塞。写进 (head & mask)，然后发布新的 head。
   掩码在这个函数里用掉；head 本身只增不减。 */
static inline void ovrb_put(ovrb_t *rb, uint8_t b)
{
    uint32_t h = rb->head;

    rb->buf[h & rb->mask] = b;          /* ① 先写数据 */
    rb->head = h + 1u;                  /* ② 后发布（自由回绕，不掩码） */
}

/* 消费者：先对账、再取。返回本次被迫跳过的字节数（也就是被覆盖掉的那些）。 */
static inline uint32_t ovrb_read(ovrb_t *rb, uint8_t *out, uint32_t want)
{
    uint32_t head = rb->head;           /* volatile 只读一次，读了就存起来 */
    uint32_t tail = rb->tail;
    uint32_t lost = 0u;

    uint32_t lag = head - tail;         /* 无符号减法：回绕天然正确 */
    if (lag > rb->mask + 1u) {          /* 落后超过一个满容量 = 有数据没读就没了 */
        lost  = lag - (rb->mask + 1u);
        tail += lost;                   /* 跳过已经被覆盖的那一段 */
    }

    uint32_t n = head - tail;           /* 现在真正还能读到的字节数 */
    if (n > want) n = want;
    for (uint32_t i = 0u; i < n; i++) {
        out[i] = rb->buf[(tail + i) & rb->mask];
    }
    rb->tail = tail + n;
    return lost;
}

#endif /* RINGBUF_OVERWRITE_H */
