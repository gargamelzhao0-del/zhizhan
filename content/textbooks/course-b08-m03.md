# 人机交互

```zhizhan-anchor
m03
```



按键语义（短按/长按/双击/组合）、旋转编码器、菜单系统（树形/栈式）、OLED/TFT 界面、参数设置与掉电保存。

 

> 前置：会用 GPIO/定时器读取按键电平，理解机械抖动与去抖的必要性。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把原始按键电平消抖并分类成短按/长按/双击语义事件，并用栈管理菜单层级、参数即时保存。

 

本章速览




- 按键先消抖，再提炼成语义事件（短按/长按/双击），业务只消费事件。

- 菜单用栈管理层级，双击回主界面；参数改完立即持久化。

- 界面与业务解耦：状态变化驱动刷新，而不是到处直接画屏。

 

```zhizhan-anchor
m03-ui
```



```zhizhan-anchor
m03-ui-t
```



## 3.1 语义事件与去抖



人机交互第一条原则：业务只消费“语义事件”，不碰原始电平。按键要先去抖，再依据“按下时长 / 两次间隔”分类成短按、长按、双击。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  按键去抖与语义分类



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="按键去抖与语义分类" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">25</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">50</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">75</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">100</text><text x="12" y="48" class="sv-lbl">原始</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="62" height="22" rx="4" class="sv-red-s"></rect><text x="181.0" y="47" text-anchor="middle" class="sv-lbl-hi">毛刺</text><rect x="212" y="32" width="62" height="22" rx="4" class="sv-grn-s"></rect><text x="243.0" y="47" text-anchor="middle" class="sv-lbl-hi">短按</text><rect x="274" y="32" width="50" height="22" rx="4" class="sv-red-s"></rect><text x="298.8" y="47" text-anchor="middle" class="sv-lbl-hi">毛刺</text><rect x="324" y="32" width="434" height="22" rx="4" class="sv-amb-s"></rect><text x="540.6" y="47" text-anchor="middle" class="sv-lbl-hi">长按</text><text x="12" y="82" class="sv-lbl">去抖后</text><path class="sv-dash" d="M150,78 H770"></path><rect x="212" y="66" width="62" height="22" rx="4" class="sv-grn-s"></rect><text x="243.0" y="81" text-anchor="middle" class="sv-lbl-hi">SHORT</text><rect x="324" y="66" width="434" height="22" rx="4" class="sv-amb-s"></rect><text x="540.6" y="81" text-anchor="middle" class="sv-lbl-hi">LONG</text></svg>
```



毛刺被去抖滤除；按下时长 ≥500ms → 长按；两次短按间隔 \<300ms → 双击。



表 3.1 按键语义



| 事件 | 判定 | 典型用途 |
| --- | --- | --- |
| 短按 | 按下\<500ms | 进入/确认 |
| 长按 | 按下≥500ms | 返回/进入设置 |
| 双击 | 两次短按间隔\<300ms | 回主界面 |
| 组合 | 两键同时 | 恢复出厂/高级菜单 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：去抖与分类



下面这段主机程序用含毛刺、短按、长按、双击的波形验证去抖与分类：



host\_keys.cC

 

```text
/* host_keys.c —— 按键语义：消抖 + 短按/长按/双击（主机可运行）。
 *
 * 输入是按 tick 采样的原始电平（1=按下）。先做消抖，再按“按下时长/两次间隔”分类。
 * 本程序用手工波形验证分类结果与期望一致，并验证毛刺被消抖吃掉。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_keys.c -o host_keys && ./host_keys
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define TICKS 320
#define DEBOUNCE 3
#define LONG_TICKS 50     /* 持续 >=500ms(10ms/tick) 判长按 */
#define DOUBLE_GAP 30     /* 两次按下间隔 <300ms 判双击 */

typedef struct { int start, end; } press_t;
typedef enum { EV_SHORT, EV_LONG, EV_DOUBLE, EV_NONE } ev_t;
static const char *EVNAME[4] = {"SHORT", "LONG", "DOUBLE", "NONE"};

int main(void) {
    /* 波形：毛刺(2..3) 短按(5..14) 长按(100..169) 双击(200..209 与 220..229) */
    uint8_t sig[TICKS]; memset(sig, 0, sizeof(sig));
    for (int t = 2; t <= 3; t++) sig[t] = 1;              /* 毛刺：< 消抖阈值 */
    for (int t = 5; t <= 14; t++) sig[t] = 1;             /* 短按 10 tick */
    for (int t = 100; t <= 169; t++) sig[t] = 1;          /* 长按 70 tick */
    for (int t = 200; t <= 209; t++) sig[t] = 1;          /* 双击第一下 */
    for (int t = 220; t <= 229; t++) sig[t] = 1;          /* 双击第二下 */

    /* 消抖 + 提取按下区间 */
    press_t pr[8]; int np = 0;
    int stable = 0, count = 0, start = -1;
    for (int t = 0; t < TICKS; t++) {
        if (sig[t] != stable) count++;
        else count = 0;
        if (count >= DEBOUNCE) {
            stable = sig[t];
            if (stable && start < 0) start = t;           /* 确认按下 */
            if (!stable && start >= 0 && np < 8) { pr[np].start = start; pr[np].end = t; np++; start = -1; }
        }
    }

    /* 分类：先按时长，再把相邻两个短按合并为双击 */
    ev_t ev[8]; int ne = 0;
    for (int i = 0; i < np; i++) {
        int dur = pr[i].end - pr[i].start;
        if (dur >= LONG_TICKS) ev[ne++] = EV_LONG;
        else if (i > 0 && (pr[i].start - pr[i - 1].end) < DOUBLE_GAP && ev[ne - 1] == EV_SHORT) {
            ev[ne - 1] = EV_DOUBLE;                        /* 与上一个短按合并 */
        } else ev[ne++] = EV_SHORT;
    }

    printf("按下区间=%d：", np);
    for (int i = 0; i < np; i++) printf("[%d,%d] ", pr[i].start, pr[i].end);
    printf("\n识别事件=%d：", ne);
    for (int i = 0; i < ne; i++) printf("%s ", EVNAME[ev[i]]);
    printf("\n");

    int ok = 1;
    if (np != 4) ok = 0;                                  /* 毛刺被消抖，剩 4 次真实按下 */
    if (ne != 3) ok = 0;
    if (!(ev[0] == EV_SHORT && ev[1] == EV_LONG && ev[2] == EV_DOUBLE)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

按键去抖/分类模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_keys.c -o labs/host_keys && ./labs/host_keys
按下区间=4：[7,17] [102,172] [202,212] [222,232]
识别事件=3：SHORT LONG DOUBLE
RESULT: PASS
```



毛刺被去抖吃掉；4 段按下区间识别出 3 个事件 SHORT/LONG/DOUBLE，序列与预期一致。



表 3.2 分类结果



| 区间 | 事件 | 判定 |
| --- | --- | --- |
| \[7,17\] | SHORT | \<500ms |
| \[102,172\] | LONG | ≥500ms |
| \[202,212\]\+\[222,232\] | DOUBLE | 间隔\<300ms |
| 合计 | 3 事件 | 正确 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm03-plat\n```\n\n\n\n```zhizhan-anchor\nm03-plat-t\n```\n\n\n\n## 3.3 三平台对照：交互实现\n\n\n\n三平台的按键/显示驱动不同，但“去抖→语义事件→菜单栈”的模型一致。\n\n\n\nm03\\_ui.cC\n\n \n\n```text\n/* m03_ui.c —— 按键事件驱动的菜单栈（Cortex-M3）。\n * 长按返回上一级、短按进入下一级；界面逻辑只消费“语义事件”，不碰原始电平。 */\n#include \"app_api.h\"\n\n#define MENU_DEPTH 4\nstatic int g_stack[MENU_DEPTH];\nstatic int g_top;\n\nvoid ui_init(void) { g_top = 0; }\n\nvoid ui_on_key(key_event_t k) {\n    if (k == KEY_LONG)  { if (g_top > 0) g_top--; }\n    if (k == KEY_SHORT) { if (g_top < MENU_DEPTH - 1) g_stack[g_top++] = 0; }\n    if (k == KEY_DOUBLE) { g_top = 0; }          /* 双击回主界面 */\n}\n\nint ui_depth(void) { return g_top; }\n```\n\nSTM32F103 · 交互\n\n\n\nesp\\_m03\\_ui.cC\n\n \n\n```text\n/* esp_m03_ui.c —— ESP32 界面：GPIO 读按键 + LVGL 渲染（Xtensa）。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nstatic gpio_config_t g_btn = { .pin = 0, .mode = 0 };\n\nvoid esp_ui_init(void) { (void)gpio_config(&g_btn); }\n\nvoid esp_ui_render(const char *txt) {\n    void *lbl = lv_obj_create(0);\n    lv_label_set_text(lbl, txt);\n    lv_timer_handler();                 /* 刷新一帧 */\n}\n```\n\nESP32 · 交互\n\n\n\nh7\\_m03\\_ui.cC\n\n \n\n```text\n/* h7_m03_ui.c —— H7 界面：旋转编码器 + OLED 文本（Cortex-M7）。 */\n#include \"app_api.h\"\n\nstatic int g_pos;\n\nvoid h7_encoder_delta(int d) { g_pos += d; }\nint  h7_encoder_pos(void) { return g_pos; }\n\nvoid h7_oled_show(const char *s) {\n    (void)display_clear();\n    (void)display_text(0, 0, s);\n    (void)display_flush();\n}\n```\n\nSTM32H7 · 交互\n\n\n\n表 3.3 三平台交互\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 按键 | GPIO\\+定时器 | GPIO/ADC | GPIO\\+定时器 |\n| 去抖 | 时间阈值 | 时间阈值 | 时间阈值 |\n| 菜单 | 栈 | 栈 | 栈 |\n| 显示 | OLED/TFT | OLED/TFT | OLED/TFT |"}
````



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检



交互自检：去抖、语义事件、菜单栈、参数即时保存。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  菜单栈



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="菜单栈" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">主界面</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">设置</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">子项</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">返回出栈</text></svg>
```



进入压栈、返回出栈；层级清晰，胜过一堆散落状态变量。



表 3.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 去抖 | 时间阈值 | 抖动当多次 |
| 事件 | 短/长/双击 | 全挤在单击 |
| 菜单 | 栈管理 | 散落变量 |
| 参数 | 即时保存 | 掉电丢 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **不去抖** ：机械抖动被识别成多次按键，菜单乱跳。

- **没有长按/双击语义** ：功能都挤在单键点击上，操作反人类。

- **菜单用散落状态变量** ：层级一深就乱，返回逻辑出错。

- **参数改完不保存** ：掉电即丢，用户以为设置无效。



◆ 自测 · Module 03（先答再看）




1. 为什么“两次短按间隔”要用时间阈值区分双击与两次单击？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没有间隔阈值就无法区分“用户想双击”还是“连按两下”。阈值太小会误判双击，太大则单击响应变慢；常在 250~300ms 折中。"}
   ```

2. 菜单为什么用栈而不是散落状态变量？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"栈天然表达层级：进入压栈、返回出栈，逻辑清晰且可嵌套；散落变量在层级加深后容易出错。"}
   ```

3. 参数修改后为什么必须立即持久化？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则掉电丢失，用户会以为“设置无效”。持久化要配合双副本/CRC（M13）以防半写损坏。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的按键改成“去抖→语义事件”模型，用栈管理菜单，并把参数修改做成即时持久化。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Queues / Timers](https://www.freertos.org/RTOS.html)

 

动手练习



运行 ` labs/host_keys.c `：用含毛刺、短按、长按、双击的波形验证消抖与分类结果。



**检查结果：** 毛刺被去抖吃掉；4 段按下区间识别出 3 个事件（SHORT/LONG/DOUBLE），序列与预期一致。

 

迁移练习：把本章的“能把原始按键电平消抖并分类成短按/长按/双击语义事件，并用栈管理菜单层级、参数即时保存。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m03","criterion":"毛刺被去抖吃掉；4 段按下区间识别出 3 个事件（SHORT/LONG/DOUBLE），序列与预期一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
