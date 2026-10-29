# 输入输出电气类型

```zhizhan-anchor
m16
```



“输入输出类型”首先是 **电气** 问题：输出分推挽（能主动拉高拉低）与开漏（只能拉低、靠外接上拉）；输入分上拉/下拉/浮空/模拟。没有 DAC 的芯片常用 PWM\+RC 做“伪 DAC”。

 

> 前置：理解推挽/开漏/上下拉与 ADC/PWM 的基本电气行为。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按电气需求选推挽/开漏/上拉/模拟输入，并用 PWM\+RC 伪 DAC 或硬件比较器实现模拟输出/比较。

 

本章速览




- 输出分推挽与开漏：开漏只能拉低，高电平靠上拉，适合线与总线。

- 输入要确定电平：上拉/下拉/浮空/模拟，悬空会乱跳。

- 没 DAC 用 PWM\+RC 做伪 DAC；比较用硬件或 ADC\+迟滞。

 

```zhizhan-anchor
m16-types
```



```zhizhan-anchor
m16-types-t
```



## 16.1 推挽 vs 开漏、上拉/浮空/模拟



输出：推挽能主动拉高拉低（普通 IO/LED/PWM），开漏/OC/OD 只能拉低、高电平靠上拉，适合线与总线（[I²C](term:i2c)、多器件共享）。输入：上拉、下拉、浮空、模拟；浮空输入遇悬空线会乱跳。



```zhizhan-anchor
fig-图-16-1
```



**图 16.1**  推挽与开漏的输出能力



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="推挽与开漏的输出能力" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">推挽：可高可低（两端驱动）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">开漏：只能拉低（高靠上拉）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">线与：任一拉低即低（I²C）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">两推挽对顶 → 大电流/发热</text></svg>
```



推挽：上管/下管都能驱动；开漏：只有下管，高电平必须靠外部上拉。两个推挽对接会短路发热。



表 16.1 输入/输出类型



| 类型 | 能否拉高 | 典型用途 | 注意 |
| --- | --- | --- | --- |
| 推挽 PP | 能 | 普通 IO、LED、PWM | 两端同时驱动会短路 |
| 开漏 OD/OC | 不能（靠上拉） | I²C/线与、多主总线 | 必须外接上拉 |
| 上拉输入 PU | — | 按键到地 | 长线加 RC 防抖 |
| 模拟输入 AN | — | ADC 采样 | 先关数字输入 |



m16\_io\_types.c 节选C

 

```text
// 开漏输出：只能拉低，高电平靠外部上拉（I²C/线与）
GPIO_Config(GPIOB, 6, OUT_OD_2MHz);
// 模拟输入：先关数字缓冲再采（F1 需配成模拟模式）
GPIO_Config(GPIOA, 0, AN_INPUT);
// 软件比较器带迟滞：避免阈值附近抖动
if (v > hi) state = 1; else if (v < lo) state = 0;
```

真实反汇编对应寄存器位配置；迟滞用双阈值实现



```zhizhan-anchor
m16-analog
```



```zhizhan-anchor
m16-analog-t
```



## 16.2 模拟输出与比较：伪 DAC



没有 DAC 的芯片（F1）用  **PWM \+ RC 低通** 做“伪 DAC”：用占空比控制平均电压。要“比较”，有硬件比较器的直接用；没有的用 ADC \+ 软件阈值 \+  **迟滞** ，避免阈值附近抖动。



```zhizhan-anchor
fig-图-16-2
```



**图 16.2**  PWM \+ RC → 平均电压



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="PWM + RC → 平均电压" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">40</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">80</text><text x="12" y="48" class="sv-lbl">PWM</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="155" height="22" rx="4" class="sv-grn-s"></rect><text x="227.5" y="47" text-anchor="middle" class="sv-lbl-hi">高</text><rect x="305" y="32" width="155" height="22" rx="4" class="sv-box"></rect><text x="382.5" y="47" text-anchor="middle" class="sv-lbl-hi">低</text><rect x="460" y="32" width="155" height="22" rx="4" class="sv-grn-s"></rect><text x="537.5" y="47" text-anchor="middle" class="sv-lbl-hi">高</text><rect x="615" y="32" width="155" height="22" rx="4" class="sv-box"></rect><text x="692.5" y="47" text-anchor="middle" class="sv-lbl-hi">低</text><text x="12" y="82" class="sv-lbl">RC 均值</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="310" height="22" rx="4" class="sv-cyn-s"></rect><text x="305.0" y="81" text-anchor="middle" class="sv-lbl-hi">≈1.65V</text><rect x="460" y="66" width="310" height="22" rx="4" class="sv-cyn-s"></rect><text x="615.0" y="81" text-anchor="middle" class="sv-lbl-hi">≈1.65V</text></svg>
```



PWM 高低翻转经 RC 低通得到与占空比成正比的平均电压；纹波由 RC 时间常数决定。



表 16.2 模拟输出/比较方式



| 输出方式 | 芯片 | 分辨率 | 适用 |
| --- | --- | --- | --- |
| PWM\+RC 伪 DAC | 无 DAC（F1） | 取决于 PWM | 设定点/慢变化 |
| 真实 DAC | H7/ESP32 | 12/8 位 | 波形/精确电平 |
| 硬件比较器 | 部分系列 | 阈值可调 | 快速比较 |
| ADC\+软件阈值 | 通用 | ADC 位宽 | 慢速比较/带迟滞 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm16-plat\n```\n\n\n\n```zhizhan-anchor\nm16-plat-t\n```\n\n\n\n## 16.3 三平台对照：I/O 电气\n\n\n\n三平台 I/O 电气配置不同：F103 用 CNF/MODE；H7 用 MODER/OTYPER；ESP32 用 IO MUX/驱动档。三份代码均已交叉编译。\n\n\n\nm16\\_io\\_types.cC\n\n \n\n```text\n/* m16_io_types.c — B05-M16 输入输出电气类型（STM32F103）\n * 推挽/开漏（OC/OD）、上拉/浮空输入、PWM+RC 做“伪 DAC”、用 ADC+窗口做软件比较器。 */\n#include \"stm32f103_regs.h\"\n\n/* 输出类型：推挽能主动拉高/拉低；开漏只能拉低，高电平靠外部上拉（总线/线与/OC/OD） */\nvoid io_cfg_pushpull(uint8_t pin)\n{\n    GPIOC->CRL = (GPIOC->CRL & ~(0xFu << (pin * 4u)))\n               | ((uint32_t)GPIO_CNF_OUT_PP << 2) | (uint32_t)GPIO_MODE_OUT_2M;\n}\nvoid io_cfg_opendrain(uint8_t pin)\n{\n    GPIOC->CRL = (GPIOC->CRL & ~(0xFu << (pin * 4u)))\n               | ((uint32_t)GPIO_CNF_OUT_OD << 2) | (uint32_t)GPIO_MODE_OUT_2M;\n}\n/* 输入：上拉（PU）适合按键到地；浮空/模拟取决于外部电路 */\nvoid io_cfg_input_pullup(uint8_t pin)\n{\n    GPIOC->CRL = (GPIOC->CRL & ~(0xFu << (pin * 4u)))\n               | ((uint32_t)GPIO_CNF_IN_PU << 2) | (uint32_t)GPIO_MODE_INPUT;\n}\n\n/* PWM + RC 低通做“伪 DAC”：占空比 → 平均电压（F1 无 DAC 时的常见替代） */\nuint32_t io_pwm_to_mv(uint16_t permille, uint32_t vdd_mv)\n{\n    return (uint32_t)permille * vdd_mv / 1000u;\n}\n\n/* 软件比较器：ADC 采样后与阈值比较，带迟滞避免抖动 */\nint io_soft_compare(uint16_t sample, uint16_t threshold, uint16_t hysteresis)\n{\n    static int state = 0;\n    if (sample > (uint16_t)(threshold + hysteresis)) { state = 1; }\n    else if (sample < (uint16_t)(threshold - hysteresis)) { state = 0; }\n    return state;\n}\n```\n\nSTM32F103 · 推挽/开漏/伪 DAC\n\n\n\nesp\\_m16\\_io.cC\n\n \n\n```text\n/* esp_m16_io.c — B05-M16 输入输出电气类型（ESP32）\n * ESP32 有 2 路 8 位 DAC、LEDC PWM、触摸/ADC 输入；GPIO 开漏用 IO_MUX。 */\n#include \"esp32_regs.h\"\n\ntypedef enum { ESP_DAC_CH1 = 0, ESP_DAC_CH2 = 1 } esp_dac_ch_t;\nextern int dac_output_enable(esp_dac_ch_t ch);\nextern int dac_output_voltage(esp_dac_ch_t ch, uint8_t value);   /* 0..255 */\nextern int dac_output_disable(esp_dac_ch_t ch);\n\nint esp_dac_init(esp_dac_ch_t ch) { return dac_output_enable(ch); }\n\n/* 8 位 DAC：0..255 → 0..VDD（与 STM32 的 12 位不同，量程/分辨率都要换算） */\nint esp_dac_set(esp_dac_ch_t ch, uint8_t code) { return dac_output_voltage(ch, code); }\n\n/* 开漏输出：IO_MUX 里选功能，输出类型由外设/矩阵决定；这里给出 GPIO 使能 */\nvoid esp_gpio_out_enable(uint32_t pin) { GPIO_ENABLE_W1TS = (1u << pin); }\n```\n\nESP32 · I/O 电气\n\n\n\nh7\\_m16\\_io.cC\n\n \n\n```text\n/* h7_m16_io.c — B05-M16 输入输出电气类型（STM32H7，含真实 DAC）\n * H7 有 12 位 DAC；输出类型（推挽/开漏）与 F1 概念一致但寄存器不同。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_DAC_BASE 0x40007400u\n#define H7_DAC_CR   R32(H7_DAC_BASE + 0x00u)\n#define H7_DAC_DHR12R1 R32(H7_DAC_BASE + 0x08u)\n#define H7_DAC_DHR12R2 R32(H7_DAC_BASE + 0x14u)\n#define H7_DAC_CR_EN1 (1u << 0)\n#define H7_DAC_CR_EN2 (1u << 16)\n\nvoid h7_dac_init(void)\n{\n    R32(0x580244E8u) |= (1u << 29);   /* 开 DAC12 时钟（APB1LENR，示意） */\n    H7_DAC_CR |= H7_DAC_CR_EN1;\n}\n\n/* 12 位 DAC 输出：0..4095 → 0..VREF（真实模拟输出，替代 F1 的 PWM+RC） */\nvoid h7_dac_write(uint16_t code) { H7_DAC_DHR12R1 = (code & 0x0FFFu); }\n\n/* GPIO 开漏输出（I²C/线与场景）：H7 用 OTYPER */\nvoid h7_gpio_opendrain(h7_gpio_t *port, uint8_t pin)\n{\n    port->OTYPER |= (1u << pin);\n    port->MODER = (port->MODER & ~(3u << (pin * 2u))) | (H7_MODER_OUT << (pin * 2u));\n}\n```\n\nSTM32H7 · I/O 电气\n\n\n\n表 16.3 三平台 I/O 电气\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 配置 | CNF/MODE | IO MUX/驱动档 | MODER/OTYPER |\n| 开漏 | CNF=01 | OD 选项 | OTYPER.OD |\n| 伪 DAC | PWM\\+RC | DAC/LEDC | 真实 DAC |\n| 比较 | ADC\\+软件 | ADC\\+软件 | 硬件比较器 |"}
````



```zhizhan-anchor
m16-check
```



```zhizhan-anchor
m16-check-t
```



## 16.4 电气自检



电气问题用示波器/万用表验证，而不是猜：



```zhizhan-anchor
fig-图-16-3
```



**图 16.3**  输出类型 × 现象



```zhizhan-figure
<svg viewBox="0 0 800 110" width="100%" height="110" role="img" aria-label="输出类型 × 现象" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">开漏</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">推挽</text><text x="12" y="50" class="sv-lbl">无上拉</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">读不到高</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">正常</text><text x="12" y="78" class="sv-lbl">长线</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">加上拉/RC</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">注意驱动</text></svg>
```



开漏不外接上拉→读不到高；两推挽对接→发热；模拟输入没关数字缓冲→采样异常。



表 16.4 电气自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 推挽电平 | 示波器 | 高低都到位 |
| 开漏高电平 | 示波器 | 靠上拉到位 |
| 伪 DAC | 万用表 | ≈1.65V |
| 比较器 | 扫输入 | 迟滞不抖 |



```zhizhan-anchor
m16-pitfalls
```



```zhizhan-anchor
m16-pitfalls-t
```



## 16.5 常见误区与排障



失败路径与排障




- **开漏不外接上拉** ：永远读不到高电平。

- **两个推挽对接** ：一边拉高一边拉低会大电流发热。

- **模拟输入没关数字缓冲** ：F1 需配成模拟模式，否则影响采样。

- **比较器无迟滞** ：信号在阈值附近抖动，输出疯狂翻转。



◆ 自测 · Module 16（先答再看）




1. 为什么多器件的总线（如 I²C）用开漏而不是推挽？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"开漏实现“线与”——任一器件拉低即为低，不会出现两个推挽对顶的短路，才能多主/多从共享一根线。"}
   ```

2. 没有 DAC 的芯片如何输出模拟电压？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用 PWM \\+ RC 低通做“伪 DAC”，占空比决定平均电压；纹波由 RC 时间常数决定。"}
   ```

3. 软件比较器为什么要加迟滞？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"信号在阈值附近有噪声时会反复跨越阈值，输出疯狂翻转。迟滞（双阈值）让状态稳定。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把项目里一处开漏/推挽用法用示波器验证，确认上拉与电平符合预期。



核对与延伸：[ST · STM32F103 数据手册](https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html) · [ST · AN3116 ADC 模式与应用](https://www.st.com/resource/en/application_note/an3116-stm32-s-adc-modes-and-their-applications-stmicroelectronics.pdf)

 

动手练习



同一个 LED 分别配成推挽与开漏，观察开漏不外接上拉时的电压；用 PWM\+RC 输出 1.65 V 并与万用表比对。



**检查结果：** 能解释开漏不外接上拉为何读不到高电平；伪 DAC 输出与 1.65 V 理论均值在容差内；软件比较器带迟滞不抖动。

 

迁移练习：把本章的“能按电气需求选推挽/开漏/上拉/模拟输入，并用 PWM\+RC 伪 DAC 或硬件比较器实现模拟输出/比较。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 16 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m16","criterion":"能解释开漏不外接上拉为何读不到高电平；伪 DAC 输出与 1.65 V 理论均值在容差内；软件比较器带迟滞不抖动。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
