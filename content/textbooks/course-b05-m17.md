# 现场总线：CAN / RS-485 / Modbus / 1-Wire

```zhizhan-anchor
m17
```



串行总线不止 UART/[I²C](term:i2c)/SPI： **CAN**  多主 \+ 非破坏性仲裁； **RS-485**  差分半双工，常跑  **Modbus RTU** ； **1-Wire**  一根线兼供电与数据。共性陷阱是终端/上拉与位定时。

 

> 前置：掌握 UART/差分物理层概念，了解基本校验与分帧。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能配置 CAN 位定时与终端、RS-485 方向控制、Modbus CRC 组帧和 1-Wire 时序，并排障。

 

本章速览




- 总线选型：CAN 多主，RS-485\+Modbus 一主多从，1-Wire 单线。

- CAN 要位定时与终端；RS-485 方向切换必须等 TC。

- Modbus 靠帧间静默分帧 \+ CRC 校验，缺一不可。

 

```zhizhan-anchor
m17-buses
```



```zhizhan-anchor
m17-buses-t
```



## 17.1 三种总线的取舍



CAN 多主、带仲裁与 CRC、抗干扰；RS-485 是差分物理层、常跑 Modbus RTU；1-Wire 一根线兼供电与数据，适合单点温度等。



```zhizhan-anchor
fig-图-17-1
```



**图 17.1**  CAN 的非破坏性仲裁



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="CAN 的非破坏性仲裁" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">同时发</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">逐位竞争</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">输者退让</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">赢者继续</text></svg>
```



多节点同时发：按 ID 逐位竞争，显性(0)覆盖隐性(1)，输者自动退让并转接收，不丢帧。



表 17.1 三种现场总线



| 总线 | 物理层 | 拓扑/多主 | 速率 | 协议层 |
| --- | --- | --- | --- | --- |
| CAN | 差分 CANH/CANL | 多主 \+ 仲裁 | ≤1 Mbps | CANopen/J1939 |
| RS-485 | 差分 A/B | 半双工多从 | ≤10 Mbps 短距 | Modbus RTU |
| 1-Wire | 单线 \+ 寄生供电 | 一主多从 | 低速 | DS18B20 等 |



```zhizhan-anchor
m17-frame
```



```zhizhan-anchor
m17-frame-t
```



## 17.2 组帧与校验



Modbus 靠 **帧间静默** （3.5 字符）分帧、用 CRC 判好坏；CAN 用帧 CRC 与错误计数管理；1-Wire 靠严格位时隙。



m17\_can.c 节选C

 

```text
/* Modbus RTU CRC16 */
uint16_t crc = 0xFFFF;
for (i = 0; i < len; i++) {
    crc ^= buf[i];
    for (k = 0; k < 8; k++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
}
/* CAN 位定时：BS1/BS2/Prescaler 决定采样点与波特率；终端 120Ω */
```

真实反汇编对应 CRC 循环；位定时与终端决定 CAN 是否误进错误态



表 17.2 分帧与校验



| 总线 | 分帧/校验 | 常见错误 |
| --- | --- | --- |
| CAN | 帧 CRC \+ 位定时 | 无终端/位定时错 |
| Modbus | 3.5 字符静默 \+ CRC16 | 粘包/无静默 |
| 1-Wire | 复位脉冲 \+ 位时隙 | 时隙太短/太长 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm17-plat\n```\n\n\n\n```zhizhan-anchor\nm17-plat-t\n```\n\n\n\n## 17.3 三平台对照：现场总线\n\n\n\n三平台现场总线控制器不同：F103 用 bxCAN；ESP32 用 TWAI；H7 用 FDCAN。三份代码均已交叉编译。\n\n\n\nm17\\_can.cC\n\n \n\n```text\n/* m17_can.c — B05-M17 有线现场总线（STM32F103）\n * ① bxCAN：位定时 + 发送/接收；② RS-485 半双工方向控制；③ Modbus RTU 的 CRC16；④ 1-Wire 位操作。 */\n#include \"stm32f103_regs.h\"\n\n/* ---- ① bxCAN：0x40006400 ---- */\n#define CAN_BASE 0x40006400u\n#define CAN_MCR  R32(CAN_BASE + 0x00u)\n#define CAN_MSR  R32(CAN_BASE + 0x04u)\n#define CAN_TSR  R32(CAN_BASE + 0x08u)\n#define CAN_RF0R R32(CAN_BASE + 0x0Cu)\n#define CAN_BTR  R32(CAN_BASE + 0x1Cu)\n#define CAN_TI0R R32(CAN_BASE + 0x180u)\n#define CAN_TDT0R R32(CAN_BASE + 0x184u)\n#define CAN_TDL0R R32(CAN_BASE + 0x188u)\n#define CAN_TDH0R R32(CAN_BASE + 0x18Cu)\n#define CAN_RI0R R32(CAN_BASE + 0x1B0u)\n#define CAN_RDL0R R32(CAN_BASE + 0x1B8u)\n#define CAN_RDH0R R32(CAN_BASE + 0x1BCu)\n#define CAN_TI0R_TXRQ (1u << 0)\n\nint can_init(uint32_t prescaler, uint32_t bs1, uint32_t bs2)\n{\n    RCC_APB1ENR |= (1u << 25);              /* CANEN */\n    CAN_MCR |= (1u << 0);                   /* INRQ：进入初始化 */\n    for (uint32_t t = 0; t < 100000u && !(CAN_MSR & (1u << 0)); ++t) { }\n    if (!(CAN_MSR & (1u << 0))) { return -1; }\n    CAN_BTR = ((bs2 - 1u) << 20) | ((bs1 - 1u) << 16) | (prescaler - 1u);\n    CAN_MCR &= ~(1u << 0);                  /* 退出初始化 */\n    for (uint32_t t = 0; t < 100000u && (CAN_MSR & (1u << 0)); ++t) { }\n    return (CAN_MSR & (1u << 0)) ? -2 : 0;\n}\n\nint can_send(uint32_t std_id, const uint8_t data[8], uint8_t dlc)\n{\n    if (CAN_TSR & (1u << 26)) { return -1; }   /* 邮箱 0 未空 */\n    CAN_TDT0R = dlc;\n    CAN_TDL0R = (uint32_t)data[0] | ((uint32_t)data[1] << 8)\n              | ((uint32_t)data[2] << 16) | ((uint32_t)data[3] << 24);\n    CAN_TDH0R = (uint32_t)data[4] | ((uint32_t)data[5] << 8)\n              | ((uint32_t)data[6] << 16) | ((uint32_t)data[7] << 24);\n    CAN_TI0R = (std_id << 21) | CAN_TI0R_TXRQ;\n    return 0;\n}\n\nuint32_t can_recv(uint8_t out[8])\n{\n    if (!(CAN_RF0R & 0x3u)) { return 0xFFFFFFFFu; }  /* 无报文 */\n    uint32_t id = CAN_RI0R >> 21;\n    uint32_t lo = CAN_RDL0R, hi = CAN_RDH0R;\n    out[0] = (uint8_t)lo; out[1] = (uint8_t)(lo >> 8); out[2] = (uint8_t)(lo >> 16); out[3] = (uint8_t)(lo >> 24);\n    out[4] = (uint8_t)hi; out[5] = (uint8_t)(hi >> 8); out[6] = (uint8_t)(hi >> 16); out[7] = (uint8_t)(hi >> 24);\n    CAN_RF0R = (1u << 5);                   /* RFOM0=1 释放 FIFO0 输出邮箱（写 bit0 是只读计数，无效） */\n    return id;\n}\n\n/* ---- ② RS-485 半双工：发送前拉 DE，发完（TC）再拉低 ---- */\nvoid rs485_begin_tx(void) { GPIOA->BSRR = (1u << 1); }        /* DE=PA1 高 */\nvoid rs485_end_tx(void)   { GPIOA->BSRR = (1u << (1 + 16)); } /* DE 低 */\n\n/* ---- ③ Modbus RTU CRC16（多项式 0xA001，反射，初值 0xFFFF） ---- */\nuint16_t modbus_crc16(const uint8_t *p, uint32_t n)\n{\n    uint16_t crc = 0xFFFFu;\n    for (uint32_t i = 0; i < n; ++i) {\n        crc ^= p[i];\n        for (int b = 0; b < 8; ++b) {\n            crc = (crc & 1u) ? (uint16_t)((crc >> 1) ^ 0xA001u) : (uint16_t)(crc >> 1);\n        }\n    }\n    return crc;\n}\n\n/* ---- ④ 1-Wire 位操作（开漏 + 外部上拉） ---- */\n#define OW_PIN 12u\nstatic void ow_release(void) { GPIOB->BSRR = (1u << OW_PIN); }          /* 释放=高 */\nstatic void ow_drive_low(void) { GPIOB->BSRR = (1u << (OW_PIN + 16)); } /* 拉低 */\nstatic void ow_delay(uint32_t n) { while (n--) { __asm volatile (\"nop\"); } }\n\nint ow_reset(void)\n{\n    ow_drive_low(); ow_delay(480);          /* 复位脉冲 ≥480µs */\n    ow_release(); ow_delay(70);\n    int presence = (GPIOB->IDR & (1u << OW_PIN)) == 0u;  /* 从机拉低=存在 */\n    ow_delay(410);\n    return presence;\n}\n```\n\nSTM32F103 · bxCAN \\+ Modbus \\+ 1-Wire\n\n\n\nesp\\_m17\\_twai.cC\n\n \n\n```text\n/* esp_m17_twai.c — B05-M17 CAN（ESP32 / TWAI 控制器）+ RS-485（UART RTS 半双工）\n * ESP32 内置 TWAI（CAN 2.0B）控制器，需外接收发器。 */\n#include <stdint.h>\n\n/* ---- TWAI（CAN）：ESP-IDF API ---- */\ntypedef struct { int baud_rate; int tx_io; int rx_io; } twai_timing_t;\nextern int twai_driver_install(const void *timing, const void *filter, const void *alerts);\nextern int twai_start(void);\nextern int twai_transmit(const void *msg, int ticks_to_wait);\nextern int twai_receive(void *msg, int ticks_to_wait);\nextern int twai_driver_uninstall(void);\n\nint esp_can_init(int tx_io, int rx_io, int baud)\n{\n    twai_timing_t t = { baud, tx_io, rx_io };\n    int a = twai_driver_install(&t, (const void *)0, (const void *)0);\n    return a == 0 ? twai_start() : a;\n}\n\nint esp_can_send(const void *msg) { return twai_transmit(msg, 10); }\nint esp_can_recv(void *msg) { return twai_receive(msg, 10); }\n\n/* ---- RS-485：UART 半双工模式，由硬件自动控制 RTS 方向（省去手动 DE） ---- */\nextern int uart_set_mode(int port, int mode);\n#define ESP_UART_MODE_RS485_HALF_DUPLEX 0\nint esp_rs485_enable(int port) { return uart_set_mode(port, ESP_UART_MODE_RS485_HALF_DUPLEX); }\n\n/* Modbus RTU CRC16 与平台无关，可直接复用（见 STM32F103 版） */\nuint16_t esp_modbus_crc16(const uint8_t *p, uint32_t n)\n{\n    uint16_t crc = 0xFFFFu;\n    for (uint32_t i = 0; i < n; ++i) {\n        crc ^= p[i];\n        for (int b = 0; b < 8; ++b) {\n            crc = (crc & 1u) ? (uint16_t)((crc >> 1) ^ 0xA001u) : (uint16_t)(crc >> 1);\n        }\n    }\n    return crc;\n}\n```\n\nESP32 · TWAI(CAN)\n\n\n\nh7\\_m17\\_fdcan.cC\n\n \n\n```text\n/* h7_m17_fdcan.c — B05-M17 CAN（STM32H7 / FDCAN，Bosch M_CAN 内核）\n * 与 F1 的 bxCAN 不同：FDCAN 用消息 RAM + 描述符环，支持 CAN-FD。这里给初始化与发送骨架。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_FDCAN_BASE 0x4000A000u\n#define H7_FDCAN_CCCR R32(H7_FDCAN_BASE + 0x18u)\n#define H7_FDCAN_NBTP R32(H7_FDCAN_BASE + 0x1Cu)\n#define H7_FDCAN_TXBAR R32(H7_FDCAN_BASE + 0x90u)\n#define H7_FDCAN_IR    R32(H7_FDCAN_BASE + 0x40u)\n#define H7_CCCR_INIT  (1u << 0)\n#define H7_CCCR_CCE   (1u << 1)\n\n/* 消息 RAM 起始地址由 FDCAN->SIDFC/XIDFC 等指向的存储区决定（见 RM0433） */\nextern volatile uint32_t g_fdcan_msg_ram[64];\n\nint h7_fdcan_init(uint32_t nbtp_value)\n{\n    R32(0x580244E8u) |= (1u << 28);          /* 开 FDCAN 时钟（示意） */\n    H7_FDCAN_CCCR |= H7_CCCR_INIT | H7_CCCR_CCE;\n    H7_FDCAN_NBTP = nbtp_value;              /* 位定时：见 RM0433 的 NBTP 字段 */\n    H7_FDCAN_CCCR &= ~H7_CCCR_INIT;          /* 退出初始化，进入正常 */\n    return (H7_FDCAN_CCCR & H7_CCCR_INIT) ? -1 : 0;\n}\n\n/* 把报文写进 TX 缓冲元素，再置 TXBAR 请求发送（描述符环的规则见手册） */\nvoid h7_fdcan_send(uint32_t id, const uint8_t *data, uint8_t len)\n{\n    (void)id; (void)data; (void)len;\n    H7_FDCAN_TXBAR = 1u;                     /* 请求发送缓冲 0 */\n}\n\nint h7_fdcan_poll(void) { return (int)(H7_FDCAN_IR & 1u); }\n```\n\nSTM32H7 · FDCAN\n\n\n\n表 17.3 三平台现场总线\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| CAN | bxCAN | TWAI | FDCAN(M\\_CAN) |\n| 速率 | ≤1 Mbps | ≤1 Mbps | CAN-FD 更高 |\n| RS-485 | UART\\+DE | UART\\+RS485 | UART\\+DE |\n| 1-Wire | 软件时序 | RMT 时序 | 软件时序 |"}
````



```zhizhan-anchor
m17-check
```



```zhizhan-anchor
m17-check-t
```



## 17.4 总线自检



现场总线排障先看物理层（终端/上拉/位定时），再看协议层（分帧/CRC）。



```zhizhan-anchor
fig-图-17-2
```



**图 17.2**  现场总线排障顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="现场总线排障顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">物理层</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">波形</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">分帧</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">CRC/错误计数</text></svg>
```



物理层（终端/上拉/位定时）→ 总线电平/波形 → 帧分界（静默）→ CRC/错误计数。



表 17.4 现场总线自检



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| CAN 终端 | 测 120Ω | 两端各 120Ω |
| CAN 错误计数 | 读寄存器 | 不进错误被动 |
| Modbus CRC | 校验帧 | 通过 |
| 1-Wire | 复位脉冲 | 检测到应答 |



```zhizhan-anchor
m17-pitfalls
```



```zhizhan-anchor
m17-pitfalls-t
```



## 17.5 常见误区与排障



失败路径与排障




- **CAN 无终端电阻** ：反射导致误码、错误计数上升。

- **RS-485 一收完就拉低 DE** ：应等 TC，否则尾字节残缺。

- **Modbus 无帧间静默** ：粘包被当成一帧，解析错乱。

- **1-Wire 时序不够** ：位时隙太短/太长，从机不应答。



◆ 自测 · Module 17（先答再看）




1. CAN 与 RS-485 都差分、都抗干扰，为什么 CAN 能多主而 RS-485 通常一主多从？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CAN 在协议层有非破坏性仲裁（按 ID 逐位竞争）与错误管理；RS-485 只是电气层，多主冲突需应用层解决，故常见 Modbus 主从轮询。"}
   ```

2. RS-485 什么时候才能拉低 DE？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"要等  **TC（发送完成）** 而不是 TXE，否则最后几位移出不完整，从机收到残缺数据。"}
   ```

3. Modbus RTU 如何分帧？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"靠帧间静默（3.5 字符）分帧，再用 CRC16 校验帧完整性。没有静默会把粘连的帧当成一帧。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你项目的 CAN 总线核对两端 120Ω 终端与位定时，并读一次错误计数确认不进错误被动。



核对与延伸：[ESP-IDF TWAI(CAN) 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/twai.html) · [Modbus 应用协议规范](https://modbus.org/specs.php)

 

动手练习



两节点互发 CAN 报文并读错误计数；RS-485 上跑一帧 Modbus 并核对 CRC；用 1-Wire 复位脉冲探测从机存在。



**检查结果：** CAN 稳定收发且不误进错误态；Modbus 帧 CRC 校验通过、帧间静默 3.5 字符；1-Wire 能检测到从机应答脉冲。

 

迁移练习：把本章的“能配置 CAN 位定时与终端、RS-485 方向控制、Modbus CRC 组帧和 1-Wire 时序，并排障。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 17 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m17","criterion":"CAN 稳定收发且不误进错误态；Modbus 帧 CRC 校验通过、帧间静默 3.5 字符；1-Wire 能检测到从机应答脉冲。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
