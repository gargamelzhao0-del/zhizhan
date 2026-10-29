# 实时以太网与工业总线

```zhizhan-anchor
m04
```



工业实时以太网追求 **确定性时延** ：TSN、EtherCAT、PROFINET 等通过时间同步与周期调度保证“按时到达”。

 

> 前置：熟悉以太网 MAC/PHY 基础；了解 CAN/RS-485 等现场总线。 · ◷ 约 44 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为场景选择 TSN/EtherCAT/PROFINET 并给出周期/抖动与时间同步方案。

 

本章速览




- 工业实时以太网的确定性靠时间同步与调度。

- 选型按周期/抖动/成本权衡。

- 乱接交换机破坏实时性。

 

```zhizhan-anchor
m04-rteth
```



```zhizhan-anchor
m04-rteth-t
```



## 4.1 确定性 = 时延有界可预测



工业实时以太网追求确定性时延（最坏可控），而不是“平均快”。靠时间同步（PTP）\+ 周期调度 \+ 流量整形保证。普通交换机、不做同步会破坏实时性。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  周期通信的最坏时延与抖动



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="周期通信的最坏时延与抖动" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M309,26 V94"></path><text x="309" y="18" text-anchor="middle" class="sv-lbl-dim">18</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">35</text><path class="sv-dash" d="M611,26 V94"></path><text x="611" y="18" text-anchor="middle" class="sv-lbl-dim">52</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">70</text><text x="12" y="48" class="sv-lbl">周期</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="177" height="22" rx="4" class="sv-cyn-s"></rect><text x="238.6" y="47" text-anchor="middle" class="sv-lbl-hi">T</text><rect x="371" y="32" width="177" height="22" rx="4" class="sv-cyn-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">T</text><rect x="593" y="32" width="177" height="22" rx="4" class="sv-cyn-s"></rect><text x="681.4" y="47" text-anchor="middle" class="sv-lbl-hi">T</text><text x="12" y="82" class="sv-lbl">时延</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="89" height="22" rx="4" class="sv-grn-s"></rect><text x="194.3" y="81" text-anchor="middle" class="sv-lbl-hi">960µs</text><rect x="460" y="66" width="133" height="22" rx="4" class="sv-amb-s"></rect><text x="526.4" y="81" text-anchor="middle" class="sv-lbl-hi">1000µs</text><rect x="681" y="66" width="71" height="22" rx="4" class="sv-grn-s"></rect><text x="716.9" y="81" text-anchor="middle" class="sv-lbl-hi">960µs</text></svg>
```



每周期数据按时到达；抖动是最坏-最小时延之差。判据：抖动≤阈值且最大时延≤周期。



表 4.1 实时以太网与总线



| 技术 | 特点 | 适用 |
| --- | --- | --- |
| TSN | 标准以太网 \+ 调度 | 通用确定性 |
| EtherCAT | 主从 \+ 飞读 | 运动控制 |
| PROFINET | IRT 等时实时 | 工厂自动化 |
| PTP | 亚微秒同步 | 时间基准 |
| 现场总线 | CAN/RS-485 | 低带宽可靠 |



tsn.c 节选C

 

```text
jitter = max_latency - min_latency;      // 抖动
if (jitter <= JITTER_MAX && max_latency <= PERIOD) pass();
/* 前置：PTP 同步 + 优先级调度 + 流量整形 */
```

抖动/最大时延判定；前提是 PTP \+ 调度



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：时延与抖动统计



下面这段程序统计时延与抖动并判定是否满足确定性：



host\_tsn.cC

 

```text
/* host_tsn.c —— 实时以太网/确定性通信：时延与抖动统计、截止期判定（主机可运行）。
 * 给定一组周期性通信的采样时延（微秒），统计最小值/最大值/抖动（max-min），
 * 并判定是否满足确定性截止期要求（抖动≤50µs 且最大时延≤1000µs）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tsn.c -o host_tsn && ./host_tsn
 */
#include <stdio.h>

int main(void) {
    int ok = 1;
    const int lat[] = {960, 980, 1000, 990, 975, 995};   /* 采样时延 (µs) */
    int n = (int)(sizeof(lat) / sizeof(lat[0]));
    int mn = lat[0], mx = lat[0], sum = 0;
    for (int i = 0; i < n; i++) {
        if (lat[i] < mn) mn = lat[i];
        if (lat[i] > mx) mx = lat[i];
        sum += lat[i];
    }
    int jitter = mx - mn;                 /* 抖动 = 最大 - 最小 */
    int avg = sum / n;
    const int JITTER_LIMIT = 50;          /* 抖动上限 (µs) */
    const int DEADLINE = 1000;            /* 截止期/最大时延 (µs, 1ms 周期) */
    int jitter_ok = jitter <= JITTER_LIMIT;
    int deadline_ok = mx <= DEADLINE;
    printf("采样 n=%d 最小=%dµs 最大=%dµs 平均=%dµs 抖动=%dµs\n", n, mn, mx, avg, jitter);
    printf("抖动≤%dµs=%d 最大时延≤%dµs=%d\n", JITTER_LIMIT, jitter_ok, DEADLINE, deadline_ok);
    if (!(mn == 960 && mx == 1000 && jitter == 40)) ok = 0;
    if (!(jitter_ok && deadline_ok)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时延/抖动统计模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_tsn.c -o labs/host_tsn && ./labs/host_tsn
采样 n=6 最小=960µs 最大=1000µs 平均=983µs 抖动=40µs
抖动≤50µs=1 最大时延≤1000µs=1
RESULT: PASS
```



抖动=最大-最小=40µs ≤50µs、最大时延 1000µs ≤1ms 周期——确定性达标。



表 4.2 确定性判据



| 指标 | 值 | 判据 |
| --- | --- | --- |
| 最小时延 | 960µs | — |
| 最大时延 | 1000µs | ≤ 周期 |
| 抖动 | 40µs | ≤ 阈值(50µs) |
| 时间同步 | PTP | 误差≤1µs |



```zhizhan-anchor
m04-sync
```



```zhizhan-anchor
m04-sync-t
```



## 4.3 时间同步与调度



确定性的前提是时间同步（PTP）与带宽/调度规划；乱接交换机、不做同步会破坏实时性。选型按周期、抖动与成本权衡。



tsn.c 节选C

 

```text
jitter = max_latency - min_latency;      // 抖动
if (jitter <= JITTER_MAX && max_latency <= PERIOD) pass();
/* 前置：PTP 同步 + 优先级调度 + 流量整形 */
```

抖动/最大时延判定；前提是 PTP \+ 调度



表 4.3 确定性要点



| 要点 | 做法 | 避免 |
| --- | --- | --- |
| 时间同步 | PTP | 周期错位 |
| 调度 | 优先级 \+ 整形 | 突发延迟 |
| 交换机 | TSN 支持 | 普通交换机丢包 |
| 选型 | 周期/抖动/成本 | 只看带宽 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与成熟度对照



实时以太网自检：有同步、有调度、抖动与最大时延满足判据。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  抖动与阈值（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="抖动与阈值（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">最小 960</text><rect x="150" y="26" width="549" height="18" rx="4" class="sv-grn-s"></rect><text x="707" y="43" class="sv-lbl-hi">960µs</text><text x="12" y="67" class="sv-lbl">最大 1000</text><rect x="150" y="50" width="571" height="18" rx="4" class="sv-amb-s"></rect><text x="729" y="67" class="sv-lbl-hi">1000µs</text><text x="12" y="91" class="sv-lbl">抖动 40</text><rect x="150" y="74" width="23" height="18" rx="4" class="sv-cyn-s"></rect><text x="181" y="91" class="sv-lbl-hi">40µs</text></svg>
```



抖动 40µs 在阈值 50µs 内；最大时延 1000µs 不超 1ms 周期。



表 4.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | TSN 交换机/协议栈成熟 | 可用 |
| 成长期 | 部分芯片支持 | 试点 |
| 观察期 | 缺硬件支持 | 跟踪 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **普通交换机** ：突发丢包破坏确定性。

- **不做时间同步** ：周期调度错位。

- **带宽不规划** ：高优先级也被延迟。

- **选型只看带宽** ：忽略抖动与成本。



◆ 自测 · Module 04（先答再看）




1. 工业实时以太网的“确定性”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"指通信时延有界且可预测（最坏情况可控），而不是“平均快”。需要时间同步、调度与流量整形共同保证。"}
   ```

2. 抖动（jitter）怎么定义？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"最坏时延与最小时延之差。抖动越小，周期性任务的可预测性越好。"}
   ```

3. 为什么普通交换机可能破坏实时性？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"普通交换机不保证优先级与调度，突发流量会造成排队延迟甚至丢包，破坏时延上界（确定性）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的场景估周期与抖动需求，选择 TSN/EtherCAT/PROFINET 并给出 PTP 同步方案。



核对与延伸：[TSN 任务组 (IEEE 802.1)](https://1.ieee802.org/tsn/)

 

动手练习



运行 ` labs/host_tsn.c `（时延/抖动统计与截止期判定）；为场景估周期与抖动需求。



**检查结果：** 采样最小=960µs、最大=1000µs、抖动=40µs；抖动≤50µs 且最大时延≤1000µs 判 PASS。

 

迁移练习：把本章的“能为场景选择 TSN/EtherCAT/PROFINET 并给出周期/抖动与时间同步方案。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m04","criterion":"采样最小=960µs、最大=1000µs、抖动=40µs；抖动≤50µs 且最大时延≤1000µs 判 PASS。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
