/* esp_m11_rm.c —— 利用率与 RM 界的速查（ESP32 / Xtensa）。
 * 任务按周期升序 = 优先级降序；先算 U=ΣC/T，再对最低优先级做响应时间分析。 */
#include <stdint.h>
#include "rtos_api.h"

/* 例：C/T = (1,2),(1,3),(1,9)，U=0.944 > 界 0.780，但 R=(1,2,6) 均 ≤ 周期 → 可调度 */
void esp_m11_table(void) {
    const uint32_t C[3] = {1u, 1u, 1u};
    const uint32_t T[3] = {2u, 3u, 9u};
    uint32_t u_milli = 0u;
    for (int i = 0; i < 3; i++) { u_milli += (C[i] * 1000u) / T[i]; }
    (void)u_milli;      /* 上板可打印核对：应为 944‰ */
}
