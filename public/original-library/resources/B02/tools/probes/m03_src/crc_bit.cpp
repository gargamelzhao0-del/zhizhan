// crc_bit.cpp —— 取自站点 04-m03.html 的代码块，逐字一致
#include <cstdint>

uint8_t crc8_bitwise(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) {
        c ^= *d++;
        for (int i = 0; i < 8; i++)
            c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
    }
    return c;
}
