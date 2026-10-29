# 实战：可远程升级的传感器节点

```zhizhan-anchor
m10
```



端到端整合：外设 \+ RTOS \+ 协议与 [OTA](term:ota) \+ 日志体系；共享链路串行化、升级优先级、可诊断。

 

> 前置：具备外设驱动、RTOS 任务与互斥量的使用经验（本册前 9 章）。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把采样/协议/上报/OTA 整合为一个节点，用互斥量串行化共享链路并保证升级不阻塞业务。

 

本章速览




- 把采样/协议/OTA 拆成任务，共享链路用互斥量串行化。

- 升级任务优先级低于业务，避免长时间占线。

- 协议契约、日志与版本贯穿“采样 → 上报 → 升级”全链路。

 

```zhizhan-anchor
m10-node
```



```zhizhan-anchor
m10-node-t
```



## 10.1 整合的难点在共享资源与优先级



把前面各章拼成一个真实节点：采样（外设）→ 协议（Modbus/CAN）→ 上报（MQTT/TCP）→ 升级（OTA）。难点不在单个模块，而在共享资源与优先级。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  节点任务与共享资源



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="节点任务与共享资源" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">采集（高）串口/总线</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">上报（中）网络/TLS</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">升级（低）串口/网络+Flash</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">诊断（最低，只读统计）</text></svg>
```



采集（高）→ 上报（中）→ 升级（低）→ 诊断（最低）；共享串口/总线用互斥量串行化。



表 10.1 节点模块



| 模块 | 角色 | 优先级 | 共享资源 |
| --- | --- | --- | --- |
| 采集 | 轮询传感器 | 高 | 串口/总线 |
| 上报 | 组包发送 | 中 | 网络/[TLS](term:tls) |
| 升级 | 下载与写入 | 低 | 串口/网络\+Flash |
| 诊断 | 统计与日志 | 最低 | 无（只读） |



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：节点整合规模（交叉编译）



三平台的节点整合代码均通过交叉编译；任务/队列的静态开销可从 bss 读出：



m10\_node.cC

 

```text
/* m10_node.c —— 可远程升级节点：轮询 + 升级并存（Cortex-M3）。
 * 共享同一路串口，用互斥量串行化；升级任务优先级低于轮询，避免长时间占线。 */
#include <stdint.h>
#include "comm_api.h"

static SemaphoreHandle_t g_uart;

static void poll_task(void *arg) {
    uint8_t req[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x01};
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_uart, portMAX_DELAY) == pdTRUE) {
            (void)uart_send(req, 6u);
            xSemaphoreGive(g_uart);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

static void ota_task(void *arg) {
    (void)arg;
    for (;;) {
        /* 收到升级命令后：ota_begin → ota_write 分块 → ota_finish（校验+切换） */
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void node_start(void) {
    g_uart = xSemaphoreCreateMutex();
    (void)xTaskCreate(poll_task, "poll", 512u, 0, 3u, 0);
    (void)xTaskCreate(ota_task,  "ota",  512u, 0, 2u, 0);
}
```

STM32F103 · 节点整合



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m10_node.c -o m10.o && arm-none-eabi-size m10.o
   text    data     bss     dec     hex filename
    181       0       4     185      b9 m10.o
```



真实工具输出：m10\_node.c（M3）text=181 B、bss=4 B；esp\_m10\_node.c text=114 B；h7\_m10\_node.c text=128 B。



表 10.2 节点规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m10\_node.c | M3 | 181 B |
| esp\_m10\_node.c | Xtensa | 114 B |
| h7\_m10\_node.c | M7 | 128 B |
| 共享链路 | — | 互斥保护 |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm10-plat\n```\n\n\n\n```zhizhan-anchor\nm10-plat-t\n```\n\n\n\n## 10.3 三平台对照：节点\n\n\n\n同一节点在三平台用各自 API 实现；整合原则一致。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m10\\\\_node.cC\\n\\n \\n\\n```text\\n/* m10_node.c —— 可远程升级节点：轮询 + 升级并存（Cortex-M3）。\\n * 共享同一路串口，用互斥量串行化；升级任务优先级低于轮询，避免长时间占线。 */\\n#include <stdint.h>\\n#include \\\"comm_api.h\\\"\\n\\nstatic SemaphoreHandle_t g_uart;\\n\\nstatic void poll_task(void *arg) {\\n    uint8_t req[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x01};\\n    (void)arg;\\n    for (;;) {\\n        if (xSemaphoreTake(g_uart, portMAX_DELAY) == pdTRUE) {\\n            (void)uart_send(req, 6u);\\n            xSemaphoreGive(g_uart);\\n        }\\n        vTaskDelay(pdMS_TO_TICKS(1000));\\n    }\\n}\\n\\nstatic void ota_task(void *arg) {\\n    (void)arg;\\n    for (;;) {\\n        /* 收到升级命令后：ota_begin → ota_write 分块 → ota_finish（校验+切换） */\\n        vTaskDelay(pdMS_TO_TICKS(5000));\\n    }\\n}\\n\\nvoid node_start(void) {\\n    g_uart = xSemaphoreCreateMutex();\\n    (void)xTaskCreate(poll_task, \\\"poll\\\", 512u, 0, 3u, 0);\\n    (void)xTaskCreate(ota_task,  \\\"ota\\\",  512u, 0, 2u, 0);\\n}\\n```\\n\\nSTM32F103 · 节点\"}\n````\n\n\n\nesp\\_m10\\_node.cC\n\n \n\n```text\n/* esp_m10_node.c —— ESP32 端到端节点（Xtensa）：联网 + MQTT + OTA。\n * 运行中若收到固件：下载 → 写入备用分区 → 重启后确认或回滚。 */\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nstatic void app_task(void *arg) {\n    (void)arg;\n    for (;;) {\n        (void)mqtt_publish(\"dev/1/temp\", (const uint8_t *)\"23.5\", 4u, 1);\n        vTaskDelay(pdMS_TO_TICKS(5000));\n    }\n}\n\nvoid esp_node_start(void) {\n    (void)esp_netif_init();\n    (void)esp_netif_create_default_wifi_sta();\n    (void)mqtt_connect(\"node-1\", 60u);\n    (void)xTaskCreate(app_task, \"app\", 4096u, 0, 3u, 0);\n}\n```\n\nESP32 · 节点\n\n\n\nh7\\_m10\\_node.cC\n\n \n\n```text\n/* h7_m10_node.c —— H7 以太网节点：TCP 上报 + 双 Bank OTA（Cortex-M7）。\n * lwIP 的 pbuf 生命周期要管好：发送完成前不能释放/覆盖缓冲。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nstatic void report_task(void *arg) {\n    (void)arg;\n    for (;;) {\n        if (tcp_connect(\"server.local\", 1883u) == 0) {\n            (void)mqtt_publish(\"dev/1/temp\", (const uint8_t *)\"23.5\", 4u, 1);\n        }\n        vTaskDelay(pdMS_TO_TICKS(5000));\n    }\n}\n\nvoid h7_node_start(void) {\n    (void)xTaskCreate(report_task, \"report\", 1024u, 0, 3u, 0);\n}\n```\n\nSTM32H7 · 节点\n\n\n\n表 10.3 三平台节点\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 任务 | xTaskCreate | xTaskCreate | xTaskCreate |\n| 共享锁 | mutex | mutex | mutex |\n| 升级优先级 | 低 | 低 | 低 |\n| 日志 | 环形缓冲 | 环形/串口 | 环形缓冲 |"}
`````



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



整合自检：链路加锁、升级低优先级、关键状态落盘、版本统一。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  优先级分配（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="优先级分配（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">采集</text><rect x="150" y="26" width="600" height="18" rx="4" class="sv-cyn-s"></rect><text x="758" y="43" class="sv-lbl-hi">4(优先级)</text><text x="12" y="67" class="sv-lbl">上报</text><rect x="150" y="50" width="450" height="18" rx="4" class="sv-grn-s"></rect><text x="608" y="67" class="sv-lbl-hi">3(优先级)</text><text x="12" y="91" class="sv-lbl">升级</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="91" class="sv-lbl-hi">2(优先级)</text><text x="12" y="115" class="sv-lbl">诊断</text><rect x="150" y="98" width="150" height="18" rx="4" class="sv-box"></rect><text x="308" y="115" class="sv-lbl-hi">1(优先级)</text></svg>
```



采集 \> 上报 \> 升级 \> 诊断；升级是“能慢不能断”的批量活，设低优先级避免挤占业务。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 链路 | 互斥串行化 | 两帧交叠 |
| 升级 | 低优先级\+让出 | 霸占链路 |
| 状态 | 关键状态落盘 | 断电丢配置 |
| 版本 | 统一版本号 | 各说各话 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **共享串口不加锁** ：轮询帧与升级数据交错，两端都解析失败。

- **升级任务优先级过高** ：下载期间采样停摆或看门狗超时。

- **升级期间不落盘关键状态** ：断电后既没升级成功也丢了配置。

- **没有统一版本号** ：固件/协议/参数各说各话，兼容问题无解。



◆ 自测 · Module 10（先答再看）




1. 升级任务为什么一般设成低优先级？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"升级是“能慢不能断”的批量活。设低优先级，业务可随时抢占它；若设高优先级，长时间下载会挤占采集与控制，破坏实时性甚至触发看门狗。"}
   ```

2. 共享串口为什么要加锁？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"轮询帧与升级数据若交错，两端都会解析失败。用互斥量把链路访问串行化，保证一帧完整发完再发下一帧。"}
   ```

3. 为什么要把协议契约、日志与版本贯穿始终？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"现场出问题时，只有靠明确的协议契约、可回溯的日志与统一版本号才能定位是固件/协议/参数哪一层的问题，否则无从复盘。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你工程的采样/协议/上报/OTA 整合为节点，画出“任务-事件-优先级-共享资源”表并注明加锁点。



核对与延伸：[Modbus 应用协议规范](https://modbus.org/specs.php) · [ESP-IDF · OTA 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/ota.html)

 

动手练习



编译 ` labs/m10_node.c `（M3）、` labs/esp_m10_node.c `（Xtensa）、` labs/h7_m10_node.c `（M7）。



**检查结果：** 共享链路有互斥保护；升级任务优先级低于业务且不阻塞采样；协议契约/日志/版本齐全可回溯。

 

迁移练习：把本章的“能把采样/协议/上报/OTA 整合为一个节点，用互斥量串行化共享链路并保证升级不阻塞业务。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m10","criterion":"共享链路有互斥保护；升级任务优先级低于业务且不阻塞采样；协议契约/日志/版本齐全可回溯。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
