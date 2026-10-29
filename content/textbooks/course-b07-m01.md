# 协议设计基础

```zhizhan-anchor
m01
```



帧结构（帧头/长度/序号/载荷/校验/帧尾）、转义与字节填充、超时与重传、序号与去重、心跳与保活、版本协商。

 

> 前置：了解 UART/USART 串口收发与字节流/缓冲的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为字节流设计带帧头/长度/序号/CRC 的帧结构，并正确处理转义、超时重传与序号去重。

 

本章速览




- 帧要能自同步：帧头 \+ 长度 \+ CRC；坏帧丢一个，不拖累后面的好帧。

- 序号用于去重与乱序检测；超时重传必须配合[幂等](term:idempotency)。

- 版本协商与心跳让两端在升级/断链时行为可预期。

 

```zhizhan-anchor
m01-frame
```



```zhizhan-anchor
m01-frame-t
```



## 1.1 帧结构：把字节流切成帧



串口给的是字节流，协议要先把它切成一条条帧。最常见结构：帧头 | 长度 | 序号 | 载荷 | 校验 | 帧尾。其中“长度 \+ 校验”让接收方能在噪声中重新同步：一个坏帧被丢掉，后面的好帧照样能解析。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  一帧的字段布局



```zhizhan-figure
<svg viewBox="0 0 800 130" width="100%" height="130" role="img" aria-label="一帧的字段布局" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">SOF</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">LEN</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">SEQ</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">PAYLOAD…</text><rect x="60" y="166" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="185.0" class="sv-lbl-hi">CRC</text><rect x="60" y="200" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="219.0" class="sv-lbl-hi">EOF</text></svg>
```



SOF 标记起点；长度界定载荷；序号用于去重/丢帧检测；CRC 发现误码；EOF 收尾。



表 1.1 帧字段



| 字段 | 作用 | 典型坑 |
| --- | --- | --- |
| 帧头 SOF | 标记帧开始，便于重同步 | 载荷里出现 SOF → 需转义 |
| 长度 | 界定载荷边界 | 长度本身也要被校验 |
| 序号 | 去重、检测丢帧/乱序 | 序号回绕要处理 |
| 校验 CRC | 发现传输误码 | 两端参数模型须一致 |
| 帧尾 EOF | 收尾与流控 | 同 SOF，需转义 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：噪声中重同步



下面这段主机程序向解析器喂入噪声、两帧好帧、一帧坏帧与一帧重复帧：



host\_frame.cC

 

```text
/* host_frame.c —— 帧解析状态机：转义、CRC、噪声重同步、序号去重（主机可运行）。
 *
 * 线格式：[SOF=0x7E] 转义后的 body [EOF=0x7F]，body = seq | len | payload | crc16。
 * 转义规则：0x7E/0x7F/0x7D 前插 0x7D，并把原字节异或 0x20。
 * 解析器逐字节喂入，必须做到：
 *   ① 从噪声中重新同步（不因一个坏字节丢掉后面的好帧）；
 *   ② CRC 失败计一次错误并继续；
 *   ③ 重复序号只处理一次（幂等）。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_frame.c -o host_frame && ./host_frame
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define SOF 0x7E
#define EOFB 0x7F
#define ESC 0x7D

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}

/* 构造一帧（含转义），返回字节数 */
static int make_frame(uint8_t seq, const uint8_t *pl, int pln, uint8_t *out) {
    uint8_t body[64]; int bn = 0;
    body[bn++] = seq;
    body[bn++] = (uint8_t)pln;
    memcpy(body + bn, pl, pln); bn += pln;
    uint16_t c = crc16(body, bn);
    body[bn++] = (uint8_t)(c & 0xFF);
    body[bn++] = (uint8_t)(c >> 8);
    int on = 0; out[on++] = SOF;
    for (int i = 0; i < bn; i++) {
        uint8_t b = body[i];
        if (b == SOF || b == EOFB || b == ESC) { out[on++] = ESC; out[on++] = (uint8_t)(b ^ 0x20); }
        else out[on++] = b;
    }
    out[on++] = EOFB;
    return on;
}

typedef struct {
    int state;            /* 0=等待 SOF, 1=收 body, 2=收到 ESC */
    uint8_t body[64]; int blen;
    uint8_t seq; uint8_t payload[32]; int plen;
    int good, crc_err, dup;
    uint8_t seen[4]; int seen_n;    /* 最近 4 个序号，用于去重 */
    uint8_t last_seq, last_payload[32]; int last_plen;   /* 最近“被接受”的帧 */
} parser_t;

static int already_seen(parser_t *P, uint8_t seq) {
    for (int i = 0; i < P->seen_n; i++) if (P->seen[i] == seq) return 1;
    return 0;
}
static void remember(parser_t *P, uint8_t seq) {
    if (P->seen_n < 4) P->seen[P->seen_n++] = seq;
    else { memmove(P->seen, P->seen + 1, 3); P->seen[3] = seq; }
}
/* 返回：1=产出帧, -1=CRC 错误, 0=无事件 */
static int feed(parser_t *P, uint8_t b) {
    if (P->state == 0) { if (b == SOF) { P->state = 1; P->blen = 0; } return 0; }
    if (b == ESC && P->state != 2) { P->state = 2; return 0; }
    if (P->state == 2) { b = (uint8_t)(b ^ 0x20); P->state = 1; }
    if (b == SOF) { P->state = 1; P->blen = 0; return 0; }   /* 中途遇到 SOF：重新开始 */
    if (b == EOFB) {
        P->state = 0;
        if (P->blen < 4) return 0;                            /* 太短：丢弃 */
        int dlen = P->blen - 2;
        if (crc16(P->body, dlen) != (uint16_t)(P->body[dlen] | (P->body[dlen + 1] << 8))) { P->crc_err++; return -1; }
        P->seq = P->body[0];
        P->plen = P->body[1];
        if (P->plen > (int)sizeof(P->payload) || P->plen + 2 != dlen) return 0;
        memcpy(P->payload, P->body + 2, P->plen);
        if (already_seen(P, P->seq)) { P->dup++; return 0; }
        remember(P, P->seq);
        P->last_seq = P->seq;
        P->last_plen = P->plen;
        memcpy(P->last_payload, P->payload, (size_t)P->plen);
        P->good++;
        return 1;
    }
    if (P->blen < (int)sizeof(P->body)) P->body[P->blen++] = b;
    else P->blen = 0;                                         /* 溢出：丢弃 */
    return 0;
}

int main(void) {
    parser_t P; memset(&P, 0, sizeof(P));
    uint8_t f1[64], f2[64], f3[64];
    const uint8_t pa[] = {'a', 'b', 'c'};
    const uint8_t pb[] = {'d', 'e'};
    int n1 = make_frame(1, pa, 3, f1);
    int n2 = make_frame(2, pb, 2, f2);
    int n3 = make_frame(3, pb, 2, f3);
    f2[2] ^= 0x01;                                            /* 破坏第 2 帧 → CRC 失败 */

    int got = 0, ev;
    uint8_t noise[] = {0x11, 0x22, 0x7E, 0x33};               /* 噪声里甚至混入一个 SOF */
    for (unsigned i = 0; i < sizeof(noise); i++) feed(&P, noise[i]);
    for (int i = 0; i < n1; i++) { ev = feed(&P, f1[i]); if (ev == 1) got++; }
    for (int i = 0; i < n2; i++) { ev = feed(&P, f2[i]); if (ev == 1) got++; }
    for (int i = 0; i < n3; i++) { ev = feed(&P, f3[i]); if (ev == 1) got++; }
    for (int i = 0; i < n1; i++) { ev = feed(&P, f1[i]); if (ev == 1) got++; }   /* 重复帧 */

    printf("产出帧=%d（期望 2：第 1、3 帧）  CRC 错误=%d（期望 1）  重复丢弃=%d（期望 1）\n",
           P.good, P.crc_err, P.dup);
    printf("最后被接受的帧：seq=%d payload=%c%c\n", P.last_seq, P.last_payload[0], P.last_payload[1]);

    int ok = 1;
    if (P.good != 2) ok = 0;
    if (P.crc_err != 1) ok = 0;
    if (P.dup != 1) ok = 0;
    if (!(P.last_seq == 3 && P.last_plen == 2 && P.last_payload[0] == 'd')) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

帧解析/去重模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_frame.c -o labs/host_frame && ./labs/host_frame
产出帧=2（期望 2：第 1、3 帧）  CRC 错误=1（期望 1）  重复丢弃=1（期望 1）
最后被接受的帧：seq=3 payload=de
RESULT: PASS
```



坏帧被丢弃但不污染后续；重复序号丢弃 1；最终接受 seq=3、payload=0xde。



表 1.2 解析结果



| 事件 | 结果 | 说明 |
| --- | --- | --- |
| 好帧 | 2 | 产出 |
| CRC 错 | 1 | 丢弃 |
| 重复 | 1 | 去重 |
| 末帧 | seq=3 | payload=de |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm01-plat\n```\n\n\n\n```zhizhan-anchor\nm01-plat-t\n```\n\n\n\n## 1.3 三平台对照：分帧\n\n\n\n同一套帧结构在三平台的收发实现不同，但“长度\\+校验重同步、序号去重”一致。三份代码均真实交叉编译。\n\n\n\nm01\\_framing.cC\n\n \n\n```text\n/* m01_framing.c —— 设备侧帧解析状态机（Cortex-M3）。\n * SOF(0x7E)…EOF(0x7F)；长度与 CRC 由协议层校验。逐字节喂入，溢出即放弃本帧。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\ntypedef struct { uint8_t buf[64]; int n; int in; } fparse_t;\n\nint frame_feed(fparse_t *p, uint8_t b) {\n    if (!p->in) { if (b == 0x7E) { p->in = 1; p->n = 0; } return 0; }\n    if (b == 0x7F) { p->in = 0; return p->n >= 4 ? 1 : 0; }\n    if (p->n < (int)sizeof(p->buf)) p->buf[p->n++] = b;\n    else { p->in = 0; }                 /* 溢出：放弃本帧，等下一个 SOF */\n    return 0;\n}\n\nvoid uart_rx_task(void *arg) {\n    fparse_t fp; uint8_t b; (void)arg;\n    fp.in = 0; fp.n = 0;\n    for (;;) {\n        if (uart_recv(&b, 1u, portMAX_DELAY) == 1) {\n            if (frame_feed(&fp, b)) { /* 一帧完整：交给协议层 */ }\n        }\n    }\n}\n```\n\nSTM32F103 · 分帧\n\n\n\nesp\\_m01\\_framing.cC\n\n \n\n```text\n/* esp_m01_framing.c —— ESP32 侧 UART 收帧（Xtensa）。\n * UART 驱动按字节读，帧头/帧尾驱动状态机；长度与 CRC 交给协议层。 */\n#include <stdint.h>\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nvoid esp_uart_rx_task(void *arg) {\n    uint8_t b;\n    int in_frame = 0;\n    (void)arg;\n    for (;;) {\n        if (uart_read_bytes(1, &b, 1u, portMAX_DELAY) == 1) {\n            if (!in_frame && b == 0x7E) in_frame = 1;\n            else if (in_frame && b == 0x7F) in_frame = 0;   /* 帧结束：进入处理 */\n        }\n    }\n}\n```\n\nESP32 · 分帧\n\n\n\nh7\\_m01\\_framing.cC\n\n \n\n```text\n/* h7_m01_framing.c —— H7 侧批量收帧（Cortex-M7）。\n * 用 DMA + 空闲中断拿到一整块字节，再按帧头切分；比逐字节中断省中断开销。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"comm_api.h\"\n\nvoid h7_uart_rx_full_callback(const uint8_t *buf, size_t n) {\n    size_t off = 0;\n    while (off < n) {\n        if (buf[off] != 0x7E) { off++; continue; }   /* 找帧头 */\n        /* 从 off 起解析一帧：长度字段 → CRC 校验 → 提交，失败则 off++ 重同步 */\n        break;\n    }\n}\n```\n\nSTM32H7 · 分帧\n\n\n\n表 1.3 三平台分帧\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 接收 | UART\\+环形缓冲 | UART driver | UART\\+DMA |\n| 分帧 | 状态机\\+长度 | 状态机 | 状态机\\+IDLE |\n| 去重 | 序号表 | 序号表 | 序号表 |\n| 重同步 | CRC 丢弃 | CRC 丢弃 | CRC 丢弃 |"}
````



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



分帧自检：有定界、长度入校验、重传去重、序号回绕处理。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  接收状态机



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="接收状态机" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">找 SOF</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">读长度</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">收载荷</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">校验</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">去重投递</text></svg>
```



找 SOF → 读长度 → 收载荷 → 校验 → 通过则序号查重 → 投递；失败则丢弃并重同步。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 定界 | 长度\+S OF | 只靠超时 |
| 校验 | 长度入 CRC | 长度不校验 |
| 重传 | 序号去重 | 执行两次 |
| 回绕 | 模运算 | 255→0 误判 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **没有长度或定界** ：只能靠超时切帧，丢字节就永久错位。

- **不转义** ：载荷出现帧头/帧尾，接收方提前结束或错位。

- **重传不去重** ：对端把同一条命令执行两次。

- **序号回绕不处理** ：255→0 被误判为乱序/旧帧。



◆ 自测 · Module 01（先答再看）




1. 为什么“长度字段”本身也必须参与 CRC？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"长度若被噪声改错，接收方会按错误边界切帧，甚至读到载荷外。把长度纳入校验，长度错时整帧被判坏，配合重同步不污染后续帧。"}
   ```

2. 重传为什么必须配合序号去重？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"超时重发会让对端收到重复帧；序号 \\+ 幂等保证同一条命令只生效一次，否则“开门”这类命令会被执行多次。"}
   ```

3. 序号回绕（255→0）为什么容易出错？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"若用简单大小比较判断新旧，回绕后新序号反而看起来“更小”而被当旧帧丢弃。应按模运算/半窗口判断新旧。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的一条字节流链路设计帧结构（含长度/序号/CRC），实现重同步与去重并写出字段文档。



核对与延伸：[Modbus 应用协议规范](https://modbus.org/specs.php) · [lwIP 官方项目](https://savannah.nongnu.org/projects/lwip/)

 

动手练习



运行 ` labs/host_frame.c `：向解析器喂入噪声、好帧、坏帧与重复帧，检验产出/丢弃计数。



**检查结果：** 噪声中仍能重同步：产出帧=2、CRC 错误=1 且不影响后续、重复丢弃=1；最后接受帧 seq=3、payload=0xde。

 

迁移练习：把本章的“能为字节流设计带帧头/长度/序号/CRC 的帧结构，并正确处理转义、超时重传与序号去重。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m01","criterion":"噪声中仍能重同步：产出帧=2、CRC 错误=1 且不影响后续、重复丢弃=1；最后接受帧 seq=3、payload=0xde。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
