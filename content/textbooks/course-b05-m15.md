# 指令集、调用约定与 MCU 结构

```zhizhan-anchor
m15
```



看懂一两条反汇编，是排查“优化后跑飞”“中断不响应”的关键。Cortex-M 用  **Thumb-2** ，ESP32 用  **Xtensa** ；调用约定（AAPCS vs 窗口化）决定参数与返回值怎么走。

 

> 前置：会看 C 反汇编，了解寄存器/栈与向量表概念。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能读懂 Thumb-2/Xtensa 反汇编与调用约定，并正确重定位向量表让 App 接管中断。

 

本章速览




- C 语句落到指令由 ISA 决定：a\+b\*c 在 Thumb-2 上就是一条 MLA。

- 参数/返回值按 ABI 走寄存器；跨架构 FFI 必须对齐调用约定。

- 中断向量表可用 VTOR 重定位——Bootloader/[OTA](term:ota) 必须同步改，否则中断跑飞。

 

```zhizhan-anchor
m15-isa
```



```zhizhan-anchor
m15-isa-t
```



## 15.1 指令集与调用约定



Cortex-M 用 Thumb-2（16/32 位混合），ESP32 用 Xtensa（16/24 位变长、可窗口化寄存器）。调用约定决定参数/返回值：AAPCS 前 4 个整型参数走 r0–r3、返回 r0、栈 8 字节对齐；Xtensa 用窗口化寄存器（call4/8/12）或 call0。



```zhizhan-anchor
fig-图-15-1
```



**图 15.1**  一次调用的参数与返回



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次调用的参数与返回" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">参数</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">r0–r3</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">执行</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">返回 r0</text></svg>
```



参数 → r0–r3（前 4 个，更多走栈）→ 执行 → 返回 r0 → bx lr。



表 15.1 指令集与调用约定



| 维度 | Cortex-M3/M7 | Xtensa LX6 | 含义 |
| --- | --- | --- | --- |
| 指令宽度 | 16/32 位（Thumb-2） | 16/24 位变长 | 取指与密度 |
| 参数寄存器 | r0–r3（AAPCS） | a2–a7（窗口化） | 函数传参 |
| 返回地址 | LR(r14) | a0/窗口 | 函数返回 |
| 栈对齐 | 8 字节 | 16 字节 | ABI 要求 |



```zhizhan-anchor
m15-evidence
```



```zhizhan-anchor
m15-evidence-t
```



## 15.2 真实证据：一条 MLA



由 ` arm-none-eabi-gcc 13.3.1 `（-mcpu=cortex-m3 -Os）交叉编译，` objdump -d ` 的真实输出：` a + b*c ` 编译成 **一条 MLA** ：



真实运行



$



```text
$ arm-none-eabi-objdump -d labs/m15_isa.o | sed -n "/<isa_add_mul>/,+2p"
<isa_add_mul>:
   0:	fb02 0001 	mla	r0, r2, r1, r0
   4:	4770      	bx	lr
```



真实反汇编：乘加一条指令完成，M3 版本 text=34 B。这就是“指令集决定下限”。



表 15.2 Cortex-M 存储器映射



| 地址段 | 区域 | 典型用途 |
| --- | --- | --- |
| 0x0000\_0000 | 别名/向量区 | 复位后向量表 |
| 0x0800\_0000 | Flash | 代码与常量 |
| 0x2000\_0000 | SRAM | 变量/栈/堆 |
| 0x4000\_0000 | 外设 | GPIO/RCC/USART/TIM |
| 0xE000\_0000 | PPB | NVIC/SysTick/SCB |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm15-plat\n```\n\n\n\n```zhizhan-anchor\nm15-plat-t\n```\n\n\n\n## 15.3 三平台对照：指令集与结构\n\n\n\n三平台内核/指令集不同：F103(M3)/H7(M7) 是 Arm，ESP32 是 Xtensa。三份代码均已交叉编译。\n\n\n\nm15\\_isa.cC\n\n \n\n```text\n/* m15_isa.c — B05-M15 指令集与调用约定（STM32F103 / Cortex-M3，Thumb-2）\n * 供反汇编观察：AAPCS 下参数走 r0..r3、返回 r0；-Os 会生成 Thumb-2 混合宽度指令。 */\n#include \"stm32f103_regs.h\"\n\n/* 一条 C 语句如何落到指令：这里用 objdump 看到 mul/umull + add */\nint isa_add_mul(int a, int b, int c) { return a + b * c; }\n\nuint32_t isa_pack(uint16_t hi, uint16_t lo) { return ((uint32_t)hi << 16) | lo; }\n\n/* 向量表重定位（bootloader / OTA 的基础；也是“中断跑飞”的常见原因） */\nvoid isa_relocate_vectors(const void *table)\n{\n    SCB_VTOR = (uint32_t)(uintptr_t)table;\n    b05_dsb();\n    b05_isb();\n}\n\n/* 原子读改写之外：读取当前栈指针，理解 MSP/PSP 与调用约定 */\nuint32_t isa_read_sp(void)\n{\n    uint32_t sp;\n    __asm volatile (\"mov %0, sp\" : \"=r\"(sp));\n    return sp;\n}\n```\n\nSTM32F103 · Thumb-2/AAPCS\n\n\n\nesp\\_m15\\_arch.cC\n\n \n\n```text\n/* esp_m15_arch.c — B05-M15 ISA/结构（ESP32 / Xtensa LX6）\n * Xtensa 无 Thumb：指令多为 16/24 位变长；代码可放 IRAM、数据放 DRAM。 */\n#include <stdint.h>\n\n#define IRAM_ATTR __attribute__((section(\".iram1\")))\n#define DRAM_ATTR __attribute__((section(\".dram1\")))\n\n/* 用于反汇编对照（xtensa-esp32-elf-objdump -d） */\nint IRAM_ATTR esp_add_mul(int a, int b, int c) { return a + b * c; }\n\nint DRAM_ATTR g_esp_data = 1;\n\n/* Xtensa 的顺序屏障是 memw（对应 ARM 的 DMB/DSB 语境） */\nvoid esp_arch_barrier(void) { __asm__ volatile (\"memw\" ::: \"memory\"); }\n\n/* 结构上：Xtensa 有窗口化寄存器（call0/call4 约定），与 AAPCS 的 r0-r3 不同 */\nint esp_arch_callconv(int a, int b) { return a - b; }\n```\n\nESP32 · Xtensa\n\n\n\nh7\\_m15\\_arch.cC\n\n \n\n```text\n/* h7_m15_arch.c — B05-M15 ISA/结构（STM32H7 / Cortex-M7）\n * M7 是双发射顺序核 + I/D cache + 域（D1/D2/D3）地址空间；指令仍为 Thumb-2。 */\n#include \"stm32h7_regs.h\"\n\nint h7_add_mul(int a, int b, int c) { return a + b * c; }   /* 用于反汇编对照 */\n\nvoid h7_relocate_vectors(const void *table)\n{\n    R32(0xE000ED08u) = (uint32_t)(uintptr_t)table;   /* SCB->VTOR */\n    h7_dsb();\n    h7_isb();\n}\n\n/* M7 的 cache 是“结构”的一部分：开启后 DMA 与 CPU 的一致性、以及 self-modifying 都要管 */\nvoid h7_arch_enable_caches(void)\n{\n    H7_SCB_CCR |= H7_SCB_CCR_ICACHE | H7_SCB_CCR_DCACHE;\n    h7_dsb();\n    h7_isb();\n}\n```\n\nSTM32H7 · Thumb-2/M7\n\n\n\n表 15.3 三平台体系结构\n\n\n\n| 维度 | Cortex-M3/M7 | Xtensa LX6 | STM32H7 (M7) |\n| --- | --- | --- | --- |\n| ISA | Thumb-2 | Xtensa | Thumb-2 |\n| 核 | 顺序(3)/双发射(7) | 双核 | 双发射/带 cache |\n| ABI | AAPCS | 窗口化 | AAPCS |\n| cache | 无 | 有 | I/D-Cache |"}
````



```zhizhan-anchor
m15-vtor
```



```zhizhan-anchor
m15-vtor-t
```



## 15.4 向量表重定位与自检



中断向量表是函数指针数组，放 Flash 起始并可由 ` SCB->VTOR ` 重定位——bootloader/OTA 中断跑飞，十次有九次是 VTOR 没跟着 App 改。



```zhizhan-anchor
fig-图-15-2
```



**图 15.2**  VTOR 重定位让 App 接管中断



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="VTOR 重定位让 App 接管中断" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">Boot 向量表（0x0800_0000）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">SCB-&gt;VTOR = App 基址</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">App 向量表（新基址）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">中断由 App handler 响应</text></svg>
```



Boot 阶段 VTOR 指向 Boot 的向量表；跳到 App 前把 VTOR 改成 App 的向量表基址；否则中断仍走 Boot 的 handler。



表 15.4 体系结构自检



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| ISA | objdump 看指令 | 如 MLA |
| ABI | 看参数/返回寄存器 | r0–r3/r0 |
| VTOR | 读 SCB-\>VTOR | =App 基址 |
| 中断 | 触发一次 | App handler 响应 |



```zhizhan-anchor
m15-pitfalls
```



```zhizhan-anchor
m15-pitfalls-t
```



## 15.5 常见误区与排障



失败路径与排障




- **VTOR 没设** ：App 中断仍跳 Boot 向量表 → 不响应或跑飞。

- **栈不对齐** ：AAPCS 要求 8 字节，手工改 SP 后调用会 HardFault。

- **跨架构 FFI** ：ARM 与 Xtensa 参数/返回寄存器不同，回调签名须按 ABI。

- **把结构体内存布局当协议** ：不同 ISA/编译器对齐与位域规则不同。



◆ 自测 · Module 15（先答再看）




1. 为什么“中断只进一次”常和向量表/VTOR 有关？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"向量表决定 ISR 入口。VTOR 未重定位时跳到旧表；或 ISR 名与向量表不一致、被 --gc-sections 裁掉，都会表现为中断不触发或只触发一次。"}
   ```

2. AAPCS 里前 4 个整型参数放哪、返回放哪、栈对齐多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"参数 r0–r3（更多走栈）、返回 r0、栈 8 字节对齐。"}
   ```

3. 为什么“把结构体内存布局当通信协议”有风险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不同 ISA/编译器的对齐与位域规则不同，字段偏移可能不一致；跨平台通信应显式序列化。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用 objdump 读你工程一个热函数的反汇编，数指令并核对调用约定的参数/返回寄存器。



核对与延伸：[ARM · Cortex-M3 Devices Generic User Guide](https://developer.arm.com/documentation/dui0552/latest/) · [ARM · ARMv7-M Architecture Reference Manual](https://developer.arm.com/documentation/ddi0403/latest/)

 

动手练习



读 ` m15_isa.c ` 的反汇编，数出 ` isa_add_mul ` 用了几条指令；调用 VTOR 重定位后再触发一次中断。



**检查结果：** 能说出整型参数走 r0–r3、返回 r0（栈 8 字节对齐）；向量表重定位（VTOR）后中断仍由 App 的 handler 响应。

 

迁移练习：把本章的“能读懂 Thumb-2/Xtensa 反汇编与调用约定，并正确重定位向量表让 App 接管中断。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 15 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m15","criterion":"能说出整型参数走 r0–r3、返回 r0（栈 8 字节对齐）；向量表重定位（VTOR）后中断仍由 App 的 handler 响应。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
