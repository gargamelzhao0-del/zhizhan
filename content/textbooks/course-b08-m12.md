# 综合项目 C · 低功耗电池设备

```zhizhan-anchor
m12
```



RTC 唤醒 \+ 无线上报 \+ 电池计量；目标：单节电池运行一年。

 

> 前置：已掌握 M07 的功耗预算与 M06 的无线上报，了解 RTC 唤醒与深睡眠机制。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 RTC 唤醒 \+ 短醒快跑 \+ 休眠策略实现单节电池一年续航，并用电池计量做低电保护。

 

本章速览




- 低功耗设备：RTC 唤醒 \+ 短醒快跑 \+ 无线上报 \+ 电池计量。

- 把“醒着的时间”压到最短，是续航的决定性因素。

- 单节电池一年是算出来的，不是估出来的（见功耗预算表）。

 

```zhizhan-anchor
m12-battery
```



```zhizhan-anchor
m12-battery-t
```



## 12.1 把醒着时间压到最短



低功耗设备的核心思想：把“醒着的时间”压到最短。唤醒后尽快完成必要动作，然后立刻回睡。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  短醒快跑



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="短醒快跑" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">睡眠</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">唤醒</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">采样/上报</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">回睡</text></svg>
```



睡眠（只留唤醒源）→ 唤醒（最小外设）→ 采样\+上报 → 保存状态 → 回睡。



表 12.1 低功耗阶段



| 阶段 | 动作 | 省电要点 |
| --- | --- | --- |
| 睡眠 | 关外设、进深睡 | 只留唤醒源供电 |
| 唤醒 | 初始化最小外设 | 不要全量初始化 |
| 工作 | 采样\+上报 | 压缩数据、批量上报 |
| 回睡 | 保存状态 | 避免未保存就断电 |



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：续航与三平台规模



功耗预算可运行证据见 host\_power.c（260µA→480 天）；三平台代码交叉编译：



m12\_battery.cC

 

```text
/* m12_battery.c —— 综合项目 C：低功耗电池设备（Cortex-M3）。
 * 每个周期：唤醒 → 采样 → 上报 → 回睡；把“醒着的时间”压到最短。 */
#include <stdint.h>
#include "app_api.h"

void battery_cycle_once(void) {
    float t = 0.0f, rh = 0.0f;
    (void)sensor_read(&t, &rh);          /* 醒来后尽快完成必要动作 */
    (void)power_set_mode(2);             /* 进入 standby */
}
```

STM32F103 · 电池设备



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m12_battery.c -o m12.o && arm-none-eabi-size m12.o
   text    data     bss     dec     hex filename
     28       0       0      28      1c m12.o
```



真实工具输出：m12\_battery.c（M3）text=28 B；esp\_m12\_battery.c（Xtensa）text=29 B；h7\_m12\_battery.c（M7）text=28 B；续航 260µA→480 天见 host\_power.c。



表 12.2 电池设备规模



| 文件 | 平台 | text |
| --- | --- | --- |
| m12\_battery.c | M3 | 28 B |
| esp\_m12\_battery.c | Xtensa | 29 B |
| h7\_m12\_battery.c | M7 | 28 B |
| 续航 | — | 480 天（260µA） |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm12-plat\n```\n\n\n\n```zhizhan-anchor\nm12-plat-t\n```\n\n\n\n## 12.3 三平台对照：低功耗设备\n\n\n\n三平台的 RTC/深睡眠不同，但“短醒快跑 \\+ 只留唤醒源”一致。\n\n\n\nm12\\_battery.cC\n\n \n\n```text\n/* m12_battery.c —— 综合项目 C：低功耗电池设备（Cortex-M3）。\n * 每个周期：唤醒 → 采样 → 上报 → 回睡；把“醒着的时间”压到最短。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\nvoid battery_cycle_once(void) {\n    float t = 0.0f, rh = 0.0f;\n    (void)sensor_read(&t, &rh);          /* 醒来后尽快完成必要动作 */\n    (void)power_set_mode(2);             /* 进入 standby */\n}\n```\n\nSTM32F103 · 电池设备\n\n\n\nesp\\_m12\\_battery.cC\n\n \n\n```text\n/* esp_m12_battery.c —— ESP32 低功耗电池设备（Xtensa）。\n * 深睡眠 + 定时唤醒；醒来读电池与传感器、上报一次后立刻回睡。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nvoid esp_battery_cycle(uint32_t awake_ms) {\n    (void)esp_wifi_sta_get_rssi();                       /* 上报前确认链路 */\n    (void)power_set_mode(2);\n    (void)esp_sleep_enable_timer_wakeup((uint64_t)awake_ms * 1000u);\n    esp_deep_sleep_start();\n}\n```\n\nESP32 · 电池设备\n\n\n\nh7\\_m12\\_battery.cC\n\n \n\n```text\n/* h7_m12_battery.c —— H7 低功耗电池设备（Cortex-M7）。\n * standby 模式保留备份域（RTC/备份寄存器），唤醒后重新初始化。 */\n#include \"stm32_app.h\"\n\nvoid h7_battery_sleep(void) {\n    PWR_CR |= PWR_CR_PDDS;      /* 进入待机：关闭主稳压器 */\n    PWR_CR |= PWR_CR_CWUF;\n    __asm volatile (\"wfi\");\n}\n```\n\nSTM32H7 · 电池设备\n\n\n\n表 12.3 三平台低功耗设备\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 唤醒源 | RTC/EXTI | RTC/GPIO | RTC/EXTI |\n| 深睡 | Standby | deep sleep | Standby |\n| 计量 | ADC | ADC | ADC |\n| 上报 | 批量 | 批量 | 批量 |"}
````



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 自检



低功耗自检：短醒快跑、最小初始化、状态保存、低电保护。



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  唤醒时长与耗电（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="唤醒时长与耗电（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">醒 10ms</text><rect x="150" y="26" width="6" height="18" rx="4" class="sv-grn-s"></rect><text x="164" y="43" class="sv-lbl-hi">10(相对耗电)</text><text x="12" y="67" class="sv-lbl">醒 1s</text><rect x="150" y="50" width="571" height="18" rx="4" class="sv-red-s"></rect><text x="729" y="67" class="sv-lbl-hi">1000(相对耗电)</text></svg>
```



醒 1s 的耗电约为醒 10ms 的 100 倍；短醒快跑是低功耗第一要务。



表 12.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 唤醒 | 最小外设 | 全量初始化 |
| 工作 | 批量上报 | 逐条上报 |
| 回睡 | 保存状态 | 未保存断电 |
| 低电 | 计量\+保护 | 硬撑 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **唤醒后全量初始化** ：醒着时间变长，续航骤降。

- **深睡眠未保存状态** ：唤醒后配置丢失或行为异常。

- **只用电压估电量** ：负载变化时误差大，低电判断不准。

- **无低电保护** ：电压跌落时写 Flash 失败，丢参数/固件。



◆ 自测 · Module 12（先答再看）




1. 同样每天上报 24 次，“每次醒 10ms”与“每次醒 1s”续航差多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"唤醒功耗相近时，续航大致与醒着时间成反比——醒 1s 的耗电是醒 10ms 的约 100 倍。所以“短醒快跑”是低功耗第一要务。"}
   ```

2. 为什么唤醒后不要做全量初始化？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"全量初始化会显著拉长醒着时间，直接按比例缩短续航。应只初始化本次动作必需的最小外设。"}
   ```

3. 为什么只用电压估电量不准？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"电池电压受负载/温度/内阻影响，负载变化时电压波动大。应结合库仑计或内阻补偿，低电判断才可靠。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用 RTC 唤醒 \+ 短醒快跑 \+ 休眠策略实现单节电池一年续航，并用电池计量做低电保护与降功能。



核对与延伸：[ESP-IDF · 睡眠与低功耗](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/sleep_modes.html) · [ST · AN4994 FreeRTOS 低功耗](https://www.st.com/resource/en/application_note/an4994-how-to-use-freertos-with-lowpower-features-on-the-stm32-microcontroller-stmicroelectronics.pdf)

 

动手练习



运行 ` labs/host_power.c ` 核对续航数字；编译三个平台的电池设备代码。



**检查结果：** 平均电流 260µA→480 天达标；醒着时间被压到最短；低电有保护。

 

迁移练习：把本章的“能用 RTC 唤醒 \+ 短醒快跑 \+ 休眠策略实现单节电池一年续航，并用电池计量做低电保护。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m12","criterion":"平均电流 260µA→480 天达标；醒着时间被压到最短；低电有保护。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
