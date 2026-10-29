/* m15_accept.c —— 产品级验收断言（Cortex-M3）。
 * 把“能交付”变成可测阈值：资源占用、保护状态、可维护性都要能自动判。 */
#include <stdint.h>
#include "app_api.h"

typedef struct { uint32_t used; uint32_t total; } budget_t;

int accept_ram_ok(budget_t b)   { return (uint64_t)b.used * 100u <= (uint64_t)b.total * 70u; }  /* RAM ≤ 70% */
int accept_flash_ok(budget_t b) { return (uint64_t)b.used * 100u <= (uint64_t)b.total * 80u; }  /* Flash ≤ 80% */

/* 保护状态：故障时输出必须为 0 */
int accept_fault_output_zero(int fault, int pwm_out) { return fault ? (pwm_out == 0) : 1; }
