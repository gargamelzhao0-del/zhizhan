/* h7_m04_log.c —— H7 大扇区日志与回放（Cortex-M7）。
 * 记录追加到扇区，用提交标记区分“写完”与“未写完”；导出时跳过未提交。 */
#include <stdint.h>
#include <stddef.h>
#include "app_api.h"
#include "stm32_app.h"

#define SECTOR_SIZE 131072u
typedef struct { uint32_t seq; int16_t v; uint32_t committed; } rec_t;

int h7_log_append(uint32_t offset, uint32_t seq, int16_t v) {
    if (offset + sizeof(rec_t) > SECTOR_SIZE) return -1;     /* 扇区边界 */
    rec_t r;
    r.seq = seq; r.v = v; r.committed = 0;
    if (storage_write(offset, &r, sizeof(r) - 4) != 0) return -2;
    r.committed = 0xA5A5A5A5u;
    return (int)storage_write(offset + offsetof(rec_t, committed), &r.committed, 4);
}
