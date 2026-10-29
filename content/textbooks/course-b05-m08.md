# I²C

```zhizhan-anchor
m08
```



[I²C](term:i2c) 是开漏总线：高电平靠 **上拉电阻** 。每个等待循环都要 **设超时** ——从机掉电把 SDA 拉死时，死等会卡死整机。先区分物理占线与控制器状态异常；恢复必须有截止时间和失败出口。

 

> 前置：理解开漏总线与时序，会用逻辑分析仪/时序图读状态标志。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能解释读寄存器时序、为等待设置上限，并区分线路清理、控制器复位和重新初始化。

 

本章速览




- 每个等待都要设超时，从机死掉不能拖死主循环。

- 三种接口：F1 标志轮询、H7 TIMINGR\+ISR、ESP-IDF 设备句柄。

- 按原因恢复：区分线路占用与控制器状态异常，限时退出并重新初始化。

 

```zhizhan-anchor
m08-model
```



```zhizhan-anchor
m08-model-t
```



## 8.1 开漏、上拉与状态机



SDA/SCL 都由器件“拉低”，高电平靠上拉电阻。上拉阻值要权衡：太大上升沿慢，太小功耗大。4.7 kΩ@100 kHz、2.2 kΩ@400 kHz 只是示例，须按总线电容、上升时间与灌电流核算并测量。每个状态等待都必须设超时。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  一次读寄存器的总线时序



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="一次读寄存器的总线时序" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M308,26 V94"></path><text x="308" y="18" text-anchor="middle" class="sv-lbl-dim">24</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">47</text><path class="sv-dash" d="M612,26 V94"></path><text x="612" y="18" text-anchor="middle" class="sv-lbl-dim">70</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">94</text><text x="12" y="48" class="sv-lbl">SCL</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="594" height="22" rx="4" class="sv-box"></rect><text x="446.8" y="47" text-anchor="middle" class="sv-lbl-hi">时钟</text><text x="12" y="82" class="sv-lbl">事务</text><path class="sv-dash" d="M150,78 H770"></path><rect x="163" y="66" width="132" height="22" rx="4" class="sv-cyn-s"></rect><text x="229.1" y="81" text-anchor="middle" class="sv-lbl-hi">ADDR+W</text><rect x="308" y="66" width="132" height="22" rx="4" class="sv-cyn-s"></rect><text x="374.3" y="81" text-anchor="middle" class="sv-lbl-hi">REG</text><rect x="453" y="66" width="264" height="22" rx="4" class="sv-grn-s"></rect><text x="585.3" y="81" text-anchor="middle" class="sv-lbl-hi">ADDR+R/读</text></svg>
```



START → 器件地址\+W → 寄存器地址 → 重复 START → 地址\+R → 读数据(NACK) → STOP。



表 8.1 I²C 状态与标志



| 阶段 | 标志 | 易错点 |
| --- | --- | --- |
| 起始 | SB 置位 | 读 SR1 后写 DR 清 SB |
| 地址 | ADDR 置位 | 读 SR1 再读 SR2 清 ADDR |
| 数据 | RXNE/TXE | 单字节读要先 NACK 再 STOP |
| 错误/锁定 | AF / BUSY | AF=无应答；BUSY 长期 1 须区分占线、其他控制器通信或状态异常 |



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 等待上限与恢复边界



` 计数上限 `能防止无限循环，但其实际耗时依赖时钟、编译选项和抢占。工程验收应测量单调时钟期限；以下不是板上实测结果：



m08\_i2c.c 节选C

 

```text
static int wait_flag(volatile uint32_t *sr, uint32_t mask) {
    uint32_t to = 100000;
    while (!(*sr & mask)) { if (--to == 0) return -1; }  // 带超时
    return 0;
}
/* 线路清理与控制器复位是不同操作；见下方恢复流程。 */
```

教学片段只展示有界等待；错误码、总线清理、初始化和单调期限由完整驱动补齐



表 8.2 I²C 故障与恢复



| 故障 | 现象 | 恢复 |
| --- | --- | --- |
| AF 无应答 | 器件不存在/地址错 | 检查地址/接线 |
| BUSY 恒 1 | 先测 SDA/SCL，再查控制器状态 | 按物理占线或控制器异常分别处理 |
| ADDR 不清 | 状态机停住 | 读 SR1 再读 SR2 |
| 上拉缺失 | 波形畸变 | 补上拉（注意并联） |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-plat\n```\n\n\n\n```zhizhan-anchor\nm08-plat-t\n```\n\n\n\n## 8.3 三平台对照：I²C\n\n\n\n以下是三种接口片段，不是完整板级工程。F103/H7 的寄存器布局不同；ESP32 使用真实 ESP-IDF I2C 主机头文件与设备句柄。本轮已修正 H7 的 PE/TIMINGR 顺序及 RELOAD/TC 配对，尚未完成这些片段的 SDK 构建与目标板验证。\n\n\n\nm08\\_i2c.cC\n\n \n\n```text\n/* m08_i2c.c — B05-M08 STM32F103 单字节读取教学片段。\n * 前置：单控制器、独占 I2C1、已配置时钟/开漏引脚/CR2/CCR/TRISE，POS=0。\n * 计数上限只限制循环次数，不是毫秒期限；产品驱动须换成单调时钟期限。\n * 返回失败后禁止直接重试：调用者须检查线路、复位并重新初始化控制器。\n * 这里只展示寄存器顺序，未在本轮用目标板验证。 */\n#include \"stm32f103_regs.h\"\n\n#define I2C_TIMEOUT 100000u\n\nstatic int i2c_wait_sr1(uint32_t mask, int want_set)\n{\n    for (uint32_t t = 0u; t < I2C_TIMEOUT; ++t) {\n        if (((I2C1->SR1 & mask) != 0u) == (want_set != 0)) {\n            return 0;\n        }\n    }\n    return -1; /* 超时：总线可能被从机拉死 */\n}\n\n/* 从机 7 位地址 addr7，读其内部寄存器 reg */\nint i2c1_read_reg(uint8_t addr7, uint8_t reg, uint8_t *val)\n{\n    if (addr7 > 0x7fu || val == 0) return -2;\n    if (I2C1->SR2 & I2C_SR2_BUSY) return -3;\n    I2C1->CR1 |= I2C_CR1_START;\n    if (i2c_wait_sr1(I2C_SR1_SB, 1)) return -1;      /* 起始已发 */\n    I2C1->DR = (uint32_t)(addr7 << 1);               /* 写地址 */\n    if (i2c_wait_sr1(I2C_SR1_ADDR, 1)) return -1;\n    (void)I2C1->SR2;                                 /* 读 SR2 清 ADDR */\n    I2C1->DR = reg;\n    /* 等 BTF（字节完全移出）再发重复起始；只等 TXE 可能在数据仍在总线上时过早发起，\n     * 这是 F1 上“偶尔读错/收到 NACK”的隐蔽原因。 */\n    if (i2c_wait_sr1(I2C_SR1_BTF, 1)) return -1;\n\n    I2C1->CR1 |= I2C_CR1_START;                      /* 重复起始 */\n    if (i2c_wait_sr1(I2C_SR1_SB, 1)) return -1;\n    I2C1->DR = (uint32_t)((addr7 << 1) | 1u);        /* 读地址 */\n    if (i2c_wait_sr1(I2C_SR1_ADDR, 1)) return -1;\n\n    /* F1 单字节接收：ADDR 清除与 STOP 设置不能被中断打断；恢复原 PRIMASK。 */\n    uint32_t primask;\n    __asm volatile (\"mrs %0, primask\\n\\tcpsid i\" : \"=r\"(primask) :: \"memory\");\n    I2C1->CR1 &= ~I2C_CR1_ACK;                       /* 单字节读：先 NACK */\n    (void)I2C1->SR2;\n    I2C1->CR1 |= I2C_CR1_STOP;\n    __asm volatile (\"msr primask, %0\" :: \"r\"(primask) : \"memory\");\n    if (i2c_wait_sr1(I2C_SR1_RXNE, 1)) return -1;\n    *val = (uint8_t)I2C1->DR;\n    return 0;\n}\n\n/* 只复位本机控制器，不产生 SCL 脉冲，也不能释放被从机持续拉低的线路。\n * 保持 PE=0；调用者须先处理占线，再重新配置 CR2/CCR/TRISE 等并使能外设。 */\nvoid i2c1_controller_reset(void)\n{\n    I2C1->CR1 |= I2C_CR1_SWRST;\n    b05_dsb();\n    I2C1->CR1 &= ~I2C_CR1_SWRST;\n    I2C1->CR1 &= ~I2C_CR1_PE;\n}\n```\n\nSTM32F103 · I2C 状态机 \\+ 超时\n\n\n\nesp\\_m08\\_i2c.cC\n\n \n\n```text\n/* ESP-IDF 6.0 I2C 主机 API；组件依赖 esp_driver_i2c。\n * dev 来自已配置总线上的 i2c_master_bus_add_device；器件地址在设备配置中设置。\n * 只支持同步模式（未注册异步回调），缓冲区在调用返回前有效。\n * 此文件是 SDK 函数片段；构建入口见 B06，I2C 接线和故障恢复仍须目标板验证。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"driver/i2c_master.h\"\n#include \"esp_err.h\"\n\nesp_err_t esp_i2c_read_reg(i2c_master_dev_handle_t dev, uint8_t reg, uint8_t *val)\n{\n    if (dev == NULL || val == NULL) return ESP_ERR_INVALID_ARG;\n    uint8_t received = 0;\n    /* 写寄存器地址后重复 START，再读一个字节；100 是毫秒，不是 RTOS tick。 */\n    esp_err_t err = i2c_master_transmit_receive(dev, &reg, 1, &received, 1, 100);\n    if (err == ESP_OK) *val = received; /* 失败时不提交不完整结果 */\n    return err;\n}\n```\n\nESP32 · i2c\\_master\n\n\n\nh7\\_m08\\_i2c.cC\n\n \n\n```text\n/* h7_m08_i2c.c — STM32H7 I²C（v2）：TIMINGR 预置时序、CR2 发起、ISR 状态、TXDR/RXDR\n * 与 F1 的 I2C v1（CR1/SR1/SR2、手动 START/ACK）是两套不同的编程模型。\n * 教学片段：时钟、开漏引脚、滤波、单调期限和故障恢复由完整工程配置。\n * 仅用于独占单控制器；失败后须清理/重新初始化再重试。本轮未做目标板验证。 */\n#include \"stm32h7_regs.h\"\n\nvoid h7_i2c1_init(uint32_t timingr)\n{\n    H7_I2C1->CR1 &= ~1u;       /* TIMINGR 只能在 PE=0 时配置 */\n    H7_I2C1->TIMINGR = timingr; /* SCLDEL/SDADEL/SCLH/SCLL，按 PCLK 与目标速率算，替代 F1 的 CCR/TRISE */\n    H7_I2C1->CR1 |= 1u;\n}\n\nstatic int h7_i2c_wait(uint32_t mask)\n{\n    for (uint32_t t = 0u; t < 100000u; ++t) {\n        if (H7_I2C1->ISR & H7_I2C_ISR_NACKF) { return -2; }\n        if (H7_I2C1->ISR & mask) { return 0; }\n    }\n    return -1;\n}\n\nint h7_i2c1_read_reg(uint8_t addr7, uint8_t reg, uint8_t *val)\n{\n    if (addr7 > 0x7fu || val == 0) { return -3; }\n    /* 写阶段：NBYTES=1，RELOAD=0、AUTOEND=0，完成后等 TC 再重复 START。\n     * RELOAD=1 会进入 TCR，不能在该配置下等待 TC。 */\n    H7_I2C1->CR2 = ((uint32_t)addr7 << 1) | (1u << 16) | (1u << 13);\n    if (h7_i2c_wait(H7_I2C_ISR_TXIS)) { return -1; }\n    H7_I2C1->TXDR = reg;\n    if (h7_i2c_wait(H7_I2C_ISR_TC)) { return -1; }\n    if (H7_I2C1->ISR & H7_I2C_ISR_NACKF) { return -2; }\n\n    /* 读阶段：1 字节，AUTOEND=1 自动发 STOP */\n    H7_I2C1->CR2 = ((uint32_t)addr7 << 1) | (1u << 16) | (1u << 10)\n                 | (1u << 13) | (1u << 25);\n    if (h7_i2c_wait(H7_I2C_ISR_RXNE)) { return -1; }\n    uint8_t received = (uint8_t)H7_I2C1->RXDR;\n    if (h7_i2c_wait(1u << 5)) { return -1; } /* STOPF：等 AUTOEND 真正结束 */\n    H7_I2C1->ICR = 1u << 5;                 /* STOPCF */\n    *val = received;\n    return 0;\n}\n```\n\nSTM32H7 · I2C\n\n\n\n表 8.3 三平台 I²C\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 驱动 | 寄存器状态机 | i2c\\_master | 寄存器/时序 |\n| 超时 | 手动计数 | 驱动超时 | 手动/驱动 |\n| 恢复 | 线路清理 \\+ 控制器重初始化 | 驱动/总线恢复接口与线路检查 | 线路清理 \\+ 控制器重初始化 |\n| 速率 | 按器件规格与实测上升沿 | 按芯片/从机与驱动约束 | 按器件规格与时序计算 |"}
````



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 超时与恢复自检



I²C 排障先看“有没有应答、总线是否被锁死”。下图给出死锁恢复流程：



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  I²C 死锁恢复流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="I²C 死锁恢复流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">测量线路</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">按原因恢复</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">有限尝试</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">重初始化/失败</text></svg>
```



停止新[事务](term:transaction)并取得总线独占权，测量 SDA/SCL。SCL 可释放且 SDA 卡低时，受控开漏输出最多 9 个时钟；线路释放后按条件产生 STOP，再重新初始化。SCL 或 SDA 持续卡低则限时失败，按板级策略硬件复位/断电或降级。SWRST 只处理本机控制器状态。



表 8.4 I²C 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 应答 | 对已知地址执行器件手册允许的身份读取 | 身份/返回值符合预期 |
| 时序 | 逻辑分析仪对照标志 | SB/ADDR 正常 |
| 超时 | 断从机后读 | 返回超时而非卡死 |
| 恢复 | 分别注入可释放与持续占线 | 前者恢复读取；后者限时失败 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



核对依据：[NXP UM10204 §3.1.16 Bus clear](https://www.nxp.com/docs/en/user-guide/UM10204.pdf)；[ST RM0008 I2C](https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)；[ST RM0433 I2C](https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-stm32h743753-and-stm32h750-value-line-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)；[ESP-IDF 6.0 I2C 主机 API](https://docs.espressif.com/projects/esp-idf/en/v6.0/esp32/api-reference/peripherals/i2c.html)。



失败路径与排障




- **无超时** ：从机异常时主循环卡死，看门狗又没开 → 整机假死。

- **ADDR 不清** ：写完地址没读 SR2，状态机停在原地。

- **只等 TXE 就发重复起始** ：应等 BTF。

- **把 SWRST 当万能** ：复位外设不释放被从机拉死的物理总线。



◆ 自测 · Module 08（先答再看）




1. 总线 BUSY 一直为 1、所有读都超时，第一步做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先测 SDA/SCL 电平，区分占线与控制器状态异常；按上述前提进行线路清理或控制器重初始化，并让上层带重试与降级，而不是死等。"}
   ```

2. 为什么每个等待循环都要设超时？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"从机掉电/异常会把总线拉死；无超时则主循环永久阻塞，整机假死（尤其没开看门狗时）。"}
   ```

3. SWRST 复位外设一定能释放总线吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能这样保证。SWRST 只复位主机外设；SCL 本身卡低时无法产生有效时钟，持续占线必须限时失败并按板级策略处理。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给项目补上有时间上限的等待、按原因恢复与有界重试；分别记录正常、NACK、SDA 卡低、SCL 卡低的结果。



核对与延伸：[NXP · I²C 总线规范 UM10204](https://www.nxp.com/docs/en/user-guide/UM10204.pdf)

 

动手练习



用逻辑分析仪抓一次读寄存器时序，对照 SR1 各标志；用受控开漏从机保持 SDA 为低，验证时钟脉冲恢复和超时退出；不直接短接推挽引脚。



**检查结果：** 正常读取成功；NACK、SDA 持续占线、SCL 持续占线均在设定期限内退出。可恢复故障清除后能重新初始化并读取；持续故障明确报错，不无限重试。

 

迁移练习：把本章的“能解释读寄存器时序、为等待设置上限，并区分线路清理、控制器复位和重新初始化。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m08","criterion":"正常读取成功；NACK、SDA 持续占线、SCL 持续占线均在设定期限内退出。可恢复故障清除后能重新初始化并读取；持续故障明确报错，不无限重试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
