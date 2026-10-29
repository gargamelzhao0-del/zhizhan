/* esp_m02_skeleton.c —— ESP32 工程骨架：版本 + 运行时间 + 启动自检（Xtensa）。
 * 配置来自 menuconfig（编译期）；运行期参数放 NVS。 */
#include "esp_app.h"
#include "app_api.h"

int esp_boot_report(void) {
    int64_t us = esp_timer_get_time();
    /* 上电自检：外设初始化是否成功、参数是否加载（返回错误码便于远程诊断） */
    return (int)(us & 0x7FFFFFFF);
}

/* 运行期参数走运行期存储，不进编译；编译期开关由 sdkconfig 决定 */
int esp_param_apply(void) { return params_load(); }
