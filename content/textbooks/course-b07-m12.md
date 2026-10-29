# 断网、背压与端到端可靠性

```zhizhan-anchor
m12
```



缓存上界；指数退避；[幂等](term:idempotency)；重连和重复消息；补传与顺序。

 

> 前置：了解指数退避、消息去重与幂等的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现带封顶抖动的指数退避、有界缓存淘汰与会话去重，使重连补传不重不丢。

 

本章速览




- 断网不要死循环重连：指数退避 \+ 抖动。

- 缓存必须有上界；满了丢最旧或阻塞上游，并计数。

- 重复消息靠幂等处理；重连后补传而不是全量重发。

 

```zhizhan-anchor
m12-backoff
```



```zhizhan-anchor
m12-backoff-t
```



## 12.1 断网不要死循环重连



网络会断、会慢、会重复——端到端可靠性要假设这些都会发生。断网不要死循环重连，而要指数退避；缓存不能无限增长，必须有上界与溢出策略。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  指数退避（base=100ms, cap=30s）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="指数退避（base=100ms, cap=30s）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">第1次</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="43" class="sv-lbl-hi">100ms</text><text x="12" y="67" class="sv-lbl">第2次</text><rect x="150" y="50" width="4" height="18" rx="4" class="sv-grn-s"></rect><text x="162" y="67" class="sv-lbl-hi">200ms</text><text x="12" y="91" class="sv-lbl">第3次</text><rect x="150" y="74" width="8" height="18" rx="4" class="sv-grn-s"></rect><text x="166" y="91" class="sv-lbl-hi">400ms</text><text x="12" y="115" class="sv-lbl">…封顶</text><rect x="150" y="98" width="600" height="18" rx="4" class="sv-red-s"></rect><text x="758" y="115" class="sv-lbl-hi">30000ms</text></svg>
```



间隔随失败次数翻倍增长并封顶；加抖动把大量设备的重连时间打散，避免雪崩。



表 12.1 可靠性策略



| 问题 | 策略 | 要点 |
| --- | --- | --- |
| 连接风暴 | 指数退避 \+ 抖动 | 间隔随失败增长并封顶 |
| 内存被吃光 | 有界缓存 | 满时丢最旧或阻塞上游并计数 |
| 重复消息 | 序号去重 \+ 幂等 | 同一条命令只生效一次 |
| 重连乱序 | 序号 \+ 补传 | 按序号补传缺失，不全量重发 |



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：退避/淘汰/幂等



下面这段主机程序验证退避序列、有界缓存淘汰最旧与幂等：



host\_backoff.cC

 

```text
/* host_backoff.c —— 断网重连的指数退避、去重缓存与幂等（主机可运行）。
 *
 *   ① 指数退避：退避 = min(base × 2^attempt, cap)，避免断网时雪崩式重连。
 *   ② 有界去重缓存：只保留最近 N 条消息 id，防止重复执行；缓存满则淘汰最旧。
 *   ③ 幂等：同一条命令重复到达，状态只应改变一次。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_backoff.c -o host_backoff && ./host_backoff
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint32_t backoff_ms(int attempt, uint32_t base, uint32_t cap) {
    uint64_t v = (uint64_t)base << attempt;          /* base × 2^attempt */
    return v > cap ? cap : (uint32_t)v;
}

#define CACHE 4
typedef struct { int id[CACHE]; int n; } cache_t;
static int cache_has(cache_t *c, int id) {
    for (int i = 0; i < c->n; i++) if (c->id[i] == id) return 1;
    return 0;
}
static void cache_put(cache_t *c, int id) {
    if (c->n < CACHE) c->id[c->n++] = id;
    else { memmove(c->id, c->id + 1, (CACHE - 1) * sizeof(int)); c->id[CACHE - 1] = id; }
}

int main(void) {
    int ok = 1;

    printf("指数退避（base=100ms, cap=30000ms）：");
    uint32_t last = 0;
    for (int a = 0; a <= 10; a++) {
        uint32_t v = backoff_ms(a, 100, 30000);
        printf("%ums%s", v, a < 10 ? ", " : "\n");
        if (a > 0 && v < last) ok = 0;               /* 必须非递减 */
        if (v > 30000u) ok = 0;                      /* 不超过 cap */
        last = v;
    }
    if (backoff_ms(0, 100, 30000) != 100 || backoff_ms(9, 100, 30000) != 30000) ok = 0;

    cache_t c; memset(&c, 0, sizeof(c));
    for (int id = 1; id <= 5; id++) cache_put(&c, id);
    printf("去重缓存（容量 %d，插入 1..5）：has(1)=%d（应 0，已淘汰）has(3)=%d（应 1）has(5)=%d（应 1）\n",
           CACHE, cache_has(&c, 1), cache_has(&c, 3), cache_has(&c, 5));
    if (cache_has(&c, 1) != 0 || cache_has(&c, 3) != 1 || cache_has(&c, 5) != 1) ok = 0;

    /* 幂等：命令 id=42 重复 3 次，状态只应 +1 */
    int state = 0;
    cache_t seen; memset(&seen, 0, sizeof(seen));
    for (int i = 0; i < 3; i++) {
        if (!cache_has(&seen, 42)) { state += 1; cache_put(&seen, 42); }
    }
    printf("幂等：命令 id=42 重复 3 次 → state=%d（期望 1）\n", state);
    if (state != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

退避/去重模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_backoff.c -o labs/host_backoff && ./labs/host_backoff
指数退避（base=100ms, cap=30000ms）：100ms, 200ms, 400ms, …, 30000ms, 30000ms
去重缓存（容量 4，插入 1..5）：has(1)=0（已淘汰）has(3)=1 has(5)=1
幂等：命令 id=42 重复 3 次 → state=1（期望 1）
RESULT: PASS
```



退避非递减且封顶 30000ms；容量 4 淘汰最旧（has(1)=0、has(3)=1）；同一条命令只改变 state 一次。



表 12.2 可靠性结果



| 检查 | 结果 | 说明 |
| --- | --- | --- |
| 退避 | 非递减\+封顶 | 30000ms |
| 淘汰 | has(1)=0 | 丢最旧 |
| 幂等 | state=1 | 重复3次只生效1次 |
| 结论 | — | 不重不丢 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm12-plat\n```\n\n\n\n```zhizhan-anchor\nm12-plat-t\n```\n\n\n\n## 12.3 三平台对照：重连与环形缓存\n\n\n\n三平台的重连与缓存实现不同，退避/去重/补传原则一致。\n\n\n\nm12\\_backoff.cC\n\n \n\n```text\n/* m12_backoff.c —— 指数退避与有界离线缓存（Cortex-M3）。\n * 断网时不能死循环重连；缓存有上界，满了丢最旧并计数，避免 RAM 被吃光。 */\n#include <stdint.h>\n#include <string.h>\n#include \"comm_api.h\"\n\nuint32_t reconnect_backoff_ms(int attempt) {\n    uint64_t v = 100ull << attempt;                 /* 100ms × 2^attempt */\n    return v > 30000ull ? 30000u : (uint32_t)v;\n}\n\n#define CACHE_CAP 64\n#define ITEM_LEN  32\ntypedef struct { uint8_t buf[CACHE_CAP][ITEM_LEN]; int n; uint32_t dropped; } offcache_t;\n\nint cache_push(offcache_t *c, const uint8_t *d) {\n    if (c->n == CACHE_CAP) {                         /* 满：丢最旧，计数 */\n        memmove(c->buf[0], c->buf[1], (CACHE_CAP - 1) * ITEM_LEN);\n        c->n = CACHE_CAP - 1;\n        c->dropped++;\n    }\n    memcpy(c->buf[c->n++], d, ITEM_LEN);\n    return 0;\n}\n```\n\nSTM32F103 · 退避\n\n\n\nesp\\_m12\\_reconnect.cC\n\n \n\n```text\n/* esp_m12_reconnect.c —— 断连事件触发指数退避重连（ESP32 / Xtensa）。\n * 连接失败/断开时不要立刻重连，按退避时间等待并更新状态。 */\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nstatic uint32_t backoff_ms(int attempt) {\n    uint32_t v = 100u << attempt;\n    return v > 30000u ? 30000u : v;\n}\n\nvoid esp_on_disconnect(int *attempt) {\n    uint32_t wait = backoff_ms(*attempt);\n    (*attempt)++;\n    vTaskDelay(pdMS_TO_TICKS(wait));\n    (void)esp_wifi_connect();\n    if (*attempt > 8) *attempt = 8;      /* 退避封顶，避免无限增长 */\n}\n```\n\nESP32 · 重连\n\n\n\nh7\\_m12\\_ringcache.cC\n\n \n\n```text\n/* h7_m12_ringcache.c —— 断网期间的环形离线缓存（STM32H7 / Cortex-M7）。\n * head/tail 分离读写；区分空与满；恢复后按序补传，保证不丢不乱序。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\n#define RCAP 128\ntypedef struct {\n    uint8_t  buf[RCAP][32];\n    uint16_t head;     /* 写位置 */\n    uint16_t tail;     /* 读位置 */\n    uint16_t count;\n    uint32_t dropped;\n} ring_t;\n\nint ring_push(ring_t *r, const uint8_t *d) {\n    if (r->count == RCAP) { r->dropped++; return -1; }   /* 满：拒绝新数据并计数 */\n    for (int i = 0; i < 32; i++) r->buf[r->head][i] = d[i];\n    r->head = (uint16_t)((r->head + 1u) % RCAP);\n    r->count++;\n    return 0;\n}\n\nint ring_pop(ring_t *r, uint8_t *out) {\n    if (r->count == 0) return -1;                        /* 空 */\n    for (int i = 0; i < 32; i++) out[i] = r->buf[r->tail][i];\n    r->tail = (uint16_t)((r->tail + 1u) % RCAP);\n    r->count--;\n    return 0;\n}\n```\n\nSTM32H7 · 环形缓存\n\n\n\n表 12.3 三平台可靠性\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 退避 | 计时器\\+抖动 | 事件重连 | 计时器\\+抖动 |\n| 缓存 | 环形缓冲 | 环形 | 环形缓冲 |\n| 去重 | 序号表 | 序号表 | 序号表 |\n| 补传 | 按序号 | 按序号 | 按序号 |"}
````



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 自检



可靠性自检：退避封顶、缓存有界、幂等、按需补传。



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  断网恢复流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="断网恢复流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">断线</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">退避重连</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">按序号补传</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">去重</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">恢复</text></svg>
```



断线 → 指数退避（\+抖动）重连 → 恢复后按序号补传缺失 → 去重 → 正常。



表 12.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 重连 | 退避\+抖动 | 死循环 |
| 缓存 | 设上界 | 无界堆积 |
| 去重 | 序号\+幂等 | 重复执行 |
| 补传 | 只补缺失 | 全量重发 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **断网死循环重连** ：CPU 与无线模块满负荷，耗电发热还连不上。

- **缓存无上界** ：长时间断网把 RAM 吃光，系统崩溃。

- **不幂等** ：QoS1/重传导致“开门”类命令被执行多次。

- **重连全量重发** ：把已确认数据再发一遍，浪费带宽且可能乱序。



◆ 自测 · Module 12（先答再看）




1. 为什么退避要加“抖动（jitter）”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"大量设备同时断线若都用相同退避，会在同一时刻一起重连，造成服务器雪崩。加随机抖动把重连时间打散，削峰填谷。"}
   ```

2. 有界缓存在满时应该怎么办？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"要么丢最旧（并计数），要么阻塞上游（带超时），绝不能悄悄堆积到 OOM；溢出策略要明确且可观测。"}
   ```

3. 补传为什么要“只补缺失”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"重连后全量重发会浪费带宽、放大网络压力并可能造成乱序；按序号只发未确认的部分更高效。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的设备实现带封顶抖动的指数退避、有界环形缓存、命令去重与按序号补传，并加溢出计数。



核对与延伸：[MQTT 规范 (OASIS)](https://mqtt.org/mqtt-specification/) · [lwIP 官方项目](https://savannah.nongnu.org/projects/lwip/)

 

动手练习



运行 ` labs/host_backoff.c `：验证退避序列（100ms→30000ms 封顶）、有界缓存淘汰最旧、幂等只生效一次。



**检查结果：** 退避非递减且封顶 30000ms；去重缓存容量 4、淘汰最旧（has(1)=0，has(3)=1）；命令 id=42 重复 3 次只生效一次。

 

迁移练习：把本章的“能实现带封顶抖动的指数退避、有界缓存淘汰与会话去重，使重连补传不重不丢。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m12","criterion":"退避非递减且封顶 30000ms；去重缓存容量 4、淘汰最旧（has(1)=0，has(3)=1）；命令 id=42 重复 3 次只生效一次。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
