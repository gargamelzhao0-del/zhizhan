/* m04_log.c —— 环形日志落盘与掉电提交（Cortex-M3）。
 * 先写记录，再写提交标记；掉电中断只会丢弃最后一条未提交记录。 */
#include <stdint.h>
#include "app_api.h"

#define LOG_BASE 0x0801F000u
typedef struct { uint8_t seq; int16_t v; uint8_t committed; } rec_t;

int log_append(uint8_t seq, int16_t v) {
    rec_t r;
    r.seq = seq; r.v = v; r.committed = 0;
    if (storage_write(LOG_BASE, &r, 3) != 0) return -1;      /* 写记录 */
    uint8_t c = 1;
    if (storage_write(LOG_BASE + 2, &c, 1) != 0) return -2;  /* 写提交标记 */
    return (int)storage_sync();
}
