# USB 与复杂外设入门

```zhizhan-anchor
m14
```



USB 与 UART 最大的区别： **主机主导** 。设备不能主动发，只能在被轮询时响应。描述符必须 ` packed `，否则填充会破坏 ` bLength ` 链导致枚举失败。

 

> 前置：理解设备/主机模型与协议分层，会用抓包工具查看交互。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能读懂设备/配置/接口/端点描述符并用 packed 组织，按端点包长管理缓冲、超长回 STALL。

 

本章速览




- USB 由主机主导，设备只能在被轮询时响应。

- 描述符必须 packed，否则 bLength 错位、枚举失败。

- 经典 ESP32 无原生 USB；H7 有 OTG HS（走 [DMA](term:dma)）。

 

```zhizhan-anchor
m14-model
```



```zhizhan-anchor
m14-model-t
```



## 14.1 主机主导与枚举



USB 与 UART 最大的区别： **主机主导** 。设备不能“主动发”，只能在被轮询时响应。枚举 = 主机读设备描述符、分配地址、选择配置。理解枚举最好的办法是抓包看一遍。



```zhizhan-anchor
fig-图-14-1
```



**图 14.1**  USB 枚举的报文序列



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="USB 枚举的报文序列" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">取 8B 描述符</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">分配地址</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">取完整描述符</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">设置配置</text></svg>
```



主机复位/取设备描述符(8B) → 分配地址 → 取完整描述符 → 设配置 → 进入就绪。



表 14.1 USB 描述符



| 描述符 | 作用 | 关键字段 |
| --- | --- | --- |
| Device | 设备基本信息 | VID/PID、bMaxPacketSize0 |
| Configuration | 配置集合 | bNumInterfaces、总长度 |
| Interface | 功能接口 | bInterfaceClass（CDC=0x02） |
| Endpoint | 数据通道 | 地址、方向、wMaxPacketSize |



```zhizhan-anchor
m14-evidence
```



```zhizhan-anchor
m14-evidence-t
```



## 14.2 真实证据：packed 描述符与体积



` size m14_usb.o ` → text= **46**  B：描述符是只读常量，放在 ` .rodata `。描述符必须 ` packed `，否则填充会破坏 bLength 链：



m14\_usb.c 节选C

 

```text
__attribute__((packed)) static const uint8_t dev_desc[] = {
    0x12, 0x01,        // bLength=18, DEVICE
    0x00, 0x02,        // bcdUSB=2.00
    0x02, 0x00, 0x00,  // class/subclass/protocol
    0x40,              // bMaxPacketSize0=64
    0x34, 0x12, 0x78, 0x56,  // idVendor/idProduct
    /* ... */
};
```

真实反汇编对应 .rodata 常量；packed 保证 bLength 链不错位



表 14.2 USB 常见现象



| 现象 | 原因 | 修正 |
| --- | --- | --- |
| 枚举失败 | 描述符未 packed | 加 packed |
| 设备“不主动” | 违反主机主导模型 | 改为被轮询响应 |
| 传输挂起 | 端点半包语义 | 处理短/零长包 |
| 越界/崩溃 | 超长请求截断 | 回 STALL |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm14-plat\n```\n\n\n\n```zhizhan-anchor\nm14-plat-t\n```\n\n\n\n## 14.3 三平台对照：USB\n\n\n\n三平台 USB 支持不同：F103 用内置 USB FS \\+ 库；ESP32-S2/S3 有 OTG；H7 有 OTG HS/FS。三份代码均已交叉编译。\n\n\n\nm14\\_usb.cC\n\n \n\n```text\n/* m14_usb.c — B05-M14 USB 与复杂外设入门\n * CDC 设备描述符 + 端点状态机骨架（不依赖 USB 协议栈，仅硬件相关的描述符与状态）。\n * 注意：描述符必须 __attribute__((packed))，否则编译器插入填充会破坏 bLength 链路。 */\n#include <stdint.h>\n\n#define USB_DT_DEVICE    0x01u\n#define USB_DT_CONFIG    0x02u\n#define USB_DT_STRING    0x03u\n#define USB_DT_INTERFACE 0x04u\n#define USB_DT_ENDPOINT  0x05u\n\ntypedef struct __attribute__((packed)) {\n    uint8_t  bLength;\n    uint8_t  bDescriptorType;\n    uint16_t bcdUSB;\n    uint8_t  bDeviceClass;\n    uint8_t  bDeviceSubClass;\n    uint8_t  bDeviceProtocol;\n    uint8_t  bMaxPacketSize0;\n    uint16_t idVendor;\n    uint16_t idProduct;\n    uint16_t bcdDevice;\n    uint8_t  iManufacturer;\n    uint8_t  iProduct;\n    uint8_t  iSerialNumber;\n    uint8_t  bNumConfigurations;\n} usb_device_desc_t;\n\ntypedef struct __attribute__((packed)) {\n    uint8_t  bLength;\n    uint8_t  bDescriptorType;\n    uint8_t  bEndpointAddress;\n    uint8_t  bmAttributes;\n    uint16_t wMaxPacketSize;\n    uint8_t  bInterval;\n} usb_endpoint_desc_t;\n\nstatic const usb_device_desc_t g_dev_desc = {\n    .bLength = sizeof(usb_device_desc_t), .bDescriptorType = USB_DT_DEVICE,\n    .bcdUSB = 0x0200u, .bDeviceClass = 0x02u /* CDC */, .bMaxPacketSize0 = 64u,\n    .idVendor = 0x0483u, .idProduct = 0x5740u, .bcdDevice = 0x0100u,\n    .bNumConfigurations = 1u\n};\n\n/* 端点收发状态：USB 是主机驱动的，设备只能在被轮询时响应，不能“主动发” */\ntypedef enum { EP_IDLE, EP_RX_READY, EP_TX_BUSY, EP_STALLED } ep_state_t;\n\ntypedef struct {\n    ep_state_t state;\n    uint16_t   rx_len;\n    uint16_t   tx_len;\n    uint8_t    buf[64];\n} usb_ep_t;\n\nvoid usb_ep_on_setup(usb_ep_t *ep, uint16_t len)\n{\n    if (len > sizeof(ep->buf)) {\n        ep->state = EP_STALLED;      /* 超长请求：按规范回 STALL，而不是截断 */\n        return;\n    }\n    ep->rx_len = len;\n    ep->state = EP_RX_READY;\n}\n\nvoid usb_ep_clear_stall(usb_ep_t *ep) { ep->state = EP_IDLE; }\n\nconst usb_device_desc_t *usb_device_descriptor(void) { return &g_dev_desc; }\n```\n\nSTM32F103 · USB FS/CDC\n\n\n\nesp\\_m14\\_usb.cC\n\n \n\n```text\n/* esp_m14_usb.c — ESP32 的 USB：经典 ESP32 无原生 USB 设备控制器\n * 与 STM32/H7 自带 USB 外设不同：\n *   · 经典 ESP32：只有 UART 桥（外置 USB-UART 芯片），不是真 USB 设备；\n *   · ESP32-S2/S3/C3 等：有内置 USB Serial/JTAG 或全速 USB-OTG，可跑 TinyUSB/CDC。 */\n#include <stdint.h>\n\ntypedef struct __attribute__((packed)) {\n    uint8_t  bLength;\n    uint8_t  bDescriptorType;\n    uint16_t bcdUSB;\n    uint8_t  bDeviceClass;\n    uint8_t  bDeviceSubClass;\n    uint8_t  bDeviceProtocol;\n    uint8_t  bMaxPacketSize0;\n    uint16_t idVendor;\n    uint16_t idProduct;\n    uint16_t bcdDevice;\n    uint8_t  iManufacturer;\n    uint8_t  iProduct;\n    uint8_t  iSerialNumber;\n    uint8_t  bNumConfigurations;\n} esp_usb_device_desc_t;\n\n/* 在支持 USB 的型号上，TinyUSB 暴露 tud_* 回调与描述符表；结构与 STM32 等价 */\nstatic const esp_usb_device_desc_t g_esp_dev = {\n    .bLength = sizeof(esp_usb_device_desc_t), .bDescriptorType = 0x01u,\n    .bcdUSB = 0x0200u, .bDeviceClass = 0x02u, .bMaxPacketSize0 = 64u,\n    .idVendor = 0x303Au, .idProduct = 0x4002u, .bNumConfigurations = 1u\n};\n\nconst esp_usb_device_desc_t *esp_usb_descriptor(void) { return &g_esp_dev; }\n\n/* 经典 ESP32 的“替代实验”：用 UART0 经外置桥做虚拟串口，功能等价但非 USB 设备本身 */\nint esp_uart_bridge_available(void) { return 1; }\n```\n\nESP32-S3 · TinyUSB\n\n\n\nh7\\_m14\\_usb.cC\n\n \n\n```text\n/* h7_m14_usb.c — STM32H7 USB OTG HS/FS：描述符结构与 F1 相同，控制器与 DMA 不同\n * H7 的 OTG_HS 可达 480Mbps（需 ULPI PHY），端点为 FIFO 模式，DMA 配置更复杂。 */\n#include <stdint.h>\n\ntypedef struct __attribute__((packed)) {\n    uint8_t  bLength;\n    uint8_t  bDescriptorType;\n    uint16_t bcdUSB;\n    uint8_t  bDeviceClass;\n    uint8_t  bDeviceSubClass;\n    uint8_t  bDeviceProtocol;\n    uint8_t  bMaxPacketSize0;\n    uint16_t idVendor;\n    uint16_t idProduct;\n    uint16_t bcdDevice;\n    uint8_t  iManufacturer;\n    uint8_t  iProduct;\n    uint8_t  iSerialNumber;\n    uint8_t  bNumConfigurations;\n} h7_usb_device_desc_t;\n\nstatic const h7_usb_device_desc_t g_h7_dev = {\n    .bLength = sizeof(h7_usb_device_desc_t), .bDescriptorType = 0x01u,\n    .bcdUSB = 0x0200u, .bDeviceClass = 0x02u, .bMaxPacketSize0 = 64u,\n    .idVendor = 0x0483u, .idProduct = 0x5740u, .bNumConfigurations = 1u\n};\n\n/* OTG_HS 端点 FIFO 需要按字数分配；这是 F1（USB FS 固定缓冲）没有的一步 */\nvoid h7_usb_ep_fifo_alloc(uint16_t *dfifo_words)\n{\n    uint16_t *p = dfifo_words;\n    p[0] = 128u;   /* EP0 RX 字数（示意） */\n    p[1] = 0u;\n    p[2] = 64u;    /* EP1 TX */\n}\n\nconst h7_usb_device_desc_t *h7_usb_descriptor(void) { return &g_h7_dev; }\n```\n\nSTM32H7 · OTG\n\n\n\n表 14.3 三平台 USB\n\n\n\n| 维度 | STM32F103 | ESP32-S3 | STM32H7 |\n| --- | --- | --- | --- |\n| 控制器 | USB FS | OTG FS/HS | OTG HS/FS |\n| 栈 | 厂商库/TinyUSB | TinyUSB | 厂商/TinyUSB |\n| 类 | CDC/HID | CDC/HID/MSC | CDC/HID/MSC |\n| 抓包 | Wireshark\\+USBPcap | 同左 | 同左 |"}
````



```zhizhan-anchor
m14-check
```



```zhizhan-anchor
m14-check-t
```



## 14.4 端点与缓冲自检



端点有固定包长，超过要分多次；超长请求按规范回 STALL，而不是截断。



```zhizhan-anchor
fig-图-14-2
```



**图 14.2**  端点与包长



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="端点与包长" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">Endpoint IN（设备→主机）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">Endpoint OUT（主机→设备）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">wMaxPacketSize（每包上限）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">超长 → STALL（不截断）</text></svg>
```



端点地址含方向（IN/OUT），wMaxPacketSize 决定每包上限。超长要分包；非法/超长回 STALL。



表 14.4 USB 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 识别 | 抓枚举看 VID/PID | 与固件一致 |
| 描述符链 | bLength 逐条 | 不错位 |
| 包长 | 超长请求 | 分包/STALL |
| [背压](term:backpressure) | 拔插/满缓冲 | 不丢不崩 |



```zhizhan-anchor
m14-pitfalls
```



```zhizhan-anchor
m14-pitfalls-t
```



## 14.5 常见误区与排障



失败路径与排障




- **描述符没 packed** ：填充导致 bLength 错位，枚举失败。

- **把设备当主机** ：指望设备主动发数据，违反 USB 模型。

- **忽略端点半包** ：短包/零长度包语义搞错，传输挂起。

- **超长请求截断** ：应回 STALL，不可越界拷贝。



◆ 自测 · Module 14（先答再看）




1. 为什么 USB 枚举失败时，第一件事是抓包而不是改代码？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"枚举是主机与设备的报文交互，抓包能定位是描述符错误、地址分配还是配置阶段失败，比盲改代码高效。"}
   ```

2. 描述符为什么必须 ` packed `？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则编译器插入的填充会破坏 bLength 字段链，主机按 bLength 逐条解析时错位，导致枚举失败。"}
   ```

3. 收到超过端点包长或非法请求应该怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"按规范回 STALL（拒绝），而不是截断或越界拷贝。截断/越界会造成主机解析错误或内存破坏。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用 Wireshark\+USBPcap 抓一次你设备的枚举，核对 VID/PID、接口类与端点描述符。



核对与延伸：[USB in a NutShell](https://www.beyondlogic.org/usbnutshell/usb1.shtml)

 

动手练习



在支持 USB 的板上实现 CDC：抓一次枚举，确认 VID/PID 与接口类；处理拔插与背压。



**检查结果：** 主机能识别设备（VID/PID、bMaxPacketSize0 正确）；描述符 bLength 链因 packed 不错位；超长请求被 STALL。

 

迁移练习：把本章的“能读懂设备/配置/接口/端点描述符并用 packed 组织，按端点包长管理缓冲、超长回 STALL。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 14 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m14","criterion":"主机能识别设备（VID/PID、bMaxPacketSize0 正确）；描述符 bLength 链因 packed 不错位；超长请求被 STALL。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
