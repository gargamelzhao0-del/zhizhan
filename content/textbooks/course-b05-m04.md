# 定时器

```zhizhan-anchor
m04
```



定时器是“时间”的硬件化：计数时钟 = 定时器时钟/(PSC\+1)，溢出周期 = (ARR\+1)×计数周期。改 PSC/ARR 后要产生一次 **更新事件** 参数才在影子寄存器生效。注意  **APB1 定时器时钟 ×2** 。

 

> 前置：了解时钟树与 APB1/APB2 定时器时钟来源。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按 PSC/ARR 公式算定时、生成指定频率/占空比 PWM，并用编码器模式读双边沿计数。

 

本章速览




- 计数时钟 = 定时器时钟/(PSC\+1)，改参数要触发更新事件才生效。

- APB 预分频≠1 时定时器时钟×2——按下 36 MHz 算会“慢一倍”。

- ESP32 用 LEDC 做 PWM；H7 的 TIM2/3/4 是 32 位计数。

 

```zhizhan-anchor
m04-model
```



```zhizhan-anchor
m04-model-t
```



## 4.1 PSC/ARR 与影子寄存器



计数时钟 = 定时器时钟/(PSC\+1)；溢出周期 = (ARR\+1)×计数周期。改 PSC/ARR 后要产生一次更新事件（写 ` EGR.UG ` 或等溢出），参数才在影子寄存器生效。 **F1 关键细节** ：APB1 预分频≠1 时，APB1 上的定时器时钟 = APB1 时钟 ×2。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  定时器时基的产生



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="定时器时基的产生" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">定时器时钟</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">/ (PSC+1)</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">计数 → ARR</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">中断/PWM</text></svg>
```



定时器时钟/(PSC\+1) → 计数 → 到 ARR 溢出/比较 → 中断或 PWM 输出。



表 4.1 F103 定时器分类



| 定时器 | 类型 | 典型能力 |
| --- | --- | --- |
| TIM1 | 高级（APB2） | 互补输出、死区、刹车 |
| TIM2/3/4 | 通用（APB1） | PWM、输入捕获、编码器 |
| TIM6/7 | 基本（APB1） | 只有时基，无 PWM |



表 4.2 PSC/ARR 计算



| 量 | 公式 | 示例（1 kHz @72MHz） |
| --- | --- | --- |
| 计数时钟 | 定时器时钟/(PSC\+1) | 72MHz/(71\+1)=1MHz |
| 周期 | (ARR\+1)×Tcount | 1000×1µs=1ms |
| 占空比 | CCRx/(ARR\+1) | 500/1000=50% |
| 编码器 | A/B 双边沿 ×4 | 正反转为 ±增量 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：运行期计算与体积



` size m04_timer.o ` → text= **164**  B。PSC/ARR 均为运行期计算，真实反汇编中可见除法（` udiv `）；把参数改成编译期常量可进一步省指令。



m04\_timer.c 节选C

 

```text
// 1 kHz、1 µs 分辨率：先分频到 1 MHz，再 1000 个周期
TIM3->PSC = 72 - 1;    // 72MHz/(71+1) = 1MHz
TIM3->ARR = 1000 - 1;  // 1MHz / 1000 = 1kHz
TIM3->CCR1 = (uint32_t)permille * (TIM3->ARR + 1) / 1000;  // 提升 u32 防溢出
TIM3->EGR = TIM_EGR_UG;   // 产生更新事件，参数生效
TIM3->CR1 |= TIM_CR1_CEN;
```

PSC/ARR 计算 \+ 更新事件 \+ 占空比防溢出



表 4.3 定时器常见现象



| 现象 | 原因 | 修正 |
| --- | --- | --- |
| PWM 慢一倍 | 按 36MHz 算，忘了 ×2 | 用 72MHz 计算 |
| 改 ARR 不生效 | 没置 ARPE/没触发 UG | 写 EGR.UG |
| 占空比溢出 | permille×ARR 用 u16 | 提升到 u32 |
| 常亮不翻转 | CCR1 \> ARR | CCR1 ≤ ARR |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm04-plat\n```\n\n\n\n```zhizhan-anchor\nm04-plat-t\n```\n\n\n\n## 4.3 三平台对照：定时器\n\n\n\n三平台时基/PWM 写法不同：F103/H7 写 PSC/ARR/CCR；ESP32 用 LEDC/定时器 API。三份代码均已交叉编译。\n\n\n\nm04\\_timer.cC\n\n \n\n```text\n/* m04_timer.c — B05-M04 定时器\n * TIM2：PWM 呼吸灯（PSC/ARR 计算）；TIM3：编码器模式读位置。\n * 关键事实：APB1 预分频≠1 时，定时器时钟 = APB1 时钟 ×2（F1 的时钟树细节）。 */\n#include \"stm32f103_regs.h\"\n\n/* sysclk_hz=72MHz，APB1=36MHz，故 TIM2 计数时钟 = 72MHz（×2） */\nvoid tim2_pwm_init(uint32_t sysclk_hz, uint32_t pwm_hz)\n{\n    RCC_APB1ENR |= RCC_APB1ENR_TIM2EN;\n\n    uint32_t tim_clk = sysclk_hz;             /* 已按 ×2 处理 */\n    uint32_t psc = tim_clk / 1000000u - 1u;   /* 计数频率 1 MHz → 1 µs 步进 */\n    uint32_t arr = 1000000u / pwm_hz - 1u;    /* PWM 周期 */\n\n    TIM2->PSC = psc;\n    TIM2->ARR = arr;\n    TIM2->CCMR1 = TIM_CCMR1_OC1M_PWM1 | TIM_CCMR1_OC1PE; /* PWM 模式 1 + 预装载 */\n    TIM2->CCR1 = 0u;\n    TIM2->CCER = TIM_CCER_CC1E;\n    TIM2->EGR = 1u;                            /* UG：立即装载 PSC/ARR */\n    TIM2->CR1 = TIM_CR1_ARPE | TIM_CR1_CEN;\n}\n\n/* 占空比 0..1000（千分比），整数运算避免浮点 */\nvoid tim2_set_duty_permille(uint16_t permille)\n{\n    if (permille > 1000u) {\n        permille = 1000u;\n    }\n    TIM2->CCR1 = (uint32_t)permille * (TIM2->ARR + 1u) / 1000u;\n}\n\nvoid tim3_encoder_init(void)\n{\n    RCC_APB1ENR |= (1u << 1);      /* TIM3EN */\n    TIM3->CCMR1 = (1u << 0) | (1u << 8); /* CC1S=01(TI1)、CC2S=01(TI2) */\n    TIM3->SMCR = TIM_SMCR_SMS_ENCODER;   /* 编码器模式 3：两相双边沿计数 ×4 */\n    TIM3->ARR = 0xFFFFu;\n    TIM3->CNT = 0u;\n    TIM3->CR1 = TIM_CR1_CEN;\n}\n\n/* 读增量：用有符号转换处理回绕 */\nint16_t tim3_encoder_read(void)\n{\n    return (int16_t)TIM3->CNT;\n}\n\n/* 输入捕获测频（示意公式）：频率 = 计数时钟 / 两次捕获差值 */\nuint32_t ic_freq_hz(uint32_t timer_clk, uint16_t captured_delta)\n{\n    if (captured_delta == 0u) {\n        return 0u; /* 防止除零；超高频/无信号时会走到这里 */\n    }\n    return timer_clk / captured_delta;\n}\n```\n\nSTM32F103 · TIM PWM\n\n\n\nesp\\_m04\\_timer.cC\n\n \n\n```text\n/* esp_m04_timer.c — ESP32 PWM：常用 LEDC 硬件 PWM，而非通用定时器比较输出\n * 与 STM32 的“TIMx + CCR 比较”不同，LEDC 有独立的分频与占空比寄存器。 */\n#include \"esp32_regs.h\"\n\n/* ESP-IDF：ledc_setup(channel, freq_hz, resolution_bits) 返回实际频率 */\nextern int ledc_setup(int channel, uint32_t freq_hz, int resolution_bits);\nextern int ledcAttachPin(int pin, int channel);\nextern int ledcWrite(int channel, uint32_t duty);\n\nuint32_t esp_ledc_init(int channel, int pin, uint32_t freq_hz, int bits)\n{\n    uint32_t real_freq = (uint32_t)ledc_setup(channel, freq_hz, bits);\n    (void)ledcAttachPin(pin, channel);\n    return real_freq;   /* 注意：实际频率可能与请求值不同，必须回读 */\n}\n\nvoid esp_ledc_duty(int channel, uint32_t duty) { (void)ledcWrite(channel, duty); }\n\n/* 若需精确计时的通用定时器，用 GPTimer（gptimer_new_timer/gptimer_set_alarm_action），\n * 那是另一套 API；LEDC 只负责 PWM。 */\n```\n\nESP32 · LEDC/timer\n\n\n\nh7\\_m04\\_timer.cC\n\n \n\n```text\n/* h7_m04_timer.c — STM32H7 定时器：通用定时器寄存器布局与 F1 相同，但时钟更高\n * H7 的 TIM2/3/4 是 32 位计数器；时钟来自 APB1 且同样受“预分频≠1 则 ×2”规则影响。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_TIM2_CR1   R32(0x40000000u)\n#define H7_TIM2_EGR   R32(0x40000014u)\n#define H7_TIM2_CCMR1 R32(0x40000018u)\n#define H7_TIM2_CCER  R32(0x40000020u)\n#define H7_TIM2_CNT   R32(0x40000024u)\n#define H7_TIM2_PSC   R32(0x40000028u)\n#define H7_TIM2_ARR   R32(0x4000002Cu)\n#define H7_TIM2_CCR1  R32(0x40000034u)\n#define H7_TIM2EN     (1u << 0)\n\nvoid h7_tim2_pwm_init(uint32_t tim_clk, uint32_t pwm_hz)\n{\n    H7_RCC_APB1LENR |= H7_TIM2EN;\n    H7_TIM2_PSC = tim_clk / 1000000u - 1u;      /* 1 MHz 计数 */\n    H7_TIM2_ARR = 1000000u / pwm_hz - 1u;\n    H7_TIM2_CCMR1 = (0x6u << 4) | (1u << 3);    /* PWM1 + 预装载 */\n    H7_TIM2_CCR1 = 0u;\n    H7_TIM2_CCER = 1u;\n    H7_TIM2_EGR = 1u;                            /* UG：装载 PSC/ARR */\n    H7_TIM2_CR1 = (1u << 7) | (1u << 0);        /* ARPE | CEN */\n}\n\nvoid h7_tim2_duty(uint16_t permille)\n{\n    if (permille > 1000u) { permille = 1000u; }\n    H7_TIM2_CCR1 = (uint32_t)permille * (H7_TIM2_ARR + 1u) / 1000u;\n}\n\n/* 32 位计数是 H7 相对 F1（16 位）的实在优势：低频测速不必频繁处理溢出 */\nuint32_t h7_tim2_count32(void) { return H7_TIM2_CNT; }\n```\n\nSTM32H7 · TIM PWM\n\n\n\n表 4.4 三平台定时器\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 时基 | PSC/ARR 寄存器 | GPTimer | PSC/ARR |\n| PWM | CCR \\+ 模式 | LEDC 通道 | CCR \\+ 模式 |\n| 分辨率 | 计数时钟决定 | LEDC 位宽 | 计数时钟决定 |\n| 编码器 | 硬件编码器模式 | PCNT 单元 | 硬件编码器 |"}
````



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 PWM 自检与速算



配完定时器后，用波形/计数自检，并记住常用速算：



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  PWM 输出波形（PSC/ARR/CCR 决定）



```zhizhan-figure
<svg viewBox="0 0 800 86" width="100%" height="86" role="img" aria-label="PWM 输出波形（PSC/ARR/CCR 决定）" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V60"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V60"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">25</text><path class="sv-dash" d="M460,26 V60"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">50</text><path class="sv-dash" d="M615,26 V60"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">75</text><path class="sv-dash" d="M770,26 V60"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">100</text><text x="12" y="48" class="sv-lbl">PWM</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="155" height="22" rx="4" class="sv-grn-s"></rect><text x="227.5" y="47" text-anchor="middle" class="sv-lbl-hi">高</text><rect x="305" y="32" width="155" height="22" rx="4" class="sv-box"></rect><text x="382.5" y="47" text-anchor="middle" class="sv-lbl-hi">低</text><rect x="460" y="32" width="155" height="22" rx="4" class="sv-grn-s"></rect><text x="537.5" y="47" text-anchor="middle" class="sv-lbl-hi">高</text><rect x="615" y="32" width="155" height="22" rx="4" class="sv-box"></rect><text x="692.5" y="47" text-anchor="middle" class="sv-lbl-hi">低</text></svg>
```



周期=(ARR\+1)×Tcount；高电平=CCR1×Tcount。改 PSC/ARR 后要触发一次更新事件。



表 4.5 PSC/ARR 速算



| 目标 | PSC | ARR | 备注 |
| --- | --- | --- | --- |
| 1 kHz @72M | 71 | 999 | 1µs 分辨率 |
| 50% 占空 | — | — | CCR1=(ARR\+1)/2 |
| 20 kHz @72M | 0 | 3599 | CCR 算法同上 |
| 编码器 | — | — | A/B 双边沿 ×4 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **计时慢一倍** ：忘记 APB1 定时器 ×2，把 36 MHz 当计数时钟。

- **改了 ARR 不生效** ：没置 ARPE 或没触发 UG，影子寄存器仍是旧值。

- **占空比溢出** ：permille×ARR 若用 uint16 会溢出，应提升到 uint32。

- **CCR1 \> ARR** ：占空比 100% 后硬件不再翻转，像“常亮”。



◆ 自测 · Module 04（先答再看）




1. 要 1 kHz PWM、1 µs 分辨率，PSC 与 ARR 各取多少（计数时钟 72 MHz）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先分频到 1 MHz：PSC = 72−1 = 71；周期 1000 µs：ARR = 1000−1 = 999。"}
   ```

2. 改了 ARR 但 PWM 频率没变，最可能是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没产生更新事件（或没置 ARPE），影子寄存器仍是旧值。写 EGR.UG 触发一次更新即可生效。"}
   ```

3. 为什么 APB1 上的定时器时钟要按 ×2 算？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"F1 规定 APB1 预分频≠1 时，挂在其上的定时器时钟被硬件自动 ×2。APB1=36 MHz 时定时器时钟=72 MHz，按 36 算会得到慢一倍的定时。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用你板子的一个通用定时器生成指定频率/占空比的 PWM，并用示波器/频率计实测核对 PSC/ARR。



核对与延伸：[ST · AN4013 定时器概览](https://www.st.com/resource/en/application_note/an4013-stm32-crossseries-timer-overview-stmicroelectronics.pdf)

 

动手练习



生成 1 kHz PWM 并用占空比调光；旋转编码器读 TIM3→CNT 的增量是否正确。



**检查结果：** PWM 频率/占空比符合计算（1 kHz：PSC=71、ARR=999）；编码器正反转读数为正/负增量（×4）。

 

迁移练习：把本章的“能按 PSC/ARR 公式算定时、生成指定频率/占空比 PWM，并用编码器模式读双边沿计数。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m04","criterion":"PWM 频率/占空比符合计算（1 kHz：PSC=71、ARR=999）；编码器正反转读数为正/负增量（×4）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
