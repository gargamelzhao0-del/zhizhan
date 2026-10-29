# 协议调试

```zhizhan-anchor
m09
```



逻辑分析仪抓 UART/[I²C](term:i2c)/SPI、CAN 分析仪、Wireshark 抓包与 MQTT 解析、总线负载与错误统计。

 

> 前置：了解逻辑分析仪/示波器与 Wireshark 抓包的基本用法。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按物理层→链路层→网络层→应用层分层定位通信故障，并读取 CRC 错/超时/总线关闭计数。

 

本章速览




- 逻辑分析仪看 UART/SPI 时序，CAN 分析仪看仲裁与错误帧。

- Wireshark 抓包 \+ 过滤器定位协议层问题；先确认物理层再往上看。

- 总线负载与错误计数是现场诊断的第一手数据。

 

```zhizhan-anchor
m09-debug
```



```zhizhan-anchor
m09-debug-t
```



## 9.1 分层定位：先物理层



通信问题要分层定位：先确认电平/时序（物理层），再看帧/校验（链路层），最后才看协议语义（应用层）。跳过物理层直接怀疑应用层，是最常见的时间浪费。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  四层排障



```zhizhan-figure
<svg viewBox="0 0 800 125" width="100%" height="125" role="img" aria-label="四层排障" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">物理层</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">链路层</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">网络层</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">应用层</text></svg>
```



物理层（位宽/波特率/电平）→ 链路层（帧/CRC/错误帧）→ 网络层（ARP/IP/TCP）→ 应用层（字段/语义）。



表 9.1 分层排障



| 层 | 工具 | 看什么 |
| --- | --- | --- |
| 物理层 | 示波器/逻辑分析仪 | 位宽、波特率、电平、边沿 |
| 链路层 | 逻辑分析仪/CAN 分析仪 | 帧结构、CRC、错误帧 |
| 网络层 | Wireshark | ARP/DHCP/IP/TCP 交互 |
| 应用层 | Wireshark 过滤/自研解析 | MQTT/Modbus 字段与语义 |



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：三平台错误计数代码（交叉编译）



现场诊断先看三个计数（CRC 错、超时、总线关闭），再算总线负载：



m09\_debug.cC

 

```text
/* m09_debug.c —— 链路统计与总线负载（Cortex-M3）。
 * 现场诊断先看三类计数：CRC 错、超时、总线关闭；再算总线负载是否过高。 */
#include <stdint.h>
#include "comm_api.h"

typedef struct { uint32_t crc_err; uint32_t timeout; uint32_t bus_off; uint32_t frames; } link_stat_t;

void link_stat_frame(link_stat_t *s, int crc_ok) {
    s->frames++;
    if (!crc_ok) s->crc_err++;
}

int bus_load_permille(uint32_t fps, uint32_t bits_per_frame, uint32_t bitrate) {
    return (int)(((uint64_t)fps * bits_per_frame * 1000u) / bitrate);
}

/* 错误率超过阈值就应告警/降速 */
int link_should_alert(const link_stat_t *s, int permille_threshold) {
    if (s->frames == 0) return 0;
    return (int)(s->crc_err * 1000u / s->frames) > permille_threshold;
}
```

STM32F103 · 错误计数



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m09_debug.c -o m09.o && arm-none-eabi-size m09.o
   text    data     bss     dec     hex filename
     72       0       0      72      48 m09.o
```



真实工具输出：m09\_debug.c（M3）text=72 B；h7\_m09\_debug.c 读 FDCAN PSR 错误计数 text=44 B；esp\_m09\_debug.c text=38 B。



表 9.2 调试计数规模



| 文件 | 平台 | text | 看点 |
| --- | --- | --- | --- |
| m09\_debug.c | M3 | 72 B | CRC 错/超时 |
| esp\_m09\_debug.c | Xtensa | 38 B | 错误统计 |
| h7\_m09\_debug.c | M7 | 44 B | FDCAN PSR 计数 |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm09-plat\n```\n\n\n\n```zhizhan-anchor\nm09-plat-t\n```\n\n\n\n## 9.3 三平台对照：调试工具\n\n\n\n三平台的错误计数寄存器与抓包点不同，但“先物理层、看错误计数”一致。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m09\\\\_debug.cC\\n\\n \\n\\n```text\\n/* m09_debug.c —— 链路统计与总线负载（Cortex-M3）。\\n * 现场诊断先看三类计数：CRC 错、超时、总线关闭；再算总线负载是否过高。 */\\n#include <stdint.h>\\n#include \\\"comm_api.h\\\"\\n\\ntypedef struct { uint32_t crc_err; uint32_t timeout; uint32_t bus_off; uint32_t frames; } link_stat_t;\\n\\nvoid link_stat_frame(link_stat_t *s, int crc_ok) {\\n    s->frames++;\\n    if (!crc_ok) s->crc_err++;\\n}\\n\\nint bus_load_permille(uint32_t fps, uint32_t bits_per_frame, uint32_t bitrate) {\\n    return (int)(((uint64_t)fps * bits_per_frame * 1000u) / bitrate);\\n}\\n\\n/* 错误率超过阈值就应告警/降速 */\\nint link_should_alert(const link_stat_t *s, int permille_threshold) {\\n    if (s->frames == 0) return 0;\\n    return (int)(s->crc_err * 1000u / s->frames) > permille_threshold;\\n}\\n```\\n\\nSTM32F103 · 计数\"}\n````\n\n\n\nesp\\_m09\\_debug.cC\n\n \n\n```text\n/* esp_m09_debug.c —— ESP32 链路诊断（Xtensa）。\n * WiFi 看 RSSI 与断连事件；配合 idf.py monitor 的日志与抓包定位问题。 */\n#include \"esp_comm.h\"\n\nint esp_link_rssi(void) { return esp_wifi_sta_get_rssi(); }\n\n/* RSSI 分级：低于 -80dBm 视为弱链路，应降速或换信道（经验阈值） */\nint esp_link_quality(void) {\n    int r = esp_link_rssi();\n    if (r >= -60) return 2;\n    if (r >= -80) return 1;\n    return 0;\n}\n```\n\nESP32 · 计数\n\n\n\nh7\\_m09\\_debug.cC\n\n \n\n```text\n/* h7_m09_debug.c —— FDCAN 错误计数（STM32H7 / Cortex-M7）。\n * PSR 里有 TEC/REC 与总线状态位：错误计数持续上升说明终端电阻/线缆/波特率有问题。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n#include \"stm32_comm.h\"\n\nuint32_t h7_can_error_state(void) { return FDCAN_PSR; }\n\n/* 提取接收/发送错误计数（示意字段，实际位域见参考手册） */\nint h7_can_rec_error_count(void) { return (int)((FDCAN_PSR >> 8) & 0x7Fu); }\nint h7_can_tec_error_count(void) { return (int)((FDCAN_PSR >> 16) & 0xFFu); }\n```\n\nSTM32H7 · FDCAN PSR\n\n\n\n表 9.3 三平台调试\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| UART 错误 | SR/OR/NE | driver | SR/OR/NE |\n| CAN 错误 | ESR/TEC/REC | TWAI 状态 | FDCAN PSR |\n| 抓包 | 逻辑分析仪 | 逻辑分析仪/串口 | CAN 分析仪 |\n| 负载 | 帧数×位数/速率 | 同 | 同 |"}
`````



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



调试自检：先物理层、看错误计数、算负载、抓包过滤。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  诊断顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="诊断顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">物理层</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">链路层</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">错误计数</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">负载</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">应用</text></svg>
```



电平/时序 → 帧/CRC → 计数（CRC 错/超时/bus-off）→ 负载 → 应用语义。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 起点 | 物理层 | 只看日志 |
| 计数 | CRC/超时/bus-off | 没有统计 |
| 负载 | 算峰值 | 忽略 |
| 抓包 | 过滤 | 全量看 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **只看应用日志** ：波形/电平错了，日志永远对不上。

- **抓包位置不对** ：在设备侧抓不到网关内网流量。

- **没有错误统计** ：偶发误码没有计数支撑，无法判断是线缆还是协议。

- **端到端全量抓包** ：不做过滤，几万条里找不到问题帧。



◆ 自测 · Module 09（先答再看）




1. 串口“能收到但全是乱码”，先查什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先查物理层参数——波特率、数据位/停止位/校验位、电平和共地。参数不对时收到的字节“看似随机”，CRC 会全部失败。"}
   ```

2. 现场诊断先看哪三个计数？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CRC 错、超时、总线关闭（bus-off）；再算总线负载是否过高。它们能快速区分“线缆/时序”与“协议/软件”。"}
   ```

3. 为什么抓包要做过滤？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"端到端全量抓包动辄几万条，不做显示过滤器（如 mqtt、tcp.port==1883）很难定位问题那一条。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的一条链路建立分层排障清单，并用逻辑分析仪/分析仪读出 CRC 错、超时与总线负载。



核对与延伸：[Wireshark 用户手册](https://www.wireshark.org/docs/) · [CAN 与 CAN-FD 基础（Linux kernel / SocketCAN）](https://www.kernel.org/doc/html/latest/networking/can.html)

 

动手练习



编译三个平台的调试计数代码；用逻辑分析仪/CAN 分析仪抓一次真实交互并记录错误计数。



**检查结果：** 能按层各给一条证据；CRC 错/超时/总线关闭计数与总线负载可读；三平台交叉编译 text=72/38/44 B。

 

迁移练习：把本章的“能按物理层→链路层→网络层→应用层分层定位通信故障，并读取 CRC 错/超时/总线关闭计数。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m09","criterion":"能按层各给一条证据；CRC 错/超时/总线关闭计数与总线负载可读；三平台交叉编译 text=72/38/44 B。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
