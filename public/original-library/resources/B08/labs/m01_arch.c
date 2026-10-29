/* m01_arch.c —— 模块化架构：接口表 + 状态机（Cortex-M3）。
 * 先把模块抽象成 {init, poll} 接口，再决定前后台还是任务骨架；先画架构再写代码。 */
#include <stdint.h>
#include "app_api.h"

typedef struct { const char *name; int (*init)(void); int (*poll)(void); } module_t;

extern int sensor_mod_init(void);   extern int sensor_mod_poll(void);
extern int ui_mod_init(void);       extern int ui_mod_poll(void);
extern int comm_mod_init(void);     extern int comm_mod_poll(void);

static const module_t g_modules[] = {
    {"sensor", sensor_mod_init, sensor_mod_poll},
    {"ui",     ui_mod_init,     ui_mod_poll},
    {"comm",   comm_mod_init,   comm_mod_poll},
};

/* 前后台骨架：按“截止期从紧到松”排序后轮询；有硬期限后再升级为 RTOS（M10/M11） */
void app_superloop(void) {
    for (unsigned i = 0; i < sizeof(g_modules) / sizeof(g_modules[0]); i++) {
        if (g_modules[i].init) (void)g_modules[i].init();
    }
    for (;;) {
        for (unsigned i = 0; i < sizeof(g_modules) / sizeof(g_modules[0]); i++) {
            (void)g_modules[i].poll();
        }
    }
}
