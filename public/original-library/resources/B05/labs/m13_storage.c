/* m13_storage.c — B05-M13 存储器与文件系统接口
 * 块设备抽象 + 掉电可恢复的追加日志（先写数据，最后写“有效”标志）。
 * 关键：区分“写入完成”和“已持久化”，靠提交标记而不是靠写返回判定。 */
#include <stdint.h>
#include <stddef.h>

typedef struct {
    int      (*read)(uint32_t block, void *buf);
    int      (*write)(uint32_t block, const void *buf);
    int      (*erase)(uint32_t block);
    uint32_t block_size;
} blk_dev_t;

/* 记录头：valid 用“魔数”做提交标记。
 * Flash 只能把位从 1 写成 0（擦除后为 0xFF）；所以“未提交”用擦除值 0xFFFF，
 * 提交时写 0xA5A5（在 0xFFFF 上只清位，合法）。
 * 陷阱：先写 0x0000 再改成 0xA5A5 是“置位”，在 Flash 上非法——
 * 这正是本示例第一版会踩的坑，也是理解掉电原子性的关键。 */
#define LOG_VALID_MAGIC  0xA5A5u
#define LOG_VALID_ERASED 0xFFFFu
typedef struct {
    uint32_t seq;
    uint32_t len;
    uint16_t valid;     /* 0xFFFF=未提交（擦除态），0xA5A5=已提交 */
    uint16_t crc;
} log_hdr_t;

static uint16_t crc16_ccitt(const uint8_t *p, uint32_t n)
{
    uint16_t crc = 0xFFFFu;
    for (uint32_t i = 0u; i < n; ++i) {
        crc ^= (uint16_t)p[i] << 8;
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 0x8000u) ? (uint16_t)((crc << 1) ^ 0x1021u) : (uint16_t)(crc << 1);
        }
    }
    return crc;
}

/* 写一条记录：块内布局 = [hdr][payload]。擦除后整块为 0xFF。 */
int log_append(blk_dev_t *dev, uint32_t block, uint32_t seq,
               const void *payload, uint32_t len)
{
    if (dev == NULL || len > dev->block_size - sizeof(log_hdr_t)) {
        return -1;
    }
    if (dev->erase(block) != 0) {
        return -2;
    }
    static uint8_t page[4096];
    log_hdr_t *hdr = (log_hdr_t *)page;
    hdr->seq   = seq;
    hdr->len   = len;
    hdr->valid = LOG_VALID_ERASED;    /* 擦除态=未提交，防掉电读到半成品 */
    hdr->crc   = crc16_ccitt((const uint8_t *)payload, len);
    const uint8_t *src = (const uint8_t *)payload;
    for (uint32_t i = 0u; i < len; ++i) {
        page[sizeof(log_hdr_t) + i] = src[i];
    }
    if (dev->write(block, page) != 0) {
        return -3;                   /* 写入失败 */
    }
    /* 提交：把 valid 从 0xFFFF 写成 0xA5A5（只清位，Flash 允许）；掉电最多丢这一条 */
    hdr->valid = LOG_VALID_MAGIC;
    if (dev->write(block, page) != 0) {
        return -4;
    }
    return 0;                        /* 返回 0 表示已提交；持久化仍以回读校验为准 */
}

int log_read(blk_dev_t *dev, uint32_t block, uint32_t *seq, uint32_t *len)
{
    static uint8_t page[4096];
    if (dev->read(block, page) != 0) {
        return -1;
    }
    const log_hdr_t *hdr = (const log_hdr_t *)page;
    if (hdr->valid != LOG_VALID_MAGIC) {
        return 1;                    /* 未提交记录：视为无效，跳过 */
    }
    *seq = hdr->seq;
    *len = hdr->len;
    return 0;
}
