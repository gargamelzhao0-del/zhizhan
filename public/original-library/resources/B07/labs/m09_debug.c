/* m09_debug.c —— 链路统计与总线负载（Cortex-M3）。
 * 现场诊断先看三类计数：CRC 错、超时、总线关闭；再算总线负载是否过高。 */
#include <stdint.h>
#include "comm_api.h"

typedef struct { uint32_t crc_err; uint32_t timeout; uint32_t bus_off; uint32_t frames; } link_stat_t;

void link_stat_frame(link_stat_t *s, int crc_ok) {
    s->frames++;
    if (!crc_ok) s->crc_err++;
}

int bus_load_permille(uint32_t fps, uint32_t bits_per_frame, uint32_t bitrate) {
    return (int)(((uint64_t)fps * bits_per_frame * 1000u) / bitrate);
}

/* 错误率超过阈值就应告警/降速 */
int link_should_alert(const link_stat_t *s, int permille_threshold) {
    if (s->frames == 0) return 0;
    return (int)(s->crc_err * 1000u / s->frames) > permille_threshold;
}
