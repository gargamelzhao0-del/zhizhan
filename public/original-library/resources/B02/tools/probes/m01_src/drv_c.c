/* drv_c.c —— 取自站点 02-m01.html 的代码块，逐字一致（C 版） */
#include <stdint.h>

typedef struct { uint32_t base; uint8_t id; } uart_t;

static uint8_t crc8(const uint8_t *d, uint32_t n)
{
    uint8_t c = 0;
    while (n--) {
        c ^= *d++;
        for (int i = 0; i < 8; i++) c = (uint8_t)((c << 1) ^ ((c >> 7) * 0x07));
    }
    return c;
}

void uart_write(uart_t *u, const uint8_t *buf, uint32_t n)
{
    volatile uint32_t *p = (volatile uint32_t *)u->base;
    while (n--) {
        while (!(p[0] & 0x80)) { }   /* SR(0x00) 的 TXE 位(bit7) */
        *(volatile uint8_t *)(u->base + 4) = *buf++;
    }
}

uint8_t frame_crc(const uint8_t *b, uint32_t n) { return crc8(b, n); }
