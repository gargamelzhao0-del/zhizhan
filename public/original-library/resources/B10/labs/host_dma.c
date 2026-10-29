/* host_dma.c —— DMA 与 cache 一致性模型（主机可运行）。
 * 设备（DMA）写内存不会更新 CPU cache：不 invalidate 就持续读到旧值；
 * CPU 写内存只到 cache：不 clean 设备就读到旧内存。本程序用“脏/有效”模型演示。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_dma.c -o host_dma && ./host_dma
 */
#include <stdio.h>
#include <stdint.h>

typedef struct { uint32_t mem; uint32_t cache; int cache_valid; } dma_t;

static void device_write(dma_t *d, uint32_t v) { d->mem = v; }        /* 设备只写内存，不动 cache */
static uint32_t cpu_read(dma_t *d) { return d->cache_valid ? d->cache : d->mem; }
static void cpu_write(dma_t *d, uint32_t v) { d->cache = v; d->cache_valid = 1; }  /* CPU 只写 cache */
static void invalidate(dma_t *d) { d->cache_valid = 0; }              /* mem→cache：令 cache 失效 */
static void clean(dma_t *d) { d->mem = d->cache; }                    /* cache→mem：刷回内存 */

int main(void) {
    int ok = 1;
    /* CPU 曾读过旧值 0x0（cache 有效），设备随后写 0xABCD */
    dma_t d = { 0x0, 0x0, 1 };
    device_write(&d, 0xABCD);
    printf("设备写后未 invalidate：CPU 读到 0x%X（期望旧值 0x0，脏数据）\n", cpu_read(&d));
    if (cpu_read(&d) != 0x0) ok = 0;

    invalidate(&d);
    printf("invalidate 后：CPU 读到 0x%X（期望 0xABCD）\n", cpu_read(&d));
    if (cpu_read(&d) != 0xABCD) ok = 0;

    cpu_write(&d, 0x1234);                 /* 只写进 cache */
    printf("CPU 写后未 clean：mem=0x%X（期望未更新=0xABCD）\n", d.mem);
    if (d.mem == 0x1234) ok = 0;

    clean(&d);
    printf("clean 后：mem=0x%X（期望 0x1234）\n", d.mem);
    if (d.mem != 0x1234) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
