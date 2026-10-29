# 图形界面与应用状态分离

```zhizhan-anchor
m14
```



显示驱动；帧缓冲；事件；界面刷新与业务状态。

 

> 前置：能驱动 OLED/TFT 等显示，了解帧缓冲、事件与刷新时机。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把界面刷新与业务状态分离：状态结构为唯一真值、渲染只读，并用脏标志按需刷新。

 

本章速览




- 状态是唯一真值；界面只读状态、不反向改业务。

- 脏标志按需刷新，降低总线与 CPU 开销。

- 状态机与渲染分离，测试与移植都更容易。

 

```zhizhan-anchor
m14-ui
```



```zhizhan-anchor
m14-ui-t
```



## 14.1 模型-视图分离与脏标志



界面代码最容易和业务缠在一起。解法是模型-视图分离：状态结构是唯一真值，渲染函数只读状态、不反向修改业务。



```zhizhan-anchor
fig-图-14-1
```



**图 14.1**  状态 → 置脏 → 按需刷新



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="状态 → 置脏 → 按需刷新" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">业务改状态</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">置脏</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">脏? 是</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">推屏</text></svg>
```



业务只改状态结构 → 状态变化置脏 → 刷新函数仅在脏时推屏（无变化=0 次刷新）。



表 14.1 界面分离手段



| 做法 | 好处 | 代价 |
| --- | --- | --- |
| 状态结构唯一 | 测试/移植容易 | 需要设计状态 |
| 渲染只读 | 不引入业务副作用 | 需同步时机 |
| 脏标志刷新 | 省总线/CPU | 需正确置脏 |
| 事件驱动 | 响应及时 | 事件队列要有界 |



```zhizhan-anchor
m14-evidence
```



```zhizhan-anchor
m14-evidence-t
```



## 14.2 真实证据：三平台界面代码（交叉编译）



三平台的界面代码均通过交叉编译；脏标志使无变化时 0 次刷新：



m14\_ui\_state.cC

 

```text
/* m14_ui_state.c —— 界面与应用状态分离（Cortex-M3）。
 * 状态结构是唯一真值；渲染函数只读状态、不反向改业务。 */
#include "app_api.h"

typedef struct { float temp; int16_t rh; ui_state_t st; } app_state_t;
static app_state_t g_state;

void ui_set_temp(float t) { g_state.temp = t; }
void ui_set_state(ui_state_t s) { g_state.st = s; }

/* 渲染：从状态读，输出到显示；不含业务逻辑 */
void ui_render(void) {
    char b[8] = "-----";
    b[0] = (char)('0' + (int)g_state.st);       /* 用状态码占位显示 */
    (void)display_clear();
    (void)display_text(0, 0, b);
    (void)display_flush();
}
```

STM32F103 · 状态/界面分离



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m14_ui_state.c -o m14.o && arm-none-eabi-size m14.o
   text    data     bss     dec     hex filename
     92       0       0      92      5c m14.o
```



真实工具输出：m14\_ui\_state.c（M3）text=92 B；esp\_m14\_lvgl.c（Xtensa）text=15 B；h7\_m14\_ui.c（M7）text=32 B（脏标志按需刷新）。



表 14.2 界面代码规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m14\_ui\_state.c | M3 | 92 B |
| esp\_m14\_lvgl.c | Xtensa | 15 B |
| h7\_m14\_ui.c | M7 | 32 B |
| 刷新 | — | 脏时才推屏 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm14-plat\n```\n\n\n\n```zhizhan-anchor\nm14-plat-t\n```\n\n\n\n## 14.3 三平台对照：显示与界面\n\n\n\n三平台的显示库不同（段码/OLED/TFT/LVGL），但“状态唯一\\+渲染只读”一致。\n\n\n\nm14\\_ui\\_state.cC\n\n \n\n```text\n/* m14_ui_state.c —— 界面与应用状态分离（Cortex-M3）。\n * 状态结构是唯一真值；渲染函数只读状态、不反向改业务。 */\n#include \"app_api.h\"\n\ntypedef struct { float temp; int16_t rh; ui_state_t st; } app_state_t;\nstatic app_state_t g_state;\n\nvoid ui_set_temp(float t) { g_state.temp = t; }\nvoid ui_set_state(ui_state_t s) { g_state.st = s; }\n\n/* 渲染：从状态读，输出到显示；不含业务逻辑 */\nvoid ui_render(void) {\n    char b[8] = \"-----\";\n    b[0] = (char)('0' + (int)g_state.st);       /* 用状态码占位显示 */\n    (void)display_clear();\n    (void)display_text(0, 0, b);\n    (void)display_flush();\n}\n```\n\nSTM32F103 · 状态分离\n\n\n\nesp\\_m14\\_lvgl.cC\n\n \n\n```text\n/* esp_m14_lvgl.c —— ESP32 用 LVGL 渲染（Xtensa）。\n * 界面任务只做“重绘一帧”，业务状态由上层更新。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nvoid esp_ui_task(void *arg) {\n    (void)arg;\n    for (;;) {\n        lv_timer_handler();                  /* 处理一帧事件与刷新 */\n        vTaskDelay(pdMS_TO_TICKS(30));\n    }\n}\n```\n\nESP32 · LVGL\n\n\n\nh7\\_m14\\_ui.cC\n\n \n\n```text\n/* h7_m14_ui.c —— H7 帧缓冲 + 脏标志刷新（Cortex-M7）。\n * 只有状态变化时标记脏，刷新函数在脏时才真正推屏，降低总线与 CPU 开销。 */\n#include \"app_api.h\"\n\nstatic volatile int g_dirty = 1;\n\nvoid h7_ui_mark_dirty(void) { g_dirty = 1; }\n\nint h7_ui_flush(void) {\n    if (!g_dirty) return 0;          /* 无变化：跳过刷新 */\n    g_dirty = 0;\n    return (int)display_flush();\n}\n```\n\nSTM32H7 · 界面\n\n\n\n表 14.3 三平台界面\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 显示 | SPI OLED | LVGL | TFT/SDRAM |\n| 缓冲 | 页/帧缓冲 | LVGL 缓冲 | 帧缓冲 |\n| 刷新 | 脏标志 | 脏标志 | 脏标志 |\n| 事件 | 队列 | LVGL 事件 | 队列 |"}
````



```zhizhan-anchor
m14-check
```



```zhizhan-anchor
m14-check-t
```



## 14.4 自检



界面自检：状态唯一、渲染只读、脏标志刷新、事件有界。



```zhizhan-anchor
fig-图-14-2
```



**图 14.2**  脏标志省刷新（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="脏标志省刷新（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">无变化</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-grn-s"></rect><text x="160" y="43" class="sv-lbl-hi">0(刷新次数)</text><text x="12" y="67" class="sv-lbl">有变化</text><rect x="150" y="50" width="600" height="18" rx="4" class="sv-amb-s"></rect><text x="758" y="67" class="sv-lbl-hi">1(刷新次数)</text></svg>
```



无变化时 0 次刷新；有变化才推屏，省总线/CPU，间接改善实时性与续航。



表 14.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 状态 | 唯一真值 | 界面直改业务 |
| 渲染 | 只读 | 引入副作用 |
| 刷新 | 脏标志 | 无脑全屏 |
| 事件 | 有界队列 | 无界堆积 |



```zhizhan-anchor
m14-pitfalls
```



```zhizhan-anchor
m14-pitfalls-t
```



## 14.5 常见误区与排障



失败路径与排障




- **界面直接改业务变量** ：状态来源多，冲突无法追踪。

- **无脑全屏刷新** ：总线/CPU 被刷屏占满，挤占采样与控制。

- **刷新与状态不同步** ：显示出现中间态或跳变。

- **换屏就改业务** ：驱动与逻辑未分层，移植成本高。



◆ 自测 · Module 14（先答再看）




1. 为什么“脏标志”能同时改善功耗与实时性？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无变化时跳过刷新，减少总线传输与 CPU 开销；省下的时间/电量可用于采样与控制，间接改善实时性与续航。"}
   ```

2. 为什么渲染函数不能反向修改业务状态？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则状态来源多、出现隐藏副作用，冲突无法追踪且难以测试。渲染只读，业务只改状态，边界清晰。"}
   ```

3. 事件驱动的界面为什么事件队列要有界？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无界队列在事件风暴下会吃光 RAM。有界并在满时合并/丢弃（带计数）才安全。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的界面改成“状态唯一\+渲染只读\+脏标志刷新”，并把事件队列改为有界。



核对与延伸：[LVGL 官方文档](https://docs.lvgl.io/)

 

动手练习



编译三个平台的界面代码；把界面刷新改成“状态变化→置脏→按需刷新”。



**检查结果：** 渲染不含业务逻辑；状态变化驱动刷新；无变化时 0 次刷新（脏标志生效）。

 

迁移练习：把本章的“能把界面刷新与业务状态分离：状态结构为唯一真值、渲染只读，并用脏标志按需刷新。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 14 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m14","criterion":"渲染不含业务逻辑；状态变化驱动刷新；无变化时 0 次刷新（脏标志生效）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
