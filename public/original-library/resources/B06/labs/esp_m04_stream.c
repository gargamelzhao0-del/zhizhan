/* esp_m04_stream.c —— 流缓冲：字节流、无消息边界（ESP32 / Xtensa）。
 * 适合 ISR/驱动与任务之间批量搬运字节，读端按“有多少读多少”。 */
#include <stdint.h>
#include "esp_idf_api.h"
#include "rtos_api.h"

static StreamBufferHandle_t g_sb;
static volatile uint8_t g_dma[64];

void esp_dma_done_isr(void) {
    (void)xStreamBufferSend(g_sb, (const void *)g_dma, (size_t)sizeof(g_dma), 0u);
}

static void parser(void *arg) {
    uint8_t buf[32];
    (void)arg;
    for (;;) {
        size_t n = xStreamBufferReceive(g_sb, buf, sizeof(buf), portMAX_DELAY);
        if (n == 0u) { continue; }
        /* 解析 buf[0..n) */
    }
}

void esp_m04_create(void) {
    g_sb = xStreamBufferCreate(256u, 1u);   /* 容量 256 字节，触发水位 1 */
    (void)xTaskCreate(parser, "parse", 3072u, 0, 5u, 0);
}
