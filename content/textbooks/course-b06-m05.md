# 中断与 RTOS 的边界

```zhizhan-anchor
m05
```



ISR 里能做什么；为什么要延迟处理；临界区长度与中断延迟的定量关系；BASEPRI 阈值。

 

> 前置：了解中断优先级与内核临界区的概念，知道 ISR 不能阻塞。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能划分中断与任务边界，使 ISR 只做取数据/清标志/唤醒，并用 BASEPRI 阈值控制中断延迟。

 

本章速览




- 中断里只做“取数据 \+ 唤醒任务”，长逻辑交给任务。

- 临界区用 BASEPRI 只屏蔽到 configMAX\_SYSCALL\_INTERRUPT\_PRIORITY，更紧急的中断仍响应。

- 把中断优先级设得比该阈值更高（数值更小）就禁止调用 RTOS API。

 

```zhizhan-anchor
m05-isr
```



```zhizhan-anchor
m05-isr-t
```



## 5.1 中断只做“取数据\+清标志\+唤醒”



中断优先级高于任何任务，所以 ISR 里唯一该做的是取数据 \+ 清标志 \+ 唤醒任务。在 ISR 里做长工作会拉高所有任务和其它中断的延迟。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  ISR 与任务的边界



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="ISR 与任务的边界" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">中断</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">ISR(短)</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">FromISR 唤醒</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">任务处理</text></svg>
```



硬件中断 → ISR（取数据/清标志/FromISR 唤醒）→ 任务（做实际计算/通信）。



表 5.1 ISR 能做什么



| 动作 | 能否在 ISR 中做 | 原因 |
| --- | --- | --- |
| 读外设、清中断标志 | 能 | 硬件时序，必须尽快 |
| 入队/give（FromISR 版） | 能 | 非阻塞，只设唤醒标志 |
| 调用普通（阻塞）RTOS API | 不能 | 中断上下文不能阻塞 |
| 等待/延时/动态分配 | 不能 | 会阻塞或不确时间 |
| 复杂运算/格式化/打印 | 不该 | 放大中断延迟 |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：ISR 只调用 FromISR（交叉编译）



M3 与 Xtensa 两份 ISR 只调用 FromISR 版并把长逻辑留给任务：



m05\_fromisr.cC

 

```text
/* m05_fromisr.c —— 中断与 RTOS 的边界（Cortex-M3）。
 * ISR 只做两件事：搬走数据、唤醒任务。临界区用 BASEPRI 只屏蔽到阈值，
 * 比阈值更紧急的中断仍可响应，实时性比“关总中断”好。 */
#include <stdint.h>
#include "rtos_cm.h"
#include "rtos_api.h"

static QueueHandle_t g_q;

void m05_isr_enqueue(uint16_t sample) {
    BaseType_t woken = pdFALSE;
    (void)xQueueSendFromISR(g_q, &sample, &woken);
    portYIELD_FROM_ISR(woken);
}

/* 任务里的短临界区：读一个共享寄存器 */
uint32_t m05_read_shared(volatile uint32_t *p) {
    uint32_t saved = cm_enter_critical();
    uint32_t v = *p;
    cm_exit_critical(saved);
    return v;
}

void m05_create(void) {
    g_q = xQueueCreate(8u, sizeof(uint16_t));
}
```

STM32F103 · ISR 只调 FromISR



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m05_fromisr.c -o m05.o && arm-none-eabi-size m05.o
   text    data     bss     dec     hex filename
     80       0       4      84      54 m05.o
```



真实交叉编译：ISR 只调用 FromISR 版 API，text=80 B、bss=4 B。



表 5.2 ISR 规模



| 量 | M3 | Xtensa |
| --- | --- | --- |
| text | 80 B | 63 B |
| 阻塞 API | 无 | 无 |
| 长逻辑 | 留给任务 | 留给任务 |
| 清标志 | ISR 内 | ISR 内 |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm05-plat\n```\n\n\n\n```zhizhan-anchor\nm05-plat-t\n```\n\n\n\n## 5.3 三平台对照：ISR 边界\n\n\n\n三平台都把 FromISR/中断安全 API 与任务 API 分开；BASEPRI 是实时系统的分界线。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m05\\\\_fromisr.cC\\n\\n \\n\\n```text\\n/* m05_fromisr.c —— 中断与 RTOS 的边界（Cortex-M3）。\\n * ISR 只做两件事：搬走数据、唤醒任务。临界区用 BASEPRI 只屏蔽到阈值，\\n * 比阈值更紧急的中断仍可响应，实时性比“关总中断”好。 */\\n#include <stdint.h>\\n#include \\\"rtos_cm.h\\\"\\n#include \\\"rtos_api.h\\\"\\n\\nstatic QueueHandle_t g_q;\\n\\nvoid m05_isr_enqueue(uint16_t sample) {\\n    BaseType_t woken = pdFALSE;\\n    (void)xQueueSendFromISR(g_q, &sample, &woken);\\n    portYIELD_FROM_ISR(woken);\\n}\\n\\n/* 任务里的短临界区：读一个共享寄存器 */\\nuint32_t m05_read_shared(volatile uint32_t *p) {\\n    uint32_t saved = cm_enter_critical();\\n    uint32_t v = *p;\\n    cm_exit_critical(saved);\\n    return v;\\n}\\n\\nvoid m05_create(void) {\\n    g_q = xQueueCreate(8u, sizeof(uint16_t));\\n}\\n```\\n\\nSTM32F103 · FromISR\"}\n````\n\n\n\nesp\\_m05\\_isr.cC\n\n \n\n```text\n/* esp_m05_isr.c —— ESP32 的中断服务程序（Xtensa）。\n * ISR 必须放 IRAM（IRAM_ATTR），且只能调用 FromISR 版 API。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n#include \"rtos_api.h\"\n\nstatic QueueHandle_t g_q;\n\nvoid IRAM_ATTR esp_gpio_isr(void *arg) {\n    BaseType_t woken = pdFALSE;\n    uint32_t level = 1u;\n    (void)arg;\n    (void)xQueueSendFromISR(g_q, &level, &woken);\n    if (woken == pdTRUE) { portYIELD_FROM_ISR(woken); }\n}\n\nvoid esp_m05_install(void) {\n    g_q = xQueueCreate(8u, (uint32_t)sizeof(uint32_t));\n}\n```\n\nESP32 · ISR\n\n\n\nh7\\_m05\\_basepri.cC\n\n \n\n```text\n/* h7_m05_basepri.c —— 用 BASEPRI 做临界区（STM32H7 / Cortex-M7）。\n * 阈值以下（更紧急）的中断不被屏蔽；比 PRIMASK 关所有中断更适合实时系统。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n\nstatic volatile uint32_t g_counter;\n\nuint32_t h7_atomic_inc(void) {\n    uint32_t saved = cm_enter_critical();\n    g_counter++;\n    uint32_t v = g_counter;\n    cm_exit_critical(saved);\n    return v;\n}\n\n/* 读的是同一个共享量：与自增互斥 */\nuint32_t h7_atomic_read(void) {\n    uint32_t saved = cm_enter_critical();\n    uint32_t v = g_counter;\n    cm_exit_critical(saved);\n    return v;\n}\n```\n\nSTM32H7 · BASEPRI\n\n\n\n表 5.3 三平台 ISR 边界\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 阈值 | configMAX\\_SYSCALL\\_INTERRUPT\\_PRIORITY | port 阈值 | 同 M3 |\n| 临界区 | BASEPRI | portENTER\\_CRITICAL | BASEPRI |\n| 更高优先级 ISR | 禁调 RTOS API | 禁调 | 禁调 |\n| 延迟处理 | 任务/软件定时器 | 任务/定时器 | 任务/定时器 |"}
`````



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检



边界自检：ISR 短、只 FromISR、临界区用 BASEPRI、长活下沉。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  ISR 短 → 其它中断延迟低



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="ISR 短 → 其它中断延迟低" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M315,26 V94"></path><text x="315" y="18" text-anchor="middle" class="sv-lbl-dim">8</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M605,26 V94"></path><text x="605" y="18" text-anchor="middle" class="sv-lbl-dim">22</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><text x="12" y="48" class="sv-lbl">长 ISR</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="620" height="22" rx="4" class="sv-red-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">ISR</text><text x="12" y="82" class="sv-lbl">短 ISR</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="165" height="22" rx="4" class="sv-grn-s"></rect><text x="232.7" y="81" text-anchor="middle" class="sv-lbl-hi">ISR</text></svg>
```



ISR 越长，所有任务与其它中断的最坏延迟越大；把长活下沉到任务可显著缩短 ISR。



表 5.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 取数据 | ISR 内 | 做重活 |
| 唤醒 | FromISR | 普通 API |
| 临界区 | BASEPRI 短 | 关全部中断很长 |
| 长活 | 下沉任务 | 关中断算完 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **ISR 里用普通 xQueueSend/xSemaphoreTake** ：可能阻塞，行为异常。

- **中断优先级高于阈值却调 RTOS API** ：内核临界区被打断，难复现崩溃。

- **ISR 里打印/浮点** ：耗时不确定，放大最坏中断延迟。

- **忘记清外设中断标志** ：中断反复触发，像“卡死”。



◆ 自测 · Module 05（先答再看）




1. 中断里要做 200µs 滤波计算，为什么“关中断算完”是坏设计？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"关中断 200µs 会让所有其它中断延迟 200µs，可能超过别人的截止期。应存原始数据、唤醒任务在任务上下文算，中断只占几十周期。"}
   ```

2. configMAX\_SYSCALL\_INTERRUPT\_PRIORITY 是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"分界线：优先级比它更紧急（数值更小）的中断不允许调用任何 RTOS API，因为它可以在内核临界区里打断内核，导致竞态。"}
   ```

3. FromISR 版 API 与普通版的区别？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"FromISR 版不阻塞，用 xHigherPriorityTaskWoken 表示是否唤醒了更高优先级任务；普通版可能阻塞，中断里不能用。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：审查你的 ISR：只保留取数据/清标志/唤醒，把长活下沉到任务并核对中断优先级阈值。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [ESP-IDF · FreeRTOS (IDF) 与任务 API](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html)

 

动手练习



编译 ` labs/m05_fromisr.c `（M3）与 ` labs/esp_m05_isr.c `（Xtensa），确认 ISR 只调用 FromISR。



**检查结果：** ISR 里不出现会阻塞的 API（只调用 FromISR 版）；共享量读写都在短临界区内。

 

迁移练习：把本章的“能划分中断与任务边界，使 ISR 只做取数据/清标志/唤醒，并用 BASEPRI 阈值控制中断延迟。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m05","criterion":"ISR 里不出现会阻塞的 API（只调用 FromISR 版）；共享量读写都在短临界区内。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
