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
