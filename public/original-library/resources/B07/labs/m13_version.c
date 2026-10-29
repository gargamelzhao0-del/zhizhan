/* m13_version.c —— 镜像/协议版本比较与升级准入（Cortex-M3）。
 * 版本用整型打包（如高 16 位主版本、低 16 位次版本）便于比较；
 * 升级准入规则：不降级、跨度过大先迁移。 */
#include <stdint.h>
#include "comm_api.h"

int ver_cmp(uint32_t a, uint32_t b) { return a < b ? -1 : (a > b ? 1 : 0); }

/* 返回 1=允许，0=不升（同版或更旧），-1=需先迁移到最低兼容版本 */
int upgrade_allowed(uint32_t cur, uint32_t img, uint32_t min_from) {
    if (img <= cur) return 0;          /* 不允许降级/同版 */
    if (cur < min_from) return -1;     /* 跨度过大：先做参数迁移 */
    return 1;
}
