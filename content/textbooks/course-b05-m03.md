# 中断与 NVIC

```zhizhan-anchor
m03
```



中断让 CPU 不必轮询。关键是 **名字与向量表一致** 、 **优先级配置正确** 、 **进 ISR 后清挂起标志** 。最大的陷阱：` PRIMASK/BASEPRI ` 是内核专用寄存器，不是内存映射。

 

> 前置：理解中断/异常基本概念，会按寄存器手册写 C 并查向量表。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能配置 EXTI 中断与 NVIC 优先级，在 ISR 里正确清标志，并用 BASEPRI 做局部临界区。

 

本章速览




- ISR 必须清挂起标志，否则“只进一次”。

- PRIMASK/BASEPRI 是内核专用寄存器（MRS/MSR），不是内存地址。

- ESP32 没有 NVIC，用中断分配器把信号绑到某个核。

 

```zhizhan-anchor
m03-model
```



```zhizhan-anchor
m03-model-t
```



## 3.1 异常模型与优先级



Cortex-M 的异常入口/返回由硬件完成，ISR 就是普通 C 函数。` AIRCR.PRIGROUP ` 决定抢占位与子优先级的划分： **数值越小越紧急** ，抢占优先级高的可打断低的（嵌套）。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  优先级抢占：高优先级打断低优先级



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="优先级抢占：高优先级打断低优先级" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><text x="12" y="48" class="sv-lbl">ISR pri6</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="620" height="22" rx="4" class="sv-box"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">低优先级</text><text x="12" y="82" class="sv-lbl">ISR pri2</text><path class="sv-dash" d="M150,78 H770"></path><rect x="357" y="66" width="258" height="22" rx="4" class="sv-red-s"></rect><text x="485.8" y="81" text-anchor="middle" class="sv-lbl-hi">高优先级抢占</text></svg>
```



低优先级 ISR 执行中被高优先级中断打断，形成嵌套；栈按最坏嵌套深度预留。



表 3.1 中断相关寄存器与屏蔽范围



| 配置 | 地址/方式 | 屏蔽范围 |
| --- | --- | --- |
| NVIC 使能 | 0xE000E100 (ISER) | 外设 IRQ |
| NVIC 优先级 | 0xE000E400 起每 IRQ 1 字节 | 数值越小越紧急 |
| AIRCR.PRIGROUP | 0xE000ED0C bit\[10:8\] | 抢占/子优先级划分 |
| PRIMASK | CPSID i / MRS-MSR | 屏蔽所有可配置中断 |
| BASEPRI | MSR BASEPRI, r0 | 只屏蔽数值 ≥ 阈值的中断 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：内核指令而非内存访问



编译器把这些操作原样译成内核指令——这证明它们不是内存访问：



m03\_nvic.s 节选ASM

 

```text
mrs r0, PRIMASK      @ b05_get_primask()
cpsid i              @ b05_disable_irq()
cpsie i              @ b05_enable_irq()
msr BASEPRI, r0      @ b05_set_basepri()
mrs r0, IPSR         @ 判断是否在异常上下文
```

真实反汇编：PRIMASK/BASEPRI 用 CPS/MRS/MSR，非 0xE000E100



最大的认知陷阱



网上常见“PRIMASK 在 0xE000E100”是 **错的** ——0xE000E100 是 NVIC 的 ISER（使能中断）。PRIMASK/BASEPRI/FAULTMASK 是内核专用寄存器，只能用 CPSID/CPSIE 或 MRS/MSR。



表 3.2 屏蔽中断的正确做法



| 动作 | 正确做法 | 错误做法 |
| --- | --- | --- |
| 关总中断 | CPSID i | 写 0xE000E100 |
| 开总中断 | CPSIE i | 写 0xE000E100 |
| 局部屏蔽 | MSR BASEPRI | 关总中断 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm03-plat\n```\n\n\n\n```zhizhan-anchor\nm03-plat-t\n```\n\n\n\n## 3.3 三平台对照：中断\n\n\n\n三平台中断模型不同：F103/H7 是 Cortex-M NVIC；ESP32 是 Xtensa 中断分配器。三份代码均已交叉编译。\n\n\n\nm03\\_nvic.cC\n\n \n\n```text\n/* m03_nvic.c — B05-M03 中断与 NVIC\n * 优先级分组、EXTI 按键中断、PRIMASK/BASEPRI 临界区。\n * 关键事实：PRIMASK/BASEPRI 是内核“专用寄存器”，不是内存映射，必须用 MRS/MSR。 */\n#include \"stm32f103_regs.h\"\n\n#define EXTI0_IRQN 6u   /* STM32F103 的 EXTI0 中断号 */\n\nvoid nvic_set_priority_grouping(uint32_t group)\n{\n    /* AIRCR.PRIGROUP：0=1 位抢占/7 位子优先级 … 7=7 位抢占/1 位子优先级 */\n    SCB_AIRCR = AIRCR_VECTKEY | (group & 0x7u);\n}\n\nvoid exti0_button_init(void)\n{\n    RCC_APB2ENR |= RCC_APB2ENR_AFIOEN;\n    AFIO_EXTICR1 = (AFIO_EXTICR1 & ~0xFu) | 0x0u; /* PA0 → EXTI0 */\n    EXTI_FTSR |= (1u << 0);                        /* 下降沿触发 */\n    EXTI_IMR  |= (1u << 0);                        /* 不屏蔽 */\n    NVIC_IPR[EXTI0_IRQN] = (uint8_t)(0x2u << 5);   /* 优先级 2（数值越小越紧急） */\n    NVIC_ISER = (1u << EXTI0_IRQN);                /* 使能 IRQ */\n}\n\nvoid EXTI0_IRQHandler(void)\n{\n    if (EXTI_PR & 1u) {\n        EXTI_PR = 1u; /* 写 1 清挂起位（写 0 无效，这是最常见的“中断只进一次”原因） */\n    }\n}\n\n/* 通用临界区：保存-关闭-恢复，避免嵌套时错误地打开中断 */\nuint32_t critical_begin(void)\n{\n    uint32_t saved = b05_get_primask();\n    b05_disable_irq();\n    b05_dsb();\n    return saved;\n}\n\nvoid critical_end(uint32_t saved)\n{\n    if (saved == 0u) {\n        b05_enable_irq(); /* 只在原本开中断时才恢复 */\n    }\n}\n\n/* BASEPRI：屏蔽“优先级数值 ≥ threshold”的中断，保留更高优先级（数值更小）的实时性。\n * 传 0 等于关闭屏蔽。RTOS 用它把临界区限制在 configMAX_SYSCALL_INTERRUPT_PRIORITY 之内。 */\nvoid mask_at_or_below(uint32_t threshold)\n{\n    b05_set_basepri(threshold << 4); /* 优先级值需左移到 BASEPRI 的高 4 位 */\n}\n\nint in_handler_mode(void) { return b05_get_ipsr() != 0u; }\n```\n\nSTM32F103 · NVIC/EXTI\n\n\n\nesp\\_m03\\_intr.cC\n\n \n\n```text\n/* esp_m03_intr.c — ESP32 中断：没有 NVIC，用中断分配器把外设信号绑到某个核\n * 与 Cortex-M 的“固定向量 + 优先级分组”是两种模型。 */\n#include \"esp32_regs.h\"\n\ntypedef void (*esp_isr_t)(void *arg);\n\n/* ESP-IDF：esp_intr_alloc(source, flags, handler, arg, handle) */\nextern int esp_intr_alloc(int source, int flags, esp_isr_t handler, void *arg, void **handle);\nextern void esp_intr_free(void *handle);\n\nint esp_bind_isr(int source, esp_isr_t handler, void *arg)\n{\n    return esp_intr_alloc(source, 0, handler, arg, (void **)0);\n}\n\n/* 双核：可指定 ISR 跑在 PRO_CPU(0) 或 APP_CPU(1)。\n * 跨核/与任务共享数据时，用 memw 或原子，而不是像 Cortex-M 那样只靠 PRIMASK。 */\nvoid esp_isr_memory_barrier(void) { esp_memw(); }\n\n/* 关中断用临界区（portENTER_CRITICAL），它不是简单的“关全局中断”语义 */\nextern void esp_port_enter_critical(void);\nextern void esp_port_exit_critical(void);\nvoid esp_critical_demo(void) { esp_port_enter_critical(); esp_memw(); esp_port_exit_critical(); }\n```\n\nESP32 · 中断分配器\n\n\n\nh7\\_m03\\_nvic.cC\n\n \n\n```text\n/* h7_m03_nvic.c — STM32H7 中断：NVIC 与 M3 同架构，但 IRQ 更多、且有 I/D cache\n * PRIMASK/BASEPRI 仍是内核专用寄存器（MRS/MSR），与 F1 一致。 */\n#include \"stm32h7_regs.h\"\n#include <stdint.h>\n\n#define NVIC_ISER_H7 R32(0xE000E100u)\n#define NVIC_IPR_H7  ((volatile uint8_t *)0xE000E400u)\n#define SCB_AIRCR_H7 R32(0xE000ED0Cu)\n\nvoid h7_set_grouping(uint32_t group)\n{\n    SCB_AIRCR_H7 = (0x05FAu << 16) | (group & 0x7u);\n}\n\n/* EXTI0_IRQn 在 H7 上同样是 6（Cortex-M 系列一致） */\nvoid h7_exti0_enable(void)\n{\n    NVIC_IPR_H7[6] = (uint8_t)(0x2u << 5);\n    NVIC_ISER_H7 = (1u << 6);\n}\n\nuint32_t h7_critical_begin(void)\n{\n    uint32_t saved;\n    __asm volatile (\"mrs %0, primask\" : \"=r\"(saved));\n    __asm volatile (\"cpsid i\" ::: \"memory\");\n    return saved;\n}\n\nvoid h7_critical_end(uint32_t saved)\n{\n    if (saved == 0u) { __asm volatile (\"cpsie i\" ::: \"memory\"); }\n}\n\nvoid h7_mask_at_or_below(uint32_t priority)\n{\n    __asm volatile (\"msr basepri, %0\" :: \"r\"(priority << 4) : \"memory\");\n}\n```\n\nSTM32H7 · NVIC\n\n\n\n表 3.3 三平台中断差异\n\n\n\n| 维度 | STM32F103 (M3) | ESP32 (Xtensa) | STM32H7 (M7) |\n| --- | --- | --- | --- |\n| 控制器 | NVIC | 中断分配器/矩阵 | NVIC |\n| 优先级 | 数值小=高 | 等级/类型 | 数值小=高 |\n| 临界区 | PRIMASK/BASEPRI | portENTER\\_CRITICAL | PRIMASK/BASEPRI |\n| 嵌套 | 硬件嵌套 | 取决于配置 | 硬件嵌套 |"}
````



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 中断自检



中断配好后，用寄存器与波形自检“是否进、进几次、谁抢占”：



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  内核专用寄存器 ≠ 内存映射



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="内核专用寄存器 ≠ 内存映射" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">内核寄存器：PRIMASK/BASEPRI/FAULTMASK</text><rect x="60" y="64" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">访问方式：CPSID/CPSIE、MRS/MSR</text><rect x="60" y="108" width="680" height="40" rx="6" class="sv-cyn-s"></rect><text x="75" y="132.0" class="sv-lbl-hi">内存映射：NVIC ISER(0xE000E100)、优先级(0xE000E400)</text></svg>
```



PRIMASK/BASEPRI 只能用 CPS/MRS/MSR 访问；0xE000E100 是 NVIC ISER。把两者混淆是常见事故。



表 3.4 中断自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 是否进 ISR | 中断计数/GPIO 翻转 | 计数增 1 |
| 是否只进一次 | EXTI\_PR 写 1 清标志 | 不重复进入 |
| 优先级抢占 | 示波器看嵌套波形 | 高优先级先跑 |
| 屏蔽范围 | 读 BASEPRI 阈值 | ≥阈值被屏蔽 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **EXTI\_PR 写 0 清标志** ：写 0 无效，中断“只进一次”。要写 1 清除。

- **ISR 名与向量表不一致** ：函数名打错则永远进不去；--gc-sections 可能把 ISR 裁掉，需 used/KEEP。

- **把 PRIMASK 当 0xE000E100 写** ：那是 ISER，写错会意外开中断。

- **嵌套临界区直接 cpsie i** ：内层退出提前开中断，破坏外层保护。



◆ 自测 · Module 03（先答再看）




1. 中断优先级数值 2 和 6，谁先被响应？BASEPRI 写 4 之后谁能进？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"数值越小越紧急，2 先响应。在全抢占分组下，逻辑阈值 4 屏蔽优先级 4 及数值更大的中断。\\_\\_set\\_BASEPRI 接收左对齐编码；F103 的 4 位实现应写 0x40，而 NVIC\\_SetPriority 接收未移位的逻辑优先级。M0/M0\\+ 不提供 BASEPRI。"}
   ```

2. 为什么不能把 PRIMASK 当成地址 0xE000E100 来写？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"PRIMASK 是内核专用寄存器，不是内存映射；0xE000E100 是 NVIC 的 ISER。要关中断用 CPSID i，读改用 MRS/MSR。"}
   ```

3. EXTI 中断“只进一次”通常是什么原因？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没清挂起标志，或清错（EXTI\\_PR 写 0 无效）。正确做法是向 EXTI\\_PR 对应位写 1 清除。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目的中断临界区从“无脑关总中断”改为保存-恢复 PRIMASK 或用 BASEPRI 局部屏蔽。



核对与延伸：[ARM · ARMv7-M Architecture Reference Manual](https://developer.arm.com/documentation/ddi0403/latest/)

 

动手练习



配置 PA0 下降沿 EXTI0 中断；上板用示波器对比抢占：高优先级 ISR 应打断低优先级 ISR。



**检查结果：** ISR 执行且只执行一次（EXTI\_PR 写 1 清除）；优先级 2 先于 6；本例采用全抢占优先级分组：逻辑阈值 4 编码为 4U \<\< (8-\_\_NVIC\_PRIO\_BITS) 写入 BASEPRI，6 被屏蔽、2 可进。

 

迁移练习：把本章的“能配置 EXTI 中断与 NVIC 优先级，在 ISR 里正确清标志，并用 BASEPRI 做局部临界区。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m03","criterion":"ISR 执行且只执行一次（EXTI_PR 写 1 清除）；优先级 2 先于 6；本例采用全抢占优先级分组：逻辑阈值 4 编码为 4U << (8-__NVIC_PRIO_BITS) 写入 BASEPRI，6 被屏蔽、2 可进。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
