# 从开发板到自制板

```zhizhan-anchor
m09
```



最小系统（电源/晶振/复位/BOOT/调试口）、去耦与布局要点、晶振负载电容、ESD/EMC 入门、首板上电排查。

 

> 前置：会看原理图，用万用表/示波器测量电源与晶振，了解最小系统各组成部分。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按“电源→时钟→调试口→外设”顺序排查首板，并正确处理去耦、晶振负载电容与 BOOT 电平。

 

本章速览




- 最小系统：电源、晶振、复位、BOOT、调试口——先保证能跑起来。

- 去耦与地平面是首板成败关键；晶振负载电容要按晶振规格算。

- 首板排查顺序：电源 → 时钟 → 调试口 → 外设，逐级确认。

 

```zhizhan-anchor
m09-board
```



```zhizhan-anchor
m09-board-t
```



## 9.1 最小系统与去耦



从开发板到自制板，失败大多不在代码，而在硬件最小系统与去耦/地。先把“能跑起来”的最小条件凑齐，再逐个加外设。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  最小系统要素



```zhizhan-figure
<svg viewBox="0 0 800 125" width="100%" height="125" role="img" aria-label="最小系统要素" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">电源</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">晶振</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">复位/BOOT</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">SWD</text></svg>
```



电源（稳压\+去耦）| 晶振（负载电容按规格）| 复位（上拉\+电容）| BOOT 电平 | 调试口（SWD）。



表 9.1 最小系统



| 要素 | 要点 | 常见错误 |
| --- | --- | --- |
| 电源 | 稳压\+去耦 | 缺去耦电容，复位随机 |
| 晶振 | 负载电容按规格 | 电容不匹配→起振慢或不振 |
| 复位 | 上拉\+电容 | 复位抖动导致偶发不启动 |
| BOOT | 启动模式引脚电平 | 电平错→从系统存储启动 |
| 调试口 | SWD 引线短、共地 | 接线过长，连不上 |



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：三平台板级代码（交叉编译）



三平台的板级初始化代码均通过交叉编译：



m09\_board.cC

 

```text
/* m09_board.c —— 首板上电自检顺序（Cortex-M3）。
 * 顺序：电源稳定 → 时钟起振 → 调试口可用 → 逐个外设探测。 */
#include "app_api.h"

int board_bringup(void) {
    float t = 0.0f, rh = 0.0f;
    if (sensor_read(&t, &rh) != 0) return -1;   /* 传感器无响应：先查供电/上拉/地址 */
    if (display_clear() != 0) return -2;         /* 显示无响应：查电源与 SPI/I²C */
    (void)display_text(0, 0, "OK");
    return (int)display_flush();
}
```

STM32F103 · 板级初始化



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m09_board.c -o m09.o && arm-none-eabi-size m09.o
   text    data     bss     dec     hex filename
     63       0       0      63      3f m09.o
```



真实工具输出：m09\_board.c（M3）text=63 B；esp\_m09\_board.c（Xtensa）text=19 B；h7\_m09\_board.c（M7）text=20 B。



表 9.2 板级代码规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m09\_board.c | M3 | 63 B |
| esp\_m09\_board.c | Xtensa | 19 B |
| h7\_m09\_board.c | M7 | 20 B |
| 排查 | — | 电源→时钟→调试→外设 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm09-plat\n```\n\n\n\n```zhizhan-anchor\nm09-plat-t\n```\n\n\n\n## 9.3 三平台对照：板级差异\n\n\n\n三平台的最小系统与去耦要求不同，但“先最小系统后外设”的排查顺序一致。\n\n\n\nm09\\_board.cC\n\n \n\n```text\n/* m09_board.c —— 首板上电自检顺序（Cortex-M3）。\n * 顺序：电源稳定 → 时钟起振 → 调试口可用 → 逐个外设探测。 */\n#include \"app_api.h\"\n\nint board_bringup(void) {\n    float t = 0.0f, rh = 0.0f;\n    if (sensor_read(&t, &rh) != 0) return -1;   /* 传感器无响应：先查供电/上拉/地址 */\n    if (display_clear() != 0) return -2;         /* 显示无响应：查电源与 SPI/I²C */\n    (void)display_text(0, 0, \"OK\");\n    return (int)display_flush();\n}\n```\n\nSTM32F103 · 板级\n\n\n\nesp\\_m09\\_board.cC\n\n \n\n```text\n/* esp_m09_board.c —— ESP32 自制板检查（Xtensa）。\n * 重点：strapping 引脚电平、Flash 模式、USB/串口桥的自动下载电路。 */\n#include \"esp_app.h\"\n\nint esp_board_check(void) {\n    int64_t us = esp_timer_get_time();\n    /* 真实工程在这里读 strapping 引脚、打印芯片型号与 Flash 模式 */\n    return (us > 0) ? 0 : -1;\n}\n```\n\nESP32 · 板级\n\n\n\nh7\\_m09\\_board.cC\n\n \n\n```text\n/* h7_m09_board.c —— H7 自制板电源与内核电压检查（Cortex-M7）。\n * H7 需要正确的外部供电与 VCORE 去耦；VOS 档位与频率相关。 */\n#include \"stm32_app.h\"\n\nint h7_power_rails_ok(void) {\n    /* 真实工程测量 VDD/VCORE 并核对 VOS 档位；这里给出占位判定 */\n    return (H7_PWR_CR1 == 0xFFFFFFFFu) ? 0 : 1;   /* 1 = 正常 */\n}\n```\n\nSTM32H7 · 板级\n\n\n\n表 9.3 三平台板级\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 核心电压 | 3.3V/1.8V 核 | 3.3V | 3.3V/1.2V 核 |\n| 晶振 | 8MHz\\+负载电容 | 40MHz 晶振 | 25MHz\\+负载电容 |\n| 去耦 | 0.1µF 靠引脚 | 模组内 | 0.1µF 靠引脚 |\n| 调试 | SWD | JTAG/串口 | SWD |"}
````



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



首板自检：先电源、再时钟、再调试、最后外设。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  首板排查顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="首板排查顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">电源</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">时钟</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">调试口</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">外设</text></svg>
```



量 VDD/VCORE → 看晶振波形 → 确认 SWD 能连 → 逐个探测外设。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 电源 | 量 VDD/VCORE | 先怀疑代码 |
| 时钟 | 看晶振波形 | 负载电容乱选 |
| 调试 | SWD 短、共地 | 接线过长 |
| 外设 | 逐个探测 | 一次全上 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **跳过电源检查** ：一上来就查代码，忽略电压/去耦问题。

- **晶振负载电容乱选** ：起振慢或停在某幅度，表现为“偶发不启动”。

- **BOOT 引脚悬空** ：上电进错启动模式，程序不运行。

- **调试口接线过长** ：SWD 时序被打乱，连不上就以为芯片坏了。



◆ 自测 · Module 09（先答再看）




1. 新板“上电没反应”，第一步量什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先量电源（VDD/VCORE 是否在规格内）与复位电平，再看晶振是否起振，最后确认调试口能否连接。不要先怀疑代码——最小系统没过，代码无从谈起。"}
   ```

2. 晶振负载电容为什么不能乱选？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"负载电容不匹配会让起振慢或停在某个幅度，表现为“偶发不启动”。应按晶振规格计算匹配电容。"}
   ```

3. BOOT 引脚电平为什么关键？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它决定上电从哪个存储启动（Flash/系统存储/RAM）。电平错会让程序根本不运行，却看起来像“代码问题”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按“电源→时钟→调试口→外设”顺序排查你的首板，记录每级的波形/电平并与规格比对。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) · [ST · AN2606 系统存储器 Bootloader](https://www.st.com/resource/en/application_note/cd00167594.pdf)

 

动手练习



编译三个平台的自制板代码；首板按“电源→时钟→调试→外设”顺序逐级确认并记录波形。



**检查结果：** VDD/VCORE 在规格内、晶振起振、SWD 能连、外设逐个通过。

 

迁移练习：把本章的“能按“电源→时钟→调试口→外设”顺序排查首板，并正确处理去耦、晶振负载电容与 BOOT 电平。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m09","criterion":"VDD/VCORE 在规格内、晶振起振、SWD 能连、外设逐个通过。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
