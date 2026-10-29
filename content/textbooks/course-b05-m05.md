# ADC / DAC

```zhizhan-anchor
m05
```



ADC 的采样时间不是随意选的：采样电容要在窗口内充到输入电压，窗口越短、源阻抗越高误差越大。本章讲采样时间/参考/校准/过采样与整数换算，让读数与万用表一致。

 

> 前置：会用整数运算与寄存器配置，理解采样/参考电压的基本概念。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能校准 ADC、按源阻抗选采样时间、做整数换算与过采样平均，使读数与万用表一致。

 

本章速览




- 采样时间要匹配源阻抗，换算用 raw×VREF/满量程。

- 校准必做：F1 的 CAL、H7 的 ADVREGEN\+ADCAL、ESP32 的衰减\+校准。

- 满量程 4095(F1/ESP32) vs 65535(H7)，移植时最容易算错。

 

```zhizhan-anchor
m05-model
```



```zhizhan-anchor
m05-model-t
```



## 5.1 采样、校准与换算



采样窗口内，内部采样电容要被输入源充到输入电压。源阻抗越高，需要越长采样时间，否则读数偏低。F1 上 ` ADON ` 要写两次（上电 \+ 启动转换），转换前必须校准，否则零点偏移进入每个读数并随温度漂移。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  一次 ADC 转换的流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次 ADC 转换的流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">ADON 上电</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">校准</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">采样/转换</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">读 DR 换算</text></svg>
```



上电(ADON) → 校准(RSTCAL→CAL) → 选通道与采样时间 → 启动(ADON 再写) → 读 DR → 换算。



表 5.1 ADC 关键参数



| 参数 | 取值建议 | 原因 |
| --- | --- | --- |
| 采样时间 | 源阻抗越高越长 | 给采样电容足够充电时间 |
| 参考电压 VREF | 典型 3.3 V | 决定 LSB = VREF/4096 |
| 分辨率 | 12 位 | raw/4095×VREF 得毫伏 |
| 过采样 | 平均 N 次 | 换信噪比，牺牲时间 |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：整数换算与体积



` size m05_adc.o ` → text= **148**  B。` adc_to_mv ` 用 32 位乘除避免溢出与精度丢失（乘法在前）：



m05\_adc.c 节选C

 

```text
// 错误：先除后乘，整数除法把精度丢光
// mv = raw / 4095 * vref;
// 正确：乘法在前、除法在后，用 u32
static uint32_t adc_to_mv(uint16_t raw, uint32_t vref_mv) {
    return (uint32_t)raw * vref_mv / 4095u;   // 2048,3300 -> 1650
}
```

真实反汇编对应 32 位 mul/udiv；换算顺序决定精度



表 5.2 换算示例（12 位）



| raw | VREF=3300 mV 换算 | 含义 |
| --- | --- | --- |
| 0 | 0 mV | 零点 |
| 2048 | ≈1650 mV | 半量程 |
| 4095 | 3300 mV | 满量程 |
| LSB | ≈0.806 mV | VREF/4096 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm05-plat\n```\n\n\n\n```zhizhan-anchor\nm05-plat-t\n```\n\n\n\n## 5.3 三平台对照：ADC\n\n\n\n三平台 ADC 抽象不同：F103/H7 写 ADC 寄存器；ESP32 用 oneshot/连续驱动 API。三份代码均已交叉编译。\n\n\n\nm05\\_adc.cC\n\n \n\n```text\n/* m05_adc.c — B05-M05 ADC 采样与标定\n * 校准 → 单次转换 → 过采样平均 → 换算毫伏。采样时间需按源阻抗选取。 */\n#include \"stm32f103_regs.h\"\n\nvoid adc1_init(void)\n{\n    RCC_APB2ENR |= RCC_APB2ENR_ADC1EN;\n    ADC1->CR2 |= ADC_CR2_ADON;            /* 第一次写 ADON：上电 */\n\n    /* 校准序列：RSTCAL 自清 → CAL 自清 */\n    ADC1->CR2 |= ADC_CR2_RSTCAL;\n    while (ADC1->CR2 & ADC_CR2_RSTCAL) {\n    }\n    ADC1->CR2 |= ADC_CR2_CAL;\n    while (ADC1->CR2 & ADC_CR2_CAL) {\n    }\n\n    /* 通道 0 采样时间 = 55.5 周期（SMPR2 bit[2:0]=101），适配较高源阻抗 */\n    ADC1->SMPR2 = (ADC1->SMPR2 & ~(0x7u << 0)) | (0x5u << 0);\n    ADC1->SQR3 = 0u;                      /* 规则序列第 1 个转换 = 通道 0，长度 1 */\n}\n\nuint16_t adc1_read_once(void)\n{\n    ADC1->CR2 |= ADC_CR2_ADON;            /* 第二次写 ADON：启动转换（F1 特性） */\n    while ((ADC1->SR & ADC_SR_EOC) == 0u) {\n    }\n    return (uint16_t)ADC1->DR;            /* 读 DR 清 EOC */\n}\n\n/* 过采样：N 次平均，牺牲时间换信噪比；注意 sum 用 32 位防溢出 */\nuint16_t adc1_read_avg(uint16_t n)\n{\n    if (n == 0u) {\n        return 0u;\n    }\n    uint32_t sum = 0u;\n    for (uint16_t i = 0u; i < n; ++i) {\n        sum += adc1_read_once();\n    }\n    return (uint16_t)(sum / n);\n}\n\n/* 原始码 → 毫伏（12 位、VREF 通常 3300 mV） */\nuint32_t adc_to_mv(uint16_t raw, uint32_t vref_mv)\n{\n    return (uint32_t)raw * vref_mv / 4095u;\n}\n```\n\nSTM32F103 · ADC 校准/采样\n\n\n\nesp\\_m05\\_adc.cC\n\n \n\n```text\n/* esp_m05_adc.c — ESP32 ADC：SAR ADC 由 RTC 控制器管理，需先设衰减获得合适量程\n * 与 STM32 固定 VREF 不同，ESP32 用“衰减档”把量程拉到约 0..3.3V（不同芯片为 ~2.5V）。 */\n#include \"esp32_regs.h\"\n\ntypedef enum { ESP_ADC_ATTEN_0DB = 0, ESP_ADC_ATTEN_11DB = 3 } esp_adc_atten_t;\n\nextern int  adc1_config_width(int width_bits);\nextern int  adc1_config_channel_atten(int channel, esp_adc_atten_t atten);\nextern int  adc1_get_raw(int channel);\nextern int  esp_adc_cal_raw_to_voltage(int raw, const void *chars);\n\nint esp_adc1_init(int width_bits)\n{\n    (void)adc1_config_width(width_bits);                 /* 通常 12 位 */\n    return adc1_config_channel_atten(0, ESP_ADC_ATTEN_11DB); /* 通道 0，约 0..3.3V */\n}\n\nint esp_adc1_read(void) { return adc1_get_raw(0); }\n\n/* 换算必须带校准：ESP32 的 ADC 非线性明显，IDF 提供 esp_adc_cal 按 eFuse 校准值换算 */\nint esp_adc1_read_mv(const void *chars)\n{\n    return esp_adc_cal_raw_to_voltage(adc1_get_raw(0), chars);\n}\n```\n\nESP32 · ADC oneshot\n\n\n\nh7\\_m05\\_adc.cC\n\n \n\n```text\n/* h7_m05_adc.c — STM32H7 ADC（v3）：16 位、ISR/CFGR/SQR1，与 F1 的 SR/CR2 不同\n * 校准改由 ADCAL 位触发；分辨率与过采样在 CFGR2 配置；参考电压可外接 VREFBUF。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_ADC1_ISR   R32(0x40022000u)\n#define H7_ADC1_CR    R32(0x40022008u)\n#define H7_ADC1_CFGR  R32(0x4002200Cu)\n#define H7_ADC1_CFGR2 R32(0x40022010u)\n#define H7_ADC1_SQR1  R32(0x40022030u)\n#define H7_ADC1_DR    R32(0x40022040u)\n#define H7_ADC_ISR_EOC    (1u << 2)\n#define H7_ADC_CR_ADEN    (1u << 0)\n#define H7_ADC_CR_ADSTART (1u << 2)\n#define H7_ADC_CR_ADCAL   (1u << 31)\n\nvoid h7_adc1_init(void)\n{\n    R32(0x580244F0u) |= (1u << 24);    /* APB2 上的 ADC123 时钟（示意） */\n    /* H7 必做：先开 ADC 电压调节器并等待就绪，否则 ADEN/ADCAL 不生效 */\n    H7_ADC1_CR |= (1u << 28);          /* ADVREGEN（示意，位号见 RM0433） */\n    for (volatile uint32_t d = 0u; d < 1000u; ++d) { }   /* 稳压器建立时间 */\n    H7_ADC1_CR |= H7_ADC_CR_ADCAL;     /* 触发校准 */\n    while (H7_ADC1_CR & H7_ADC_CR_ADCAL) {\n    }\n    H7_ADC1_CR |= H7_ADC_CR_ADEN;      /* 使能 ADC */\n    while ((H7_ADC1_ISR & (1u << 0)) == 0u) {  /* ADRDY */\n    }\n    H7_ADC1_CFGR &= ~(0x3u << 2);      /* 分辨率 16 位（RES=00） */\n    H7_ADC1_SQR1 = 0u;                 /* 序列长度 1，通道 0 */\n}\n\nuint16_t h7_adc1_read(void)\n{\n    H7_ADC1_CR |= H7_ADC_CR_ADSTART;\n    while ((H7_ADC1_ISR & H7_ADC_ISR_EOC) == 0u) {\n    }\n    return (uint16_t)H7_ADC1_DR;\n}\n\n/* 16 位 → 毫伏：满量程 65535（F1 是 4095，换算系数不同，移植时改这里最容易漏） */\nuint32_t h7_adc_to_mv(uint16_t raw, uint32_t vref_mv)\n{\n    return (uint32_t)raw * vref_mv / 65535u;\n}\n```\n\nSTM32H7 · ADC\n\n\n\n表 5.3 三平台 ADC\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 分辨率 | 12 位 | 12 位 | 16 位 |\n| 校准 | RSTCAL/CAL | 驱动校准 | ADCAL |\n| 参考 | VDDA/VREF | 内部基准/衰减 | VREFBUF |\n| DMA | ADC→DMA 循环 | continuous\\+DMA | ADC→DMA |"}
````



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 过采样与自检



过采样（平均 N 次）用时间换信噪比。下图示意噪声随 N 下降的趋势：



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  过采样次数与噪声（示意量级）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="过采样次数与噪声（示意量级）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">N=1</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-red-s"></rect><text x="703" y="43" class="sv-lbl-hi">100%</text><text x="12" y="67" class="sv-lbl">N=16</text><rect x="150" y="50" width="136" height="18" rx="4" class="sv-amb-s"></rect><text x="294" y="67" class="sv-lbl-hi">25%</text><text x="12" y="91" class="sv-lbl">N=64</text><rect x="150" y="74" width="65" height="18" rx="4" class="sv-grn-s"></rect><text x="223" y="91" class="sv-lbl-hi">12%</text></svg>
```



平均 N 次使随机噪声按 1/√N 下降：N=1→1.0、N=16→0.25、N=64→0.125（相对量级）。



表 5.4 ADC 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 零点 | 输入接地读数 | 接近 0（校准后） |
| 量程 | 输入 VREF 读数 | 接近 4095 |
| 一致性 | 与万用表对照 | 按已声明的误差预算 |
| 噪声 | N 增大后标准差 | 下降 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **不校准** ：零点偏移进入所有读数，随温度漂移。

- **采样时间太短** ：高阻源下读数偏低、非线性；加大采样周期或加运放跟随。

- **先除后乘** ：` raw/4095*vref ` 整数除先丢精度。

- **VREF 不稳** ：参考电压带纹波时，ADC 把纹波当信号采进来。



◆ 自测 · Module 05（先答再看）




1. 读数为 2048、VREF=3300 mV，换算电压是多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"2048×3300/4095 ≈ 1650 mV，约等于 VREF 的一半，符合半量程。"}
   ```

2. 为什么高源阻抗要选更长的采样时间？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"采样窗口内采样电容要充到输入电压；源阻抗越大，充电越慢。窗口太短则电容未充满，读数偏低。"}
   ```

3. 过采样平均 N 次解决了什么问题、代价是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用平均换取更高的信噪比（随机噪声按 1/√N 下降）；代价是时间，采样率下降。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用万用表对照你板子的 ADC 读数，按源阻抗调整采样时间并做一次过采样平均。



核对与延伸：[ST · AN3116 ADC 模式与应用](https://www.st.com/resource/en/application_note/an3116-stm32-s-adc-modes-and-their-applications-stmicroelectronics.pdf)

 

动手练习



读单通道电压并与万用表对照；把过采样次数 N 从 1 调到 64，观察读数噪声下降。



**检查结果：** 校准后零点接近 0；过采样（N=64）后标准差下降；在未参与标定的输入点报告残差；误差限由参考源、万用表、ADC 与电路误差预算事先确定。

 

迁移练习：把本章的“能校准 ADC、按源阻抗选采样时间、做整数换算与过采样平均，使读数与万用表一致。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m05","criterion":"校准后零点接近 0；过采样（N=64）后标准差下降；在未参与标定的输入点报告残差；误差限由参考源、万用表、ADC 与电路误差预算事先确定。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
