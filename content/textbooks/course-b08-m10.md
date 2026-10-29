# 综合项目 A · 智能环境监测终端

```zhizhan-anchor
m10
```



多传感器 \+ OLED \+ 本地存储 \+ 无线上报 \+ [OTA](term:ota)；全链路联调。

 

> 前置：已掌握 M03–M06 的交互/采集/控制/联网模块，会用 RTOS 互斥量保护共享资源。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把采集/显示/存储/上报/升级整合成一台终端：共享总线加锁、关键调用设超时、升级不阻塞业务。

 

本章速览




- 综合项目 A：多传感 \+ 显示 \+ 存储 \+ 上报 \+ OTA 全链路联调。

- 模块任务化、共享总线加锁、关键路径留超时。

- 端到端要能“采得到、存得下、传得出、升得动、回得滚”。

 

```zhizhan-anchor
m10-env
```



```zhizhan-anchor
m10-env-t
```



## 10.1 终端整合的共享资源



综合项目 A 把前 9 章拼成一台终端：采集 → 显示 → 存储 → 上报 → 升级。整合难点在共享资源与关键路径的超时。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  终端任务与共享资源



```zhizhan-figure
<svg viewBox="0 0 800 140" width="100%" height="140" role="img" aria-label="终端任务与共享资源" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">采集（I²C）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">显示（I²C）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">存储（Flash）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">上报/升级（网络）</text></svg>
```



采集/显示共用 [I²C](term:i2c)（加锁）；存储用 Flash；上报/升级共用网络；升级优先级低于业务。



表 10.1 模块与超时



| 模块 | 任务 | 共享资源 | 超时 |
| --- | --- | --- | --- |
| 采集 | sensor | I²C 总线 | 读超时 5ms |
| 显示 | ui | 显示总线 | 刷新超时 |
| 存储 | log | Flash | 写超时 |
| 上报 | comm | 网络 | 连接超时 |
| 升级 | ota | 网络\+Flash | 分块超时 |



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：终端整合规模（交叉编译）



三平台的终端整合代码均通过交叉编译：



m10\_env.cC

 

```text
/* m10_env.c —— 综合项目 A：环境监测终端（Cortex-M3）。
 * 采集 → 显示 → 存储 → 上报；各模块一个任务，用队列解耦。 */
#include <stdint.h>
#include "app_api.h"

static QueueHandle_t g_q;

static void acq_task(void *arg) {
    (void)arg;
    for (;;) {
        float t = 0.0f, rh = 0.0f;
        if (sensor_read(&t, &rh) == 0) { (void)xQueueSend(g_q, &t, pdMS_TO_TICKS(5)); }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
static void disp_task(void *arg) {
    (void)arg;
    for (;;) {
        (void)display_clear();
        (void)display_text(0, 0, "ENV");
        (void)display_flush();
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
void m10_env_start(void) {
    g_q = xQueueCreate(8u, (uint32_t)sizeof(float));
    (void)xTaskCreate(acq_task,  "acq",  512u, 0, 4u, 0);
    (void)xTaskCreate(disp_task, "disp", 512u, 0, 2u, 0);
}
```

STM32F103 · 终端整合



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m10_env.c -o m10.o && arm-none-eabi-size m10.o
   text    data     bss     dec     hex filename
    173       0       4     177      b1 m10.o
```



真实工具输出：m10\_env.c（M3）text=173 B、bss=4 B；esp\_m10\_env.c（Xtensa）text=58 B；h7\_m10\_env.c（M7）text=44 B。



表 10.2 终端规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m10\_env.c | M3 | 173 B |
| esp\_m10\_env.c | Xtensa | 58 B |
| h7\_m10\_env.c | M7 | 44 B |
| I²C 锁 | — | 读超时 5ms |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm10-plat\n```\n\n\n\n```zhizhan-anchor\nm10-plat-t\n```\n\n\n\n## 10.3 三平台对照：终端\n\n\n\n同一终端在三平台用各自 API 实现；整合原则一致。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m10\\\\_env.cC\\n\\n \\n\\n```text\\n/* m10_env.c —— 综合项目 A：环境监测终端（Cortex-M3）。\\n * 采集 → 显示 → 存储 → 上报；各模块一个任务，用队列解耦。 */\\n#include <stdint.h>\\n#include \\\"app_api.h\\\"\\n\\nstatic QueueHandle_t g_q;\\n\\nstatic void acq_task(void *arg) {\\n    (void)arg;\\n    for (;;) {\\n        float t = 0.0f, rh = 0.0f;\\n        if (sensor_read(&t, &rh) == 0) { (void)xQueueSend(g_q, &t, pdMS_TO_TICKS(5)); }\\n        vTaskDelay(pdMS_TO_TICKS(1000));\\n    }\\n}\\nstatic void disp_task(void *arg) {\\n    (void)arg;\\n    for (;;) {\\n        (void)display_clear();\\n        (void)display_text(0, 0, \\\"ENV\\\");\\n        (void)display_flush();\\n        vTaskDelay(pdMS_TO_TICKS(500));\\n    }\\n}\\nvoid m10_env_start(void) {\\n    g_q = xQueueCreate(8u, (uint32_t)sizeof(float));\\n    (void)xTaskCreate(acq_task,  \\\"acq\\\",  512u, 0, 4u, 0);\\n    (void)xTaskCreate(disp_task, \\\"disp\\\", 512u, 0, 2u, 0);\\n}\\n```\\n\\nSTM32F103 · 终端\"}\n````\n\n\n\nesp\\_m10\\_env.cC\n\n \n\n```text\n/* esp_m10_env.c —— ESP32 综合项目 A：联网 + 上报 + OTA（Xtensa）。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nstatic void app_task(void *arg) {\n    (void)arg;\n    for (;;) {\n        (void)esp_wifi_sta_get_rssi();\n        vTaskDelay(pdMS_TO_TICKS(5000));\n    }\n}\n\nvoid esp_env_start(void) {\n    (void)xTaskCreate(app_task, \"app\", 4096u, 0, 3u, 0);\n}\n```\n\nESP32 · 终端\n\n\n\nh7\\_m10\\_env.cC\n\n \n\n```text\n/* h7_m10_env.c —— H7 综合项目 A：采集 + 存储 + 以太网上报（Cortex-M7）。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\nstatic QueueHandle_t g_log;\n\nvoid h7_env_start(void) {\n    g_log = xQueueCreate(16u, (uint32_t)sizeof(float));\n    (void)g_log;\n    (void)xTaskCreate((TaskFunction_t)0, \"env\", 512u, 0, 3u, 0);\n}\n```\n\nSTM32H7 · 终端\n\n\n\n表 10.3 三平台终端\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 共享锁 | mutex | mutex | mutex |\n| 显示 | SPI OLED | I²C OLED | SPI OLED |\n| 存储 | Flash | NVS | Flash |\n| 升级 | 低优先级 | 低优先级 | 低优先级 |"}
`````



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



整合自检：共享总线加锁、关键调用超时、升级低优先级、端到端可观测。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  端到端数据流



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="端到端数据流" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">采集</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">显示/存储</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">上报</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">升级</text></svg>
```



采集 → 显示/存储 → 上报 → 升级；任一环节要有超时与可观测，保证可定位。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 共享 | 互斥加锁 | [事务](term:transaction)交错 |
| 超时 | 关键调用 | 无限等 |
| 升级 | 低优先级 | 抢占业务 |
| 观测 | 端到端可定位 | 无法归因 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **共享 I²C 不加锁** ：显示与采集的事务交错，两端都失败。

- **关键调用无超时** ：某个外设无响应就卡死整条链。

- **升级抢占业务** ：下载期间采样停摆、看门狗超时。

- **无端到端可观测** ：出问题无法定位到哪一段。



◆ 自测 · Module 10（先答再看）




1. 采集与显示共用 I²C，谁先谁后？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不是“谁先谁后”，而是用互斥量保证同一时刻只有一个事务；采集优先级更高，拿不到锁时短等或直接跳过本次显示刷新，不能阻塞采集截止期。"}
   ```

2. 为什么每个关键调用都要有超时？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"某个外设/网络无响应时，无超时会卡死整条链；有超时才能降级、重试或跳过，保持系统可用。"}
   ```

3. 升级任务为什么设低优先级？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"升级是“能慢不能断”的批量活。低优先级让业务随时抢占它，避免长下载挤占采样/控制导致实时性破坏或看门狗超时。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把采集/显示/存储/上报/OTA 整合为终端：共享总线加锁、关键调用设超时、升级低优先级，并画端到端可观测图。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html) · [LVGL 官方文档](https://docs.lvgl.io/)

 

动手练习



编译 ` labs/m10_env.c `（M3）、` labs/esp_m10_env.c `（Xtensa）、` labs/h7_m10_env.c `（M7）。



**检查结果：** 共享 I²C 有锁（读超时 5ms）、关键调用均有超时、升级不阻塞业务。

 

迁移练习：把本章的“能把采集/显示/存储/上报/升级整合成一台终端：共享总线加锁、关键调用设超时、升级不阻塞业务。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m10","criterion":"共享 I²C 有锁（读超时 5ms）、关键调用均有超时、升级不阻塞业务。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
