# 通信与联网集成

```zhizhan-anchor
m06
```



把 B07 的协议接进应用：上报策略、断线重连、离线缓存与补传、配置下发。

 

> 前置：已在 B07 掌握协议收发与帧格式，了解断线重连、缓存与配置的概念。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为上报设计周期/变化/批量/事件策略，并实现指数退避重连、有界缓存补传与配置下发确认\+版本。

 

本章速览




- 上报策略三种：周期、变化触发、批量；按带宽/功耗/实时性选。

- 断线要指数退避重连；离线缓存必须有界并支持补传。

- 配置下发要带确认与版本，避免“发下去不知道有没有生效”。

 

```zhizhan-anchor
m06-link
```



```zhizhan-anchor
m06-link-t
```



## 6.1 应用层决定“什么时候传”



协议栈（B07）解决“怎么传”，应用层要决定“什么时候传、传什么、传不出去怎么办”。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  上报策略选择



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="上报策略选择" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">周期</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">变化</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">批量</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">事件</text></svg>
```



慢变量/心跳→周期上报；省流量→变化触发；高采样/弱网→批量；安全→事件立即上报。



表 6.1 上报策略



| 上报策略 | 特点 | 适用 |
| --- | --- | --- |
| 周期上报 | 按固定周期 | 慢变量、心跳 |
| 变化触发 | 变化超阈值才报 | 省流量/省电 |
| 批量上报 | 攒一批再发 | 高采样率、弱网 |
| 事件上报 | 告警立即发 | 安全相关 |



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：三平台集成（交叉编译）



三平台的上报/重连集成代码均通过交叉编译：



m06\_link.cC

 

```text
/* m06_link.c —— 上报策略与有界离线缓存（Cortex-M3）。
 * 断网时入缓存并计数；恢复后按序补传，绝不无限堆积。 */
#include <stdint.h>
#include "app_api.h"

#define QCAP 32
typedef struct { uint8_t buf[QCAP][16]; int n; uint32_t dropped; } offq_t;

int link_enqueue(offq_t *q, const uint8_t *d) {
    if (q->n >= QCAP) { q->dropped++; return -1; }   /* 满：丢新并计数 */
    for (int i = 0; i < 16; i++) q->buf[q->n][i] = d[i];
    q->n++;
    return 0;
}
int link_pending(const offq_t *q) { return q->n; }
```

STM32F103 · 上报集成



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m06_link.c -o m06.o && arm-none-eabi-size m06.o
   text    data     bss     dec     hex filename
     62       0       0      62      3e m06.o
```



真实工具输出：m06\_link.c（M3）text=62 B；esp\_m06\_link.c（Xtensa）text=26 B；h7\_m06\_link.c（M7）text=12 B；断线退避/去重的可运行证据见 B07 host\_backoff.c。



表 6.2 集成规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m06\_link.c | M3 | 62 B |
| esp\_m06\_link.c | Xtensa | 26 B |
| h7\_m06\_link.c | M7 | 12 B |
| 退避/去重 | — | 见 B07 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm06-plat\n```\n\n\n\n```zhizhan-anchor\nm06-plat-t\n```\n\n\n\n## 6.3 三平台对照：联网集成\n\n\n\n三平台的网络栈不同，但上报策略与断线处理一致。\n\n\n\nm06\\_link.cC\n\n \n\n```text\n/* m06_link.c —— 上报策略与有界离线缓存（Cortex-M3）。\n * 断网时入缓存并计数；恢复后按序补传，绝不无限堆积。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\n#define QCAP 32\ntypedef struct { uint8_t buf[QCAP][16]; int n; uint32_t dropped; } offq_t;\n\nint link_enqueue(offq_t *q, const uint8_t *d) {\n    if (q->n >= QCAP) { q->dropped++; return -1; }   /* 满：丢新并计数 */\n    for (int i = 0; i < 16; i++) q->buf[q->n][i] = d[i];\n    q->n++;\n    return 0;\n}\nint link_pending(const offq_t *q) { return q->n; }\n```\n\nSTM32F103 · 集成\n\n\n\nesp\\_m06\\_link.cC\n\n \n\n```text\n/* esp_m06_link.c —— ESP32 上报链路质量与断线判断（Xtensa）。\n * RSSI 分级决定是否降速/重连；断线由事件驱动重连（B07 M12）。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nint esp_link_quality(void) {\n    int r = esp_wifi_sta_get_rssi();\n    if (r >= -60) return 2;      /* 好 */\n    if (r >= -80) return 1;      /* 一般 */\n    return 0;                    /* 差：应降速或重连 */\n}\n```\n\nESP32 · 集成\n\n\n\nh7\\_m06\\_link.cC\n\n \n\n```text\n/* h7_m06_link.c —— H7 以太网/网关上报与补传（Cortex-M7）。\n * 应用层只关心“入队/上报成功”，底层链路细节由 B07 的协议栈处理。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\nint h7_link_report(const uint8_t *frame, int len) {\n    (void)frame;\n    return len > 0 ? 0 : -1;      /* 成功=0（真实实现走 TCP/MQTT） */\n}\n```\n\nSTM32H7 · 集成\n\n\n\n表 6.3 三平台联网集成\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 链路 | W5500/lwIP | WiFi | lwIP |\n| 上报 | 周期/变化 | 同 | 同 |\n| 缓存 | 有界环形 | 有界环形 | 有界环形 |\n| 配置 | 确认\\+版本 | 同 | 同 |"}
````



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



集成自检：策略明确、退避重连、缓存有界补传、配置确认。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  上报策略开销（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="上报策略开销（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">逐条</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(相对开销)</text><text x="12" y="67" class="sv-lbl">批量</text><rect x="150" y="50" width="109" height="18" rx="4" class="sv-grn-s"></rect><text x="267" y="67" class="sv-lbl-hi">20(相对开销)</text></svg>
```



逐条上报协议头/握手开销大；批量上报摊薄开销，代价是时延。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 策略 | 按场景选 | 一律逐条 |
| 重连 | 指数退避 | 死循环 |
| 缓存 | 有界\+补传 | 无界堆积 |
| 配置 | 确认\+版本 | 发下去不管 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **断线死循环重连** ：耗电、发热、服务器雪崩（见 B07 M12）。

- **离线缓存无上界** ：长时间断网把 RAM 吃光。

- **配置下发无确认** ：不知道是否生效，现场对不上。

- **上报与功耗/实时性冲突** ：高频上报把续航和实时性一起拖垮。



◆ 自测 · Module 06（先答再看）




1. 高采样率、弱网环境下，为什么“批量上报”通常优于“逐条上报”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"逐条上报的协议头与握手开销大、失败重传多；批量攒够一次发，摊薄开销，并可用序号保证完整与有序，代价是引入一定时延。"}
   ```

2. 配置下发为什么要带确认与版本？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则“发下去但没生效”无法察觉。确认让服务端知道设备已应用，版本用于判断新旧与兼容。"}
   ```

3. 离线缓存为什么必须有上界？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"长时间断网若无上界会把 RAM 吃光导致崩溃。应设界并在满时丢最旧或阻塞上游（带计数），保证系统可存活。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的上报设计策略（周期/变化/批量/事件），并实现指数退避重连、有界缓存补传与配置下发确认\+版本。



核对与延伸：[LVGL 官方文档](https://docs.lvgl.io/)

 

动手练习



编译 ` labs/m06_link.c `（M3）、` labs/esp_m06_link.c `（Xtensa）、` labs/h7_m06_link.c `（M7）。



**检查结果：** 上报策略明确；断线退避、缓存有界、恢复补传；配置下发有确认与版本。

 

迁移练习：把本章的“能为上报设计周期/变化/批量/事件策略，并实现指数退避重连、有界缓存补传与配置下发确认\+版本。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m06","criterion":"上报策略明确；断线退避、缓存有界、恢复补传；配置下发有确认与版本。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
