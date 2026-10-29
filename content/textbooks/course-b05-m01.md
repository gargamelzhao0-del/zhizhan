# 时钟树与启动

```zhizhan-anchor
m01
```



“代码明明没错，外设就是不动”——在 STM32 上多半是 **时钟没开** 或 **时钟不对** 。本章讲清 HSE/HSI→PLL→SYSCLK→AHB/APB 的分频与耦合点（Flash 等待周期、APB1 定时器 ×2），并用 MCO 验证。

 

> 前置：了解寄存器读写与 C 语法，认识时钟源、分频、外设使能等概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能配置 HSE→PLL×9=72 MHz 与 AHB/APB 分频，设置 Flash 等待周期并用 MCO 验证时钟。

 

本章速览




- 外设不动先查时钟：RCC 使能 \+ 总线分频 \+ Flash 等待周期三件事。

- HSE 起振必须带超时并回退 HSI，绝不死等。

- 72/240/480 MHz 是三种设计，验证都靠回读（MCO/API），不靠假设。

 

```zhizhan-anchor
m01-tree
```



```zhizhan-anchor
m01-tree-t
```



## 1.1 时钟树：从晶振到外设



上电默认用内部  **HSI(8 MHz)** ，启动文件调用 ` SystemInit `，由你把  **HSE(8 MHz 晶振)**  起振、经  **PLL ×9**  得到  **72 MHz SYSCLK** ，再切成 AHB 72 / APB2 72 / APB1 36 MHz。每个外设默认时钟关闭，必须先写 ` RCC_APBxENR ` 使能。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  时钟信号链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="时钟信号链" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">HSI / HSE</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">PLL ×9</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">SYSCLK 72M</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">AHB/APB 分频</text></svg>
```



HSI/HSE → PLL（×9）→ SYSCLK(72M) → AHB 预分频 → APB1/APB2 预分频 → 外设时钟。任一环配错，外设就“不动”。



表 1.1 F103 时钟源与分频



| 时钟 | 来源 | 典型值 | 作用 |
| --- | --- | --- | --- |
| HSI | 内部 RC | 8 MHz | 上电默认；精度差，不用于串口 |
| HSE | 外部晶振 | 8 MHz | 经 PLL 倍频到 72 MHz，精度高 |
| PLL | HSE×9 | 72 MHz | SYSCLK 的来源 |
| APB1 | SYSCLK÷2 | 36 MHz | 低速外设；定时器时钟会 ×2 回 72 MHz |
| APB2 | SYSCLK÷1 | 72 MHz | GPIO、ADC、USART1、SPI1 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：等待循环与体积



下面这段 F103 时钟初始化由 ` arm-none-eabi-gcc 13.3.1 `（-mcpu=cortex-m3 -Os）真实交叉编译，` size m01_clock.o ` → text= **234**  B；反汇编里能看到真实的等待循环：



m01\_clock.s 节选ASM

 

```text
a:  mov.w r2, #131072      @ 0x20000 循环上限
e:  ldr   r1, [r3, #0]     @ 读 RCC_CR
10: lsls  r1, r1, #14      @ 把 HSERDY(bit17) 移到符号位
12: bmi.n 18               @ 已就绪则跳出
14: subs  r2, #1
16: bne.n e                @ 未就绪且未超时则继续
42: ldr   r2, [r3, #0]     @ 等 PLLRDY(bit25)
44: lsls  r2, r2, #6
46: bpl.n 42
```

arm-none-eabi-gcc 真实反汇编：HSE/PLL 就绪等待 \+ 超时



表 1.2 三个耦合点与阈值



| 耦合点 | 规则 | 违反的后果 |
| --- | --- | --- |
| Flash 等待周期 | 72 MHz 须 LATENCY=2 | 取指跟不上、随机故障 |
| APB1 定时器 | APB1 预分频≠1 时定时器时钟 ×2 | 计时慢一倍 |
| MCO 上限 | 引脚 ≤50 MHz，输出 PLL/2 | 波形失真 |
| HSE 超时 | 等待应有上限并回退 | 晶振虚焊时死等 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm01-plat\n```\n\n\n\n```zhizhan-anchor\nm01-plat-t\n```\n\n\n\n## 1.3 三平台对照：时钟初始化\n\n\n\n同一件事在三平台写法不同：F103 配 RCC 寄存器；ESP32 用 IDF 时钟 API；H7 的 RCC 更复杂（多域、VOS）。三份代码均已交叉编译通过。\n\n\n\nm01\\_clock.cC\n\n \n\n```text\n/* m01_clock.c — B05-M01 时钟树与启动\n * HSE 8 MHz → PLL ×9 → SYSCLK 72 MHz；SysTick 1 ms；MCO 输出验证。\n * 编译：arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -ffreestanding -Wall -Wextra -c\n * 目标板频率测量需上板（示波器/频率计读 MCO），正文如实标注。 */\n#include \"stm32f103_regs.h\"\n\nvolatile uint32_t g_systick_ms;\n\n/* 带超时的 HSE 起振等待：晶体坏/虚焊时不能死等，否则整机卡在启动 */\nstatic int hse_ready(void)\n{\n    return (RCC_CR & RCC_CR_HSERDY) != 0u;\n}\n\nuint32_t clock_init_72m(void)\n{\n    /* 1) 使能 HSE（8 MHz 晶振，最常见的外部时钟源） */\n    RCC_CR |= RCC_CR_HSEON;\n    for (uint32_t i = 0u; i < 0x20000u && !hse_ready(); ++i) {\n        /* 空转等待；真实工程这里改为计数 + 失败回退 */\n    }\n    if (!hse_ready()) {\n        return 0u; /* 起振失败：由调用者决定回退 HSI，而不是继续跑 */\n    }\n\n    /* 2) Flash 等待周期：72 MHz 需 2 个等待周期（RM0008 FLASH_ACR.LATENCY） */\n    R32(FLASH_BASE + 0x00u) = (1u << 4) | (2u << 0); /* PRFTBE=1, LATENCY=2 */\n\n    /* 3) 总线分频：HPRE=/1、PPRE1=/2（APB1 ≤ 36 MHz）、PPRE2=/1（APB2 = 72 MHz） */\n    RCC_CFGR = (0u << 4) | (4u << 8) | (0u << 11);\n\n    /* 4) PLL：HSE 不分频作输入，倍频 ×9（PLLMUL=0111） */\n    RCC_CFGR = (RCC_CFGR & ~((0xFu << 18) | RCC_CFGR_PLLSRC | RCC_CFGR_PLLXTPRE))\n             | RCC_CFGR_PLLSRC | (7u << 18);\n    RCC_CR |= RCC_CR_PLLON;\n    while ((RCC_CR & RCC_CR_PLLRDY) == 0u) {\n    }\n\n    /* 5) 切换 SYSCLK 到 PLL，并等待 SWS 确认 */\n    RCC_CFGR = (RCC_CFGR & ~RCC_CFGR_SW) | 0x2u;\n    while ((RCC_CFGR & RCC_CFGR_SWS) != (0x2u << 2)) {\n    }\n    return 72000000u;\n}\n\nvoid systick_init_1ms(uint32_t sysclk_hz)\n{\n    SYST_RVR = sysclk_hz / 1000u - 1u;\n    SYST_CVR = 0u;\n    SYST_CSR = SYST_CSR_CLKSOURCE | SYST_CSR_TICKINT | SYST_CSR_ENABLE;\n}\n\nvoid SysTick_Handler(void)\n{\n    g_systick_ms++;\n}\n\n/* MCO 输出：MCO 引脚受 GPIO 输出能力限制（F1 引脚最高 50 MHz），\n * 不能直接输出 72 MHz，因此选 PLL/2 = 36 MHz（MCO[2:0]=111）验证 PLL 是否锁定。 */\nvoid mco_output_pa8(void)\n{\n    RCC_APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_AFIOEN;\n    GPIOA->CRH = (GPIOA->CRH & ~(0xFu << 0))\n               | ((uint32_t)GPIO_CNF_AF_PP << 2)\n               | (uint32_t)GPIO_MODE_OUT_50M;                 /* PA8 复用推挽 */\n    RCC_CFGR = (RCC_CFGR & ~(0x7u << 24)) | (0x7u << 24);    /* MCO = PLL/2 */\n}\n\nuint32_t clock_now_mhz(void)\n{\n    switch (RCC_CFGR & RCC_CFGR_SWS) {\n    case (0x0u << 2): return 8u;   /* HSI */\n    case (0x1u << 2): return 8u;   /* HSE 直连 */\n    case (0x2u << 2): return 72u;  /* PLL */\n    default:          return 0u;\n    }\n}\n```\n\nSTM32F103 · HSE\\+PLL=72MHz\n\n\n\nesp\\_m01\\_clock.cC\n\n \n\n```text\n/* esp_m01_clock.c — ESP32 时钟：XTAL 40MHz → PLL → CPU 240MHz，APB 80MHz\n * 与 STM32 不同：ESP32 的外设时钟大多“复位默认已开”，只有部分需 DPORT 级门控。 */\n#include \"esp32_regs.h\"\n\nextern uint32_t esp_clk_cpu_freq(void);   /* ESP-IDF 提供 */\nextern uint32_t esp_clk_apb_freq(void);\n\nuint32_t esp_cpu_mhz(void) { return esp_clk_cpu_freq() / 1000000u; }\nuint32_t esp_apb_mhz(void) { return esp_clk_apb_freq() / 1000000u; }\n\n/* 按位使能外设时钟（DPORT），并用 memw 保证顺序——这是 Xtensa 的屏障 */\nvoid esp_periph_enable_bit(uint32_t bit)\n{\n    DPORT_PERIP_CLK_EN_REG |= (1u << bit);\n    esp_memw();\n}\n\n/* CPU 频率可在 80/160/240MHz 间切换，并影响功耗与实时性（对比 STM32 的固定 PLL 档） */\nextern int esp_pm_configure(const void *cfg);\nint esp_power_set(void) { return esp_pm_configure((const void *)0); }\n```\n\nESP32 · 时钟/频率 API\n\n\n\nh7\\_m01\\_clock.cC\n\n \n\n```text\n/* h7_m01_clock.c — STM32H7 时钟：HSE→PLL1→SYSCLK，D1/D2/D3 三域分频\n * H7 的 PLL 有 DIVM/DIVN/DIVP，时钟按 D1/D2/D3 域分配，与 F1 的单 PLL 完全不同。\n * 目标 480 MHz（HSE=25MHz：DIVM1=5、DIVN1=192、DIVP1=2 → 5×192/2=480）。 */\n#include \"stm32h7_regs.h\"\n\nuint32_t h7_clock_480m(void)\n{\n    /* 1) 使能 HSE（HSEON=bit16，HSERDY=bit17，与 F1 相同） */\n    H7_RCC_CR |= (1u << 16);\n    for (uint32_t i = 0u; i < 0x20000u; ++i) {\n        if (H7_RCC_CR & (1u << 17)) { break; }\n    }\n    if ((H7_RCC_CR & (1u << 17)) == 0u) { return 0u; }   /* 起振失败 */\n\n    /* 2) 关键前置（顺序不能颠倒）：先升压到 VOS0 并设置 Flash 等待周期，\n     *    再把任何分频器/开关动到高频，否则切到 480MHz 时取指会出错。\n     *    下面两条为示意（真实值按 RM0433 的电压-频率表取）。 */\n    R32(0x58024818u) = (3u << 14);   /* PWR_D3CR.VOS = VOS0（示意） */\n    R32(0x52002000u) = (2u << 0);    /* FLASH_ACR.LATENCY = 2（示意） */\n\n    /* 3) 总线分频：D1CPRE=/1、HPRE=/1；D2PPRE1=/2（APB1 上限低于 SYSCLK） */\n    H7_RCC_D1CFGR = (0u << 0) | (0u << 4);\n    H7_RCC_D2CFGR = (4u << 4);\n\n    /* 4) PLL 输入=HSE，DIVM1=5（PLLSRC=10 在 bit[1:0]，DIVM1 在 bit[9:4]） */\n    H7_RCC_PLLCKSELR = (2u << 0) | (5u << 4);\n\n    /* 5) DIVN1=192（bit[8:0]）、DIVP1=2（bit[15:9]）；VCO=5×192=960MHz，输出 480MHz */\n    H7_RCC_PLL1DIVR = (192u << 0) | (2u << 9);\n    H7_RCC_CR |= H7_RCC_CR_PLL1ON;\n    while ((H7_RCC_CR & H7_RCC_CR_PLL1RDY) == 0u) {\n    }\n\n    /* 6) SYSCLK=PLL1（RCC_CFGR.SW=3），并等 SWS 确认 */\n    H7_RCC_CFGR = (H7_RCC_CFGR & ~0x7u) | 3u;\n    while (((H7_RCC_CFGR >> 3) & 0x7u) != 3u) {\n    }\n    return 480000000u;\n}\n\n/* H7 的 CPU 有 16KB I-cache / D-cache，默认未开；开启后需注意 DMA 一致性 */\nvoid h7_enable_caches(void)\n{\n    H7_SCB_CCR |= H7_SCB_CCR_ICACHE | H7_SCB_CCR_DCACHE;\n    h7_dsb();\n    h7_isb();\n}\n```\n\nSTM32H7 · 多域时钟\n\n\n\n表 1.3 三平台时钟差异\n\n\n\n| 维度 | STM32F103 (M3) | ESP32 (Xtensa) | STM32H7 (M7) |\n| --- | --- | --- | --- |\n| 源 | HSE 8M → PLL×9 | XTAL → APLL/PLL | HSE → PLL1/2/3 |\n| SYSCLK | 72 MHz | 240 MHz | 400\\+ MHz |\n| API | 写 RCC 寄存器 | esp\\_clk/rf 例程 | 写 RCC \\+ VOS |\n| 验证 | MCO → PA8 | clock\\_get\\_freq | MCO1/2 |"}
````



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 时钟自检与快速核对



配完时钟后，用下面三步自检，而不是“看起来对”：



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  各总线时钟（F103 @72MHz）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="各总线时钟（F103 @72MHz）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">SYSCLK</text><rect x="150" y="26" width="540" height="18" rx="4" class="sv-grn-s"></rect><text x="698" y="43" class="sv-lbl-hi">72MHz</text><text x="12" y="67" class="sv-lbl">AHB</text><rect x="150" y="50" width="540" height="18" rx="4" class="sv-cyn-s"></rect><text x="698" y="67" class="sv-lbl-hi">72MHz</text><text x="12" y="91" class="sv-lbl">APB2</text><rect x="150" y="74" width="540" height="18" rx="4" class="sv-cyn-s"></rect><text x="698" y="91" class="sv-lbl-hi">72MHz</text><text x="12" y="115" class="sv-lbl">APB1</text><rect x="150" y="98" width="270" height="18" rx="4" class="sv-amb-s"></rect><text x="428" y="115" class="sv-lbl-hi">36MHz</text></svg>
```



SYSCLK=72MHz、AHB=72MHz、APB2=72MHz、APB1=36MHz（挂其上的定时器再 ×2=72MHz）。



表 1.4 时钟自检四步



| 自检 | 命令/方法 | 通过标志 |
| --- | --- | --- |
| SYSCLK 源 | 读 RCC\_CFGR.SWS | =10（PLL） |
| MCO 频率 | MCO→PA8 实测 | PLL/2=36MHz |
| 等待周期 | 读 FLASH\_ACR.LATENCY | =2 @72MHz |
| 外设时钟 | 读 RCC\_APBxENR | 目标外设位=1 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **死等 HSE** ：晶振虚焊时 ` while(!(RCC_CR&HSERDY)); ` 永久卡死。→ 加超时并回退 HSI。

- **忘记 Flash 等待周期** ：72 MHz 下不设 LATENCY=2，随机取指错误/硬故障。

- **APB1 超频** ：PPRE1 设 /1 会让 APB1 跑 72 MHz（上限 36 MHz）。

- **直接 MCO 输出 72 MHz** ：超过 50 MHz 上限，波形失真；应输出 PLL/2。



◆ 自测 · Module 01（先答再看）




1. SYSCLK 已切到 PLL，但 ` RCC_CFGR.SWS ` 一直不是 10，最先怀疑什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"PLL 未锁定（` PLLRDY ` 未置位）或 HSE 未起振导致 PLL 无输入。应先确认 HSE 就绪与 PLLRDY，再切 SW。"}
   ```

2. 为什么 72 MHz 下必须设 ` FLASH_ACR.LATENCY=2 `？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Flash 读速度跟不上 72 MHz 取指，必须插入 2 个等待周期，否则取指错误、随机故障。"}
   ```

3. APB1 上的 TIM2 计数时钟是多少（SYSCLK=72 MHz、APB1=36 MHz）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"72 MHz。APB1 预分频≠1 时，挂在其上的定时器时钟 = APB1 时钟 ×2 = 36×2 = 72 MHz。按 36 算会得到慢一倍的 PWM。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用 MCO 输出你板子的时钟到引脚并实测频率，确认 SYSCLK/PLL 与预期一致。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) · [ST · STM32F103 数据手册](https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html)

 

动手练习



编译运行 ` labs/m01_clock.c `；上板后用 MCO 读 PA8 频率，确认 PLL/2=36 MHz。



**检查结果：** SYSCLK=72 MHz、APB1=36 MHz；72 MHz 下 FLASH\_ACR.LATENCY=2；HSE 起振失败返回 0 且不死等；MCO 实测 PLL/2=36 MHz。

 

迁移练习：把本章的“能配置 HSE→PLL×9=72 MHz 与 AHB/APB 分频，设置 Flash 等待周期并用 MCO 验证时钟。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m01","criterion":"SYSCLK=72 MHz、APB1=36 MHz；72 MHz 下 FLASH_ACR.LATENCY=2；HSE 起振失败返回 0 且不死等；MCO 实测 PLL/2=36 MHz。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
