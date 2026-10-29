# 网络编程

```zhizhan-anchor
m03
```



核心认知： **TCP 是字节流，不保留消息边界** 。应用必须自己分帧（长度前缀/分隔符），并处理“一次 recv 只收到半条”的半包与 send 短写。

 

> 前置：Module 01 的 I/O 与 Module 02 的帧/边界概念。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现长度前缀分帧并正确处理 TCP 半包/粘包。

 

本章速览




- TCP 是字节流：必须按长度/分隔符自己分帧。

- 处理半包与短写，收发都要有超时。

- 不要直接发结构体：显式序列化与字节序。

 

```zhizhan-anchor
m03-model
```



```zhizhan-anchor
m03-model-t
```



## 3.1 TCP 是字节流：必须自己分帧



TCP 不保留消息边界：两次 send 可能被一次 recv 收到（粘包），一次 send 也可能分两次收到（半包）。应用必须定义 **应用层帧** （长度前缀 \+ 载荷 \+ 校验）并按帧收发。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  长度前缀分帧



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="长度前缀分帧" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">累积字节</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">读长度前缀</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">凑齐整帧</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">产出一条消息</text></svg>
```



收字节到累积缓冲 → 够一个长度前缀吗？→ 够则读长度 → 够整帧吗？→ 够则产出一条消息。



表 3.1 网络编程五个坑



| 问题 | 原因 | 处理 |
| --- | --- | --- |
| 粘包 | 多条连在一起 | 按长度/分隔符切分 |
| 半包 | 一次没收全 | 累积直到凑齐一条 |
| 短写 | send 没发完 | 循环发送 |
| 字节序 | 网络大端 | htons/htonl |
| 无超时 | 对端卡死 | SO\_RCVTIMEO/事件循环 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：半包处理



下面这段主机程序模型化长度前缀分帧与半包：



host\_socket.cC

 

```text
/* host_socket.c —— 网络编程：TCP 字节流分帧（长度前缀 + 半包处理）（主机可运行）。
 * TCP 不保留消息边界：一次 recv 可能只收到半条。必须按长度前缀累积，凑齐才算一条消息。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_socket.c -o host_socket && ./host_socket
 */
#include <stdio.h>
#include <string.h>
typedef struct { unsigned char buf[128]; int len; } stream_t;
static int feed(stream_t *s, const unsigned char *d, int n) { memcpy(s->buf + s->len, d, n); s->len += n; return n; }
/* 尝试取出一条 [len][payload]，返回 1=取到 */
static int take(stream_t *s, char *out) {
    if (s->len < 1) return 0;
    int mlen = s->buf[0];
    if (s->len < 1 + mlen) return 0;                 /* 半包：等更多数据 */
    memcpy(out, s->buf + 1, mlen); out[mlen] = 0;
    memmove(s->buf, s->buf + 1 + mlen, s->len - 1 - mlen);
    s->len -= 1 + mlen;
    return 1;
}
int main(void) {
    int ok = 1; stream_t s; memset(&s, 0, sizeof(s)); char msg[64];
    unsigned char m1[] = {3, 'a', 'b', 'c'};
    unsigned char m2[] = {2, 'x', 'y'};
    feed(&s, m1, 4); feed(&s, m2, 3);
    if (!take(&s, msg) || strcmp(msg, "abc") != 0) ok = 0;
    printf("消息1=\"%s\"\n", msg);
    /* 半包：只喂第一条消息的前 2 字节 */
    stream_t h; memset(&h, 0, sizeof(h));
    feed(&h, m2, 1);
    printf("半包（只有长度）take=%d（期望 0）\n", take(&h, msg));
    if (take(&h, msg) != 0) ok = 0;
    feed(&h, m2 + 1, 2);
    if (!take(&h, msg) || strcmp(msg, "xy") != 0) ok = 0;
    printf("补齐后消息=\"%s\"\n", msg);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

长度前缀分帧 \+ 半包模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_socket.c -o labs/host_socket && ./labs/host_socket
消息1="abc"
半包（只有长度）take=0（期望 0）
补齐后消息="xy"
RESULT: PASS
```



只有长度前缀时无法产出一条消息（take=0）；补齐后才产出 "xy"。



表 3.2 应用层帧格式



| 帧格式 | 内容 | 说明 |
| --- | --- | --- |
| 长度前缀 | 固定字节数 | 如 2 字节大端 |
| 载荷 | len 字节 | 应用数据 |
| 校验 | 可选 | CRC/校验和 |
| 边界 | 由长度决定 | 不依赖 recv 次数 |



```zhizhan-anchor
m03-detail
```



```zhizhan-anchor
m03-detail-t
```



## 3.3 序列化与超时



不要直接把结构体 ` sizeof ` 发过去按结构体解析——有对齐填充、字节序、位域差异。应 **显式序列化** （逐字段、约定字节序），并给收发设超时。



frame.c 节选C

 

```text
/* 发送：长度前缀 + 载荷，循环发完 */
uint16_t n = htons(len);
send_all(fd, &n, sizeof n); send_all(fd, payload, len);
/* 接收：累积直到凑齐“长度前缀 + 载荷” */
if (acc < 2) return 0;                       // 半包，等更多
uint16_t want = ntohs(*(uint16_t *)acc);
if (acc < 2 + want) return 0;                // 还没凑齐整帧
```

显式序列化 \+ 长度前缀 \+ 循环收，跨平台才可靠



表 3.3 分帧方式对比



| 做法 | 好/坏 | 原因 |
| --- | --- | --- |
| 长度前缀分帧 | 好 | 边界明确、可累积 |
| 分隔符分帧 | 中 | 载荷含分隔符需转义 |
| 直接发结构体 | 坏 | 对齐/字节序差异 |
| 固定长度帧 | 中 | 浪费，超长需截断 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检与三路线对照



网络自检覆盖“分帧正确、超时、重连”：



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  半包到达与凑齐的时刻



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="半包到达与凑齐的时刻" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">40</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">80</text><text x="12" y="48" class="sv-lbl">recv 1</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="232" height="22" rx="4" class="sv-amb-s"></rect><text x="266.2" y="47" text-anchor="middle" class="sv-lbl-hi">只有长度</text><text x="12" y="82" class="sv-lbl">recv 2</text><path class="sv-dash" d="M150,78 H770"></path><rect x="460" y="66" width="310" height="22" rx="4" class="sv-grn-s"></rect><text x="615.0" y="81" text-anchor="middle" class="sv-lbl-hi">长度+载荷→产出</text></svg>
```



第一次只收到长度前缀（不能产出）；第二次补齐载荷才产出一条消息。实现要能跨多次 recv 累积。



tcp\_client.c 节选C

 

```text
int fd = socket(AF_INET, SOCK_STREAM, 0);
struct sockaddr_in a = { .sin_family = AF_INET,
    .sin_port = htons(port) };
connect(fd, (struct sockaddr *)&a, sizeof a);
setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);  // 超时
```

建立 TCP 连接并设置接收超时，避免永久阻塞



表 3.4 三路线网络支持



| 路线 | 网络库 | 说明 |
| --- | --- | --- |
| Buildroot | glibc socket/lwIP(可选) | 应用层一致 |
| Yocto | glibc socket | 一致 |
| Debian | glibc socket \+ 工具 | tcpdump 等最全 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **把 TCP 当消息边界** ：粘包/半包导致解析失败。

- **忽略 send 短写** ：大数据只发出去一部分。

- **字节序/结构体对齐错** ：跨平台解析错位。

- **无超时** ：对端卡死时线程永久阻塞。



◆ 自测 · Module 03（先答再看）




1. 为什么不能直接把结构体 sizeof 发过去？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"结构体有对齐填充、字节序与位域差异；应显式序列化（逐字段、约定字节序）后发送。"}
   ```

2. “半包”在代码里怎么表现、怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一次 recv 只收到部分字节。处理：累积到缓冲，直到凑齐“长度前缀 \\+ 载荷”才产出一条消息。"}
   ```

3. send 返回的字节数小于请求长度说明什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"发生了“短写”（缓冲区满/非阻塞）。必须循环发送剩余部分，否则数据被截断。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目的一条网络协议改为“长度前缀 \+ 校验”的显式分帧，并补上半包累积与超时。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/) · [Buildroot 手册](https://buildroot.org/downloads/manual/manual.html)

 

动手练习



运行 ` labs/host_socket.c `：验证长度前缀分帧与半包处理。



**检查结果：** 分帧解析出消息1="abc"；半包（只有长度）take=0；补齐后消息="xy"。

 

迁移练习：把本章的“能实现长度前缀分帧并正确处理 TCP 半包/粘包。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m03","criterion":"分帧解析出消息1=\"abc\"；半包（只有长度）take=0；补齐后消息=\"xy\"。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
