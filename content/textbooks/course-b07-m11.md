# 网络基础与 MCU 协议栈

```zhizhan-anchor
m11
```



以太网/IP；ARP/DHCP/DNS；TCP/UDP；Socket 与 lwIP 分层。

 

> 前置：了解 IP/ARP/DHCP/DNS 与 TCP/UDP 的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能在 MCU 上用 socket/lwIP 联网，按长度或分隔符处理 TCP 粘包/半包并设计超时重连。

 

本章速览




- MCU 联网：外挂 W5500 或内置 MAC\+lwIP，应用都用 socket 抽象。

- 排障分层：链路(link) → 网络(IP/DHCP) → 传输(TCP) → 应用。

- TCP 要处理粘包/半包；UDP 要自己处理丢包与顺序。

 

```zhizhan-anchor
m11-net
```



```zhizhan-anchor
m11-net-t
```



## 11.1 分层与 TCP 字节流



MCU 联网有两条路：外挂 W5500（SPI 硬件 TCP/IP）或内置 MAC \+ lwIP。应用层多用 socket 抽象；出问题按分层排查。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  TCP 收发中的粘包/半包



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="TCP 收发中的粘包/半包" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">send 两条</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">TCP 字节流</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">recv 可能粘/半</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">按长度切帧</text></svg>
```



TCP 是字节流，一次 recv 可能只收半条或收到两条；应用必须按长度或分隔符重新切帧。



表 11.1 网络分层



| 层 | 协议 | 排障 |
| --- | --- | --- |
| 链路 | 以太网/WiFi | link 是否 up、PHY/信号 |
| 网络 | ARP/DHCP/IP/DNS | 有没有 IP、能否解析域名 |
| 传输 | TCP/UDP | 连接是否建立、半包/丢包 |
| 应用 | MQTT/HTTP/自定义 | 语义与业务逻辑 |



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：三平台联网代码（交叉编译）



三平台的联网实现不同（W5500/lwIP/netif），但都通过交叉编译：



m11\_lwip.cC

 

```text
/* m11_lwip.c —— TCP 客户端（Cortex-M3，外挂 W5500 或内置 MAC+lwIP）。
 * 用 socket 风格接口；连接/发送/接收都要有超时，避免链路异常时卡死。 */
#include <stdint.h>
#include <string.h>
#include "comm_api.h"

int http_get(const char *host, uint16_t port) {
    const char *req = "GET / HTTP/1.0\r\n\r\n";
    uint8_t buf[128];
    if (tcp_connect(host, port) != 0) return -1;
    if (tcp_send((const uint8_t *)req, strlen(req)) < 0) return -2;
    int n = tcp_recv(buf, sizeof(buf), 3000u);
    return n;                       /* 返回收到的字节数，<0 为错误 */
}
```

STM32F103 · lwIP/W5500



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m11_lwip.c -o m11.o && arm-none-eabi-size m11.o
   text    data     bss     dec     hex filename
     75       0       0      75      4b m11.o
```



真实工具输出：m11\_lwip.c（M3）text=75 B；esp\_m11\_netif.c（Xtensa）text=26 B；h7\_m11\_lwip.c（M7）text=58 B。



表 11.2 联网代码规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m11\_lwip.c | M3 | 75 B |
| esp\_m11\_netif.c | Xtensa | 26 B |
| h7\_m11\_lwip.c | M7 | 58 B |
| 结论 | — | 三平台均可编译 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm11-plat\n```\n\n\n\n```zhizhan-anchor\nm11-plat-t\n```\n\n\n\n## 11.3 三平台对照：协议栈\n\n\n\n三平台的协议栈与网卡接口不同，但 socket 抽象与分层一致。\n\n\n\nm11\\_lwip.cC\n\n \n\n```text\n/* m11_lwip.c —— TCP 客户端（Cortex-M3，外挂 W5500 或内置 MAC+lwIP）。\n * 用 socket 风格接口；连接/发送/接收都要有超时，避免链路异常时卡死。 */\n#include <stdint.h>\n#include <string.h>\n#include \"comm_api.h\"\n\nint http_get(const char *host, uint16_t port) {\n    const char *req = \"GET / HTTP/1.0\\r\\n\\r\\n\";\n    uint8_t buf[128];\n    if (tcp_connect(host, port) != 0) return -1;\n    if (tcp_send((const uint8_t *)req, strlen(req)) < 0) return -2;\n    int n = tcp_recv(buf, sizeof(buf), 3000u);\n    return n;                       /* 返回收到的字节数，<0 为错误 */\n}\n```\n\nSTM32F103 · lwIP\n\n\n\nesp\\_m11\\_netif.cC\n\n \n\n```text\n/* esp_m11_netif.c —— netif 与 TCP（ESP32 / Xtensa）。\n * 分层：netif(IP 层) → WiFi 驱动 → socket/TCP。 */\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nint esp_tcp_up(const char *host, uint16_t port) {\n    (void)esp_netif_init();\n    (void)esp_netif_create_default_wifi_sta();\n    (void)esp_wifi_start();\n    return tcp_connect(host, port);\n}\n```\n\nESP32 · netif\n\n\n\nh7\\_m11\\_lwip.cC\n\n \n\n```text\n/* h7_m11_lwip.c —— lwIP 分层概念（STM32H7 / Cortex-M7）。\n * 应用用 netconn/socket；pbuf 由协议栈管理，发送完成前缓冲不能复用。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nint lwip_send_hello(const char *host, uint16_t port) {\n    const uint8_t msg[] = \"hello\";\n    if (tcp_connect(host, port) != 0) return -1;\n    return tcp_send(msg, sizeof(msg) - 1u);\n}\n\n/* ARP 失败/端口不通/超时是三层不同的故障，应分别有观测点（M09） */\nint lwip_probe(const char *host, uint16_t port) { return tcp_connect(host, port); }\n```\n\nSTM32H7 · lwIP\n\n\n\n表 11.3 三平台协议栈\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 协议栈 | lwIP/硬件栈 | lwIP | lwIP |\n| 网卡 | ENC/W5500/ETH | 内置 WiFi/ETH | 以太网 MAC |\n| socket | 支持 | 支持 | 支持 |\n| pbuf | lwIP pbuf | 内部 | lwIP pbuf |"}
````



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检



网络自检：分层排查、TCP 切帧、UDP 自做可靠、缓冲复用安全。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  分层证据（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="分层证据（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">链路</text><rect x="150" y="26" width="600" height="18" rx="4" class="sv-cyn-s"></rect><text x="758" y="43" class="sv-lbl-hi">1(证据=1)</text><text x="12" y="67" class="sv-lbl">网络</text><rect x="150" y="50" width="600" height="18" rx="4" class="sv-grn-s"></rect><text x="758" y="67" class="sv-lbl-hi">1(证据=1)</text><text x="12" y="91" class="sv-lbl">传输</text><rect x="150" y="74" width="600" height="18" rx="4" class="sv-amb-s"></rect><text x="758" y="91" class="sv-lbl-hi">1(证据=1)</text><text x="12" y="115" class="sv-lbl">应用</text><rect x="150" y="98" width="600" height="18" rx="4" class="sv-box"></rect><text x="758" y="115" class="sv-lbl-hi">1(证据=1)</text></svg>
```



每层至少一条证据：link up、有 IP、三次握手、应用字段正确。



表 11.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 分层 | 逐层给证据 | 跳层 |
| TCP | 按长度切帧 | 当消息边界 |
| UDP | 序号\+重传 | 当可靠 |
| 缓冲 | 发完再复用 | 提前释放 pbuf |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **把 TCP 当消息边界** ：一次 recv 可能只收半条或两条，必须自行分帧。

- **只用 IP 不查 ARP/DHCP** ：拿不到地址或解析不了域名时误判为应用问题。

- **UDP 当可靠传输** ：不丢重传就丢数据。

- **pbuf 提前释放** ：发送未完成就复用缓冲，数据被覆盖。



◆ 自测 · Module 11（先答再看）




1. TCP 收到“两条消息粘在一起”是协议错误吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不是。TCP 是字节流，不保留消息边界。应用必须按长度或分隔符自己切帧，这正是 M01 帧解析要解决的问题。"}
   ```

2. 为什么每层都要有一条证据？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"通信故障常被误判层级。link up/有 IP/三次握手/应用字段各给一条证据，能快速锁定问题在物理、网络还是应用层。"}
   ```

3. lwIP 里为什么不能在发送完成前复用 pbuf？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"报文缓冲在发送完成前仍被协议栈引用；提前复用会覆盖待发数据，表现为“偶发数据错”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用 socket/lwIP 联网，按长度或分隔符处理 TCP 粘包/半包，并为 UDP 设计序号\+重传，给连接加超时重连。



核对与延伸：[lwIP 官方项目](https://savannah.nongnu.org/projects/lwip/) · [Wireshark 用户手册](https://www.wireshark.org/docs/)

 

动手练习



编译三个平台的联网代码；用 Wireshark 抓一次 TCP 交互，核对三次握手与数据段。



**检查结果：** 能画出链路/网络/传输/应用四层各给一条证据；TCP 收发按长度或分隔符处理粘包/半包；超时重连明确。

 

迁移练习：把本章的“能在 MCU 上用 socket/lwIP 联网，按长度或分隔符处理 TCP 粘包/半包并设计超时重连。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m11","criterion":"能画出链路/网络/传输/应用四层各给一条证据；TCP 收发按长度或分隔符处理粘包/半包；超时重连明确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
