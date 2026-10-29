/* host_dma.c —— DMA 与 cache 一致性方向模型（主机可运行）。
 * 模型：CPU 有 cache（会变旧），DMA 直接读写“内存”。演示按方向遗漏 clean/invalidate 的后果。 */
#include <stdio.h>
#include <string.h>

#define N 4
static int mem[N];                       /* 设备/DMA 看到的内存 */
static int cache[N]; static int valid = 0;   /* CPU cache（整块作一行便于演示） */

static void cpu_write(int i, int v) { cache[i] = v; valid = 1; }       /* 只改 cache（dirty） */
static int  cpu_read(int i) { return valid ? cache[i] : mem[i]; }      /* 命中读 cache */
static void clean(void) { if (valid) for (int i = 0; i < N; i++) mem[i] = cache[i]; }  /* 写回内存 */
static void invalidate(void) { valid = 0; }                            /* 丢弃 cache */
static int  dma_read(int i) { return mem[i]; }                          /* 设备只读内存 */
static void dma_write(int i, int v) { mem[i] = v; }                     /* 设备只写内存 */

int main(void) {
  int ok = 1;
  /* A. CPU→设备：写缓冲后没 clean，DMA 读到旧值（bug） */
  memset(mem, 0, sizeof(mem)); memset(cache, 0, sizeof(cache)); valid = 0;
  cpu_write(0, 0xAA); if (dma_read(0) == 0xAA) ok = 0;
  printf("A 忘 clean : CPU写0xAA, DMA读=0x%02X (旧值→bug)\n", dma_read(0));
  clean();
  printf("A 已 clean : DMA读=0x%02X (最新)\n", dma_read(0));
  if (dma_read(0) != 0xAA) ok = 0;

  /* B. 设备→CPU：DMA 写后没 invalidate，CPU 读到旧 cache（bug） */
  cpu_read(1);                          /* 先把旧值装进 cache */
  dma_write(1, 0x55);                   /* 设备更新内存 */
  printf("B 忘 invalidate: CPU读=0x%02X (旧cache→bug)\n", cpu_read(1));
  if (cpu_read(1) == 0x55) ok = 0;
  invalidate();
  printf("B 已 invalidate: CPU读=0x%02X (最新)\n", cpu_read(1));
  if (cpu_read(1) != 0x55) ok = 0;

  printf("规则: CPU→设备 clean; 设备→CPU invalidate; 缓冲按 cache line 对齐\n");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
