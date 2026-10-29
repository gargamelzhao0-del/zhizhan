# GPIO 深入

```zhizhan-anchor
m02
```



F1 的 GPIO 用 **每位 4 bit** （MODE 定方向/速度、CNF 定推挽/开漏/复用/上下拉）；改电平要用  **BSRR**  原子写而不是读改写 ODR；PC13/14/15 有 2 MHz/3 mA/30 pF 的电气上限。

 

> 前置：会用寄存器读写（CRL/CRH、ODR/BSRR），理解位域与指针访问。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 4 位 nibble 配置 GPIO 模式、用 BSRR 原子置位/清位，并遵守 PC13 的 2 MHz 电气限制。

 

本章速览




- F1 每引脚 4 位、H7 2 位、ESP32 走 IO\_MUX\+Matrix，移植必改这一段。

- 改电平用 BSRR / W1TS 单次写，不要读改写。

- 背下引脚电气约束：PC13 限 2 MHz、GPIO34-39 只能输入。

 

```zhizhan-anchor
m02-model
```



```zhizhan-anchor
m02-model-t
```



## 2.1 4 bit 描述一个引脚：MODE \+ CNF



F1 每位 4 bit：` bit[1:0]=MODE `（输入/输出\+速度）、` bit[3:2]=CNF `（推挽/开漏/复用/上下拉）。低 8 引脚在 CRL、高 8 在 CRH。F4/G0 等改用“每引脚 2 bit 的 MODER/OTYPER”，移植时必须改这一段。



表 2.1 F103 GPIO 配置位



| MODE\[1:0\] | 含义 | CNF\[3:2\]（输出） | 含义 |
| --- | --- | --- | --- |
| 00 | 输入 | 00 | 模拟 |
| 01 | 输出 10 MHz | 01 | 通用开漏 |
| 10 | 输出 2 MHz | 10 | 复用推挽 |
| 11 | 输出 50 MHz | 00 | 通用推挽 |



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  CRL/CRH 的 4 bit nibble 布局



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="CRL/CRH 的 4 bit nibble 布局" preserveAspectRatio="xMidYMid meet"><rect x="20" y="50" width="146" height="60" rx="6" class="sv-cyn-s"></rect><text x="93.0" y="84" text-anchor="middle" class="sv-lbl-hi">CRL：pin0 nibble</text><rect x="172" y="50" width="146" height="60" rx="6" class="sv-cyn-s"></rect><text x="245.0" y="84" text-anchor="middle" class="sv-lbl-hi">CRL：pin1 nibble</text><rect x="324" y="50" width="146" height="60" rx="6" class="sv-box"></rect><text x="397.0" y="84" text-anchor="middle" class="sv-lbl-hi">… pin7</text><rect x="476" y="50" width="298" height="60" rx="6" class="sv-grn-s"></rect><text x="625.0" y="84" text-anchor="middle" class="sv-lbl-hi">CRH：pin8 … pin15</text></svg>
```



每个引脚占 4 bit；低 8 引脚在 CRL、高 8 在 CRH。写错 nibble 位置会配到别的引脚。



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：BSRR 原子置位



` size m02_gpio.o ` → text= **136**  B。置位只需一条存储（写 BSRR 偏移 0x10）：



m02\_gpio.s 节选ASM

 

```text
<led_on>:
   mov.w r2, #8192        @ 0x2000 = 1<<13
   ldr   r3, [pc, #4]     @ GPIOC=0x40011000
   str   r2, [r3, #16]    @ 写 BSRR，原子置位
   bx    lr
```

真实反汇编：置位一条 str，无需读改写、无需关中断



表 2.2 改电平的写法对比



| 写法 | 过程 | 并发安全 |
| --- | --- | --- |
| ODR 读改写 | 读→或→写 | ✗ 丢并发修改 |
| BSRR 置位 | 单次写低 16 位 | ✓ 原子 |
| BSRR 清位 | 单次写高 16 位 | ✓ 原子 |
| BRR | 专用复位寄存器 | ✓（部分系列） |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm02-plat\n```\n\n\n\n```zhizhan-anchor\nm02-plat-t\n```\n\n\n\n## 2.3 三平台对照：GPIO\n\n\n\n三平台 GPIO 抽象差异巨大：F103 写 CRL/CRH/BSRR；ESP32 用 gpio\\_set\\_level；H7 用 MODER/BSRR。三份代码均已交叉编译。\n\n\n\nm02\\_gpio.cC\n\n \n\n```text\n/* m02_gpio.c — B05-M02 GPIO 深入\n * LED(PC13) + 按键(PA0 上拉) 的寄存器写法；BSRR 原子置位/清除。\n * F1 每引脚 4 位：bit[1:0]=MODE，bit[3:2]=CNF。PC13/14/15 上限 2 MHz、3 mA。 */\n#include \"stm32f103_regs.h\"\n\n#define LED_PIN   13u\n#define BUTTON_PIN 0u\n\nvoid gpio_demo_init(void)\n{\n    RCC_APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPCEN;\n\n    /* PA0：输入上拉（CNF=10, MODE=00） */\n    GPIOA->CRL = (GPIOA->CRL & ~(0xFu << (BUTTON_PIN * 4u)))\n               | ((uint32_t)GPIO_CNF_IN_PU << 2)\n               | (uint32_t)GPIO_MODE_INPUT;\n\n    /* PC13：通用推挽输出，2 MHz（不能用 50 MHz——RM0008 限 PC13/14/15 为 2 MHz/3 mA） */\n    GPIOC->CRH = (GPIOC->CRH & ~(0xFu << ((LED_PIN - 8u) * 4u)))\n               | ((uint32_t)GPIO_CNF_OUT_PP << 2)\n               | (uint32_t)GPIO_MODE_OUT_2M;\n}\n\n/* BSRR 写 1 原子生效：低位区=置位，高位区=清除；不需要读-改-写 */\nvoid led_on(void)  { GPIOC->BSRR = (1u << LED_PIN); }\nvoid led_off(void) { GPIOC->BSRR = (1u << (LED_PIN + 16u)); }\nvoid led_toggle_sw(void) { static uint32_t s; s ^= 1u; if (s) led_on(); else led_off(); }\n\n/* 上拉输入：松开为高、按下为低 */\nint button_pressed(void) { return (GPIOA->IDR & (1u << BUTTON_PIN)) == 0u; }\n\n/* 反面示例（片段，不单独编译）：开漏输出必须外接上拉，否则只能输出低电平，\n * 因为开漏结构只能“拉低”，不能“推高”；IC/总线场景常故意如此。 */\n```\n\nSTM32F103 · CRL/CRH/BSRR\n\n\n\nesp\\_m02\\_gpio.cC\n\n \n\n```text\n/* esp_m02_gpio.c — ESP32 GPIO：IO_MUX（电气/功能）+ GPIO Matrix（信号路由）\n * 与 STM32 的“AF 复用号”不同：外设信号要经 GPIO Matrix 交换到引脚。 */\n#include \"esp32_regs.h\"\n\nvoid esp_gpio2_out_init(void)\n{\n    GPIO_ENABLE_W1TS = (1u << 2);              /* 使能输出 */\n    /* IO_MUX：MCU_SEL=0 选 GPIO 功能；驱动强度用 FUN_DRV（2 位） */\n    IO_MUX_GPIO2_REG = (IO_MUX_GPIO2_REG & ~(0x7u << IO_MUX_MCU_SEL_SHIFT))\n                     | (0u << IO_MUX_MCU_SEL_SHIFT);\n}\n\n/* 写 1 置位/清除，原子；语义与 STM32 的 BSRR 类似 */\nvoid esp_led_on(void)  { GPIO_OUT_W1TS = (1u << 2); }\nvoid esp_led_off(void) { GPIO_OUT_W1TC = (1u << 2); }\n\nint esp_button_pressed(void) { return (GPIO_IN_REG & (1u << 0)) == 0u; }\n\n/* 注意：GPIO34-39 只能输入、没有内部上下拉；GPIO16/17 在 WROVER 上被 PSRAM 占用。\n * 这些限制与 STM32 的“PC13/14/15 限 2MHz”一样，属于必须记住的引脚约束。 */\n```\n\nESP32 · gpio\\_set\\_level\n\n\n\nh7\\_m02\\_gpio.cC\n\n \n\n```text\n/* h7_m02_gpio.c — STM32H7 GPIO：每引脚 2 位的 MODER/OTYPER/OSPEEDR/PUPDR/AFR\n * 与 F1 的 CRL/CRH 4 位 nibble 完全不同；这是跨 F1→H7 移植时必改的一段。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_AF_TIM2 1u   /* PA5 作为 TIM2_CH1 的复用值（AF1） */\n\nvoid h7_gpio_pa5_af(void)\n{\n    H7_RCC_AHB4ENR |= (1u << 0);                       /* 开 GPIOA 时钟（H7 用 AHB4ENR） */\n    uint32_t s = 5u * 2u;\n    H7_GPIOA->MODER   = (H7_GPIOA->MODER & ~(3u << s)) | (H7_MODER_AF << s);\n    H7_GPIOA->OTYPER &= ~(1u << 5);                    /* 推挽 */\n    H7_GPIOA->OSPEEDR |= (3u << s);                    /* 非常快 */\n    H7_GPIOA->PUPDR   &= ~(3u << s);                   /* 无上下拉 */\n    H7_GPIOA->AFR[0] = (H7_GPIOA->AFR[0] & ~(0xFu << (5u * 4u)))\n                     | (H7_AF_TIM2 << (5u * 4u));      /* AFR[0] 管 pin0..7 */\n}\n\n/* BSRR 语义与 F1 相同：低位区置位、高位区清除，单次写原子生效 */\nvoid h7_led_on(void)  { H7_GPIOB->BSRR = (1u << 0); }\nvoid h7_led_off(void) { H7_GPIOB->BSRR = (1u << (0 + 16)); }\n```\n\nSTM32H7 · MODER/BSRR\n\n\n\n表 2.3 三平台 GPIO\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 配置 | CRL/CRH（4bit/引脚） | gpio\\_config() | MODER（2bit/引脚） |\n| 写电平 | BSRR 原子 | gpio\\_set\\_level | BSRR 原子 |\n| 限制 | PC13 2MHz/3mA | IO MUX/驱动能力档 | 更快但复用复杂 |"}
````



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 电平操作与电气核对



改电平一律走 BSRR（原子）；配引脚先核对电气上限：



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  BSRR 原子置位/清位



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="BSRR 原子置位/清位" preserveAspectRatio="xMidYMid meet"><rect x="95" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="190.0" y="66" text-anchor="middle" class="sv-lbl-hi">写低16位=置位</text><path d="M287,69 H303" class="sv-arrow"></path><rect x="305" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">写高16位=清位</text><path d="M497,69 H513" class="sv-arrow"></path><rect x="515" y="44" width="190" height="50" rx="7" class="sv-cyn-s"></rect><text x="610.0" y="66" text-anchor="middle" class="sv-lbl-hi">单次写原子</text></svg>
```



置位写 BSRR 低 16 位、清位写高 16 位；单次写即生效，无需读改写、无需关中断。



表 2.4 引脚电气上限



| 引脚 | 模式上限 | 电流 | 容性负载 |
| --- | --- | --- | --- |
| PA/PB 普通 | 50 MHz | 依系列 | 依系列 |
| PC13/14/15 | 2 MHz | 3 mA | 30 pF |
| 复位后默认 | 浮空输入 | — | — |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **BSRR 写成读改写** ：清位要写高 16 位，不是 ` |= `。

- **开漏不外接上拉** ：开漏只能拉低，没上拉永远出不了高电平。

- **PC13 配 50 MHz** ：超规格，应改 MODE=10（2 MHz）。

- **忘记开 GPIO 时钟** ：不写 IOPxEN，寄存器写进去也不生效。



◆ 自测 · Module 02（先答再看）




1. 为什么“读 ODR 再异或”翻转 LED 会和中断打架？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"读-改-写不是原子。中断若在“读之后、写之前”改了同端口其它位，返回后写回旧快照会抹掉中断的修改。翻转应改用软件状态 \\+ BSRR 单次写或临界区。"}
   ```

2. BSRR 置位和清位分别写哪一部分？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"置位写低 16 位（对应位写 1 置位），清位写高 16 位（对应位写 1 清位）。单次写即原子生效。"}
   ```

3. 为什么 PC13 不能配成 50 MHz？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"RM0008 规定 PC13/14/15 只能 2 MHz、3 mA、30 pF。配 50 MHz 超规格，表现为驱动 LED 时电压拉不满或发热。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把项目里所有 GPIO 电平操作改为 BSRR 原子写，并核对低频引脚的电气上限。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) · [ST · STM32F103 数据手册](https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html)

 

动手练习



配置 PC13 推挽点灯、PA0 上拉读按键；上板用万用表/示波器确认电平与上升沿。



**检查结果：** LED 置位=BSRR 单次 str；PC13 速度=2 MHz；按键上拉读数正确。

 

迁移练习：把本章的“能用 4 位 nibble 配置 GPIO 模式、用 BSRR 原子置位/清位，并遵守 PC13 的 2 MHz 电气限制。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m02","criterion":"LED 置位=BSRR 单次 str；PC13 速度=2 MHz；按键上拉读数正确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
