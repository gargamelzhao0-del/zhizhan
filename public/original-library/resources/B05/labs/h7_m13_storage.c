/* h7_m13_storage.c — STM32H7 存储：内部 Flash 扇区达 128KB；外扩常用 QUADSPI/OCTOSPI/FMC
 * 提交标记（擦除态 0xFFFF→0xA5A5）与 F1 同一逻辑；新增点是 cache 与擦写粒度更大。 */
#include <stdint.h>
#include <stddef.h>

typedef struct {
    int      (*read)(uint32_t block, void *buf);
    int      (*write)(uint32_t block, const void *buf);
    int      (*erase)(uint32_t block);
    uint32_t block_size;
} h7_blk_dev_t;

/* H7 内部 Flash 扇区 0..7 各 128KB；外扩 OCTOSPI NOR 常按 4KB 擦。
 * 无论哪种，掉电原子性都靠“擦除态→提交魔数”的只清位写法。 */
int h7_log_commit(h7_blk_dev_t *dev, uint32_t block, uint16_t *valid_word)
{
    if (dev == NULL || valid_word == NULL) { return -1; }
    if (*valid_word != 0xFFFFu) { return -2; }   /* 已被写过：需先擦除 */
    *valid_word = 0xA5A5u;                        /* 只清位，合法 */
    return dev->write(block, valid_word) == 0 ? 0 : -3;
}

/* 外扩 NOR/SDRAM 常用地址：0x90000000（OCTOSPI1）；0xC0000000（SDRAM via FMC） */
uint32_t *h7_ext_nor_base(void) { return (uint32_t *)0x90000000u; }
