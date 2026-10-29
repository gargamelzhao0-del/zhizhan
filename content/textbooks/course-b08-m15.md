# 产品级应用验收

```zhizhan-anchor
m15
```



需求指标；资源预算；保护状态；长跑与可维护性。

 

> 前置：已完成前 14 章，能读代码的资源占用、保护逻辑与升级/诊断能力。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把每条需求映射为可测验收断言（资源/保护/实时/可靠/可维护），并留下可核查证据。

 

本章速览




- 产品级验收把“能交付”变成可测阈值：RAM/Flash/时延/保护/长跑。

- 需求指标逐条对应验收项，缺一条就不算完成。

- 可维护性（日志、升级、诊断）也是验收的一部分。

 

```zhizhan-anchor
m15-accept
```



```zhizhan-anchor
m15-accept-t
```



## 15.1 验收=可测断言



“做完了”不等于“能交付”。验收要把每条需求变成可测断言，并留下证据。



```zhizhan-anchor
fig-图-15-1
```



**图 15.1**  验收五维



```zhizhan-figure
<svg viewBox="0 0 800 130" width="100%" height="130" role="img" aria-label="验收五维" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">资源</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">保护</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">实时</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">可靠/可维护</text></svg>
```



资源（RAM/Flash）| 保护（故障输出=0 且锁存）| 实时（响应）| 可靠（复位/长跑）| 可维护（日志/升级/诊断）。



表 15.1 验收维度



| 验收维度 | 可测项 | 阈值示例 |
| --- | --- | --- |
| 资源 | RAM/Flash 占用 | RAM≤70%、Flash≤80% |
| 保护 | 故障时输出 | 输出=0 且锁存 |
| 实时 | 响应/整定时间 | 按需求指标 |
| 可靠 | 复位来源/长跑 | 无异常复位、长跑稳定 |
| 可维护 | 日志/升级/诊断 | 可升级、可回滚、可查 |



```zhizhan-anchor
m15-evidence
```



```zhizhan-anchor
m15-evidence-t
```



## 15.2 真实证据：三平台验收代码（交叉编译）



三平台的验收/自检代码均通过交叉编译；资源与保护逻辑在代码层可核对：



m15\_accept.cC

 

```text
/* m15_accept.c —— 产品级验收断言（Cortex-M3）。
 * 把“能交付”变成可测阈值：资源占用、保护状态、可维护性都要能自动判。 */
#include <stdint.h>
#include "app_api.h"

typedef struct { uint32_t used; uint32_t total; } budget_t;

int accept_ram_ok(budget_t b)   { return (uint64_t)b.used * 100u <= (uint64_t)b.total * 70u; }  /* RAM ≤ 70% */
int accept_flash_ok(budget_t b) { return (uint64_t)b.used * 100u <= (uint64_t)b.total * 80u; }  /* Flash ≤ 80% */

/* 保护状态：故障时输出必须为 0 */
int accept_fault_output_zero(int fault, int pwm_out) { return fault ? (pwm_out == 0) : 1; }
```

STM32F103 · 验收自检



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m15_accept.c -o m15.o && arm-none-eabi-size m15.o
   text    data     bss     dec     hex filename
     86       0       0      86      56 m15.o
```



真实工具输出：m15\_accept.c（M3）text=86 B；esp\_m15\_accept.c（Xtensa）text=34 B；h7\_m15\_accept.c（M7）text=32 B。端到端长跑/硬件依赖属板上实测项，本册未接板。



表 15.2 验收代码规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m15\_accept.c | M3 | 86 B |
| esp\_m15\_accept.c | Xtensa | 34 B |
| h7\_m15\_accept.c | M7 | 32 B |
| 阈值 | — | RAM≤70% Flash≤80% |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm15-plat\n```\n\n\n\n```zhizhan-anchor\nm15-plat-t\n```\n\n\n\n## 15.3 三平台对照：验收手段\n\n\n\n三平台的资源/复位/升级手段不同，但“需求→指标→验收断言”一致。\n\n\n\nm15\\_accept.cC\n\n \n\n```text\n/* m15_accept.c —— 产品级验收断言（Cortex-M3）。\n * 把“能交付”变成可测阈值：资源占用、保护状态、可维护性都要能自动判。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\ntypedef struct { uint32_t used; uint32_t total; } budget_t;\n\nint accept_ram_ok(budget_t b)   { return (uint64_t)b.used * 100u <= (uint64_t)b.total * 70u; }  /* RAM ≤ 70% */\nint accept_flash_ok(budget_t b) { return (uint64_t)b.used * 100u <= (uint64_t)b.total * 80u; }  /* Flash ≤ 80% */\n\n/* 保护状态：故障时输出必须为 0 */\nint accept_fault_output_zero(int fault, int pwm_out) { return fault ? (pwm_out == 0) : 1; }\n```\n\nSTM32F103 · 验收\n\n\n\nesp\\_m15\\_accept.cC\n\n \n\n```text\n/* esp_m15_accept.c —— ESP32 验收：运行时间与自检（Xtensa）。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nint esp_accept_selftest(void) {\n    float t = 0.0f, r = 0.0f;\n    if (esp_timer_get_time() < 0) return -1;      /* 时基异常 */\n    if (sensor_read(&t, &r) != 0) return -2;      /* 传感器自检 */\n    return 0;\n}\n```\n\nESP32 · 验收\n\n\n\nh7\\_m15\\_accept.cC\n\n \n\n```text\n/* h7_m15_accept.c —— H7 验收：复位来源与资源预算（Cortex-M7）。 */\n#include \"stm32_app.h\"\n\nint h7_accept_reset_clean(void) {\n    return (RCC_CSR & (1u << 29)) ? 0 : 1;   /* 不应是看门狗复位：1=干净 */\n}\n\nint h7_accept_nvic_prio_ok(uint32_t basepri) {\n    return (basepri == 0x50u) ? 1 : 0;       /* 与 configMAX_SYSCALL_INTERRUPT_PRIORITY 一致 */\n}\n```\n\nSTM32H7 · 验收\n\n\n\n表 15.3 三平台验收\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 资源 | map/size | idf size | map/size |\n| 复位 | RCC\\_CSR | reset\\_reason | RCC\\_CSR |\n| 升级 | 双 Bank | OTA | 双 Bank |\n| 长跑 | 老化测试 | 老化测试 | 老化测试 |"}
````



```zhizhan-anchor
m15-check
```



```zhizhan-anchor
m15-check-t
```



## 15.4 自检



验收自检：需求对齐断言、资源达标、保护可测、长跑可维护。



```zhizhan-anchor
fig-图-15-2
```



**图 15.2**  资源阈值（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="资源阈值（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">RAM</text><rect x="150" y="26" width="420" height="18" rx="4" class="sv-grn-s"></rect><text x="578" y="43" class="sv-lbl-hi">70% 上限</text><text x="12" y="67" class="sv-lbl">Flash</text><rect x="150" y="50" width="480" height="18" rx="4" class="sv-amb-s"></rect><text x="638" y="67" class="sv-lbl-hi">80% 上限</text></svg>
```



RAM ≤70%、Flash ≤80% 留出升级/日志余量；超限则应裁剪功能。



表 15.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 对齐 | 需求→指标→断言 | 只测功能 |
| 资源 | RAM≤70/Flash≤80 | 上线才发现不够 |
| 保护 | 故障=0 且锁存 | 只测正常路径 |
| 长跑 | 跑够\+注入故障 | 几分钟就宣称稳定 |



```zhizhan-anchor
m15-pitfalls
```



```zhizhan-anchor
m15-pitfalls-t
```



## 15.5 常见误区与排障



失败路径与排障




- **只验证功能不验证资源** ：上线后 RAM/Flash 不够，改不动。

- **保护只测正常路径** ：故障时输出没关，安全不达标。

- **不跑长跑** ：偶发泄漏/复位在上线后暴露。

- **无可维护性证据** ：现场故障无法定位、无法升级。



◆ 自测 · Module 15（先答再看）




1. 为什么“可维护性”也算产品验收项？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"产品交付后会有现场故障与需求变更。可升级（不砖）、可诊断（日志/复位原因）、可回滚，决定后续维护成本；没有它们每次问题都要返厂。"}
   ```

2. 为什么验收要设资源阈值（RAM≤70%/Flash≤80%）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"要留出升级、日志与临时缓冲的余量。若跑满，后续加功能/修 bug 都没有空间，只能返工重排。"}
   ```

3. 保护为什么要专门验收“故障时输出=0 且锁存”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"保护常只在正常路径被“顺带”验证。必须构造故障场景，确认输出确实关闭并锁存（需显式复位），否则安全不达标。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的项目列“需求-指标-验收”对照表，逐条给出可测断言与证据（资源/保护/实时/可靠/可维护）。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html) · [FreeRTOS · 栈溢出与调试](https://www.freertos.org/Stacks-and-stack-overflow-checking.html)

 

动手练习



编译三个平台的验收代码；为项目列“需求-指标-验收”对照表并逐条判定。



**检查结果：** 每条需求都有可测断言；RAM ≤ 70%、Flash ≤ 80%；故障时输出=0 且锁存；长跑/可维护性有证据。

 

迁移练习：把本章的“能把每条需求映射为可测验收断言（资源/保护/实时/可靠/可维护），并留下可核查证据。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 15 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m15","criterion":"每条需求都有可测断言；RAM ≤ 70%、Flash ≤ 80%；故障时输出=0 且锁存；长跑/可维护性有证据。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
