// crc_table.cpp —— 取自站点 04-m03.html 的代码块，逐字一致
#include <cstdint>
#include <array>

// consteval：保证这张表只能在编译期算出来（写错成运行时一律编译失败）
consteval std::array<uint8_t, 256> make_crc8_table() {
    std::array<uint8_t, 256> t{};
    for (int i = 0; i < 256; i++) {
        uint8_t c = (uint8_t)i;
        for (int b = 0; b < 8; b++)
            c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
        t[i] = c;
    }
    return t;
}

// 表落进 .rodata（Flash），不占 RAM、不需要运行时初始化
inline constexpr auto CRC8_TABLE = make_crc8_table();

uint8_t crc8(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) c = CRC8_TABLE[c ^ *d++];
    return c;
}
