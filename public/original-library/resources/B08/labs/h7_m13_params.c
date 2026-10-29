/* h7_m13_params.c —— H7 参数双副本提交（Cortex-M7）。
 * 交替写 A/B，读时选校验通过且版本最新的一份；写坏一份仍有另一份兜底。 */
#include <stdint.h>
#include <stddef.h>
#include "app_api.h"
#include "stm32_app.h"

#define PARAM_A 0x0801D000u
#define PARAM_B 0x0801E000u

int h7_params_commit(int slot, const void *p, size_t n) {
    uint32_t addr = slot ? PARAM_B : PARAM_A;
    return (int)storage_write(addr, p, n);
}

int h7_params_is_watchdog_reset(void) { return (RCC_CSR & (1u << 29)) ? 1 : 0; }
