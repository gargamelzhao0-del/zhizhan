# 存储器与文件系统接口

```zhizhan-anchor
m13
```



存储的第一个事实是 **擦写粒度** ：“改一个字节”实际是“读整块→改→擦→写回”。掉电原子性靠 **提交标记** （未提交=0xFFFF，已提交=0xA5A5，只清位合法），并以回读校验为准。

 

> 前置：理解 Flash 擦写特性与块设备概念，会做整数校验（CRC）。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按介质擦写粒度抽象块设备，用提交标记实现掉电原子追加日志并回读校验。

 

本章速览




- Flash 只能把位从 1 写成 0：提交标记用“擦除态→魔数”。

- 区分“写入完成”和“已持久化”，持久化以回读校验为准。

- 关注擦写粒度与寿命；[NVS](term:nvs)/LittleFS 已封装掉电安全。

 

```zhizhan-anchor
m13-gran
```



```zhizhan-anchor
m13-gran-t
```



## 13.1 擦写粒度与提交标记



内部 Flash 按页/扇区擦除、字节可编程但不能反复覆写；外部 NOR 按 4 KB 擦、字节写；NAND/SD 按块擦。所以“改一个字节”= 读整块→改→擦→写回。掉电原子性靠提交标记：最后写 valid，未写即视为无效。



```zhizhan-anchor
fig-图-13-1
```



**图 13.1**  掉电原子追加日志



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="掉电原子追加日志" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写数据</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">回读校验</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">写提交标记</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">启动扫描</text></svg>
```



写数据（未提交=0xFFFF）→ 回读校验 → 最后写提交标记 0xA5A5 → 下次启动跳过未提交记录。



表 13.1 介质擦写粒度



| 介质 | 擦除粒度 | 写入单位 | 寿命 |
| --- | --- | --- | --- |
| STM32 内部 Flash | 1 KB/2 KB 页 | 半字/字 | 约 1 万次 |
| 外部 SPI NOR | 4 KB 扇区 | 1 字节 | 约 10 万次 |
| SD/eMMC | 块（512 B/4 KB） | 块 | 需磨损均衡 |



```zhizhan-anchor
m13-evidence
```



```zhizhan-anchor
m13-evidence-t
```



## 13.2 真实证据：CRC16 主机运行



` size m13_storage.o ` → text= **244**  B，bss= **8192**  B（两个 4 KB 页缓冲）。记录头的 CRC16 与下面主机程序同一算法，用已知向量对齐，可主机复现：



host\_crc16.cC

 

```text
/* host_crc16.c — CRC16-CCITT(FALSE) 自检（gcc 主机运行）
 * 与“设备端存储/协议校验”共用同一算法，用已知向量 0x29B1 对齐。 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint16_t crc16_ccitt(const uint8_t *p, uint32_t n)
{
    uint16_t crc = 0xFFFFu;
    for (uint32_t i = 0u; i < n; ++i) {
        crc ^= (uint16_t)p[i] << 8;
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 0x8000u) ? (uint16_t)((crc << 1) ^ 0x1021u)
                                  : (uint16_t)(crc << 1);
        }
    }
    return crc;
}

int main(void)
{
    const char *check = "123456789";
    uint16_t got = crc16_ccitt((const uint8_t *)check, (uint32_t)strlen(check));
    printf("crc16(\"%s\") = 0x%04X (expect 0x29B1)\n", check, got);
    int ok = (got == 0x29B1u);
    printf(ok ? "RESULT: PASS\n" : "RESULT: FAIL\n");
    return ok ? 0 : 1;
}
```

CRC16 校验（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_crc16.c -o labs/host_crc16 && ./labs/host_crc16
CRC16("123456789") = 0x29B1 (expect 0x29B1)
RESULT: PASS
```



用已知向量 0x29B1 对齐同一 CRC16 算法，设备端与主机端可互相复现。



表 13.2 校验与提交标记



| 校验/标记 | 值 | 说明 |
| --- | --- | --- |
| CRC16 标准向量 | 0x29B1 | "123456789" |
| 未提交标记 | 0xFFFF | 擦除值（可改小） |
| 已提交标记 | 0xA5A5 | 只清位，物理合法 |
| 示例 bss | 8192 B | 两个 4 KB 页缓冲 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm13-plat\n```\n\n\n\n```zhizhan-anchor\nm13-plat-t\n```\n\n\n\n## 13.3 三平台对照：存储\n\n\n\n三平台存储接口不同：F103/H7 用 HAL Flash 或寄存器；ESP32 用 NVS/SPIFFS。三份代码均已交叉编译。\n\n\n\nm13\\_storage.cC\n\n \n\n```text\n/* m13_storage.c — B05-M13 存储器与文件系统接口\n * 块设备抽象 + 掉电可恢复的追加日志（先写数据，最后写“有效”标志）。\n * 关键：区分“写入完成”和“已持久化”，靠提交标记而不是靠写返回判定。 */\n#include <stdint.h>\n#include <stddef.h>\n\ntypedef struct {\n    int      (*read)(uint32_t block, void *buf);\n    int      (*write)(uint32_t block, const void *buf);\n    int      (*erase)(uint32_t block);\n    uint32_t block_size;\n} blk_dev_t;\n\n/* 记录头：valid 用“魔数”做提交标记。\n * Flash 只能把位从 1 写成 0（擦除后为 0xFF）；所以“未提交”用擦除值 0xFFFF，\n * 提交时写 0xA5A5（在 0xFFFF 上只清位，合法）。\n * 陷阱：先写 0x0000 再改成 0xA5A5 是“置位”，在 Flash 上非法——\n * 这正是本示例第一版会踩的坑，也是理解掉电原子性的关键。 */\n#define LOG_VALID_MAGIC  0xA5A5u\n#define LOG_VALID_ERASED 0xFFFFu\ntypedef struct {\n    uint32_t seq;\n    uint32_t len;\n    uint16_t valid;     /* 0xFFFF=未提交（擦除态），0xA5A5=已提交 */\n    uint16_t crc;\n} log_hdr_t;\n\nstatic uint16_t crc16_ccitt(const uint8_t *p, uint32_t n)\n{\n    uint16_t crc = 0xFFFFu;\n    for (uint32_t i = 0u; i < n; ++i) {\n        crc ^= (uint16_t)p[i] << 8;\n        for (int b = 0; b < 8; ++b) {\n            crc = (crc & 0x8000u) ? (uint16_t)((crc << 1) ^ 0x1021u) : (uint16_t)(crc << 1);\n        }\n    }\n    return crc;\n}\n\n/* 写一条记录：块内布局 = [hdr][payload]。擦除后整块为 0xFF。 */\nint log_append(blk_dev_t *dev, uint32_t block, uint32_t seq,\n               const void *payload, uint32_t len)\n{\n    if (dev == NULL || len > dev->block_size - sizeof(log_hdr_t)) {\n        return -1;\n    }\n    if (dev->erase(block) != 0) {\n        return -2;\n    }\n    static uint8_t page[4096];\n    log_hdr_t *hdr = (log_hdr_t *)page;\n    hdr->seq   = seq;\n    hdr->len   = len;\n    hdr->valid = LOG_VALID_ERASED;    /* 擦除态=未提交，防掉电读到半成品 */\n    hdr->crc   = crc16_ccitt((const uint8_t *)payload, len);\n    const uint8_t *src = (const uint8_t *)payload;\n    for (uint32_t i = 0u; i < len; ++i) {\n        page[sizeof(log_hdr_t) + i] = src[i];\n    }\n    if (dev->write(block, page) != 0) {\n        return -3;                   /* 写入失败 */\n    }\n    /* 提交：把 valid 从 0xFFFF 写成 0xA5A5（只清位，Flash 允许）；掉电最多丢这一条 */\n    hdr->valid = LOG_VALID_MAGIC;\n    if (dev->write(block, page) != 0) {\n        return -4;\n    }\n    return 0;                        /* 返回 0 表示已提交；持久化仍以回读校验为准 */\n}\n\nint log_read(blk_dev_t *dev, uint32_t block, uint32_t *seq, uint32_t *len)\n{\n    static uint8_t page[4096];\n    if (dev->read(block, page) != 0) {\n        return -1;\n    }\n    const log_hdr_t *hdr = (const log_hdr_t *)page;\n    if (hdr->valid != LOG_VALID_MAGIC) {\n        return 1;                    /* 未提交记录：视为无效，跳过 */\n    }\n    *seq = hdr->seq;\n    *len = hdr->len;\n    return 0;\n}\n```\n\nSTM32F103 · 内部 Flash 日志\n\n\n\nesp\\_m13\\_storage.cC\n\n \n\n```text\n/* esp_m13_storage.c — ESP32 存储：分区表 + NVS/SPIFFS/LittleFS\n * 与 STM32 直接擦写 Flash 不同，ESP32 把 Flash 划分成多个分区，各挂不同文件系统。 */\n#include <stdint.h>\n#include <stddef.h>\n\n/* partitions.csv 里定义分区，例如：\n *   nvs,      data, nvs,     0x9000,  0x6000\n *   spiffs,   data, spiffs,  0x10000, 0x100000\n * 应用用 esp_partition_find_first 找到分区，再挂载文件系统。 */\ntypedef int esp_err_t;\ntypedef struct {\n    int      (*read)(uint32_t offset, void *buf, uint32_t len);\n    esp_err_t (*write)(uint32_t offset, const void *buf, uint32_t len);\n    esp_err_t (*erase_range)(uint32_t offset, uint32_t len);\n} esp_partition_t;\n\nextern esp_err_t nvs_flash_init(void);\nextern esp_err_t esp_vfs_spiffs_register(const void *cfg);   /* 或 esp_littlefs 挂载 */\n\n/* 键值参数用 NVS（内部自带磨损均衡与掉电安全）；大文件用 SPIFFS/LittleFS 分区 */\nesp_err_t esp_storage_init(void)\n{\n    esp_err_t a = nvs_flash_init();\n    if (a != 0) { return a; }\n    return esp_vfs_spiffs_register((const void *)0);\n}\n\n/* 追加日志的提交语义与 STM32/H7 相同：擦除态→提交魔数（只清位）。\n * ESP32 的 NVS 已经把这一步封装好了，多数场景不必自己写。 */\nint esp_log_commit(uint16_t *valid_word)\n{\n    if (valid_word == NULL || *valid_word != 0xFFFFu) { return -1; }\n    *valid_word = 0xA5A5u;\n    return 0;\n}\n```\n\nESP32 · NVS/分区\n\n\n\nh7\\_m13\\_storage.cC\n\n \n\n```text\n/* h7_m13_storage.c — STM32H7 存储：内部 Flash 扇区达 128KB；外扩常用 QUADSPI/OCTOSPI/FMC\n * 提交标记（擦除态 0xFFFF→0xA5A5）与 F1 同一逻辑；新增点是 cache 与擦写粒度更大。 */\n#include <stdint.h>\n#include <stddef.h>\n\ntypedef struct {\n    int      (*read)(uint32_t block, void *buf);\n    int      (*write)(uint32_t block, const void *buf);\n    int      (*erase)(uint32_t block);\n    uint32_t block_size;\n} h7_blk_dev_t;\n\n/* H7 内部 Flash 扇区 0..7 各 128KB；外扩 OCTOSPI NOR 常按 4KB 擦。\n * 无论哪种，掉电原子性都靠“擦除态→提交魔数”的只清位写法。 */\nint h7_log_commit(h7_blk_dev_t *dev, uint32_t block, uint16_t *valid_word)\n{\n    if (dev == NULL || valid_word == NULL) { return -1; }\n    if (*valid_word != 0xFFFFu) { return -2; }   /* 已被写过：需先擦除 */\n    *valid_word = 0xA5A5u;                        /* 只清位，合法 */\n    return dev->write(block, valid_word) == 0 ? 0 : -3;\n}\n\n/* 外扩 NOR/SDRAM 常用地址：0x90000000（OCTOSPI1）；0xC0000000（SDRAM via FMC） */\nuint32_t *h7_ext_nor_base(void) { return (uint32_t *)0x90000000u; }\n```\n\nSTM32H7 · Flash 日志\n\n\n\n表 13.3 三平台存储\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 存储 | 内部 Flash/NOR | NVS/SPIFFS/SD | 内部/外部 Flash |\n| 擦写 | 按页 | NVS 抽象 | 按扇区 |\n| 文件系统 | FATFS/LittleFS | SPIFFS/FATFS | FATFS/LittleFS |\n| 掉电 | 提交标记 | NVS 自带 | 提交标记 |"}
````



```zhizhan-anchor
m13-check
```



```zhizhan-anchor
m13-check-t
```



## 13.4 写入≠持久化与自检



写返回 0 只表示“发出去了”，是否持久化要以回读校验为准。自检覆盖擦/写/掉电三态：



```zhizhan-anchor
fig-图-13-2
```



**图 13.2**  记录三态：未写/未提交/已提交



```zhizhan-figure
<svg viewBox="0 0 800 110" width="100%" height="110" role="img" aria-label="记录三态：未写/未提交/已提交" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">valid</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">数据</text><text x="405" y="24" text-anchor="middle" class="sv-lbl-dim">状态</text><text x="12" y="50" class="sv-lbl">第一条</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">0xA5A5</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-box"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">完整</text><rect x="378" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="425" y="53" text-anchor="middle" class="sv-lbl-hi">有效</text><text x="12" y="78" class="sv-lbl">第二条(掉电)</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">0xFFFF</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">可能半条</text><rect x="378" y="66" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="425" y="81" text-anchor="middle" class="sv-lbl-hi">跳过</text></svg>
```



记录扫描时按 valid 字段判定：0xFFFF（未提交，跳过）、0xA5A5（有效）。掉电最多丢当前这条。



表 13.4 存储自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 擦写一致 | 写后回读 | 逐字节一致 |
| 掉电原子 | 未提交=0xFFFF | 该条被跳过 |
| 校验 | CRC16 向量 | =0x29B1 |
| 次数 | 日志轮换 | 单页不过写 |



```zhizhan-anchor
m13-pitfalls
```



```zhizhan-anchor
m13-pitfalls-t
```



## 13.5 常见误区与排障



失败路径与排障




- **把写入返回当成已持久化** ：掉电后数据可能未提交。

- **无提交标记** ：掉电得到半条记录，解析时崩溃。

- **忽略擦写次数** ：高频记录不轮换，单页很快写坏。

- **静态大缓冲** ：像示例一样吃 8 KB RAM，应用改流式/调用者缓冲。



◆ 自测 · Module 13（先答再看）




1. 为什么提交标记要“最后写”，而不是和数据一起写？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"若同时落盘，掉电可能得到“标记已写但数据不完整”。分离后，标记未写即视为无效，保证读到的是完整记录。"}
   ```

2. 为什么提交标记用 0xA5A5 而不是先写 0x0000 再改？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Flash 只能把 1 清成 0。“只清位”（0xFFFF→0xA5A5）物理合法；反过来置位做不到。所以未提交态用擦除值 0xFFFF，提交时只清位。"}
   ```

3. “写入返回 0”能说明数据已持久化吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能。0 只表示命令发出去了。是否持久化要以回读校验（含 CRC）为准。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用你板子的一块 Flash 做追加日志 \+ 提交标记，并做一次“掉电中断写入”的实验验证恢复。



核对与延伸：[littlefs 官方仓库](https://github.com/littlefs-project/littlefs)

 

动手练习



用内部 Flash 最后一页做追加日志：记录若干条后复位，验证能读回且未提交记录被跳过。



**检查结果：** 擦写后回读一致；掉电模拟（未提交=0xFFFF）时该条被跳过；提交值=0xA5A5，写入完成≠已持久化。

 

迁移练习：把本章的“能按介质擦写粒度抽象块设备，用提交标记实现掉电原子追加日志并回读校验。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 13 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m13","criterion":"擦写后回读一致；掉电模拟（未提交=0xFFFF）时该条被跳过；提交值=0xA5A5，写入完成≠已持久化。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
