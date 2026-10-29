# Modbus

```zhizhan-anchor
m03
```



RTU 帧与 CRC、功能码、寄存器映射设计、异常响应、超时与轮询调度；Modbus TCP 对照。

 

> 前置：了解串口/RS-485 半双工通信与 16 位寄存器的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能构造并解析 Modbus RTU 请求/响应帧，正确计算 CRC16、按大端读取寄存器并识别异常响应。

 

本章速览




- Modbus RTU 靠帧间静默 \+ CRC 分帧；整帧再算 CRC 应为 0。

- 功能码最高位置 1 = 异常；异常码要能区分地址错/数值错。

- 寄存器映射要成文；轮询要有超时与重试，不能拖死主机。

 

```zhizhan-anchor
m03-modbus
```



```zhizhan-anchor
m03-modbus-t
```



## 3.1 RTU 帧与寄存器映射



Modbus 是一主多从、主机轮询从机应答。RTU 用帧间静默（约 3.5 字符时间）分帧，用 CRC16 校验；整帧（含 CRC）再算一次应为 0。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  Modbus RTU 帧



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="Modbus RTU 帧" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">地址</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">功能码</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="117.0" class="sv-lbl-hi">数据</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">CRC</text></svg>
```



地址 | 功能码 | 数据 | CRC(低字节在前)。整帧再算 CRC=0 表示自洽。



表 3.1 Modbus 要素



| 要素 | 规则 | 实践 |
| --- | --- | --- |
| 功能码 | 0x03 读保持、0x06 写单个 | 只实现需要的，明确异常码 |
| 寄存器映射 | 地址→物理量\+单位\+缩放 | 写入文档、版本化 |
| 异常响应 | 功能码最高位置 1 \+ 异常码 | 区分地址错/数值错 |
| 轮询 | 一主多从、超时重试 | 设响应超时、失败退让 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：请求自洽与异常解析



下面这段主机程序构造请求、验证整帧 CRC 自洽，并解析正常/异常响应：



host\_modbus.cC

 

```text
/* host_modbus.c —— Modbus RTU 帧构造/解析与 CRC 自洽（主机可运行）。
 *
 * Modbus RTU 的不变量：把 CRC 也算进去后，整帧再算一遍 CRC16/MODBUS 必须等于 0。
 * 本程序据此校验请求帧，并解析一条正常响应与一条异常响应。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_modbus.c -o host_modbus && ./host_modbus
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}
static int append_crc(uint8_t *f, int n) {
    uint16_t c = crc16(f, n);
    f[n++] = (uint8_t)(c & 0xFF);        /* Modbus：低字节在前 */
    f[n++] = (uint8_t)(c >> 8);
    return n;
}
static void print_hex(const char *tag, const uint8_t *p, int n) {
    printf("%s", tag);
    for (int i = 0; i < n; i++) printf("%02X%s", p[i], i + 1 < n ? " " : "");
    printf("\n");
}

int main(void) {
    int ok = 1, n;
    uint8_t req[16];

    /* 请求：从站 1，功能 0x03（读保持寄存器），起始 0x0000，数量 0x000A */
    n = 0;
    req[n++] = 0x01; req[n++] = 0x03;
    req[n++] = 0x00; req[n++] = 0x00;
    req[n++] = 0x00; req[n++] = 0x0A;
    n = append_crc(req, n);
    print_hex("请求帧: ", req, n);
    printf("整帧 CRC 自洽（含 CRC 再算=0）：%s\n", crc16(req, n) == 0 ? "是" : "否");
    if (n != 8 || crc16(req, n) != 0) ok = 0;

    /* 正常响应：01 03 04 AA BB CC DD + CRC → 两个 16 位寄存器 0xAABB、0xCCDD（线上大端） */
    uint8_t resp[16]; int rn = 0;
    resp[rn++] = 0x01; resp[rn++] = 0x03; resp[rn++] = 0x04;
    resp[rn++] = 0xAA; resp[rn++] = 0xBB; resp[rn++] = 0xCC; resp[rn++] = 0xDD;
    rn = append_crc(resp, rn);
    print_hex("响应帧: ", resp, rn);
    if (crc16(resp, rn) != 0) ok = 0;
    int bc = resp[2];
    uint16_t v0 = (uint16_t)((resp[3] << 8) | resp[4]);
    uint16_t v1 = (uint16_t)((resp[5] << 8) | resp[6]);
    printf("字节数=%d 寄存器0=0x%04X 寄存器1=0x%04X（期望 0xAABB / 0xCCDD）\n", bc, v0, v1);
    if (!(bc == 4 && v0 == 0xAABB && v1 == 0xCCDD)) ok = 0;

    /* 异常响应：功能码最高位置 1，异常码 0x02（非法数据地址） */
    uint8_t exc[8]; int en = 0;
    exc[en++] = 0x01; exc[en++] = 0x83; exc[en++] = 0x02;
    en = append_crc(exc, en);
    print_hex("异常帧: ", exc, en);
    int is_exc = (exc[1] & 0x80) != 0;
    printf("是否异常响应=%s 异常码=0x%02X（期望异常、0x02）\n", is_exc ? "是" : "否", exc[2]);
    if (!(is_exc && exc[2] == 0x02)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

Modbus RTU 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_modbus.c -o labs/host_modbus && ./labs/host_modbus
请求帧: 01 03 00 00 00 0A C5 CD
整帧 CRC 自洽（含 CRC 再算=0）：是
响应帧: 01 03 04 AA BB CC DD 3E 97
字节数=4 寄存器0=0xAABB 寄存器1=0xCCDD
异常帧: 01 83 02 C0 F1
是否异常响应=是 异常码=0x02
RESULT: PASS
```



请求整帧再算 CRC=0；响应按大端读出 0xAABB/0xCCDD；异常帧 0x83 被识别、异常码 0x02。



表 3.2 Modbus 帧



| 帧 | 内容 | 判定 |
| --- | --- | --- |
| 请求 | 01 03 00 00 00 0A C5 CD | CRC 自洽=0 |
| 响应 | 01 03 04 AA BB CC DD … | 寄存器 0xAABB/0xCCDD |
| 异常 | 01 83 02 C0 F1 | 功能码 0x83、异常码 0x02 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm03-plat\n```\n\n\n\n```zhizhan-anchor\nm03-plat-t\n```\n\n\n\n## 3.3 三平台对照：Modbus 收发\n\n\n\n三平台的串口/RS-485 驱动不同，但帧格式、CRC 与异常语义一致。\n\n\n\nm03\\_modbus.cC\n\n \n\n```text\n/* m03_modbus.c —— 组 Modbus RTU 请求并发送（Cortex-M3）。\n * 帧：addr|func|reg_hi|reg_lo|qty_hi|qty_lo|crc_lo|crc_hi。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nint modbus_read_holding(uint8_t addr, uint16_t reg, uint16_t qty) {\n    uint8_t f[8];\n    f[0] = addr;\n    f[1] = 0x03;                         /* 功能码：读保持寄存器 */\n    f[2] = (uint8_t)(reg >> 8);\n    f[3] = (uint8_t)reg;\n    f[4] = (uint8_t)(qty >> 8);\n    f[5] = (uint8_t)qty;\n    uint16_t c = crc16_modbus(f, 6);\n    f[6] = (uint8_t)(c & 0xFF);          /* Modbus：CRC 低字节在前 */\n    f[7] = (uint8_t)(c >> 8);\n    return uart_send(f, 8u);\n}\n```\n\nSTM32F103 · Modbus RTU\n\n\n\nesp\\_m03\\_modbus.cC\n\n \n\n```text\n/* esp_m03_modbus.c —— ESP32 侧发 Modbus 请求（Xtensa）。\n * 组帧逻辑与设备端一致；发送走 UART 驱动。 */\n#include <stdint.h>\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nint esp_modbus_read(uint8_t addr, uint16_t reg, uint16_t qty) {\n    uint8_t f[8];\n    f[0] = addr; f[1] = 0x03;\n    f[2] = (uint8_t)(reg >> 8); f[3] = (uint8_t)reg;\n    f[4] = (uint8_t)(qty >> 8); f[5] = (uint8_t)qty;\n    uint16_t c = crc16_modbus(f, 6);\n    f[6] = (uint8_t)c; f[7] = (uint8_t)(c >> 8);\n    return uart_write_bytes(1, f, 8u);\n}\n```\n\nESP32 · Modbus\n\n\n\nh7\\_m03\\_modbus.cC\n\n \n\n```text\n/* h7_m03_modbus.c —— H7 侧解析 Modbus 响应（Cortex-M7）。\n * 校验整帧 CRC（含 CRC 再算应为 0）；功能码最高位置 1 表示异常。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\n/* 返回 0=正常（regs[0..n) 有效），正数=异常码，-1=CRC 错 */\nint h7_modbus_parse(const uint8_t *f, int n, uint16_t *regs, int max) {\n    if (n < 5) return -1;\n    uint16_t c = crc16_modbus(f, (size_t)(n - 2));\n    if ((uint16_t)(f[n - 2] | (f[n - 1] << 8)) != c) return -1;   /* CRC 失败 */\n    if (f[1] & 0x80) return f[2];                                  /* 异常响应 */\n    int bc = f[2];\n    int cnt = bc / 2;\n    for (int i = 0; i < cnt && i < max; i++)\n        regs[i] = (uint16_t)((f[3 + 2 * i] << 8) | f[4 + 2 * i]);   /* 线上大端 */\n    return 0;\n}\n```\n\nSTM32H7 · Modbus\n\n\n\n表 3.3 三平台 Modbus\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 物理层 | UART\\+RS485 半双工 | UART | UART\\+DMA |\n| 方向控制 | DE/RE 引脚 | — | DE/RE |\n| CRC | CRC16 | CRC16 | CRC16 |\n| 轮询 | 主机调度 | 主机/从机 | 主机调度 |"}
````



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



Modbus 自检：CRC 字节序、响应超时、映射文档、异常处理。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  Modbus 轮询流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="Modbus 轮询流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">组请求</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">发送</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">等响应</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">解析/异常</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">下一从机</text></svg>
```



组请求 → 发送 → 等响应（超时重试）→ CRC 校验 → 解析/异常 → 下一从机。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| CRC | 低字节在前 | 字节序写反 |
| 超时 | 设响应期限 | 死等 |
| 映射 | 写文档版本化 | 靠猜缩放 |
| 异常 | 读异常码 | 当正常数据解析 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **CRC 字节序写反** ：Modbus 低字节在前，写反永远不通。

- **不设响应超时** ：从机掉线时主机死等，整条轮询链停摆。

- **寄存器映射无文档** ：换人就接错，缩放/单位靠猜。

- **把异常当正常数据** ：功能码 0x83 还去解析字节数，得到垃圾。



◆ 自测 · Module 03（先答再看）




1. 收到 ` 01 83 02 C0 F1 ` 说明什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"功能码 0x83 = 0x03 的最高位置 1，表示读保持寄存器出错；异常码 0x02 表示“非法数据地址”，应检查请求地址是否在从机支持范围。"}
   ```

2. 为什么整帧（含 CRC）再算一次应为 0？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"发送端把 CRC 低字节在前附在帧尾；接收端把整帧一起过 CRC，若结果为 0 说明前面所有字节与 CRC 自洽，这是 Modbus 的标准校验方式。"}
   ```

3. Modbus TCP 与 RTU 分帧有何不同？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"TCP 把 RTU 帧套进 TCP（去掉 CRC、加 MBAP 头），分帧交给 TCP；因此要处理粘包/半包，按长度重新切帧。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：写一份你设备的 Modbus 寄存器映射文档（地址/含义/单位/缩放/字节序），并给主机加响应超时与异常处理。



核对与延伸：[Modbus 应用协议规范](https://modbus.org/specs.php) · [Wireshark 用户手册](https://www.wireshark.org/docs/)

 

动手练习



运行 ` labs/host_modbus.c `：构造读保持寄存器请求，验证整帧 CRC 自洽=0，解析正常与异常响应。



**检查结果：** 请求帧整帧再算 CRC=0；响应字节数=4、寄存器0=0xAABB、寄存器1=0xCCDD；异常帧功能码 0x83、异常码 0x02 可读。

 

迁移练习：把本章的“能构造并解析 Modbus RTU 请求/响应帧，正确计算 CRC16、按大端读取寄存器并识别异常响应。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m03","criterion":"请求帧整帧再算 CRC=0；响应字节数=4、寄存器0=0xAABB、寄存器1=0xCCDD；异常帧功能码 0x83、异常码 0x02 可读。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
