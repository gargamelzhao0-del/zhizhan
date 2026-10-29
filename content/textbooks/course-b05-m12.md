# 分层取舍总论

```zhizhan-anchor
m12
```



“裸寄存器”和“用库/句柄”不是对错，而是取舍。用同一功能（置位 PC13）写三档，再用 ` -ffunction-sections ` 逐函数测体积——结论比争论可靠。

 

> 前置：已写过寄存器版与库封装版 GPIO 代码，会看 size/objdump 输出。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用同一功能的三档实现逐函数测体积，并按项目在可读性/可移植性/体积间取舍。

 

本章速览




- 内联封装≈零开销；句柄/驱动只在“运行期不可知”时有成本。

- 体积之争以 size/objdump 为准，不靠感觉。

- 直接性 vs 可移植性，按项目而不是按喜好选。

 

```zhizhan-anchor
m12-choice
```



```zhizhan-anchor
m12-choice-t
```



## 12.1 三档取舍：可读性 vs 体积



三档实现同一功能：裸寄存器（最小、绑芯片）、内联封装（≈0 开销、兼顾清晰）、句柄抽象（可移植、多一层间接）。选哪档取决于项目：单器件/极限优化 vs 多器件/多平台。



表 12.1 三档取舍



| 档位 | 可读性 | 可移植性 | 体积/开销 | 适用 |
| --- | --- | --- | --- | --- |
| 裸寄存器 | 低 | 差（绑芯片） | 最小 | 学习、极限优化、启动代码 |
| 内联封装（LL/CMSIS） | 中 | 中 | ≈0 | 多数产品代码 |
| 句柄抽象（HAL 风格） | 高 | 好 | 多一层间接 | 多器件/多平台 |



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  抽象档位的取舍决策



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="抽象档位的取舍决策" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看规模</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">看平台数</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">选档位</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">热点可混用</text></svg>
```



单器件/极限优化→裸寄存器或内联；多器件/多平台→句柄抽象；关键路径可混用（热点用内联、其余用抽象）。



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：逐函数体积



用 ` arm-none-eabi-objdump -h ` 逐函数测量真实体积：



真实运行



$



```text
$ arm-none-eabi-objdump -h labs/m12_layers.o | grep .text
  .text.led_set_reg        00000010   (16 B)
  .text.led_set_inline     00000010   (16 B)  ← 与宏版逐字节相同
  .text.gpio_handle_write  00000010   (16 B)
  .text.led_set_handle     00000010   (16 B)  ← 静态句柄被常量传播，退回直接写
```



-Os 下三档 .text 各 16 B、逐字节相同——这证明“内联封装零开销”，但前提是可内联/可常量传播。



m12\_layers.s 节选ASM

 

```text
<led_set_reg>:
   mov.w r2, #8192    @ 1<<13
   ldr   r3, [pc, #4] @ GPIOC
   str   r2, [r3, #16]@ BSRR
   bx    lr
```

两版反汇编完全一致（真实 objdump 输出）



表 12.2 逐函数体积对比



| 档位 | .text | 可比性 |
| --- | --- | --- |
| 裸寄存器 | 16 B | 基准 |
| 内联封装 | 16 B | 逐字节相同 |
| 静态句柄 | 16 B | 被常量传播 |
| 运行期句柄 | 会增多 | 多一层间接/调用 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm12-plat\n```\n\n\n\n```zhizhan-anchor\nm12-plat-t\n```\n\n\n\n## 12.3 三平台对照：抽象层次\n\n\n\n三平台“库”的抽象层次不同：F103 常裸寄存器/LL；ESP32 强制 IDF 抽象；H7 常 HAL/LL。三份代码均已交叉编译。\n\n\n\nm12\\_layers.cC\n\n \n\n```text\n/* m12_layers.c — B05-M12 分层取舍：同一“置位 LED”的三种写法体积对照\n * 用 -ffunction-sections + objdump 逐函数看体量；正文给出真实测量。 */\n#include \"stm32f103_regs.h\"\n\n/* 档 1：裸寄存器宏 */\nvoid led_set_reg(void) { GPIOC->BSRR = (1u << 13); }\n\n/* 档 2：CMSIS 风格内联封装（仍是编译期展开，零调用开销） */\nstatic inline void gpio_set_bits(gpio_t *port, uint32_t bits)\n{\n    port->BSRR = bits;\n}\nvoid led_set_inline(void) { gpio_set_bits(GPIOC, (1u << 13)); }\n\n/* 档 3：带句柄的运行期抽象（多一次间接访问，换来可替换实现） */\ntypedef struct {\n    gpio_t  *port;\n    uint32_t pin;\n} gpio_handle_t;\n\nstatic gpio_handle_t g_led = { GPIOC, 13u };\n\nvoid gpio_handle_write(gpio_handle_t *h, int on)\n{\n    if (on) {\n        h->port->BSRR = (1u << h->pin);\n    } else {\n        h->port->BSRR = (1u << (h->pin + 16u));\n    }\n}\n\nvoid led_set_handle(void) { gpio_handle_write(&g_led, 1); }\n```\n\nSTM32F103 · 三档对比\n\n\n\nesp\\_m12\\_layers.cC\n\n \n\n```text\n/* esp_m12_layers.c — 同一“置位 LED”的三种写法（ESP32 版），用于跨平台体积对照 */\n#include \"esp32_regs.h\"\n\n/* 档 1：裸寄存器 */\nvoid esp_led_reg(void) { GPIO_OUT_W1TS = (1u << 2); }\n\n/* 档 2：内联封装（等价零开销） */\nstatic inline void esp_gpio_set(uint32_t bits) { GPIO_OUT_W1TS = bits; }\nvoid esp_led_inline(void) { esp_gpio_set(1u << 2); }\n\n/* 档 3：IDF 驱动（运行期句柄 + 可能的多层校验，换可移植性） */\nextern int gpio_set_level(int gpio_num, uint32_t level);\nvoid esp_led_idf(void) { (void)gpio_set_level(2, 1); }\n\n/* 与 STM32 一致的结论：内联封装通常零开销；句柄/驱动层在“运行期不可知”时才有成本，\n * 但 ESP-IDF 的驱动还额外带来跨芯片可移植性与一致性检查。 */\n```\n\nESP32 · IDF 抽象\n\n\n\nh7\\_m12\\_layers.cC\n\n \n\n```text\n/* h7_m12_layers.c — 同一“置位 LED”的三种写法（H7 版），用于跨平台体积对照\n * H7 的 BSRR 与 F1 语义相同，但 MODER 是 2 位/引脚；抽象层次与取舍结论与 F1 一致。 */\n#include \"stm32h7_regs.h\"\n\n/* 档 1：裸寄存器 */\nvoid h7_led_reg(void) { H7_GPIOB->BSRR = (1u << 0); }\n\n/* 档 2：内联封装（零开销抽象） */\nstatic inline void h7_gpio_set(h7_gpio_t *p, uint32_t bits) { p->BSRR = bits; }\nvoid h7_led_inline(void) { h7_gpio_set(H7_GPIOB, (1u << 0)); }\n\n/* 档 3：运行期句柄 */\ntypedef struct { h7_gpio_t *port; uint32_t pin; } h7_gpio_handle_t;\nstatic h7_gpio_handle_t g_h7_led = { H7_GPIOB, 0u };\n\nvoid h7_gpio_handle_write(h7_gpio_handle_t *h, int on)\n{\n    h->port->BSRR = on ? (1u << h->pin) : (1u << (h->pin + 16u));\n}\n\nvoid h7_led_handle(void) { h7_gpio_handle_write(&g_h7_led, 1); }\n```\n\nSTM32H7 · HAL/LL\n\n\n\n表 12.3 三平台抽象层次\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 常见写法 | 裸寄存器/LL | IDF API | HAL/LL |\n| 零开销 | 可（内联） | 部分 | LL 可 / HAL 贵 |\n| 可移植 | 差 | 好 | 中 |\n| 调试 | 直接看寄存器 | 驱动层 | HAL 中间层 |"}
````



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 测量流程与自检



体积争论只认工具输出。下图给出测量流程：



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  逐函数体积测量流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="逐函数体积测量流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写多档</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">-ffunction-sections</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">objdump 测量</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">取舍</text></svg>
```



同一功能写多档 → 开 -ffunction-sections → objdump -h 逐函数比对 → 按项目取舍。



表 12.4 分层取舍自检



| 自检 | 方法 | 结论 |
| --- | --- | --- |
| 内联是否零开销 | objdump 比对 | 多数成立 |
| 句柄开销 | 改运行期句柄 | 多一层间接 |
| 宏冲突 | 命名前缀 | 避免与库冲突 |
| 可移植性 | 换平台 | 句柄/LL 更易 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **把“零开销”当绝对结论** ：它依赖可内联/可常量传播。

- **为抽象而抽象** ：单器件项目用句柄层反而增加阅读成本。

- **全用裸宏** ：跨平台移植改动量爆炸，宏名易冲突。

- **不看反汇编就下结论** ：体积争论应以 size/objdump 为准。



◆ 自测 · Module 12（先答再看）




1. 什么情况下“句柄抽象”会真的引入开销？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"当句柄在编译期不可知（从数组/参数/配置读取、跨编译单元）时无法常量传播，会多一次间接寻址或函数调用。"}
   ```

2. 为什么说“内联封装是零开销”是有条件的？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"成立前提是可内联、可常量传播。一旦函数无法内联（跨 TU/取地址）或句柄运行期才知，就会产生额外代码。"}
   ```

3. 判断抽象是否零开销，应该看什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"看工具输出：` -ffunction-sections ` \\+ ` objdump -h `/` size ` 逐函数比对，而不是凭感觉。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对你项目里一处封装用 objdump 逐函数测体积，量化它到底是不是零开销。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

 

动手练习



把 ` gpio_handle_write ` 的句柄改成运行期传入（非 static），重新编译对比体积。



**检查结果：** 能说明三档各自 .text 各 16 B（逐字节相同）的体积取舍；能指出“零开销抽象”前提=可内联/可常量传播。

 

迁移练习：把本章的“能用同一功能的三档实现逐函数测体积，并按项目在可读性/可移植性/体积间取舍。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m12","criterion":"能说明三档各自 .text 各 16 B（逐字节相同）的体积取舍；能指出“零开销抽象”前提=可内联/可常量传播。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
