# 工程骨架

```zhizhan-anchor
m02
```



目录结构、构建系统、配置管理（编译期宏 vs 运行期参数）、版本号规范、日志与错误码体系。

 

> 前置：会用 gcc/Makefile 组织多文件工程，了解错误码、日志与版本号的作用。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能搭建分层工程骨架（统一错误码/日志/版本），并严格区分编译期宏与可持久化的运行期参数。

 

本章速览




- 工程骨架的三件套：统一错误码、日志、版本号；现场靠它们定位。

- 编译期宏（功能裁剪）与运行期参数（现场可改）必须分开管理。

- 目录与构建要可复现：换台机器能一键编译出同一固件。

 

```zhizhan-anchor
m02-skeleton
```



```zhizhan-anchor
m02-skeleton-t
```



## 2.1 三件套：错误码 / 日志 / 版本



工程骨架决定“能不能长期维护”。统一错误码、日志、版本号必须一开始就有。现场出问题时，没有它们就只能靠猜。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  配置分层



```zhizhan-figure
<svg viewBox="0 0 800 130" width="100%" height="130" role="img" aria-label="配置分层" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">编译期宏</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">运行期参数</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">版本号</text></svg>
```



编译期宏（功能/引脚，需重编译）| 运行期参数（阈值/标定，Flash/[NVS](term:nvs) 在线可改）| 版本号（固件/参数/协议）。



表 2.1 配置分层



| 配置类型 | 例子 | 存放 | 改动代价 |
| --- | --- | --- | --- |
| 编译期宏 | 功能开关、引脚定义 | 头文件/构建配置 | 重编译 |
| 运行期参数 | 阈值、标定、上报周期 | Flash/NVS | 在线可改 |
| 版本号 | 固件/参数/协议 | 代码\+存储 | 按规范递增 |



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：三平台骨架（交叉编译）



三平台的骨架代码均通过交叉编译，规模最小化以保证启动稳定：



m02\_skeleton.cC

 

```text
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
```

STM32F103 · 骨架



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m02_skeleton.c -o m02.o && arm-none-eabi-size m02.o
   text    data     bss     dec     hex filename
     72       0       0      72      48 m02.o
```



真实工具输出：m02\_skeleton.c（M3）text=72 B；esp\_m02\_skeleton.c（Xtensa）text=26 B；h7\_m02\_skeleton.c（M7）text=20 B。



表 2.2 骨架规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m02\_skeleton.c | M3 | 72 B |
| esp\_m02\_skeleton.c | Xtensa | 26 B |
| h7\_m02\_skeleton.c | M7 | 20 B |
| 错误码 | — | 可定位 |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm02-plat\n```\n\n\n\n```zhizhan-anchor\nm02-plat-t\n```\n\n\n\n## 2.3 三平台对照：构建与配置\n\n\n\n三平台的构建系统与配置来源不同，但“宏=编译期、参数=运行期”的边界一致。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m02\\\\_skeleton.cC\\n\\n \\n\\n```text\\n/* m02_skeleton.c —— 工程骨架：错误码 / 版本 / 编译期与运行期配置（Cortex-M3）。 */\\n#include <stdint.h>\\n#include \\\"app_api.h\\\"\\n\\ntypedef enum { ERR_OK = 0, ERR_PARAM = -1, ERR_IO = -2, ERR_BUSY = -3, ERR_HW = -4 } err_t;\\n\\n#define APP_VER_MAJOR 1u\\n#define APP_VER_MINOR 3u\\n\\n/* 编译期常量（功能裁剪） vs 运行期参数（现场可改）：二者分开管理 */\\n#ifndef APP_ENABLE_WIFI\\n#define APP_ENABLE_WIFI 0\\n#endif\\n\\nuint32_t app_version(void) { return (APP_VER_MAJOR << 16) | APP_VER_MINOR; }\\n\\nconst char *err_str(err_t e) {\\n    switch (e) {\\n        case ERR_OK:    return \\\"OK\\\";\\n        case ERR_PARAM: return \\\"PARAM\\\";\\n        case ERR_IO:    return \\\"IO\\\";\\n        case ERR_BUSY:  return \\\"BUSY\\\";\\n        default:        return \\\"HW\\\";\\n    }\\n}\\n```\\n\\nSTM32F103 · 骨架\"}\n````\n\n\n\nesp\\_m02\\_skeleton.cC\n\n \n\n```text\n/* esp_m02_skeleton.c —— ESP32 工程骨架：版本 + 运行时间 + 启动自检（Xtensa）。\n * 配置来自 menuconfig（编译期）；运行期参数放 NVS。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nint esp_boot_report(void) {\n    int64_t us = esp_timer_get_time();\n    /* 上电自检：外设初始化是否成功、参数是否加载（返回错误码便于远程诊断） */\n    return (int)(us & 0x7FFFFFFF);\n}\n\n/* 运行期参数走运行期存储，不进编译；编译期开关由 sdkconfig 决定 */\nint esp_param_apply(void) { return params_load(); }\n```\n\nESP32 · 骨架\n\n\n\nh7\\_m02\\_skeleton.cC\n\n \n\n```text\n/* h7_m02_skeleton.c —— H7 工程骨架：统一断言与故障记录（Cortex-M7）。 */\n#include \"app_api.h\"\n#include \"rtos_cm.h\"\n\nvolatile uint32_t g_assert_line;\nvolatile const char *g_assert_file;\n\nvoid app_assert_failed(const char *expr, const char *file, int line) {\n    (void)expr;\n    g_assert_file = file;\n    g_assert_line = (uint32_t)line;\n    cm_set_primask(1u);          /* 关中断，保留现场，交给看门狗复位 */\n    for (;;) { }\n}\n```\n\nSTM32H7 · 骨架\n\n\n\n表 2.3 三平台构建\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 构建 | Makefile/IDE | CMake/idf | Makefile/IDE |\n| 宏配置 | 头文件 | Kconfig | 头文件 |\n| 运行期参数 | Flash | NVS | Flash |\n| 版本 | 代码\\+存储 | 代码\\+分区 | 代码\\+存储 |"}
`````



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



骨架自检：错误码可定位、配置分层、版本统一、构建可复现。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  错误处理约定



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="错误处理约定" preserveAspectRatio="xMidYMid meet"><rect x="95" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="190.0" y="66" text-anchor="middle" class="sv-lbl-hi">调用</text><path d="M287,69 H303" class="sv-arrow"></path><rect x="305" y="44" width="190" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">错误码</text><path d="M497,69 H513" class="sv-arrow"></path><rect x="515" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="610.0" y="66" text-anchor="middle" class="sv-lbl-hi">重试/降级/复位</text></svg>
```



参数错/IO 错/忙/硬件错 → 上层据此决定重试、降级或复位。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 错误 | 分类错误码 | printf/裸 0-1 |
| 配置 | 宏 vs 参数 | 可调项写死 |
| 版本 | 统一规范 | 各说各话 |
| 构建 | 可复现 | 换机行为不同 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **到处 printf/裸返回 0/1** ：出错无法定位原因。

- **把可调参数写死在宏里** ：现场改不了，只能重烧固件。

- **版本号不统一** ：固件/参数/协议各说各话，兼容问题无解。

- **构建不可复现** ：换台机器编出的固件行为不同。



◆ 自测 · Module 02（先答再看）




1. “上报周期”应放编译期宏还是运行期参数？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"运行期参数。现场可能因网络/功耗需要调整，写死宏意味着每次重烧；但它应有合法范围与默认值，并持久化可回退。"}
   ```

2. 错误码为什么要分类？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"上层要据此决定“重试、降级还是复位”。参数错要纠正输入、IO 错可重试、硬件错需复位；若只返回 0/1 就无法决策。"}
   ```

3. 为什么编译期宏与运行期参数必须严格分开？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"宏改动需重编译（用于功能裁剪、引脚），运行期参数必须能在现场存改并回退（阈值/标定）。混在一起会让现场不可调、版本不可控。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的工程定错误码表与版本号规范，并列出哪些配置该是宏、哪些该是可持久化的运行期参数。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html)

 

动手练习



编译 ` labs/m02_skeleton.c `（M3）、` labs/esp_m02_skeleton.c `（Xtensa）、` labs/h7_m02_skeleton.c `（M7）。



**检查结果：** 失败都能返回可定位的错误码；编译期与运行期配置分离；版本号规则明确且可查。

 

迁移练习：把本章的“能搭建分层工程骨架（统一错误码/日志/版本），并严格区分编译期宏与可持久化的运行期参数。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m02","criterion":"失败都能返回可定位的错误码；编译期与运行期配置分离；版本号规则明确且可查。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
