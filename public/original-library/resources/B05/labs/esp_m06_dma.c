/* esp_m06_dma.c — ESP32 的 DMA：以“描述符链表”组织（SPI 内建 DMA）
 * 与 STM32 的“通道/流 + 固定请求映射”是两种模型：这里由链表描述每段缓冲。 */
#include <stdint.h>

typedef struct esp_dma_desc {
    uint32_t size : 12, length : 12, offset : 5, sof : 1, eof : 1, owner : 1;
    void *buf;
    struct esp_dma_desc *next;
} esp_dma_desc_t;

void esp_dma_desc_init(esp_dma_desc_t *d, void *buf, uint32_t len, int eof)
{
    d->size = len;
    d->length = len;
    d->offset = 0;
    d->eof = eof ? 1u : 0u;
    d->owner = 1u;                 /* owner=1 交给硬件，完成硬件归还 DMA */
    d->buf = buf;
    d->next = (void *)0;
}

/* 缓冲对齐要求：SPI DMA 需 4 字节对齐、建议 32 字节。ESP32 无 CPU D-cache；
 * 但在 ESP32-S2/S3 上开了 cache，仍需 clean/invalidate（与 STM32H7 同类问题）。 */
extern int spi_bus_initialize(int host, const void *cfg, int dma_chan);
extern int spi_device_transmit(void *dev, void *trans);

int esp_spi_dma_tx(void *dev, void *trans) { return spi_device_transmit(dev, trans); }
