# 人机界面与音视频应用分支

```zhizhan-anchor
m10
```



UI 与音视频是“高带宽 \+ 实时”的分支：显示走 DRM/fbdev，输入走 evdev，音视频是“采集→编码→传输”的流水线，关键是 **延迟与资源** 的权衡。

 

> 前置：Module 03 网络分帧与 Module 05 线程/缓冲。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为音视频管线画出按帧处理的“采集→编码→传输”数据流，并设可降级的资源/延迟指标。

 

本章速览




- 显示/音视频按帧处理，半包/丢帧/时间戳都要管。

- 脏刷新与按需更新降低开销。

- 资源不足要能降级（分辨率/帧率）。

 

```zhizhan-anchor
m10-branch
```



```zhizhan-anchor
m10-branch-t
```



## 10.1 UI 与音视频两条高带宽分支



显示走 DRM/fbdev、输入走 evdev；音视频是“采集 → 编码 → 传输”的流水线，按帧处理并处理半包/丢帧/时间戳。显示用脏刷新降低总线与 CPU 开销。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  音视频流水线



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="音视频流水线" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">采集</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">编码</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">封包/传输</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">解码显示</text></svg>
```



采集(V4L2/ALSA) → 编码(H.264/AAC) → 封包(RTP) → 传输(socket) → 解码 → 显示/播放。每级都有缓冲与延迟。



表 10.1 UI/音视频接口



| 分支 | 接口 | 要点 |
| --- | --- | --- |
| 显示 | DRM/fbdev | 帧缓冲、按需刷新 |
| 输入 | evdev | 事件语义、去抖 |
| 视频 | V4L2 \+ 编码 | 分辨率/码率/延迟 |
| 音频 | ALSA | 缓冲大小与延迟 |
| 网络 | RTP/RTSP | [抖动缓冲](term:jitter)、丢包 |



dirty\_refresh.c 节选C

 

```text
/* 只刷新脏区域，降低总线/CPU 开销 */
if (fb_region_dirty(&r))
    drmModeDirtyFB(fd, fb_id, &r, 0);
/* 音视频按帧处理；网络层用长度前缀分帧 + 半包累积 */
```

脏刷新 \+ 按帧处理，降低 UI/音视频的资源占用



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：流式分帧（音视频同源问题）



音视频在网络层同样面临“按帧分界 \+ 半包”。下面这段主机程序给出可运行的流式分帧模型：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_socket.cC\n\n \n\n```text\n/* host_socket.c —— 网络编程：TCP 字节流分帧（长度前缀 + 半包处理）（主机可运行）。\n * TCP 不保留消息边界：一次 recv 可能只收到半条。必须按长度前缀累积，凑齐才算一条消息。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_socket.c -o host_socket && ./host_socket\n */\n#include <stdio.h>\n#include <string.h>\ntypedef struct { unsigned char buf[128]; int len; } stream_t;\nstatic int feed(stream_t *s, const unsigned char *d, int n) { memcpy(s->buf + s->len, d, n); s->len += n; return n; }\n/* 尝试取出一条 [len][payload]，返回 1=取到 */\nstatic int take(stream_t *s, char *out) {\n    if (s->len < 1) return 0;\n    int mlen = s->buf[0];\n    if (s->len < 1 + mlen) return 0;                 /* 半包：等更多数据 */\n    memcpy(out, s->buf + 1, mlen); out[mlen] = 0;\n    memmove(s->buf, s->buf + 1 + mlen, s->len - 1 - mlen);\n    s->len -= 1 + mlen;\n    return 1;\n}\nint main(void) {\n    int ok = 1; stream_t s; memset(&s, 0, sizeof(s)); char msg[64];\n    unsigned char m1[] = {3, 'a', 'b', 'c'};\n    unsigned char m2[] = {2, 'x', 'y'};\n    feed(&s, m1, 4); feed(&s, m2, 3);\n    if (!take(&s, msg) || strcmp(msg, \"abc\") != 0) ok = 0;\n    printf(\"消息1=\\\"%s\\\"\\n\", msg);\n    /* 半包：只喂第一条消息的前 2 字节 */\n    stream_t h; memset(&h, 0, sizeof(h));\n    feed(&h, m2, 1);\n    printf(\"半包（只有长度）take=%d（期望 0）\\n\", take(&h, msg));\n    if (take(&h, msg) != 0) ok = 0;\n    feed(&h, m2 + 1, 2);\n    if (!take(&h, msg) || strcmp(msg, \"xy\") != 0) ok = 0;\n    printf(\"补齐后消息=\\\"%s\\\"\\n\", msg);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n流式分帧 \\+ 半包模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_socket.c -o labs/host_socket && ./labs/host_socket
消息1="abc"
半包（只有长度）take=0（期望 0）
补齐后消息="xy"
RESULT: PASS
```



音视频帧在网络层同样要“长度前缀分帧 \+ 半包累积”；帧边界不能靠字节流假设。



表 10.2 UI/音视频常见问题



| 问题 | 原因 | 处理 |
| --- | --- | --- |
| 帧边界丢失 | 按字节乱切 | 按帧长度分界 |
| 延迟高 | 缓冲过大 | 缩小缓冲/丢帧策略 |
| 刷新浪费 | 全屏无条件刷新 | 脏刷新 |
| 资源不足 | 无降级 | 降分辨率/降帧率 |



```zhizhan-anchor
m10-flow
```



```zhizhan-anchor
m10-flow-t
```



## 10.3 数据流与缓冲



按帧处理要明确“每级缓冲多大、延迟多少、丢帧策略”。缓冲过大延迟高、交互差；缓冲过小则丢帧。资源不足时的降级（降分辨率/降帧率）应可配置。



media\_pipe.c 节选C

 

```text
/* 采集→编码→发送：按帧处理，每级有界缓冲 */
frame_t f = capture_frame();       // V4L2/ALSA 取一帧
encode(&f, &pkt);                  // H.264/AAC
send_frame(sock, &pkt);            // RTP: 长度前缀分帧
/* 发送端按帧；接收端累积半包，凑齐一帧再解码 */
```

按帧处理 \+ 有界缓冲；网络层仍要半包累积



表 10.3 音视频的取舍



| 指标 | 太小 | 太大 |
| --- | --- | --- |
| 缓冲 | 丢帧 | 延迟高 |
| 码率 | 画质差 | 带宽/抖动 |
| 分辨率 | 细节差 | 算力/带宽 |
| 帧率 | 不流畅 | 算力/带宽 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检与三路线对照



UI/音视频自检：帧边界正确、延迟在上界内、资源不足可降级。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  采集帧与显示时刻的抖动



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="采集帧与显示时刻的抖动" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M302,26 V94"></path><text x="302" y="18" text-anchor="middle" class="sv-lbl-dim">22</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M618,26 V94"></path><text x="618" y="18" text-anchor="middle" class="sv-lbl-dim">68</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">90</text><text x="12" y="48" class="sv-lbl">采集</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="103" height="22" rx="4" class="sv-cyn-s"></rect><text x="201.7" y="47" text-anchor="middle" class="sv-lbl-hi">F0</text><rect x="322" y="32" width="103" height="22" rx="4" class="sv-cyn-s"></rect><text x="373.9" y="47" text-anchor="middle" class="sv-lbl-hi">F1</text><rect x="563" y="32" width="103" height="22" rx="4" class="sv-cyn-s"></rect><text x="615.0" y="47" text-anchor="middle" class="sv-lbl-hi">F2</text><text x="12" y="82" class="sv-lbl">显示</text><path class="sv-dash" d="M150,78 H770"></path><rect x="219" y="66" width="103" height="22" rx="4" class="sv-grn-s"></rect><text x="270.6" y="81" text-anchor="middle" class="sv-lbl-hi">F0</text><rect x="391" y="66" width="103" height="22" rx="4" class="sv-grn-s"></rect><text x="442.8" y="81" text-anchor="middle" class="sv-lbl-hi">F1</text><rect x="632" y="66" width="103" height="22" rx="4" class="sv-grn-s"></rect><text x="683.9" y="81" text-anchor="middle" class="sv-lbl-hi">F2</text></svg>
```



采集帧到达有抖动；用有界缓冲吸收抖动，但缓冲越大延迟越大。要在可接受延迟内不丢帧。



表 10.4 三路线媒体支持



| 路线 | UI/媒体栈 | 说明 |
| --- | --- | --- |
| Buildroot | DRM/V4L2 可选 | 按需集成 |
| Yocto | GStreamer 配方 | 常见 |
| Debian | GStreamer/ffmpeg | 最全 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **把视频当字节流乱切** ：帧边界丢失。

- **缓冲过大** ：延迟高，交互差。

- **全屏无条件刷新** ：CPU/总线被刷屏占满。

- **无降级** ：资源不足直接卡死。



◆ 自测 · Module 10（先答再看）




1. 音视频为什么强调“按帧”而不是“按字节”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"帧是解码/显示的基本单位；按字节处理会破坏帧边界、无法同步时间戳。网络层仍要处理半包，但应用层按帧组包。"}
   ```

2. 缓冲越大越好吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不是。缓冲大能吸收抖动但增大端到端延迟，交互变差。要在可接受延迟内选择合适缓冲。"}
   ```

3. 资源不足时应如何保证体验？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"可配置降级：降分辨率/降帧率/降码率，优先保流畅与响应，而不是卡死。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的音视频或 UI 管线画一张“采集→处理→传输/显示”的数据流图，标出每级缓冲与延迟上界。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/)

 

动手练习



运行 ` labs/host_socket.c `（流式分帧模型）；为你的音视频管线画数据流与缓冲。



**检查结果：** 按帧分界、半包 take=0 不产出、补齐后产出 "xy"；资源/延迟指标明确且可降级。

 

迁移练习：把本章的“能为音视频管线画出按帧处理的“采集→编码→传输”数据流，并设可降级的资源/延迟指标。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m10","criterion":"按帧分界、半包 take=0 不产出、补齐后产出 \"xy\"；资源/延迟指标明确且可降级。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
