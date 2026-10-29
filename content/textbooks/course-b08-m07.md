# 电源与续航

```zhizhan-anchor
m07
```



功耗预算表（每外设 μA/mA × 占空比）、动态时钟、外设按需上电、休眠策略、电池计量与低电保护。

 

> 前置：理解 电量=电流×时间，会读外设数据手册的 μA/mA 电流参数。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能列功耗预算表算出平均电流与续航，按贡献最大项优化，并实现低电告警与保护。

 

本章速览




- 功耗预算 = Σ(工作电流 × 占空比)；常开与高占空比外设主导平均电流。

- 动态时钟、按需上电、深睡眠是把续航做长的三把钥匙。

- 先算表再优化最重的一项；低电要能告警并进入保护。

 

```zhizhan-anchor
m07-power
```



```zhizhan-anchor
m07-power-t
```



## 7.1 续航是算出来的



续航是算出来的：平均电流 = Σ(外设工作电流 × 占空比)。主导项通常是“常开外设”与“高占空比外设”，而不是峰值电流。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  平均电流对比（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="平均电流对比（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">低功耗</text><rect x="150" y="26" width="6" height="18" rx="4" class="sv-grn-s"></rect><text x="164" y="43" class="sv-lbl-hi">260µA</text><text x="12" y="67" class="sv-lbl">无线常开</text><rect x="150" y="50" width="588" height="18" rx="4" class="sv-red-s"></rect><text x="746" y="67" class="sv-lbl-hi">23505µA</text></svg>
```



低功耗配置 260µA→480 天；无线常开 23505µA→5 天。占空比把高电流“稀释”。



表 7.1 省电手段



| 手段 | 效果 | 代价 |
| --- | --- | --- |
| 动态时钟 | 降频省电 | 算力下降 |
| 按需上电 | 不用就断电 | 上下电时序与稳定时间 |
| 深睡眠 | 空闲大幅省电 | 丢内存、唤醒慢 |
| 降低上报频率 | 省无线功耗 | 数据时效性下降 |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：两种配置的续航



下面这段主机程序核对两种配置的平均电流与 3000mAh 电池续航：



host\_power.cC

 

```text
/* host_power.c —— 功耗预算与续航估算（主机可运行）。
 *
 * 平均电流 = Σ(外设工作电流 × 占空比)。续航 = 电池容量 / 平均电流。
 * 关键认知：占空比与“常开”外设主导平均电流，而不是峰值电流。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_power.c -o host_power && ./host_power
 */
#include <stdio.h>
#include <stdint.h>

typedef struct { const char *name; uint32_t active_ua; uint32_t duty_permille; } item_t;

static uint32_t avg_uA(const item_t *it, int n) {
    uint64_t sum = 0;
    for (int i = 0; i < n; i++) sum += (uint64_t)it[i].active_ua * it[i].duty_permille;
    return (uint32_t)(sum / 1000u);
}
static uint32_t life_days(uint32_t cap_mah, uint32_t ua) {
    if (ua == 0) return 0xFFFFFFFFu;
    uint64_t uah = (uint64_t)cap_mah * 1000u;      /* mAh → uAh */
    return (uint32_t)(uah / ua / 24u);             /* 小时 → 天 */
}

int main(void) {
    /* 低功耗配置：MCU 50‰、无线 5‰、传感器 10‰、睡眠常开 5µA */
    item_t good[] = {
        {"MCU",   3000, 50}, {"Radio", 20000, 5}, {"Sensor", 500, 10}, {"Sleep", 5, 1000}
    };
    /* 反面配置：无线常开 */
    item_t bad[]  = {
        {"MCU",   3000, 1000}, {"Radio", 20000, 1000}, {"Sensor", 500, 1000}, {"Sleep", 5, 1000}
    };
    uint32_t g = avg_uA(good, 4), b = avg_uA(bad, 4);
    uint32_t days_g = life_days(3000, g), days_b = life_days(3000, b);
    printf("低功耗配置平均电流 = %u µA  → 3000mAh 续航 %u 天\n", g, days_g);
    printf("无线常开平均电流   = %u µA  → 3000mAh 续航 %u 天\n", b, days_b);

    int ok = 1;
    if (g != 260u) ok = 0;                     /* 150+100+5+5 */
    if (b != 23505u) ok = 0;                   /* 3000+20000+500+5 */
    if (days_g < 365u) ok = 0;                 /* 目标：单节电池一年 */
    if (!(days_b * 10u < days_g)) ok = 0;      /* 反面配置明显更短 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

功耗预算模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_power.c -o labs/host_power && ./labs/host_power
低功耗配置平均电流 = 260 µA  → 3000mAh 续航 480 天
无线常开平均电流   = 23505 µA  → 3000mAh 续航 5 天
RESULT: PASS
```



低功耗 260µA→480 天（达标≥一年）；无线常开 23505µA→5 天，差近 100 倍。



表 7.2 续航对比



| 配置 | 平均电流 | 续航 |
| --- | --- | --- |
| 低功耗 | 260 µA | 480 天 |
| 无线常开 | 23505 µA | 5 天 |
| 电池 | 3000 mAh | — |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm07-plat\n```\n\n\n\n```zhizhan-anchor\nm07-plat-t\n```\n\n\n\n## 7.3 三平台对照：低功耗\n\n\n\n三平台的低功耗外设（sleep 模式）不同，但功耗预算与按需上电原则一致。\n\n\n\nm07\\_power.cC\n\n \n\n```text\n/* m07_power.c —— 功耗预算表与续航估算（Cortex-M3）。\n * 平均电流 = Σ(工作电流 × 占空比)。先算表，再优化最重的一项。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\ntypedef struct { const char *name; uint32_t ua; uint32_t duty_permille; } pitem_t;\n\nstatic const pitem_t g_budget[] = {\n    {\"mcu\", 3000, 50}, {\"radio\", 20000, 5}, {\"sensor\", 500, 10}, {\"sleep\", 5, 1000},\n};\n\nuint32_t power_avg_ua(void) {\n    uint64_t s = 0;\n    for (unsigned i = 0; i < sizeof(g_budget) / sizeof(g_budget[0]); i++)\n        s += (uint64_t)g_budget[i].ua * g_budget[i].duty_permille;\n    return (uint32_t)(s / 1000u);\n}\n\nuint32_t power_life_days(uint32_t cap_mah) {\n    uint32_t ua = power_avg_ua();\n    if (ua == 0) return 0;\n    return (uint32_t)((uint64_t)cap_mah * 1000u / ua / 24u);\n}\n```\n\nSTM32F103 · 功耗\n\n\n\nesp\\_m07\\_power.cC\n\n \n\n```text\n/* esp_m07_power.c —— ESP32 低功耗休眠与定时唤醒（Xtensa）。\n * 深睡眠丢内存，唤醒等价复位；因此睡眠前先把状态写入 NVS/RTC。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nvoid esp_sleep_ms(uint32_t ms) {\n    (void)power_set_mode(2);                              /* 进入 standby 记账 */\n    (void)esp_sleep_enable_timer_wakeup((uint64_t)ms * 1000u);\n    esp_deep_sleep_start();                               /* 不返回 */\n}\n```\n\nESP32 · 功耗\n\n\n\nh7\\_m07\\_power.cC\n\n \n\n```text\n/* h7_m07_power.c —— H7 STOP 模式与唤醒（Cortex-M7）。\n * 进 STOP 前配置唤醒源（RTC/EXTI），唤醒后从原处继续。 */\n#include \"stm32_app.h\"\n\nvoid h7_enter_stop(void) {\n    PWR_CR |= PWR_CR_LPDS;      /* 深睡时稳压器低功耗 */\n    PWR_CR |= PWR_CR_CWUF;      /* 清唤醒标志 */\n    __asm volatile (\"wfi\");     /* 等待中断唤醒 */\n}\n```\n\nSTM32H7 · 功耗\n\n\n\n表 7.3 三平台低功耗\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 低功耗 | Stop/Standby | light/deep sleep | Stop/Standby |\n| 唤醒 | RTC/EXTI | RTC/GPIO | RTC/EXTI |\n| 时钟 | 可降频 | DFS | 可降频 |\n| 计量 | ADC | ADC | ADC |"}
````



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



功耗自检：列预算表、优化主导项、配唤醒源、留低电保护。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  功耗优化顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="功耗优化顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">列预算</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">找主导项</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">优化</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">复核</text></svg>
```



列预算表 → 找贡献最大项 → 降占空比/降频/断电 → 复核平均电流与续航。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 预算 | Σ电流×占空比 | 只看峰值 |
| 主导 | 常开/高占空比 | 忽略漏电 |
| 唤醒 | 配置唤醒源 | 一睡不醒 |
| 低电 | 告警\+保护 | 硬撑到掉电 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **只看峰值电流** ：峰值高但占空比极低，续航可能仍好。

- **忽略常开外设** ：LDO/传感器漏电流长期累积，主导平均电流。

- **深睡眠未配唤醒源** ：一睡不醒或频繁误唤醒。

- **无低电保护** ：电压跌落时 Flash 写入失败，丢参数/日志。



◆ 自测 · Module 07（先答再看）




1. 一个 20mA 的无线模块，占空比 0.5%，平均电流是多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"20mA × 0.005 = 0.1mA = 100µA。占空比把高电流“稀释”了——这也是“降低上报频率”最省电的原因。"}
   ```

2. 为什么不能只看峰值电流判断续航？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"续航由平均电流决定。峰值高但占空比极低时，平均电流可能很小；反之常开的小电流外设累积起来才是主导项。"}
   ```

3. 低电保护为什么必要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"电压跌落时 Flash 写入会失败，可能丢参数/固件。低电应告警并降功能保数据，而不是硬撑到掉电。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：列一张功耗预算表算出平均电流与续航，按贡献最大项优化，并加低电告警与保护。



核对与延伸：[ESP-IDF · 睡眠与低功耗](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/sleep_modes.html) · [ST · AN4994 FreeRTOS 低功耗](https://www.st.com/resource/en/application_note/an4994-how-to-use-freertos-with-lowpower-features-on-the-stm32-microcontroller-stmicroelectronics.pdf)

 

动手练习



运行 ` labs/host_power.c `：核对低功耗配置与“无线常开”配置的平均电流与续航差异。



**检查结果：** 低功耗 260µA→3000mAh 续航 480 天（达标≥一年）；无线常开 23505µA→5 天。

 

迁移练习：把本章的“能列功耗预算表算出平均电流与续航，按贡献最大项优化，并实现低电告警与保护。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m07","criterion":"低功耗 260µA→3000mAh 续航 480 天（达标≥一年）；无线常开 23505µA→5 天。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
