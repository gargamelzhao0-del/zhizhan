# MCU、MPU 与 SoC

```zhizhan-anchor
m01
```



同样一行读取代码，落在 SRAM、落在外设寄存器、落在未映射区，行为完全不同。本章不背名字，而是用三个硬指标（有没有 MMU、外设集成度、总线与地址映射）把 MCU / MPU / SoC 分开，并把“地址”还原成硬件上真实存在的区域与属性。

 

> 前置：会写 C、用过寄存器；知道“指针就是地址”。 · ◷ 约 42 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能区分 MCU/MPU/SoC，读懂一颗芯片的地址映射与总线层次，并把关键数据放在正确的存储上。

 

本章速览




- MCU/MPU/SoC 分界在 MMU、外设集成与总线。

- 地址映射与总线层次决定访问特性。

- 关键代码/数据放快存储。

 

```zhizhan-anchor
m01-criteria
```



```zhizhan-anchor
m01-criteria-t
```



## 1.1 三者的真实分界：不看名字，看三个硬指标



市面上把 MCU/MPU/SoC 讲成“小/中/大”，但这解释不了工程问题。真正决定代码行为的是三件事： **有没有 MMU（决定能否跑虚拟内存/通用 OS）** 、 **外设集成度（决定是否“一颗芯片全包”）** 、 **总线与地址映射（决定性能与访问合法性）** 。



表 1.1 MCU / MPU / SoC 的硬指标对比



| 硬指标 | MCU | MPU（微处理器单元） | SoC |
| --- | --- | --- | --- |
| MMU / 虚拟内存 | 无（可选 MPU 保护） | 有 | 通常有（多核） |
| 典型 OS | 裸机 / RTOS | Linux 等通用 OS | Linux / 异构 RTOS |
| 主存来源 | 片上 SRAM/Flash | 外挂 DDR | 多级 \+ 外挂 |
| 外设集成 | 高（GPIO/定时器/串口全带） | 低到中 | 高（含加速器/GPU/NPU） |
| 启动来源 | 内部 Flash / ROM | BootROM \+ 外部介质 | BootROM \+ 多介质 |



同一颗芯片可能跨类：带 MMU 的高端 MCU 也能跑 Linux；集成度高的 SoC 也带 RTOS 核。



这一章里“MPU”有两个意思



本章的  **MPU**  指  **Microprocessor Unit（微处理器单元）** ；在 [M05](doc:course-b18-m05#m05) 里  **MPU**  指  **Memory Protection Unit（内存保护单元）** 。两者缩写相同、含义完全不同，读到时先看上下文。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  一台 SoC 的内部“大陆板块”



```zhizhan-figure
<svg viewBox="0 0 800 190" width="100%" height="190" role="img" aria-label="一台 SoC 的内部“大陆板块”" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">0x0000_0000  Code / Flash（可映射别名）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">0x2000_0000  片上 SRAM</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">0x4000_0000  Peripheral（APB/AHB）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">0x6000_0000  External RAM / DDR</text><rect x="60" y="166" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="185.0" class="sv-lbl-hi">0xE000_0000  PPB（NVIC / SysTick / SCB）</text></svg>
```



按地址空间划分：Flash 放代码、SRAM 放数据、外设与内核私有外设 (PPB) 统一编址。越界访问未映射区 → 总线故障（fault），而不是返回 0。



```zhizhan-anchor
m01-map
```



```zhizhan-anchor
m01-map-t
```



## 1.2 统一编址：外设不过是“某个地址”



在 ARM Cortex-M / RISC-V 的片上系统里， **内存与外设共享同一地址空间** （memory-mapped I/O）。写外设寄存器就是写内存，区别只在于该区域被总线标成  **device / strong**  属性：不可缓存、不可重排、按序访问。



下面这段主机程序用一个简化但边界真实的 Cortex-M 地址映射，把任意地址译码成“区域 \+ 属性”，并顺手验证位带别名公式——这正是你 \`\*(volatile uint32\_t \*)0x40021018 = …\` 时硬件在做的事。



host\_memmap.cC

 

```text
/* host_memmap.c —— 地址空间 / 内存映射译码模型（主机可运行）
 * 用一个简化但真实的 Cortex-M 地址映射，把任意地址译码成「区域 + 属性」。
 * 演示：外设/内存统一编址、越界访问为何是"总线故障"、位带别名区落在哪。 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

typedef struct { uint32_t base, end; const char *name; const char *attr; int is_io; } region_t;

/* Cortex-M 参考地址映射（节选，真实边界值） */
static const region_t MAP[] = {
  {0x00000000u, 0x1FFFFFFFu, "Code/Flash (alias)", "RX, cached",   0},
  {0x20000000u, 0x200FFFFFu, "SRAM",               "RW, cached",   0},
  {0x22000000u, 0x23FFFFFFu, "Bit-band alias (SRAM)","RW, alias",  0},
  {0x40000000u, 0x400FFFFFu, "Peripheral (APB/AHB)","RW, device",  1},
  {0x42000000u, 0x43FFFFFFu, "Bit-band alias (Peri)","RW, alias",  0},
  {0x60000000u, 0x9FFFFFFFu, "External RAM",        "RW, cacheable",0},
  {0xE0000000u, 0xE00FFFFFu, "PPB (NVIC/SysTick)",  "RW, strong",   1},
  {0xE0040000u, 0xE00FFFFFu, "Debug/ROM table",     "RO, device",   1},
};
static const int NMAP = (int)(sizeof(MAP)/sizeof(MAP[0]));

static const region_t *decode(uint32_t a) {
  for (int i = 0; i < NMAP; i++)
    if (a >= MAP[i].base && a <= MAP[i].end) return &MAP[i];
  return NULL;                       /* 未映射 → 总线故障 */
}

int main(void) {
  const uint32_t probes[] = {
    0x08000100u, 0x20000010u, 0x20000020u + 0x02000000u, /* 位带别名 */
    0x40021018u, 0xE000E010u, 0x50000000u /* 保留区，未映射 */
  };
  int ok = 1;
  printf("地址        区域                   属性             IO\n");
  for (size_t i = 0; i < sizeof(probes)/sizeof(probes[0]); i++) {
    const region_t *r = decode(probes[i]);
    if (r) printf("0x%08X  %-22s %-15s %s\n", probes[i], r->name, r->attr, r->is_io ? "yes" : "no");
    else   printf("0x%08X  %-22s %-15s %s\n", probes[i], "UNMAPPED (fault)", "-", "-");
  }
  /* 断言：位带别名 = base + 0x2000000 + (addr-0x20000000)*32 + bit*4 */
  uint32_t sram = 0x20000020u, alias_expect = 0x22000000u + ((sram - 0x20000000u) * 32u) + 0u;
  printf("位带别名公式: 0x%08X -> 0x%08X (%s)\n", sram, alias_expect,
         decode(alias_expect) && strstr(decode(alias_expect)->name, "Bit-band") ? "hit" : "miss");
  if (alias_expect != 0x22000400u) ok = 0;
  if (!decode(0x40021018u) || !decode(0x40021018u)->is_io) ok = 0;
  if (decode(0x50000000u) != NULL) ok = 0;           /* 必须判为未映射 */
  printf("SRAM/外设/未映射判定: %s\n", ok ? "OK" : "BAD");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
```

地址译码 \+ 位带别名（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_memmap.c -o labs/host_memmap && ./labs/host_memmap
地址        区域                   属性             IO
0x08000100  Code/Flash (alias)     RX, cached      no
0x20000010  SRAM                   RW, cached      no
0x22000020  Bit-band alias (SRAM)  RW, alias       no
0x40021018  Peripheral (APB/AHB)   RW, device      yes
0xE000E010  PPB (NVIC/SysTick)     RW, strong      yes
0x50000000  UNMAPPED (fault)       -               -
位带别名公式: 0x20000020 -> 0x22000400 (hit)
SRAM/外设/未映射判定: OK
RESULT: PASS
```



0x40021018 与 0xE000E010 被标为 IO/device —— 访问它们走的是外设总线，不是访问 SRAM 的路径。



位带（Bit-band）别名的公式



SRAM 位带区 0x2000\_0000 的任意位，都在别名区 0x2200\_0000 有一个“一个字控制一位”的映射：  
` alias = 0x22000000 + (addr-0x20000000)*32 + bit*4 `。外设区同理，基址 0x4200\_0000。这让“原子置位/清位”可以用一次普通写完成。



表 1.2 区域属性决定了“同一行代码为什么快慢不同”



| 区域 | 典型地址 | 总线/属性 | 访问代价 |
| --- | --- | --- | --- |
| Flash | 0x0800\_0000 | I-Code / 可缓存 | 有等待周期（取决于主频） |
| SRAM | 0x2000\_0000 | D-Bus / 可缓存 | 通常 0 等待（单周期） |
| 外设 | 0x4000\_0000 | APB/AHB / device | 多周期、按序、不可重排 |
| PPB | 0xE000\_0000 | System / strong | 内核私有，不可缓存 |
| 未映射 | 保留区 | — | 总线故障（fault） |



```zhizhan-anchor
m01-bus
```



```zhizhan-anchor
m01-bus-t
```



## 1.3 总线与互联：AHB / APB / AXI 决定“快不快”



核心并不是直接连外设，而是通过 **总线矩阵/bus fabric** 访问不同的从设备。高速的走 AHB/AXI（可接 Flash、SRAM、[DMA](term:dma)），低速外设挂在 APB 上（UART/定时器），一次跨总线访问的代价远高于一次片上 SRAM 访问。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  一次访存要经过的总线层次



```zhizhan-figure
<svg viewBox="0 0 800 180" width="100%" height="180" role="img" aria-label="一次访存要经过的总线层次" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">CPU Core（取指/访存）</text><rect x="60" y="64" width="680" height="37" rx="6" class="sv-box"></rect><text x="75" y="86.6" class="sv-lbl-hi">Bus Matrix / Interconnect（AHB / AXI 多层）</text><rect x="60" y="105" width="680" height="37" rx="6" class="sv-grn-s"></rect><text x="75" y="127.7" class="sv-lbl-hi">Fast：TCM / SRAM / Flash 控制器</text><rect x="60" y="146" width="680" height="37" rx="6" class="sv-amb-s"></rect><text x="75" y="168.9" class="sv-lbl-hi">Slow：APB 外设（UART/TIM/I2C）</text></svg>
```



核 → 总线矩阵 → 从设备。把热点数据/代码放在快的存储（TCM/SRAM）上是第一位的性能优化；跨总线访问（如 APB 外设）付出的是多周期与不可重排的代价。



表 1.3 总线分层与访问代价



| 总线 | 定位 | 典型从设备 | 相对代价 |
| --- | --- | --- | --- |
| AHB / AXI | 高带宽、可流水 | Flash/SRAM/DMA/GPU | 低 |
| APB | 低功耗、简单 | UART/I2C/SPI/定时器 | 高（多周期） |
| TCM (ITCM/DTCM) | 紧耦合、零等待 | 关键代码/栈 | 最低（旁路缓存） |
| PPB | 内核私有 | NVIC/SysTick/SCB | 低但强序 |



TCM 的意义



紧耦合存储 (TCM) 直连内核， **无 cache 命中不确定性** 。把中断服务程序、实时控制回路放进 TCM/ITCM，抖动和延迟都更可控。这与 [M04](doc:course-b18-m04#m04) 的局部性优化是同一目标。



```zhizhan-anchor
m01-boot
```



```zhizhan-anchor
m01-boot-t
```



## 1.4 启动与向量表：第一条指令从哪来



复位后内核从 **向量表第 0、1 项** 取初始 SP 与复位入口。向量表可以放在 Flash，也可以被重定位（` SCB->VTOR `）到 RAM，以支持 bootloader / 固件升级与动态中断向量。



表 1.4 常见启动来源



| 启动来源 | 地址来源 | 能否重定位 | 典型场景 |
| --- | --- | --- | --- |
| 内部 Flash | 固定基址 | VTOR 可改 | 量产固件 |
| BootROM | 出厂固化 | — | 安全启动 / 进入下载模式 |
| 外部介质 | BootROM 搬运 | — | SoC / 大容量应用 |
| RAM 运行 | 由加载器拷贝 | VTOR 指向 RAM | bootloader 跳转 |



startup\_vector.sASM

 

```text
.section .isr_vector
  .word  _estack        @ 0x00 初始 SP
  .word  Reset_Handler  @ 0x04 复位入口
  .word  NMI_Handler
  .word  HardFault_Handler
  ...
  .word  SysTick_Handler
```

向量表前两项固定是“栈顶”和“复位入口”



VTOR 重定位的两行代码



把向量表搬到 0x2000\_0000：  
` extern uint32_t _isr_vector[]; SCB->VTOR = (uint32_t)_isr_vector & ~0x7F; `（低 7 位须为 0）。改完记得 ` __DSB(); __ISB(); ` 让流水线看到新表。



```zhizhan-anchor
m01-layout
```



```zhizhan-anchor
m01-layout-t
```



## 1.5 用结构体映射寄存器：对齐与填充的真实代价



把一组连续寄存器映射成结构体时， **编译器会在字段之间插入填充** 以满足对齐，让“结构体布局”和“硬件寄存器偏移”悄悄错位。下面是主机上真实打印出来的偏移：



host\_layout.cC

 

```text
/* host_layout.c —— 对齐 / 填充 / 寄存器块布局（主机可运行）
 * 用 offsetof 打印真实字段偏移，说明"结构体映射寄存器"时的填充陷阱与 cache line 对齐。 */
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>

typedef struct { volatile uint32_t CR; volatile uint32_t SR; volatile uint16_t ID; } regs_c;       /* 自然对齐 */
typedef struct __attribute__((packed)) { volatile uint32_t CR; volatile uint32_t SR; volatile uint16_t ID; } regs_p;

typedef struct { uint8_t tag; uint32_t val; uint8_t flag; } s_nat;
typedef struct __attribute__((packed)) { uint8_t tag; uint32_t val; uint8_t flag; } s_pk;

typedef struct __attribute__((aligned(64))) { uint32_t head; uint32_t data[8]; } aligned64;

int main(void) {
  int ok = 1;
  printf("regs_c   : sizeof=%zu  自然对齐（ID 后填充 2 字节）\n", sizeof(regs_c));
  printf("  offsetof CR=%zu SR=%zu ID=%zu\n", offsetof(regs_c, CR), offsetof(regs_c, SR), offsetof(regs_c, ID));
  printf("regs_p   : sizeof=%zu  packed（无填充；非对齐访问可能触发陷阱）\n", sizeof(regs_p));
  printf("s_nat    : sizeof=%zu  tag@0 val@4 flag@8 -> 填充到 12\n", sizeof(s_nat));
  printf("  offsetof tag=%zu val=%zu flag=%zu\n", offsetof(s_nat, tag), offsetof(s_nat, val), offsetof(s_nat, flag));
  printf("s_pk     : sizeof=%zu  packed 紧凑但 val 非对齐\n", sizeof(s_pk));
  printf("aligned64: sizeof=%zu  alignof=%zu  (cache line 对齐)\n",
         sizeof(aligned64), (size_t)_Alignof(aligned64));

  if (sizeof(regs_c) != 12) ok = 0;
  if (sizeof(regs_p) != 10) ok = 0;
  if (offsetof(regs_c, ID) != 8) ok = 0;
  if (offsetof(s_nat, val) != 4) ok = 0;
  if (sizeof(s_pk) != 6) ok = 0;
  if (_Alignof(aligned64) != 64) ok = 0;
  printf("对齐/填充断言: %s\n", ok ? "OK" : "BAD");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
```

offsetof / sizeof / 对齐（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_layout.c -o labs/host_layout && ./labs/host_layout
regs_c   : sizeof=12  自然对齐（ID 后填充 2 字节）
  offsetof CR=0 SR=4 ID=8
regs_p   : sizeof=10  packed（无填充；非对齐访问可能触发陷阱）
s_nat    : sizeof=12  tag@0 val@4 flag@8 -> 填充到 12
  offsetof tag=0 val=4 flag=8
s_pk     : sizeof=6  packed 紧凑但 val 非对齐
aligned64: sizeof=64  alignof=64  (cache line 对齐)
对齐/填充断言: OK
RESULT: PASS
```



regs\_c 里 uint16 ID 后面被填充 2 字节，所以 sizeof=12 而不是 10。



packed 是把双刃剑



` __attribute__((packed)) ` 能对齐硬件偏移，但会让字段非对齐：在 Cortex-M0 等不支持非对齐访问的核上， **读一个 packed 的 uint32 会触发 HardFault** 。正确做法是： **用 uint32\_t 字段 \+ 显式保留位** 让布局天然对齐，而不是靠 packed 硬压。



```zhizhan-anchor
m01-mmio
```



```zhizhan-anchor
m01-mmio-t
```



## 1.6 外设寄存器的正确访问：读改写 (RMW) 的陷阱



外设寄存器常是“多位共享一个字”：一个位是使能，几位是模式，几位是状态。如果两个中断源（或线程）都对同一寄存器做  **读→改→写** ，就会互相覆盖——丢失更新。下面这段主机程序把整个竞态“跑出来”给你看：



host\_mmio.cC

 

```text
/* host_mmio.c —— 外设寄存器访问模式：读改写(RMW)竞态 vs 位带原子位操作（主机可运行）。
 * 模型：一个"控制寄存器"被两个"中断源"并发修改；RMW 会丢失更新，原子位操作不会。 */
#include <stdio.h>
#include <stdint.h>

#define EN_BIT 0u
#define MODE_SHIFT 4u
#define MODE_MASK  (0x3u << MODE_SHIFT)

static uint32_t ctrl_reg;                 /* 模拟外设控制寄存器 */
static void atomic_set_bit(uint32_t bit) { ctrl_reg |=  (1u << bit); }   /* 位带式置位 */
static void atomic_clr_bit(uint32_t bit) { ctrl_reg &= ~(1u << bit); }   /* 位带式清位 */

int main(void) {
  int ok = 1;
  /* 场景 A：写者1 用 RMW，写者2 在中间置 EN —— 更新丢失 */
  ctrl_reg = 0;
  uint32_t t1 = ctrl_reg;                               /* 写者1 读 */
  atomic_set_bit(EN_BIT);                               /* 写者2 置 EN（并发发生） */
  t1 = (t1 & ~MODE_MASK) | (1u << MODE_SHIFT);          /* 写者1 改（基于旧值） */
  ctrl_reg = t1;                                        /* 写者1 写回 → 覆盖掉 EN */
  printf("A: MODE=%u EN=%u  (RMW 把 EN 覆盖为 0)\n",
         (ctrl_reg & MODE_MASK) >> MODE_SHIFT, ctrl_reg & 1u);
  if ((ctrl_reg & 1u) != 0) ok = 0;                     /* 期望：EN 丢失 */

  /* 场景 B：两个写者都用原子位操作，各碰各的位，互不覆盖 */
  ctrl_reg = 0;
  atomic_set_bit(EN_BIT);                               /* 写者1 置 EN */
  atomic_clr_bit(EN_BIT); atomic_set_bit(EN_BIT);       /* 写者2 反复碰同一位也不影响 MODE */
  ctrl_reg = (ctrl_reg & ~MODE_MASK) | (2u << MODE_SHIFT);
  printf("B: MODE=%u EN=%u  (原子位操作不丢更新)\n",
         (ctrl_reg & MODE_MASK) >> MODE_SHIFT, ctrl_reg & 1u);
  if ((ctrl_reg & 1u) != 1 || ((ctrl_reg & MODE_MASK) >> MODE_SHIFT) != 2u) ok = 0;

  printf("结论: 共享寄存器用 RMW 会被并发覆盖; 应改用位带/BSRR 原子位操作或临界区\n");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
```

RMW 竞态 vs 原子位操作（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_mmio.c -o labs/host_mmio && ./labs/host_mmio
A: MODE=1 EN=0  (RMW 把 EN 覆盖为 0)
B: MODE=2 EN=1  (原子位操作不丢更新)
结论: 共享寄存器用 RMW 会被并发覆盖; 应改用位带/BSRR 原子位操作或临界区
RESULT: PASS
```



场景 A 中写者1 基于旧值写回，把写者2 刚置的 EN 位抹掉——这就是“偶发丢配置”的根源。



表 1.5 共享寄存器的五种访问模式



| 访问模式 | 代码形态 | 并发安全 | 适用 |
| --- | --- | --- | --- |
| 直接赋值 | ` REG = v; ` | 只写整字时安全 | 复位/独占初始化 |
| 读改写 (RMW) | ` REG = (REG&~M)\|x; ` | 不安全（丢更新） | 单写者顺序场景 |
| 位带 / BSRR | ` REG \|= bit; ` / BSRR | 安全（只碰目标位） | 共享位操作 |
| 临界区 | 关中断 / 自旋锁 | 安全 | 复合更新 |
| 读改写 \+ 关中断 | 临界区内 RMW | 安全 | 多字段原子更新 |



```zhizhan-anchor
fig-图-1-3
```



**图 1.3**  一个控制寄存器的位分工与“谁能安全碰谁”



```zhizhan-figure
<svg viewBox="0 0 800 110" width="100%" height="110" role="img" aria-label="一个控制寄存器的位分工与“谁能安全碰谁”" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">位 0</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">位 4–5</text><text x="405" y="24" text-anchor="middle" class="sv-lbl-dim">位 8</text><text x="515" y="24" text-anchor="middle" class="sv-lbl-dim">位 16–31</text><text x="12" y="50" class="sv-lbl">字段</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">EN</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">MODE</text><rect x="378" y="38" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="425" y="53" text-anchor="middle" class="sv-lbl-hi">IE</text><rect x="488" y="38" width="94" height="22" rx="4" class="sv-box"></rect><text x="535" y="53" text-anchor="middle" class="sv-lbl-hi">保留</text><text x="12" y="78" class="sv-lbl">安全动法</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">位操作</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">临界区</text><rect x="378" y="66" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="425" y="81" text-anchor="middle" class="sv-lbl-hi">位操作</text><rect x="488" y="66" width="94" height="22" rx="4" class="sv-box"></rect><text x="535" y="81" text-anchor="middle" class="sv-lbl-hi">勿动</text></svg>
```



把字拆成字段后：独立位可用位带/BSRR 原子操作；多个字段要一起改时，必须放进临界区做一次 RMW，否则并发写会互相覆盖。



为什么“位带/BSRR”安全



它们把“读-改-写”压成 **硬件的一次原子写** ：位带别名区一字控一位，STM32 的 BSRR 寄存器写 1 到某位即置位、写另一个半字即清位。硬件保证只影响目标位，天然免疫丢更新。



```zhizhan-anchor
m01-link
```



```zhizhan-anchor
m01-link-t
```



## 1.7 把固件放到正确的地址：链接视角



地址映射不是“记住就行”，它是你写链接脚本时 **显式分配** 的。下面是一段真实的 memory 区与段落分配：代码进 Flash、初值数据“住在 Flash、跑在 RAM”、清零数据只占 RAM、栈与堆单独立区。



memory.ld 节选LD

 

```text
MEMORY {
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 128K
}
SECTIONS {
  .text  : { *(.text*) *(.rodata*) } > FLASH          /* 代码/常量 → Flash */
  .data  : { *(.data*) } > RAM AT > FLASH             /* 初值在 Flash，运行在 RAM */
  .bss   : { *(.bss*)  *(COMMON) } > RAM             /* 零初始化，只占 RAM */
  .stack : { . = 4K; _estack = .; } > RAM             /* 栈顶符号 */
}
```

AT \> FLASH 表示该段的“运行地址在 RAM、加载地址在 Flash”——启动代码负责从 Flash 拷到 RAM



表 1.6 段的运行地址 vs 加载地址



| 段 | 运行地址 | 加载地址 | 启动时动作 | 典型内容 |
| --- | --- | --- | --- | --- |
| .text / .rodata | Flash | Flash | 原地执行 | 代码、常量表 |
| .data | RAM | Flash | 从 Flash 拷贝到 RAM | 有初值的全局变量 |
| .bss | RAM | — | 清零 | 未初始化/零初始化变量 |
| .stack | RAM | — | 初始化 SP | 调用栈、局部变量 |
| .heap | RAM | — | 按需 | malloc（慎用，见 B01 M04） |



一句话记住 .data 的“两个地址”



带初值的全局变量在运行时住在 RAM，但初值必须是掉电不丢的，所以初值被放在 Flash（加载地址）。复位后 ` Reset_Handler ` 要先把它从 Flash 搬到 RAM，再把 ` .bss ` 清零， **然后才调 ` main `** 。这也解释了“为什么全局变量初值不是零、而 .bss 是零”。



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.8 常见误区与排障



失败路径与排障




- **把“MPU”当同一个东西** ：微处理器单元 ≠ 内存保护单元（见 1.1 提示框）。

- **误访问未映射地址** ：不是返回 0，而是总线故障（fault）；调试时先查地址是否在映射内。

- **把热点代码/数据放在慢存储** ：跨总线访问让实时性变差，优先放 TCM/SRAM。

- **忽略结构体填充** ：寄存器偏移错位 → 写到相邻寄存器，现象诡异难查。

- **认为“主频高就一定快”** ：访存与总线层次常才是瓶颈（见 [M09](doc:course-b18-m09#m09)）。



◆ 自测 · Module 01（先答再看）




1. MCU 与 MPU（微处理器单元）最关键的一个区别是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"MPU 通常带  **MMU** ，可跑虚拟内存与通用 OS（如 Linux）；MCU 一般无 MMU，外设直接映射到地址空间，跑裸机/RTOS。判据是“有没有 MMU”，不是芯片大小。"}
   ```

2. 为什么访问 0x4002\_1018 与访问 0x2000\_0010“同一行 C 代码”代价不同？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它们落在不同区域：0x4002\\_1018 是  **外设区（device 属性）** ，走 APB/AHB，多周期、按序、不可重排；0x2000\\_0010 是  **SRAM（可缓存）** ，通常单周期。区域属性决定代价，而不是 C 语法。"}
   ```

3. \`struct { uint32\_t CR; uint32\_t SR; uint16\_t ID; }\` 的 sizeof 为什么是 12 而不是 10？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"为满足 4 字节对齐，编译器在 ID 之后插入  **2 字节填充** ，使结构体大小成为对齐的整数倍（12）。若用 packed 强行压到 10，则 ID 之后非对齐可能触发陷阱。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把本章的“地址映射译码”用到你自己的芯片：画出你常访问的 5 个地址各落在哪个区域、属性是什么，并说明其中一个为什么是性能热点。



核对与延伸：[ARM Cortex-M 文档](https://developer.arm.com/documentation/) · [Arm 内存序与屏障](https://developer.arm.com/documentation/100941/latest/)

 

动手练习



运行 ` labs/host_memmap.c `：把一串地址译码成“区域 \+ 属性”；再运行 ` labs/host_layout.c ` 看寄存器结构体的真实填充。



**检查结果：** 译码表中 0x40021018 判为外设(IO, RW/device)、0x50000000 判为 UNMAPPED；位带别名公式 0x20000020→0x22000400；结构体 regs\_c=12B、packed=10B。

 

迁移练习：把本章的“能区分 MCU/MPU/SoC，读懂一颗芯片的地址映射与总线层次，并把关键数据放在正确的存储上。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m01","criterion":"译码表中 0x40021018 判为外设(IO, RW/device)、0x50000000 判为 UNMAPPED；位带别名公式 0x20000020→0x22000400；结构体 regs_c=12B、packed=10B。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
