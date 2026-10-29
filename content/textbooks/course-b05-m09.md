# SPI

```zhizhan-anchor
m09
```



SPI 是同步全双工： **CPOL**  决定空闲电平、 **CPHA**  决定采样边沿，组合出四种模式。片选必须全程拉低；读 JEDEC ID 是最小自检。

 

> 前置：了解同步串行时序与片选，会读器件手册的模式/命令表。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按手册选 CPOL/CPHA 模式、拉片选收发，并用读 JEDEC ID 做最小自检。

 

本章速览




- CPOL/CPHA 四模式必须与器件手册一致；片选全程拉低。

- 引脚要配成对应功能——漏配是最常见的“代码对但收不到”。

- 读 JEDEC ID 是 SPI Flash 的最小自检。

 

```zhizhan-anchor
m09-model
```



```zhizhan-anchor
m09-model-t
```



## 9.1 四种模式与片选



CPOL 决定时钟空闲电平，CPHA 决定在哪个边沿采样，组合出模式 0–3。器件手册会写明，多数 SPI Flash 用模式 0，部分用模式 3。片选全程拉低，命令与数据之间不能抬起。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  SPI 模式 0 的一次传输



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="SPI 模式 0 的一次传输" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">40</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">60</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">80</text><text x="12" y="48" class="sv-lbl">SCLK</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="620" height="22" rx="4" class="sv-box"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">空闲低</text><text x="12" y="82" class="sv-lbl">MOSI/MISO</text><path class="sv-dash" d="M150,78 H770"></path><rect x="228" y="66" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="305.0" y="81" text-anchor="middle" class="sv-lbl-hi">bit</text><rect x="382" y="66" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">bit</text><rect x="538" y="66" width="155" height="22" rx="4" class="sv-cyn-s"></rect><text x="615.0" y="81" text-anchor="middle" class="sv-lbl-hi">bit</text><rect x="692" y="66" width="78" height="22" rx="4" class="sv-cyn-s"></rect><text x="731.2" y="81" text-anchor="middle" class="sv-lbl-hi">bit</text></svg>
```



CPOL=0（空闲低）、CPHA=0（上升沿采样）：数据在下降沿变化、上升沿被采样。



表 9.1 SPI 四种模式



| 模式 | CPOL | CPHA | 采样边沿 |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 上升沿 |
| 1 | 0 | 1 | 下降沿 |
| 2 | 1 | 0 | 下降沿 |
| 3 | 1 | 1 | 上升沿 |



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：字节访问与体积



` size m09_spi.o ` → text= **188**  B。8 位传输在 F1 上只访问 DR 低字节（用字节指针），避免 16 位读取时序偏差：



m09\_spi.c 节选C

 

```text
static uint8_t spi_xfer(uint8_t b) {
    *(volatile uint8_t *)&SPI1->DR = b;      // 只写低字节
    while (!(SPI1->SR & SPI_SR_RXNE)) {}
    return *(volatile uint8_t *)&SPI1->DR;   // 只读低字节
}
/* 读 JEDEC ID：0x9F 后连读 3 字节，W25Q -> 0xEF 0x40 0x15 */
```

真实反汇编对应字节指针访问；JEDEC ID 是最小自检



表 9.2 SPI Flash 最小自检



| 自检 | 命令 | 期望 |
| --- | --- | --- |
| JEDEC ID | 0x9F | 0xEF4015（本例 W25Q16；其他容量/型号按手册核对） |
| 写使能 | 0x06 | SR.WEL=1 |
| 读状态 | 0x05 | 忙时 BUSY=1 |
| 扇区擦除 | 0x20 | 擦后回读全 0xFF |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm09-plat\n```\n\n\n\n```zhizhan-anchor\nm09-plat-t\n```\n\n\n\n## 9.3 三平台对照：SPI\n\n\n\n三平台 SPI 抽象不同：F103/H7 写 SPI 寄存器；ESP32 用 spi\\_master 驱动。三份代码均已交叉编译。\n\n\n\nm09\\_spi.cC\n\n \n\n```text\n/* m09_spi.c — B05-M09 SPI\n * SPI 模式 0（CPOL=0/CPHA=0）读 Flash JEDEC ID；软件片选。 */\n#include \"stm32f103_regs.h\"\n\n#define FLASH_CS_PIN 4u   /* 软件片选：PA4，推挽 50 MHz */\n\nstatic uint8_t spi1_xfer(uint8_t out)\n{\n    while ((SPI1->SR & SPI_SR_TXE) == 0u) {\n    }\n    *((volatile uint8_t *)&SPI1->DR) = out;   /* F1 上 8 位传输只写低字节 */\n    while ((SPI1->SR & SPI_SR_RXNE) == 0u) {\n    }\n    return *((volatile uint8_t *)&SPI1->DR);\n}\n\nvoid spi1_init(void)\n{\n    RCC_APB2ENR |= (1u << 12) | RCC_APB2ENR_IOPAEN;   /* SPI1EN */\n    /* PA4 片选：通用推挽 50 MHz */\n    GPIOA->CRL = (GPIOA->CRL & ~(0xFu << (FLASH_CS_PIN * 4u)))\n               | ((uint32_t)GPIO_CNF_OUT_PP << 2)\n               | (uint32_t)GPIO_MODE_OUT_50M;\n    /* SPI1 默认引脚：PA5=SCK、PA7=MOSI 复用推挽 50 MHz；PA6=MISO 浮空输入。\n     * 漏配这三个引脚是最常见的“代码对但收不到数据”。 */\n    GPIOA->CRL = (GPIOA->CRL & ~((0xFu << 20) | (0xFu << 24) | (0xFu << 28)))\n               | (0xBu << 20)   /* PA5 AF-PP（CNF=10,MODE=11） */\n               | (0x4u << 24)   /* PA6 浮空输入（CNF=01,MODE=00） */\n               | (0xBu << 28);  /* PA7 AF-PP */\n    /* 模式 0 = CPOL=0, CPHA=0；主模式；软件 NSS 且内部拉高；预分频 8（72/8=9 MHz） */\n    SPI1->CR1 = SPI_CR1_MSTR | SPI_CR1_SSM | SPI_CR1_SSI\n              | (0x2u << 3) | SPI_CR1_SPE;\n    GPIOA->BSRR = (1u << FLASH_CS_PIN);                /* 拉高，空闲 */\n}\n\nstatic void cs_low(void)  { GPIOA->BSRR = (1u << (FLASH_CS_PIN + 16u)); }\nstatic void cs_high(void) { GPIOA->BSRR = (1u << FLASH_CS_PIN); }\n\nuint32_t spi_flash_jedec_id(void)\n{\n    cs_low();\n    (void)spi1_xfer(0x9Fu);                    /* JEDEC ID 命令 */\n    uint32_t id = (uint32_t)spi1_xfer(0x00);\n    id |= (uint32_t)spi1_xfer(0x00) << 8;\n    id |= (uint32_t)spi1_xfer(0x00) << 16;\n    cs_high();\n    return id;                                 /* 典型 Winbond = 0xEF4015 */\n}\n\n/* 读状态寄存器 SR1，轮询 BUSY 位 */\nuint8_t spi_flash_status(void)\n{\n    cs_low();\n    (void)spi1_xfer(0x05u);\n    uint8_t st = spi1_xfer(0x00);\n    cs_high();\n    return st;\n}\n```\n\nSTM32F103 · SPI \\+ Flash\n\n\n\nesp\\_m09\\_spi.cC\n\n \n\n```text\n/* esp_m09_spi.c — ESP32 SPI：时钟来自 APB，常用 spi_device_transmit 一次事务\n * ESP32 的 SPI 有 1..4 号控制器，SPI2/3 常作主模式接 Flash/传感器。 */\n#include <stdint.h>\n\nextern int spi_bus_initialize(int host, const void *cfg, int dma_chan);\nextern int spi_bus_add_device(int host, const void *cfg, void **out_dev);\nextern int spi_device_transmit(void *dev, void *trans);\nextern int spi_bus_remove_device(void *dev);\n\nint esp_spi1_xfer(void *dev, void *trans)\n{\n    return spi_device_transmit(dev, trans);   /* trans 里指定 tx_buffer/rx_buffer/length */\n}\n\n/* 与 STM32 的关键差异：ESP32 的片选、时钟相位/极性、位序都在 bus/device 配置结构里，\n * 且可走 GPIO Matrix 把 SPI 信号映射到任意可用引脚。 */\nint esp_spi_bus_up(int host, const void *buscfg)\n{\n    return spi_bus_initialize(host, buscfg, 1);   /* dma_chan */\n}\n```\n\nESP32 · spi\\_master\n\n\n\nh7\\_m09\\_spi.cC\n\n \n\n```text\n/* h7_m09_spi.c — STM32H7 SPI（v2）：CFG1/CFG2/IER/SR/TXDR/RXDR，带 FIFO\n * 与 F1 的 CR1/CR2/SR/DR 模型不同；数据通过 TXDR/RXDR，且 FIFO 深度可配。 */\n#include \"stm32h7_regs.h\"\n\nvoid h7_spi1_init(void)\n{\n    H7_RCC_APB2ENR |= (1u << 12);          /* SPI1 时钟（示意） */\n    H7_SPI1->CFG1 = (7u << 0)              /* DSIZE=8 位（DSIZE=size-1） */\n                  | (3u << 28);            /* MBR：主模式波特率预分频（见 RM0433） */\n    H7_SPI1->CFG2 = (1u << 22)             /* MASTER */\n                  | (1u << 26);            /* SSM：软件片选 */\n    H7_SPI1->CR1 = H7_SPI_CR1_SPE | (1u << 12);   /* SPE | SSI */\n}\n\n/* 全双工 8 位收发：FIFO 使能后 TXDR/RXDR 需 4 字节对齐访问 */\nvoid h7_spi1_xfer(const uint8_t *tx, uint8_t *rx, uint16_t n)\n{\n    for (uint16_t i = 0u; i < n; ++i) {\n        while ((H7_SPI1->SR & H7_SPI_SR_TXP) == 0u) {\n        }\n        *((volatile uint8_t *)&H7_SPI1->TXDR) = tx[i];\n        while ((H7_SPI1->SR & H7_SPI_SR_RXP) == 0u) {\n        }\n        rx[i] = *((volatile uint8_t *)&H7_SPI1->RXDR);\n    }\n}\n```\n\nSTM32H7 · SPI\n\n\n\n表 9.3 三平台 SPI\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 配置 | CR1/CR2/BR | spi\\_bus\\_config | CFG1/CFG2 |\n| 速率 | 预分频 | 时钟源分频 | 很高 |\n| 模式 | CPOL/CPHA 位 | mode 参数 | CPOL/CPHA |\n| DMA | SPI↔DMA | SPI DMA | SPI↔DMA |"}
````



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 模式判定与自检



模式判定只认“采样沿”：手册写“上升沿采样”且空闲低 → 模式 0。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  模式判定与自检顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="模式判定与自检顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">读手册</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">配模式</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">读 JEDEC ID</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">擦写回读</text></svg>
```



读手册（CPOL/CPHA）→ 配模式与预分频 → 读 JEDEC ID → 写使能/擦写/回读校验。



表 9.4 SPI 现象与核查



| 现象 | 原因 | 核查 |
| --- | --- | --- |
| 读全 0xFF/0x00 | 模式不匹配/片选 | CPOL/CPHA、CS |
| 写入无效 | 未先写使能 | 发 0x06 后查 WEL |
| 擦写失败 | 忙时发命令 | 轮询 BUSY |
| 高速误码 | 走线/预分频 | 降速验证 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **模式不匹配** ：读回全 0xFF 或全 0x00，先怀疑 CPOL/CPHA。

- **片选未接/一直高** ：器件不响应，读数恒为 0xFF。

- **速率过高** ：走线长时高预分频下误码，适当降速验证。

- **擦写期间读状态** ：Flash 忙时只能轮询 BUSY，不能发其它命令。



◆ 自测 · Module 09（先答再看）




1. 手册写“数据在时钟下降沿变化、上升沿采样”，空闲低电平，该选哪个模式？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"空闲低（CPOL=0）\\+ 上升沿采样（CPHA=0）= 模式 0。关键是“采样沿”与手册一致。"}
   ```

2. 为什么读 JEDEC ID 是 SPI Flash 的最小自检？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它是固定命令 0x9F 并返回已知厂商/型号字节。读不到或不对，就能立刻判断是模式/接线/片选问题，而不是去怀疑擦写逻辑。"}
   ```

3. SPI Flash 擦写期间为什么只能读状态寄存器？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"器件内部忙（BUSY=1）时不接受其它命令；必须轮询状态寄存器等待空闲，否则命令被忽略。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用读 JEDEC ID 作为你 SPI 外设的最小自检，并把它写进上电自检流程。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

 

动手练习



读 Flash JEDEC ID 并与型号手册对照；用逻辑分析仪确认 CPOL/CPHA 采样边沿。



**检查结果：** JEDEC ID=0xEF4015（本例 W25Q16；其他容量/型号按手册核对）与手册一致；写使能后 WEL 位=1；擦写后回读校验通过。

 

迁移练习：把本章的“能按手册选 CPOL/CPHA 模式、拉片选收发，并用读 JEDEC ID 做最小自检。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m09","criterion":"JEDEC ID=0xEF4015（本例 W25Q16；其他容量/型号按手册核对）与手册一致；写使能后 WEL 位=1；擦写后回读校验通过。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
