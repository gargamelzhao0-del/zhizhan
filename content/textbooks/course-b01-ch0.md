# 嵌入式 C 的世界观

```zhizhan-anchor
ch0
```



同样叫 C 语言，写桌面程序和写单片机，面对的是两个物理规则不同的世界。 在开始啃语法细节之前，先把"这个世界有哪些约束"讲清楚——后面所有的技巧，本质上都是对这些约束的应对。

 

> ◷ 约 50 分钟 · ◈ 无需硬件即可阅读 · ⚑ 建立心智模型

 

```zhizhan-anchor
ch0-1
```



## 0.1 同一个 C，两个世界

 

先看一段代码。这段代码在 PC 上和 STM32 上，行为完全不同：

 

two\_worlds.c C

 

```text
#include <stdio.h>

int main(void)
{
    char buf[1024 * 1024];      /* 1 MB 局部数组 */
    buf[0] = 42;
    printf("%d\n", buf[0]);
    return 0;
}
```

 

在 PC 上：编译通过，运行正常。1 MB 的栈空间，Linux 默认给你 8 MB，绰绰有余。

 

在 STM32F103 上： **编译链接阶段就可能报错** ，或者链接过去了，一运行就进 HardFault。 因为 F103C8T6 总共只有  **20 KB SRAM** ，其中栈默认只有 1 KB。

 

**FIG 0.1**  同一个程序的两种命运

 

```zhizhan-figure
<svg viewBox="0 0 660 250" width="660" height="250" role="img" aria-label="桌面环境与嵌入式环境的资源对比">
          <defs>
            <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
            <marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path>
            </marker>
          </defs>

          <text x="140" y="24" text-anchor="middle" class="sv-lbl-hi">桌面 C 世界</text>
          <text x="140" y="42" text-anchor="middle" class="sv-lbl-dim">Linux / Windows · x86-64</text>
          <rect x="30" y="56" width="220" height="160" rx="8" class="sv-box"></rect>
          <text x="48" y="80" class="sv-lbl-dim">RAM 可用</text>
          <rect x="48" y="88" width="184" height="14" rx="3" fill="var(--grn)" opacity=".85"></rect>
          <text x="48" y="122" class="sv-lbl-dim">栈默认</text>
          <rect x="48" y="130" width="92" height="14" rx="3" fill="var(--cyn)" opacity=".7"></rect>
          <text x="48" y="164" class="sv-lbl-dim">OS 保护</text>
          <text x="48" y="182" class="sv-lbl" style="fill:var(--grn)">MMU 隔离 · 段错误可捕获</text>
          <text x="48" y="202" class="sv-lbl-dim">8 GB · 8 MB · 有兜底</text>

          <text x="500" y="24" text-anchor="middle" class="sv-lbl-hi">嵌入式 C 世界</text>
          <text x="500" y="42" text-anchor="middle" class="sv-lbl-dim">STM32F103 · Cortex-M3</text>
          <rect x="390" y="56" width="220" height="160" rx="8" class="sv-box" stroke="var(--amb)"></rect>
          <text x="408" y="80" class="sv-lbl-dim">SRAM 总量</text>
          <rect x="408" y="88" width="26" height="14" rx="3" fill="var(--amb)" opacity=".9"></rect>
          <text x="442" y="99" class="sv-lbl" style="fill:var(--amb)">20 KB（整机）</text>
          <text x="408" y="122" class="sv-lbl-dim">栈默认</text>
          <rect x="408" y="130" width="5" height="14" rx="2" fill="var(--red)"></rect>
          <text x="421" y="141" class="sv-lbl" style="fill:var(--red)">1 KB</text>
          <text x="408" y="166" class="sv-lbl-dim">无 MMU 保护</text>
          <text x="408" y="184" class="sv-lbl" style="fill:var(--red)">越界 = 静默踩内存</text>
          <text x="408" y="203" class="sv-lbl-dim">出错即 HardFault / 死机</text>

          <path d="M 258 136 L 382 136" stroke="var(--line-2)" stroke-width="1.4" stroke-dasharray="5 5"></path>
          <text x="320" y="128" text-anchor="middle" class="sv-lbl-dim">同一份源码</text>
          <text x="320" y="152" text-anchor="middle" class="sv-lbl" style="fill:var(--red)">1 MB &gt; 20 KB</text>
        </svg>
```

 

桌面环境的默认假设是"资源充沛 \+ OS 兜底"；嵌入式环境的默认假设是"资源以 KB 计 \+ 没有任何兜底"。 这个差异不是程度问题，是 **性质问题** ——它决定了你能不能用 ` malloc `、能不能写递归、能不能随意开大数组。

 

```zhizhan-anchor
ch0-1-1
```



### 0.1.1 五个必须内化的差异

 

| 维度 | 桌面 C | 嵌入式 C |
| --- | --- | --- |
| **内存** | 虚拟内存，进程隔离，8 GB 起步 | 物理地址直连，几个 KB 到几 MB，地址即硬件 |
| **程序运行期** | ` main ` 返回 → 进程结束 | **永不退出** 。` main ` 返回意味着死机（或复位） |
| **时序** | 慢一点无所谓，用户感知不到 | 中断响应晚 10 μs 可能丢数据、炸电机 |
| **错误处理** | 抛异常、打日志、重启进程 | 没人看日志。 **正确性必须靠设计保证** ，不是靠事后调试 |
| **硬件交互** | 通过 OS 系统调用，抽象层很厚 | 直接读写物理地址， *编译器优化会破坏硬件协议* |

 

⚠ 最容易踩的一条：编译器不知道硬件存在

 

这是全书反复出现的主线。编译器只保证"在抽象机器语义下结果一致"，它会自由地消除、合并、重排你的内存访问。 但外设寄存器 **不是普通内存** ：读一次 UART 数据寄存器会清空标志位，写一次 GPIO 会立刻改变引脚电平。 编译器不知道这些副作用，于是它会把你的两次读"优化"成一次——程序逻辑就废了。  **这就是 ` volatile ` 存在的全部意义** （详见模块 02）。

 

```zhizhan-anchor
ch0-1-2
```



### 0.1.2 那 1 KB 栈到底是从哪来的

 

"栈默认只有 1 KB"这个数字 **不是硬件规定** ，而是工程模板里写死的一个常量。而且这里有个极易混淆的点——  **Keil MDK 和 GCC 两套工具链的栈机制完全不同** ：一个是真的只给 1 KB，另一个只是"保证至少留 1 KB"。 如果你在两种工程之间来回切换，这个区别会直接影响你对"栈够不够用"的判断。

 

| 问题 | Keil MDK（ARMCC / ARMCLANG） | GCC · STM32CubeIDE |
| --- | --- | --- |
| **写在哪** | ` startup_stm32f103xb.s ` 启动汇编文件 | ` STM32F103C8Tx_FLASH.ld ` 链接脚本 |
| **栈大小** | ` Stack_Size EQU 0x00000400 `（= 1 KB，常量） | ` _Min_Stack_Size = 0x400 `（= 1 KB， *下限* ） |
| **栈顶地址** | ` __initial_sp `，紧跟 ` SPACE Stack_Size ` 之后 | ` _estack = ORIGIN(RAM) + LENGTH(RAM) `，SRAM 最高地址 |
| **向量表 \[0\]** | ` DCD __initial_sp ` | ` .word _estack ` |
| **性质** | **硬上限** ：就是 1 KB，用超了直接撞坏相邻内存 | **软下限** ：链接器只保证"至少留 1 KB"，栈实际能用的空间是这一整段 |
| **怎么改** | 改 ` Stack_Size ` 常量，重新编译 | 改链接脚本里的 ` _Min_Stack_Size ` |

 

Keil 的做法非常直白——在 RAM 里 **真的划出** 一块 1024 字节的区域当栈：

 

startup\_stm32f103xb.s — Keil MDK 版（节选） ASM

 

```text
Stack_Size      EQU     0x00000400          ; 1024 字节 = 1 KB

                AREA    STACK, NOINIT, READWRITE, ALIGN=3
Stack_Mem       SPACE   Stack_Size
__initial_sp                                ; 栈顶 = SPACE 结束后的地址

                AREA    RESET, DATA, READONLY
                EXPORT  __Vectors
__Vectors       DCD     __initial_sp        ; 向量表[0]：复位后的初始 SP
                DCD     Reset_Handler       ; 向量表[1]：复位入口
```

 

GCC 的做法是 **反过来** ：把栈顶钉在 RAM 的最高地址，然后只在链接期检查"RAM 里还剩没剩下 1 KB 可用"：

 

STM32F103C8Tx\_FLASH.ld — CubeIDE 生成（节选） LD

 

```text
/* F103C8T6：Flash 64 KB @ 0x08000000，RAM 20 KB @ 0x20000000 */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 64K
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 20K
}

_estack = ORIGIN(RAM) + LENGTH(RAM);   /* = 0x20000000 + 0x5000 = 0x20005000 */

_Min_Heap_Size  = 0x200;               /* 堆：512 字节（0x200） */
_Min_Stack_Size = 0x400;               /* 栈：1 KB —— 注意只是"至少" */

SECTIONS
{
  /* ... .isr_vector / .text / .data / .bss 等段 ... */

  ._user_heap_stack :
  {
    . = ALIGN(8);
    PROVIDE ( end = . );
    PROVIDE ( _end = . );
    . = . + _Min_Heap_Size;
    . = . + _Min_Stack_Size;           /* 把地址往上推 1 KB，仅此而已 */
    . = ALIGN(8);
  } >RAM
}
```

 

◆ 两种机制，同一个物理事实

 

不管哪种写法， **栈在硬件上的行为完全一样** ：STM32 的栈是 **满递减** （Full Descending）的—— ` SP ` 始终指向最后一个已入栈的元素，每次压栈先减地址再写入，所以 **栈是向低地址方向生长的** 。

 

这就决定了一件很反直觉的事： **栈溢出不会"往上撞到 Flash"，而是向下撞进你自己的 ` .data ` / ` .bss `** 。 于是现象往往不是"进 HardFault"，而是"某个全局变量莫名其妙被改了""标志位自己翻转了"。 这正是嵌入式调试里最费时间的一类 bug，模块 04 会讲怎么用链接脚本和栈填充图案把它抓出来。

 

```zhizhan-anchor
ch0-1-3
```



### 0.1.3 HardFault 不是黑箱：它留下了完整现场

 

栈撞坏数据之后，CPU 迟早会执行到一条非法指令、或访问一个非法地址，然后跳进 ` HardFault_Handler `。 绝大多数人到这一步只会写一个 ` while (1); `，然后开始凭感觉猜。事实上 **内核已经把全部证据都保存好了** ， 只是默认配置把证据藏起来了。

 

◆ 关键事实：三类可配置故障默认全部关闭

 

Cortex-M 有三类"可配置优先级"的故障—— **MemManage** （内存保护违规）、 **BusFault** （总线错误）、 **UsageFault** （用法错误）。 控制它们的开关在 ` SHCSR `（地址 ` 0xE000ED24 `）的第 16/17/18 位，而 **这三位的复位值都是 0** 。 开关关着意味着：这些故障 **无法走自己的异常入口，会被内核强制升级成 HardFault** 。 所以你看到的 HardFault，绝大多数其实是"真正的凶手被顶替了"——真凶是谁，要靠 ` CFSR ` 里的位来还原。

 

在 ` main() ` 最开始打开这三个开关，故障就会被分流到各自的 handler，定位难度立刻下降一个数量级：

 

fault\_init.c — 让故障说实话 C

 

```text
#include <stdint.h>
#include "stm32f103xb.h"        /* 提供 SCB / SCB_SHCSR_*_Msk 定义 */

static void fault_init(void)
{
    /* ① 打开三个故障分流开关（复位值全 0，即默认全关） */
    SCB->SHCSR |= SCB_SHCSR_MEMFAULTENA_Msk    /* bit16 MemManage */
                | SCB_SHCSR_BUSFAULTENA_Msk    /* bit17 BusFault  */
                | SCB_SHCSR_USGFAULTENA_Msk;   /* bit18 UsageFault */

    /* ② 除以零默认【不】报错，必须单独打开（CCR bit4） */
    SCB->CCR |= SCB_CCR_DIV_0_TRP_Msk;

    /* ③ 让非对齐访问也上报（可选，调试期很有用，CCR bit3） */
    /* SCB->CCR |= SCB_CCR_UNALIGN_TRP_Msk; */
}
```

 

打开之后，真正的现场在 ` CFSR `（Configurable Fault Status Register，地址 ` 0xE000ED28 `）里。 它是一个 32 位寄存器，但被切成三段， **每段对应一类故障** ——这也是为什么手册里同时出现 MMFSR / BFSR / UFSR 三个名字。 下表只列实践中最常见的位。

 

⚠ 两套位号别搞混：子寄存器相对位 vs CFSR 绝对位

 

手册在"分段看"时写 ` BFSR.b1 `，那是 **把它当成独立 8 位寄存器** 来数的位号； 而你 **代码里读的是拼接后的整个 ` SCB->CFSR `** ，位号要加上这一段的段偏移： ` MMFSR ` = CFSR\[7:0\]（偏移 0）、` BFSR ` = CFSR\[15:8\]（ **偏移 \+8** ）、 ` UFSR ` = CFSR\[31:16\]（ **偏移 \+16** ）。 所以 ` BFSR.b1 PRECISERR ` 在 CFSR 里是  **bit 9** ——写成 ` cfsr & (1u << 1) ` 就全错了。下表两列都给出来，对照着用。

 

| 子寄存器 · 位 | CFSR 位 | 含义 | 最可能的原因 |
| --- | --- | --- | --- |
| MMFSR.b4 MSTKERR | bit 4 | 异常 **入栈** 时出错 | **栈已经溢出** ——最经典的溢出信号 |
| MMFSR.b3 MUNSTKERR | bit 3 | 异常 **返回** 出栈时出错 | 栈在中断处理期间被破坏 |
| MMFSR.b1 DACCVIOL | bit 1 | 数据访问违规 | MPU 区域配置错误；写空指针 |
| BFSR.b4 STKERR | bit 12 | 入栈时发生总线错误 | 同样是栈溢出（栈指针跑到了非法区域） |
| BFSR.b1 PRECISERR | bit 9 | **精确** 总线错误 | 访问了不存在的外设地址；` BFAR ` 里就是出错地址 |
| BFSR.b2 IMPRECISERR | bit 10 | **不精确** 总线错误 | 写缓冲延迟上报；需在访问后加 ` __DSB() ` 才能定位 |
| UFSR.b1 INVSTATE | bit 17 | 试图切换到 ARM 状态 | 函数指针指向了数据、跳转进了野地址 |
| UFSR.b2 INVPC | bit 18 | 非法 PC 加载 | 异常返回时 EXC\_RETURN 非法或返回状态不符合架构约束；不能用地址奇偶直接判定 INVPC |
| UFSR.b3 NOCP | bit 19 | 访问不存在的协处理器 | Cortex-M3  **没有 FPU** ，却执行了浮点指令（链接了软浮点以外的库） |
| UFSR.b8 UNALIGNED | bit 24 | 非对齐访问 | M0/M0\+ 上任何非对齐都触发；M3/M4 只在 LDM/STM 等指令或开了 ` UNALIGN_TRP ` 时触发 |
| UFSR.b9 DIVBYZERO | bit 25 | 除以零 | 需先打开 ` CCR.DIV_0_TRP `（见上面的第 ② 步） |

 

两个"地址有效"标志位决定了能不能直接拿到出错地址：` MMFSR.b7 MMARVALID `（CFSR bit 7）置位时读 ` MMFAR `（` 0xE000ED34 `），` BFSR.b7 BFARVALID `（CFSR bit 15）置位时读 ` BFAR `（` 0xE000ED38 `）。另外别忘了看 ` HFSR `（` 0xE000ED2C `）的  **bit30 FORCED** ——它才是"这是一次升级"的正牌标志。 好消息是：CMSIS 已经把这些绝对位号做成了现成的宏（` SCB_CFSR_PRECISERR_Msk `…）， 下面那段 ` hardfault_report.c ` 用的就是它们，直接抄比自己数位更不容易错。

 

hardfault\_report.c — 先把能读的证据都读出来 C

 

```text
#include <stdint.h>
#include "stm32f103xb.h"       /* SCB / SCB_CFSR_*_Msk / __get_IPSR */

void HardFault_Handler(void)
{
    uint32_t cfsr = SCB->CFSR;    /* 0xE000ED28：真凶在这里 */
    uint32_t hfsr = SCB->HFSR;    /* 0xE000ED2C：bit30 = 被强制升级 */
    uint32_t ipsr = __get_IPSR(); /* 当前异常编号 */
    uint32_t bad  = 0;

    if (cfsr & SCB_CFSR_MMARVALID_Msk) bad = SCB->MMFAR;   /* 0xE000ED34 */
    if (cfsr & SCB_CFSR_BFARVALID_Msk) bad = SCB->BFAR;   /* 0xE000ED38 */

    volatile uint32_t dbg[4] = { cfsr, hfsr, ipsr, bad };
    (void)dbg;   /* 用调试器看这四个变量，或经串口打印出来 */

    for (;;) { }  /* 停在这里，别让它复位跑掉现场 */
}
```

 

` __get_IPSR() ` 看着像函数调用，在 Cortex-M 上其实 **就是一条指令** 。 先看它的实现（CMSIS 里的写法就长这样）：

 

read\_ipsr.c — \_\_get\_IPSR 的全部实现 C

 

```text
#include <stdint.h>

uint32_t read_ipsr(void)
{
    uint32_t r;
    __asm volatile ("mrs %0, ipsr" : "=r" (r));
    return r;
}
```

 

只有 ` __asm volatile ` 那一行是"真的在干活"，其余都是为了满足 C 函数调用约定。 用 ` -O0 ` 编出来反汇编，证据如下：

 

**bash**  — 实测反汇编（arm-none-eabi-gcc 13.3.1 ` -O0 -mcpu=cortex-m3 -mthumb `）

 

```text
$ arm-none-eabi-objdump -d read_ipsr-O0.o

00000000 <read_ipsr>:
   0:  b480        push  {r7}
   2:  b083        sub   sp, #12
   4:  af00        add   r7, sp, #0
   6:  f3ef 8305   mrs   r3, IPSR
   a:  607b        str   r3, [r7, #4]
   c:  687b        ldr   r3, [r7, #4]
   e:  4618        mov   r0, r3
  10:  370c        adds  r7, #12
  12:  46bd        mov   sp, r7
  14:  bc80        pop   {r7}
  16:  4770        bx    lr

$ arm-none-eabi-objdump -d read_ipsr-O2.o

00000000 <read_ipsr>:
   0:  f3ef 8005   mrs   r0, IPSR
   4:  4770        bx    lr
   6:  bf00        nop
↑ -O0：11 条指令、24 字节 —— 只有 6: mrs r3, IPSR（2 个半字：f3ef 8305）
  一条读到了硬件，其余全是在栈上倒腾那个临时变量 r。
  -O2：塌缩成 2 条有效指令、8 字节（末尾那条 nop 是补齐到 4 字节对齐）。

  注意 -O0 这 11 条里【没有 bl】——没有任何函数调用。
  这说明本次构建把 __get_IPSR() 内联成寄存器读取，没有独立 BL 调用；不能据此把内联函数说成“不是函数”。
```

 

✔ IPSR 的值怎么读

 

IPSR 低 9 位就是 **当前正在处理的异常编号** ：` 0 ` = 线程模式（说明你不是在故障里调用它，而是普通代码里误调）； ` 3 ` = HardFault；` 4 ` = MemManage；` 5 ` = BusFault；` 6 ` = UsageFault； ` 11 ` = SVCall；` 14 ` = PendSV；` 15 ` = SysTick；  **≥ 16 的都是外部中断** ，对应关系是 ` IRQn = IPSR - 16 `。 现在知道了"谁在跑"，下一步自然想知道"出错时执行到哪一行"——那需要从异常栈帧里取出 PC，用一点内联汇编才能做到，放在模块 08 详细讲。

 

```zhizhan-anchor
ch0-2
```



## 0.2 抽象泄漏：从 HAL 到寄存器

 

现代开发大多从 HAL 库开始，这没问题。问题在于： **当 HAL 出问题、或者你需要在 10 μs 内完成某件事时，你必须能往下钻** 。 我们用一个贯穿全书的例子说明——点亮 STM32 上一颗 LED。

 

blink\_hal.c — 使用 HAL 库 C

 

```text
#include "stm32f1xx_hal.h"

int main(void)
{
    HAL_Init();
    SystemClock_Config();

    __HAL_RCC_GPIOC_CLK_ENABLE();

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin   = GPIO_PIN_13;
    gpio.Mode  = GPIO_MODE_OUTPUT_PP;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOC, &gpio);

    for (;;) {
        HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13);
        HAL_Delay(500);
    }
}
```

 

同样的事情，纯寄存器版本：

 

blink\_reg.c — 纯寄存器，无任何库依赖 C

 

```text
#include <stdint.h>

/* 直接把物理地址当作指针来用 —— 这就是嵌入式 C 的核心招式 */
#define RCC_APB2ENR   (*(volatile uint32_t *)0x40021018UL)
#define GPIOC_CRH     (*(volatile uint32_t *)0x40011004UL)
#define GPIOC_ODR     (*(volatile uint32_t *)0x4001100CUL)

#define RCC_IOPCEN    (1UL << 4)      /* 使能 GPIOC 时钟的位 */

int main(void)
{
    RCC_APB2ENR |= RCC_IOPCEN;        /* ① 开时钟，否则写 GPIO 无效 */

    /* ② 配置 PC13 为推挽输出，2 MHz（CRH 每 4 位管一个引脚）
       这 4 位是【低 2 位 MODE、高 2 位 CNF】：
           MODE = 10 → 输出模式，最高 2 MHz
           CNF  = 00 → 通用推挽输出
       拼起来就是 0b0010 = 0x2。
       ⚠ 这里不能写 50 MHz（MODE=11）。RM0008 规定 PC13/PC14/PC15
         这三个脚最高只能 2 MHz —— 它们和晶振、备份域走同一套电路。
         详见 6.2 的"关键数字"表。 */
    GPIOC_CRH &= ~(0xFUL << 20);       /* 先清零 PC13 那 4 位 */
    GPIOC_CRH |=  (0x2UL << 20);       /* MODE=10（2MHz）, CNF=00（推挽）*/

    for (;;) {
        GPIOC_ODR ^= (1UL << 13);      /* ③ 翻转 PC13 */
        for (volatile uint32_t i = 0; i < 400000; i++) { }   /* 粗糙延时 */
    }
}
```

 

◆ 这两段代码的关系，就是全书的学习目标

 

HAL 版本隐藏了 4 个事实：① 外设默认 **没有时钟** ，不开时钟寄存器写了也没反应； ② 配置寄存器是 **按位域划分** 的，改一个引脚的配置必须先读-改-写； ③ 每个寄存器有 **精确的物理地址** ；④ 这些地址必须用 ` volatile ` 指针访问。 学完这一册，你看 HAL 源码时看到的将不再是"黑盒 API"，而是 **对上面这几行的封装** 。

 

```zhizhan-anchor
ch0-2-1
```



### 0.2.1 那三个地址到底住在哪：STM32 的存储器映射

 

上一段代码里的 ` 0x40021018 `、` 0x40011004 `、` 0x4001100C `，不是随便编的魔数， 而是 **芯片手册里规定死的地址** 。Cortex-M 的 4 GB 地址空间被划分成固定的几大块，每一块的"性格"完全不同：

 

```zhizhan-table
{"rows":[[{"body":"区段","header":true,"rowSpan":1,"colSpan":1},{"body":"地址范围","header":true,"rowSpan":1,"colSpan":1},{"body":"里面装什么","header":true,"rowSpan":1,"colSpan":1},{"body":"访问特性","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**Code**","header":false,"rowSpan":1,"colSpan":1},{"body":"0x0000\\_0000  \n– 0x1FFF\\_FFFF","header":false,"rowSpan":1,"colSpan":1},{"body":"指令与只读常量。F103 的 Flash  **主地址是 ` 0x0800_0000 `** ，再由硬件\"别名\"映射到 ` 0x0000_0000 `（映射哪一块取决于 BOOT 引脚）","header":false,"rowSpan":1,"colSpan":1},{"body":"取指、读常量；写 Flash 必须先解锁并擦除","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**SRAM**","header":false,"rowSpan":1,"colSpan":1},{"body":"0x2000\\_0000  \n– 0x3FFF\\_FFFF","header":false,"rowSpan":1,"colSpan":1},{"body":"栈、堆、` .data `、` .bss `。F103C8T6 只有  **20 KB** ，也就是实际只用 ` 0x2000_0000 `–` 0x2000_4FFF `","header":false,"rowSpan":1,"colSpan":1},{"body":"可读写； **没有 MMU，越界是静默的** ——只是踩坏了别人的数据","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**Peripherals**","header":false,"rowSpan":1,"colSpan":1},{"body":"0x4000\\_0000  \n– 0x5FFF\\_FFFF","header":false,"rowSpan":1,"colSpan":1},{"body":"所有外设寄存器：GPIO、TIM、USART、SPI、ADC、RCC……（ARM 定义的范围很宽，STM32F1 实际只用到 ` 0x4000_0000 `–` 0x4002_3FFF `）","header":false,"rowSpan":1,"colSpan":1},{"body":"**读写都有副作用** ：读 UART 会清标志，写 GPIO 会改电平。必须 ` volatile `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**PPB**   \n内核私有总线","header":false,"rowSpan":1,"colSpan":1},{"body":"0xE000\\_0000  \n– 0xE00F\\_FFFF","header":false,"rowSpan":1,"colSpan":1},{"body":"CPU 自己的寄存器：` 0xE000_0000 ` 起是 ITM / DWT / FPB，` 0xE000_E000 ` 起是系统控制空间（NVIC、SysTick、SCB、MPU）","header":false,"rowSpan":1,"colSpan":1},{"body":"只有 **特权级** 能访问；上一节的 ` 0xE000ED24 ` / ` 0xE000ED28 ` 就在这一段里","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

外设那 512 MB 空间里，STM32 又按 **三条总线** 分层——这是理解"为什么改外设要先开时钟"以及"为什么寄存器名字里带 APB1/APB2"的关键：

 

| 总线 | 基址 | F1 上最高频率 | 典型住户 |
| --- | --- | --- | --- |
| APB1 | 0x4000\_0000 | 36 MHz（低速） | TIM2–TIM7、USART2/3、I2C1/2、SPI2、PWR、BKP、RTC、看门狗 |
| APB2 | 0x4001\_0000 | 72 MHz（高速） | **GPIOA–E** 、USART1、SPI1、ADC1/2、TIM1、AFIO |
| AHB | 0x4001\_8000 | 72 MHz | [DMA](term:dma)、Flash 接口、CRC、SDIO，以及  **RCC（` 0x4002_1000 `）** |

 

现在回头看那三行宏定义，每一个地址都能拆开解释：

 

```zhizhan-table
{"rows":[[{"body":"地址","header":true,"rowSpan":1,"colSpan":1},{"body":"拆解","header":true,"rowSpan":1,"colSpan":1},{"body":"说明","header":true,"rowSpan":1,"colSpan":1}],[{"body":"0x40021018","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x4002_1000 `（RCC 基址）  \n\\+ ` 0x18 ` → ` RCC_APB2ENR `","header":false,"rowSpan":1,"colSpan":1},{"body":"它在  **AHB**  上，不在 APB2 上。名字里的 \"APB2\" 是说\"它管的是 APB2 上那些外设的时钟开关\"。这是 ST 命名最容易绕晕的一处","header":false,"rowSpan":1,"colSpan":1}],[{"body":"0x40011004","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x4001_1000 `（GPIOC 基址）  \n\\+ ` 0x04 ` → ` GPIOC_CRH `","header":false,"rowSpan":1,"colSpan":1},{"body":"GPIO 挂在  **APB2**  上。五个端口依次是 A ` 0x4001_0800 `、B ` 0x4001_0C00 `、C ` 0x4001_1000 `、D ` 0x4001_1400 `、E ` 0x4001_1800 `，每个相隔 ` 0x400 `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"0x4001100C","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x4001_1000 `  \n\\+ ` 0x0C ` → ` GPIOC_ODR `","header":false,"rowSpan":1,"colSpan":1},{"body":"同一个端口内部，寄存器是按固定偏移排列的：` CRL ` \\+0x00、` CRH ` \\+0x04、` IDR ` \\+0x08、 **` ODR ` \\+0x0C** 、` BSRR ` \\+0x10、` BRR ` \\+0x14、` LCKR ` \\+0x18","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ 关于 C8T6 的 Flash 容量

 

F103 **C8** T6 的标称 Flash 是  **64 KB** （` 0x0800_0000 `–` 0x0800_FFFF `）； "128 KB" 是 F103 **CB**  的规格，两者封装相同、价格相近，很容易记混。 社区里确实有大量"Blue Pill"小板实测能写到 128 KB（这是晶圆良率筛选的副产品）， 但 **拿它做量产是赌博** ——同一份链接脚本换一批芯片就可能写不进去。教程后续一律按 64 KB 规划。

 

```zhizhan-anchor
ch0-3
```



## 0.3 需要建立的三层心智模型

 

整个模块 00–08 的内容，其实是在构建三个互相咬合的模型：

 

**FIG 0.2**  三层心智模型与对应章节

 

```zhizhan-figure
<svg viewBox="0 0 660 300" width="660" height="300" role="img" aria-label="内存模型、编译模型、执行模型三层结构">
          <defs>
            <marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <rect x="72" y="18" width="516" height="76" rx="8" class="sv-cyn-s"></rect>
          <text x="92" y="44" class="sv-lbl-hi" style="fill:var(--cyn)">① 内存模型</text>
          <text x="92" y="64" class="sv-t">变量是什么？地址、类型、生命周期。数据在 SRAM 里按什么规则摆放。</text>
          <text x="92" y="83" class="sv-lbl-dim">← 模块 01 · 03 · 04</text>

          <rect x="72" y="110" width="516" height="76" rx="8" class="sv-grn-s"></rect>
          <text x="92" y="136" class="sv-lbl-hi" style="fill:var(--grn)">② 编译模型</text>
          <text x="92" y="156" class="sv-t">源码如何变成机器码？符号、段、重定位、优化器如何改写你的意图。</text>
          <text x="92" y="175" class="sv-lbl-dim">← 模块 02 · 05 · 08</text>

          <rect x="72" y="202" width="516" height="76" rx="8" class="sv-amb-s"></rect>
          <text x="92" y="228" class="sv-lbl-hi" style="fill:var(--amb)">③ 执行模型</text>
          <text x="92" y="248" class="sv-t">CPU 如何取值执行、栈帧如何建立、中断如何打断、寄存器如何被读写。</text>
          <text x="92" y="267" class="sv-lbl-dim">← 模块 03 · 04 · 06 · 07</text>

          <path d="M 40 56 L 40 240" stroke="var(--line-2)" stroke-width="1.4" stroke-dasharray="5 5"></path>
          <path d="M 44 56 L 66 56" stroke="var(--grn)" stroke-width="1.6" marker-end="url(#ah2)"></path>
          <path d="M 44 240 L 66 240" stroke="var(--grn)" stroke-width="1.6" marker-end="url(#ah2)"></path>
          <text x="28" y="140" class="sv-lbl-dim" transform="rotate(-90 28 140)" text-anchor="middle">越往上越接近硬件</text>
        </svg>
```

 

三者的关系是： **编译模型决定了内存模型的实际布局，内存模型决定了执行模型能做什么** 。 只看语法书的人缺的正是这三层之间的联系，所以遇到"代码看着对但跑不对"的情况就束手无策。

 

```zhizhan-anchor
ch0-3-1
```



### 0.3.1 一个贯穿全书的例子

 

看这一行看似无害的代码，它同时触及三层模型：

 

self\_test.c C

 

```text
static volatile uint32_t g_tick;   /* 定义在文件作用域 */

void SysTick_Handler(void)         /* 中断服务程序，每 1 ms 触发 */
{
    g_tick++;                      /* 只有这一行 */
}

uint32_t uptime_ms(void)
{
    return g_tick;                 /* 读一次，返回 */
}
```

 

| 层级 | 这一行代码涉及的问题 | 见模块 |
| --- | --- | --- |
| **内存模型** | ` g_tick ` 放在 ` .data ` 还是 ` .bss `？初始值 0 是怎么来的——编译器烧进 Flash，还是启动代码清零？ | 01 / 04 |
| **编译模型** | 为什么必须 ` volatile `？如果去掉，` uptime_ms ` 若被内联或循环调用，编译器会把 ` g_tick ` 缓存进寄存器，永远读到第一次的值。 | 02 / 05 |
| **执行模型** | ` g_tick++ ` 不是原子操作（读-改-写三步）。主循环读它时，中断可能正好插在中间。32 位对齐读写才是原子的。 | 06 / 07 |

 

✔ 学习方法建议

 

本书每一处结论都尽量给出 **可验证的方法** ——用 ` objdump ` 看反汇编、用 ` readelf ` 看段布局、用 ` nm ` 看符号地址。 强烈建议你边读边在本地跑这些命令。 **看到真实的输出，比记住结论重要十倍** 。

 

```zhizhan-anchor
ch0-4
```



## 0.4 工具链准备

 

模块 01–05 的内容全部可以在 PC 上验证（不需要开发板）。模块 06 起需要硬件。以下是完整清单。

 

```zhizhan-anchor
ch0-4-1
```



### 0.4.1 基础工具（PC 端即可，强烈建议先配好）

 

| 工具 | 用途 | 获取方式 |
| --- | --- | --- |
| gcc / clang | 本机编译验证、查看内存布局 | Linux 自带；Windows 用 MSYS2 或 WSL |
| binutils | ` objdump ` / ` readelf ` / ` nm ` / ` size `，看二进制真相 | 随 gcc 一起安装 |
| gdb | 单步调试、崩溃回溯 | 随 gcc 安装 |
| cppcheck | **跨平台** 静态检查：未初始化变量、数组越界、资源泄漏。它的强项是 *不需要能编译通过* | ` apt install cppcheck ` / 官网下载 |
| gcc -fanalyzer | 编译器自带的路径分析器（GCC ≥ 10）：能抓 use-after-free、双重释放、空指针解引用，并给出完整调用链 | GCC 自带，编译时加 ` -fanalyzer ` |
| make / cmake | 构建系统 | 标准包管理器 |

 

```zhizhan-anchor
ch0-4-2
```



### 0.4.2 STM32 方向

 

| 工具 | 用途 | 说明 |
| --- | --- | --- |
| arm-none-eabi-gcc | ARM Cortex-M 交叉编译器 | 推荐 ARM 官方 GNU Toolchain 或 ` xpack-arm-none-eabi-gcc ` |
| OpenOCD | 通过 ST-Link 烧录 / 调试 | 配合 GDB 使用，可命令行操作 |
| STM32CubeMX / IDE | 生成初始化代码、引脚配置 | 初学可用，但要逐步摆脱 |
| ST-Link V2 | 调试探针（硬件） | 十几元的克隆版即可 |
| USB-TTL 串口模块 | printf 输出、日志 | CH340 / CP2102 均可 |

 

```zhizhan-anchor
ch0-4-3
```



### 0.4.3 ESP32 方向

 

| 工具 | 用途 | 说明 |
| --- | --- | --- |
| ESP-IDF | 官方开发框架（基于 [FreeRTOS](term:rtos)） | v5.x，含 riscv32/xtensa 工具链 |
| idf.py | 构建 / 烧录 / 监视一体化 | ` idf.py build flash monitor ` |
| ESP32-DevKitC | 开发板（硬件） | ESP32-WROOM-32 模组，带 USB 串口 |

 

```zhizhan-anchor
ch0-4-4
```



### 0.4.4 一组可以直接抄的编译选项

 

工具装好了，接下来是"怎么调用它们"。下面这两条命令可以直接拿去用；比命令本身更重要的是 **知道每个开关在防什么** —— 后面所有章节的反汇编、段布局、体积数字，都是在这样一组开关下产生的。

 

build.sh / Makefile 里的两条核心命令 BASH

 

```text
# ① 编译（源文件 → 目标文件）
arm-none-eabi-gcc \
    -mcpu=cortex-m3 -mthumb \
    -std=c17 -Os -g3 -gdwarf-2 \
    -Wall -Wextra -Wconversion -Wsign-conversion -Wshadow -Wundef -Wdouble-promotion \
    -ffunction-sections -fdata-sections \
    -c src/main.c -o build/main.o

# ② 链接（目标文件 → 可执行文件）
arm-none-eabi-gcc \
    -mcpu=cortex-m3 -mthumb \
    -Wl,--gc-sections -Wl,-Map=build/app.map \
    --specs=nano.specs --specs=nosys.specs \
    -T STM32F103C8Tx_FLASH.ld \
    -o build/app.elf build/main.o build/startup_stm32f103xb.o
```

 

```zhizhan-table
{"rows":[[{"body":"选项","header":true,"rowSpan":1,"colSpan":1},{"body":"作用","header":true,"rowSpan":1,"colSpan":1},{"body":"为什么嵌入式必须写","header":true,"rowSpan":1,"colSpan":1}],[{"body":"-mcpu=cortex-m3 -mthumb","header":false,"rowSpan":1,"colSpan":1},{"body":"目标内核与指令集","header":false,"rowSpan":1,"colSpan":1},{"body":"Cortex-M3  **只支持 Thumb 指令集** 。不写会按 ARM 指令集生成，板子根本跑不起来（这个错误编译器不会替你拦）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-std=c17","header":false,"rowSpan":1,"colSpan":1},{"body":"锁定语言标准","header":false,"rowSpan":1,"colSpan":1},{"body":"各工具链默认方言不同；GCC 与 ESP-IDF、HAL 协作时，锁定标准能避免\"同一份代码两种解释\"","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Os","header":false,"rowSpan":1,"colSpan":1},{"body":"优先优化体积","header":false,"rowSpan":1,"colSpan":1},{"body":"直接对应 Flash 占用。发布固件常用；调试期建议换 ` -Og `，否则单步会跳来跳去","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Wall -Wextra","header":false,"rowSpan":1,"colSpan":1},{"body":"常用告警全家桶","header":false,"rowSpan":1,"colSpan":1},{"body":"免费的第一道防线，没有任何理由不开","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Wconversion  \n-Wsign-conversion","header":false,"rowSpan":1,"colSpan":1},{"body":"隐式窄化 / 符号转换","header":false,"rowSpan":1,"colSpan":1},{"body":"嵌入式满地是 ` uint8_t ` / ` uint16_t ` 的寄存器操作，这类告警命中率极高（见下面的实测）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Wshadow","header":false,"rowSpan":1,"colSpan":1},{"body":"变量遮蔽","header":false,"rowSpan":1,"colSpan":1},{"body":"中断服务函数里的局部变量与全局变量重名，是最经典的一类坑","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Wundef","header":false,"rowSpan":1,"colSpan":1},{"body":"` #if ` 用了未定义的宏","header":false,"rowSpan":1,"colSpan":1},{"body":"未定义宏在 ` #if ` 里被当成 0，条件编译写错会 **静默走错分支**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Wdouble-promotion","header":false,"rowSpan":1,"colSpan":1},{"body":"` float ` 被隐式提升为 ` double `","header":false,"rowSpan":1,"colSpan":1},{"body":"嵌入式最贵的一类隐式开销：一旦提升，整套 double 运算库就要被拉进 Flash","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-ffunction-sections  \n-fdata-sections  \n-Wl,--gc-sections","header":false,"rowSpan":1,"colSpan":1},{"body":"每个函数/变量各占一段，链接时丢弃未被引用的","header":false,"rowSpan":1,"colSpan":1},{"body":"能把 HAL 里几百个用不到的函数从固件里剔掉，是 **省 Flash 最有效的一招** 。三者必须一起用，单写 ` --gc-sections ` 无效","header":false,"rowSpan":1,"colSpan":1}],[{"body":"--specs=nano.specs","header":false,"rowSpan":1,"colSpan":1},{"body":"用 newlib-nano 替代完整 newlib","header":false,"rowSpan":1,"colSpan":1},{"body":"省下几十 KB Flash。但它砍掉了一部分 ` printf ` 能力，代价见下一节","header":false,"rowSpan":1,"colSpan":1}],[{"body":"--specs=nosys.specs","header":false,"rowSpan":1,"colSpan":1},{"body":"提供系统调用的空实现桩","header":false,"rowSpan":1,"colSpan":1},{"body":"否则 ` _write ` / ` _sbrk ` / ` _close ` 一堆未定义，链接直接失败","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-g3 -gdwarf-2","header":false,"rowSpan":1,"colSpan":1},{"body":"调试信息","header":false,"rowSpan":1,"colSpan":1},{"body":"上板单步调试必需；发布时再去掉","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-Wl,-Map=build/app.map","header":false,"rowSpan":1,"colSpan":1},{"body":"生成映射文件","header":false,"rowSpan":1,"colSpan":1},{"body":"排查\"Flash 怎么又满了\"\"哪个库占了我的 RAM\"的唯一可靠手段","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ 两个容易被忽略的细节

 

 
- ` -mcpu ` 和 ` -mthumb ` 必须 **同时出现在编译和链接两条命令行里** 。只写在编译命令里，链接时会用默认架构，可能报出莫名其妙的"指令不兼容"。
 
- ` -Wl,--gc-sections ` 依赖 ` -ffunction-sections -fdata-sections `。没有前两者，所有代码挤在同一个段里，垃圾回收器无从下手，这个选项等于没写。

 

这些开关到底有没有在工作？写一个"金丝雀"文件试一下就知道了——故意犯三种不同的错，看编译器是否逐一报出来：

 

canary.c — 用来验证告警开关是否真的生效 C

 

```text
/* canary.c —— 用来验证告警开关是否真的生效 */
#include <stdint.h>
#include <stddef.h>

uint8_t  narrow(uint16_t raw) { return raw; }

/* 下面两行的告警由 -Wextra 家族负责 */
int      less_than(int i, unsigned n) { return i < n; }

int      calc(int used, int unused) { return used * 2; }

/* 证明 __get_IPSR() 就是一条指令 */
uint32_t read_ipsr(void) { uint32_t r; __asm volatile ("mrs %0, ipsr" : "=r" (r)); return r; }
```

 

**bash**  — 实测输出（arm-none-eabi-gcc 13.3.1）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c17 -O0 \
      -Wall -Wextra -Wconversion -Wsign-conversion -c canary.c -o canary.o
canary.c:5:40: warning: conversion from 'uint16_t' {aka 'short unsigned int'} to 'uint8_t' {aka 'unsigned char'} may change value [-Wconversion]
canary.c:8:50: warning: comparison of integer expressions of different signedness: 'int' and 'unsigned int' [-Wsign-compare]
canary.c:10:29: warning: unused parameter 'unused' [-Wunused-parameter]
↑ 三条告警，三种完全不同的问题：窄化 / 符号 / 漏用。
  注意第一条里的 {aka 'short unsigned int'} —— 这是交叉编译才会出现的措辞。
```

 

✔ 把这组开关当仪表盘用

 

接手老代码时，第一件事不是读代码，而是 **把这组告警全打开重编一遍** 。几百条告警里通常藏着几个真正的 bug， 而"能编过但行为不对"的问题，往往就有告警在提示你。这一招的投入产出比，比读一整天代码高得多。

 

```zhizhan-anchor
ch0-4-5
```



### 0.4.5 抓未定义行为：谁管 PC，谁管板子

 

有了告警，还要认清一件事： **有一大类问题，编译器在原理上就不可能发现** 。这类问题叫未定义行为（Undefined Behavior，UB）， 它的定义就是"标准不规定会发生什么"——而"会发生什么"只有 **运行起来才知道** 。

 

◆ 一句话判断该用哪个工具

 

**UB 是运行期行为。静态工具只能"猜"，动态工具必须让代码真的跑起来。**  于是工具被一条线分成两拨：能跑代码的地方（PC）用动态检测，跑不了代码的地方（交叉编译的目标板）只能用静态分析和硬件兜底。 很多人抱怨"cppcheck 没抓到我那个越界"——那本来就不是它的职责范围。

 

```zhizhan-table
{"rows":[[{"body":"工具","header":true,"rowSpan":1,"colSpan":1},{"body":"在哪里生效","header":true,"rowSpan":1,"colSpan":1},{"body":"能抓什么","header":true,"rowSpan":1,"colSpan":1},{"body":"代价与边界","header":true,"rowSpan":1,"colSpan":1}],[{"body":"-Wall -Wextra  \n-Wconversion","header":false,"rowSpan":1,"colSpan":1},{"body":"编译期","header":false,"rowSpan":1,"colSpan":1},{"body":"语法上可判定的问题：隐式类型转换、符号不匹配、变量遮蔽、参数未使用","header":false,"rowSpan":1,"colSpan":1},{"body":"零成本。必须开，但不覆盖任何\"取决于运行时数据\"的问题","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-fanalyzer","header":false,"rowSpan":1,"colSpan":1},{"body":"编译期  \n（交叉工具链也能跑）","header":false,"rowSpan":1,"colSpan":1},{"body":"过程间路径分析：use-after-free、双重释放、空指针解引用、资源泄漏， **并给出完整调用链**","header":false,"rowSpan":1,"colSpan":1},{"body":"编译明显变慢；有误报。但这是 **交叉环境下唯一的深层检查手段**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-fsanitize=undefined  \nUBSan","header":false,"rowSpan":1,"colSpan":1},{"body":"**运行期**","header":false,"rowSpan":1,"colSpan":1},{"body":"有符号整数溢出、移位越界、除零、空指针、错误的类型转换……","header":false,"rowSpan":1,"colSpan":1},{"body":"必须能执行代码 →  **只能用在 PC 上** 。需要 libubsan","header":false,"rowSpan":1,"colSpan":1}],[{"body":"-fsanitize=address  \nASan","header":false,"rowSpan":1,"colSpan":1},{"body":"**运行期**","header":false,"rowSpan":1,"colSpan":1},{"body":"数组越界、use-after-free、栈溢出、堆溢出，报错时直接给出越界的字节数和调用栈","header":false,"rowSpan":1,"colSpan":1},{"body":"内存占用大幅上升 → 同样 **只能用在 PC 上** 。需要 libasan","header":false,"rowSpan":1,"colSpan":1}],[{"body":"cppcheck","header":false,"rowSpan":1,"colSpan":1},{"body":"静态  \n（不需要能编译通过）","header":false,"rowSpan":1,"colSpan":1},{"body":"未初始化变量、数组越界、资源泄漏、可疑写法","header":false,"rowSpan":1,"colSpan":1},{"body":"误报率较高，适合当\"第二意见\"，不适合当唯一防线","header":false,"rowSpan":1,"colSpan":1}],[{"body":"MPU \\+ HardFault","header":false,"rowSpan":1,"colSpan":1},{"body":"**目标板上，运行期**","header":false,"rowSpan":1,"colSpan":1},{"body":"野指针、栈溢出、越权访问内存","header":false,"rowSpan":1,"colSpan":1},{"body":"最后一道物理防线。 **它只能告诉你\"出事了\"，不能告诉你\"哪里错了\"** （除非你按上一节讲的把现场读出来）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

` -fanalyzer ` 是这里最被低估的一个。它不是"另装一个工具"，而是编译器自带的一个开关， 加上去就能在 **交叉编译的同时** 做过程间路径分析。用下面这份故意写坏的文件试一下：

 

analyzer\_demo.c — 两个典型缺陷 C

 

```text
#include <stdlib.h>
#include <string.h>

/* 场景 1：释放后继续使用 */
int use_after_free(void)
{
    char *p = malloc(16);
    free(p);
    return p[0];          /* ← 这里已经悬空 */
}

/* 场景 2：忘记检查分配失败 */
void no_null_check(size_t n)
{
    char *p = malloc(n);
    memset(p, 0, n);      /* ← 若 malloc 返回 NULL 就是空指针写 */
    free(p);
}
```

 

**bash**  — 实测输出（arm-none-eabi-gcc 13.3.1 -fanalyzer）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c17 -O0 -fanalyzer -c analyzer_demo.c
analyzer_demo.c:9:13: warning: use after 'free' of 'p' [CWE-416] [-Wanalyzer-use-after-free]
analyzer_demo.c:16:5: warning: use of possibly-NULL 'p' where non-null expected [CWE-690] [-Wanalyzer-possible-null-argument]
  .../arm-none-eabi/include/string.h:33:10: note: argument 1 of 'memset' must be non-null
↑ 连 CWE 编号和"为什么这里必须非空"的依据都给了。没有运行任何代码。
```

 

⚠ 交叉工具链里没有 sanitizer 运行库

 

UBSan 和 ASan 都需要各自的运行库（` libubsan ` / ` libasan `）。 交叉工具链 **通常不提供** 它们——可以用 ` --print-file-name ` 自己确认：  **返回完整路径说明库存在，原样返回文件名说明找不到** 。

 

```text
$ arm-none-eabi-gcc --print-file-name=libgcc.a
C:/.../lib/gcc/arm-none-eabi/13.3.1/libgcc.a          ← 存在
$ arm-none-eabi-gcc --print-file-name=libubsan.a
libubsan.a                                            ← 不存在
```

 

✔ 工程上的做法：把"逻辑"和"硬件"分开

 

既然 UBSan / ASan 只能在 PC 上跑，那就 **把不依赖硬件的纯逻辑代码抽出来，在 PC 上跑测试** （协议解析、状态机、滤波算法、环形缓冲的索引运算……）， 这些正是最容易出越界和溢出的地方；而寄存器读写、时序相关的部分留在板子上验证。 这个"分层"不是洁癖，它是 **让 PC 上那些强大工具能够得着你的代码** 的唯一方式。模块 07 会给出具体的目录结构。

 

```zhizhan-anchor
ch0-4-6
```



### 0.4.6 printf 在 newlib-nano 上的真实代价

 

最后讲一个几乎所有 STM32 新手都踩过的坑：` --specs=nano.specs ` 帮你省了几十 KB， 但省下来的东西里， **包含一部分 ` printf ` 的能力** 。而它失能的方式是 **静默的** 。

 

下面是一组真实测量。五个程序结构完全相同，只有格式串不一样，都用同一组 ` -Os ` 配置编译：

 

| 程序内容 | .text（代码） | .rodata（常量） | .data | .bss |
| --- | --- | --- | --- | --- |
| printf("value = %d\\n", v) | 4132 | 63 | 92 | 364 |
| printf("value = %ld\\n", v) | 4132 | 64 | 92 | 364 |
| printf("value = %lld\\n", v) | 4136 | 65 | 92 | 364 |
| printf("value = %zu\\n", sizeof a) | 4132 | 64 | 92 | 364 |
| printf("value = %f\\n", (double)v) | 4136 | 63 | 92 | 364 |
| 上面任意一个 \+ ` -u _printf_float ` | 13352 | 897 | 456 | 364 |

 

先看 ` .rodata ` 那一列：` 63 → 64 → 65 `，增量恰好等于格式串多出来的字符数 （` "value = %d\n" ` 11 字符、` "%ld" ` 版 12 字符、` "%lld" ` 版 13 字符）。  **也就是说，库没有新增任何表格** ——这个细节后面很关键。

 

再看最后一行： **不管你用的是 ` %d `、` %lld `、` %zu ` 还是 ` %f `， 只要加上 ` -u _printf_float `，体积就完全一样** ——` .text ` 从 4132 涨到 13352（ **\+9220 字节** ）， ` .rodata ` 从 63 涨到 897（\+834），` .data ` 从 92 涨到 456（\+364）， **合计约 \+10.2 KB** 。 这个开销是"打开开关就付"，和你用不用浮点转换 **毫无关系** 。

 

✖ 最危险的一点：失败是静默的

 

不加 ` -u _printf_float ` 时， **编译通过、链接通过、下载成功，板子上却打印不出那个数字** ，而且没有任何告警提醒你。 用 ` nm ` 可以看穿这件事：不带开关的 ` p_f.elf ` 里 **一个浮点符号都没有** ； 带上开关后才出现 ` _dtoa_r ` 和 ` _printf_float `。

 

#### 为什么 ` %zu ` 和 ` %lld ` 也不行

 

上表里 ` %lld ` 只让 ` .text ` 涨了 4 字节，` %zu ` 更是一字节没涨。 乍看像是"nano 优化得很好"，真相恰恰相反。把 ` nm ` 的输出按体积排序、把两个版本逐一对比，就露馅了：

 

**bash**  — 定位那 4 字节到底长在哪个函数上

 

```text
$ diff <(arm-none-eabi-nm --size-sort --print-size p_d.elf) \
       <(arm-none-eabi-nm --size-sort --print-size p_lld.elf)
59c59
< 00000014 main          ← %d 版本的 main：20 字节
> 00000018 main          ← %lld 版本的 main：24 字节
↑ 整个 diff 只有这一行

$ arm-none-eabi-nm --size-sort --print-size p_lld.elf | grep -iE 'printf|main'
00008030 00000018 T main
000082d4 00000024 T printf
000086a8 00000230 T _vfprintf_r
000088d8 000000e4 T _printf_common
000089bc 0000023c T _printf_i
↑ printf 内部的每个函数体积都和 %d 版本完全相同。
  唯一的 +4 字节长在 main 里 —— 因为传一个 64 位参数要多准备一个寄存器。
```

 

**结论：nano 版的 ` printf ` 根本没有为 ` %lld ` 增加任何代码，因为它压根不解析 ` ll `。**  直接去 ` libc_nano.a ` 里把解析器的字符串表挖出来，就一目了然——下面是 ` _vfprintf_r ` 那段只读数据，三个以 NUL 结尾的字符串分别是标志位、 **长度修饰符** 和浮点转换符：

 

**bash**  — 从静态库里挖出解析器的查找表

 

```text
$ arm-none-eabi-ar x $(arm-none-eabi-gcc --print-file-name=libc_nano.a) libc_a-nano-vfprintf.o
$ arm-none-eabi-objdump -s -j .rodata._vfprintf_r.str1.1 libc_a-nano-vfprintf.o
0000 232d302b 2000686c 4c006566 67454647  #-0+ .hlL.efgEFG
0010 00                                   .

拆开看这三段（\0 是字符串结束符）：

  "#-0+ "    ← 标志位：    # - 0 + 空格
  "hlL"      ← 长度修饰符： h  l  L      ★ 只有这三个
  "efgEFG"   ← 浮点转换符： e f g E F G
```

 

长度修饰符表里 **只有 ` h ` / ` l ` / ` L `** ， 没有 ` z `、没有 ` j `、没有 ` t `。而解析是 **单遍** 的：它只吃掉一个长度字符， 紧接着的下一个字符就被当作转换符。所以 ` %zu ` 里的 ` z ` 会被当成转换符， ` %lld ` 里的第二个 ` l ` 也会被当成转换符。 另一条独立证据是：整数格式化核心 ` _printf_i ` 的未定义符号 **只有 ` memchr ` 一个** ， 完全不引用 ` __udivdi3 ` / ` __umoddi3 `——它 **没有任何 64 位运算能力** 。

 

| 写法 | newlib-nano 下 | 原因 / 说明 |
| --- | --- | --- |
| %d %u %x %X %o %c %s %p | **✓ 正常** | 基本转换符，全部支持 |
| %ld %lu %lx | **✓ 正常** | ` l ` 在白名单里。ARM 上 ` long ` 就是 32 位，和 ` int ` 同宽 |
| %hhd %hd | **✓ 正常** | ` h ` 在白名单里（会按 short 宽度截断） |
| %lld %llu | **✗ 错** | 只吃掉第一个 ` l `，第二个 ` l ` 被当成转换符；且整数路径没有 64 位运算 |
| %zu %zd | **✗ 错** | ` z ` 不在白名单，被当成转换符 |
| %jd %td | **✗ 错** | 同上。` <inttypes.h> ` 里的 ` PRIu32 ` 这类宏在 nano 上不可靠 |
| %f %e %g | 需 ` -u _printf_float ` | 否则 **静默不输出数字** ；代价约 \+10.2 KB，且与是否真用浮点无关 |
| %Lf | 需 ` -u _printf_float ` | ` L ` 被识别，但浮点转换仍然要那个开关 |

 

那实际工程里怎么办？四条路，按推荐程度排序：

 

 
1. **尺寸和计数一律显式转成 32 位再打印。**  ARM 上 ` size_t ` 就是 ` unsigned int `，所以 ` printf("%u", (unsigned)sizeof(x)) ` 完全正确。  *注意：本册模块 01、03 里的 ` %zu ` 示例都是  **PC 端** 代码* （x86-64 上 ` size_t ` 是 8 字节，` %zu ` 正确无误）—— 把那些行原样抄进 STM32 工程就会踩上面的坑，请顺手改成 ` %u ` 加显式转换。
 
2. **64 位整数自己转。** 用 ` %08lx ` 把高低两半分开打印，或者自己写一个十几行的 ` u64_to_dec() `（模块 07 会给一个完整实现）。  **不要指望有什么开关能打开 ` %lld `** ——弱符号表里只有 ` _printf_float ` 和 ` _scanf_float ` 两个。
 
3. **浮点优先考虑定点化。** 把 ` float ` 乘 1000 存成 ` int32_t `，打印时自己插入小数点。 这既省掉 10 KB 的 printf 浮点代码，也省掉整套 double 运算库——这是嵌入式里最主流的做法。
 
4. 真的需要完整的 ` printf `，就去掉 ` --specs=nano.specs ` 换成完整 newlib。 ` %lld ` 和 ` %f ` 都能用了， **但 Flash 占用会明显上升** ——在只有 64 KB Flash 的 F103C8T6 上要谨慎评估。
 

 

本册使用的验证环境

 

书中所有 ` objdump ` / ` readelf ` / ` nm ` / ` size ` 输出示例，均以  **ARM Cortex-M**  为目标平台，由  **Arm GNU Toolchain 13.3.Rel1**  （` arm-none-eabi-gcc 13.3.1 20240614 `）实测生成；部分通用示例使用  **x86-64** 。 你在本地验证时数字可能略有差异（编译器版本、优化等级不同），  **重点是观察规律，而不是比对字节** 。

 

```zhizhan-anchor
ch0-5
```



## 0.5 一个可以直接运行的起点

 

在深入理论之前，先用一个最小工程把工具链跑通。这个程序不依赖任何库，能直接编译、能看反汇编、能观察内存布局：

 

layout\_demo.c — 观察各变量的落位 C

 

```text
#include <stdio.h>
#include <stdint.h>

int          g_init   = 0x12345678;   /* 有初值：.data  */
int          g_zero;                  /* 无初值：.bss   */
const int    g_const  = 0xABCD;       /* 只读：.rodata  */
static int   g_static = 100;          /* 内部链接 */

int main(void)
{
    int          local  = 1;          /* 栈 */
    static int   s_loc  = 2;          /* .data（函数内静态） */
    char         str[]  = "hello";    /* 栈上数组，运行期拷贝 */

    printf("&g_init  = %p\n", (void *)&g_init);
    printf("&g_zero  = %p\n", (void *)&g_zero);
    printf("&g_const = %p\n", (void *)&g_const);
    printf("&g_static= %p\n", (void *)&g_static);
    printf("&local   = %p\n", (void *)&local);
    printf("&s_loc   = %p\n", (void *)&s_loc);
    printf("&str     = %p\n", (void *)&str);
    printf("main     = %p\n", (void *)&main);
    return 0;
}
```

 

编译并运行：

 

**bash**  — 编译与观察

 

```text
$ gcc -O0 -o layout_demo layout_demo.c
$ ./layout_demo
&g_init  = 0x5642a1b2c010     ← 可读写数据段
&g_zero  = 0x5642a1b2c020     ← 未初始化段，紧邻 .data
&g_const = 0x5642a1b2a004     ← 只读段，地址更低
&g_static= 0x5642a1b2c014
&local   = 0x7ffd3c8a4b3c     ← 栈，地址高得多
&s_loc   = 0x5642a1b2c018
&str     = 0x7ffd3c8a4b30     ← 栈上数组
main     = 0x5642a1b2a1a9     ← 代码段
```

 

再来看这些变量在二进制文件里到底占了多少空间：

 

**bash**  — size / nm 查看段分布与符号地址

 

```text
$ size layout_demo
   text    data     bss     dec     hex filename
   1543     616       8    2167     877 layout_demo
   ↑代码   ↑有初值数据  ↑零初始化

$ nm -C layout_demo | grep -E 'g_init|g_zero|g_const|g_static'
0000000000004010 D g_init          ← D = .data (已初始化)
0000000000004020 B g_zero          ← B = .bss  (零初始化)
0000000000002004 R g_const         ← R = .rodata (只读)
0000000000004014 d g_static        ← 小写 d = 局部符号(static)
```

 

✔ 从输出里读出三件事

 

 
- ` nm ` 输出的大写/小写字母有含义：大写 = 全局符号（外部链接），小写 = 局部符号（` static `）。这正是模块 02 讲的内容。
 
- 段字母 ` D/B/R/T ` 直接告诉你变量落在哪个段，对应模块 04 的内存布局。
 
- ` .bss ` 只有 8 字节——因为 **未初始化的数据不占文件体积** ，只在加载时清零。模块 04 会解释启动代码如何做到这一点。

 

◆ 本章要点

 

 
- 嵌入式 C 与桌面 C 的差异是 **性质差异** ：无 OS 兜底、内存以 KB 计、程序永不退出、时序即正确性。
 
- 编译器 **不理解硬件** 。凡是有副作用的地址访问，必须用 ` volatile ` 告知编译器。
 
- HAL 库的每一行封装，最终都落在"按位操作某个物理地址"上。 **能往下钻，才有排障能力** 。
 
- 建立三层心智模型：内存模型 → 编译模型 → 执行模型。三者互相咬合，缺一层就会"看着对但跑不对"。
 
- 所有结论都要 **用工具验证** ：` size `、` nm `、` objdump `、` readelf ` 是嵌入式工程师的听诊器。

 

◆ 自测 · Module 00（先答再看）

 

 
1. 填空：` volatile ` 对编译器的核心约束是 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"告诉编译器\"这个对象的 **每次访问都必须真的读/写内存** \"，不许缓存进寄存器、不许合并或删除相邻访问。 *它既不是原子性，也不是内存屏障。*"}
   ```
 
2. 判断：在函数里写 ` char buf[1024*1024]; `，链接阶段一定会报 RAM 溢出吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。局部数组的存储由运行期 **栈** 分配， **不进 ` .bss `/` .data `** ，链接器看不到它，因此不会报链接错——GCC 只会给 ` -Wframe-larger-than ` 之类的告警。写成文件作用域或 ` static ` 之后才进段、才轮到链接器报错。"}
   ```
 
3. 选择：STM32F103 的 Flash 与 SRAM 分别映射到哪段地址？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"Flash = ` 0x0800_0000 `；SRAM = ` 0x2000_0000 `。外设区在 ` 0x4000_0000 `、内核私有外设（PPB）在 ` 0xE000_0000 `；` 0x0000_0000 ` 在 BOOT0=0 时是 Flash 的别名区。"}
   ```
 
4. 找错：` *(uint32_t *)0x40021018 = 0x10; ` 这行"点灯"少了什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"少了 ` volatile `——应为 ` *(volatile uint32_t *)0x40021018 `。否则编译器有权把这次\"普通内存写\"优化掉或与相邻访问重排，硬件寄存器收不到这次写。"}
   ```
 
5. 简答：newlib-nano 下 ` printf("%f", x) ` 为什么可能什么都不输出？怎么补？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"newlib-nano 的 ` printf ` 默认 **不带浮点格式化** ，遇到 ` %f ` 会丢弃。链接时加 ` -u _printf_float `（scanf 对应 ` -u _scanf_float `）才会拉入，代价是几十 KB Flash。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 00 完成？**  建议先在本机跑通 0.5 节的示例，观察自己的输出。

 

```zhizhan-assessment
{"id":"course-b01-ch0","criterion":"从本板向量表指出初始 MSP 和 Reset_Handler；解释 .data 复制/.bss 清零，记录一次断点。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 N1570 · 对象、类型与语言语义](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) · [Arm Cortex-M 架构文档](https://developer.arm.com/documentation/ddi0403/latest/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
