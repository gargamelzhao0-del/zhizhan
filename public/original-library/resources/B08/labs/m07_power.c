/* m07_power.c —— 功耗预算表与续航估算（Cortex-M3）。
 * 平均电流 = Σ(工作电流 × 占空比)。先算表，再优化最重的一项。 */
#include <stdint.h>
#include "app_api.h"

typedef struct { const char *name; uint32_t ua; uint32_t duty_permille; } pitem_t;

static const pitem_t g_budget[] = {
    {"mcu", 3000, 50}, {"radio", 20000, 5}, {"sensor", 500, 10}, {"sleep", 5, 1000},
};

uint32_t power_avg_ua(void) {
    uint64_t s = 0;
    for (unsigned i = 0; i < sizeof(g_budget) / sizeof(g_budget[0]); i++)
        s += (uint64_t)g_budget[i].ua * g_budget[i].duty_permille;
    return (uint32_t)(s / 1000u);
}

uint32_t power_life_days(uint32_t cap_mah) {
    uint32_t ua = power_avg_ua();
    if (ua == 0) return 0;
    return (uint32_t)((uint64_t)cap_mah * 1000u / ua / 24u);
}
