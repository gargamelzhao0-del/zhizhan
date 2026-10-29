/* h7_m11_rm.c —— 响应时间分析（STM32H7 / Cortex-M7）。
 * R_i = C_i + Σ_{j<i} ceil(R_i / T_j)·C_j，迭代到不动点；R_i ≤ T_i 才可调度。 */
#include <stdint.h>

static uint32_t ceil_div(uint32_t a, uint32_t b) { return (a + b - 1u) / b; }

int h7_rm_schedulable(const uint32_t *C, const uint32_t *T, unsigned n) {
    for (unsigned i = 0; i < n; i++) {
        uint32_t R = C[i];
        for (unsigned guard = 0; guard < 10000u; guard++) {
            uint32_t nr = C[i];
            for (unsigned j = 0; j < i; j++) { nr += ceil_div(R, T[j]) * C[j]; }
            if (nr == R) { break; }
            R = nr;
            if (R > T[i]) { return 0; }
        }
        if (R > T[i]) { return 0; }
    }
    return 1;
}
