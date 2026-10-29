# WiFi 联网

```zhizhan-anchor
m19
```



WiFi 联网是 **事件驱动** 的：初始化协议栈 → 配 SSID/密码 → 启动 → 等 ` GOT_IP ` 事件。连接质量看  **RSSI** ，断线要 **指数退避** 重连，低功耗场景配合 modem/deep sleep。

 

> 前置：会写事件回调并了解 AT 指令/串口通信。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用事件驱动方式连上 AP 并读 IP/RSSI，实现指数退避重连与低功耗策略。

 

本章速览




- WiFi 是事件驱动：初始化→配 SSID→等 GOT\_IP。

- ESP32 内置；STM32 外挂模组走 AT 指令。

- 看 RSSI；断线重连用指数退避，别死循环。

 

```zhizhan-anchor
m19-flow
```



```zhizhan-anchor
m19-flow-t
```



## 19.1 事件驱动联网



ESP32 内置 WiFi，直接调 ` esp_wifi_* `；STM32 没内置，外挂模组走 AT 或 SDIO/SPI 芯片，协议栈在模组里。流程始终是：初始化 → 配 SSID → 启动 → 等 GOT\_IP。



```zhizhan-anchor
fig-图-19-1
```



**图 19.1**  WiFi 联网的事件流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="WiFi 联网的事件流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">init</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">配 SSID</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">start</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">等 GOT_IP</text></svg>
```



init → 配 SSID/密码 → start → 等 GOT\_IP 事件 → 联网就绪。别不等事件就以为连上了。



表 19.1 三平台 WiFi 接入



| 平台 | WiFi 来源 | 单片机侧 | 拿 IP 方式 |
| --- | --- | --- | --- |
| ESP32 | 内置 | esp\_wifi API | 事件回调 GOT\_IP |
| STM32F103 | 外挂模组 | UART \+ AT | 解析 "WIFI GOT IP" |
| STM32H7 | 外挂/SDIO | AT 或 SDIO | AT\+CIPSTA? |



```zhizhan-anchor
m19-evidence
```



```zhizhan-anchor
m19-evidence-t
```



## 19.2 真实证据：事件与 RSSI



ESP32 用 ` esp_wifi_* `；STM32 侧为 AT 指令封装。两类路线都不改动应用层 socket 用法。



m19\_wifi\_at.c 节选C

 

```text
/* AT 路线：发 AT+CWJAP 后等待 "WIFI GOT IP"；读 RSSI 用 AT+CWJAP? */
at_send("AT+CWMODE=1\r\n");
at_send("AT+CWJAP=\"ssid\",\"pass\"\r\n");
/* 解析 "WIFI GOT IP" 与 "+CWJAP:\"ssid\",\"mac\",ch,rssi" */
/* 断线回调里做指数退避重连，而不是忙等 */
```

真实反汇编对应 AT 解析；RSSI −80 dBm 仅作弱信号示例，能否使用须实测丢包率、重连时间与业务延迟



表 19.2 关键事件与阈值



| 指标/事件 | 含义 | 阈值 |
| --- | --- | --- |
| GOT\_IP | 拿到 IP 事件 | 据此判联网就绪 |
| RSSI | 信号强度 dBm | 弱信号需实测业务指标，非统一失效阈值 |
| 重连 | 断线策略 | 指数退避，非忙等 |
| 省电 | modem/deep sleep | 按需开 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm19-plat\n```\n\n\n\n```zhizhan-anchor\nm19-plat-t\n```\n\n\n\n## 19.3 三平台对照：WiFi\n\n\n\n三平台 WiFi 接入方式不同：ESP32 内置；F103/H7 外挂模组。三份代码均已交叉编译。\n\n\n\nm19\\_wifi\\_at.cC\n\n \n\n```text\n/* m19_wifi_at.c — B05-M19 WiFi（STM32 外接 WiFi 模组，AT 指令，如 ESP-AT）\n * 单片机侧只做两件事：发 AT 指令、解析返回；联网协议栈在模组里。 */\n#include \"stm32f103_regs.h\"\n#include <string.h>\n\nextern int uart_at_send(const char *cmd);          /* 经 USART 发出，带 \\r\\n */\nextern int uart_at_read(char *buf, int max, int timeout_ms);\n\n/* 连接 AP：AT+CWJAP=\"ssid\",\"pass\" → 等 \"OK\" / \"WIFI GOT IP\" */\nint wifi_at_join(const char *ssid, const char *pass)\n{\n    char cmd[96];\n    int n = 0;\n    const char *p = \"AT+CWJAP=\\\"\";\n    while (*p && n < 90) { cmd[n++] = *p++; }\n    while (*ssid && n < 90) { cmd[n++] = *ssid++; }\n    cmd[n++] = '\"'; cmd[n++] = ','; cmd[n++] = '\"';\n    while (*pass && n < 90) { cmd[n++] = *pass++; }\n    cmd[n++] = '\"';                                /* 收尾引号：AT+CWJAP=\"ssid\",\"pass\" */\n    cmd[n] = '\\0';\n    if (uart_at_send(cmd) != 0) { return -1; }\n\n    char rsp[128];\n    for (int i = 0; i < 20; ++i) {                 /* 最多等 ~20 次 */\n        int r = uart_at_read(rsp, sizeof(rsp), 1000);\n        if (r > 0 && (strstr(rsp, \"WIFI GOT IP\") || strstr(rsp, \"OK\"))) { return 0; }\n        if (r > 0 && strstr(rsp, \"FAIL\")) { return -2; }\n    }\n    return -3;                                     /* 超时：检查波特率/电源/天线 */\n}\n```\n\nSTM32F103 · AT 模组\n\n\n\nesp\\_m19\\_wifi.cC\n\n \n\n```text\n/* esp_m19_wifi.c — B05-M19 WiFi（ESP32 为主）：Station 联网、RSSI、断线重连\n * ESP32 内置 WiFi（802.11 b/g/n）；联网是“事件驱动”的：初始化 → 配 SSID → 等事件。 */\n#include <stdint.h>\n\ntypedef int esp_err_t;\ntypedef int wifi_mode_t;\ntypedef struct { uint8_t ssid[32]; uint8_t password[64]; } wifi_sta_config_t;\n\nextern esp_err_t esp_netif_init(void);\nextern esp_err_t esp_event_loop_create_default(void);\nextern void *esp_netif_create_default_wifi_sta(void);\nextern esp_err_t esp_wifi_init(const void *cfg);\nextern esp_err_t esp_wifi_set_mode(wifi_mode_t mode);\nextern esp_err_t esp_wifi_set_config(int iface, const void *conf);\nextern esp_err_t esp_wifi_start(void);\nextern esp_err_t esp_wifi_connect(void);\nextern esp_err_t esp_wifi_sta_get_ap_info(void *ap_info);   /* 内含 rssi 字段 */\n\n#define WIFI_MODE_STA 1\n#define WIFI_IF_STA   0\n\nint esp_wifi_sta_start(const char *ssid, const char *pass)\n{\n    esp_netif_init();\n    esp_event_loop_create_default();\n    esp_netif_create_default_wifi_sta();\n    esp_wifi_init((const void *)0);\n    esp_wifi_set_mode(WIFI_MODE_STA);\n\n    wifi_sta_config_t c = { { 0 }, { 0 } };\n    for (int i = 0; i < 32 && ssid[i]; ++i) { c.ssid[i] = (uint8_t)ssid[i]; }\n    for (int i = 0; i < 64 && pass[i]; ++i) { c.password[i] = (uint8_t)pass[i]; }\n    esp_wifi_set_config(WIFI_IF_STA, &c);\n    esp_wifi_start();\n    return esp_wifi_connect();\n}\n\n/* RSSI：信号强度（dBm）。重连策略：掉线事件里做指数退避，不要死循环狂连 */\nint esp_wifi_rssi(void *ap_info) { return esp_wifi_sta_get_ap_info(ap_info); }\n```\n\nESP32 · esp\\_wifi\n\n\n\nh7\\_m19\\_wifi.cC\n\n \n\n```text\n/* h7_m19_wifi.c — B05-M19 WiFi（STM32H7 外接 WiFi 模组，AT 指令）\n * 与 F1 同样的“AT 指令”路线；H7 常配合 Wi-Fi 协处理器或走 SDIO/SPI 的 Wi-Fi 芯片。 */\n#include \"stm32h7_regs.h\"\n#include <string.h>\n\nextern int uart_at_send(const char *cmd);\nextern int uart_at_read(char *buf, int max, int timeout_ms);\n\n/* 查询连接状态：AT+CWJAP? 或 AT+CIPSTATUS */\nint wifi_h7_query_ip(char *ip_out, int cap)\n{\n    if (uart_at_send(\"AT+CIPSTA?\") != 0) { return -1; }\n    char rsp[160];\n    int r = uart_at_read(rsp, sizeof(rsp), 1500);\n    if (r <= 0) { return -2; }\n    char *p = strstr(rsp, \"ip:\\\"\");\n    if (!p) { return -3; }\n    p += 4;\n    int n = 0;\n    while (*p && *p != '\"' && n < cap - 1) { ip_out[n++] = *p++; }\n    ip_out[n] = '\\0';\n    return 0;\n}\n```\n\nSTM32H7 · SDIO/AT\n\n\n\n表 19.3 三平台 WiFi\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 来源 | 外挂模组 | 内置 | 外挂/SDIO |\n| 接口 | UART AT | 内部总线 | SDIO/AT |\n| 事件 | 解析 AT 回显 | 事件回调 | AT/SDIO |\n| 功耗 | 模组控制 | modem sleep | 模组控制 |"}
````



```zhizhan-anchor
m19-check
```



```zhizhan-anchor
m19-check-t
```



## 19.4 RSSI 与自检



信号质量用 RSSI 量化：越接近 0 越强。下图给出档位：



```zhizhan-anchor
fig-图-19-2
```



**图 19.2**  RSSI 信号强度档位



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="RSSI 信号强度档位" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">极好 -40</text><rect x="150" y="26" width="540" height="18" rx="4" class="sv-grn-s"></rect><text x="698" y="43" class="sv-lbl-hi">90(相对)</text><text x="12" y="67" class="sv-lbl">好 -60</text><rect x="150" y="50" width="420" height="18" rx="4" class="sv-cyn-s"></rect><text x="578" y="67" class="sv-lbl-hi">70(相对)</text><text x="12" y="91" class="sv-lbl">可用 -70</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="91" class="sv-lbl-hi">50(相对)</text><text x="12" y="115" class="sv-lbl">差 -85</text><rect x="150" y="98" width="90" height="18" rx="4" class="sv-red-s"></rect><text x="248" y="115" class="sv-lbl-hi">15(相对)</text></svg>
```



−40≈极好、−60≈好、−70≈可用、−85≈很差（不可靠）。弱信号先改善天线/距离/信道。



表 19.4 WiFi 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 拿到 IP | 等 GOT\_IP | 事件到达 |
| RSSI | 读信号 | ≥ −80 dBm |
| 重连 | 拔 AP 再恢复 | 指数退避、能重连 |
| 省电 | 空闲测电流 | 符合预算 |



```zhizhan-anchor
m19-pitfalls
```



```zhizhan-anchor
m19-pitfalls-t
```



## 19.5 常见误区与排障



失败路径与排障




- **死循环重连** ：AP 不在时占满 CPU 还费电，应指数退避。

- **AT 波特率不符** ：指令没回显，先核对波特率与流控。

- **忽略事件** ：不等 GOT\_IP 就以为连上，实际还在握手。

- **天线/地线差** ：RSSI 很低，先解决射频与供电再调软件。



◆ 自测 · Module 19（先答再看）




1. RSSI −85 dBm 意味着什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"信号很弱，丢包/重传显著上升，通常不可靠。先改善天线/距离/信道，再指望软件重传。"}
   ```

2. 为什么 WiFi 断线重连要用指数退避？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"AP 不在时死循环狂连会占满 CPU 且费电。指数退避让重试间隔逐渐变长，既省资源又能在 AP 恢复后连上。"}
   ```

3. 为什么不能“不等 GOT\_IP 就以为连上了”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"GOT\\_IP 事件代表拿到 IP、真正就绪。在此之前可能还在认证/握手，直接发数据会失败。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给设备做一次“拔 AP→恢复”的重连演练，确认使用指数退避且不忙等。



核对与延伸：[ESP-IDF Wi-Fi 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/wifi.html)

 

动手练习



让设备连上 AP 并打印 IP 与 RSSI；拔掉 AP 再恢复，验证重连策略不出现忙等。



**检查结果：** 事件流程能拿到 IP（GOT\_IP）；RSSI 可读（−80 dBm 仅作弱信号示例，能否使用须实测丢包率、重连时间与业务延迟）；断线按指数退避重连。

 

迁移练习：把本章的“能用事件驱动方式连上 AP 并读 IP/RSSI，实现指数退避重连与低功耗策略。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 19 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m19","criterion":"事件流程能拿到 IP（GOT_IP）；RSSI 可读（−80 dBm 仅作弱信号示例，能否使用须实测丢包率、重连时间与业务延迟）；断线按指数退避重连。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
