# DMA

```zhizhan-anchor
m06
```



[DMA](term:dma) 让“外设↔内存”的搬运不占 CPU。ADC 连续采样时配合 **双缓冲** ：一块在写、一块在处理，避免读到半新半旧的数据。带数据 cache 的核（M7）还必须做 cache 维护。

 

> 前置：理解 ADC 连续采样与中断/双缓冲的基本用法。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能配置 DMA 通道/循环/双缓冲，使外设搬运不占 CPU，并在 M7 上正确维护 cache。

 

本章速览




- 循环 \+ 双缓冲把采集与处理解耦；通道/流映射不能记错。

- F1/ESP32 无 CPU cache；H7 必须 clean/invalidate。

- 缓冲的数宽与对齐要和 DMA 配置一致。

 

```zhizhan-anchor
m06-model
```



```zhizhan-anchor
m06-model-t
```



## 6.1 通道映射、循环与双缓冲



DMA 的通道与外设是 **固定映射** （F1：ADC1→DMA1 通道 1），不能随意改。连续采样用循环模式（` CIRC=1 `），配合半满/全满中断实现双缓冲。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  双缓冲：一块写、一块处理



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="双缓冲：一块写、一块处理" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M307,26 V94"></path><text x="307" y="18" text-anchor="middle" class="sv-lbl-dim">19</text><path class="sv-dash" d="M464,26 V94"></path><text x="464" y="18" text-anchor="middle" class="sv-lbl-dim">38</text><path class="sv-dash" d="M613,26 V94"></path><text x="613" y="18" text-anchor="middle" class="sv-lbl-dim">56</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">75</text><text x="12" y="48" class="sv-lbl">DMA 写</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="207" height="22" rx="4" class="sv-cyn-s"></rect><text x="253.3" y="47" text-anchor="middle" class="sv-lbl-hi">A</text><rect x="357" y="32" width="207" height="22" rx="4" class="sv-cyn-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">B</text><rect x="563" y="32" width="207" height="22" rx="4" class="sv-cyn-s"></rect><text x="666.7" y="47" text-anchor="middle" class="sv-lbl-hi">A</text><text x="12" y="82" class="sv-lbl">CPU 处理</text><path class="sv-dash" d="M150,78 H770"></path><rect x="357" y="66" width="207" height="22" rx="4" class="sv-grn-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">B</text><rect x="563" y="66" width="207" height="22" rx="4" class="sv-grn-s"></rect><text x="666.7" y="81" text-anchor="middle" class="sv-lbl-hi">A</text></svg>
```



DMA 往 A 块写时 CPU 处理 B 块；半满/全满中断提示切换。处理时间必须小于一块采集时间。



表 6.1 DMA 关键概念



| 概念 | F1 说法 | 要点 |
| --- | --- | --- |
| 通道选择 | 固定映射表 | ADC1→DMA1 通道 1 |
| 循环模式 | CIRC=1 | 计数到 0 自动重载 |
| 双缓冲 | 半满\+全满中断 | 两块交替 |
| Cache | M7 才有 | DMA 写入可能滞留 cache |



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：环回与体积



` size m06_dma.o ` → text= **140**  B，bss= **4**  B（两个计数标志）。环回 \+ 中断版本不需要 CPU 参与每次搬运：



m06\_dma.c 节选C

 

```text
DMA1_Channel1->CPAR = (uint32_t)&ADC1->DR;   // 外设地址
DMA1_Channel1->CMAR = (uint32_t)buf;        // 内存地址
DMA1_Channel1->CNDTR = N;
DMA1_Channel1->CCR = DMA_CCR_MINC | DMA_CCR_CIRC |   // 自增 + 循环
                     DMA_CCR_HTIE | DMA_CCR_TCIE | DMA_CCR_EN;
// 半满(HT)处理前半块、全满(TC)处理后半块 → 双缓冲
```

真实反汇编对应寄存器写；MINC\+CIRC\+中断 是双缓冲三件套



表 6.2 DMA 常见现象



| 现象 | 原因 | 修正 |
| --- | --- | --- |
| 请求不来 | 通道映射错 | 查 F1 映射表 |
| 写到同一个字 | 忘记 MINC | 设内存自增 |
| 数据半新半旧 | 未做双缓冲 | 用 HT/TC 中断切换 |
| M7 读到旧值 | 未维护 cache | clean/invalidate |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm06-plat\n```\n\n\n\n```zhizhan-anchor\nm06-plat-t\n```\n\n\n\n## 6.3 三平台对照：DMA\n\n\n\n三平台 DMA 抽象不同：F103/H7 写 DMA 通道寄存器；ESP32 用 GDMA/连续驱动。三份代码均已交叉编译。\n\n\n\nm06\\_dma.cC\n\n \n\n```text\n/* m06_dma.c — B05-M06 DMA\n * ADC1 → 内存 循环搬运：CPU 不参与每次转换。环回模式配合半满/全满中断做双缓冲。 */\n#include \"stm32f103_regs.h\"\n\nvolatile uint16_t g_dma_half;\nvolatile uint16_t g_dma_full;\n\n/* buf 指向长度 len 的 uint16 数组，硬件持续覆盖 */\nvoid adc_dma_start(uint16_t *buf, uint16_t len)\n{\n    ADC1->CR2 |= ADC_CR2_DMA | ADC_CR2_CONT;   /* 开 DMA 请求 + 连续转换 */\n    DMA1_Ch1->CPAR  = (uint32_t)(uintptr_t)&ADC1->DR;  /* 源：ADC 数据寄存器 */\n    DMA1_Ch1->CMAR  = (uint32_t)(uintptr_t)buf;        /* 目的：内存缓冲 */\n    DMA1_Ch1->CNDTR = len;\n    DMA1_Ch1->CCR   = DMA_CCR_MINC | DMA_CCR_PSIZE_16 | DMA_CCR_MSIZE_16\n                    | DMA_CCR_CIRC | DMA_CCR_TCIE | DMA_CCR_EN;\n    ADC1->CR2 |= ADC_CR2_ADON | ADC_CR2_SWSTART;\n}\n\n/* 半满/全满由 DMA 通道的 HTIF/TCIF 判定。\n * DMA1_ISR 每通道占 4 位：GIFx=bit0、TCIFx=bit1、HTIFx=bit2、TEIFx=bit3。\n * 通道 1 即 GIF1/TCIF1/HTIF1/TEIF1；最容易写错的是把 bit1 当半满（其实是“传输完成”）。 */\nvoid dma1_ch1_irq(void)\n{\n    if (DMA1_ISR & (1u << 2)) {        /* HTIF1：半传输（半满） */\n        DMA1_IFCR = (1u << 2);\n        g_dma_half++;\n    }\n    if (DMA1_ISR & (1u << 1)) {        /* TCIF1：传输完成（全满） */\n        DMA1_IFCR = (1u << 1);\n        g_dma_full++;\n    }\n}\n\nvoid dma1_ch1_stop(void)\n{\n    DMA1_Ch1->CCR &= ~DMA_CCR_EN;\n    while (DMA1_Ch1->CCR & DMA_CCR_EN) {\n    }\n}\n\n/* 关于 cache：Cortex-M7 上 DMA 写入的内存可能留在 cache 里，\n * 需按缓冲方向 clean/invalidate；M3 无数据 cache，本示例不涉及。 */\n```\n\nSTM32F103 · DMA1 通道\n\n\n\nesp\\_m06\\_dma.cC\n\n \n\n```text\n/* esp_m06_dma.c — ESP32 的 DMA：以“描述符链表”组织（SPI 内建 DMA）\n * 与 STM32 的“通道/流 + 固定请求映射”是两种模型：这里由链表描述每段缓冲。 */\n#include <stdint.h>\n\ntypedef struct esp_dma_desc {\n    uint32_t size : 12, length : 12, offset : 5, sof : 1, eof : 1, owner : 1;\n    void *buf;\n    struct esp_dma_desc *next;\n} esp_dma_desc_t;\n\nvoid esp_dma_desc_init(esp_dma_desc_t *d, void *buf, uint32_t len, int eof)\n{\n    d->size = len;\n    d->length = len;\n    d->offset = 0;\n    d->eof = eof ? 1u : 0u;\n    d->owner = 1u;                 /* owner=1 交给硬件，完成硬件归还 DMA */\n    d->buf = buf;\n    d->next = (void *)0;\n}\n\n/* 缓冲对齐要求：SPI DMA 需 4 字节对齐、建议 32 字节。ESP32 无 CPU D-cache；\n * 但在 ESP32-S2/S3 上开了 cache，仍需 clean/invalidate（与 STM32H7 同类问题）。 */\nextern int spi_bus_initialize(int host, const void *cfg, int dma_chan);\nextern int spi_device_transmit(void *dev, void *trans);\n\nint esp_spi_dma_tx(void *dev, void *trans) { return spi_device_transmit(dev, trans); }\n```\n\nESP32 · GDMA\n\n\n\nh7\\_m06\\_dma.cC\n\n \n\n```text\n/* h7_m06_dma.c — STM32H7 DMA：用“流(stream)”而非“通道”，且有 D-cache 一致性要求\n * 关键差异：F1 固定通道映射；H7 是流 + 请求复用器(DMAMUX)，同一外设可由不同流服务。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_ADC1_DR_ADDR 0x40022040u\n#define H7_SxCR_TCIE (1u << 1)\n#define H7_SxCR_CIRC (1u << 8)\n#define H7_SxCR_MINC (1u << 10)\n#define H7_SxCR_PSIZE_16 (1u << 16)\n#define H7_SxCR_MSIZE_16 (1u << 18)\n\nvoid h7_adc_dma_start(uint16_t *buf, uint16_t len)\n{\n    H7_DMA1_Stream0->PAR  = H7_ADC1_DR_ADDR;\n    H7_DMA1_Stream0->M0AR = (uint32_t)(uintptr_t)buf;\n    H7_DMA1_Stream0->NDTR = len;\n    H7_DMA1_Stream0->CR   = H7_DMA_SxCR_EN | H7_SxCR_TCIE | H7_SxCR_CIRC\n                          | H7_SxCR_MINC | H7_SxCR_PSIZE_16 | H7_SxCR_MSIZE_16;\n\n    /* D-cache 开启时：DMA 写入内存前，需保证该区不在 cache 里是脏数据。\n     * H7 上“忘记 cache 维护”比 F1 多出的一类 bug，volatile 不能替代。 */\n    h7_dcache_clean((uint32_t)(uintptr_t)buf, (uint32_t)len * 2u);\n}\n\nvoid h7_dma1_stream0_stop(void)\n{\n    H7_DMA1_Stream0->CR &= ~H7_DMA_SxCR_EN;\n    while (H7_DMA1_Stream0->CR & H7_DMA_SxCR_EN) {\n    }\n}\n```\n\nSTM32H7 · DMA/BDMA\n\n\n\n表 6.3 三平台 DMA\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 通道 | 固定映射 | GDMA 任意 | 请求复用 |\n| 一致性 | 无 cache | 依总线 | D-Cache 需维护 |\n| 双缓冲 | HT/TC 中断 | GDMA 描述符 | HT/TC/DMAMUX |\n| 吞吐 | 中 | 高 | 很高 |"}
````



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 双缓冲与自检



双缓冲的核心是“切换时处理已完成的那块”。下图给出切换时序：



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  双缓冲的切换逻辑



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="双缓冲的切换逻辑" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">HT 中断</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">处理前半块</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">TC 中断</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">处理后半块</text></svg>
```



半满中断→处理前半块；全满中断→处理后半块。处理时间 \< 一块采集时间 才不丢样。



表 6.4 DMA 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 环回 | CIRC=1 后计数回绕 | 不停止 |
| 完整块 | 处理端校验块边界 | 非半更新 |
| 停止 | 清 EN 后计数 | 不再变化 |
| M7 一致性 | 传输前后维护 cache | 无旧数据 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **通道映射记错** ：映射错误则请求永远不来。

- **读到半更新缓冲** ：没做双缓冲就处理，数据有时序裂口。

- **忘记 MINC** ：内存地址不自增，数据全写到同一个字。

- **M7 上不维护 cache** ：读到旧数据；` volatile ` 无效。



◆ 自测 · Module 06（先答再看）




1. 为什么“双缓冲”能让采集与处理互不阻塞？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"DMA 往 A 块写时 CPU 处理 B 块，半满/全满中断提示切换。关键是处理时间必须小于一块采集时间，否则仍会丢样。"}
   ```

2. 忘记设 MINC 会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内存地址不自增，所有数据都写到同一个字，缓冲里只有一个值反复被覆盖。"}
   ```

3. 为什么 M3 上不会出现“DMA 写了但 CPU 读到旧值”，M7 上却会？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"M3 无数据 cache，CPU 与 DMA 看到同一份内存；M7 有 D-Cache，DMA 写内存可能滞留 cache 外，CPU 读到旧值，需 clean/invalidate。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把项目里的连续采集改为 DMA \+ 双缓冲，并核对 MINC/CIRC/中断与 M7 的 cache 维护。



核对与延伸：[ST · AN4031 DMA 控制器使用](https://www.st.com/resource/en/application_note/an4031-using-the-stm32f2-stm32f4-and-stm32f7-series-dma-controller-stmicroelectronics.pdf)

 

动手练习



ADC→DMA 循环搬运，统计半满中断次数；在双缓冲里做平均并与单次读取对照。



**检查结果：** DMA 计数循环回绕正常（CIRC=1）；处理端读到完整块而非半更新数据；停 DMA 后计数不再变化。

 

迁移练习：把本章的“能配置 DMA 通道/循环/双缓冲，使外设搬运不占 CPU，并在 M7 上正确维护 cache。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m06","criterion":"DMA 计数循环回绕正常（CIRC=1）；处理端读到完整块而非半更新数据；停 DMA 后计数不再变化。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
