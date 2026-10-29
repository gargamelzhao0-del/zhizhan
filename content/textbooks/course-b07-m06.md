# 应用层协议

```zhizhan-anchor
m06
```



MQTT（QoS 0/1/2、遗嘱、保留消息、保活）、CoAP、HTTP/REST；[TLS](term:tls) 在 MCU 上的代价。

 

> 前置：了解发布/订阅模型与 TCP 连接、MQTT 报文的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能编码/解析 MQTT 固定头与剩余长度变长整数，并按 QoS 语义处理 PUBLISH 与报文标识。

 

本章速览




- MQTT QoS 0/1/2 对应至多/至少/恰好一次；QoS1 必须处理重复。

- 保留消息与遗嘱让“最后状态/掉线”能被订阅者感知。

- TLS 在 MCU 上要算 RAM 与时间预算；会话复用能省一次握手。

 

```zhizhan-anchor
m06-mqtt
```



```zhizhan-anchor
m06-mqtt-t
```



## 6.1 应用层语义：QoS 与变长整数



应用层解决“消息语义”而不只是“字节能不能到”。MQTT 是发布/订阅，QoS 决定可靠性；剩余长度是变长整数（最大 4 字节）。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  MQTT 报文结构



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="MQTT 报文结构" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">固定头</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">剩余长度</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="117.0" class="sv-lbl-hi">可变头/载荷</text></svg>
```



固定头（类型\+标志 | 剩余长度）→ 可变头 → 载荷。剩余长度用 7 位/字节、最高位续接。



表 6.1 MQTT QoS



| QoS | 语义 | 代价 | 处理 |
| --- | --- | --- | --- |
| 0 | 至多一次（可能丢） | 最低 | 无需确认 |
| 1 | 至少一次（可能重复） | 中 | 必须去重/[幂等](term:idempotency) |
| 2 | 恰好一次 | 最高（四步握手） | 状态机复杂 |



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：变长整数与首字节



下面这段主机程序编码剩余长度、解析 CONNECT 与 PUBLISH(QoS1) 首字节：



host\_mqtt.cC

 

```text
/* host_mqtt.c —— MQTT 报文的最小编码/解码（主机可运行）。
 *
 * 覆盖两件最容易写错的事：
 *   ① 固定头低 4 位是“标志”，高 4 位是“报文类型”；QoS1 的 PUBLISH 标志位 = 0x02。
 *   ② 剩余长度是“变长整数”（每字节 7 位，最高位续位），最多 4 字节。
 * 用真实的 CONNECT 与 PUBLISH(QoS1) 报文断言字节序列与解码结果。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_mqtt.c -o host_mqtt && ./host_mqtt
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static int varint_encode(int v, uint8_t *out) {
    int n = 0;
    do { uint8_t d = (uint8_t)(v % 128); v /= 128; if (v > 0) d |= 0x80; out[n++] = d; } while (v > 0);
    return n;
}
static int varint_decode(const uint8_t *p, int *v) {
    int mult = 1, val = 0, n = 0;
    for (;;) {
        uint8_t d = p[n++];
        val += (d & 0x7F) * mult;
        if (!(d & 0x80)) break;
        mult *= 128;
        if (n > 4) return -1;
    }
    *v = val;
    return n;
}

int main(void) {
    int ok = 1, n;

    /* ① 剩余长度变长整数 */
    uint8_t vb[4];
    n = varint_encode(60, vb);       printf("剩余长度 60 编码：%02X（1 字节）\n", vb[0]);
    if (!(n == 1 && vb[0] == 60)) ok = 0;
    n = varint_encode(321, vb);      printf("剩余长度 321 编码：%02X %02X（2 字节）\n", vb[0], vb[1]);
    if (!(n == 2 && vb[0] == 0xC1 && vb[1] == 0x02)) ok = 0;

    /* ② CONNECT：0x10 | 剩余长度 | 协议名 MQTT | 级别 4 | 标志 | keepalive */
    uint8_t connect[32]; int m = 0;
    uint8_t vh[10] = {0x00, 0x04, 'M', 'Q', 'T', 'T', 0x04, 0x02, 0x00, 0x3C};
    connect[m++] = 0x10;
    m += varint_encode(sizeof(vh), connect + m);
    memcpy(connect + m, vh, sizeof(vh)); m += sizeof(vh);
    printf("CONNECT 首字节=0x%02X 类型=%d 标志=%d 剩余长度=%d\n",
           connect[0], connect[0] >> 4, connect[0] & 0x0F, connect[1]);
    if (!(connect[0] == 0x10 && connect[1] == (int)sizeof(vh))) ok = 0;

    /* ③ PUBLISH QoS1：0x32 | 剩余长度 | 主题 | 报文标识 | 载荷 */
    const char *topic = "dev/1/temp";
    uint16_t pid = 0x1234;
    const char *pl = "23.5";
    uint8_t pub[64]; int k = 0;
    int rem = 2 + (int)strlen(topic) + 2 + (int)strlen(pl);
    pub[k++] = 0x30 | 0x02;                 /* type=3, QoS1 标志=0x02 */
    k += varint_encode(rem, pub + k);
    pub[k++] = 0x00; pub[k++] = (uint8_t)strlen(topic);
    memcpy(pub + k, topic, strlen(topic)); k += (int)strlen(topic);
    pub[k++] = (uint8_t)(pid >> 8); pub[k++] = (uint8_t)(pid & 0xFF);
    memcpy(pub + k, pl, strlen(pl)); k += (int)strlen(pl);

    int dec_len = 0, consumed = varint_decode(pub + 1, &dec_len);
    printf("PUBLISH 首字节=0x%02X 类型=%d QoS=%d 剩余长度编码字节=%d 值=%d（期望 类型3 QoS1 rem=%d）\n",
           pub[0], pub[0] >> 4, (pub[0] >> 1) & 0x03, consumed, dec_len, rem);
    if (!(pub[0] == 0x32 && (pub[0] >> 4) == 3 && ((pub[0] >> 1) & 0x03) == 1 && dec_len == rem)) ok = 0;

    uint16_t got_pid = (uint16_t)((pub[1 + consumed + 2 + (int)strlen(topic)] << 8) |
                                   pub[1 + consumed + 2 + (int)strlen(topic) + 1]);
    printf("报文标识=0x%04X（期望 0x1234）\n", got_pid);
    if (got_pid != 0x1234) ok = 0;

    printf("总字节数=%d\n", k);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

MQTT 编码模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_mqtt.c -o labs/host_mqtt && ./labs/host_mqtt
剩余长度 60 编码：3C（1 字节）
剩余长度 321 编码：C1 02（2 字节）
CONNECT 首字节=0x10 类型=1 标志=0 剩余长度=10
PUBLISH 首字节=0x32 类型=3 QoS=1 剩余长度编码字节=1 值=18
报文标识=0x1234（期望 0x1234）
RESULT: PASS
```



60→单字节 0x3C、321→两字节 0xC1 0x02；CONNECT 首字节 0x10；PUBLISH(QoS1)=0x32；报文标识=0x1234。



表 6.2 MQTT 编码



| 量 | 结果 | 说明 |
| --- | --- | --- |
| 剩余长度 60 | 0x3C | 1 字节 |
| 剩余长度 321 | 0xC1 0x02 | 2 字节 |
| PUBLISH 首字节 | 0x32 | 类型3\+QoS1 |
| 报文标识 | 0x1234 | 正确 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm06-plat\n```\n\n\n\n```zhizhan-anchor\nm06-plat-t\n```\n\n\n\n## 6.3 三平台对照：应用层与 TLS\n\n\n\n三平台的 MQTT/TLS 栈不同，但报文格式与 QoS 语义一致。\n\n\n\nm06\\_mqtt.cC\n\n \n\n```text\n/* m06_mqtt.c —— 发布一条 MQTT 消息（Cortex-M3）。\n * 主题/载荷与 QoS 由应用决定；连接与重连策略单独管理（见 M12）。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nstatic int fmt_milli(int mv, uint8_t *out) {\n    int n = 0;\n    if (mv < 0) { out[n++] = '-'; mv = -mv; }\n    out[n++] = (uint8_t)('0' + (mv / 10000) % 10);\n    out[n++] = (uint8_t)('0' + (mv / 1000) % 10);\n    out[n++] = '.';\n    out[n++] = (uint8_t)('0' + (mv / 100) % 10);\n    out[n++] = (uint8_t)('0' + (mv / 10) % 10);\n    return n;\n}\n\nint mqtt_pub_temp(const char *topic, int mv) {\n    uint8_t pl[12];\n    int n = fmt_milli(mv, pl);\n    return mqtt_publish(topic, pl, (size_t)n, 1);   /* QoS1：至少一次 */\n}\n```\n\nSTM32F103 · MQTT\n\n\n\nesp\\_m06\\_mqtt.cC\n\n \n\n```text\n/* esp_m06_mqtt.c —— ESP32 上先联网再发 MQTT（Xtensa）。\n * 分层：netif/WiFi → MQTT 客户端 → 应用。连接失败要交给重连策略。 */\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nvoid esp_mqtt_up(void) {\n    (void)esp_netif_init();\n    (void)esp_netif_create_default_wifi_sta();\n    (void)mqtt_connect(\"node-1\", 60u);\n}\n\nint esp_mqtt_temp(const char *topic, int mv) {\n    uint8_t pl[12];\n    int n = 0;\n    pl[n++] = (uint8_t)('0' + (mv / 1000) % 10);\n    pl[n++] = (uint8_t)('0' + (mv / 100) % 10);\n    pl[n++] = '.';\n    pl[n++] = (uint8_t)('0' + (mv / 10) % 10);\n    return mqtt_publish(topic, pl, (size_t)n, 1);\n}\n```\n\nESP32 · MQTT\n\n\n\nh7\\_m06\\_tls.cC\n\n \n\n```text\n/* h7_m06_tls.c —— 应用层协议跑在 TCP/TLS 上（STM32H7 / Cortex-M7）。\n * TLS 握手要额外 RAM 与时间；MCU 上常用会话复用/精简套件降低开销。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"comm_api.h\"\n\nint tls_publish(const char *host, uint16_t port, const char *topic, const uint8_t *p, size_t n) {\n    if (tcp_connect(host, port) != 0) return -1;   /* TLS 握手在连接层完成 */\n    return mqtt_publish(topic, p, n, 1);\n}\n```\n\nSTM32H7 · TLS\n\n\n\n表 6.3 三平台应用层\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| MQTT | 自实现/库 | esp-mqtt | 库 |\n| TLS | mbedTLS 精简 | mbedTLS | mbedTLS |\n| 会话复用 | 可选 | 支持 | 支持 |\n| 保活 | keepalive | keepalive | keepalive |"}
````



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



应用层自检：编码正确、QoS 语义清楚、遗嘱/保留、TLS 预算。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  QoS 开销（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="QoS 开销（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">QoS0</text><rect x="150" y="26" width="120" height="18" rx="4" class="sv-grn-s"></rect><text x="278" y="43" class="sv-lbl-hi">1(相对开销)</text><text x="12" y="67" class="sv-lbl">QoS1</text><rect x="150" y="50" width="240" height="18" rx="4" class="sv-amb-s"></rect><text x="398" y="67" class="sv-lbl-hi">2(相对开销)</text><text x="12" y="91" class="sv-lbl">QoS2</text><rect x="150" y="74" width="480" height="18" rx="4" class="sv-red-s"></rect><text x="638" y="91" class="sv-lbl-hi">4(相对开销)</text></svg>
```



QoS0 最低、QoS1 中、QoS2 四步握手最高；上报多用 QoS1\+去重即可。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 编码 | 变长整数 | 当定长 |
| QoS | 按需选 | 盲目 QoS2 |
| 掉线 | 遗嘱/保留 | 监控失明 |
| TLS | 算预算 | 撑爆 RAM |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **QoS1 不去重** ：代理重发导致命令重复执行。

- **固定头标志写错** ：类型与标志搞混，报文被判非法。

- **剩余长度当定长** ：\>127 字节要 2 字节变长整数，写错就截断。

- **忽略 TLS 预算** ：握手撑爆 RAM 或超时。



◆ 自测 · Module 06（先答再看）




1. 为什么设备上报用 QoS1 就够，很多场景不必上 QoS2？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"QoS2 四步握手成本高，且多数“上报”可通过序号\\+服务端幂等容忍重复；QoS1“至少一次 \\+ 去重”通常已满足。"}
   ```

2. 剩余长度为什么要用变长整数？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用一个字节只能表示 0~127；用“每字节 7 位、最高位表示续接”的变长整数可表示到 268435455，节省小报文字节。"}
   ```

3. 遗嘱（LWT）与保留消息各解决什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"遗嘱在客户端异常掉线时由代理发布，让监控方感知断链；保留消息让新订阅者立刻拿到“最后状态”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备的 MQTT 上报选 QoS 并实现去重；配置遗嘱/保留消息，并评估 TLS 的 RAM 与时间预算。



核对与延伸：[MQTT 规范 (OASIS)](https://mqtt.org/mqtt-specification/) · [CoAP RFC 7252](https://datatracker.ietf.org/doc/html/rfc7252)

 

动手练习



运行 ` labs/host_mqtt.c `：验证剩余长度变长整数编码、CONNECT/PUBLISH 首字节与报文标识。



**检查结果：** 固定头高位是类型、低位是标志；QoS1 的 PUBLISH 标志=0x02；剩余长度与报文标识解析正确。

 

迁移练习：把本章的“能编码/解析 MQTT 固定头与剩余长度变长整数，并按 QoS 语义处理 PUBLISH 与报文标识。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m06","criterion":"固定头高位是类型、低位是标志；QoS1 的 PUBLISH 标志=0x02；剩余长度与报文标识解析正确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
