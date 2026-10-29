# 蓝牙与 BLE

```zhizhan-anchor
m20
```



BLE 的数据模型是  **GATT** ：服务包含特征，主机读写或订阅 Notify。设备靠 **广播** 被发现，连接后协商 **连接参数** （间隔/延迟/超时）——这是低功耗调优的旋钮。

 

> 前置：了解广播/连接与 GATT 服务/特征概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能搭建 BLE 外设：广播、建 GATT、用 Notify 推数据，并按 1.25 ms/10 ms 单位调连接参数。

 

本章速览




- BLE 数据模型是 GATT：服务/特征/通知。

- 连接参数（interval/latency）决定功耗与响应，单位分别是 1.25ms/10ms。

- 要省电就加大 interval 与 latency，代价是延迟。

 

```zhizhan-anchor
m20-gatt
```



```zhizhan-anchor
m20-gatt-t
```



## 20.1 GATT、广播与连接



BLE 数据模型是 GATT：服务（Service）包含特征（Characteristic），主机读写或订阅“通知（Notify）”。设备通过广播被主机发现，连接后协商连接参数。



```zhizhan-anchor
fig-图-20-1
```



**图 20.1**  BLE 外设的生命周期



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="BLE 外设的生命周期" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">初始化</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">广播</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">连接</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">订阅并 Notify</text></svg>
```



初始化 → 广播 → 主机连接 → 建立 GATT（服务/特征）→ 主机写 CCCD 订阅 → Notify 推数据。



表 20.1 BLE 连接参数



| 概念 | 含义 | 影响 |
| --- | --- | --- |
| 广播间隔 | 多久喊一次 | 越短越快发现、越费电 |
| 连接间隔 interval | 主从通信周期 | 越大越省电、越延迟 |
| 从机延迟 latency | 可跳过的连接事件数 | 越大越省电、响应越慢 |
| 超时 timeout | 判定断开的时间 | 太短易误断，太长恢复慢 |



```zhizhan-anchor
m20-evidence
```



```zhizhan-anchor
m20-evidence-t
```



## 20.2 真实证据：单位与订阅



ESP32 用 Bluedroid ` esp_ble_* `；STM32 侧为透传模组 AT。连接参数单位为 1.25 ms（间隔）/10 ms（超时）——按 ms 填会离谱。



m20\_ble\_at.c 节选C

 

```text
/* AT 透传路线：GATT 细节在模组里，MCU 只读写串口 */
/* 连接参数：interval 单位 1.25ms、timeout 单位 10ms */
/* 主机写 CCCD(0x2902) 订阅后，Notify 才送达 */
/* 想省电：增大 interval 与 latency；代价是延迟变大 */
```

真实反汇编对应 AT 封装；Notify 必须主机订阅（写 CCCD）



表 20.2 连接参数与单位



| 参数 | 单位 | 省电方向 | 代价 |
| --- | --- | --- | --- |
| 连接间隔 | 1.25 ms | 增大 | 延迟变大 |
| 从机延迟 | 连接事件数 | 增大 | 响应变慢 |
| 超时 | 10 ms | 适中 | 太短误断 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm20-plat\n```\n\n\n\n```zhizhan-anchor\nm20-plat-t\n```\n\n\n\n## 20.3 三平台对照：BLE\n\n\n\n三平台 BLE 不同：ESP32 内置 Bluedroid/NimBLE；F103/H7 常外挂协处理器/AT 模组。三份代码均已交叉编译。\n\n\n\nm20\\_ble\\_at.cC\n\n \n\n```text\n/* m20_ble_at.c — B05-M20 蓝牙（STM32 外接 BLE 模组，AT 指令，如 HC-05/BLE 透传模块）\n * 单片机把 BLE 模块当“透传串口”：AT 配置后，收发即 GATT 通知/写入。 */\n#include \"stm32f103_regs.h\"\n#include <string.h>\n\nextern int uart_at_send(const char *cmd);\nextern int uart_at_read(char *buf, int max, int timeout_ms);\n\n/* 配置：AT+NAME、AT+ROLE=0(从机)、AT+BAUD；成功后进入透传 */\nint ble_at_setup(const char *name)\n{\n    if (uart_at_send(\"AT+ROLE=0\") != 0) { return -1; }   /* 从机 */\n    char cmd[48]; int n = 0;\n    const char *p = \"AT+NAME\";\n    while (*p && n < 40) { cmd[n++] = *p++; }\n    while (*name && n < 40) { cmd[n++] = *name++; }\n    cmd[n] = '\\0';\n    if (uart_at_send(cmd) != 0) { return -2; }\n    char rsp[64];\n    if (uart_at_read(rsp, sizeof(rsp), 1000) <= 0) { return -3; }\n    return strstr(rsp, \"OK\") ? 0 : -4;\n}\n\n/* 透传发送：连接建立后，写入就是 GATT Notify */\nextern int uart_send(const uint8_t *buf, int n);\nint ble_at_send(const uint8_t *buf, int n) { return uart_send(buf, n); }\n```\n\nSTM32F103 · AT 透传\n\n\n\nesp\\_m20\\_ble.cC\n\n \n\n```text\n/* esp_m20_ble.c — B05-M20 蓝牙 / BLE（ESP32 内置）：广播、GATT、连接参数、低功耗\n * BLE 是事件驱动 + 属性表（GATT service/characteristic）。广播发起连接，连接后可协商参数。 */\n#include <stdint.h>\n\ntypedef int esp_err_t;\ntypedef void *esp_gatt_if_t;\n\nextern esp_err_t esp_bt_controller_init(void *cfg);\nextern esp_err_t esp_bt_controller_enable(int mode);\nextern esp_err_t esp_bluedroid_init(void);\nextern esp_err_t esp_bluedroid_enable(void);\nextern esp_err_t esp_ble_gap_register_callback(void *cb);\nextern esp_err_t esp_ble_gap_set_device_name(const char *name);\nextern esp_err_t esp_ble_gap_config_adv_data(void *adv);\nextern esp_err_t esp_ble_gap_start_advertising(void *params);\nextern esp_err_t esp_ble_gatts_app_register(uint16_t app_id);\nextern esp_err_t esp_ble_gap_update_conn_params(const void *params);\n\n/* 连接参数：interval×1.25ms、latency、timeout×10ms。低功耗设备常增大 latency。 */\ntypedef struct { uint16_t min_int; uint16_t max_int; uint16_t latency; uint16_t timeout; } ble_conn_par_t;\n\nint esp_ble_peripheral_start(const char *name, void *adv, void *adv_params)\n{\n    esp_bt_controller_init((void *)0);\n    esp_bt_controller_enable(0);        /* 0 = BLE */\n    esp_bluedroid_init();\n    esp_bluedroid_enable();\n    esp_ble_gap_register_callback((void *)0);\n    esp_ble_gap_set_device_name(name);\n    esp_ble_gap_config_adv_data(adv);\n    esp_ble_gatts_app_register(0);\n    return esp_ble_gap_start_advertising(adv_params);\n}\n\n/* 连接后请求更省电的参数（外设侧发起） */\nint esp_ble_request_lowpower(void)\n{\n    ble_conn_par_t p = { 80u, 160u, 4u, 600u };   /* 100~200ms 间隔，latency 4 */\n    return esp_ble_gap_update_conn_params(&p);\n}\n\n/* GATT 通知（Notify）：把特征值推给已连接主机 */\nextern esp_err_t esp_ble_gatts_send_indicate(esp_gatt_if_t iface, uint16_t conn_id,\n                                             uint16_t attr_handle, uint16_t len,\n                                             uint8_t *value, int need_confirm);\nint esp_ble_notify(esp_gatt_if_t iface, uint16_t conn_id, uint16_t handle,\n                   uint8_t *data, uint16_t len)\n{\n    return esp_ble_gatts_send_indicate(iface, conn_id, handle, len, data, 0);\n}\n```\n\nESP32 · Bluedroid\n\n\n\nh7\\_m20\\_ble.cC\n\n \n\n```text\n/* h7_m20_ble.c — B05-M20 蓝牙 / BLE（STM32H7）\n * H7 可用 BlueNRG 等 BLE 协处理器（SPI/UART），或 WB 系列内置。这里是“模组 + 命令”的骨架。 */\n#include \"stm32h7_regs.h\"\n#include <string.h>\n\nextern int uart_at_send(const char *cmd);\nextern int uart_at_read(char *buf, int max, int timeout_ms);\n\n/* BlueNRG 风格：初始化 → 设名 → 广播 → 连接后更新参数 */\nint ble_h7_start(const char *name)\n{\n    if (uart_at_send(\"AT+BLEINIT=2\") != 0) { return -1; }   /* 作为外设 */\n    char cmd[64]; int n = 0;\n    const char *p = \"AT+BLENAME=\";\n    while (*p && n < 56) { cmd[n++] = *p++; }\n    while (*name && n < 56) { cmd[n++] = *name++; }\n    cmd[n] = '\\0';\n    if (uart_at_send(cmd) != 0) { return -2; }\n    char rsp[64];\n    if (uart_at_read(rsp, sizeof(rsp), 1000) <= 0) { return -3; }\n    return uart_at_send(\"AT+BLEADVSTART\");                 /* 开始广播 */\n}\n```\n\nSTM32H7 · 协处理器/AT\n\n\n\n表 20.3 三平台 BLE\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 来源 | AT 透传模组 | 内置 BLE | 协处理器/AT |\n| 栈 | 模组内 | Bluedroid/NimBLE | 模组内 |\n| GATT | 透传 | 自定义服务/特征 | 透传 |\n| 连接参数 | AT 配置 | API 协商 | AT 配置 |"}
````



```zhizhan-anchor
m20-check
```



```zhizhan-anchor
m20-check-t
```



## 20.4 连接事件与自检



从机延迟（latency）让设备跳过若干连接事件以省电，代价是响应变慢。



```zhizhan-anchor
fig-图-20-2
```



**图 20.2**  连接事件与从机延迟



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="连接事件与从机延迟" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">35</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">70</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">105</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">140</text><text x="12" y="48" class="sv-lbl">连接事件</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="89" height="22" rx="4" class="sv-cyn-s"></rect><text x="194.3" y="47" text-anchor="middle" class="sv-lbl-hi">E0</text><rect x="283" y="32" width="89" height="22" rx="4" class="sv-cyn-s"></rect><text x="327.1" y="47" text-anchor="middle" class="sv-lbl-hi">E1</text><rect x="416" y="32" width="89" height="22" rx="4" class="sv-cyn-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">E2</text><rect x="681" y="32" width="89" height="22" rx="4" class="sv-cyn-s"></rect><text x="725.7" y="47" text-anchor="middle" class="sv-lbl-hi">E4</text><text x="12" y="82" class="sv-lbl">latency</text><path class="sv-dash" d="M150,78 H770"></path><rect x="283" y="66" width="354" height="22" rx="4" class="sv-amb-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">跳过 E1–E3 省电</text></svg>
```



连接间隔内主从有机会通信；latency 允许从机跳过若干事件；超时内无通信即判断开。



表 20.4 BLE 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 可发现 | 扫描 | 看到广播 |
| 可连接 | 主机连接 | 连接建立 |
| Notify | 写 CCCD 订阅 | 收到通知 |
| 省电 | 调大 interval/latency | 电流下降 |



```zhizhan-anchor
m20-pitfalls
```



```zhizhan-anchor
m20-pitfalls-t
```



## 20.5 常见误区与排障



失败路径与排障




- **参数写错单位** ：interval 是 1.25 ms、timeout 是 10 ms，按 ms 填会离谱。

- **把 BLE 当 WiFi 用** ：BLE 带宽小，不适合大流量。

- **Notify 要 CCCD** ：主机没订阅（写 CCCD）就收不到通知。

- **latency 过大** ：很省电但控制类应用响应跟不上。



◆ 自测 · Module 20（先答再看）




1. 想让 BLE 传感器更省电，能调哪两个参数？代价是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"增大 **连接间隔** 与 **从机延迟** 。代价是数据上报延迟变大、控制响应变慢。"}
   ```

2. 为什么“Notify 发不出去”常常是主机的问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"主机必须先写 CCCD(0x2902) 订阅通知，否则从机发了也不会送达。写 CCCD 是订阅的前提。"}
   ```

3. BLE 连接参数的单位分别是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"连接间隔单位是 1.25 ms，超时单位是 10 ms。按毫秒直接填会导致参数离谱。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的 BLE 外设连接间隔调到省电档，测量电流并记录响应延迟的变化。



核对与延伸：[Bluetooth SIG 规范](https://www.bluetooth.com/specifications/specs/)

 

动手练习



做一次外设：能广播、被连接、通过 Notify 推一条数据；把连接间隔调到省电档并观察响应。



**检查结果：** 设备可被发现并连接；主机写 CCCD 订阅后 Notify 到达；连接参数按 1.25 ms/10 ms 单位可协商。

 

迁移练习：把本章的“能搭建 BLE 外设：广播、建 GATT、用 Notify 推数据，并按 1.25 ms/10 ms 单位调连接参数。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 20 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m20","criterion":"设备可被发现并连接；主机写 CCCD 订阅后 Notify 到达；连接参数按 1.25 ms/10 ms 单位可协商。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
