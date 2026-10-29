# 子系统：I²C / SPI

```zhizhan-anchor
m07
```



总线类驱动通过  **i2c\_client / spi\_device**  抽象访问器件：[I²C](term:i2c) 用“写寄存器地址再读数据”，SPI 用“片选 \+ 全双工传输”。` regmap ` 把寄存器读写统一起来，减少重复代码。

 

> 前置：Module 05/06 platform 与子系统资源。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 I²C/SPI 传输 API 与 regmap 写寄存器级器件驱动，并正确处理超时与错误。

 

本章速览




- I²C 读寄存器 = 写地址 \+ 读数据（两次传输）；SPI 模式必须与手册一致。

- regmap 统一寄存器读写，减少重复代码。

- dts 里 reg 地址必须与实际器件一致。

 

```zhizhan-anchor
m07-model
```



```zhizhan-anchor
m07-model-t
```



## 7.1 总线类驱动模型



I²C/SPI 器件通过总线控制器访问。内核把总线设备抽象成 ` i2c_client ` / ` spi_device `，驱动实现传输回调。` regmap ` 把“寄存器地址→值”的读写统一，同一份驱动可跑在 I²C 或 SPI 之上。



表 7.1 I²C/SPI 的关键点



| 总线 | 关键点 | 常见错误 |
| --- | --- | --- |
| I²C | 地址 7 位、时钟拉伸、超时 | 地址错/上拉缺失 |
| SPI | CPOL/CPHA、片选、字节序 | 模式不匹配 |
| regmap | 统一读写与缓存 | 缓存粒度/volatile 配错 |
| dts | 总线节点下挂设备 | reg= 地址与 dts 不符 |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：I²C 读寄存器是两次传输



I²C 读一个寄存器本质是“写寄存器地址 \+ 读数据”两次传输。下面把它与越界保护一起跑出来：



host\_bus.cC

 

```text
/* host_bus.c —— I2C 客户端读写传输模型（主机可运行）。
 * 读寄存器：先写寄存器地址（1 个消息），再读数据（1 个消息），共 2 次传输。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bus.c -o host_bus && ./host_bus
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>
typedef struct { uint8_t regs[8]; int xfers; } i2c_dev_t;
static int i2c_write_read(i2c_dev_t *d, uint8_t reg, uint8_t *out) {
    d->xfers++;                       /* msg1: 写寄存器地址 */
    if (reg >= 8) return -1;
    d->xfers++;                       /* msg2: 读数据 */
    *out = d->regs[reg];
    return 0;
}
static int i2c_write(i2c_dev_t *d, uint8_t reg, uint8_t val) {
    d->xfers++;
    if (reg >= 8) return -1;
    d->regs[reg] = val;
    return 0;
}
int main(void) {
    i2c_dev_t d; memset(&d, 0, sizeof(d)); d.regs[3] = 0x5A;
    int ok = 1; uint8_t v = 0;
    i2c_write(&d, 1, 0x11);
    if (i2c_write_read(&d, 3, &v) != 0 || v != 0x5A) ok = 0;
    printf("读 reg3=0x%02X（期望 0x5A），累计传输=%d（写1+读写2=3）\n", v, d.xfers);
    if (d.xfers != 3) ok = 0;
    printf("越界 reg=9 读: %d（期望 -1）\n", i2c_write_read(&d, 9, &v));
    if (i2c_write_read(&d, 9, &v) != -1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

I²C 寄存器读模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_bus.c -o labs/host_bus && ./labs/host_bus
读 reg3=0x5A（期望 0x5A），累计传输=3（写1+读写2=3）
越界 reg=9 读: -1（期望 -1）
RESULT: PASS
```



读寄存器用掉 2 次传输、写寄存器 1 次；越界寄存器被拒绝——这就是给器件写驱动的“访问契约”。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  I²C 读一个寄存器的两次传输



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="I²C 读一个寄存器的两次传输" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写地址+reg</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">重复START</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">读数据</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">STOP</text></svg>
```



START → 写从机地址 \+ 寄存器号 → 重复 START → 读从机地址 \+ 数据 → STOP。任何一步无应答都说明地址/器件/上拉有问题。



```zhizhan-anchor
m07-detail
```



```zhizhan-anchor
m07-detail-t
```



## 7.3 SPI 模式与 regmap



SPI 的 CPOL/CPHA 必须与器件手册一致，否则读回全 0/全 1。` regmap ` 用一份配置描述“寄存器宽度/值宽度/是否易变”，把 I²C/SPI 的差异屏蔽在总线层。



sensor\_regmap.c 节选C

 

```text
static const struct regmap_config cfg = {
    .reg_bits = 8, .val_bits = 8,
    .max_register = 0x7F,
    .volatile_reg = reg_volatile,   // 状态寄存器不缓存
};
regmap_write(map, REG_CTRL, 0x01);
regmap_read(map, REG_STATUS, &v);
// SPI 侧：spi->mode = SPI_MODE_0; 必须与器件手册一致
```

regmap 统一读写；SPI 模式必须匹配器件



表 7.2 SPI 四种模式



| SPI 模式 | CPOL | CPHA | 空闲电平/采样沿 |
| --- | --- | --- | --- |
| MODE\_0 | 0 | 0 | 低电平空闲，上升沿采样 |
| MODE\_1 | 0 | 1 | 低电平空闲，下降沿采样 |
| MODE\_2 | 1 | 0 | 高电平空闲，下降沿采样 |
| MODE\_3 | 1 | 1 | 高电平空闲，上升沿采样 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm07-routes\n```\n\n\n\n```zhizhan-anchor\nm07-routes-t\n```\n\n\n\n## 7.4 三条内核路线对照：总线控制器\n\n\n\n三条路线的 I²C/SPI 控制器驱动不同，但上层 i2c\\_client/spi\\_device 与 regmap 用法一致。\n\n\n\n表 7.3 三条路线的总线控制器\n\n\n\n| 内核路线 | I²C 控制器 | SPI 控制器 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | stm32-i2c | stm32-spi | mainline |\n| i.MX6ULL | imx-i2c | imx-spi/ecspi | BSP mainline |\n| V3s | mv64xxx-i2c | sun6i-spi | sunxi mainline |"}
````



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.5 I²C/SPI 自检



总线驱动排障先看“有没有应答、波形对不对、模式匹不匹配”：



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  总线驱动排障顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="总线驱动排障顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">设备应答?</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">传输成功?</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">数据正确?</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">查驱动逻辑</text></svg>
```



有没有设备（地址/上拉）→ 传输是否成功（无超时/NAK）→ 数据是否正确（模式/字节序）。按序排除，别直接怀疑驱动代码。



表 7.4 总线现象与原因



| 现象 | 多半原因 | 核查 |
| --- | --- | --- |
| 读全 0xFF | 地址错/无上拉/器件不在 | i2cdetect 扫地址 |
| SPI 读全 0/全 1 | CPOL/CPHA 错 | 对照手册模式 |
| 偶发 NAK | 总线速率过高/线长 | 降速/查上拉 |
| 值恒不变 | regmap 缓存了易变寄存器 | 标 volatile |



i2c\_tools.sh 节选Shell

 

```text
i2cdetect -y 1                 # 扫描总线上的器件地址
i2cget -y 1 0x68 0x00          # 读 WHO_AM_I
i2cdump -y 1 0x68              # dump 寄存器
spidev_test -D /dev/spidev0.0 -s 1000000   # SPI 环回测试
```

用 i2c-tools/spidev\_test 先证明“总线与器件通”



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.6 常见误区与排障



失败路径与排障




- **I²C 地址错** ：器件无应答，读全 0xFF。

- **缺上拉电阻** ：波形畸变、偶发失败。

- **SPI 模式不匹配** ：读回全 0/全 1。

- **regmap 缓存把易变寄存器缓存了** ：状态读不更新。



◆ 自测 · Module 07（先答再看）




1. I²C 读一个寄存器为什么是两次传输？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先用“写”传输把寄存器地址发给器件，再用“重复 START \\+ 读”取回数据。任何一步无应答都指向地址/器件/上拉问题。"}
   ```

2. SPI 读回全 0 或全 1，最可能是什么问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"多是 CPOL/CPHA（模式）与器件不匹配，采样沿错了；或片选/时钟没接对。"}
   ```

3. regmap 的价值是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把“寄存器宽度/值宽度/缓存策略/易变寄存器”等统一描述，同一份驱动可跑在 I²C 或 SPI 上，减少重复代码与总线差异处理。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用 regmap 抽象你项目里一个 I²C/SPI 器件驱动的寄存器访问，并把易变寄存器标为 volatile。



核对与延伸：[Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html) · [LWN · 并发与锁](https://lwn.net/Kernel/Index/#Locking)

 

动手练习



运行 ` labs/host_bus.c `：验证 I²C 读寄存器需要 2 次传输、越界寄存器被拒。



**检查结果：** 读 reg3=0x5A 且累计传输=3（写1 \+ 读写2）；越界 reg=9 读返回 -1。

 

迁移练习：把本章的“能用 I²C/SPI 传输 API 与 regmap 写寄存器级器件驱动，并正确处理超时与错误。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m07","criterion":"读 reg3=0x5A 且累计传输=3（写1 + 读写2）；越界 reg=9 读返回 -1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
