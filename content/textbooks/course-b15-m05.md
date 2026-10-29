# 物联网新协议

```zhizhan-anchor
m05
```



物联网新协议针对“低功耗/受限设备/互操作”：Thread/Matter、CoAP、LoRaWAN、NB-IoT 等，关键在 **确认/重传、省电与互操作** 。

 

> 前置：了解 UDP/TCP 差异与 MQTT/CoAP 基本概念；有低功耗设备开发经验。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为受限设备选择协议并实现确认/指数退避重传与省电策略。

 

本章速览




- UDP 类协议要自己做确认与重传（退避）。

- 互操作靠标准数据模型。

- 省电靠短醒\+长睡。

 

```zhizhan-anchor
m05-proto
```



```zhizhan-anchor
m05-proto-t
```



## 5.1 面向受限设备的协议



CoAP over UDP（可确认）、Thread/Matter（IPv6 网状、互操作）、LoRaWAN（远距、占空比）、NB-IoT（广覆盖省电）。UDP 类要自己做确认与重传。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  UDP 类协议的确认与重传



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="UDP 类协议的确认与重传" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">发送</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">超时</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">指数退避重传</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">收到/放弃</text></svg>
```



发送请求 → 超时未确认 → 指数退避重传（100→200→400ms）→ 收到响应停止。



表 5.1 物联网新协议



| 协议 | 传输 | 特点 |
| --- | --- | --- |
| CoAP | UDP | REST 风格、可确认 |
| Thread/Matter | IPv6 网状 | 互操作、低功耗 |
| LoRaWAN | LoRa | 远距、占空比 |
| NB-IoT | 蜂窝 | 广覆盖、省电 |
| Sparkplug | MQTT | 工业语义 |



coap.c 节选C

 

```text
for (int k=0; k<5; k++) {                 // 最多 5 次
    if (send_wait_ack(req, backoff_ms)) break;
    backoff_ms *= 2;                        // 100→200→400ms
}
```

确认 \+ 指数退避重传；短醒长睡省电



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：指数退避重传



下面这段程序验证确认与指数退避重传：



host\_protocol.cC

 

```text
/* host_protocol.c —— 物联网新协议：CoAP 式请求/确认与重传（主机可运行）。
 * 基于 UDP 的请求需自行确认与重传；指数退避直到超时。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_protocol.c -o host_protocol && ./host_protocol
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int lost = 2;                 /* 前两次丢失 */
    int tries = 0, acked = 0, backoff = 100;
    while (tries < 5) {
        tries++;
        if (lost > 0) { lost--; printf("第 %d 次超时，退避 %dms\n", tries, backoff); backoff *= 2; continue; }
        acked = 1; printf("第 %d 次收到响应\n", tries); break;
    }
    printf("尝试=%d 确认=%d 最终退避=%dms\n", tries, acked, backoff);
    if (!(tries == 3 && acked == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

确认/指数退避重传模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_protocol.c -o labs/host_protocol && ./labs/host_protocol
第 1 次超时，退避 100ms
第 2 次超时，退避 200ms
第 3 次收到响应
尝试=3 确认=1 最终退避=400ms
RESULT: PASS
```



丢包时退避翻倍（100→200→400ms）；第 3 次收到响应即停止；最多尝试 5 次后上报失败。



表 5.2 可靠性机制



| 机制 | 作用 | 注意 |
| --- | --- | --- |
| 确认([ACK](term:ack)) | 知道到达 | 关键消息启用 |
| 指数退避 | 缓解拥塞 | 翻倍\+上限 |
| 最大尝试 | 有界重试 | 超限上报失败 |
| 省电 | 短醒\+长睡 | 占空比 |



```zhizhan-anchor
m05-power
```



```zhizhan-anchor
m05-power-t
```



## 5.3 省电与互操作



省电靠“短醒\+长睡”（占空比）；互操作靠标准数据模型（如 Matter/Sparkplug）而不是私有格式。



coap.c 节选C

 

```text
for (int k=0; k<5; k++) {                 // 最多 5 次
    if (send_wait_ack(req, backoff_ms)) break;
    backoff_ms *= 2;                        // 指数退避
}
/* 省电：短醒发送后长睡，按占空比约束 */
```

确认\+指数退避重传；短醒长睡省电



表 5.3 可靠/省电/互操作



| 目标 | 做法 | 避免 |
| --- | --- | --- |
| 可靠 | 确认\+重传 | UDP 当可靠 |
| 拥塞 | 指数退避 | 原地狂重发 |
| 省电 | 短醒长睡 | 常开耗电 |
| 互操作 | 标准数据模型 | 私有格式 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与成熟度对照



协议自检：有确认重传、退避有界、省电占空比、数据模型标准。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  指数退避序列（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="指数退避序列（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">第1次</text><rect x="150" y="26" width="133" height="18" rx="4" class="sv-cyn-s"></rect><text x="291" y="43" class="sv-lbl-hi">100ms</text><text x="12" y="67" class="sv-lbl">第2次</text><rect x="150" y="50" width="267" height="18" rx="4" class="sv-amb-s"></rect><text x="425" y="67" class="sv-lbl-hi">200ms</text><text x="12" y="91" class="sv-lbl">第3次</text><rect x="150" y="74" width="533" height="18" rx="4" class="sv-red-s"></rect><text x="691" y="91" class="sv-lbl-hi">400ms</text></svg>
```



退避 100→200→400ms 翻倍；第 3 次收到响应。既保证到达又避免拥塞。



表 5.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | CoAP/MQTT 成熟 | 可用 |
| 成长期 | Matter/Thread 推进 | 试点 |
| 观察期 | 生态待完善 | 跟踪 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **UDP 当可靠** ：不确认不重传就丢数据。

- **重传不退避** ：拥塞加剧。

- **私有数据模型** ：无法互操作。

- **忽略省电** ：电池撑不住。



◆ 自测 · Module 05（先答再看）




1. 为什么 CoAP 类协议要“可确认”选项？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"UDP 不保证到达；对关键消息启用确认，接收方回 ACK，超时重传，在低开销与可靠性之间可调。"}
   ```

2. 重传为什么必须“指数退避”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"固定间隔或原地重发会在拥塞时加剧冲突。指数退避（翻倍\\+上限）能快速缓解拥塞并在网络恢复后成功。"}
   ```

3. 受限设备“省电”的常见做法是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"短醒\\+长睡（占空比控制）：只在必要窗口收发送信，其余时间深度睡眠以延长电池寿命。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的受限设备选协议并实现确认\+指数退避重传，同时给出短醒长睡的省电占空比。



核对与延伸：[CoAP RFC 7252](https://datatracker.ietf.org/doc/html/rfc7252) · [Matter / Thread](https://csa-iot.org/all-solutions/matter/)

 

动手练习



运行 ` labs/host_protocol.c `：验证 CoAP 式请求的确认与指数退避重传。



**检查结果：** 丢包时指数退避重传；尝试=3、确认=1、最终退避=400ms；收到响应后停止。

 

迁移练习：把本章的“能为受限设备选择协议并实现确认/指数退避重传与省电策略。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-anchor
m05-interoperability
```



```zhizhan-anchor
m05-interoperability-t
```



## 新协议要验互操作，不只记名字

 

Matter、Thread 和 BLE 不是可互换的名词。先分清应用交互、IPv6 网络及配网链路；选择与你设备类型、供电和基础设施匹配的组合。Matter 1.5 已扩展摄像头等能力，但规范有能力不等于所用 SDK、控制器与产品都已实现。

 

专项实验先用官方示例固定 SDK/设备/控制器版本，完成入网与一次属性读写。随后更换独立实现的控制器，测试重启、掉线、重新配网和移除设备；记录每个不支持的 cluster、功能与版本差异。Thread 路线还需检查边界路由与 IPv6 可达性，不能用 BLE 扫描成功代替网络互通。

 

通过条件是跨实现的状态和错误行为符合选定协议版本。量产还需认证、凭据注入及生命周期工作；本书的概览不代表已完成这些专项。

 

[CSA Matter 1.5 公告](https://csa-iot.org/newsroom/matter-1-5-introduces-cameras-closures-and-enhanced-energy-management-capabilities/) · [Matter 官方 SDK 与示例](https://github.com/project-chip/connectedhomeip)。



```zhizhan-assessment
{"id":"course-b15-m05","criterion":"丢包时指数退避重传；尝试=3、确认=1、最终退避=400ms；收到响应后停止。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
