# 传感器驱动实战

```zhizhan-anchor
m11
```



把驱动分成三层： **总线层** 只承诺读写寄存器、 **器件层** 懂 WHO\_AM\_I/量程/寄存器含义、 **服务层** 对外给物理量\+错误码。分层让器件驱动可脱离具体硬件、在主机上用 mock 测试。

 

> 前置：会用函数指针/结构体做接口抽象，并理解 [I²C](term:i2c)/SPI 寄存器读写。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能分总线/器件/服务三层写驱动，用函数指针注入总线并返回可区分错误码。

 

本章速览




- 驱动分三层：总线 / 器件 / 服务，用函数指针注入总线。

- 错误码要可区分：总线错 vs 型号错，上层才能重试或降级。

- 对外返回“物理量 \+ 单位 \+ 错误码”，不要只打印。

 

```zhizhan-anchor
m11-layers
```



```zhizhan-anchor
m11-layers-t
```



## 11.1 三层分层：总线 / 器件 / 服务



总线层只承诺“能读写寄存器”；器件层知道 WHO\_AM\_I、量程与寄存器含义；服务层对外给“温度/角速度”等物理量，并统一错误码。分层的直接收益是器件层可脱离具体硬件、在主机上用 mock 总线做单元测试。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  三层驱动与依赖方向



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="三层驱动与依赖方向" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">服务层（物理量 + 错误码）</text><rect x="60" y="64" width="680" height="60" rx="6" class="sv-cyn-s"></rect><text x="75" y="98.0" class="sv-lbl-hi">器件层（WHO_AM_I/量程/寄存器）</text><rect x="60" y="128" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="147.0" class="sv-lbl-hi">总线层（函数指针注入：i2c/spi/mock）</text></svg>
```



服务层 → 器件层 → 总线层（函数指针注入）。器件层不依赖具体 I²C/SPI，故可 mock。



表 11.1 三层职责



| 层 | 输入 | 输出 | 测试方式 |
| --- | --- | --- | --- |
| 总线 | 地址、寄存器 | 字节 | 主机 mock / 硬件 |
| 器件 | 总线句柄 | 原始寄存器值 | mock 总线 |
| 服务 | 器件句柄 | 物理量 \+ 错误码 | 主机仿真数据 |



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：函数指针注入



` size m11_sensors.o ` → text= **156**  B。用函数指针注入总线，而不是在器件层直接调 ` i2c1_read_reg `：



m11\_sensors.c 节选C

 

```text
typedef struct { int (*read)(void *ctx, uint8_t reg, uint8_t *v); } bus_t;
typedef struct { bus_t bus; void *ctx; } dev_t;
int dev_init(dev_t *d) {
    uint8_t id; int r = d->bus.read(d->ctx, REG_WHOAMI, &id);
    if (r) return -2;                    // 总线错误
    if (id != EXPECTED_ID) return -3;    // 型号不符
    return 0;
}
```

真实反汇编对应间接调用；mock 总线可在主机复用同一器件层代码



表 11.2 可区分的错误码



| 错误码 | 含义 | 上层动作 |
| --- | --- | --- |
| -2 | 总线错误 | 重试 / 检查接线 |
| -3 | 型号不符 | 放弃 / 换器件 |
| 0 | 成功 | 继续 |
| -1 | 其他 | 记录并降级 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm11-plat\n```\n\n\n\n```zhizhan-anchor\nm11-plat-t\n```\n\n\n\n## 11.3 三平台对照：传感器驱动\n\n\n\n三平台差异主要在总线实现，器件/服务层可复用。三份代码均已交叉编译。\n\n\n\nm11\\_sensors.cC\n\n \n\n```text\n/* m11_sensors.c — B05-M11 传感器驱动实战（分层：总线层 / 器件层 / 服务层）\n * 用函数指针注入总线，使器件层可脱离具体 I²C 硬件、可在主机上 mock 测试。 */\n#include <stdint.h>\n#include <stddef.h>\n\n/* ---- 总线层：只承诺“读一个寄存器” ---- */\ntypedef struct {\n    int (*read_reg)(uint8_t addr7, uint8_t reg, uint8_t *out);\n} i2c_bus_t;\n\n/* ---- 器件层：知道 WHO_AM_I 与量程寄存器，不关心总线怎么实现 ---- */\ntypedef struct {\n    i2c_bus_t bus;\n    uint8_t   addr7;\n    uint8_t   who;\n} imu_t;\n\n#define MPU6050_ADDR      0x68u\n#define MPU6050_WHO_AM_I  0x75u\n#define MPU6050_WHO_VALUE 0x68u\n\nint imu_probe(imu_t *dev)\n{\n    if (dev == NULL || dev->bus.read_reg == NULL) {\n        return -1;\n    }\n    uint8_t who = 0u;\n    if (dev->bus.read_reg(dev->addr7, MPU6050_WHO_AM_I, &who) != 0) {\n        return -2;                 /* 总线错误 */\n    }\n    dev->who = who;\n    return (who == MPU6050_WHO_VALUE) ? 0 : -3;  /* -3：器件型号不符 */\n}\n\n/* ---- 服务层：一次“读温度”，带错误码与量纲换算 ---- */\ntypedef enum {\n    SVC_OK = 0,\n    SVC_ERR_BUS,\n    SVC_ERR_NOT_READY\n} svc_err_t;\n\ntypedef struct {\n    svc_err_t (*read_temp_c10)(void *dev, int16_t *temp_c10);\n} temp_service_t;\n\ntypedef struct {\n    imu_t imu;\n    int   probed;\n} env_node_t;\n\nstatic svc_err_t imu_read_temp_c10(void *ctx, int16_t *temp_c10)\n{\n    env_node_t *node = (env_node_t *)ctx;\n    if (node == NULL || !node->probed) {\n        return SVC_ERR_NOT_READY;\n    }\n    uint8_t hi = 0u, lo = 0u;\n    if (node->imu.bus.read_reg(node->imu.addr7, 0x41u, &hi) != 0 ||\n        node->imu.bus.read_reg(node->imu.addr7, 0x42u, &lo) != 0) {\n        return SVC_ERR_BUS;\n    }\n    int16_t raw = (int16_t)(((int16_t)hi << 8) | lo);\n    /* MPU6050 温度灵敏度 340 LSB/°C，零点约 36.53 °C。\n     * c10 为“十分之一度”：c10 = raw×10/340 + 365 ≈ raw/34 + 365。 */\n    *temp_c10 = (int16_t)(raw / 34 + 365);\n    return SVC_OK;\n}\n\ntemp_service_t env_temp_service(env_node_t *node)\n{\n    temp_service_t svc = { imu_read_temp_c10 };\n    (void)node;\n    return svc;\n}\n```\n\nSTM32F103 · 分层器件驱动\n\n\n\nesp\\_m11\\_sensors.cC\n\n \n\n```text\n/* esp_m11_sensors.c — ESP32 上的传感器分层：总线层换成 IDF 的 i2c_master，\n * 器件层/服务层结构不变。ESP-IDF 用 esp_err_t 返回码，而不是全局 errno。 */\n#include <stdint.h>\n#include <stddef.h>\n\ntypedef int esp_err_t;\n#define ESP_OK 0\n#define ESP_FAIL -1\n\ntypedef struct {\n    esp_err_t (*read_reg)(void *bus, uint8_t addr7, uint8_t reg, uint8_t *out);\n} esp_i2c_bus_t;\n\ntypedef struct {\n    void         *bus_ctx;\n    esp_i2c_bus_t bus;\n    uint8_t       addr7;\n    uint8_t       who;\n} esp_imu_t;\n\n#define MPU6050_ADDR     0x68u\n#define MPU6050_WHO_AM_I 0x75u\n\nesp_err_t esp_imu_probe(esp_imu_t *dev)\n{\n    if (dev == NULL || dev->bus.read_reg == NULL) { return ESP_FAIL; }\n    uint8_t who = 0u;\n    if (dev->bus.read_reg(dev->bus_ctx, dev->addr7, MPU6050_WHO_AM_I, &who) != ESP_OK) {\n        return -2;   /* 总线错误（示意：可用 ESP_ERR_TIMEOUT 等具体码） */\n    }\n    dev->who = who;\n    return (who == MPU6050_ADDR) ? ESP_OK : -3;   /* -3：型号不符 */\n}\n```\n\nESP32 · i2c 器件\n\n\n\nh7\\_m11\\_sensors.cC\n\n \n\n```text\n/* h7_m11_sensors.c — STM32H7 上的传感器分层：与 F1 同结构，但多两条 H7 专属约束\n * ① DMA 缓冲与 D-cache 一致性；② 外设时钟在 D2/D3 域，需先选内核时钟源。 */\n#include <stdint.h>\n#include <stddef.h>\n\ntypedef struct {\n    int (*read_reg)(uint8_t addr7, uint8_t reg, uint8_t *out);\n} i2c_bus_t;\n\ntypedef struct {\n    i2c_bus_t bus;\n    uint8_t   addr7;\n    uint8_t   who;\n} imu_t;\n\n#define MPU6050_ADDR     0x68u\n#define MPU6050_WHO_AM_I 0x75u\n\nint h7_imu_probe(imu_t *dev)\n{\n    if (dev == NULL || dev->bus.read_reg == NULL) { return -1; }\n    uint8_t who = 0u;\n    if (dev->bus.read_reg(dev->addr7, MPU6050_WHO_AM_I, &who) != 0) { return -2; }\n    dev->who = who;\n    return (who == MPU6050_ADDR) ? 0 : -3;\n}\n\n/* 若 IMU 走高带宽 SPI + DMA：缓冲必须按 cache line 对齐，并在 DMA 前后做 clean/invalidate。\n * 分层不变，但“对齐与一致性”是 H7 新增的实现细节。 */\nint h7_imu_dma_ok(void) { return 1; }\n```\n\nSTM32H7 · 分层器件\n\n\n\n表 11.3 三平台传感器驱动\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 总线 | 寄存器 I2C/SPI | i2c\\_master | I2C/SPI |\n| 自检 | WHO\\_AM\\_I | WHO\\_AM\\_I | WHO\\_AM\\_I |\n| 分层 | 函数指针注入 | 函数指针注入 | 函数指针注入 |\n| 换算 | 整数/定点 | 浮点 | 浮点/整数 |"}
````



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 探测流程与自检



探测失败要能区分“总线不通”和“器件不对”，这决定了上层重试还是放弃。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  传感器探测流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="传感器探测流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">WHO_AM_I</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验型号</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">配置量程</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">读值换算</text></svg>
```



读 WHO\_AM\_I → 总线错误(-2) 或 型号不符(-3) → 配置量程 → 读值换算物理量。



表 11.4 传感器驱动自检



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 在位 | 读 WHO\_AM\_I | 与手册一致 |
| 总线 | mock 注入错误 | 返回 -2 |
| 量纲 | 读温度换算 | 带 °C 且合理 |
| 可替换 | 换 SPI/mock | 器件层不改 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **器件层直接调具体总线** ：换平台就要改驱动，且无法主机测试。

- **错误码笼统** ：只返回 -1，上层无法判断重试还是放弃。

- **量纲丢失** ：把原始码当摄氏度传出去，上层无法用。

- **不校验 WHO\_AM\_I** ：接错器件也“正常”出数。



◆ 自测 · Module 11（先答再看）




1. 为什么服务层要返回“物理量 \+ 错误码”，而不是直接打印？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"打印把“决策”固化在驱动里，上层无法重试/降级/记录。返回结构化结果，日志只是其中一种消费者。"}
   ```

2. 把总线用函数指针注入的最大好处是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"器件层不再依赖具体 I²C/SPI 硬件，可在主机用 mock 总线做单元测试，也能换总线/换平台而复用器件层。"}
   ```

3. 为什么探测失败要区分 -2 和 -3？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"-2 是总线错误（可重试/查接线），-3 是型号不符（应放弃或换器件）。笼统的 -1 让上层无法决策。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目里某个器件驱动改成三层结构，用函数指针注入总线并在主机跑通 mock 探测失败路径。



核对与延伸：[NXP · I²C 总线规范 UM10204](https://www.nxp.com/docs/en/user-guide/UM10204.pdf) · [ST · AN3116 ADC 模式与应用](https://www.st.com/resource/en/application_note/an3116-stm32-s-adc-modes-and-their-applications-stmicroelectronics.pdf)

 

动手练习



为 IMU 做自检：读 WHO\_AM\_I、读温度换算 °C；用 mock 总线在主机上跑通探测失败路径。



**检查结果：** 探测错误码可区分：-2=总线错、-3=型号不符；温度换算带单位；服务层错误码被上层正确分流。

 

迁移练习：把本章的“能分总线/器件/服务三层写驱动，用函数指针注入总线并返回可区分错误码。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m11","criterion":"探测错误码可区分：-2=总线错、-3=型号不符；温度换算带单位；服务层错误码被上层正确分流。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
