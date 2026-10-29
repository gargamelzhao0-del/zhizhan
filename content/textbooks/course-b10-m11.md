# 面向真实器件的子系统驱动

```zhizhan-anchor
m11
```



写真实器件驱动的路径是固定的： **读数据手册 → 定寄存器映射 → 选总线与子系统 → 实现 → 处理错误/超时** 。本章把这套流程与 ` regmap `/子系统接入结合起来。

 

> 前置：Module 07 总线驱动与 Module 09 子系统。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能从数据手册出发，用 regmap 与子系统框架写出一个真实器件的驱动骨架并处理错误/超时。

 

本章速览




- 真实器件的关键在于初始化序列与时序，而不是业务代码。

- 最小自检是读 WHO\_AM\_I 对照手册；不对先查电源/地址/总线。

- 绑定文档（DT binding）是交付的一部分。

 

```zhizhan-anchor
m11-flow
```



```zhizhan-anchor
m11-flow-t
```



## 11.1 从数据手册到驱动：固定流程



器件驱动不是“凭感觉写”。固定五步： **① 读手册拿寄存器映射与总线；② 定位它在设备树里的位置；③ 选子系统；④ 用 regmap/总线 API 实现读写；⑤ 处理错误与超时。**



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  器件驱动的五步流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="器件驱动的五步流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">数据手册</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">寄存器映射</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">总线/子系统</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">实现</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">错误/超时</text></svg>
```



数据手册 → 寄存器映射 → 总线/子系统选择 → 实现读写 → 错误/超时处理。跳过任何一步，都会在真实器件上“读回不对”或“偶发失败”。



表 11.1 器件驱动的五步



| 步骤 | 产出 | 依据 |
| --- | --- | --- |
| 读手册 | 寄存器表、时序 | datasheet |
| dts 节点 | compatible/reg/irq | 板级设备树 |
| 选子系统 | IIO/input/hwmon… | 器件能力 |
| 实现读写 | regmap/总线 API | 手册时序 |
| 错误/超时 | 重试/降级 | 手册时序与总线特性 |



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：寄存器访问契约



“读寄存器 = 写地址 \+ 读数据”是多数器件的基本契约。下面复现并验证越界保护：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_bus.cC\n\n \n\n```text\n/* host_bus.c —— I2C 客户端读写传输模型（主机可运行）。\n * 读寄存器：先写寄存器地址（1 个消息），再读数据（1 个消息），共 2 次传输。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bus.c -o host_bus && ./host_bus\n */\n#include <stdio.h>\n#include <stdint.h>\n#include <string.h>\ntypedef struct { uint8_t regs[8]; int xfers; } i2c_dev_t;\nstatic int i2c_write_read(i2c_dev_t *d, uint8_t reg, uint8_t *out) {\n    d->xfers++;                       /* msg1: 写寄存器地址 */\n    if (reg >= 8) return -1;\n    d->xfers++;                       /* msg2: 读数据 */\n    *out = d->regs[reg];\n    return 0;\n}\nstatic int i2c_write(i2c_dev_t *d, uint8_t reg, uint8_t val) {\n    d->xfers++;\n    if (reg >= 8) return -1;\n    d->regs[reg] = val;\n    return 0;\n}\nint main(void) {\n    i2c_dev_t d; memset(&d, 0, sizeof(d)); d.regs[3] = 0x5A;\n    int ok = 1; uint8_t v = 0;\n    i2c_write(&d, 1, 0x11);\n    if (i2c_write_read(&d, 3, &v) != 0 || v != 0x5A) ok = 0;\n    printf(\"读 reg3=0x%02X（期望 0x5A），累计传输=%d（写1+读写2=3）\\n\", v, d.xfers);\n    if (d.xfers != 3) ok = 0;\n    printf(\"越界 reg=9 读: %d（期望 -1）\\n\", i2c_write_read(&d, 9, &v));\n    if (i2c_write_read(&d, 9, &v) != -1) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n寄存器读写契约模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_bus.c -o labs/host_bus && ./labs/host_bus
读 reg3=0x5A（期望 0x5A），累计传输=3（写1+读写2=3）
越界 reg=9 读: -1（期望 -1）
RESULT: PASS
```



读寄存器 2 次传输、写 1 次；越界寄存器必须在驱动层拒绝，而不是交给硬件。



sensor\_probe.c 节选C

 

```text
// 1) 读 WHO_AM_I 校验器件在位与型号
regmap_read(map, REG_WHOAMI, &id);
if (id != EXPECTED_ID) return dev_err_probe(dev, -ENODEV, "bad id 0x%x", id);
// 2) 配置 → 3) 使能测量 → 4) 注册到子系统（IIO/input）
regmap_write(map, REG_CTRL, CTRL_ENABLE);
// 5) 读数据时处理超时：status 未就绪则重试/返回 -EAGAIN
```

WHO\_AM\_I 验器件、配置、使能、注册子系统、超时重试



```zhizhan-anchor
m11-detail
```



```zhizhan-anchor
m11-detail-t
```



## 11.3 regmap \+ 子系统：少写重复代码



` regmap ` 把 [I²C](term:i2c)/SPI 的寄存器访问统一；子系统框架（如 IIO）负责通道与用户接口。驱动只需实现“读原始值 \+ 换算”和子系统接入点，其余交给框架。



表 11.2 regmap 与子系统的分工



| 关注点 | 谁负责 | 驱动做什么 |
| --- | --- | --- |
| 寄存器访问 | regmap | 描述 reg/value 宽度与易变表 |
| 用户接口 | 子系统（IIO 等） | 注册 iio\_dev、定义通道 |
| 电源管理 | 子系统/PM | 实现 runtime PM 回调 |
| 错误/超时 | 驱动 | 按手册时序重试或降级 |



先验证器件在位，再谈数据



第一件事永远是读 ` WHO_AM_I ` 之类的标识寄存器确认器件与型号。身份都不对，后面所有读值都不可信——这是真实器件驱动最常见的浪费点。



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm11-routes\n```\n\n\n\n```zhizhan-anchor\nm11-routes-t\n```\n\n\n\n## 11.4 三条内核路线对照：器件接入\n\n\n\n同一器件在三平台上的差异只在“总线控制器与 dts 节点”，驱动主体（regmap\\+子系统）可复用。\n\n\n\n表 11.3 三条路线的器件接入\n\n\n\n| 内核路线 | 总线 | dts 节点 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | I²C on i2c1 | &i2c1 { sensor@68 {} } | mainline |\n| i.MX6ULL | I²C on i2c1 | 同上 | BSP mainline |\n| V3s | I²C on twi0 | &twi0 { sensor@68 {} } | sunxi |"}
````



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 器件驱动自检



真实器件驱动的自检从“身份”开始，再验“读写与量程”：



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  器件驱动的四步自检



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="器件驱动的四步自检" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">WHO_AM_I</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">配置回读</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">数据合理</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">边界/超时</text></svg>
```



WHO\_AM\_I 验身份 → 配置回读验证 → 读数据合理性 → 边界/超时处理。任一步失败都别继续。



表 11.4 器件驱动自检清单



| 检查项 | 方法 | 通过标志 |
| --- | --- | --- |
| 身份 | 读 WHO\_AM\_I/ID | 与手册一致 |
| 配置回读 | 写后读回控制寄存器 | 值与写入一致 |
| 数据合理性 | 读值在物理量程内 | 不出现全 0/全 1 |
| 边界 | 越界寄存器/非法参数被拒 | 返回负 errno |
| 超时 | 忙时重试/降级 | 不阻塞系统 |



whoami.c 节选C

 

```text
u8 id; regmap_read(map, REG_WHOAMI, &id);
if (id != ID_EXPECT) return dev_err_probe(dev, -ENODEV, "id=0x%02x", id);
regmap_write(map, REG_CTRL, CTRL_EN);
u8 rb; regmap_read(map, REG_CTRL, &rb);
if (rb != CTRL_EN) return -EIO;   // 回读验证
```

先验身份、再回读验证配置——真实器件驱动的两条军规



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **不读 WHO\_AM\_I 就采数据** ：器件不在位/型号错仍继续。

- **忽略时序要求** ：手册规定的等待被省略，偶发失败。

- **把驱动绑死在一条总线** ：换 I²C/SPI 就要抄一遍。

- **不处理超时** ：器件忙时阻塞，拖垮系统。



◆ 自测 · Module 11（先答再看）




1. 写一个真实器件驱动，第一步应该做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"读数据手册、拿寄存器映射与总线/时序，并在 probe 里先读 WHO\\_AM\\_I 校验器件在位与型号。"}
   ```

2. 为什么用 regmap 而不是直接调总线 API？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"regmap 统一了 I²C/SPI 的寄存器访问与缓存策略，同一份驱动可跨总线复用，减少重复代码与差异处理。"}
   ```

3. 器件读值偶发不对，可能是什么原因？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"常见是时序（手册要求的等待/上电时序被省略）、总线模式不匹配、或未处理忙/超时。应对照手册时序逐项核对。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：挑一个你手上的器件，把它的寄存器映射与总线/子系统选择写成一张表，并实现 WHO\_AM\_I 校验。



核对与延伸：[Linux 内核文档 · IIO](https://www.kernel.org/doc/html/latest/driver-api/iio/index.html) · [Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html)

 

动手练习



结合 ` labs/host_bus.c `（寄存器访问）与 M07/M09 的子系统接入，完成一个器件驱动骨架。



**检查结果：** 能列出器件的寄存器映射、总线与子系统选择，并实现“读寄存器→校验→处理超时”的骨架。

 

迁移练习：把本章的“能从数据手册出发，用 regmap 与子系统框架写出一个真实器件的驱动骨架并处理错误/超时。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m11","criterion":"能列出器件的寄存器映射、总线与子系统选择，并实现“读寄存器→校验→处理超时”的骨架。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
