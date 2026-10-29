# 从需求到架构

```zhizhan-anchor
m01
```



需求梳理与指标量化、模块划分与接口定义、状态机建模、前后台 vs 任务骨架选型；先画架构再写代码。

 

> 前置：会用 C 编写定时器/中断驱动的逻辑，了解状态、事件与故障处理的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把需求量化成可测指标，并据此画出显式状态机与模块 {init, poll/task} 接口。

 

本章速览




- 需求要量化成指标：采样率、续航、响应时间、成本——没有数字就没有验收。

- 先把模块抽象成 {init, poll} 接口与状态机，再决定前后台还是任务骨架。

- 先画架构再写代码；架构决定了后面所有耦合与实时性。

 

```zhizhan-anchor
m01-need
```



```zhizhan-anchor
m01-need-t
```



## 1.1 需求量化与架构选型



做产品第一步不是写代码，而是把需求变成可测指标：采样率多少、续航多少天、最坏响应多少毫秒、BOM 成本上限。指标一旦确定，架构选型（前后台 vs RTOS）几乎是它推导出来的结果。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  需求 → 指标 → 架构



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="需求 → 指标 → 架构" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">需求</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">量化指标</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">接口/状态机</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">架构选型</text></svg>
```



需求先量化成指标；指标推导出模块接口与状态机，前后台/RTOS 只是“谁来调用 poll”的实现细节。



表 1.1 需求量化



| 需求 | 量化指标 | 影响 |
| --- | --- | --- |
| 采样 | ≥100Hz / 抖动\<1ms | 是否需要周期任务 |
| 续航 | 单节电池一年 | 低功耗策略与上报频率 |
| 响应 | 按键\<50ms、控制\<5ms | 任务优先级与调度 |
| 成本 | BOM 上限、Flash/RAM 余量 | 选型与功能裁剪 |
| 维护 | 可升级、可诊断 | 分区、日志、版本 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：显式状态机



下面这段主机程序验证状态机的故障锁存、非法事件忽略与显式复位：



host\_fsm.cC

 

```text
/* host_fsm.c —— 应用状态机：正常/降级/故障锁存（主机可运行）。
 *
 * 把界面的“模式”与业务的“状态”统一成一张显式状态机：
 *   BOOT → IDLE → RUN →（STOP）IDLE；RUN 遇 SENSOR_INVALID → FAULT（锁存）。
 * 关键规则：① 故障优先并锁存，必须显式 RESET 才能清除；② 非法的 (状态,事件) 组合被忽略，不改变状态。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_fsm.c -o host_fsm && ./host_fsm
 */
#include <stdio.h>
#include <string.h>

typedef enum { BOOT, IDLE, RUN, FAULT, SLEEP, NSTATE } state_t;
typedef enum { EV_START, EV_ARM, EV_STOP, EV_SENSOR_INVALID, EV_RESET, EV_SLEEP, EV_WAKE, NEVENT } event_t;

static const char *SNAME[NSTATE]  = {"BOOT", "IDLE", "RUN", "FAULT", "SLEEP"};
static const char *ENAME[NEVENT]  = {"START", "ARM", "STOP", "SENSOR_INVALID", "RESET", "SLEEP", "WAKE"};

/* 返回下一个状态；无效组合返回当前状态 */
static state_t step(state_t s, event_t e) {
    switch (s) {
        case BOOT:  return (e == EV_START) ? IDLE : s;
        case IDLE:  if (e == EV_ARM) return RUN;
                    if (e == EV_SLEEP) return SLEEP;
                    return s;
        case RUN:   if (e == EV_STOP) return IDLE;
                    if (e == EV_SLEEP) return SLEEP;
                    if (e == EV_SENSOR_INVALID) return FAULT;   /* 故障优先且锁存 */
                    return s;
        case FAULT: return (e == EV_RESET) ? IDLE : s;          /* 只能显式复位 */
        case SLEEP: return (e == EV_WAKE) ? IDLE : s;
        default:    return s;
    }
}

int main(void) {
    event_t script[] = {EV_START, EV_ARM, EV_SENSOR_INVALID, EV_ARM, EV_RESET, EV_ARM};
    state_t s = BOOT;
    int entered_fault = 0, ignored_in_fault = 0;
    printf("起始状态: %s\n", SNAME[s]);
    for (unsigned i = 0; i < sizeof(script) / sizeof(script[0]); i++) {
        state_t ns = step(s, script[i]);
        printf("  %-14s: %s -> %s%s\n", ENAME[script[i]], SNAME[s], SNAME[ns],
               ns == s ? "（忽略）" : "");
        if (ns == FAULT) entered_fault = 1;
        if (s == FAULT && ns == FAULT) ignored_in_fault++;
        s = ns;
    }
    printf("最终状态: %s\n", SNAME[s]);

    int ok = 1;
    if (!entered_fault) ok = 0;          /* 故障被进入 */
    if (ignored_in_fault < 1) ok = 0;    /* 锁存：FAULT 期间的 ARM 被忽略 */
    if (s != RUN) ok = 0;                /* 复位并重新 ARM 后回到 RUN */
    if (step(IDLE, EV_SENSOR_INVALID) != IDLE) ok = 0;  /* IDLE 下该事件无效 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

状态机模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_fsm.c -o labs/host_fsm && ./labs/host_fsm
START         : BOOT -> IDLE
ARM           : IDLE -> RUN
SENSOR_INVALID: RUN -> FAULT
ARM           : FAULT -> FAULT（忽略）
RESET         : FAULT -> IDLE
ARM           : IDLE -> RUN
最终状态: RUN
RESULT: PASS
```



故障优先且锁存：FAULT 下再来 ARM 被忽略；必须 RESET 才清除，最终状态 RUN。



表 1.2 状态迁移



| 迁移 | 结果 | 说明 |
| --- | --- | --- |
| START | BOOT→IDLE | 启动 |
| ARM | IDLE→RUN | 进入运行 |
| SENSOR\_INVALID | RUN→FAULT | 故障锁存 |
| FAULT 下 ARM | FAULT | 非法事件忽略 |
| RESET | FAULT→IDLE | 显式复位 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm01-plat\n```\n\n\n\n```zhizhan-anchor\nm01-plat-t\n```\n\n\n\n## 1.3 三平台对照：架构骨架\n\n\n\n同一套 {init,poll} 接口与状态机在三平台的落地不同，但“先定接口与状态，再谈调度”一致。\n\n\n\nm01\\_arch.cC\n\n \n\n```text\n/* m01_arch.c —— 模块化架构：接口表 + 状态机（Cortex-M3）。\n * 先把模块抽象成 {init, poll} 接口，再决定前后台还是任务骨架；先画架构再写代码。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\ntypedef struct { const char *name; int (*init)(void); int (*poll)(void); } module_t;\n\nextern int sensor_mod_init(void);   extern int sensor_mod_poll(void);\nextern int ui_mod_init(void);       extern int ui_mod_poll(void);\nextern int comm_mod_init(void);     extern int comm_mod_poll(void);\n\nstatic const module_t g_modules[] = {\n    {\"sensor\", sensor_mod_init, sensor_mod_poll},\n    {\"ui\",     ui_mod_init,     ui_mod_poll},\n    {\"comm\",   comm_mod_init,   comm_mod_poll},\n};\n\n/* 前后台骨架：按“截止期从紧到松”排序后轮询；有硬期限后再升级为 RTOS（M10/M11） */\nvoid app_superloop(void) {\n    for (unsigned i = 0; i < sizeof(g_modules) / sizeof(g_modules[0]); i++) {\n        if (g_modules[i].init) (void)g_modules[i].init();\n    }\n    for (;;) {\n        for (unsigned i = 0; i < sizeof(g_modules) / sizeof(g_modules[0]); i++) {\n            (void)g_modules[i].poll();\n        }\n    }\n}\n```\n\nSTM32F103 · 架构骨架\n\n\n\nesp\\_m01\\_arch.cC\n\n \n\n```text\n/* esp_m01_arch.c —— 任务化架构（ESP32 / Xtensa）。\n * 每个模块一个任务，用亲和把“采集”和“通信”分到不同核，接口仍是 {init, task}。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\n/* 由外部提供：界面刷新（示例） */\nint ui_refresh(void);\n\nstatic void sensor_task(void *arg) { (void)arg; for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); } }\nstatic void ui_task(void *arg)     { (void)arg; for (;;) { (void)ui_refresh(); vTaskDelay(pdMS_TO_TICKS(50)); } }\nstatic void comm_task(void *arg)   { (void)arg; for (;;) { vTaskDelay(pdMS_TO_TICKS(1000)); } }\n\nvoid esp_arch_start(void) {\n    TaskHandle_t a = 0, b = 0;\n    (void)xTaskCreatePinnedToCore(sensor_task, \"sensor\", 4096u, 0, 4u, &a, 0);\n    (void)xTaskCreatePinnedToCore(ui_task,     \"ui\",     4096u, 0, 3u, &b, 1);\n    (void)xTaskCreatePinnedToCore(comm_task,   \"comm\",   4096u, 0, 2u, &a, 1);\n}\n```\n\nESP32 · 架构骨架\n\n\n\nh7\\_m01\\_arch.cC\n\n \n\n```text\n/* h7_m01_arch.c —— 任务 + 队列架构（STM32H7 / Cortex-M7）。\n * 采集任务投递样本，处理/通信任务消费；用队列解耦速率。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\ntypedef struct { int16_t v; } sample_t;\nstatic QueueHandle_t g_q;\n\nstatic void acq_task(void *arg) {\n    sample_t s = {0};\n    (void)arg;\n    for (;;) {\n        (void)xQueueSend(g_q, &s, pdMS_TO_TICKS(5));\n        vTaskDelay(pdMS_TO_TICKS(100));\n    }\n}\nstatic void proc_task(void *arg) {\n    sample_t s;\n    (void)arg;\n    for (;;) {\n        if (xQueueReceive(g_q, &s, portMAX_DELAY) == pdTRUE) { /* 处理 */ }\n    }\n}\nvoid h7_arch_start(void) {\n    g_q = xQueueCreate(8u, (uint32_t)sizeof(sample_t));\n    (void)xTaskCreate(acq_task,  \"acq\",  512u, 0, 4u, 0);\n    (void)xTaskCreate(proc_task, \"proc\", 512u, 0, 3u, 0);\n}\n```\n\nSTM32H7 · 架构骨架\n\n\n\n表 1.3 三平台骨架\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 骨架 | 前后台/FreeRTOS | FreeRTOS | 前后台/FreeRTOS |\n| 接口 | {init,poll} | {init,task} | {init,poll} |\n| 状态机 | 显式 enum\\+表 | 同 | 同 |\n| 故障 | 锁存\\+复位 | 同 | 同 |"}
````



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



架构自检：需求能量化、模块有接口、状态显式、故障锁存。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  状态机与故障锁存



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="状态机与故障锁存" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">BOOT</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">IDLE</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">RUN</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">FAULT(锁存)</text></svg>
```



BOOT/IDLE/RUN/FAULT/SLEEP；FAULT 优先并锁存，只有 RESET 才清除。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 需求 | 量化指标 | 凭感觉 |
| 接口 | {init,poll} | 互相直调 |
| 状态 | 显式枚举 | 散落 if |
| 故障 | 锁存\+复位 | 自动恢复 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **没有量化需求就选架构** ：要么过度设计，要么不够用。

- **没有状态机** ：模式切换散落各处 if，故障时行为不可预测。

- **故障不锁存** ：传感器自恢复后自动继续输出，可能把错误带进执行器。

- **接口未定义** ：模块互相直接调用，替换/测试困难。



◆ 自测 · Module 01（先答再看）




1. 传感器瞬时无效，为什么状态机应进入 FAULT 而不是自动回到 RUN？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"瞬态异常往往意味着更深的问题；自动恢复可能让错误在执行器上被放大。正确做法是进入安全态并锁存，等显式复位或人工确认后再恢复。"}
   ```

2. “采样率/续航/响应”为什么必须先量化？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它们直接决定架构（是否需要周期任务、低功耗策略、优先级分配）。不量化就只能凭感觉选，容易过度设计或不够用。"}
   ```

3. 模块为什么统一成 {init, poll/task} 接口？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"接口统一后，前后台与 RTOS 只是“谁来调用”的实现差异，模块可独立替换与测试；否则互相直调、耦合加深。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的项目写“需求→指标→架构”对照表，并画出显式状态机（含故障锁存与复位）。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html) · [ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

 

动手练习



运行 ` labs/host_fsm.c `：验证状态机在故障锁存、非法事件忽略、显式复位后恢复的行为。



**检查结果：** 故障优先且锁存，非法 (状态,事件) 被忽略，必须显式复位才清除故障。

 

迁移练习：把本章的“能把需求量化成可测指标，并据此画出显式状态机与模块 {init, poll/task} 接口。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m01","criterion":"故障优先且锁存，非法 (状态,事件) 被忽略，必须显式复位才清除故障。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
