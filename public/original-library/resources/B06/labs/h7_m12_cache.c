/* h7_m12_cache.c —— D-Cache 与 DMA 一致性（STM32H7 / Cortex-M7）。
 * DMA/其他核对内存的写入对 CPU 不一定可见：共享缓冲要么放非 cache 区，
 * 要么按 cache line 做 clean/invalidate，并按 line 对齐。 */
#include <stdint.h>

#define ALIGN32 __attribute__((aligned(32)))

static ALIGN32 volatile uint32_t g_dma_buf[16];   /* 32 字节对齐，覆盖一个 cache line */

/* CMSIS 提供这两个函数（此处仅声明，链接时由 CMSIS 提供） */
extern void SCB_CleanDCache_by_Addr(volatile void *addr, int32_t dsize);
extern void SCB_InvalidateDCache_by_Addr(volatile void *addr, int32_t dsize);

void h7_dma_clean(void)      { SCB_CleanDCache_by_Addr((void *)g_dma_buf, (int32_t)sizeof(g_dma_buf)); }
void h7_dma_invalidate(void) { SCB_InvalidateDCache_by_Addr((void *)g_dma_buf, (int32_t)sizeof(g_dma_buf)); }
