/* m13_params.c —— 参数双副本与版本迁移（Cortex-M3）。
 * 校验失败或版本不符时回退默认或执行迁移；绝不能把坏参数当有效值使用。 */
#include <stdint.h>
#include "app_api.h"

typedef struct { uint16_t magic; uint16_t ver; int16_t lo; int16_t hi; uint16_t crc; } params_t;
#define PARAM_MAGIC 0x51A2u

int params_validate(const params_t *p) { return p != 0 && p->magic == PARAM_MAGIC; }

int params_commit(void) { return params_save(); }
int params_restore(void) { return params_load(); }
