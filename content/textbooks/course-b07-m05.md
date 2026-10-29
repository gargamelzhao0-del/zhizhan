# 无线通信

```zhizhan-anchor
m05
```



BLE（GATT/连接参数/低功耗广播）、LoRa（扩频因子/占空比/链路预算）、WiFi（配网/重连/RSSI）；三者权衡。

 

> 前置：了解 BLE/LoRa/WiFi 的基本用途与 MCU 功耗、射频概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按距离/速率/功耗为场景选择无线技术，并配置 BLE 连接参数、LoRa 占空比与 WiFi 重连。

 

本章速览




- 按距离/功耗/带宽选型：BLE 短距低功耗、LoRa 远距低速率、WiFi 高带宽高功耗。

- BLE 数据模型是 GATT；连接参数(interval/latency)决定功耗与延迟。

- LoRa 要守占空比；WiFi 要看 RSSI 并做退避重连。

 

```zhizhan-anchor
m05-wireless
```



```zhizhan-anchor
m05-wireless-t
```



## 5.1 距离/速率/功耗的三角权衡



无线选型是三件事的权衡：距离、速率、功耗。没有一种无线同时占优，先明确场景再选。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  三种无线的距离-功耗权衡（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="三种无线的距离-功耗权衡（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">BLE 距离</text><rect x="150" y="26" width="6" height="18" rx="4" class="sv-cyn-s"></rect><text x="164" y="43" class="sv-lbl-hi">10(相对距离)</text><text x="12" y="67" class="sv-lbl">WiFi 距离</text><rect x="150" y="50" width="29" height="18" rx="4" class="sv-amb-s"></rect><text x="187" y="67" class="sv-lbl-hi">50(相对距离)</text><text x="12" y="91" class="sv-lbl">LoRa 距离</text><rect x="150" y="74" width="571" height="18" rx="4" class="sv-grn-s"></rect><text x="729" y="91" class="sv-lbl-hi">1000(相对距离)</text></svg>
```



BLE 近距低功耗、LoRa 远距极低速率、WiFi 高速高功耗；按场景取其一或组合。



表 5.1 无线选型



| 无线 | 距离 | 速率 | 功耗 | 典型用途 |
| --- | --- | --- | --- | --- |
| BLE | ~10m | 中 | 低 | 手机配网、可穿戴 |
| LoRa | 公里级 | 极低 | 低(占空比受限) | 远程抄表、环境监测 |
| WiFi | ~50m | 高 | 高 | 网关、视频、固件下载 |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：三平台无线配置（交叉编译）



三种无线的配置代码在三平台实现不同，但都能通过交叉编译：



m05\_ble.cC

 

```text
/* m05_ble.c —— 外挂 BLE 透传模组（Cortex-M3）。
 * 用 AT 指令复位并开启广播，随后进入透传：应用只管收发串口。 */
#include <stdint.h>
#include <string.h>
#include "comm_api.h"

static const char *AT_RESET = "AT+RST\r\n";
static const char *AT_ADV   = "AT+ADV=1\r\n";

int ble_module_start(void) {
    (void)uart_send((const uint8_t *)AT_RESET, strlen(AT_RESET));
    (void)uart_send((const uint8_t *)AT_ADV, strlen(AT_ADV));
    return 0;   /* 之后按透传模式收发 */
}
```

STM32F103 · BLE 配置



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m05_ble.c -o m05.o && arm-none-eabi-size m05.o
   text    data     bss     dec     hex filename
     52       0       0      52      34 m05.o
```



真实交叉编译：m05\_ble.c（M3）text=52 B；esp\_m05\_wifi.c 与 h7\_m05\_lora.c 亦通过。



表 5.2 三平台无线规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m05\_ble.c | M3 | 52 B |
| esp\_m05\_wifi.c | Xtensa | 42 B |
| h7\_m05\_lora.c | M7 | 127 B |
| 结论 | — | 三平台均可编译 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm05-plat\n```\n\n\n\n```zhizhan-anchor\nm05-plat-t\n```\n\n\n\n## 5.3 三平台对照：无线的落地差异\n\n\n\n同一件事在三平台用不同栈/模组：BLE、WiFi、LoRa 各有配置与功耗策略。\n\n\n\nm05\\_ble.cC\n\n \n\n```text\n/* m05_ble.c —— 外挂 BLE 透传模组（Cortex-M3）。\n * 用 AT 指令复位并开启广播，随后进入透传：应用只管收发串口。 */\n#include <stdint.h>\n#include <string.h>\n#include \"comm_api.h\"\n\nstatic const char *AT_RESET = \"AT+RST\\r\\n\";\nstatic const char *AT_ADV   = \"AT+ADV=1\\r\\n\";\n\nint ble_module_start(void) {\n    (void)uart_send((const uint8_t *)AT_RESET, strlen(AT_RESET));\n    (void)uart_send((const uint8_t *)AT_ADV, strlen(AT_ADV));\n    return 0;   /* 之后按透传模式收发 */\n}\n```\n\nSTM32F103 · BLE\n\n\n\nesp\\_m05\\_wifi.cC\n\n \n\n```text\n/* esp_m05_wifi.c —— 内置 WiFi 联网与 RSSI（ESP32 / Xtensa）。\n * 初始化 netif → 启动 WiFi → 配置 SSID → 连接；RSSI 用于链路质量评估与重连决策。 */\n#include \"esp_comm.h\"\n\nstatic wifi_config_t g_cfg = { .ssid = \"lab-ap\", .password = \"12345678\" };\n\nvoid esp_wifi_up(void) {\n    (void)esp_netif_init();\n    (void)esp_netif_create_default_wifi_sta();\n    (void)esp_wifi_start();\n    (void)esp_wifi_set_config(0, &g_cfg);\n    (void)esp_wifi_connect();\n}\n\nint esp_rssi(void) { return esp_wifi_sta_get_rssi(); }\n```\n\nESP32 · WiFi\n\n\n\nh7\\_m05\\_lora.cC\n\n \n\n```text\n/* h7_m05_lora.c —— 外挂 LoRa 模组配置（STM32H7 / Cortex-M7）。\n * 设置扩频因子；注意各地区占空比限制（如 EU868 需满足 1% 占空比调度）。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nint lora_config(uint8_t sf) {\n    uint8_t cmd[16];\n    int n = 0;\n    const char *p = \"AT+SF=\";\n    while (*p) { cmd[n++] = (uint8_t)*p++; }\n    cmd[n++] = (uint8_t)('0' + (sf / 10u) % 10u);\n    cmd[n++] = (uint8_t)('0' + (sf % 10u));\n    cmd[n++] = '\\r';\n    cmd[n++] = '\\n';\n    return uart_send(cmd, (size_t)n);\n}\n\n/* 占空比约束：两次上行之间至少要等 (1/占空比 - 1) 倍的发送时长（示意） */\nuint32_t lora_min_gap_ms(uint32_t airtime_ms, uint32_t duty_permille) {\n    if (duty_permille == 0u) return 0u;\n    return airtime_ms * (1000u - duty_permille) / duty_permille;\n}\n```\n\nSTM32H7 · LoRa\n\n\n\n表 5.3 三平台无线\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 主用无线 | BLE(外挂) | WiFi/BLE | LoRa(外挂) |\n| 连接参数 | interval/latency | event 驱动 | SF/占空比 |\n| 功耗 | 低 | 高 | 极低 |\n| 判链路 | RSSI/事件 | RSSI | SNR/RSSI |"}
````



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



无线自检：按场景选型、参数合理、守占空比、断线重连。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  无线选型决策



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="无线选型决策" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">看距离</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">看速率</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">看功耗</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">看法规</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">选定</text></svg>
```



看距离 → 看速率 → 看功耗 → 看法规（占空比）→ 选定并配连接参数。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 选型 | 三要素权衡 | 只看速度 |
| 参数 | interval/latency | 偏激 |
| 占空比 | 守地区限制 | 频繁上行 |
| 重连 | RSSI 退避 | 断线不重连 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **只比“速度”** ：选 WiFi 做电池设备，功耗失控。

- **忽略占空比** ：LoRa 频繁上行可能违反法规。

- **BLE 连接参数偏激** ：interval 太短耗电、latency 太大响应慢。

- **WiFi 断线不重连** ：信号波动后设备“沉默”。



◆ 自测 · Module 05（先答再看）




1. 电池供电、每天上报几十字节、距离数公里选哪种无线？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"LoRa。速率要求低、距离远、数据量小，正好匹配；WiFi/BLE 距离不够，蜂窝模组功耗成本偏高。"}
   ```

2. BLE 连接参数 interval/latency 各影响什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"interval 决定唤醒/通信间隔（1.25ms 粒度），越短越耗电；latency 允许从设备跳过若干连接事件以省电，但会增大响应延迟。"}
   ```

3. 为什么 LoRa 要守占空比？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"地区法规对 Sub-GHz 频段的发射占空比有上限（如 1%），频繁上行会违规且影响他人。应控制上报频率与发射时长。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的场景写出无线选型理由（距离/速率/功耗/法规），并配置连接参数与断线重连策略。



核对与延伸：[Bluetooth SIG 规范](https://www.bluetooth.com/specifications/specs/) · [Semtech LoRa 设计指南 (AN1200.22)](https://www.semtech.com/products/wireless-rf/lora-connect)

 

动手练习



编译 ` labs/m05_ble.c `（M3）、` labs/esp_m05_wifi.c `（Xtensa）、` labs/h7_m05_lora.c `（M7）。



**检查结果：** 三种无误的配置代码交叉编译通过；能说清功耗/距离/速率取舍；BLE 连接参数与 RSSI 有明确单位。

 

迁移练习：把本章的“能按距离/速率/功耗为场景选择无线技术，并配置 BLE 连接参数、LoRa 占空比与 WiFi 重连。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m05","criterion":"三种无误的配置代码交叉编译通过；能说清功耗/距离/速率取舍；BLE 连接参数与 RSSI 有明确单位。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
