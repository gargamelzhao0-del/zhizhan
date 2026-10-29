# 校验与完整性

```zhizhan-anchor
m02
```



校验和/CRC8/CRC16/[CRC32](term:crc) 的选择、查表法与硬件 CRC 外设、CRC 参数模型（多项式/初值/反转/异或）。

 

> 前置：了解二进制数据与按位运算，知道校验和/CRC 的作用。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为指定数据实现 CRC8/CRC16/CRC32，用标准检查值对拍并保证两端参数模型一致。

 

本章速览




- CRC 的多项式/初值/输入输出反转/异或必须两端完全一致，否则永远对不上。

- 位运算版是基准，查表/硬件版必须与它逐字节对拍。

- CRC 防误码不防篡改；安全场景要用签名或消息认证码。

 

```zhizhan-anchor
m02-crc
```



```zhizhan-anchor
m02-crc-t
```



## 2.1 校验选型与参数模型



校验不是“随便加个 CRC”：同一个多项式，初值/输入输出反转/结果异或不同，结果就完全不同。两端必须约定同一套参数模型。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  校验算法对照



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="校验算法对照" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">算法</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">强度</text><text x="405" y="24" text-anchor="middle" class="sv-lbl-dim">成本</text><text x="12" y="50" class="sv-lbl">校验和</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">弱</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">最低</text><text x="12" y="78" class="sv-lbl">CRC16</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">较强</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">低</text><text x="12" y="106" class="sv-lbl">CRC32</text><rect x="158" y="94" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="109" text-anchor="middle" class="sv-lbl-hi">强</text><rect x="268" y="94" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="109" text-anchor="middle" class="sv-lbl-hi">中</text><text x="12" y="134" class="sv-lbl">签名/MAC</text><rect x="158" y="122" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="137" text-anchor="middle" class="sv-lbl-hi">最强</text><rect x="268" y="122" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="315" y="137" text-anchor="middle" class="sv-lbl-hi">高</text></svg>
```



校验和弱、CRC8/16/32 递增、签名/MAC 最强但需密钥；CRC 只发现误码，不能防篡改。



表 2.1 校验选型



| 算法 | 典型用途 | 强度 | 成本 |
| --- | --- | --- | --- |
| 校验和 | 低成本链路自检 | 弱 | 最低 |
| CRC8 | 短帧/一字节校验 | 中 | 低 |
| CRC16 | Modbus/工业总线 | 较强 | 低 |
| CRC32 | 固件镜像/文件完整性 | 强 | 中 |
| 签名/MAC | 防篡改/认证 | 最强 | 高 |



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：标准检查值对拍



下面这段主机程序用标准检查值 "123456789" 校验四种 CRC，并对拍查表版与位运算版：



host\_crc.cC

 

```text
/* host_crc.c —— 校验和/CRC8/CRC16/CRC32：位运算版与查表版等价性（主机可运行）。
 *
 * 覆盖协议里最常见的三种 CRC 参数模型，并用标准检查值 "123456789" 断言：
 *   CRC-8   (poly 0x07, init 0x00)            → 0xF4
 *   CRC-16/MODBUS (poly 0xA001 反射, init 0xFFFF) → 0x4B37
 *   CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) → 0x29B1
 *   CRC-32/ISO-HDLC (poly 0xEDB88320 反射)    → 0xCBF43926
 * 同时验证“查表版 == 位运算版”，这是把 CRC 换成查表/硬件前必须先做的对拍。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_crc.c -o host_crc && ./host_crc
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint8_t crc8_bit(const uint8_t *p, int n) {
    uint8_t c = 0x00;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 0x80) ? (uint8_t)((c << 1) ^ 0x07) : (uint8_t)(c << 1);
    }
    return c;
}
static uint16_t crc16_modbus_bit(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}
static uint16_t crc16_ccitt_bit(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= (uint16_t)(p[i] << 8);
        for (int b = 0; b < 8; b++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
    }
    return c;
}
static uint32_t crc32_bit(const uint8_t *p, int n) {
    uint32_t c = 0xFFFFFFFFu;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? ((c >> 1) ^ 0xEDB88320u) : (c >> 1);
    }
    return c ^ 0xFFFFFFFFu;
}

/* 查表版：先建表，再按字节喂入 */
static uint16_t tbl16[256];
static void build_table16(void) {
    for (int i = 0; i < 256; i++) {
        uint16_t c = (uint16_t)i;
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
        tbl16[i] = c;
    }
}
static uint16_t crc16_modbus_tab(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) c = (uint16_t)((c >> 8) ^ tbl16[(c ^ p[i]) & 0xFF]);
    return c;
}

int main(void) {
    const char *s = "123456789";
    const uint8_t *p = (const uint8_t *)s;
    int n = (int)strlen(s);
    int ok = 1;

    uint8_t c8 = crc8_bit(p, n);
    uint16_t m = crc16_modbus_bit(p, n);
    uint16_t cc = crc16_ccitt_bit(p, n);
    uint32_t c32 = crc32_bit(p, n);
    printf("检查值 \"%s\"：CRC8=0x%02X  CRC16/MODBUS=0x%04X  CRC16/CCITT=0x%04X  CRC32=0x%08X\n",
           s, c8, m, cc, c32);
    if (c8 != 0xF4) ok = 0;
    if (m != 0x4B37) ok = 0;
    if (cc != 0x29B1) ok = 0;
    if (c32 != 0xCBF43926u) ok = 0;

    build_table16();
    uint16_t mt = crc16_modbus_tab(p, n);
    printf("查表版 CRC16/MODBUS=0x%04X（应与位运算版一致）\n", mt);
    if (mt != m) ok = 0;

    /* 单比特错误必须改变 CRC（否则检错能力有问题） */
    uint8_t bad[9];
    memcpy(bad, s, 9);
    bad[3] ^= 0x01;
    printf("翻转 1 位后 CRC16/MODBUS=0x%04X（应与原始不同）\n", crc16_modbus_bit(bad, n));
    if (crc16_modbus_bit(bad, n) == m) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

CRC 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_crc.c -o labs/host_crc && ./labs/host_crc
检查值 "123456789"：CRC8=0xF4  CRC16/MODBUS=0x4B37  CRC16/CCITT=0x29B1  CRC32=0xCBF43926
查表版 CRC16/MODBUS=0x4B37（应与位运算版一致）
翻转 1 位后 CRC16/MODBUS=0x9A36（应与原始不同）
RESULT: PASS
```



四个检查值全部吻合；查表版==位运算版；单比特错误使 CRC 由 0x4B37 变为 0x9A36。



表 2.2 CRC 检查值



| 算法 | 检查值 | 对拍 |
| --- | --- | --- |
| CRC8 | 0xF4 | — |
| CRC16/MODBUS | 0x4B37 | 查表=位运算 |
| CRC16/CCITT | 0x29B1 | — |
| CRC32 | 0xCBF43926 | — |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm02-plat\n```\n\n\n\n```zhizhan-anchor\nm02-plat-t\n```\n\n\n\n## 2.3 三平台对照：CRC 实现\n\n\n\n三平台都能用软件位运算/查表或硬件 CRC 外设；硬件版须与软件真值对拍。\n\n\n\nm02\\_crc.cC\n\n \n\n```text\n/* m02_crc.c —— 硬件 CRC 与软件 CRC 并用（Cortex-M3）。\n * 硬件 CRC32：写数据寄存器，读结果；Modbus 用软件 CRC16（参数模型固定）。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n#include \"stm32_comm.h\"\n\nuint32_t hw_crc32(const uint8_t *p, uint32_t n) {\n    CRC_CR = 1u;                         /* RESET：清初值寄存器 */\n    for (uint32_t i = 0; i < n; i++) { CRC_DR = p[i]; }\n    return CRC_DR;\n}\n\nuint16_t frame_crc16(const uint8_t *p, uint32_t n) { return crc16_modbus(p, n); }\n```\n\nSTM32F103 · 软件 CRC\n\n\n\nesp\\_m02\\_crc.cC\n\n \n\n```text\n/* esp_m02_crc.c —— ESP32 侧校验（Xtensa）。\n * Modbus 用软件 CRC16（查表）；固件镜像用 CRC32。二者参数模型必须与对端一致。 */\n#include <stdint.h>\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nuint16_t esp_modbus_crc(const uint8_t *p, size_t n) { return crc16_modbus(p, n); }\nuint32_t esp_image_crc(const uint8_t *p, size_t n)  { return crc32_ieee(p, n); }\n```\n\nESP32 · CRC\n\n\n\nh7\\_m02\\_crc.cC\n\n \n\n```text\n/* h7_m02_crc.c —— H7 侧校验（Cortex-M7）。\n * 除软件 CRC16 外，镜像完整性用 CRC32；若用硬件 CRC 单元，注意它是共享外设，\n * 多任务/多核并发使用要加锁，且改写前必须复位初值。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nuint16_t h7_frame_crc16(const uint8_t *p, size_t n) { return crc16_modbus(p, n); }\nuint32_t h7_image_crc32(const uint8_t *p, size_t n) { return crc32_ieee(p, n); }\n```\n\nSTM32H7 · 硬件 CRC\n\n\n\n表 2.3 三平台 CRC\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 实现 | 软件位运算/表 | ROM/hardware | CRC 外设 |\n| 参数 | 自定 | 固定 | 可配初值 |\n| 对拍 | 必需 | 必需 | 必需 |\n| 复位初值 | — | — | 每帧复位 |"}
````



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



校验自检：参数模型一致、位运算为准、硬件对拍、CRC 不当安全。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  单比特错误改变 CRC（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="单比特错误改变 CRC（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">原始</text><rect x="150" y="26" width="289" height="18" rx="4" class="sv-grn-s"></rect><text x="447" y="43" class="sv-lbl-hi">19255(CRC16 十进制对比)</text><text x="12" y="67" class="sv-lbl">翻1位</text><rect x="150" y="50" width="592" height="18" rx="4" class="sv-red-s"></rect><text x="750" y="67" class="sv-lbl-hi">39478(CRC16 十进制对比)</text></svg>
```



原始 0x4B37 → 翻转一位 → 0x9A36；CRC 能发现单比特及多数突发误码。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 参数 | 两端一致 | 模型不同 |
| 实现 | 位运算为准 | 直接信硬件 |
| 对拍 | 逐字节比 | 只测一次 |
| 安全 | 用 MAC/签名 | 拿 CRC 防篡改 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **参数模型不一致** ：一端 0xA001 反射、另一端 0x8005，永远对不上。

- **初始值/结果异或不同** ：看似只差一个常数，实为不同标准。

- **把 CRC 当安全机制** ：攻击者可改数据同时改 CRC。

- **硬件 CRC 未复位初值** ：上一帧余数被带入，结果错。



◆ 自测 · Module 02（先答再看）




1. 为什么换用硬件 CRC 前一定要与软件版对拍？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"硬件 CRC 往往固定了多项式/初值/反转方式，且可能对字节序敏感；软件版是“真值”。不对拍会出现“本机自测通过、与对端通信全错”。"}
   ```

2. CRC 能防篡改吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能。CRC 是公开算法，攻击者可改数据同时改 CRC。防篡改必须用带密钥的 MAC 或数字签名。"}
   ```

3. 标准检查值 "123456789" 有什么用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它是 CRC 标准（如 CRC-16/MODBUS=0x4B37）给出的固定答案，用来验证你的实现参数模型是否正确、以及查表/硬件版是否与位运算版一致。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的链路实现 CRC16/CRC32，用标准检查值验证参数模型，并把硬件 CRC 与软件版逐字节对拍。



核对与延伸：[Modbus 应用协议规范](https://modbus.org/specs.php)

 

动手练习



运行 ` labs/host_crc.c `：用标准检查值 "123456789" 校验四种 CRC，并对拍查表版与位运算版。



**检查结果：** 检查值全部吻合（0xF4 / 0x4B37 / 0x29B1 / 0xCBF43926）；查表版==位运算版；单比特错误改变 CRC。

 

迁移练习：把本章的“能为指定数据实现 CRC8/CRC16/CRC32，用标准检查值对拍并保证两端参数模型一致。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m02","criterion":"检查值全部吻合（0xF4 / 0x4B37 / 0x29B1 / 0xCBF43926）；查表版==位运算版；单比特错误改变 CRC。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
