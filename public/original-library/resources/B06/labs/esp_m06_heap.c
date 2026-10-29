/* esp_m06_heap.c —— 按能力分配内存（ESP32 / Xtensa）。
 * 默认堆在内部 DRAM；DMA 缓冲需要 MALLOC_CAP_DMA，才能被外设直接搬运。 */
#include <stdint.h>
#include "esp_idf_api.h"

void *esp_alloc_dma(size_t n) {
    return heap_caps_malloc(n, MALLOC_CAP_DMA | MALLOC_CAP_8BIT);
}

uint32_t esp_heap_free_dma(void) {
    return heap_caps_get_free_size(MALLOC_CAP_DMA);
}
