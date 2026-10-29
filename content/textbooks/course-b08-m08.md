# 可靠性与自恢复

```zhizhan-anchor
m08
```



看门狗策略（喂狗条件、多任务心跳）、异常自恢复、参数损坏回退、Flash 位翻转防护、长跑测试。

 

> 前置：了解看门狗与复位机制，能读取复位原因寄存器区分上电/看门狗/软件复位。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计“仅关键任务都健康才喂狗”的看门狗与心跳监控，实现有上界的参数回退与自恢复。

 

本章速览




- 看门狗只在“关键任务都健康”时喂；否则形同虚设。

- 复位原因、栈溢出、参数损坏都要能记录并自动恢复。

- 长跑测试是可靠性的唯一证据：跑够时间、注够故障。

 

```zhizhan-anchor
m08-reliability
```



```zhizhan-anchor
m08-reliability-t
```



## 8.1 出错后能恢复



可靠性不是“祈祷不出错”，而是“出错后能恢复”。核心是：看门狗、心跳监控、参数回退、长跑测试。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  心跳监控与恢复



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="心跳监控与恢复" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">打卡</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">监控</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">超时检测</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">恢复(上界)</text></svg>
```



每任务周期打卡 → 监控发现超时 → 触发恢复（有上界）→ 记录复位原因。



表 8.1 可靠性机制



| 机制 | 正确做法 | 反例 |
| --- | --- | --- |
| 看门狗 | 仅当关键任务都健康才喂 | 在别处统一喂 |
| 心跳监控 | 每任务周期打卡\+超时恢复 | 只看一个总心跳 |
| 参数回退 | 双副本\+CRC\+默认值 | 坏参数当有效值 |
| 长跑测试 | 跑够时间\+注入故障 | 只跑几分钟 |



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：心跳超时检测



下面这段主机程序让一个任务卡死，验证监控在超时窗口后检测并触发有上界的恢复：



host\_heartbeat.cC

 

```text
/* host_heartbeat.c —— 多任务心跳监控与自恢复（主机可运行）。
 *
 * 每个关键任务周期性“打卡”；监控器检查是否超时。超时 → 记录故障并触发恢复；
 * 恢复次数有上界，超过则进入安全态（不再盲目重启）。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_heartbeat.c -o host_heartbeat && ./host_heartbeat
 */
#include <stdio.h>
#include <stdint.h>

#define NTASK 3
#define TIMEOUT 50
#define MAX_RECOVER 3

typedef struct { const char *name; uint32_t last_ping; uint32_t period; int stalled; } hb_t;

int main(void) {
    hb_t t[NTASK] = {{"sensor", 0, 10, 0}, {"control", 0, 5, 0}, {"comm", 0, 20, 0}};
    int recover = 0, detect_tick = -1;
    int ok = 1;

    for (uint32_t now = 0; now < 400; now++) {
        for (int i = 0; i < NTASK; i++) {
            /* 任务 2（control）从 tick 100 起卡死 */
            int failing = (i == 1 && now >= 100 && now < 200);
            if (!failing && (now % t[i].period) == 0) t[i].last_ping = now;
        }
        /* 监控：任一任务超时 */
        for (int i = 0; i < NTASK; i++) {
            if (!t[i].stalled && (now - t[i].last_ping) > TIMEOUT) {
                t[i].stalled = 1;
                if (detect_tick < 0) detect_tick = (int)now;
                if (recover < MAX_RECOVER) recover++;
                else { printf("超过最大恢复次数，进入安全态\n"); return 0; }
            }
            if (t[i].stalled && (now - t[i].last_ping) <= TIMEOUT) t[i].stalled = 0; /* 恢复打卡后清除 */
        }
    }

    printf("检测到 control 卡死的时刻=%d（≈ 最后一次打卡 95 + 超时 50 + 1）\n", detect_tick);
    printf("累计恢复次数=%d（上界 %d）\n", recover, MAX_RECOVER);

    if (!(detect_tick >= 145 && detect_tick <= 148)) ok = 0;
    if (recover < 1) ok = 0;
    if (recover > MAX_RECOVER) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

心跳监控模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_heartbeat.c -o labs/host_heartbeat && ./labs/host_heartbeat
检测到 control 卡死的时刻=146（≈ 最后一次打卡 95 + 超时 50 + 1）
累计恢复次数=1（上界 3）
RESULT: PASS
```



卡死在 146（=95\+50\+1）被检测；恢复次数=1、上界 3；恢复后打卡清除故障标志。



表 8.2 心跳检测



| 量 | 值 | 说明 |
| --- | --- | --- |
| 最后打卡 | 95 | — |
| 超时窗口 | 50 | — |
| 检测时刻 | 146 | 95\+50\+1 |
| 恢复上界 | 3 | 超界进安全态 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-plat\n```\n\n\n\n```zhizhan-anchor\nm08-plat-t\n```\n\n\n\n## 8.3 三平台对照：看门狗与复位\n\n\n\n三平台的看门狗与复位原因寄存器不同，但“关键任务健康才喂狗、有上界恢复”一致。\n\n\n\nm08\\_wdt.cC\n\n \n\n```text\n/* m08_wdt.c —— 独立看门狗：按“所有关键任务都健康”才喂狗（Cortex-M3）。 */\n#include \"app_api.h\"\n#include \"stm32_app.h\"\n\nvoid wdt_init(void) {\n    IWDG_KR = IWDG_KEY_ENABLE;     /* 使能 */\n    IWDG_PR = 4u;                  /* 预分频 */\n    IWDG_RLR = 0xFFFu;             /* 重装载：约 1s+ */\n    iwdg_kick();\n}\n\nvoid wdt_feed_if_healthy(int sensor_ok, int control_ok, int comm_ok) {\n    if (sensor_ok && control_ok && comm_ok) iwdg_kick();   /* 任一心跳丢失则不喂 */\n}\n```\n\nSTM32F103 · 看门狗\n\n\n\nesp\\_m08\\_wdt.cC\n\n \n\n```text\n/* esp_m08_wdt.c —— ESP32 任务看门狗与自恢复（Xtensa）。\n * 只监控注册过的关键任务；喂狗由被监控任务自己完成。 */\n#include \"esp_app.h\"\n\nvoid esp_wdt_watch_current(void) { (void)esp_task_wdt_add(0); }\nvoid esp_wdt_kick(void) { (void)esp_task_wdt_reset(); }\n\nvoid esp_recover_reset(void) { esp_restart(); }   /* 自恢复的最后手段：复位 */\n```\n\nESP32 · 看门狗\n\n\n\nh7\\_m08\\_wdt.cC\n\n \n\n```text\n/* h7_m08_wdt.c —— H7 看门狗与复位原因分析（Cortex-M7）。 */\n#include \"stm32_app.h\"\n\n/* 复位原因决定自恢复策略：看门狗复位要计数并对相关任务限次重启 */\nuint32_t h7_reset_flags(void) { return RCC_CSR; }\nint h7_was_watchdog_reset(uint32_t flags) {\n    return (flags & (1u << 29)) ? 1 : 0;    /* IWDGRSTF */\n}\n```\n\nSTM32H7 · 看门狗\n\n\n\n表 8.3 三平台可靠性\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 看门狗 | IWDG | TWDT | IWDG |\n| 复位原因 | RCC\\_CSR | esp\\_reset\\_reason | RCC\\_CSR |\n| 心跳 | 任务打卡 | 任务打卡 | 任务打卡 |\n| 上界 | 恢复计数 | 恢复计数 | 恢复计数 |"}
````



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



可靠性自检：按业务条件喂狗、每任务心跳、参数双副本、有上界恢复。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  恢复次数与上界（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="恢复次数与上界（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">已恢复</text><rect x="150" y="26" width="200" height="18" rx="4" class="sv-amb-s"></rect><text x="358" y="43" class="sv-lbl-hi">1次数</text><text x="12" y="67" class="sv-lbl">上界</text><rect x="150" y="50" width="600" height="18" rx="4" class="sv-red-s"></rect><text x="758" y="67" class="sv-lbl-hi">3次数</text></svg>
```



卡死触发 1 次恢复；上界 3，超过则进入安全态而非无限重启。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 看门狗 | 关键任务健康才喂 | 统一喂 |
| 心跳 | 每任务打卡 | 只看总心跳 |
| 参数 | 双副本回退 | 坏值直接用 |
| 恢复 | 设上界 | 无限重启 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **在低优先级任务统一喂狗** ：关键任务死了也不复位。

- **无恢复上界** ：反复重启进入“重启风暴”，永远起不来。

- **参数损坏直接用** ：出现无法解释的行为，且每次重启不一样。

- **不做长跑** ：偶发泄漏/竞态在上线后才暴露。



◆ 自测 · Module 08（先答再看）




1. 为什么“恢复次数要设上界”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"若故障是永久性的，无限重启只会反复失败且可能损坏外设；超过上界应进入安全态（关闭输出、等待人工/升级），保证设备处于已知安全状态。"}
   ```

2. 为什么看门狗不能“统一喂”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只要调度还在跑就能喂到，卡死的关键任务不会被发现。应由被监控任务在“业务完成后”按条件喂，喂狗条件=所有关键任务都活着。"}
   ```

3. 用 host\_heartbeat.c 的数字说明检测时刻。
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"最后一次打卡 95，超时窗口 50，检测时刻 146=95\\+50\\+1；说明监控能在超时后一个 tick 内发现卡死并触发恢复。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的系统加“仅关键任务健康才喂狗”的看门狗、每任务心跳、参数双副本回退与有上界的恢复。



核对与延伸：[FreeRTOS · 栈溢出与调试](https://www.freertos.org/Stacks-and-stack-overflow-checking.html) · [ST · RM0433 STM32H7 参考手册](https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-743-750-753-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

 

动手练习



运行 ` labs/host_heartbeat.c `：让一个任务卡死，验证监控在超时后检测到并触发（有上界的）恢复。



**检查结果：** 卡死任务在超时窗口 50 内被检测（检测时刻 146=95\+50\+1）；恢复次数=1、上界 3。

 

迁移练习：把本章的“能设计“仅关键任务都健康才喂狗”的看门狗与心跳监控，实现有上界的参数回退与自恢复。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m08","criterion":"卡死任务在超时窗口 50 内被检测（检测时刻 146=95+50+1）；恢复次数=1、上界 3。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
