# 看门狗与低功耗

```zhizhan-anchor
m10
```



看门狗不是“定时喂就完事”：只有 **所有关键任务都按时完成后才喂狗** ，否则会掩盖卡死。同时记录并清除复位原因、按需进入 SLEEP/STOP/STANDBY，做功耗预算。

 

> 前置：理解中断/复位与低功耗模式的基本概念。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按“任务都完成才喂狗”配置 IWDG、记录并清除复位原因，并按需进入 STOP/STANDBY。

 

本章速览




- 只有“所有关键任务都完成”才喂狗，否则看门狗形同虚设。

- 复位原因要读并清除（CSR/RSR/esp\_reset\_reason）。

- 进低功耗前先配好唤醒源；STOP/STANDBY/深睡保留范围不同。

 

```zhizhan-anchor
m10-wdt
```



```zhizhan-anchor
m10-wdt-t
```



## 10.1 看门狗的正确姿势



错误做法是“主循环里无条件喂狗”——任务卡死也照样喂，看门狗形同虚设。正确做法是：把每个关键任务的心跳凑成一个“ **都活着** ”的条件，只有全部按时完成才喂狗。IWDG 启动后无法关闭。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  按条件喂狗



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="按条件喂狗" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">任务置心跳</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">全部就绪?</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">喂狗</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">否则复位</text></svg>
```



任务 A/B/C 各自置心跳 → 全部就绪才喂狗 → 任一未就绪则让它超时复位。



表 10.1 低功耗模式



| 模式 | 唤醒后 | 典型电流 | 适用 |
| --- | --- | --- | --- |
| SLEEP | 继续执行 | mA 级 | 等中断，响应最快 |
| STOP | 继续执行 | µA 级 | 定时/外部事件唤醒 |
| STANDBY | 相当于复位 | 最低 | 超长待机，SRAM 丢失 |



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：复位原因与体积



` size m10_watchdog.o ` → text= **376**  B。复位原因判断被译成一串比较，` RMVF ` 清除保证下次不误判：



m10\_watchdog.c 节选C

 

```text
uint32_t csr = RCC->CSR;
if (csr & RCC_CSR_IWDGRSTF) reason = RESET_IWDG;   // bit29
else if (csr & RCC_CSR_SFTRSTF) reason = RESET_SW; // bit28
else if (csr & RCC_CSR_PORRSTF) reason = RESET_POR; // bit27
RCC->CSR |= RCC_CSR_RMVF;   // bit24 写 1 清除所有复位标志
// 只有 reasons==ALL 时才喂狗：IWDG->KR = 0xAAAA;
```

真实反汇编对应位判断；读后必须写 RMVF 清除，避免跨复位残留



表 10.2 RCC\_CSR 复位原因位号



| 复位原因 | 位号 | 含义 |
| --- | --- | --- |
| PINRSTF | bit26 | NRST 引脚复位 |
| PORRSTF | bit27 | 上电/掉电复位 |
| SFTRSTF | bit28 | 软件复位 |
| IWDGRSTF | bit29 | 独立看门狗 |
| WWDGRSTF/LPWR | bit30/31 | 窗口看门狗/低功耗 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm10-plat\n```\n\n\n\n```zhizhan-anchor\nm10-plat-t\n```\n\n\n\n## 10.3 三平台对照：看门狗\n\n\n\n三平台看门狗不同：F103/H7 用 IWDG/WWDG；ESP32 用任务看门狗(TWDT)\\+中断看门狗。三份代码均已交叉编译。\n\n\n\nm10\\_watchdog.cC\n\n \n\n```text\n/* m10_watchdog.c — B05-M10 看门狗与低功耗\n * IWDG 初始化/喂狗 + 复位原因判别 + STOP 低功耗。 */\n#include \"stm32f103_regs.h\"\n\n#define SCB_SCR  R32(0xE000ED10u)\n#define SCB_SCR_SLEEPDEEP (1u << 2)\n\n/* LSI≈40kHz，PR=/64 → 计数 625Hz；reload 12 位上限 4095 → 最长约 6.55 s */\nvoid iwdg_init(uint16_t reload)\n{\n    IWDG_KR = IWDG_KEY_ENABLE;          /* 解锁 PR/RLR 写保护 */\n    IWDG_PR = 4u;                       /* 预分频 /64 */\n    while (IWDG_SR & IWDG_SR_PVU) {     /* 等预分频更新完成 */\n    }\n    IWDG_RLR = reload;\n    while (IWDG_SR & IWDG_SR_RVU) {     /* 等重装值更新完成（漏了 RVU 会写入无效） */\n    }\n    IWDG_KR = IWDG_KEY_RELOAD;\n    IWDG_KR = IWDG_KEY_START;           /* 启动后无法关闭，只能复位 */\n}\n\nvoid iwdg_feed(void) { IWDG_KR = IWDG_KEY_RELOAD; }\n\n/* 复位原因：RCC_CSR 的位号容易记错，这里逐位核对（bit31..26 与 RMVF=bit24） */\nconst char *reset_cause_str(void)\n{\n    uint32_t csr = RCC_CSR;\n    const char *s;\n    if      (csr & RCC_CSR_IWDGRSTF) s = \"独立看门狗\";\n    else if (csr & RCC_CSR_WWDGRSTF) s = \"窗口看门狗\";\n    else if (csr & RCC_CSR_SFTRSTF)  s = \"软件复位\";\n    else if (csr & RCC_CSR_PORRSTF)  s = \"上电/掉电复位\";\n    else if (csr & RCC_CSR_PINRSTF)  s = \"外部 NRST\";\n    else if (csr & RCC_CSR_LPWRRSTF) s = \"低功耗复位\";\n    else                             s = \"未知\";\n    RCC_CSR |= RCC_CSR_RMVF;            /* 写 1 清全部标志，避免跨复位残留误判 */\n    return s;\n}\n\n/* 进入 STOP：保留 SRAM，唤醒后继续；唤醒源可为 EXTI 中断 */\nvoid enter_stop_mode(void)\n{\n    PWR_CR |= PWR_CR_CWUF;                 /* 清唤醒标志 */\n    PWR_CR &= ~PWR_CR_PDDS;                /* STOP（非 STANDBY） */\n    PWR_CR |= PWR_CR_LPDS;                 /* 深度睡眠时稳压器低功耗 */\n    SCB_SCR |= SCB_SCR_SLEEPDEEP;          /* 选择深度睡眠 */\n    __asm volatile (\"wfi\");\n    SCB_SCR &= ~SCB_SCR_SLEEPDEEP;\n    PWR_CR &= ~PWR_CR_LPDS;\n}\n\n/* 在 STOP 前把现场写入备份寄存器（需先开 PWR/BKP 时钟并解锁 DBP） */\nvoid backup_marker_write(uint32_t marker)\n{\n    RCC_APB1ENR |= RCC_APB1ENR_PWREN | RCC_APB1ENR_BKPEN;\n    PWR_CR |= PWR_CR_DBP;                  /* 解锁备份域写保护 */\n    BKP_DR1 = marker;\n    b05_dsb();\n}\n```\n\nSTM32F103 · IWDG/WWDG\n\n\n\nesp\\_m10\\_watchdog.cC\n\n \n\n```text\n/* esp_m10_watchdog.c — ESP32 看门狗与低功耗：RTC_WDT 跨 deep-sleep，复位原因用 API 读\n * 与 STM32 的 IWDG + RCC_CSR 不同，ESP32 分 RTC_WDT（可跨睡眠）与 TWDT（任务看门狗）。 */\n#include \"esp32_regs.h\"\n\ntypedef enum {\n    ESP_RST_UNKNOWN, ESP_RST_POWERON, ESP_RST_EXT, ESP_RST_SW,\n    ESP_RST_PANIC, ESP_RST_INT_WDT, ESP_RST_TASK_WDT, ESP_RST_WDT,\n    ESP_RST_DEEPSLEEP, ESP_RST_BROWNOUT, ESP_RST_SDIO\n} esp_reset_reason_t;\n\nextern esp_reset_reason_t esp_reset_reason(void);   /* 比裸寄存器可靠，避免位义记错 */\nextern void esp_deep_sleep_start(void);\nextern unsigned long long esp_sleep_get_wakeup_cause(void);\nextern int esp_sleep_enable_timer_wakeup(unsigned long long us);\n\n/* 每 10 分钟唤醒一次的低功耗节点：定时器唤醒 + deep sleep */\nint esp_lowpower_node_start(unsigned int period_s)\n{\n    esp_sleep_enable_timer_wakeup((unsigned long long)period_s * 1000000ull);\n    return (int)esp_sleep_get_wakeup_cause();\n}\n\nvoid esp_enter_deep_sleep(void) { esp_deep_sleep_start(); }\n\n/* RTC 域在 deep sleep 中保持：RTC GPIO / RTC memory 可用于唤醒与保存现场 */\nint esp_reset_is_poweron(void) { return esp_reset_reason() == ESP_RST_POWERON; }\n```\n\nESP32 · TWDT/IWDT\n\n\n\nh7\\_m10\\_watchdog.cC\n\n \n\n```text\n/* h7_m10_watchdog.c — STM32H7 看门狗与低功耗：IWDG 寄存器与 F1 相同，低功耗分域不同\n * H7 有 D1/D2/D3 与 DSTANDBY/SRDSB1 等位，STOP/STANDBY 的保留范围比 F1 复杂。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_IWDG_BASE 0x58004800u\n#define H7_IWDG_KR   R32(H7_IWDG_BASE + 0x00u)\n#define H7_IWDG_PR   R32(H7_IWDG_BASE + 0x04u)\n#define H7_IWDG_RLR  R32(H7_IWDG_BASE + 0x08u)\n#define H7_IWDG_SR   R32(H7_IWDG_BASE + 0x0Cu)\n#define H7_PWR_CPUCR R32(0x58024810u)\n\nvoid h7_iwdg_init(uint16_t reload)\n{\n    H7_IWDG_KR = 0x5555u;                    /* 解锁 */\n    H7_IWDG_PR = 4u;                         /* /64 */\n    while (H7_IWDG_SR & (1u << 0)) { }       /* PVU */\n    H7_IWDG_RLR = reload;\n    while (H7_IWDG_SR & (1u << 1)) { }       /* RVU */\n    H7_IWDG_KR = 0xAAAAu;                    /* 重装 */\n    H7_IWDG_KR = 0xCCCCu;                    /* 启动 */\n}\n\nvoid h7_iwdg_feed(void) { H7_IWDG_KR = 0xAAAAu; }\n\n/* 复位原因：H7 在 RCC_RSR（与 F1 的 RCC_CSR 不同），位义也不同 */\nuint32_t h7_reset_flags(void) { return R32(0x58024484u); }   /* RCC_RSR */\n\n/* 进入 D1/D2 STOP：CPUCR 置 PDDS_D1/D2 等（此处示意，完整序列见 RM0433） */\nvoid h7_enter_stop(void)\n{\n    H7_PWR_CPUCR |= (1u << 0);               /* PDDS_D1 */\n    __asm volatile (\"wfi\");\n}\n```\n\nSTM32H7 · IWDG\n\n\n\n表 10.3 三平台看门狗\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 看门狗 | IWDG/WWDG | TWDT \\+ IWDT | IWDG/WWDG |\n| 时钟源 | LSI 独立 | 内部 | LSI/独立 |\n| 喂狗 | 写 KR=0xAAAA | esp\\_task\\_wdt\\_reset | KR=0xAAAA |\n| 低功耗 | SLEEP/STOP/STANDBY | light/deep sleep | CSleep/Stop |"}
````



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 功耗预算与自检



功耗预算 = Σ(外设平均电流 × 占空比)。下图示意三档的电流量级差异：



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  各模式电流量级（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="各模式电流量级（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">Run</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(相对)</text><text x="12" y="67" class="sv-lbl">SLEEP</text><rect x="150" y="50" width="218" height="18" rx="4" class="sv-amb-s"></rect><text x="376" y="67" class="sv-lbl-hi">40(相对)</text><text x="12" y="91" class="sv-lbl">STOP</text><rect x="150" y="74" width="22" height="18" rx="4" class="sv-cyn-s"></rect><text x="180" y="91" class="sv-lbl-hi">4(相对)</text><text x="12" y="115" class="sv-lbl">STANDBY</text><rect x="150" y="98" width="5" height="18" rx="4" class="sv-grn-s"></rect><text x="163" y="115" class="sv-lbl-hi">1(相对)</text></svg>
```



运行 mA 级、SLEEP 更低、STOP µA 级、STANDBY 最低（SRAM 丢失）。占空比越低，平均功耗越小。



表 10.4 看门狗/低功耗自检



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 看门狗有效 | 制造死循环 | 约 5 s 复位 |
| 复位原因 | 读 CSR 并清 RMVF | IWDGRSTF=1 |
| 唤醒源 | STOP 前配置 | 能被按时唤醒 |
| 功耗 | 各模式测电流 | 符合预算 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **无条件喂狗** ：主循环直接喂，任务卡死也照样喂。

- **只等 PVU 不等 RVU** ：写 RLR 后没等 RVU，重装值可能没生效。

- **复位原因不清除** ：旧标志残留，把上电误报成看门狗复位。

- **STOP 前不配唤醒源** ：进了就再也醒不过来（除复位）。



◆ 自测 · Module 10（先答再看）




1. 为什么“看门狗超时”有时是电源/时钟问题的表现？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"HSE 不稳或供电跌落会让程序跑飞、任务超时，看门狗随后复位。应先看复位原因与电源波形，别只盯着喂狗代码。"}
   ```

2. 为什么读了复位原因后必须写 RMVF=1？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则标志会跨复位残留，把下一次上电误判成看门狗/软件复位，误导排障。"}
   ```

3. 进入 STOP 模式前最容易忘记什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"配置唤醒源（EXTI/RTC 等）。没有唤醒源就再也醒不过来（除复位）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你产品配置“任务都完成才喂狗”的 IWDG，并在启动时记录\+清除复位原因。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) · [ST · STM32F103 数据手册](https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html)

 

动手练习



配置 IWDG 超时约 5 s；故意进死循环，验证 5 s 后复位且复位原因为“独立看门狗”。



**检查结果：** 死循环后约 5 s 被 IWDG 复位；复位原因=IWDGRSTF(bit29)、写 RMVF(bit24)=1 清除；STOP 电流显著低于运行电流。

 

迁移练习：把本章的“能按“任务都完成才喂狗”配置 IWDG、记录并清除复位原因，并按需进入 STOP/STANDBY。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m10","criterion":"死循环后约 5 s 被 IWDG 复位；复位原因=IWDGRSTF(bit29)、写 RMVF(bit24)=1 清除；STOP 电流显著低于运行电流。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
