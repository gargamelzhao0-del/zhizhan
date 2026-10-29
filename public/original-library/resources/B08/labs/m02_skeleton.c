/* m02_skeleton.c —— 工程骨架：错误码 / 版本 / 编译期与运行期配置（Cortex-M3）。 */
#include <stdint.h>
#include "app_api.h"

typedef enum { ERR_OK = 0, ERR_PARAM = -1, ERR_IO = -2, ERR_BUSY = -3, ERR_HW = -4 } err_t;

#define APP_VER_MAJOR 1u
#define APP_VER_MINOR 3u

/* 编译期常量（功能裁剪） vs 运行期参数（现场可改）：二者分开管理 */
#ifndef APP_ENABLE_WIFI
#define APP_ENABLE_WIFI 0
#endif

uint32_t app_version(void) { return (APP_VER_MAJOR << 16) | APP_VER_MINOR; }

const char *err_str(err_t e) {
    switch (e) {
        case ERR_OK:    return "OK";
        case ERR_PARAM: return "PARAM";
        case ERR_IO:    return "IO";
        case ERR_BUSY:  return "BUSY";
        default:        return "HW";
    }
}
