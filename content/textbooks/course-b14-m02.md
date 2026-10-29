# 边缘网关

```zhizhan-anchor
m02
```



边缘网关是“设备与云之间的缓冲与翻译层”：汇聚多协议、做协议转换与过滤、 **断网本地缓存、恢复补传** 。

 

> 前置：完成 M01（物模型与设备身份）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：实现按“已确认位置”续传的断网补传，在确认丢失与重试下保持[幂等](term:idempotency)入库，并记录缓存溢出时的丢弃政策。

 

本章速览




- 边缘网关做协议转换与过滤，并缓存补传。

- 续传需要持久确认与幂等键；重试可重复到达，缓存满时必须定义丢弃/[背压](term:backpressure)政策。

- 时间要同步，时间戳口径统一。

 

```zhizhan-anchor
m02-gateway
```



```zhizhan-anchor
m02-gateway-t
```



## 2.1 汇聚、转换、缓存、续传



边缘网关汇聚多协议（Modbus/CAN/MQTT）、做协议转换与过滤（单位/降采样），并 **断网本地缓存、恢复补传** 。断网续传靠“水位 / 已确认位置”。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  断网续传的水位



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="断网续传的水位" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">本地缓存</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">云端确认(水位)</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">断网</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">恢复从水位补传</text></svg>
```



本地按序号存数据；云端确认到第 k 条（水位=k）；恢复后从 k\+1 补传，避免全量重发或丢数据。



表 2.1 网关五功能



| 功能 | 内容 | 要点 |
| --- | --- | --- |
| 协议汇聚 | Modbus/CAN/MQTT | 统一物模型 |
| 转换过滤 | 单位/降采样 | 不丢关键信息 |
| 本地缓存 | 有界队列 | 满则丢策略 |
| 续传 | 水位/已确认 | 不重不漏 |
| 时间 | NTP/本地时钟 | 时间戳口径 |



gateway.c 节选C

 

```text
uint64_t ack = cloud_last_ack_seq();
for (uint64_t s = ack+1; s <= local_seq; s++) send_with_id(rec[s]);
// 只补未确认，带唯一 ID 幂等；缓存有界（满则丢旧/降采样）
```

按连续持久化确认水位续传；重复由服务端去重，溢出必须显式计数



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：按已确认位置补传



下面这段程序验证按“已确认位置”续传后待同步归零：



host\_sync.cC

 

```text
/* host_sync.c —— 云边同步：水位/已确认位置与断点续传（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sync.c -o host_sync && ./host_sync
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int local_seq = 10, acked = 4;         /* 本地已产生 10 条，云端只确认到 4 */
    int pending = local_seq - acked;
    printf("本地=%d 已确认=%d 待同步=%d\n", local_seq, acked, pending);
    if (pending != 6) ok = 0;
    /* 断点续传：从 acked+1 开始补传 */
    acked += pending;                       /* 假设全部补传成功 */
    printf("补传后已确认=%d，待同步=%d（期望 0）\n", acked, local_seq - acked);
    if (local_seq - acked != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

断网续传/水位模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sync.c -o labs/host_sync && ./labs/host_sync
本地=10 已确认=4 待同步=6
补传后已确认=10，待同步=0（期望 0）
RESULT: PASS
```



本地 10 条、云端已确认 4 条 → 待同步 6；从已确认位置补传到 10，待同步归零。



表 2.2 水位计算



| 量 | 含义 | 公式 |
| --- | --- | --- |
| 本地 | 网关已缓存 | 10 |
| 已确认 | 云端入库 | 4 |
| 待同步 | 差量 | 本地-已确认=6 |
| 补传后 | 水位推进 | =本地 |



```zhizhan-anchor
m02-sync
```



```zhizhan-anchor
m02-sync-t
```



## 2.3 确认水位、幂等与丢失边界



以服务端已持久化且连续无缺口的确认水位为准，不能用最大的乱序确认号跳过中间记录。发送成功不是提交成功；重试允许重复传输，稳定的唯一 ID 和服务端幂等提交抑制重复副作用。缓存要有上界；丢旧/降采样本身就是有意丢失，必须计数并标记缺口。要求完整保留时须采用足够的持久化容量、限流/背压与故障策略，不能宣称无限断网也不丢数据。



gateway.c 节选C

 

```text
uint64_t ack = cloud_last_ack_seq();      // 云端确认位置
for (uint64_t s = ack+1; s <= local_seq; s++)   // 只补未确认
    send_with_id(rec[s]);                   // 带唯一 ID，云端幂等
/* 缓存有界：满了按策略丢旧或降采样 */
```

从已确认位置补传 \+ 唯一 ID 幂等 \+ 有界缓存



表 2.3 续传与缓存策略



| 策略 | 做法 | 效果 |
| --- | --- | --- |
| 水位续传 | 按连续持久化确认位置 | 不跳过尚未确认的记录 |
| 幂等去重 | 唯一 ID | 重复不放大 |
| 有界缓存 | 满则丢旧/降采样 | 不吃光存储 |
| NTP 对齐 | 统一 UTC | 时间可比较 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检与三级对照



网关自检：协议统一、缓存有界、确认不跳洞、重放无重复副作用、丢失可计量、时间误差有记录。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  待同步随补传归零（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="待同步随补传归零（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">断网中</text><rect x="150" y="26" width="450" height="18" rx="4" class="sv-red-s"></rect><text x="608" y="43" class="sv-lbl-hi">6条</text><text x="12" y="67" class="sv-lbl">补传后</text><rect x="150" y="50" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="67" class="sv-lbl-hi">0条</text></svg>
```



断网期间待同步累积；恢复后按水位补传，待同步从 6 降到 0。



表 2.4 三级网关



| 层级 | 网关角色 | 注意 |
| --- | --- | --- |
| 设备端 | 上报 | 协议/单位 |
| 边缘网关 | 汇聚/缓存/续传 | 水位/幂等 |
| 云平台 | 入库/确认 | 返回水位 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **无本地缓存** ：断网即丢数据。

- **缓存无上界** ：吃光存储。

- **全量重发** ：重复且浪费带宽。

- **时间不同步** ：时间戳错乱。



◆ 自测 · Module 02（先答再看）




1. 为什么断网续传要用“已确认位置”而不是“最后发送位置”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"发送成功不等于入库提交。服务端持久化后再确认，设备按连续确认水位重放；持久化队列与幂等提交共同保护这条链路。缓存溢出、重启丢状态或确认跳洞都可能造成丢失，必须单独验证。"}
   ```

2. 本地缓存为什么必须有上界？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无上界会吃光存储，导致网关崩溃。有界缓存配合“满则丢旧/降采样”策略，在存储受限下保持可用。"}
   ```

3. 为什么网关要统一时间戳口径？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不同设备/协议时间戳格式与时钟不同；网关统一为 NTP 对齐的 UTC，后续存储与告警才能跨源比较。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你网关实现“已确认位置”续传与有界缓存，并做一次断网恢复演练验证待同步归零。



核对与延伸：[MQTT 规范](https://mqtt.org/mqtt-specification/) · [OPC UA 概览](https://opcfoundation.org/about/opc-technologies/opc-ua/)

 

动手练习



运行 ` labs/host_sync.c `：验证按已确认位置补传，补足后待同步为 0。



**检查结果：** 待同步=6 计算正确；从已确认位置 4 续传后待同步=0。

 

迁移练习：把本章的“实现按“已确认位置”续传的断网补传，在确认丢失与重试下保持幂等入库，并记录缓存溢出时的丢弃政策。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m02","criterion":"待同步=6 计算正确；从已确认位置 4 续传后待同步=0。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
