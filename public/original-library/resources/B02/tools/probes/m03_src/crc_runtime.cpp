// crc_runtime.cpp —— 对照：C 的常见做法。同一份算法，表放 RAM，启动时算一遍。
// 站内 FIG 3.1 的第三列（"运行期建表"）由这个文件实测而来。
#include <cstdint>

static uint8_t s_table[256];   // .bss：256 字节 RAM，等 crc8_init() 来填

// 启动流程里调用一次（main 开头 / 板级初始化里）
void crc8_init() {
    for (int i = 0; i < 256; i++) {
        uint8_t c = (uint8_t)i;
        for (int b = 0; b < 8; b++)
            c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
        s_table[i] = c;
    }
}

// 运行期的每字节成本与 constexpr 版相同：一次查表
uint8_t crc8_rt(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) c = s_table[c ^ *d++];
    return c;
}
