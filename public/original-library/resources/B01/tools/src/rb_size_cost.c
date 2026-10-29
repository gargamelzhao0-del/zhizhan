/* rb_size_cost.c — "缓冲区开多大"这一个决定，同时买下三样东西
 *
 * 这三样在代码里分得很开（算下标、对 DMA、写静态断言），
 * 但它们其实是同一个决定的三个后果，所以放在一起看：
 *   ① 位置运算能不能退化成一条位运算；
 *   ② 缓冲区能不能满足 DMA 的对齐要求；
 *   ③ 容量本身要不要为某个上游尺寸（比如一帧 200 字节）让步。
 */
#include <stdint.h>

/* ---------------- ① 位置运算：2 的幂 vs 不是 ----------------
   下面五组写的是同一件事的两种说法，专看反汇编是否一致。 */
uint32_t pos_mask_256 (uint32_t i) { return i & 255u;  }
uint32_t pos_mod_256  (uint32_t i) { return i % 256u;  }
uint32_t pos_mask_1024(uint32_t i) { return i & 1023u; }
uint32_t pos_mod_1024 (uint32_t i) { return i % 1024u; }
uint32_t pos_mod_200  (uint32_t i) { return i % 200u;  }   /* 不是 2 的幂 */

/* ---------------- ② DMA 对齐：由属性决定，不由变量名决定 ----------------
   两个数组大小一样、类型一样，唯一的差别是 dma_buf 多了对齐属性。
   对齐这件事写在【节属性】里，链接器照它摆位置 —— 反汇编看不出来，
   要看 readelf 的节表。
   加 -DNO_ALIGN 去掉属性，就能当场量出"有属性 / 没属性"的差别。 */
#ifdef NO_ALIGN
#  define DMA_ALIGN
#else
#  define DMA_ALIGN __attribute__((aligned(32)))
#endif

DMA_ALIGN uint8_t dma_buf[256];
uint8_t           plain_buf[256];

uint32_t use_bufs(void)
{
    return (uint32_t)dma_buf[0] + (uint32_t)plain_buf[0];
}
