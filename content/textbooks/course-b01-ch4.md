# 内存分区与运行时布局

```zhizhan-anchor
ch4
```



你的每一个变量最终都落在某个具体的段里，落点由编译器、链接脚本、启动代码三者共同决定。 这一章把从"按下复位键"到"执行 ` main ` 第一行"之间发生的事完整拆开。

 

> ◷ 约 300 分钟 · ◈ 含链接脚本与启动流程实操 · ⚑ 内存模型 \+ 执行模型

 

```zhizhan-anchor
ch4-1
```



## 4.1 变量都住在哪：五个段 \+ 堆栈

 

一个编译好的程序被划分成若干 **段（section）** ，每个段有不同的属性（可读/可写/可执行）和存放介质（Flash/RAM）。 先说清一个容易含糊的地方：本章真正涉及的是  **5 个"段"** ——` .isr_vector `、` .text `、` .rodata `、` .data `、` .bss `； 再外加  **heap / stack**  这两块"不是段的空间"：它们没有段名，边界靠链接脚本里的 ` _end `、` _estack ` 这类符号划出来。 后面提到"某段"时，指的始终是前 5 个。

 

**FIG 4.1**  STM32 固件的完整内存布局

 

```zhizhan-figure
<svg viewBox="0 0 660 522" width="660" height="522" role="img" aria-label="STM32 内存布局：Flash、SRAM 与外设区">
          <defs>
            <marker id="ah6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <!-- ========== Flash 侧 ========== -->
          <text x="24" y="24" class="sv-lbl-hi" style="fill:var(--grn)">FLASH · 0x0800_0000 起 · 掉电不丢</text>
          <rect x="24" y="36" width="280" height="396" rx="8" class="sv-box" stroke="var(--grn)"></rect>

          <rect x="34" y="46" width="260" height="52" rx="5" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="46" y="66" class="sv-lbl-hi" style="fill:var(--vio)">.isr_vector</text>
          <text x="46" y="84" class="sv-lbl-dim">中断向量表 · 复位后 CPU 第一个读的地方</text>

          <rect x="34" y="103" width="260" height="86" rx="5" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="46" y="123" class="sv-lbl-hi" style="fill:var(--grn)">.text</text>
          <text x="46" y="141" class="sv-lbl-dim">机器码 · 所有函数体</text>
          <text x="46" y="159" class="sv-lbl-dim">int main(void){...}</text>
          <text x="46" y="177" class="sv-lbl-dim">只读，掉电保留</text>

          <rect x="34" y="194" width="260" height="62" rx="5" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="46" y="214" class="sv-lbl-hi" style="fill:var(--cyn)">.rodata</text>
          <text x="46" y="232" class="sv-lbl-dim">const 变量 · 字符串字面量 · 查找表</text>
          <text x="46" y="248" class="sv-lbl-dim">const uint16_t sin_lut[1024]</text>

          <rect x="34" y="261" width="260" height="62" rx="5" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="46" y="281" class="sv-lbl-hi" style="fill:var(--amb)">.data 的"初始值副本"</text>
          <text x="46" y="299" class="sv-lbl-dim">int g_baud = 115200; 的初值存在这里</text>
          <text x="46" y="315" class="sv-lbl-dim">启动时被拷贝到 SRAM</text>

          <!-- ========== SRAM 侧 ========== -->
          <text x="356" y="24" class="sv-lbl-hi" style="fill:var(--cyn)">SRAM · 0x2000_0000 起 · 掉电即失</text>
          <rect x="356" y="36" width="280" height="396" rx="8" class="sv-box" stroke="var(--cyn)"></rect>

          <rect x="366" y="46" width="260" height="52" rx="5" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="378" y="66" class="sv-lbl-hi" style="fill:var(--amb)">.data</text>
          <text x="378" y="84" class="sv-lbl-dim">已初始化全局/静态变量 · 有初值，占空间</text>

          <rect x="366" y="103" width="260" height="52" rx="5" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="378" y="123" class="sv-lbl-hi" style="fill:var(--grn)">.bss</text>
          <text x="378" y="141" class="sv-lbl-dim">未初始化变量 · 启动时全部清零，<tspan font-weight="700">不占 Flash</tspan></text>

          <rect x="366" y="160" width="260" height="60" rx="5" fill="var(--line)" stroke="var(--line-2)" stroke-dasharray="4 3"></rect>
          <text x="378" y="180" class="sv-lbl-hi" style="fill:var(--txt-2)">heap（堆）</text>
          <text x="378" y="198" class="sv-lbl-dim">malloc 区域 · 向上增长</text>
          <text x="378" y="213" class="sv-lbl-dim" style="fill:var(--red)">↓ 与栈相向而行 → 可能相撞</text>

          <rect x="366" y="225" width="260" height="34" rx="5" fill="var(--red-d)" stroke="var(--red)" stroke-dasharray="4 3"></rect>
          <text x="378" y="247" class="sv-lbl-dim" style="fill:var(--red)">⚠ 未使用空隙（可配置 _Min_Heap_Size）</text>

          <rect x="366" y="264" width="260" height="72" rx="5" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="378" y="284" class="sv-lbl-hi" style="fill:var(--vio)">stack（栈）</text>
          <text x="378" y="302" class="sv-lbl-dim">局部变量 · 函数调用帧 · 返回地址</text>
          <text x="378" y="317" class="sv-lbl-dim">↑ 向下增长（高地址 → 低地址）</text>
          <text x="378" y="332" class="sv-lbl-dim" style="fill:var(--red)">STM32 默认仅 1 KB！</text>

          <rect x="366" y="341" width="260" height="83" rx="5" fill="var(--card-2)" stroke="var(--line-2)"></rect>
          <text x="378" y="365" class="sv-lbl-dim">剩余 SRAM</text>
          <text x="378" y="385" class="sv-lbl-dim">未被 .data / .bss / heap / stack 占用</text>
          <text x="378" y="407" class="sv-lbl-dim" style="fill:var(--txt-dim)">SRAM 到此为止 · 0x2000_5000</text>

          <!-- 拷贝箭头 -->
          <path d="M 296 292 L 356 72" stroke="var(--amb)" stroke-width="1.4" stroke-dasharray="5 4" fill="none"></path>
          <path d="M 353 76 L 362 70 L 356 80" fill="var(--amb)"></path>

          <!-- ========== 外设区：与 Flash / SRAM 并列的第三个地址区 ========== -->
          <!-- 它不在上面任何一个框里：0x4000_0000 既不落在 Flash(0x0800_0000~) 也不落在 SRAM(0x2000_0000~) -->
          <rect x="24" y="450" width="612" height="54" rx="8" fill="var(--card-2)" stroke="var(--line-2)" stroke-dasharray="6 4"></rect>
          <text x="40" y="472" class="sv-lbl-hi">外设区 · 0x4000_0000 起（另有 0xE000_0000 的 PPB 私有外设区）</text>
          <text x="40" y="491" class="sv-lbl-dim">寄存器映射区 —— 既不是 Flash 也不是 SRAM，是第三个独立地址区；读写它就是在操作硬件（见模块 03）</text>
        </svg>
```

 

**关键认知** ：` .data ` 段的内容 *同时存在于 Flash 和 SRAM* ——初值烧在 Flash 里， 开机时拷贝到 SRAM。而 ` .bss `  **只占 SRAM 不占 Flash** ，因为它的值全是 0，硬件清零即可，不需要浪费 Flash 存一堆 0。   
  
  *这就是为什么"把大数组初始化成 0"和"初始化成非 0"，固件体积会差很多。*

 

sections.c — 每个变量落在哪个段 C

 

```text
#include <stdint.h>

/* ===== .text：代码段（Flash，只读可执行）===== */
void control_loop(void) { }              /* 函数体本身 */

/* ===== .rodata：只读数据段（Flash）===== */
const char     g_version[]  = "v1.0.0";           /* 字符串字面量 */
const uint16_t g_sin_lut[256] = { 0, 402, 803 };  /* 大查找表 */
const float    g_pi_const   = 3.14159f;
static const int s_calib[8] = { 1, 2, 3 };        /* static const 也在 .rodata */

/* ===== .data：已初始化数据段（Flash 初值副本 + SRAM 运行副本）===== */
int      g_baud      = 115200;        /* 全局，有初值 */
static int s_state    = 1;            /* 文件作用域静态，有初值 */
uint8_t  g_table[128] = { 1, 2, 3 };  /* ✕ 只需要前 3 个非零，却让整个 128 字节占 Flash */

/* ===== .bss：未初始化数据段（只占 SRAM）===== */
int      g_counter;                   /* 全局，无初值 */
static int s_cache[512];              /* 2 KB，不占 Flash */
uint8_t  g_rx_buffer[1024] = { 0 };   /* ✔ 显式写 ={0} 仍然进 .bss，不占 Flash */

/* ===== stack：栈（SRAM，自动管理）===== */
void process(void)
{
    int    local   = 1;
    char   buf[64];                   /* 64 字节栈空间 */
    /* 函数返回后 buf 自动失效 */
}

/* ===== heap：堆（SRAM，手动管理，嵌入式慎用）===== */
void dynamic(void)
{
    void *p = malloc(100);            /* 从堆分配 */
    free(p);
}

/* ---------- 一个重要的优化技巧 ---------- */

/* ✕ 浪费 Flash 的写法：128 字节全部要烧进 Flash */
uint8_t lut_bad[128] = {
    0x10, 0x20, 0x30,                      /* 3 个非零值 */
    /* 其余 125 个是 0，但因为是"部分初始化"，整个数组进 .data，占 128 字节 Flash */
};

/* ✔ 优化写法：拆成"常量表 + 运行时初始化"，或者放 Flash 里查表 */
const uint8_t lut_good[] = { 0x10, 0x20, 0x30 };   /* 只占 3 字节 Flash */
uint8_t       lut_ram[128];                        /* 进 .bss，不占 Flash */

void lut_init(void)
{
    for (size_t i = 0; i < sizeof lut_good; i++) {
        lut_ram[i] = lut_good[i];
    }
}
```

 

✔ 省 Flash 的三个实用技巧

 

 
1. **大数组尽量"全零"或以 ` ={0} ` 初始化** ，这样进 ` .bss `，不占 Flash。
 
2. **需要初始值的查找表，考虑放 ` const ` 直接从 Flash 读** ，不拷到 RAM（Cortex-M 可以像读内存一样读 Flash，无需 XIP 配置）。
 
3. **实在需要 RAM 副本时，用"小常量表 \+ 运行期展开"** 代替大数组初始化。

 

```zhizhan-anchor
ch4-2
```



## 4.2 从复位到 main：启动流程

 

上电瞬间，SRAM 里全是随机值，` .data ` 还没拷贝，` .bss ` 还没清零。  **是谁做了这些准备工作？答案是启动代码** ——在 ` main ` 之前运行的那段汇编。

 

**FIG 4.2**  从按下复位键到 ` main() ` 第一行

 

```zhizhan-figure
<svg viewBox="0 0 660 372" width="660" height="372" role="img" aria-label="STM32 启动流程">
          <defs>
            <marker id="ah7" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <!-- 步骤 -->
          <g>
            <rect x="30" y="16" width="368" height="46" rx="6" class="sv-box" stroke="var(--vio)"></rect>
            <text x="46" y="35" class="sv-lbl-hi" style="fill:var(--vio)">① 复位</text>
            <text x="46" y="53" class="sv-lbl-dim">CPU 从 0x0000_0000 读取前两个字：栈顶地址 + 复位向量</text>

            <path d="M 214 62 L 214 76" class="sv-arrow"></path>

            <rect x="30" y="80" width="368" height="46" rx="6" class="sv-box" stroke="var(--cyn)"></rect>
            <text x="46" y="99" class="sv-lbl-hi" style="fill:var(--cyn)">② 设置 SP 并跳到 Reset_Handler</text>
            <text x="46" y="117" class="sv-lbl-dim">SP ← 向量表[0]，PC ← 向量表[1]（由硬件自动完成）</text>

            <path d="M 214 126 L 214 140" class="sv-arrow"></path>

            <rect x="30" y="144" width="368" height="46" rx="6" class="sv-box" stroke="var(--amb)"></rect>
            <text x="46" y="163" class="sv-lbl-hi" style="fill:var(--amb)">③ 拷贝 .data</text>
            <text x="46" y="181" class="sv-lbl-dim">从 Flash 的 _sidata 拷到 SRAM 的 _sdata.._edata</text>

            <path d="M 214 190 L 214 204" class="sv-arrow"></path>

            <rect x="30" y="208" width="368" height="46" rx="6" class="sv-box" stroke="var(--amb)"></rect>
            <text x="46" y="227" class="sv-lbl-hi" style="fill:var(--amb)">④ 清零 .bss</text>
            <text x="46" y="245" class="sv-lbl-dim">把 _sbss.._ebss 区间全部写 0</text>

            <path d="M 214 254 L 214 268" class="sv-arrow"></path>

            <rect x="30" y="272" width="368" height="46" rx="6" class="sv-box" stroke="var(--grn)"></rect>
            <text x="46" y="291" class="sv-lbl-hi" style="fill:var(--grn)">⑤ 初始化时钟 / FPU → 调用 __libc_init_array</text>
            <text x="46" y="309" class="sv-lbl-dim">SystemInit() · 执行 C++ 全局构造函数 · 初始化标准库</text>

            <path d="M 214 318 L 214 332" class="sv-arrow"></path>

            <rect x="30" y="336" width="368" height="30" rx="6" class="sv-grn-s"></rect>
            <text x="46" y="356" class="sv-lbl-hi" style="fill:var(--grn)">⑥ 跳转到 main() —— 从此永不返回</text>
          </g>

          <!-- 右侧要点 -->
          <rect x="420" y="80" width="222" height="140" rx="7" class="sv-grn-s"></rect>
          <text x="436" y="102" class="sv-lbl-hi" style="fill:var(--grn)">为什么必须先拷 .data？</text>
          <text x="436" y="124" class="sv-lbl-dim" style="font-size:11px">Flash 是只读的（或写入代价极高），</text>
          <text x="436" y="141" class="sv-lbl-dim" style="font-size:11px">但 .data 里的变量需要可写，</text>
          <text x="436" y="158" class="sv-lbl-dim" style="font-size:11px">所以初值必须"搬"到 RAM。</text>
          <text x="436" y="182" class="sv-lbl-hi" style="fill:var(--grn)">为什么 bss 要清零？</text>
          <text x="436" y="202" class="sv-lbl-dim" style="font-size:11px">C 标准规定未初始化的静态变量</text>
          <text x="436" y="216" class="sv-lbl-dim" style="font-size:11px">初值为 0，但 SRAM 上电是随机值。</text>

          <rect x="420" y="236" width="222" height="130" rx="7" class="sv-amb-s"></rect>
          <text x="436" y="258" class="sv-lbl-hi" style="fill:var(--amb)">什么时候这段代码会出问题？</text>
          <text x="436" y="280" class="sv-lbl-dim" style="font-size:11px">① 链接脚本里的 _sdata/_edata</text>
          <text x="436" y="296" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;符号写错 → 拷贝越界，踩内存</text>
          <text x="436" y="316" class="sv-lbl-dim" style="font-size:11px">② 自定义 section 忘记在启动代码里</text>
          <text x="436" y="332" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;处理 → 变量值全是垃圾</text>
          <text x="436" y="352" class="sv-lbl-dim" style="font-size:11px">③ 栈顶地址设错 → 一进 main 就 HardFault</text>
        </svg>
```

 

这六步全部发生在 ` main ` 之前。 **这就是为什么"程序还没进 main 就死了"是可能的** —— 问题就出在启动代码或链接脚本上。

 

```zhizhan-anchor
ch4-2-1
```



### 4.2.1 启动文件的关键片段

 

startup\_stm32f103.s — 核心部分（GNU as 语法） ASM

 

```text
    /* ★ 这三行不是可有可无的装饰，缺了它汇编器会报
       "instruction not supported in Thumb16 mode"。
       原因见紧跟着的说明框。 */
    .syntax unified                          /* 用统一语法：movs/adds 这类写法才被接受 */
    .cpu    cortex-m3
    .thumb

    .section  .isr_vector,"a",%progbits      /* 向量表放在 Flash 最开头 */
    .type     g_pfnVectors, %object
g_pfnVectors:
    .word  _estack                            /* ① 第 0 项：栈顶地址 */
    .word  Reset_Handler                      /* ② 第 1 项：复位入口 */
    .word  NMI_Handler
    .word  HardFault_Handler
    .word  MemManage_Handler
    .word  BusFault_Handler
    .word  UsageFault_Handler
    .word  0                                  /* 保留 */
    /* ... 共 60+ 个中断入口 ... */
    .word  SysTick_Handler

    .section  .text.Reset_Handler
    .weak  Reset_Handler
    .type  Reset_Handler, %function
Reset_Handler:
    /* ---- 第 1 步：拷贝 .data ---- */
    ldr   r0, =_sdata          /* 目标起始（SRAM） */
    ldr   r1, =_edata          /* 目标结束 */
    ldr   r2, =_sidata         /* 源起始（Flash） */
    movs  r3, #0
    b     LoopCopyDataInit

CopyDataInit:
    ldr   r4, [r2, r3]         /* 从 Flash 读一个字 */
    str   r4, [r0, r3]         /* 写到 SRAM */
    adds  r3, r3, #4
LoopCopyDataInit:
    adds  r4, r0, r3
    cmp   r4, r1
    bcc   CopyDataInit         /* 没拷完就继续 */

    /* ---- 第 2 步：清零 .bss ---- */
    ldr   r2, =_sbss
    ldr   r4, =_ebss
    movs  r3, #0
    b     LoopFillZerobss
FillZerobss:
    str   r3, [r2]             /* 写 0 */
    adds  r2, r2, #4
LoopFillZerobss:
    cmp   r2, r4
    bcc   FillZerobss

    /* ---- 第 3 步：系统初始化 + 调 main ---- */
    bl    SystemInit           /* 配时钟、配 FPU、配外部 RAM */
    bl    __libc_init_array    /* 执行 C++ 全局构造 / 初始化标准库 */
    bl    main                 /* 进 main，正常情况永不返回 */
    bx    lr

    .size  Reset_Handler, .-Reset_Handler
```

 

⚠ 开头那三行 ` .syntax unified / .cpu / .thumb ` 不能省

 

GNU 汇编器对 ARM 有 **两套互不兼容的语法** ：

 

 
- **divided syntax** （老语法，ARM 官方旧汇编器遗留）——没有独立的 ` adds ` 助记符， 进位标志的写法是 ` add r3, r3, #4, S ` 这种"后缀 S"形式。
 
- **unified syntax** （统一语法）——` adds ` / ` add ` 是两个不同的助记符， 和 ARM 官方汇编手册、和 ST 的启动文件写法一致。
 

 

而 GNU as 在 ARM 上的默认语法 **取决于目标** ：非 Thumb 默认 divided，Thumb 下想用 unified 就必须显式声明。 上面这段用了 ` adds r3, r3, #4 `（unified 写法），若不加 ` .syntax unified `， 汇编器会按老语法去匹配 Thumb-16 指令，匹配不上就报 ` Error: instruction not supported in Thumb16 mode -- 'adds r3,r3,#4' `。

 

**实践规则** ：手写（或从 ST 官方 ` startup_*.s ` 抄）ARM 汇编时， 文件头永远写上 ` .syntax unified `、` .cpu `、` .thumb ` 这三行。 ` .cpu ` 还顺带告诉汇编器"哪些指令可用"——比如写 ` .cpu cortex-m3 ` 之后， M3 没有的 ` sdiv ` 就会直接报错，而不是悄悄编出一段在真芯片上跑飞的代码。

 

◆ 从这段汇编读懂三件事

 

 
1. **` _sdata ` / ` _edata ` / ` _sidata ` / ` _sbss ` / ` _ebss ` 这些符号不是 C 变量** ， 它们是 *链接脚本里定义的位置标记* 。链接器在生成最终镜像时把这些名字替换成实际地址。
 
2. **栈顶地址 ` _estack ` 也来自链接脚本** 。它决定了你的栈从 SRAM 的哪个位置开始向下生长。
 
3. **` bl main ` 之后是 ` bx lr `** ——但 ` lr ` 的值取决于进入 ` Reset_Handler ` 时的状态。 如果 ` main ` 真的返回了，程序会跳到未定义的地方。 **所以嵌入式 ` main ` 必须是无限循环** 。

 

```zhizhan-anchor
ch4-2-2
```



### 4.2.2 一份"真的能汇编、真的能链接"的启动文件

 

上面那段是 **节选** ——中间那句 ` /* ... 共 60+ 个中断入口 ... */ ` 意味着你照抄下来是编不过的。而"启动文件为什么能不改就覆盖中断"这件事， 恰恰藏在被省略掉的那 60 多行里。

 

所以这一节给出 **一份完整的、我逐条跑过的最小启动文件** ： 它真的被 ` arm-none-eabi-gcc -c ` 汇编过，也真的被 ` arm-none-eabi-ld ` 链接成了一个能看的 ELF。 下面出现的每一个地址，都是从那两个真的产物里读出来的。

 

startup\_min.s — 完整的最小启动文件（GNU as 语法，可汇编可链接） ASM

 

```text
/*============================================================================
 * startup_min.s —— Cortex-M3 最小可用启动文件（GNU as 语法）
 *
 * 演示 GNU 汇编器的 weak 别名机制：
 *   .weak 符号   + .thumb_set 别名, 目标
 * 向量表里写的是"弱符号" NMI_Handler / SVC_Handler / ...，
 * 它们默认指向 Default_Handler；用户只要在 C 文件里写一个同名函数，
 * 链接期强符号胜出，向量表那一格自动改指用户的函数，启动文件一个字节都不用改。
 *============================================================================*/

    .syntax unified        /* 统一汇编语法（ARM + Thumb 指令集写法一致）*/
    .cpu cortex-m3         /* 目标内核 */
    .fpu softvfp           /* 软浮点 */
    .thumb                 /* 后续指令按 Thumb 编码 */

/*--------------------------------------------------------------------------
 * 中断向量表：必须放在 Flash 最开头（0x08000000），复位后内核从这里取
 * 第 1 个字作为栈顶、第 2 个字作为复位入口。
 *------------------------------------------------------------------------*/
    .section .isr_vector, "a", %progbits
    .global  g_pfnVectors           /* 导出，方便调试器/其他文件引用向量表 */
    .type    g_pfnVectors, %object
g_pfnVectors:
    .word   _estack                 /* 0x00 初始主栈指针 MSP（由链接脚本提供）*/
    .word   Reset_Handler           /* 0x04 复位入口 */
    .word   NMI_Handler             /* 0x08 NMI */
    .word   HardFault_Handler       /* 0x0C 硬件错误 */
    .word   MemManage_Handler       /* 0x10 MPU 错误 */
    .word   BusFault_Handler        /* 0x14 总线错误 */
    .word   UsageFault_Handler      /* 0x18 用法错误 */
    .word   0                       /* 0x1C 保留 */
    .word   0
    .word   0
    .word   0
    .word   SVC_Handler             /* 0x2C 系统服务调用 */
    .word   DebugMon_Handler        /* 0x30 调试监控 */
    .word   0                       /* 0x34 保留 */
    .word   PendSV_Handler          /* 0x38 可挂起系统调用（RTOS 用）*/
    .word   SysTick_Handler         /* 0x3C 系统滴答定时器 */
    .size   g_pfnVectors, . - g_pfnVectors   /* 必须放在表尾：. 减去起始标签才是真实长度 */

/*--------------------------------------------------------------------------
 * 复位处理：拷 .data、清 .bss、跳 main
 *------------------------------------------------------------------------*/
    .section .text.Reset_Handler, "ax", %progbits
    .global Reset_Handler           /* 必须导出！否则链接脚本 ENTRY(Reset_Handler) 找不到它 */
    .type   Reset_Handler, %function
Reset_Handler:
    /* 1. 把 .data 的初值从 Flash(_sidata) 搬到 RAM(_sdata ~ _edata) */
    ldr     r0, = _sdata            /* 目的地：RAM 起点 */
    ldr     r1, = _edata            /* 目的地：RAM 终点 */
    ldr     r2, = _sidata           /* 源：Flash 里的初值副本 */
    movs    r3, #0
    b       .Ldata_check
.Ldata_loop:
    ldr     r4, [r2, r3]            /* 取一个字 */
    str     r4, [r0, r3]            /* 存一个字 */
    adds    r3, r3, #4
.Ldata_check:
    adds    r4, r0, r3
    cmp     r4, r1
    bcc     .Ldata_loop

    /* 2. 清零 .bss(_sbss ~ _ebss) */
    ldr     r2, = _sbss
    ldr     r4, = _ebss
    movs    r3, #0
    b       .Lbss_check
.Lbss_loop:
    str     r3, [r2]
    adds    r2, r2, #4
.Lbss_check:
    cmp     r2, r4
    bcc     .Lbss_loop

    /* 3. 进 C 世界 */
    bl      main

    /* 4. main 不该返回；万一返回了就在这里趴窝，方便调试器看到 */
.Lhang:
    b       .Lhang
    .size   Reset_Handler, . - Reset_Handler

/*--------------------------------------------------------------------------
 * 默认中断服务程序：所有没被用户覆盖的中断都落到这里
 *------------------------------------------------------------------------*/
    .section .text.Default_Handler, "ax", %progbits
    .type   Default_Handler, %function
Default_Handler:
.Ldefault_loop:
    b       .Ldefault_loop          /* 原地死循环，等调试器/看门狗 */
    .size   Default_Handler, . - Default_Handler

/*--------------------------------------------------------------------------
 * 弱别名：向量表里的这些名字默认等于 Default_Handler。
 *
 * 机制（已实测）：
 *   .thumb_set 单独使用只会产生一个"文件内局部符号"(LOCAL)。那样用户即使在
 *   C 文件里写了同名函数，链接器也不会拿它去覆盖局部符号 —— 中断仍然落进
 *   Default_Handler，而且**不报任何错**（ld 退出码 0），属于典型静默失败。
 *   必须用 .weak 把它提升为全局弱符号(WEAK)，用户的强符号才能在链接期胜出。
 *
 * 注意：.weak 与 .thumb_set 的先后顺序无所谓。
 *   实测把两行对调，目标文件里 SVC_Handler 依然是 WEAK，最终结果完全一致。
 *   （真正起作用的只有"有没有 .weak"，与它写在哪一行无关。）
 *------------------------------------------------------------------------*/
    .weak   NMI_Handler
    .thumb_set NMI_Handler, Default_Handler

    .weak   HardFault_Handler
    .thumb_set HardFault_Handler, Default_Handler

    .weak   MemManage_Handler
    .thumb_set MemManage_Handler, Default_Handler

    .weak   BusFault_Handler
    .thumb_set BusFault_Handler, Default_Handler

    .weak   UsageFault_Handler
    .thumb_set UsageFault_Handler, Default_Handler

    .weak   SVC_Handler
    .thumb_set SVC_Handler, Default_Handler

    .weak   DebugMon_Handler
    .thumb_set DebugMon_Handler, Default_Handler

    .weak   PendSV_Handler
    .thumb_set PendSV_Handler, Default_Handler

    .weak   SysTick_Handler
    .thumb_set SysTick_Handler, Default_Handler

    .end
```

 

配套的用户文件只有  **23 行** ，而且 **完全不需要知道启动文件长什么样** ：

 

startup\_user.c — 用户侧：写一个同名函数，就接管了这个中断 C

 

```text
/*============================================================================
 * startup_user.c —— 用户侧：只用一个同名 C 函数覆盖弱别名 SVC_Handler
 * 完全不需要改启动文件 startup_min.s
 *============================================================================*/
#include <stdint.h>

volatile uint32_t svc_count = 0;

/* 这个名字和启动文件里 .weak SVC_Handler 完全一致。
 * 链接器看到强符号（本函数）与弱符号（Default_Handler 的别名）重名，
 * 会采用强符号，于是向量表 0x2C 那一格自动指向这里。 */
void SVC_Handler(void)
{
    svc_count++;          /* 随便干点事，证明这里确实是用户代码 */
}

/* main 也要有，否则 Reset_Handler 里的 bl main 解析不了 */
int main(void)
{
    for (;;) {
        SVC_Handler();    /* 空转调用一下，避免被优化掉 */
    }
}
```

 

把这个用户文件换成"只提供 ` main `、不覆盖任何中断"的版本， 其余一切不变，就能做 A/B 对照。先把三件东西真的跑一遍：

 

**bash**  — 三份文件各自编译、然后真的链一次

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c startup_min.s -o startup_min.o
（无任何输出）
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c startup_user.c -o startup_user.o
（无任何输出）
$ arm-none-eabi-ld -T startup.ld startup_min.o startup_user.o -o startup.elf
（无任何输出）

三条命令的退出码都是 0 —— 没有警告，也没有"未定义符号"。
注意链接那一步：启动文件里 bl main / bl SystemInit 之类的引用都必须被满足，
而这里只给了 startup_min.o 和 startup_user.o 两个目标文件，没有 libc。
```

 

链接脚本本身也是这一节的一部分——向量表必须在 Flash 最前面，而且不能被 ` --gc-sections ` 当成"没人引用"回收掉：

 

startup.ld — 配套链接脚本：KEEP 住向量表，给 .data 分好 LMA / VMA LINKER

 

```text
/*============================================================================
 * startup.ld —— Cortex-M3 最小链接脚本
 *   Flash 起始 0x08000000, RAM 起始 0x20000000
 *============================================================================*/
ENTRY(Reset_Handler)

MEMORY
{
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

/* 栈顶 = RAM 末尾，向量表第 0 个字用的就是它 */
_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
    /* 向量表必须钉在 Flash 最前面，KEEP 防止 --gc-sections 把它回收 */
    .isr_vector :
    {
        . = ALIGN(4);
        KEEP(*(.isr_vector))
        . = ALIGN(4);
    } > FLASH

    .text :
    {
        . = ALIGN(4);
        *(.text)
        *(.text*)
        *(.rodata)
        *(.rodata*)
        . = ALIGN(4);
    } > FLASH

    /* .data 的"存储地址"（LMA）在 Flash 里，紧跟 .text */
    _sidata = LOADADDR(.data);

    .data :
    {
        . = ALIGN(4);
        _sdata = .;
        *(.data)
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH

    .bss :
    {
        . = ALIGN(4);
        _sbss = .;
        *(.bss)
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
    } > RAM

    .ARM.attributes 0 : { *(.ARM.attributes) }
}
```

 

现在看链接结果。 **第一份证据是符号表** ：

 

**bash**  — ` arm-none-eabi-nm -n startup.elf `（变体 A：有用户覆盖）

 

```text
$ arm-none-eabi-nm -n startup.elf
08000000 R g_pfnVectors   ← 向量表自己也在 0x08000000
08000040 T SVC_Handler   ← 强符号 T：用户的实现赢了
0800005c T main
08000068 T Reset_Handler
080000a8 W BusFault_Handler
080000a8 W DebugMon_Handler
080000a8 t Default_Handler
080000a8 W HardFault_Handler   ← 弱符号 W：仍是别名
080000a8 W MemManage_Handler
080000a8 W NMI_Handler   ← 弱符号 W：仍是别名
080000a8 W PendSV_Handler   ← 弱符号 W：仍是别名
080000a8 W SysTick_Handler   ← 弱符号 W：仍是别名
080000a8 W UsageFault_Handler
080000ac A _sidata
20000000 D _edata
20000000 B _sbss
20000000 D _sdata
20000000 B svc_count
20000004 B _ebss
20010000 R _estack   ← 向量表第 0 个字用的就是它
```

 

◆ 一句话读法：` W ` 是弱符号，` T ` 是强符号

 

` nm ` 的第二列是 **符号类型** ，大小写还有讲究：  **大写 = 全局（其他目标文件看得见）** ， **小写 = 文件内局部** 。 于是在这份输出里：

 

 
- ` 08000040 T SVC_Handler ` —— 大写 ` T `，是 **用户** 在 ` startup_user.c ` 里写的那个 **全局强符号** 。
 
- ` 080000a8 W NMI_Handler ` —— 大写 ` W `，  **全局弱符号** 。它来自启动文件里的 ` .weak `， 目前仍指向 ` Default_Handler `（同一个地址 0x080000a8）。
 
- ` 080000a8 t Default_Handler ` —— 小写 ` t `，  **局部符号** 。它只在 ` startup_min.s ` 内部可见， 这正是它能被 ` .thumb_set ` 拿去做别名的原因。
 

 

**注意 SVC\_Handler 一个都没出现在 0x080000a8 那一堆里** —— 用户提供了强定义，那个弱别名就在这次链接里 **彻底消失了** ，连符号表都不留。

 

**第二份证据是向量表里的原始字节** 。符号表只说"符号叫什么、在哪"， 但内核真正读的是 Flash 里那 4 个字节。这两者对上了，才算真的看懂：

 

**bash**  — ` arm-none-eabi-objdump -s -j .isr_vector startup.elf `

 

```text
$ arm-none-eabi-objdump -s -j .isr_vector startup.elf
 8000000 00000120 69000008 a9000008 a9000008  ... i...........
 8000010 a9000008 a9000008 a9000008 00000000  ................
 8000020 00000000 00000000 00000000 41000008  ............A...   ← 0x2C 那一格变成了 41 00 00 08
 8000030 a9000008 00000000 a9000008 a9000008  ................

小端解码（每 4 个字节一个向量）：
  0x00: 00 00 01 20 → 0x20010000  _estack（初始 MSP）
  0x04: 69 00 00 08 → 0x08000069  Reset_Handler（0x08000068 | 1）
  0x08: a9 00 00 08 → 0x080000a9  NMI_Handler    → 默认实现（弱，没人覆盖）
  0x2C: 41 00 00 08 → 0x08000041  SVC_Handler    → 用户函数（0x08000040 | 1）

→ 对比一下 nm：0x08000041 去掉最低位就是 nm 里的 0x08000040，正是用户的 SVC_Handler。
→ 那个最低位的 1 是 Thumb 位（模块 03 的 §3.10 已经算过这笔账）。
```

 

**FIG 4.3**  弱符号覆盖：链接器在"强"与"弱"之间做的一次选择

 

```zhizhan-figure
<svg viewBox="0 0 660 376" width="660" height="376" role="img" aria-label="弱符号被强符号覆盖的链接期决策">
          <defs>
            <marker id="ah16" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cyn)"></path>
            </marker>
            <marker id="ah17" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--red)"></path>
            </marker>
            <marker id="ah18" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <text x="30" y="22" class="sv-lbl-hi" style="fill:var(--cyn)">① 编译期：启动文件里全是"弱名字"</text>
          <rect x="30" y="32" width="252" height="98" rx="6" class="sv-cyn-s"></rect>
          <text x="44" y="52" class="sv-lbl-hi">startup_min.s</text>
          <text x="44" y="72" class="sv-t">    .weak  SVC_Handler</text>
          <text x="44" y="90" class="sv-t">    .thumb_set SVC_Handler, Default_Handler</text>
          <text x="44" y="110" class="sv-t">    .weak  NMI_Handler</text>
          <text x="44" y="124" class="sv-t">    .thumb_set NMI_Handler, Default_Handler</text>

          <rect x="30" y="144" width="252" height="66" rx="6" class="sv-grn-s"></rect>
          <text x="44" y="164" class="sv-lbl-hi" style="fill:var(--grn)">startup_user.c</text>
          <text x="44" y="184" class="sv-t">void SVC_Handler(void) { ... }</text>
          <text x="44" y="202" class="sv-lbl-dim">（只有 .c 这一份，没碰 .s）</text>

          <path d="M 146 210 L 146 244" stroke="var(--cyn)" stroke-width="1.4" fill="none" marker-end="url(#ah16)"></path>
          <path d="M 186 210 L 186 244" stroke="var(--red)" stroke-width="1.4" fill="none" marker-end="url(#ah17)"></path>

          <rect x="30" y="250" width="252" height="104" rx="6" class="sv-box" stroke="var(--amb)"></rect>
          <text x="44" y="270" class="sv-lbl-hi" style="fill:var(--amb)">② 链接期：同名符号二选一</text>
          <text x="44" y="292" class="sv-lbl-dim" style="font-size:11px">强符号（T）胜过弱符号（W）——</text>
          <text x="44" y="308" class="sv-lbl-dim" style="font-size:11px">这是链接器的规则，不是编译器的优化。</text>
          <text x="44" y="328" class="sv-lbl-hi" style="fill:var(--red)">SVC_Handler → 0x08000040（用户的）</text>
          <text x="44" y="346" class="sv-lbl-hi" style="fill:var(--cyn)">NMI_Handler → 0x080000a8（默认的）</text>

          <!-- 右：向量表 -->
          <text x="330" y="22" class="sv-lbl-hi" style="fill:var(--grn)">③ 最终镜像：向量表的字节说了算</text>
          <rect x="330" y="32" width="300" height="322" rx="7" class="sv-box"></rect>

          <text x="346" y="56" class="sv-lbl-dim">偏移</text>
          <text x="410" y="56" class="sv-lbl-dim">Flash 里的 4 个字节</text>
          <text x="536" y="56" class="sv-lbl-dim">内核跳到</text>
          <path d="M 346 64 L 614 64" class="sv-dash"></path>

          <text x="346" y="86" class="sv-lbl-dim">0x00</text>
          <text x="410" y="86" class="sv-lbl-hi">00 00 01 20</text>
          <text x="536" y="86" class="sv-lbl" style="fill:var(--cyn)">_estack</text>

          <text x="346" y="114" class="sv-lbl-dim">0x04</text>
          <text x="410" y="114" class="sv-lbl-hi">69 00 00 08</text>
          <text x="536" y="114" class="sv-lbl" style="fill:var(--grn)">Reset_Handler</text>

          <text x="346" y="142" class="sv-lbl-dim">0x08</text>
          <rect x="404" y="126" width="122" height="22" class="sv-cyn-s"></rect>
          <text x="410" y="142" class="sv-lbl-hi">a9 00 00 08</text>
          <text x="536" y="142" class="sv-lbl" style="fill:var(--cyn)">Default_Handler</text>

          <text x="346" y="176" class="sv-lbl-dim">…</text>
          <text x="346" y="200" class="sv-lbl-dim">0x2C</text>
          <rect x="404" y="184" width="122" height="22" class="sv-red-s"></rect>
          <text x="410" y="200" class="sv-lbl-hi">41 00 00 08</text>
          <text x="536" y="200" class="sv-lbl-hi" style="fill:var(--red)">用户的 SVC_Handler</text>

          <text x="346" y="230" class="sv-lbl-dim">…</text>
          <path d="M 346 244 L 614 244" class="sv-dash"></path>

          <text x="346" y="268" class="sv-lbl-hi" style="fill:var(--grn)">◆ 青框 = 弱别名还挂在默认实现上</text>
          <text x="346" y="292" class="sv-lbl-hi" style="fill:var(--red)">◆ 红框 = 用户覆盖生效，这一格换了地址</text>
          <text x="346" y="320" class="sv-t">两个地址的最低位都是 1（Thumb 位），</text>
          <text x="346" y="338" class="sv-t">真实函数地址是 …a8 / …40，都是偶数。</text>
        </svg>
```

 

**整套机制的收益是"改中断不用动启动文件"** ——启动文件由芯片厂商提供、被几十个工程共享， 改它是维护灾难；而 ` .weak ` 让"覆盖"变成了一件在你自己 ` .c ` 里就能完成的事。  *代价是：写错名字（比如把 ` SVC_Handler ` 拼成 ` Svc_Handler `） 不会有任何报错——链接器只会认为"没人覆盖，用默认的"，然后你的中断继续落进 ` Default_Handler ` 原地死循环。*

 

#### 反面教材：把 9 行 ` .weak ` 删掉，链接器一声不吭

 

` startup_min.s ` 里一共写了  **9 行**  ` .weak `， 每行下面跟一行 ` .thumb_set `。如果觉得"两行做同一件事很啰嗦"， 只留 ` .thumb_set `—— **代码照样汇编、照样链接、退出码 0、零警告** 。 然后中断就再也进不来了。

 

下面这条 ` sed ` 按"行里出现 ` .weak `"来删， 所以我先数清楚它到底删掉几行： **13 行** ——9 行指令，外加 4 行 *正文注释里提到 ` .weak `*  的行。注释删不删不影响产物，这一点我实测过： 两种删法（删 13 行 / 只删 9 行指令）编出来的 ` nm ` 与向量表字节  **逐字节相同** 。之所以不在正文里假装"只删了 9 行"，是因为你复制这条命令去跑， ` git diff ` 会如实告诉你它动了 13 行。

 

**bash**  — 删掉 ` .weak `（13 行）之后（变体 B）， **链接依然是退出码 0**

 

```text
$ sed -i '/\.weak/d' startup_min.s          # 删掉 13 行（9 行指令 + 4 行注释），其余一字不动
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c startup_min.s -o startup_min.o
$ arm-none-eabi-ld -T startup.ld startup_min.o startup_user.o -o nw.elf
（退出码 0 —— 没有 warning，也没有 error）
$ arm-none-eabi-nm -n nw.elf
08000000 R g_pfnVectors
08000040 T SVC_Handler   ← 用户的强符号【还在】，只是没人用它
0800005c T main
08000068 T Reset_Handler
080000a8 t BusFault_Handler
080000a8 t DebugMon_Handler
080000a8 t Default_Handler
080000a8 t HardFault_Handler   ← 全都从 W 变成了小写 t
080000a8 t MemManage_Handler
080000a8 t NMI_Handler   ← 全都从 W 变成了小写 t
080000a8 t PendSV_Handler   ← 全都从 W 变成了小写 t
080000a8 t SVC_Handler   ← 启动文件里的那个，变成了【局部】符号
080000a8 t SysTick_Handler   ← 全都从 W 变成了小写 t
080000a8 t UsageFault_Handler
080000ac A _sidata
20000000 D _edata
20000000 B _sbss
20000000 D _sdata
20000000 B svc_count
20000004 B _ebss
20010000 R _estack

$ arm-none-eabi-objdump -s -j .isr_vector nw.elf   # 只看 0x20 那一行
 8000020 00000000 00000000 00000000 a9000008  ................

→ 0x2C 那一格现在是 a9 00 00 08 = 0x080000a9 = Default_Handler。
→ 用户写的 SVC_Handler 躺在 0x08000040，一个字节都没错，只是向量表没指向它。
```

 

✕ 为什么 ` .thumb_set ` 单独用会"静默失效"

 

GNU 汇编器里， **标签默认是文件内局部符号** 。所以：

 

 
- ` .thumb_set SVC_Handler, Default_Handler `  **单独出现时** ， 产生的是一个 **局部** 别名——符号表里是小写 ` t `。 局部符号 **不参与跨目标文件的符号解析** ，链接器根本看不见它， 自然也就不会拿用户的强符号去覆盖它。
 
- ` .weak SVC_Handler ` 做的事是 **把名字提升为全局弱符号** （大写 ` W `）。 只有到了"全局"这一层，链接器才有机会做"强胜弱"的选择。
 

 

上面那份 ` nm ` 输出是这件事最直白的证据： **同一个 ELF 里出现了两个 ` SVC_Handler `** ——一个 ` T ` 在 0x08000040， 一个 ` t ` 在 0x080000a8。 **链接器不认为它们冲突** ，所以不报错； 而向量表引用的是同一文件里的那个局部符号，指向 0x080000a8。

 

**工程规则** ：在 GNU as 里写弱别名，` .weak ` 和 ` .thumb_set `  **必须成对出现** 。 它们的 **先后顺序无所谓** （两种顺序我都跑过，产物逐字节相同），  **但 ` .weak ` 不能省** 。

 

⚠ 另外两个"看起来只是风格问题"的坑，都会真的出事

 

 
1. **` Reset_Handler ` 必须写 ` .global `** 。 GNU as 里标签默认局部，而 ` ENTRY(Reset_Handler) ` 要求它是个全局符号。 漏了这行，链接器会给出 ` warning: cannot find entry symbol Reset_Handler; defaulting to 08000040 `——  **它是 warning 不是 error** ，镜像照样生成，只是入口地址变成了"链接器随便挑的一个"。 在真芯片上这意味着复位后跳到一段随机的代码上。  *修好之后我把两次的向量表字节对了一遍：完全一致——` .global ` 只影响符号可见性，不影响任何地址。*
 
2. **` .size g_pfnVectors, . - g_pfnVectors ` 必须写在表的末尾** 。 写成两行、把 ` .size ` 放在标签 **前面** 也是合法汇编， 但 ` . `（当前位置计数器）此时还等于标签自身， 算出来的长度是  **0** 。我从 ` readelf ` 里看到这个症状： ` g_pfnVectors ` 的 size 显示成 0，而正确写法下是 ` 0x40 `（16 个向量 × 4 字节）。 **一个 size 为 0 的向量表， ` --gc-sections ` 会毫不犹豫地把它回收掉** ——因为"没人引用它"。

 

```zhizhan-anchor
ch4-2-3
```



### 4.2.3 向量表放在哪：` SCB->VTOR ` 与那句绕不过去的"手册规定"

 

上一节解决了" **谁** 来处理中断"。这一节解决另一半：中断发生时， CPU 怎么知道 **去哪找** 那张向量表。

 

Cortex-M 的答案是：有一张表，表里第  *n*  个 32 位字就是第  *n*  号异常的处理函数地址。 复位时表固定在 ` 0x00000000 `，而 STM32 通过  *boot 引脚的地址重映射*  把 Flash 的 ` 0x08000000 ` 映射到那里。问题是： **如果你想把这张表搬进 RAM （比如做固件升级 / 双分区跳转 / 动态改中断），地址就变了，硬件得被告知新地址。**

 

告知的途径是 ` SCB->VTOR `。我写了一个 **自带最小 SCB 定义、不依赖 CMSIS**  的文件来把这件事压到底：

 

vtor\_demo.c — 自己定义 SCB，只为看清 SCB-\>VTOR = p 编成什么 C

 

```text
/*============================================================================
 * vtor_demo.c —— 向量表重定位 SCB->VTOR
 *
 * 自带最小 SCB 结构体定义，不依赖 CMSIS 头文件。
 * 目的：看清 SCB->VTOR = p; 在 Cortex-M3 上到底编成哪条指令。
 *============================================================================*/
#include <stdint.h>

/* ---------------------------------------------------------------------------
 * System Control Block 基地址（ARMv7-M 私有外设区）
 * 手册规定：SCB 基址 = 0xE000ED00
 * ------------------------------------------------------------------------ */
#define SCB_BASE        0xE000ED00u

/* 手册规定：VTOR 相对 SCB 基址的偏移 = 0x08
 * 即 VTOR 的绝对地址 = 0xE000ED08
 * （VTOR 的 bit0..bit6 在 ARMv7-M 上保留，为向量表的 128 字节对齐要求预留） */
#define SCB_VTOR_OFFSET 0x08u

typedef struct {
    volatile uint32_t CPUID;    /* 0xE000ED00  0x00 CPU ID */
    volatile uint32_t ICSR;     /* 0xE000ED04  0x04 中断控制状态 */
    volatile uint32_t VTOR;     /* 0xE000ED08  0x08 <<< 向量表偏移寄存器 */
    volatile uint32_t AIRCR;    /* 0xE000ED0C  0x0C 应用中断复位控制 */
    volatile uint32_t SCR;      /* 0xE000ED10  0x10 系统控制 */
    volatile uint32_t CCR;      /* 0xE000ED14  0x14 配置控制 */
    volatile uint8_t  SHP[12];  /* 0xE000ED18  0x18 系统异常优先级（8/16/32 位视图）*/
    volatile uint32_t SHCSR;    /* 0xE000ED24  0x24 系统处理控制状态 */
    volatile uint32_t CFSR;     /* 0xE000ED28  0x28 可配置错误状态 */
    volatile uint32_t HFSR;     /* 0xE000ED2C  0x2C 硬错误状态 */
    volatile uint32_t DFSR;     /* 0xE000ED30  0x30 调试错误状态 */
    volatile uint32_t MMFAR;    /* 0xE000ED34  0x34 内存管理错误地址 */
    volatile uint32_t BFAR;     /* 0xE000ED38  0x38 总线错误地址 */
    volatile uint32_t AFSR;     /* 0xE000ED3C  0x3C 辅助错误状态 */
} SCB_Type;

#define SCB  ((SCB_Type *) SCB_BASE)

/* ---------------------------------------------------------------------------
 * 把向量表挪到 new_table 指向的内存（通常是 RAM）
 * ------------------------------------------------------------------------ */
void relocate_vectors(uint32_t *new_table)
{
    SCB->VTOR = (uint32_t)new_table;
}

/* ---------------------------------------------------------------------------
 * 读回当前向量表基址
 * ------------------------------------------------------------------------ */
uint32_t read_vtor(void)
{
    return SCB->VTOR;
}

/* ---------------------------------------------------------------------------
 * 额外验证（可选）：新向量表必须对齐。
 * 这里强制 0x200 对齐 —— 对齐要求本身来自 ARMv7-M 手册，
 * 下面这段只是实测"加了 aligned 之后地址真的是 0x200 的整数倍"。
 * ------------------------------------------------------------------------ */
__attribute__((aligned(0x200))) uint32_t ram_vector_table[48];

void relocate_to_ram(void)
{
    ram_vector_table[0] = 0x20010000u;   /* 新栈顶（随意填一个值）*/
    relocate_vectors(ram_vector_table);
}
```

 

这个文件只有 66 行，其中大半是 **为了不引入 CMSIS 而手抄的结构体布局** 。 真正干活的只有一句：` SCB->VTOR = (uint32_t)new_table; `。 编出来看看：

 

**bash**  — 编译后用 objdump 看指令（以下输出为原样转录）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -c vtor_demo.c -o vt.o
$ arm-none-eabi-objdump -d vt.o

vt.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <relocate_vectors>:
   0:	4b01      	ldr	r3, [pc, #4]	@ (8 <relocate_vectors+0x8>)
   2:	6098      	str	r0, [r3, #8]
   4:	4770      	bx	lr
   6:	bf00      	nop
   8:	e000ed00 	.word	0xe000ed00

0000000c <read_vtor>:
   c:	4b01      	ldr	r3, [pc, #4]	@ (14 <read_vtor+0x8>)
   e:	6898      	ldr	r0, [r3, #8]
  10:	4770      	bx	lr
  12:	bf00      	nop
  14:	e000ed00 	.word	0xe000ed00

00000018 <relocate_to_ram>:
  18:	4b02      	ldr	r3, [pc, #8]	@ (24 <relocate_to_ram+0xc>)
  1a:	4903      	ldr	r1, [pc, #12]	@ (28 <relocate_to_ram+0x10>)
  1c:	4a03      	ldr	r2, [pc, #12]	@ (2c <relocate_to_ram+0x14>)
  1e:	6019      	str	r1, [r3, #0]
  20:	6093      	str	r3, [r2, #8]
  22:	4770      	bx	lr
  24:	00000000 	.word	0x00000000
  28:	20010000 	.word	0x20010000
  2c:	e000ed00 	.word	0xe000ed00
```

 

三件事被这三行汇编钉死了：

 

 
1. **` SCB->VTOR = p ` 就是一条 ` str `。**  没有函数调用、没有加锁、没有副作用。` start_first_task ` 里那句 ` msr control ` 也同理—— **在 Cortex-M 上，"配置"往往就是一条普通指令** ， 这正是它能在中断里、在启动几行汇编里随便写的原因。
 
2. **偏移 ` #8 ` 在编码里看得见。**  ` str r0, [r3, #8] ` 里那个 ` #8 ` 就是 ` SCB_VTOR_OFFSET `；而 ` read_vtor ` 用的是 ` ldr r0, [r3, #8] `——同一个偏移，一写一读。
 
3. **基址被放进常量池，不是写死在指令里。**  两条函数都以 ` ldr r3, [pc, #4] ` 开头，后面跟着 ` .word 0xe000ed00 `。Cortex-M 的 Thumb 指令是 16/32 位定长，  **塞不下一个 32 位地址** ，所以编译器把它当成"只读数据"放在函数尾巴上，用 PC 相对寻址取。  *这也是为什么改 ` SCB_BASE ` 的宏值时，受影响的只有常量池那几个字节。*
 

 

` relocate_to_ram() ` 更能说明问题——它连着做了两件事， objdump 里就是 **紧挨着的两条 store** ：

 

 
- ` str r1, [r3, #0] ` → ` ram_vector_table[0] = 0x20010000u; ` 往 RAM 那张表的 **第 0 格** （也就是"初始 MSP"那一格）填值。
 
- ` str r3, [r2, #8] ` → ` SCB->VTOR = ram_vector_table; ` 把表搬家的消息告诉硬件。
 

 

⚠ 这一段里有两个数字，我无法用工具链替你验证

 

` 0xE000ED00 `（SCB 基址）和 ` 0x08 `（VTOR 偏移）这两个数是  **ARMv7-M 架构手册规定** 的，不是我从哪个头文件里抄来的，也不是我能靠编译验证的。 我把整条工具链（ **8090 个文件** ）翻了一遍：

 

**bash**  — 工具链里到底有没有人"知道" VTOR

 

```text
$ grep -rl VTOR <工具链根目录>
grep 退出码 = 1   （1 = 一个文件都没匹配上；0 = 有匹配）

$ grep -rl E000ED08 <工具链根目录>
grep 退出码 = 1

→ 零命中。工具链里没有任何东西能替你交叉验证这两个数。
```

 

**所以本站把这一段明确标为「手册事实」，未做实测。**  它在 STM32 上是真的——但你若想把它变成实测事实，唯一的办法是 **在真芯片上读回 ` SCB->VTOR `** ，看写进去的值能不能原样读出来、并且异常真的跳到新表。 这一步需要硬件，本站在写这段话时没有硬件。

 

顺带一个同类提醒：` __attribute__((aligned(0x200))) ` 那个 0x200 （VTOR 低 7 位在 ARMv7-M 上是保留位，等于要求 128 字节对齐） **同样是手册事实** 。 我能实测的只有"加了 aligned 之后 ` ram_vector_table ` 的地址确实是 0x200 的整数倍"，  **测不出"不这么对齐硬件会怎样"** ——那需要真芯片。

 

**FIG 4.4**  向量表重定位：硬件始终从 ` VTOR ` 指向的地方找表

 

```zhizhan-figure
<svg viewBox="0 0 660 320" width="660" height="320" role="img" aria-label="VTOR 向量表重定位示意">
          <defs>
            <marker id="ah19" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--cyn)"></path>
            </marker>
            <marker id="ah20" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--amb)"></path>
            </marker>
            <marker id="ah21" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--red)"></path>
            </marker>
          </defs>

          <text x="30" y="24" class="sv-lbl-hi" style="fill:var(--amb)">复位后（VTOR = 0）：表在 Flash 里</text>
          <rect x="30" y="36" width="200" height="112" rx="6" class="sv-amb-s"></rect>
          <text x="42" y="56" class="sv-lbl-hi">Flash  0x08000000</text>
          <text x="42" y="76" class="sv-t">[0] _estack      20010000</text>
          <text x="42" y="92" class="sv-t">[1] Reset_Handler 08000069</text>
          <text x="42" y="108" class="sv-t">[2] NMI_Handler   080000a9</text>
          <text x="42" y="124" class="sv-t">[3] HardFault     080000a9</text>
          <text x="42" y="140" class="sv-t">… 共 16 项</text>

          <text x="300" y="24" class="sv-lbl-hi" style="fill:var(--cyn)">跳转后（VTOR = 0x20000200）：表在 RAM 里</text>
          <rect x="300" y="36" width="230" height="112" rx="6" class="sv-cyn-s"></rect>
          <text x="312" y="56" class="sv-lbl-hi">RAM  0x20000200</text>
          <text x="312" y="76" class="sv-t">[0] _estack      20010000</text>
          <text x="312" y="92" class="sv-t">[1] Reset_Handler 08000069</text>
          <text x="312" y="108" class="sv-t">[2] NMI_Handler   <tspan style="fill:var(--grn)">20000101</tspan></text>
          <text x="312" y="124" class="sv-t">[3] HardFault     <tspan style="fill:var(--grn)">20000141</tspan></text>
          <text x="312" y="140" class="sv-t">… 同一张表的副本，条目可改</text>

          <rect x="30" y="186" width="240" height="52" rx="6" class="sv-red-s"></rect>
          <text x="44" y="206" class="sv-lbl-hi" style="fill:var(--red)">SCB-&gt;VTOR   0xE000ED08</text>
          <text x="44" y="226" class="sv-t">一条 str r0, [r3, #8] 就写完</text>

          <path d="M 174 186 L 300 130" stroke="var(--red)" stroke-width="1.6" fill="none" marker-end="url(#ah21)"></path>
          <path d="M 130 186 L 130 154" stroke="var(--amb)" stroke-width="1.4" fill="none" stroke-dasharray="4 3" marker-end="url(#ah20)"></path>

          <text x="30" y="268" class="sv-lbl-dim">硬件的取指方向：异常发生时，读 VTOR → 取第 n 项 → 跳过去。</text>
          <text x="30" y="288" class="sv-lbl-dim">表在哪不重要，"VTOR 指着它"才重要 —— 这就是双分区固件升级能成立的原因。</text>
        </svg>
```

 

**图注：** 左表是复位后的默认状态；右表是搬进 RAM 的副本。  **注意 ` [2] `/` [3] ` 两项指向了 RAM 地址** —— 被测函数必须自己也在 RAM 里，否则改完向量表、中断进来却还在跑 Flash 里的旧代码， 而 Flash 可能正在被擦写。这正是下一节 ` .RamFunc ` 要解决的问题。  *图中 RAM 侧的函数地址是示意值，不是实测值；Flash 侧的四个数来自本站 ` objdump -s -j .isr_vector ` 的真实输出。*

 

```zhizhan-anchor
ch4-2-4
```



### 4.2.4 ` .init_array `：` main() ` 之前还有一批函数要跑

 

"启动代码就是拷 ` .data `、清 ` .bss `"——这句话漏了一大块。 只要你写过下面任何一样，启动流程里就多出一步：

 

 
- ` __attribute__((constructor)) ` 标注的函数（GCC 扩展，C 也能用）；
 
- C\+\+ 的全局/静态对象构造、` std::cout ` 这类运行前初始化的东西；
 
- 带构造函数的库（` __attribute__((constructor(101))) ` 这种带优先级的）。
 

 

这些函数的地址会被编译器塞进一个 **函数指针数组** ，段名叫 ` .init_array `；优先级更高的还有 ` .preinit_array `。 然后由一段名为 ` __libc_init_array() ` 的代码把它们 **挨个 ` blx ` 一遍** 。 这段代码在真项目里由 newlib 提供，但它的逻辑短到可以手写——为了能把它翻成汇编看， 我自己写了一份 36 行的：

 

ctor\_demo.c — 手写 \_\_libc\_init\_array \+ 一个 constructor \+ 一个 \_start（36 行，不依赖 libc） C

 

```text
/* ctor_demo.c —— F-252 取证：手写 __libc_init_array + 构造函数验证
 * 编译：arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c ctor_demo.c -o ctor_demo.o
 */
#include <stdint.h>

extern void (*__preinit_array_start[])(void) __attribute__((weak));
extern void (*__preinit_array_end[])(void)   __attribute__((weak));
extern void (*__init_array_start[])(void)    __attribute__((weak));
extern void (*__init_array_end[])(void)      __attribute__((weak));

void __libc_init_array(void)
{
    uint32_t i;
    uint32_t n;

    n = (uint32_t)(__preinit_array_end - __preinit_array_start);
    for (i = 0; i < n; i++) {
        __preinit_array_start[i]();
    }

    n = (uint32_t)(__init_array_end - __init_array_start);
    for (i = 0; i < n; i++) {
        __init_array_start[i]();
    }
}

static volatile uint32_t g_ctor_ran = 0;

__attribute__((constructor)) static void my_ctor(void)
{
    g_ctor_ran = 0xC0FFEE01u;
}

void _start(void)
{
    __libc_init_array();
    for (;;) {
        /* 真机上这里进主循环 */
    }
}
```

 

注意几个刻意的设计：两个边界数组声明成了 ` extern ` 加 ` __attribute__((weak)) `—— **这个 weak 是本节所有灾难的开关** ； ` my_ctor ` 写成 ` static `，所以它只可能通过 ` .init_array ` 被调到，绝不可能被别处直接 ` bl `。 配合一份 **正确** 的链接脚本：

 

ctors.ld — 正确版：既收集 .init\_array，又在收集的前后立好边界符号 LINKER

 

```text
/* ctors.ld —— 正确版：显式定义数组边界符号并收集 .preinit_array/.init_array */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

ENTRY(_start)

SECTIONS
{
  .text : {
    *(.text*)
    *(.rodata*)
  } > FLASH

  /* 数组本身是只读的常量表，放 Flash */
  .preinit_array : {
    . = ALIGN(4);
    __preinit_array_start = .;
    KEEP(*(.preinit_array))
    __preinit_array_end = .;
  } > FLASH

  .init_array : {
    . = ALIGN(4);
    __init_array_start = .;
    KEEP(*(SORT_BY_INIT_PRIORITY(.init_array.*)))
    KEEP(*(.init_array))
    __init_array_end = .;
  } > FLASH

  .data : {
    *(.data*)
  } > RAM AT > FLASH

  .bss : {
    *(.bss*)
    *(COMMON)
  } > RAM
}
```

 

这个脚本比"能跑就行"的脚本多了两处括号：` __init_array_start = . ` 在 ` KEEP `  **之前** ，` __init_array_end = . ` 在  **之后** 。跑一遍：

 

**bash**  — 正确版：链接 \+ 看符号 \+ 看数组内容

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c ctor_demo.c -o ctor_demo.o
$ arm-none-eabi-ld -T ctors.ld ctor_demo.o -o ctor_demo.elf
C:\Users\Administrator\Nuwax\computer-project-workspace\1785505821\1695388\toolchain\arm-gnu-toolchain-13.3.rel1-mingw-w64-i686-arm-none-eabi\bin\arm-none-eabi-ld.exe: warning: ctor_demo.elf has a LOAD segment with RWX permissions
$ arm-none-eabi-nm ctor_demo.elf | sort
08000000 T __libc_init_array
08000070 t my_ctor
0800008c T _start
08000098 D __init_array_start
08000098 D __preinit_array_end
08000098 D __preinit_array_start
0800009c D __init_array_end
20000000 b g_ctor_ran

$ arm-none-eabi-objdump -s -j .init_array ctor_demo.elf
ctor_demo.elf:     file format elf32-littlearm

Contents of section .init_array:
 8000098 71000008                             q...
```

 

四个边界符号都在，且 ` __preinit_array_start == __preinit_array_end == 0x08000098 ` —— **长度为零，说明我没有用 preinit** ；而 ` __init_array_start = 0x08000098 `、 ` __init_array_end = 0x0800009c `，差 4 字节 =  **正好一个函数指针** 。 那 4 个字节是 ` 71000008 `，小端读回来是 ` 0x08000071 `——` my_ctor ` 的地址 ` 0x08000070 ` 加 1。那个  **\+1 是 Thumb 位** ， 和上一节向量表里的 ` 41000008 ` 是同一套编码。

 

` __libc_init_array() ` 自己的汇编很短，短到能把整笔账算清楚：

 

**bash**  — 正确版：\_\_libc\_init\_array 的汇编（只看常量池就够）

 

```text
$ arm-none-eabi-objdump -d ctor_demo.elf

ctor_demo.elf:     file format elf32-littlearm


Disassembly of section .text:

08000000 <__libc_init_array>:
 8000000:	b580      	push	{r7, lr}
 8000002:	b082      	sub	sp, #8
 8000004:	af00      	add	r7, sp, #0
 8000006:	4a16      	ldr	r2, [pc, #88]	@ (8000060 <__libc_init_array+0x60>)
 8000008:	4b16      	ldr	r3, [pc, #88]	@ (8000064 <__libc_init_array+0x64>)
 800000a:	1ad3      	subs	r3, r2, r3
 800000c:	109b      	asrs	r3, r3, #2
 800000e:	603b      	str	r3, [r7, #0]
 8000010:	2300      	movs	r3, #0
 8000012:	607b      	str	r3, [r7, #4]
 8000014:	e007      	b.n	8000026 <__libc_init_array+0x26>
 8000016:	4a13      	ldr	r2, [pc, #76]	@ (8000064 <__libc_init_array+0x64>)
 8000018:	687b      	ldr	r3, [r7, #4]
 800001a:	f852 3023 	ldr.w	r3, [r2, r3, lsl #2]
 800001e:	4798      	blx	r3
 8000020:	687b      	ldr	r3, [r7, #4]
 8000022:	3301      	adds	r3, #1
 8000024:	607b      	str	r3, [r7, #4]
 8000026:	687a      	ldr	r2, [r7, #4]
 8000028:	683b      	ldr	r3, [r7, #0]
 800002a:	429a      	cmp	r2, r3
 800002c:	d3f3      	bcc.n	8000016 <__libc_init_array+0x16>
 800002e:	4a0e      	ldr	r2, [pc, #56]	@ (8000068 <__libc_init_array+0x68>)
 8000030:	4b0e      	ldr	r3, [pc, #56]	@ (800006c <__libc_init_array+0x6c>)
 8000032:	1ad3      	subs	r3, r2, r3
 8000034:	109b      	asrs	r3, r3, #2
 8000036:	603b      	str	r3, [r7, #0]
 8000038:	2300      	movs	r3, #0
 800003a:	607b      	str	r3, [r7, #4]
 800003c:	e007      	b.n	800004e <__libc_init_array+0x4e>
 800003e:	4a0b      	ldr	r2, [pc, #44]	@ (800006c <__libc_init_array+0x6c>)
 8000040:	687b      	ldr	r3, [r7, #4]
 8000042:	f852 3023 	ldr.w	r3, [r2, r3, lsl #2]
 8000046:	4798      	blx	r3
 8000048:	687b      	ldr	r3, [r7, #4]
 800004a:	3301      	adds	r3, #1
 800004c:	607b      	str	r3, [r7, #4]
 800004e:	687a      	ldr	r2, [r7, #4]
 8000050:	683b      	ldr	r3, [r7, #0]
 8000052:	429a      	cmp	r2, r3
 8000054:	d3f3      	bcc.n	800003e <__libc_init_array+0x3e>
 8000056:	bf00      	nop
 8000058:	bf00      	nop
 800005a:	3708      	adds	r7, #8
 800005c:	46bd      	mov	sp, r7
 800005e:	bd80      	pop	{r7, pc}
 8000060:	08000098 	.word	0x08000098
 8000064:	08000098 	.word	0x08000098
 8000068:	0800009c 	.word	0x0800009c
 800006c:	08000098 	.word	0x08000098

08000070 <my_ctor>:
 8000070:	b480      	push	{r7}
 8000072:	af00      	add	r7, sp, #0
 8000074:	4b03      	ldr	r3, [pc, #12]	@ (8000084 <my_ctor+0x14>)
 8000076:	4a04      	ldr	r2, [pc, #16]	@ (8000088 <my_ctor+0x18>)
 8000078:	601a      	str	r2, [r3, #0]
 800007a:	bf00      	nop
 800007c:	46bd      	mov	sp, r7
 800007e:	bc80      	pop	{r7}
 8000080:	4770      	bx	lr
 8000082:	bf00      	nop
 8000084:	20000000 	.word	0x20000000
 8000088:	c0ffee01 	.word	0xc0ffee01

0800008c <_start>:
 800008c:	b580      	push	{r7, lr}
 800008e:	af00      	add	r7, sp, #0
 8000090:	f7ff ffb6 	bl	8000000 <__libc_init_array>
 8000094:	e7fe      	b.n	8000094 <_start+0x8>
 8000096:	bf00      	nop
```

 

◆ 循环次数是"算"出来的，不是"写"死的

 

` __libc_init_array ` 里没有任何硬编码的循环次数。它做的是：

 

 
1. ` n = (uint32_t)(__init_array_end - __init_array_start); `
 
2. ` for (i = 0; i < n; i++) __init_array_start[i](); `
 

 

翻成汇编就是上面那两个 ` ldr ` 把边界地址从常量池取进寄存器、 ` subs ` 相减、` asrs #2 ` 除以 4（指针宽度）、 然后 ` blx r3 ` 逐个调用。  **整段逻辑的正确性，全押在"那两个符号指向的内存里，真的躺着链接器算出来的边界值"这一件事上。**  而这件事 **不归编译器管，归链接脚本管** 。

 

现在把链接脚本换成" **少写了那两对括号** "的版本——其余一个字符都不改：

 

ctors\_bad.ld — 反面版：不收集 .init\_array，也不定义 \_\_init\_array\_start/end LINKER

 

```text
/* ctors_bad.ld —— 反面版：不收集 .init_array，也不定义 __init_array_start/end */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

ENTRY(_start)

SECTIONS
{
  .text : {
    *(.text*)
    *(.rodata*)
  } > FLASH

  .data : {
    *(.data*)
  } > RAM AT > FLASH

  .bss : {
    *(.bss*)
    *(COMMON)
  } > RAM
}
```

 

链接它：

 

**bash**  — 反面版：链接、看符号、看常量池

 

```text
$ arm-none-eabi-ld -T ctors_bad.ld ctor_demo.o -o ctor_bad.elf
（退出码 0，一行输出都没有 —— 连 RWX 警告都没有）

$ arm-none-eabi-nm ctor_bad.elf | sort
08000000 T __libc_init_array
08000070 t my_ctor
0800008c T _start
20000004 b g_ctor_ran→ 四个边界符号：一个都不剩。

$ arm-none-eabi-objdump -s -j .text ctor_bad.elf
ctor_bad.elf:     file format elf32-littlearm

Contents of section .text:
 8000000 80b582b0 00af164a 164bd31a 9b103b60  .......J.K....;`
 8000010 00237b60 07e0134a 7b6852f8 23309847  .#{`...J{hR.#0.G
 8000020 7b680133 7b607a68 3b689a42 f3d30e4a  {h.3{`zh;h.B...J
 8000030 0e4bd31a 9b103b60 00237b60 07e00b4a  .K....;`.#{`...J
 8000040 7b6852f8 23309847 7b680133 7b607a68  {hR.#0.G{h.3{`zh
 8000050 3b689a42 f3d300bf 00bf0837 bd4680bd  ;h.B.......7.F..
 8000060 00000000 00000000 00000000 00000000  ................
 8000070 80b400af 034b044a 1a6000bf bd4680bc  .....K.J.`...F..
 8000080 704700bf 04000020 01eeffc0 80b500af  pG..... ........
 8000090 fff7b6ff fee700bf                    ........        → 0x8000060 起的 16 字节（也就是 __libc_init_array 的常量池）全是 0。
```

 

✕ 这是"静默失效"的教科书样本：链接器一个字都没说

 

把两次的输出摆在一起看：

 

| 检查项 | 正确版 ctors.ld | 反面版 ctors\_bad.ld |
| --- | --- | --- |
| ` ld ` 退出码 | 0 | 0（一样是成功） |
| ` ld ` 的告警 | RWX 段警告 ×1 | 无 |
| ` __init_array_start ` | ` 0x08000098 ` | 不存在 |
| ` __init_array_end ` | ` 0x0800009c ` | 不存在 |
| ` __libc_init_array ` 常量池 | ` 98000008 98000008 9c000008 98000008 ` | 全 0 |
| 算出来的循环次数 | 1 | 0 |

 

反面版之所以"连错误都不报"，根子在  **weak 声明** 上： ` extern void (*__init_array_start[])(void) __attribute__((weak)); ` 告诉链接器" *这个符号我不要求必须存在* "。既然不要求，链接器就 **老老实实把它当 0** 。 于是两个 ` ldr ` 读到的都是 0，` subs ` 得到 0， 循环体一次都不进—— **你的 ` my_ctor ` 永远不会被执行， 而 ` g_ctor_ran ` 会一直是 0** 。

 

在真项目里，这个症状通常表现为一句莫名其妙的抱怨：  *"我 C\+\+ 的全局对象构造函数没跑，成员变量全是 0"* ， 或者  *"我 ` __attribute__((constructor)) ` 里配的时钟没起效"* 。 找半天代码，问题在链接脚本里。

 

**注意那个 ` weak ` 不是你写的、也不是我能轻易去掉的** —— 它是 newlib/Linux 侧沿用下来的惯用法（在宿主系统上这些符号本来就由 crt 提供， 声明成 weak 是为了"没有也不炸"）。 **在裸机上，"没有"恰恰是最坏的情况。**

 

⚠ 别用"编译干净"当质量指标：反的那一版警告更少

 

上一节那个表里有一行值得单独拎出来： **正确的链接脚本触发了 ` has a LOAD segment with RWX permissions ` 警告，错误的那一版却没有。**

 

原因在读段布局（` readelf -l `）里：

 

 
- **正确版** 把 ` .init_array ` 放进了 Flash， 于是 ` .text ` 和 ` .init_array ` 被合并成一个 ` RWE `（可读可写可执行）的 LOAD 段——一个"什么权限都敢给"的段， 所以 ld 有意见。
 
- **反面版** 没管 ` .init_array `，链接器把它当成  *孤儿段（orphan section）* 自己找地方放了——放到了 RAM （` 0x20000000 `），恰好和 ` .bss ` 合成了一个正常的 ` RW ` 段，权限"看起来合理"，警告自然没了。
 

 

**所以警告数量的多少和"对不对"之间没有单调关系。**  一版有警告但功能正确，一版零警告但功能全坏——这种事情在嵌入式里非常常见， 因为 **链接器只能检查"结构上说不说得通"，检查不了"你的意图"** 。 真正该盯的不是"有没有警告"，而是" *我期待有值的符号，它到底有没有值* "。

 

✓ 上手清单：怎么判断自己的工程有没有踩这个坑

 

 
1. 在 ` .map ` 文件里搜 ` __init_array_start `。  **搜不到 = 有问题** （除非你确定工程里一个构造函数都没有）。
 
2. 搜 ` .init_array `，看它落在哪个地址区间。 落在 RAM 里，说明它是孤儿段，链接脚本没安排它。
 
3. 真机上在 ` main() ` 第一行打个断点， 看那个"应该被构造函数初始化过"的全局对象是不是还是 0。
 

 

CubeMX 生成的 ` .ld ` 里这段是有的，长这样： ` PROVIDE_HIDDEN(__init_array_start = .); ` —— ` PROVIDE_HIDDEN ` 的意思是" *如果没人定义它，就用我给的；并且不要导出到动态符号表* "。  **比裸 ` extern ` 加 weak 稳得多** ：因为它是 *定义* ，不是 *指望别人定义* 。

 

```zhizhan-anchor
ch4-3
```



## 4.3 栈：函数调用背后的机器

 

栈是理解"函数怎么调用""局部变量存在哪""递归为什么危险"的关键。我们用一个具体例子把它彻底拆开。

 

stack\_frame.c — 用于分析栈帧的样例 C

 

```text
#include <stdint.h>

/* 被调用函数：接收 4 个参数，使用局部变量 */
int compute(int a, int b, int c, int d)
{
    int local1 = a + b;         /* 局部变量 */
    int local2 = c + d;
    int arr[4] = {0};           /* 局部数组：{0} 是"整组清零"的惯用写法 */
    arr[0] = local1;
    arr[1] = local2;
    return arr[0] + arr[1] + arr[2] + arr[3];
}

/* 调用者 */
int caller(void)
{
    return compute(1, 2, 3, 4);
}
```

 

**FIG 4.5**  ` compute(1,2,3,4) ` 执行时的栈帧布局（ARM AAPCS 调用约定）

 

```zhizhan-figure
<svg viewBox="0 0 660 400" width="660" height="400" role="img" aria-label="ARM 栈帧布局">
          <defs>
            <marker id="ah8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
            <marker id="ah9" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path>
            </marker>
          </defs>

          <!-- 高地址 -->
          <text x="30" y="22" class="sv-lbl-dim">高地址（栈底）</text>

          <rect x="30" y="32" width="330" height="44" rx="5" class="sv-box"></rect>
          <text x="46" y="52" class="sv-lbl-hi">caller 的栈帧</text>
          <text x="46" y="68" class="sv-lbl-dim">caller 的局部变量 · 保存的寄存器</text>

          <rect x="30" y="84" width="330" height="48" rx="5" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="46" y="104" class="sv-lbl-hi" style="fill:var(--red)">返回地址 LR（callee 压栈保存）</text>
          <text x="46" y="122" class="sv-lbl-dim">函数返回后跳回 caller 的哪里</text>

          <text x="30" y="152" class="sv-lbl-hi" style="fill:var(--grn)">▼ 函数序言 push {r4-r7, lr} 之后的 SP</text>

          <rect x="30" y="162" width="330" height="44" rx="5" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="46" y="182" class="sv-lbl-hi" style="fill:var(--vio)">保存的 r4-r7 · 16 字节</text>
          <text x="46" y="199" class="sv-lbl-dim">被调用者保存寄存器（callee-saved）</text>

          <rect x="30" y="214" width="330" height="44" rx="5" fill="var(--line)" stroke="var(--line-2)" stroke-dasharray="4 3"></rect>
          <text x="46" y="234" class="sv-lbl-hi" style="fill:var(--txt-2)">对齐填充 · 4 字节</text>
          <text x="46" y="251" class="sv-lbl-dim">push 5 个寄存器 = 20 字节，破坏 8 字节对齐，需 sub sp,#4</text>

          <rect x="30" y="266" width="330" height="44" rx="5" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="46" y="286" class="sv-lbl-hi" style="fill:var(--grn)">local1 · local2 · 8 字节</text>
          <text x="46" y="303" class="sv-lbl-dim">局部标量变量</text>

          <rect x="30" y="318" width="330" height="46" rx="5" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="46" y="338" class="sv-lbl-hi" style="fill:var(--cyn)">arr[4] · 16 字节</text>
          <text x="46" y="356" class="sv-lbl-dim">局部数组 · 越界就是写到这里以外的内存</text>

          <text x="30" y="384" class="sv-lbl-hi" style="fill:var(--grn)">▼ 低地址（栈顶）· 当前 SP 在这里</text>

          <!-- 右侧说明 -->
          <rect x="384" y="32" width="258" height="118" rx="7" class="sv-grn-s"></rect>
          <text x="400" y="54" class="sv-lbl-hi" style="fill:var(--grn)">ARM AAPCS 调用约定</text>
          <text x="400" y="76" class="sv-lbl-dim" style="font-size:11px">r0–r3&nbsp;&nbsp;&nbsp;前 4 个参数 / 返回值</text>
          <text x="400" y="94" class="sv-lbl-dim" style="font-size:11px">r4–r11 被调用者保存（用前先压栈）</text>
          <text x="400" y="112" class="sv-lbl-dim" style="font-size:11px">r12&nbsp;&nbsp;&nbsp;&nbsp;临时寄存器（调用者可破坏）</text>
          <text x="400" y="130" class="sv-lbl-dim" style="font-size:11px">r13=SP&nbsp;&nbsp;r14=LR&nbsp;&nbsp;r15=PC</text>

          <rect x="384" y="162" width="258" height="130" rx="7" class="sv-amb-s"></rect>
          <text x="400" y="184" class="sv-lbl-hi" style="fill:var(--amb)">为什么这个模型很重要</text>
          <text x="400" y="206" class="sv-lbl-dim" style="font-size:11px">① 中断发生时，硬件自动压栈</text>
          <text x="400" y="222" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;r0-r3,r12,LR,PC,xPSR 共 32 字节</text>
          <text x="400" y="242" class="sv-lbl-dim" style="font-size:11px">② RTOS 任务切换 = 保存/恢复 SP</text>
          <text x="400" y="260" class="sv-lbl-dim" style="font-size:11px">③ HardFault 时栈里就躺着现场</text>
          <text x="400" y="278" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;（Module 08 会用它定位崩溃）</text>

          <rect x="384" y="304" width="258" height="82" rx="7" class="sv-red-s"></rect>
          <text x="400" y="326" class="sv-lbl-hi" style="fill:var(--red)">栈的两大杀手</text>
          <text x="400" y="348" class="sv-lbl-dim" style="font-size:11px">• 大局部数组 → 瞬间吃光栈</text>
          <text x="400" y="366" class="sv-lbl-dim" style="font-size:11px">• 深递归 → 帧层层堆积</text>

          <!-- 生长方向箭头 -->
          <path d="M 374 60 L 374 360" stroke="var(--grn)" stroke-width="1.6" fill="none" marker-end="url(#ah8)" stroke-dasharray="6 4"></path>
          <text x="368" y="212" class="sv-lbl-dim" transform="rotate(-90 368 212)" text-anchor="middle" style="fill:var(--grn)">栈向下生长</text>
        </svg>
```

 

**栈是向下生长的** ：压栈时 SP 减小，弹栈时 SP 增大。所以"栈溢出"是 SP 一路减小， 最终撞进 ` .bss ` 或 ` .data ` 区域， *静默覆盖你的全局变量* —— 这类 bug 的症状往往是"某个毫不相关的全局变量莫名其妙变了值"。   
  
  **注意这个例子只有 4 个参数** ：` a `–` d ` 全部落在 ` r0 `–` r3 ` 里， 一个字节都不上栈——图上本来就不该有"第 5 个参数"那一格。只有参数超过 4 个，多余的才压栈。   
  
  **AAPCS 还有一条硬约束：调用边界上 SP 必须 8 字节对齐。**  这就是图中"对齐填充"那一格的来历——` push {r4-r7, lr} ` 压了 5 个寄存器 = 20 字节， SP 仍是 4 字节对齐，却破坏了 8 字节对齐，编译器必须再补一条 ` sub sp, #4 `。 这条规则不是学究：Cortex-M4F/M7 上的 ` VLDRD `/` VSTRD ` 等 64 位浮点访问要求 8 字节对齐， 栈没对齐会直接进 UsageFault。所以写汇编时别自己数"压了几个寄存器"， 用 ` .align ` 让汇编器把关。

 

```zhizhan-anchor
ch4-3-1
```



### 4.3.1 栈溢出的三种典型场景

 

stack\_overflow.c — 全都是真实项目里见过的写法 C

 

```text
#include <stdint.h>
#include <string.h>
#include <stdio.h>      /* 下面打印"剩余栈"要用 printf */

/* ---------- 杀手 ①：栈上的大缓冲区 ---------- */
void parse_frame_bad(const uint8_t *in, size_t n)
{
    uint8_t frame[2048];             /* ✕ STM32 默认栈只有 1 KB，这一行就炸了 */
    memcpy(frame, in, n);
}

/* ✔ 修复方案 A：用静态缓冲区（注意重入性） */
void parse_frame_static(const uint8_t *in, size_t n)
{
    static uint8_t frame[2048];      /* 进 .bss，不占栈。但不能重入！ */
    if (n > sizeof frame) return;    /* ✔ 边界检查 */
    memcpy(frame, in, n);
}

/* ✔ 修复方案 B：调用方提供缓冲区（最灵活，无重入问题） */
int parse_frame_safe(const uint8_t *in, size_t n, uint8_t *out, size_t out_size)
{
    if (n > out_size) return -1;
    memcpy(out, in, n);
    return 0;
}

/* ---------- 杀手 ②：递归 ---------- */
/* 每层递归至少消耗一个栈帧（含返回地址 + 保存寄存器 + 局部变量） */
int fib_bad(int n)                   /* ✕ 指数级调用，深度可达 n */
{
    if (n < 2) return n;
    return fib_bad(n - 1) + fib_bad(n - 2);
}

/* ✔ 改成迭代：零栈增长，还快得多 */
uint32_t fib_good(int n)
{
    uint32_t a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        uint32_t t = a + b; a = b; b = t;
    }
    return a;
}

/* ---------- 杀手 ③：printf 家族的隐藏开销 ---------- */
void log_bad(void)
{
    /* ✕ printf 内部有栈缓冲，某些实现一次消耗几百字节栈 */
    printf("value = %f, status = %s\n", 3.14159, "ok");
}

/* ✔ 用轻量级日志，或提高栈大小 */
void log_good(void)
{
    /* 自定义的轻量输出：直接写寄存器/UART，无栈开销 */
    log_puts("value=");
    log_int(314);
    log_puts("\r\n");
}

/* ---------- 栈溢出的"哨兵"检测法 ---------- */

/* 哨兵必须埋在最深、也就是最后才会被踩到的位置——栈底。
   注意别写在栈顶附近：(char*)&_estack - 64 距栈顶只有 64 字节，
   那是 main() 和第一层函数调用的活跃区，一上电就被覆盖，
   stack_overflowed() 会常年返回 1，等于没做检测。
   ⚠ 一定要显式写成 (char*) 再减：&_estack 的类型是 uint32_t*，
      直接写 &_estack - 16 会按"4 字节一步"减掉 64 字节，语义看着对、
      却依赖读者去推断类型，换个上下文就错。全站统一 (char*)&_estack - N。 */
#define STACK_CANARY 0xDEADBEEFUL

extern uint32_t _estack;     /* 栈顶（RAM 末尾），链接脚本提供 */
extern uint32_t _sstack;     /* 栈底 = _estack - _Min_Stack_Size */

void stack_check_init(void)
{
    /* 只有真的用满了整个栈，才会踩到这一格 */
    *(volatile uint32_t *)&_sstack = STACK_CANARY;
}

int stack_overflowed(void)
{
    return *(volatile uint32_t *)&_sstack != STACK_CANARY;
}
```

 

✕ [FreeRTOS](term:rtos) 用户的额外注意

 

FreeRTOS 每个任务有 **独立的任务栈** ，大小在 ` xTaskCreate ` 时指定（单位是 *字* ，不是字节！）。 常见的错误是写 ` xTaskCreate(task, "t", 128, ...) ` 以为给了 128 字节， 实际在 32 位平台上是  **512 字节** ；反过来，把深度递归的任务栈设小了，症状是"任务莫名卡死或复位"。   
  
  **务必开启 ` configCHECK_FOR_STACK_OVERFLOW = 2 `** ，它会在任务切换时用哨兵图案检测溢出。

 

```zhizhan-anchor
ch4-3-2
```



### 4.3.2 栈用量怎么量：` -fstack-usage ` 与 ` -Wstack-usage=N `

 

上一节列了栈溢出的四种剧本，但每一种都没法靠" *看代码估一估* "躲开—— 你必须知道 **每个函数到底吃多少字节** 。GCC 自带这个能力，只是默认关着。 先写一个把各种栈帧形态都占一遍的文件：

 

stack\_usage.c — 五种典型栈帧：浅标量、512 字节大数组、递归、VLA、结构体数组（每档都有注释写着"我期望它报什么"） C

 

```text
/* stack_usage.c - F-257 栈用量静态分析取证
 * 编译: arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -fstack-usage -c
 */
#include <stdint.h>

/* 全局, 防止被完全优化掉 */
volatile uint32_t g_sink;

/* (1) 浅函数: 只有几个标量局部变量 */
uint32_t shallow(uint32_t a, uint32_t b)
{
    uint32_t x = a + b;
    uint32_t y = a ^ b;
    return x * y;
}

/* (2) 深函数: 栈上开 512 字节大数组 */
void deep(void)
{
    volatile uint8_t buf[512];
    for (uint32_t i = 0; i < 512; i++) {
        buf[i] = (uint8_t)i;
    }
    g_sink = buf[0] + buf[511];   /* 用掉, 防止优化掉整个数组 */
}

/* (3) 递归函数: 深度不定 -> 期望 unbounded */
uint32_t recurse(uint32_t n)
{
    if (n == 0) return 0;
    return n + recurse(n - 1);
}

/* (4) 可变长数组 VLA: 大小运行期才定 -> 期望 dynamic,unbounded */
void vla_fn(uint32_t n)
{
    volatile uint8_t buf[n];
    for (uint32_t i = 0; i < n; i++) buf[i] = (uint8_t)i;
    g_sink = buf[0];
}

/* (5) 中等深度: 栈上一个结构体数组 */
typedef struct { uint32_t a[8]; uint8_t tag; } rec_t;
uint32_t medium(void)
{
    volatile rec_t r[4];
    for (uint32_t i = 0; i < 4; i++) r[i].tag = (uint8_t)i;
    return r[3].tag;
}
```

 

加一个 ` -fstack-usage ` 就会额外产出一个 ` .su ` 文件 （ **名字跟输出目标文件走** ，` -o su_O0.o ` 就生成 ` su_O0.su `——这个细节让我第一次找文件时白找了半天）。两档优化各跑一次：

 

**bash**  — -O0：每个函数的栈用量

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 -fstack-usage -c stack_usage.c -o su_O0.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 -fstack-usage -c stack_usage.c -o su_O0.o
（.su 与输出目标文件同名：su_O0.su）
stack_usage.c:10:10:shallow	24	static
stack_usage.c:18:6:deep	528	static
stack_usage.c:28:10:recurse	16	static
stack_usage.c:35:6:vla_fn	48	dynamic
stack_usage.c:44:10:medium	160	static
```

 

**bash**  — -O2：同一份源码，数字全变了

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -fstack-usage -c stack_usage.c -o su_O2.o
stack_usage.c:10:10:shallow	0	static
stack_usage.c:18:6:deep	512	static
stack_usage.c:28:10:recurse	0	static
stack_usage.c:35:6:vla_fn	8	dynamic
stack_usage.c:44:10:medium	144	static
```

 

◆ .su 的三个字段：函数、字节、限定词——第三个才是关键

 

每行的格式是 ` 文件:行:列:函数名 <TAB> 字节数 <TAB> 限定词 `。 把两档并排看：

 

| 函数 | -O0 | -O2 | 为什么变 |
| --- | --- | --- | --- |
| shallow | 24 static | 0 static | 参数和局部全进了寄存器，栈上一个字节都不用 |
| deep | 528 static | 512 static | ` buf[512] ` 是硬需求，528 那多出的 16 字节是 ` -O0 ` 的帧开销 |
| recurse | 16 static | 0 static | **尾递归被优化成了循环** ，栈用量归零 |
| vla\_fn | 48  *dynamic* | 8  *dynamic* | VLA 大小运行期才定， **限定词两档都是 dynamic** |
| medium | 160 static | 144 static | 结构体数组本身占位，优化只能省掉帧开销 |

 

限定词三个取值的含义：

 

 
- ` static `——编译期算得出的固定上限。 **注意是"算得出的"，不等于"安全的"** （见下面递归那段）。
 
- ` dynamic `——有运行期才知道的部分（VLA、` alloca `）。
 
- 后缀 ` bounded ` / ` unbounded `——dynamic 时才有， ` unbounded ` 表示"连大概范围都给不出"。
 

 

**一个能直接改到工程里的结论** ：` deep() ` 在 ` -O0 ` 下比 ` -O2 ` 多花 16 字节。 栈只有几 KB 时， **"Debug 版能跑、Release 版崩"或反过来，都可能只是这几十字节的事** 。

 

光有数字还不够，得让它 **替你报警** 。把两者绑起来：

 

**bash**  — 把阈值卡到 512 与 511，看告警在哪一档出现

 

```text
$ arm-none-eabi-gcc … -Wstack-usage=512 -c stack_usage.c     # 只报 vla_fn
$ arm-none-eabi-gcc … -Wstack-usage=511 -c stack_usage.c     # 多报一个 deep
$ arm-none-eabi-gcc … -Wstack-usage=144 -c stack_usage.c     # 仍不报 medium
$ arm-none-eabi-gcc … -Wstack-usage=143 -c stack_usage.c     # 多报一个 medium

→ 告警条数：N=512 → 1 条（只有 vla_fn）；N=511 → 2 条（vla_fn + deep）
            N=144 → 2 条（deep + vla_fn）；N=143 → 3 条（+ medium）
→ 判定规则是严格大于：用量 > N 才告警。deep=512 在 N=512 时静默，N=511 时响。

$ arm-none-eabi-gcc … -Wstack-usage=1000000 -c stack_usage.c
stack_usage.c: In function 'vla_fn':
stack_usage.c:35:6: warning: stack usage might be unbounded [-Wstack-usage=]
   35 | void vla_fn(uint32_t n)
      |      ^~~~~~→ 阈值抬到 100 万，vla_fn 那条"might be unbounded"依然在：它跟 N 根本无关。
```

 

✕ 最大的盲区：递归。工具会给一个看起来精确、实际毫无意义的数字

 

` stack_usage.c ` 里 ` recurse() ` 那段注释是我自己写的， 原文是" *递归函数: 深度不定 -\> 期望 unbounded* "。  **实测把这个期望打脸了** ：` -O0 ` 报 ` 16 static `，` -O2 ` 报 ` 0 static `，  **一次 ` unbounded ` 都没出现过。**  另一个文件里的斐波那契递归也一样，报的是 ` fib 272 static `——  **"272" 是一层递归的帧大小，而真实栈深正比于 n。**

 

这是个很危险的组合： **工具不但没报警，还给了你一个看起来很具体的数** 。 一个只盯着 ` .su ` 文件做审查的人，会把 ` recurse 16 static ` 当成"没问题"。

 

**所以三条纪律：**

 

 
1. ` -Wstack-usage ` 报 ` static ` ≠ 安全。 它只保证" *这一层* 的帧是这么多"。
 
2. 递归函数和" *函数指针 \+ 回调* "构成的调用链， **静态工具一律看不穿** ， 得自己按最坏深度的乘积估算。
 
3. 中断嵌套是 *另一份* 账：主流程的栈用量还没算完，一个中断进来就再叠一层， 而 ` -fstack-usage `  **完全不知道中断的存在** 。

 

✓ 实测：把阈值变成构建门禁

 

光看过不过瘾。我试了把警告直接升成错误：

 

**bash**  — -Werror=stack-usage=N 真的会拦住构建

 

```text
$ arm-none-eabi-gcc … -Wstack-usage=200 -Werror=stack-usage=200 -c stack_usage.c -o werr.o
stack_usage.c: In function 'deep':
stack_usage.c:18:6: error: stack usage is 512 bytes [-Werror=stack-usage=]
   18 | void deep(void)
      |      ^~~~
stack_usage.c: In function 'vla_fn':
stack_usage.c:35:6: error: stack usage might be unbounded [-Werror=stack-usage=]
   35 | void vla_fn(uint32_t n)
      |      ^~~~~~
cc1.exe: some warnings being treated as errors
退出码 = 1
```

 

**退出码 1，构建真的断了** ——注意 ` -Werror= ` 后面那串 ` stack-usage=200 ` 能原样带上参数，这一点我是实测出来的，不是猜的。

 

放进 CI 或 ` Makefile ` 里，效果是： **有人新加了一个大栈数组， 构建当场红掉** ，而不是等到烧进板子跑三天才 HardFault。 代价要提前知道：` -O0 ` 和 ` -O2 ` 的数字不同，  **阈值要按 *你实际发布的那个优化档* 来定** ，否则会在两种构建间反复误报。

 

```zhizhan-anchor
ch4-3-3
```



### 4.3.3 其实有两个栈指针：` MSP `、` PSP ` 和一个叫 ` CONTROL ` 的开关

 

前面几节所有关于栈的讨论，都偷偷假设了" **栈指针只有一个** "。 在 Cortex-M 上这个假设只对一半：寄存器里其实住着 **两个** 栈指针——

 

 
- ` MSP `（Main Stack Pointer，主栈指针）：复位后默认用的就是它，异常处理 **强制** 用它。
 
- ` PSP `（Process Stack Pointer，进程栈指针）：只有线程模式能用，异常里用不了。
 

 

哪个在"当值"，由一个叫 ` CONTROL ` 的寄存器里的一个位决定。 为什么要有两个？因为这是  **RTOS 上下文切换的地基** ： 调度器把每个任务的栈顶塞进 ` PSP `，任务代码就自然跑在各自的栈上； 而中断来临时硬件自动切回 ` MSP `，  **于是"任务栈爆了"不会把"中断栈"一起拖下水** 。

 

MSR/MRS 这类指令在 C 里没有对应语法，只能用内联汇编。下面这个文件把它们全包了一遍 （ **不依赖 CMSIS** ，就是几十行 ` __asm volatile `）：

 

psp\_demo.c — 用内联汇编读写 MSP / PSP / CONTROL，并写一个"切到第一个任务"的函数 C

 

```text
/* psp_demo.c - F-255 MSP / PSP 双栈 取证
 * 目标: cortex-m3, 裸机 (无 libc)
 * 用内联汇编访问 MSP / PSP / CONTROL
 */

#include <stdint.h>

/* ---- MSP ---- */
uint32_t __get_MSP(void)
{
    uint32_t result;
    __asm volatile ("mrs %0, msp" : "=r" (result));
    return result;
}

void __set_MSP(uint32_t topOfMainStack)
{
    __asm volatile ("msr msp, %0" : : "r" (topOfMainStack));
}

/* ---- PSP ---- */
uint32_t __get_PSP(void)
{
    uint32_t result;
    __asm volatile ("mrs %0, psp" : "=r" (result));
    return result;
}

void __set_PSP(uint32_t topOfTaskStack)
{
    __asm volatile ("msr psp, %0" : : "r" (topOfTaskStack));
}

/* ---- CONTROL ---- */
uint32_t __get_CONTROL(void)
{
    uint32_t result;
    __asm volatile ("mrs %0, control" : "=r" (result));
    return result;
}

void __set_CONTROL(uint32_t control)
{
    __asm volatile ("msr control, %0" : : "r" (control) : "memory");
    __asm volatile ("isb");
}

/* ---- 切到第一个任务: 设置 PSP, 把 SPSEL(bit1) 置 1, 再 isb ---- */
void start_first_task(uint32_t *task_stack)
{
    __set_PSP((uint32_t)task_stack);   /* 任务栈顶交给 PSP */
    uint32_t c = __get_CONTROL();
    c |= (1u << 1);                    /* SPSEL = 1 -> 线程模式使用 PSP */
    __set_CONTROL(c);
    /* __set_CONTROL 内部已经执行 isb, 保证后续取指使用新栈视图 */
}

/* 一个把两者都读回来做对比的函数, 方便在 objdump 里对照 */
uint32_t dump_stacks(uint32_t *out_msp, uint32_t *out_psp, uint32_t *out_ctrl)
{
    *out_msp  = __get_MSP();
    *out_psp  = __get_PSP();
    *out_ctrl = __get_CONTROL();
    return *out_ctrl;
}
```

 

编出来看编码——这一段信息量很大：

 

**bash**  — 每一条 MSR / MRS 的机器码

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c psp_demo.c -o psp_demo_O2.o
$ arm-none-eabi-objdump -d psp_demo_O2.o
psp_demo_O2.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <__get_MSP>:
   0:	f3ef 8008 	mrs	r0, MSP
   4:	4770      	bx	lr
   6:	bf00      	nop

00000008 <__set_MSP>:
   8:	f380 8808 	msr	MSP, r0
   c:	4770      	bx	lr
   e:	bf00      	nop

00000010 <__get_PSP>:
  10:	f3ef 8009 	mrs	r0, PSP
  14:	4770      	bx	lr
  16:	bf00      	nop

00000018 <__set_PSP>:
  18:	f380 8809 	msr	PSP, r0
  1c:	4770      	bx	lr
  1e:	bf00      	nop

00000020 <__get_CONTROL>:
  20:	f3ef 8014 	mrs	r0, CONTROL
  24:	4770      	bx	lr
  26:	bf00      	nop

00000028 <__set_CONTROL>:
  28:	f380 8814 	msr	CONTROL, r0
  2c:	f3bf 8f6f 	isb	sy
  30:	4770      	bx	lr
  32:	bf00      	nop

00000034 <start_first_task>:
  34:	f380 8809 	msr	PSP, r0
  38:	f3ef 8314 	mrs	r3, CONTROL
  3c:	f043 0302 	orr.w	r3, r3, #2
  40:	f383 8814 	msr	CONTROL, r3
  44:	f3bf 8f6f 	isb	sy
  48:	4770      	bx	lr
  4a:	bf00      	nop

0000004c <dump_stacks>:
  4c:	f3ef 8308 	mrs	r3, MSP
  50:	6003      	str	r3, [r0, #0]
  52:	f3ef 8309 	mrs	r3, PSP
  56:	600b      	str	r3, [r1, #0]
  58:	f3ef 8014 	mrs	r0, CONTROL
  5c:	6010      	str	r0, [r2, #0]
  5e:	4770      	bx	lr
```

 

◆ 一张可以拿去查表的编码对照

 

从上面那份 objdump 里把关键几条抄出来，都是真实机器码：

 

| 源码 | 汇编 | 机器码 |
| --- | --- | --- |
| \_\_get\_MSP() | mrs r0, MSP | f3ef 8008 |
| \_\_set\_MSP(v) | msr MSP, r0 | f380 8808 |
| \_\_get\_PSP() | mrs r0, PSP | f3ef 8009 |
| \_\_set\_PSP(v) | msr PSP, r0 | f380 8809 |
| \_\_get\_CONTROL() | mrs r0, CONTROL | f3ef 8014 |
| \_\_set\_CONTROL(v) | msr CONTROL, r0 | f380 8814 |
| \_\_set\_CONTROL 内的屏障 | isb sy | f3bf 8f6f |
| c \|= (1u \<\< 1) | orr.w r3, r3, #2 | f043 0302 |

 

**看最后两行的对应关系** ：源码里写 ` 1u << 1 `， 汇编里是立即数 ` #2 `，机器码里是 ` 0302 `。  **这条链子工具链能替你验证** ——"脚本里的 1\<\<1 确实等于立即数 2"是我实测出来的。

 

但 **下一环不行** ：这个 ` #2 ` 落在 ` CONTROL ` 的  *bit 1*  上、而这个位叫 ` SPSEL `、置 1 表示"线程模式改用 PSP"——  **这一串是 ARMv7-M 手册规定，工具链里没有任何东西能验证它**  （和上一节 ` VTOR = 0xE000ED08 ` 一样，我用 8090 个文件 grep 过，零命中）。 本页把它标为 *手册事实* 。

 

⚠ 那句 ` isb ` 不是装饰：改了 CONTROL 必须同步流水线

 

注意 ` __set_CONTROL() ` 和 ` start_first_task() `  **都在写完 CONTROL 后紧跟了一条 ` isb sy `**  （机器码 ` f3bf 8f6f `，在上面 objdump 里看得见）。这不是我随手加的：

 

 
- **实测的部分** ：这两处 *确实* 编出了 ` isb sy `， 而且是紧跟 ` msr CONTROL, … ` 的下一条指令。这条我能验证。
 
- **手册事实的部分** ：Cortex-M 的流水线里可能已经预取了后面几条指令， 而它们的栈访存用的是 *旧的* 栈指针视图。` ISB ` （指令同步屏障）丢弃已预取的指令、强制重新取指，  **这样后续代码才会按新的 SPSEL 设置去用 PSP** 。 这一条来自架构手册，我没有硬件去验证"去掉 ISB 会怎样"。
 

 

这个模式在 Cortex-M 的官方例程里到处都是（FreeRTOS 的 ` vPortSVCHandler `、CubeMX 生成的 ` SysTick_Handler ` 附近都能见到）。 **记住这条规律： 凡是写"影响 CPU 后续行为模式"的控制寄存器，后面都该跟一句 ISB 或 DSB。**

 

内联汇编最容易错的地方是 **操作数顺序** 。下面这个 3 行的文件是我故意写错的反面教材：

 

bad1.c — 反面教材：两处内联汇编语法错误（这个文件是【故意编不过】的） C

 

```text
#include <stdint.h>
uint32_t bad_a(void){ uint32_t r; __asm volatile ("mrs psp, %0" : "=r"(r)); return r; }
void bad_b(void){ __asm volatile ("msr psp, #0x1000"); }
```

 

编译器给出的原话是这样的：

 

**bash**  — 汇编器报错（原样转录）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c bad1.c -o bad1.o
ccXXXXXX.s: Assembler messages:
ccXXXXXX.s:30: Error: ARM register expected -- `mrs psp,r3'
ccXXXXXX.s:57: Error: Thumb encoding does not support an immediate here -- `msr psp,#0x1000'（退出码 1）

→ 上面我做了唯一一处加工：把临时汇编文件名 ccXXXXXX.s 打了码。
  那是编译器自己生成的随机中间文件，每次跑都不一样；报错的行号也会跟着变。
  同理，第一条错误里的寄存器号也不稳定 —— 我第一次跑是 mrs psp,r0，第二次是 mrs psp,r3。
```

 

✕ 两条错误各对应一个必须记住的规则

 

 
1. **` mrs psp, %0 ` 错在操作数顺序。**  阅读顺序容易让人以为" *从 psp 读到 %0* "，但 GNU as 的语法是 ` mrs <目标寄存器>, <特殊寄存器> `——  **特殊寄存器在 *后面*** 。 报错 `` ARM register expected -- `mrs psp,r3' `` 的意思是 "第一个操作数得是个通用寄存器"，也就是它正在抱怨你把 ` psp ` 放在了第一格。正确写法：` mrs %0, psp `。  
     *记忆法：` mrs ` =  **M** ove  **R** egister from  **S** pecial， 先写搬到哪儿。*
 
2. **` msr psp, #0x1000 ` 错在"想给特殊寄存器写立即数"。**  报错原文 ` Thumb encoding does not support an immediate here ` 说得很准： Thumb 编码下的 ` msr ` 特殊寄存器形式 **只接受通用寄存器操作数** 。 想设一个常量栈顶，得先 ` mov ` 到某个寄存器里再 ` msr `—— 这其实也是 ` psp_demo.c ` 里为什么绕了一圈： ` __set_PSP((uint32_t)task_stack) ` 传的永远是变量， 编译器自然会先把它装进寄存器。
 

 

**这两条不是"看一眼就懂"的：** 它们分别踩在 "操作数顺序违反直觉"和"Thumb 编码限制操作数形态"上， 而两者的报错信息里都 **没有直接告诉你正确写法** 。 我建议把这两行错代码连同报错一起记在心里——  **下次在 CubeMX 生成的代码里看到 ` mrs %0, psp `，你就知道那不是在瞎绕。**

 

**FIG 4.6**  两个栈指针：异常一律回到 MSP，线程模式由 CONTROL.SPSEL 决定用哪个

 

```zhizhan-figure
<svg viewBox="0 0 660 348" width="660" height="348" role="img" aria-label="MSP 与 PSP 双栈与 CONTROL.SPSEL">
          <defs>
            <marker id="ah22" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--grn)"></path>
            </marker>
            <marker id="ah23" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--cyn)"></path>
            </marker>
            <marker id="ah24" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--red)"></path>
            </marker>
          </defs>

          <rect x="30" y="30" width="270" height="130" rx="6" class="sv-grn-s"></rect>
          <text x="44" y="52" class="sv-lbl-hi" style="fill:var(--grn)">主栈 MSP：中断与异常的家</text>
          <text x="44" y="74" class="sv-t">寄存器：MSP（硬件强制）</text>
          <text x="44" y="92" class="sv-t">谁在用：复位后 → main() 全程</text>
          <text x="44" y="110" class="sv-t">　　　　任何异常 / 中断处理</text>
          <text x="44" y="132" class="sv-t" style="fill:var(--amb)">栈顶通常就是 _estack</text>

          <rect x="360" y="30" width="270" height="130" rx="6" class="sv-cyn-s"></rect>
          <text x="374" y="52" class="sv-lbl-hi" style="fill:var(--cyn)">进程栈 PSP：任务各自一份</text>
          <text x="374" y="74" class="sv-t">寄存器：PSP（只在<tspan font-style="italic">线程模式</tspan>可用）</text>
          <text x="374" y="92" class="sv-t">谁在用：SPSEL=1 后的线程代码</text>
          <text x="374" y="110" class="sv-t">　　　　RTOS 里每个任务一个栈顶</text>
          <text x="374" y="132" class="sv-t" style="fill:var(--amb)">切换任务 = 换一个 PSP 值</text>

          <rect x="150" y="196" width="360" height="60" rx="6" class="sv-red-s"></rect>
          <text x="166" y="218" class="sv-lbl-hi" style="fill:var(--red)">CONTROL 寄存器　bit1 = SPSEL</text>
          <text x="166" y="240" class="sv-t">SPSEL=0 → 线程模式用 MSP　　SPSEL=1 → 线程模式用 PSP</text>

          <path d="M 200 196 L 165 164" stroke="var(--grn)" stroke-width="1.6" fill="none" marker-end="url(#ah22)"></path>
          <path d="M 460 196 L 495 164" stroke="var(--cyn)" stroke-width="1.6" fill="none" marker-end="url(#ah23)"></path>
          <path d="M 330 196 L 330 172" stroke="var(--red)" stroke-width="1.4" fill="none" stroke-dasharray="4 3" marker-end="url(#ah24)"></path>

          <text x="30" y="292" class="sv-lbl-dim">异常入口硬件自动切回 MSP，异常返回时按 EXC_RETURN 的 bit2 决定回哪个栈 —— 任务栈爆了不会带崩中断栈。</text>
          <text x="30" y="314" class="sv-lbl-dim">写 CONTROL 之后必须 isb：让流水线丢掉按旧栈视图预取的指令。</text>
        </svg>
```

 

**图注：** 左绿右青是同一颗 CPU 上的两个栈指针， **不是两份内存** —— 它们的栈区还是你自己在链接脚本里划的那几块 RAM。  *本图是机制示意；` SPSEL ` 位号、异常返回行为均属手册事实， 本站在写这一节时没有硬件，"切过去之后真的用 PSP 了"这件事未做实测。*

 

```zhizhan-anchor
ch4-4
```



## 4.4 链接脚本：掌控内存布局的终极工具

 

链接脚本（linker script，` .ld ` 文件）是 **唯一能精确控制"什么数据放在哪个地址"的工具** 。 看懂它，你就能回答"我的 Flash 为什么不够用了""怎么把大数组放到外部 SDRAM"这类问题。

 

STM32F103C8T6.ld — 逐行注解版 LD

 

```text
/* ============ ① 声明内存区域 ============ */
MEMORY
{
  /* 名字      属性            起始地址        长度     */
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 64K   /* 只读可执行 */
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 20K   /* 可读写可执行 */
}

/* ============ ② 定义栈顶位置 ============ */
/* 栈从 RAM 末尾开始，向下生长。启动文件的 .word _estack 就是它 */
_estack = ORIGIN(RAM) + LENGTH(RAM);      /* = 0x20005000 */

_Min_Heap_Size  = 0x200;                  /* 堆最小 512 字节 */
_Min_Stack_Size = 0x400;                  /* 栈最小 1 KB */

/* 栈底（最低可用地址）。栈是"向下生长"的，所以栈底才是那个
   "被踩到的最后一个位置"——溢出哨兵、栈使用量统计，都该以它为基准。 */
_sstack = _estack - _Min_Stack_Size;      /* = 0x20004C00 */

/* ============ ③ 段布局 ============ */
SECTIONS
{
  /* ---- .isr_vector 必须放在最前面 ---- */
  /* 复位后 CPU 固定从地址 0x0000_0000 取出前两个字（栈顶 + 复位向量）。
     而 0x0000_0000 是"别名"：BOOT0 = 0 时它映射到 Flash 起始 0x0800_0000，
     BOOT0 = 1 时映射到系统存储器（内置 bootloader）。
     所以把 .isr_vector 放在 Flash 最前面，CPU 从地址 0 就能读到它。
     调试时你看到 PC 在 0x0800_xxxx、而手册说"从 0 取向量"，两者都对——
     同一块存储的两个地址而已。 */
  .isr_vector :
  {
    . = ALIGN(4);                          /* 4 字节对齐 */
    KEEP(*(.isr_vector))                   /* KEEP 防止被 --gc-sections 删除！ */
    . = ALIGN(4);
  } >FLASH

  /* ---- .text：代码 ---- */
  .text :
  {
    . = ALIGN(4);
    *(.text)                               /* 所有 .o 的 .text */
    *(.text*)
    *(.glue_7) *(.glue_7t)                 /* ARM/Thumb 互调用桩 */
    *(.eh_frame)
    KEEP (*(.init)) KEEP (*(.fini))
    . = ALIGN(4);
    _etext = .;                            /* 定义符号：代码段结束地址 */
  } >FLASH

  /* ---- .rodata：只读数据 ---- */
  .rodata :
  {
    . = ALIGN(4);
    *(.rodata) *(.rodata*)
    . = ALIGN(4);
  } >FLASH

  /* ---- .ARM.extab / .ARM：异常处理表 ---- */
  .ARM.extab : { *(.ARM.extab* .gnu.linkonce.armextab.*) } >FLASH
  .ARM : { __exidx_start = .; *(.ARM.exidx*) __exidx_end = .; } >FLASH

  /* ---- .preinit_array / .init_array / .fini_array ---- */
  /* 这三段是 C++ 全局构造、__attribute__((constructor)) 和
     __libc_init_array() 的实现基础（就是 4.2 里 Reset_Handler 调的那个）。
     少写一段，链接时就可能报 undefined reference to `__init_array_start'。
     顺序不能颠倒：preinit → init → fini，且 start/end 符号必须成对出现——
     它们不是普通的段边界，而是 newlib 启动代码要读的数组首尾指针。 */
  .preinit_array :
  {
    PROVIDE_HIDDEN (__preinit_array_start = .);
    KEEP (*(.preinit_array*))
    PROVIDE_HIDDEN (__preinit_array_end = .);
  } >FLASH

  .init_array :
  {
    PROVIDE_HIDDEN (__init_array_start = .);
    KEEP (*(SORT(.init_array.*)))      /* 带优先级的构造函数按编号顺序执行 */
    KEEP (*(.init_array*))             /* 无优先级的按链接顺序 */
    PROVIDE_HIDDEN (__init_array_end = .);
  } >FLASH

  .fini_array :
  {
    PROVIDE_HIDDEN (__fini_array_start = .);
    KEEP (*(SORT(.fini_array.*)))
    KEEP (*(.fini_array*))
    PROVIDE_HIDDEN (__fini_array_end = .);
  } >FLASH

  /* ---- .data 的加载地址（LMA）在 Flash，运行地址（VMA）在 RAM ---- */
  /* 这是链接脚本里最关键也最容易被忽略的一处语法 */
  _sidata = LOADADDR(.data);               /* ← 启动代码从这里拷贝 */

  .data :
  {
    . = ALIGN(4);
    _sdata = .;                            /* ← 拷贝目标起始 */
    *(.data) *(.data*)
    . = ALIGN(4);
    _edata = .;                            /* ← 拷贝目标结束 */
  } >RAM AT> FLASH                          /* ← 关键：VMA 在 RAM，LMA 在 FLASH */

  /* ---- .bss：未初始化数据 ---- */
  .bss :
  {
    . = ALIGN(4);
    _sbss = .;                             /* ← 清零起始 */
    __bss_start__ = _sbss;
    *(.bss) *(.bss*)
    *(COMMON)                              /* 未初始化的 tentative definition */
    . = ALIGN(4);
    _ebss = .;                             /* ← 清零结束 */
    __bss_end__ = _ebss;
  } >RAM

  /* ---- 堆栈空间检查：链接期就能发现溢出 ---- */
  ._user_heap_stack :
  {
    . = ALIGN(8);
    PROVIDE ( end = . );
    PROVIDE ( _end = . );
    . = . + _Min_Heap_Size;
    . = . + _Min_Stack_Size;
    . = ALIGN(8);
  } >RAM

  /* ---- 检查是否超出 RAM 容量 ---- */
  /* 如果 .data + .bss + heap + stack 超过 20K，这里会在链接时报错 */
  .ARM.attributes 0 : { *(.ARM.attributes) }
}

/* ============ ④ 检查 Flash 溢出 ============ */
/* 汇编辅助函数，检查 _etext 是否超出 FLASH 长度 */
ASSERT(_etext <= ORIGIN(FLASH) + LENGTH(FLASH), "Error: FLASH overflowed!")
```

 

◆ 链接脚本里最该搞懂的一件事：LMA 与 VMA

 

**LMA（Load Memory Address）= 加载地址** ：这段数据在固件镜像里的位置（通常在 Flash）。  
  **VMA（Virtual Memory Address）= 运行地址** ：程序运行时这段数据应该在的位置（通常在 RAM）。

 

` .data : { ... } >RAM AT> FLASH ` 这行的意思是：  *"这段数据的运行地址在 RAM，但它的初始内容被存放在 Flash 里"* 。   
  
  **于是启动代码就必须在 main 之前把它从 Flash 搬到 RAM** —— 这就是 4.2 节里那段拷贝循环存在的原因。 理解这一层，你就理解了整个启动流程为什么必须那样写。

 

```zhizhan-anchor
ch4-4-1
```



### 4.4.1 实战：把不常用的大数组放到外部 SDRAM

 

ext\_ram.ld \+ usage.c — 自定义段 LD / C

 

```text
/* ========== 链接脚本片段 ========== */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  SDRAM (rwx) : ORIGIN = 0xC0000000, LENGTH = 8M    /* 外部 SDRAM */
}

SECTIONS
{
  /* ... 常规段 ... */

  /* 大图像缓冲区放 SDRAM，不占内部 RAM */
  .sdram_buffers (NOLOAD) :                /* NOLOAD：不需要初始化，不占 Flash */
  {
    . = ALIGN(4);
    _ssdram = .;
    *(.sdram_buf)
    *(.sdram_buf*)
    . = ALIGN(4);
    _esdram = .;
  } >SDRAM
}

/* ========== C 代码中的使用 ========== */
__attribute__((section(".sdram_buf")))
uint8_t g_frame_buffer[1920 * 1080];       /* 2 MB，放外部 SDRAM */

__attribute__((section(".sdram_buf"), aligned(32)))
uint32_t g_nn_workspace[256 * 1024];       /* 端侧 AI 的推理工作区 */

/* 注意：使用前必须确保 SDRAM 控制器已初始化！
   如果这段代码在 SystemInit 里就访问 → 硬件错误 */
void sdram_ready_hook(void)
{
    /* 在 SDRAM 初始化完成后，才可以使用上面的缓冲区 */
    extern uint8_t g_frame_buffer[];
    for (size_t i = 0; i < 1024; i++) {
        g_frame_buffer[i] = 0;
    }
}
```

 

⚠ 自定义段的三个坑

 

 
1. **` (NOLOAD) ` 标记数据不初始化、不占 Flash** 。不加的话，一个 2 MB 的数组会让你的固件镜像暴涨 2 MB。
 
2. **带初值的自定义段不会被自动初始化** 。启动代码只拷贝 ` .data `，你自定义的段需要自己在启动流程里加拷贝代码。
 
3. **必须在初始化完对应硬件后再访问** 。外部 SDRAM 要等控制器配好；否则总线错误。

 

```zhizhan-anchor
ch4-4-2
```



### 4.4.2 带初值的自定义段：一个变量同时住在两个地址上

 

前面那个 ` ext_ram.ld ` 是靠嘴讲的。这一节把同一件事 **真链出来看** ， 因为"自定义段"里最容易翻车的不是语法，而是 **一个变量同时拥有两个地址** 这件事。

 

先看要放的东西。下面这个文件里有一个 16 字节的校准数组，它的初始值是 **四个常数** ：

 

mysec.c — 一个带初值的自定义段，外加启动期把它从 Flash 搬进 RAM 的拷贝循环 C

 

```text
/* mysec.c —— F-253 取证：带初值的自定义段 + 启动期拷贝
 * 编译：arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c mysec.c -o mysec.o
 */
#include <stdint.h>

/* VMA 在 RAM，LMA 在 Flash —— 上电时必须靠下面这段拷贝把它搬进 RAM */
__attribute__((section(".mysec"))) uint32_t g_calib[4] = {
    0x11223344u, 0xAABBCCDDu, 0xDEADBEEFu, 0x55AA55AAu
};

extern uint32_t _smysec[];
extern uint32_t _emysec[];
extern uint32_t _smysec_load[];

/* 启动期拷贝：把 .mysec 的初值从 Flash(LMA) 搬到 RAM(VMA) */
void copy_mysec(void)
{
    uint32_t *src = _smysec_load;
    uint32_t *dst = _smysec;

    while (dst < _emysec) {
        *dst++ = *src++;
    }
}

int main(void)
{
    copy_mysec();
    for (;;) {
        /* 真机主循环 */
    }
}

void _start(void)
{
    main();
    for (;;) {
    }
}
```

 

注意 ` copy_mysec() ` 的存在：它不是可有可无的样板。 数组的初值必须 **先躺在 Flash 里** （掉电不丢），而它的 **运行位置在 RAM** ， 所以中间必须有一步"搬"。这和 ` .data ` 段的那段拷贝是同一件事， 只不过这次要搬的段是我自己造的。配套的链接脚本：

 

mysec.ld — .mysec 的 VMA 在 RAM、LMA 在 Flash，并立好三个边界符号 LINKER

 

```text
/* mysec.ld —— .mysec 的 VMA 在 RAM，LMA 在 Flash，并给出三个边界符号 */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

ENTRY(_start)

SECTIONS
{
  .text : {
    *(.text*)
    *(.rodata*)
  } > FLASH

  /* 带初值的自定义段：运行地址在 RAM，加载地址在 Flash */
  .mysec : {
    . = ALIGN(4);
    _smysec = .;
    *(.mysec)
    . = ALIGN(4);
    _emysec = .;
  } > RAM AT > FLASH

  /* 这个段在 Flash 里的起始地址就是 LMA 起点 */
  _smysec_load = LOADADDR(.mysec);

  .bss : {
    *(.bss*)
    *(COMMON)
  } > RAM
}
```

 

这个脚本里只有一行是"知识点"： ` .mysec : { … } > RAM AT > FLASH `。 ` > RAM ` 给出  **VMA** （运行地址）， ` AT > FLASH ` 给出  **LMA** （加载地址）。 再用 ` LOADADDR(.mysec) ` 把 LMA 起点的值 **存成一个符号** 给 C 用。 链一遍，三份输出一起看：

 

**bash**  — 链一次，看符号、看段表、看段内容

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c mysec.c -o mysec.o
$ arm-none-eabi-ld -T mysec.ld mysec.o -o mysec.elf

$ arm-none-eabi-nm mysec.elf | sort
08000000 T copy_mysec
08000040 T main
0800004a T _start
08000054 A _smysec_load
20000000 D _smysec
20000000 D g_calib
20000010 D _emysec
$ arm-none-eabi-readelf -l mysec.elf
Elf file type is EXEC (Executable file)
Entry point 0x800004b
There are 2 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00054 0x00054 R E 0x1000
  LOAD           0x002000 0x20000000 0x08000054 0x00010 0x00010 RW  0x1000

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .mysec 
$ arm-none-eabi-objdump -s -j .mysec mysec.elf
mysec.elf:     file format elf32-littlearm

Contents of section .mysec:
 20000000 44332211 ddccbbaa efbeadde aa55aa55  D3"..........U.U
```

 

◆ 把两个地址对上号：一个变量，两个"家"

 

上面三份输出里，同一个数组出现在四个地方，指的都是它：

 

| 符号 / 段 | 地址 | 含义 |
| --- | --- | --- |
| \_smysec | 0x20000000 | 段在  **RAM**  的起点 = VMA |
| g\_calib | 0x20000000 | 数组本身，就在 VMA 起点上 |
| \_emysec | 0x20000010 | RAM 里的终点；差 ` 0x10 ` = 16 字节 = 4 个字 |
| \_smysec\_load | 0x08000054 | 同样的 16 字节在  **Flash**  里的起点 = LMA |

 

**怎么确认 ` 0x08000054 ` 真的是"同一份数据"？**  看 ` readelf -l ` 那一行： ` LOAD 0x002000 0x20000000 0x08000054 0x00010 0x00010 RW ` ——第三列  *PhysAddr* （物理/加载地址）是 ` 0x08000054 `， 第二列  *VirtAddr*  是 ` 0x20000000 `， 两个 ` 0x00010 ` 分别是 FileSiz 和 MemSiz（一样大 = 全都要初始化）。  **一行里同时写着"住哪"和"从哪搬"** ，这就是 ` AT> ` 的全部含义。

 

再看 ` objdump -s -j .mysec `： ` 44332211 ddccbbaa efbeadde aa55aa55 `—— 小端读回来正是 ` 0x11223344, 0xAABBCCDD, 0xDEADBEEF, 0x55AA55AA `， 和 C 里写的 **一字不差** 。

 

**顺便一个可以自检的细节** ：` _start ` 在 ` 0x0800004a `，而 ` readelf ` 报的  *Entry point*  是 ` 0x800004b `——末位那个  **1**  又是 Thumb 位 （` ENTRY(_start) ` 写的是函数名，链接器自己补上的）。

 

现在换一个 **看起来很合理的写法** ：既然是"我自己的临时数据"， 那就标上 ` (NOLOAD) `，告诉链接器"别把它算进镜像"。同一个 ` mysec.c `，只换脚本：

 

mysec\_noload.ld — 对照版：.mysec 标成 (NOLOAD)，"不占 Flash" LINKER

 

```text
/* mysec_noload.ld —— 对照实验：.mysec 标成 (NOLOAD)，不产生 LMA 也不进镜像 */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

ENTRY(_start)

SECTIONS
{
  .text : {
    *(.text*)
    *(.rodata*)
  } > FLASH

  /* (NOLOAD)：只在 RAM 里占位，不占 Flash、不进 bin */
  .mysec (NOLOAD) : {
    . = ALIGN(4);
    _smysec = .;
    *(.mysec)
    . = ALIGN(4);
    _emysec = .;
  } > RAM

  _smysec_load = LOADADDR(.mysec);
}
```

 

**bash**  — 换脚本重链：注意它依然"成功"

 

```text
$ arm-none-eabi-ld -T mysec_noload.ld mysec.o -o mysec_noload.elf
（退出码 0，一个字都没说）

$ arm-none-eabi-nm mysec_noload.elf | sort
08000000 T copy_mysec
08000040 T main
0800004a T _start
20000000 B _smysec
20000000 A _smysec_load
20000000 B g_calib
20000010 B _emysec
$ arm-none-eabi-readelf -l mysec_noload.elf
Elf file type is EXEC (Executable file)
Entry point 0x800004b
There are 2 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00054 0x00054 R E 0x1000
  LOAD           0x000000 0x20000000 0x20000000 0x00000 0x00010 RW  0x1000

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .mysec 
$ arm-none-eabi-objdump -s -j .mysec mysec_noload.elf
mysec_noload.elf:     file format elf32-littlearm

Contents of section .mysec:
 20000000 00000000 00000000 00000000 00000000  ................
```

 

✕ ` LOADADDR() ` 在 ` (NOLOAD) ` 段上会【悄悄返回 VMA】

 

这是这一节唯一一个"会让人查到天亮"的坑，而且 **它不报错、不警告** 。 对比两次的 ` _smysec_load `：

 

| 检查项 | 正常版 mysec.ld | NOLOAD 版 |
| --- | --- | --- |
| ` ld ` 退出码 | 0 | 0（一样成功） |
| ` _smysec_load ` 的值 | 0x08000054 | 0x20000000 |
| ` nm ` 给它的类型字母 | A（绝对地址） | A（还是 A，看不出区别） |
| 段的 FileSiz / MemSiz | 0x10 / 0x10 | 0x00 / 0x10 |
| ` g_calib ` 的 nm 字母 | D（已初始化数据） | B（bss） |
| ` objdump -s -j .mysec ` | 44332211 ddccbbaa … | 全 0 |
| 生成的 .bin 大小 | 100 字节 | 84 字节 |

 

**为什么 ` _smysec_load ` 变成了 ` 0x20000000 `？**  因为 ` (NOLOAD) ` 段的 LMA 是"未定义"的， 链接器没有报错、也没有给个 0，而是 **把 VMA 原样返回** 。 于是你的启动代码会做这样一件事：  *"从 ` 0x20000000 ` 拷贝 16 字节到 ` 0x20000000 `"* ——  **源和目标是同一块内存，拷了个寂寞** 。

 

后果是： **程序一声不响地跑起来，` g_calib ` 里全是 0** 。 没有 HardFault、没有编译警告、没有链接错误。 在真机上这表现为"校准参数读出来全是 0"或者"配置表没生效"， 而你会先去怀疑 Flash 读取、再怀疑 EEPROM、最后才想起来看一眼链接脚本。

 

**记住判据** ：任何一次"我要从 LMA 搬到 VMA"的拷贝， 都先在 ` .map ` 里确认  **` _xxx_load ` 的地址在 Flash 区间**  （STM32 上是 ` 0x08xxxxxx `）。如果它落在了 ` 0x20xxxxxx `， 说明这个段的 LMA 根本不存在，拷贝逻辑从根上就是错的。

 

上面这个坑的反面也值得拆一下。既然 ` (NOLOAD) ` 能把它从镜像里摘掉， 那" **我把 C 里的初值删掉** "是不是也行？很多人是这么想的： 没有初值 → 没有要存的数据 → 不该占 Flash。我们来试试—— 除删掉那四个常数之外，` mysec.c ` 一个字符都不动：

 

☆ 这个对照不是另写一个文件，是门禁当场改出来的

 

本站的验证脚本会 **读取上面那段 ` mysec.c ` 的源码文本** ， 用正则把 ` uint32_t g_calib[4] = { … }; ` 替换成 ` uint32_t g_calib[4]; `，把结果写成 ` mysec_zero.c `， 然后用 *同一份*  ` mysec.ld ` 重新链一遍。 所以下面这些数字是 **真的由这次替换导致的** ， 而不是我又手写了一个"差不多"的文件。

 

**bash**  — 去掉初值之后（其余完全不变）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c mysec_zero.c -o mysec_zero.o
$ arm-none-eabi-ld -T mysec.ld mysec_zero.o -o mysec_zero.elf

$ arm-none-eabi-nm mysec_zero.elf | sort
08000000 T copy_mysec
08000040 T main
0800004a T _start
08000054 A _smysec_load
20000000 D _smysec
20000000 D g_calib
20000010 D _emysec
$ arm-none-eabi-readelf -l mysec_zero.elf
Elf file type is EXEC (Executable file)
Entry point 0x800004b
There are 2 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00054 0x00054 R E 0x1000
  LOAD           0x002000 0x20000000 0x08000054 0x00010 0x00010 RW  0x1000

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .mysec 
$ arm-none-eabi-objdump -s -j .mysec mysec_zero.elf   # 当然，全是 0
mysec_zero.elf:     file format elf32-littlearm

Contents of section .mysec:
 20000000 00000000 00000000 00000000 00000000  ................→ 镜像大小：mysec.bin 100 字节，mysec_zero.bin 100 字节 —— 一个字节都没省。
```

 

✕ "删掉 C 里的初值"省不了镜像：决定它的是【段类型】，不是【值是不是 0】

 

三份文件的 .bin 摆在一起（` ls -l *.bin ` 的原样输出）：

 

**bash**  — 三份镜像的大小

 

```text
$ ls -l *.bin
   100  字节  mysec.bin
    84  字节  mysec_noload.bin
   100  字节  mysec_zero.bin
```

 

` mysec.bin ` 和 ` mysec_zero.bin ` 都是 100 字节， 只有 ` mysec_noload.bin ` 是 84 字节。差的那 16 字节正是数组本身。

 

**根子在于：` g_calib ` 即使没有 C 初值，它进的仍然是 ` .mysec ` 段；而"这个段要不要占镜像"是 *链接脚本* 决定的， 编译器插不上嘴。**  我在目标文件层面看得更清楚——没链接之前的 ` mysec_zero.o `：

 

**bash**  — 没链接之前：段的类型就已经定死了

 

```text
$ arm-none-eabi-objdump -h mysec_zero.o
mysec_zero.o:     file format elf32-littlearm

Sections:
Idx Name          Size      VMA       LMA       File off  Algn
  0 .text         00000054  00000000  00000000  00000034  2**2
                  CONTENTS, ALLOC, LOAD, RELOC, READONLY, CODE
  1 .data         00000000  00000000  00000000  00000088  2**0
                  CONTENTS, ALLOC, LOAD, DATA
  2 .bss          00000000  00000000  00000000  00000088  2**0
                  ALLOC
  3 .mysec        00000010  00000000  00000000  00000088  2**2
                  CONTENTS, ALLOC, LOAD, DATA
  4 .comment      00000046  00000000  00000000  00000098  2**0
                  CONTENTS, READONLY
  5 .ARM.attributes 0000002d  00000000  00000000  000000de  2**0
                  CONTENTS, READONLY
$ arm-none-eabi-readelf -x .mysec mysec_zero.o
Hex dump of section '.mysec':
  0x00000000 00000000 00000000 00000000 00000000 ................
```

 

注意 ` .mysec ` 这一行带着  **` CONTENTS `** —— 意思是"这个节在文件里有实际内容"。有 ` CONTENTS ` 的节就是  *PROGBITS* （要占文件空间），而 GCC 之所以还给它 ` CONTENTS `， 仅仅因为它被放进了一个 **有初值属性的自定义段** 里—— 哪怕那 16 个字节全是 0。

 

**所以真正能省镜像的手段只有一个：在链接脚本里写 ` (NOLOAD) `** ， 让它从  *PROGBITS*  变成  *NOBITS*  （` readelf -S ` 里 ` .mysec ` 的类型会从 ` PROGBITS ` 变成 ` NOBITS `）。 在 C 里删初值、或者把数组写成 ` static `，  **都改不了这件事** 。

 

✓ 一句话记住这张表

 

 
- 想在  **RAM**  里跑、初值留在  **Flash**  → ` > RAM AT > FLASH ` \+ ` LOADADDR() ` \+  **自己写拷贝循环** 。
 
- 只想在  **RAM**  里占块地、 **不要镜像、初值无所谓**  → ` > RAM ` 加 ` (NOLOAD) `， **并且别再调 ` LOADADDR() `**  （它会返回 VMA 骗你）。
 
- 在 C 里删初值 →  **什么都不改变** ，镜像大小纹丝不动。

 

```zhizhan-anchor
ch4-4-3
```



### 4.4.3 把函数放进 RAM 去跑：` .RamFunc `，以及链接器自己插进来的那两条跳板

 

链接脚本除了"把数据放对地方"，还能" **把代码放对地方** "。 这件事在 STM32 上有一个非常具体的动机： **Flash 正在被擦写的时候，CPU 从 Flash 取指会咬住总线** 。 于是"擦 Flash 的那段代码"和"擦写期间还要响应的中断"必须搬进 RAM 执行。

 

做法和上一节的 ` .mysec ` 一模一样——把代码当成"带初值的数据"， VMA 在 RAM、LMA 在 Flash，启动时拷一次。先看要搬的函数：

 

ramfunc.c — 两个 \_\_attribute\_\_((section(".RamFunc"))) 函数 \+ 一个在 Flash 里调用它们的函数 \+ 启动拷贝 C

 

```text
/* ramfunc.c —— F-254 实验：把代码放进 RAM 跑 (.RamFunc)
 *
 * 编译: arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c ramfunc.c
 * 链接: arm-none-eabi-ld -T ramfunc.ld ramfunc.o -o ramfunc.elf
 *
 * 场景: Flash 擦写期间 CPU 无法从 Flash 取指,所以
 *   1) 擦写 Flash 的那段代码            -> 放 RAM
 *   2) 擦写期间必须响应的中断处理程序    -> 放 RAM
 * 这里用 section(".RamFunc") 实现第 1 类。
 */

#include <stdint.h>

/* 由链接脚本提供:RAM 里的运行地址区间 与 Flash 里的加载地址 */
extern uint32_t _siramfunc[];
extern uint32_t _sramfunc[];
extern uint32_t _eramfunc[];

void ramfunc_init(void);             /* 定义在文件末尾 */

/* FLASH 控制器寄存器(STM32F1 风格地址,这里只是占位) */
#define FLASH_KEYR   (*(volatile uint32_t *)0x40022004u)
#define FLASH_SR     (*(volatile uint32_t *)0x4002200Cu)
#define FLASH_CR     (*(volatile uint32_t *)0x40022010u)

/* 链接脚本里 ENTRY(Reset_Handler),这里给个最小实现,便于单独链接成功 */
void Reset_Handler(void)
{
    ramfunc_init();              /* 先把 .RamFunc / .data 从 Flash 搬进 RAM */
    for (;;) {
        /* 真实工程里这里进 main() */
    }
}

/* ---------------------------------------------------------------
 * 1) 真正要被搬到 RAM 里执行的函数
 * --------------------------------------------------------------- */
__attribute__((section(".RamFunc")))
void flash_erase_row(uint32_t addr)
{
    FLASH_CR = 0x00000202u;          /* 置 PER + SER,假装选中了某一页 */
    FLASH_CR |= 0x00000040u;         /* STRT:开始擦除 */
    while (FLASH_SR & 0x00000001u) { /* BSY:等擦除结束 */
        /* 此期间 CPU 若从 Flash 取指就会咬住总线,所以本循环必须在 RAM 里跑 */
    }
    FLASH_CR &= ~0x00000202u;
    (void)addr;
}

/* 第二个 RAM 函数:塞点循环,让 .RamFunc 段有一定体积便于观察 */
__attribute__((section(".RamFunc")))
void ram_busy_wait(volatile uint32_t n)
{
    while (n-- > 0u) {
        __asm__ volatile ("nop");
    }
}

/* ---------------------------------------------------------------
 * 2) 位于 Flash(.text) 中的调用者 -- 它要 bl 到 0x2000xxxx 去
 * --------------------------------------------------------------- */
void do_erase_from_flash(uint32_t addr)
{
    ram_busy_wait(10u);      /* 从 Flash 调用 RAM 里的函数 */
    flash_erase_row(addr);   /* 同上:这是本实验的“关键调用点” */
}

/* ---------------------------------------------------------------
 * 3) 启动拷贝代码:把 .RamFunc 的初值从 Flash 搬到 RAM
 *    (和 .data 段一模一样的搬法)
 * --------------------------------------------------------------- */
void ramfunc_init(void)
{
    uint32_t *src = _siramfunc;   /* Flash 中的加载地址 (LMA) */
    uint32_t *dst = _sramfunc;    /* RAM 中的运行地址   (VMA) */
    while (dst < _eramfunc) {
        *dst++ = *src++;
    }
}
```

 

这个文件的结构值得先看一眼，因为它把"两地分居"摆得很清楚：

 

 
- ` flash_erase_row() ` 和 ` ram_busy_wait() ` 带 ` section(".RamFunc") `，它们 **要住进 RAM** ；
 
- ` do_erase_from_flash() `  **不带** 属性，它留在 ` .text ` （也就是 Flash）里—— **它就是那个"从 Flash 调用 RAM"的现场** ；
 
- ` ramfunc_init() ` 是拷贝循环，和搬 ` .data ` 的写法逐字对应。
 

 

链接脚本把这三件事串起来：

 

ramfunc.ld — .RamFunc 的 VMA 在 RAM、LMA 在 Flash，外加 .data / .bss 的常规安排 LINKER

 

```text
/* ramfunc.ld —— F-254 实验用链接脚本
 * Cortex-M3: Flash 0x08000000 / SRAM 0x20000000
 * 关键点: .RamFunc 的 VMA 在 RAM, LMA 在 FLASH  ->  ">RAM AT>FLASH"
 */

ENTRY(Reset_Handler)

MEMORY
{
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

SECTIONS
{
    .isr_vector : {
        KEEP(*(.isr_vector))
    } > FLASH

    .text : {
        *(.text*)
        *(.rodata*)
        . = ALIGN(4);
    } > FLASH

    /* -----------------------------------------------------------
     * .RamFunc : 运行地址(VMA)在 RAM,加载地址(LMA)紧随 .text 之后在 FLASH
     * 启动时必须由 ramfunc_init() 把 _siramfunc -> _sramfunc 拷一遍
     * ----------------------------------------------------------- */
    .RamFunc : {
        . = ALIGN(4);
        _sramfunc = .;
        *(.RamFunc)
        . = ALIGN(4);
        _eramfunc = .;
    } > RAM AT > FLASH
    _siramfunc = LOADADDR(.RamFunc);

    /* .data : 常规做法,VMA 在 RAM,LMA 在 FLASH */
    .data : {
        . = ALIGN(4);
        _sdata = .;
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH
    _sidata = LOADADDR(.data);

    .bss : {
        . = ALIGN(4);
        _sbss = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
    } > RAM

    . = ALIGN(4);
    _end = .;
}
```

 

链一次，然后按"符号 → 段表 → 段内容 → 反汇编"的顺序看：

 

**bash**  — 链一次：注意那条警告，本节后半段要专门讲它

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c ramfunc.c -o ramfunc.o
$ arm-none-eabi-ld -T ramfunc.ld ramfunc.o -o ramfunc.elf
arm-none-eabi-ld: warning: ramfunc.elf has a LOAD segment with RWX permissions
$ arm-none-eabi-nm ramfunc.elf | sort
08000000 T Reset_Handler
0800000a T do_erase_from_flash
08000026 T ramfunc_init
08000068 t __ram_busy_wait_veneer
08000070 t __flash_erase_row_veneer
08000078 A _siramfunc
080000e8 A _sidata
20000000 T _sramfunc
20000000 T flash_erase_row
2000004c T ram_busy_wait
20000070 B _ebss
20000070 D _edata
20000070 B _end
20000070 T _eramfunc
20000070 B _sbss
20000070 D _sdata
$ arm-none-eabi-objdump -h ramfunc.elf
ramfunc.elf:     file format elf32-littlearm

Sections:
Idx Name          Size      VMA       LMA       File off  Algn
  0 .text         00000078  08000000  08000000  00001000  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
  1 .RamFunc      00000070  20000000  08000078  00002000  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
  2 .data         00000000  20000070  080000e8  00002070  2**0
                  CONTENTS, ALLOC, LOAD, DATA
  3 .bss          00000000  20000070  080000e8  00002070  2**0
                  ALLOC
  4 .comment      00000045  00000000  00000000  00002070  2**0
                  CONTENTS, READONLY
  5 .ARM.attributes 0000002d  00000000  00000000  000020b5  2**0
                  CONTENTS, READONLY
$ arm-none-eabi-readelf -l ramfunc.elf
Elf file type is EXEC (Executable file)
Entry point 0x8000001
There are 2 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00078 0x00078 R E 0x1000
  LOAD           0x002000 0x20000000 0x08000078 0x00070 0x00070 RWE 0x1000

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .RamFunc
```

 

◆ 先确认"它真的被放到了 RAM"：四个数字互相对得上

 

| 符号 / 段 | 值 | 说明 |
| --- | --- | --- |
| \_sramfunc | 0x20000000 | ` .RamFunc ` 在 RAM 的起点（VMA） |
| flash\_erase\_row | 0x20000000 | 第一个 RAM 函数，就在段首 |
| ram\_busy\_wait | 0x2000004c | 第二个 RAM 函数 |
| \_eramfunc | 0x20000070 | 段在 RAM 的终点；长度 ` 0x70 ` = 112 字节 |
| \_siramfunc | 0x08000078 | **同样的 112 字节在 Flash 里的位置（LMA）** |

 

段表也印证了：` .RamFunc 00000070 20000000 08000078 `—— 大小 ` 0x70 `、VMA ` 0x20000000 `、 LMA ` 0x08000078 `。而 ` readelf -l ` 那一行 ` LOAD 0x002000 0x20000000 0x08000078 0x00070 0x00070 RWE ` 里的  *PhysAddr*  也是 ` 0x08000078 `——和 ` _siramfunc ` 一模一样。 **三方对上号，拷贝循环的源和目标都是真的。**

 

还有个数字很漂亮：` .text ` 大小正好 ` 0x78 `， 而 ` .RamFunc ` 的 LMA 正好从 ` 0x08000000 + 0x78 = 0x08000078 ` 开始—— **它紧贴在 Flash 里已有内容的屁股后面，没有留缝** 。 这就是"` AT> ` 让链接器自己安排 LMA"的结果。

 

现在看反汇编里最有意思的部分。那个"住在 Flash 里的调用者"要怎么跳到 ` 0x2000xxxx ` 去？

 

**bash**  — 反汇编：先看 Flash 侧（.text）

 

```text
$ arm-none-eabi-objdump -d ramfunc.elf
0800000a <do_erase_from_flash>:
 800000a:	b580      	push	{r7, lr}
 800000c:	b082      	sub	sp, #8
 800000e:	af00      	add	r7, sp, #0
 8000010:	6078      	str	r0, [r7, #4]
 8000012:	200a      	movs	r0, #10
 8000014:	f000 f828 	bl	8000068 <__ram_busy_wait_veneer>
 8000018:	6878      	ldr	r0, [r7, #4]
 800001a:	f000 f829 	bl	8000070 <__flash_erase_row_veneer>
 800001e:	bf00      	nop
 8000020:	3708      	adds	r7, #8
 8000022:	46bd      	mov	sp, r7
 8000024:	bd80      	pop	{r7, pc}
→ do_erase_from_flash 的两条 bl，目标都不是 RAM 地址，而是 0x08000068 / 0x08000070。

08000068 <__ram_busy_wait_veneer>:
 8000068:	f85f f000 	ldr.w	pc, [pc]	@ 800006c <__ram_busy_wait_veneer+0x4>
 800006c:	2000004d 	.word	0x2000004d

08000070 <__flash_erase_row_veneer>:
 8000070:	f85f f000 	ldr.w	pc, [pc]	@ 8000074 <__flash_erase_row_veneer+0x4>
 8000074:	20000001 	.word	0x20000001
```

 

◆ 那两条 ` bl ` 跳不到 RAM —— 链接器替你插了两条"跳板"

 

Thumb-2 的 ` bl ` 指令编码里只有  **24 位** 偏移 （低 1 位固定为 0，因为目标一定对齐到半字），能覆盖的范围正好是  **±16 MiB** 。 而这次要跨的距离是：

 

 
- 调用点：` 0x0800001a `
 
- 目标：` 0x20000000 `
 
- 差值：约 ` 0x18000000 ` ≈  **384 MiB**
 

 

**384 MiB 是 16 MiB 的 24 倍** ，` bl ` 根本够不着。 但链接 **没有报错、没有警告** ——它自己生成了两条跳板 （ *veneer* ，直译"贴面"），放在 ` .text ` 的末尾：

 

```zhizhan-table
{"rows":[[{"body":"跳板符号","header":true,"rowSpan":1,"colSpan":1},{"body":"地址","header":true,"rowSpan":1,"colSpan":1},{"body":"两条指令","header":true,"rowSpan":1,"colSpan":1},{"body":"跳去哪","header":true,"rowSpan":1,"colSpan":1}],[{"body":"\\_\\_ram\\_busy\\_wait\\_veneer","header":false,"rowSpan":1,"colSpan":1},{"body":"0x08000068","header":false,"rowSpan":1,"colSpan":1},{"body":"ldr.w pc, \\[pc\\]  \n0x2000004d","header":false,"rowSpan":1,"colSpan":1},{"body":"` ram_busy_wait ` @ 0x2000004c","header":false,"rowSpan":1,"colSpan":1}],[{"body":"\\_\\_flash\\_erase\\_row\\_veneer","header":false,"rowSpan":1,"colSpan":1},{"body":"0x08000070","header":false,"rowSpan":1,"colSpan":1},{"body":"ldr.w pc, \\[pc\\]  \n0x20000001","header":false,"rowSpan":1,"colSpan":1},{"body":"` flash_erase_row ` @ 0x20000000","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

` ldr.w pc, [pc] `（机器码 ` f85f f000 `） 是一条"把紧跟在自己后面的那个 32 位字装进 PC"的指令—— **相当于一次绝对跳转** 。 于是 ` bl ` 跳到跳板、跳板再绝对跳到 RAM，两跳接力。

 

**那两个 ` …004d ` / ` …0001 ` 末位的 1，又是 Thumb 位** ： ` 0x2000004c + 1 = 0x2000004d `、 ` 0x20000000 + 1 = 0x20000001 `。 本页已经是第三次见到这个 ` +1 ` 了（向量表、` .init_array `、这里）——  **它不是一个可以忽略的细节，而是 ARM 状态切换的编码约定本身** 。

 

**FIG 4.7**  跨 384 MiB 的两跳接力：` bl ` → veneer（在 Flash）→ 绝对跳转 → RAM 函数

 

```zhizhan-figure
<svg viewBox="0 0 660 372" width="660" height="372" role="img" aria-label="veneer 跳板接力示意">
          <defs>
            <marker id="ah25" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--amb)"></path>
            </marker>
            <marker id="ah26" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--grn)"></path>
            </marker>
            <marker id="ah27" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--red)"></path>
            </marker>
          </defs>

          <text x="30" y="24" class="sv-lbl-hi" style="fill:var(--amb)">Flash　0x08000000 起（.text，大小 0x78）</text>
          <rect x="30" y="36" width="600" height="126" rx="6" class="sv-amb-s"></rect>
          <text x="44" y="58" class="sv-t">0800000a  do_erase_from_flash</text>
          <text x="44" y="78" class="sv-t">08000014  <tspan style="fill:var(--amb)">bl  __ram_busy_wait_veneer</tspan>　← 只能到 ±16 MiB</text>
          <text x="44" y="96" class="sv-t">0800001a  <tspan style="fill:var(--amb)">bl  __flash_erase_row_veneer</tspan></text>
          <text x="44" y="118" class="sv-t">08000068  __ram_busy_wait_veneer</text>
          <text x="44" y="134" class="sv-t">　　　　　<tspan style="fill:var(--grn)">ldr.w pc, [pc]</tspan>　+　<tspan style="fill:var(--grn)">.word 0x2000004d</tspan></text>
          <text x="44" y="152" class="sv-t">08000070  __flash_erase_row_veneer　<tspan style="fill:var(--grn)">.word 0x20000001</tspan></text>

          <text x="30" y="212" class="sv-lbl-hi" style="fill:var(--cyn)">RAM　0x20000000 起（.RamFunc，大小 0x70）</text>
          <rect x="30" y="224" width="600" height="76" rx="6" class="sv-cyn-s"></rect>
          <text x="44" y="246" class="sv-t">20000000  flash_erase_row　<tspan style="fill:var(--cyn)">← 段首 = _sramfunc</tspan></text>
          <text x="44" y="264" class="sv-t">2000004c  ram_busy_wait</text>
          <text x="44" y="284" class="sv-t">20000070  _eramfunc　（Flash 侧的初值在 _siramfunc = 0x08000078）</text>

          <path d="M 640 96 C 656 96 656 246 640 246" stroke="var(--amb)" stroke-width="1.6" fill="none" marker-end="url(#ah25)"></path>
          <text x="352" y="176" class="sv-lbl-dim">bl 够不着 → 链接器自己插跳板（静默，不报错）</text>
          <path d="M 200 134 L 200 246" stroke="var(--grn)" stroke-width="1.6" fill="none" marker-end="url(#ah26)"></path>
          <text x="212" y="196" class="sv-lbl-dim" style="fill:var(--grn)">ldr.w pc 绝对跳转</text>

          <text x="30" y="332" class="sv-lbl-dim">危险在这里：跳板住在 .text，也就是 <tspan style="fill:var(--red)">Flash</tspan> —— 你正在擦的那块 Flash。</text>
          <text x="30" y="352" class="sv-lbl-dim">擦到含跳板的那一页，接力棒断了：.RamFunc 里的代码明明还在 RAM，却再也跳不进去。</text>
        </svg>
```

 

**图注：** 地址全部来自本站实测的 ` nm ` 与 ` objdump -d ` 输出。 箭头表示"谁跳到谁"：` bl ` 只能短跳，跨 384 MiB 必须靠跳板里的绝对跳转。  *本图是机制示意，不含未实测的数值。*

 

✕ 跳板住在 Flash 里 —— 这正是"搬到 RAM 跑"最容易漏的一环

 

上面那两条跳板的地址是 ` 0x08000068 ` 和 ` 0x08000070 `——  **在 Flash 里** （` .text ` 段）。 而 ` objdump -d ` 的输出标题也明明白白写着 ` Disassembly of section .text: ` 下面跟着这两个跳板。

 

于是就有这个场面：

 

 
1. 你的代码要擦掉 Flash 的某一页；
 
2. 擦写期间 CPU 从 Flash 取指会咬总线 —— 所以你 **很聪明地** 把擦写函数搬进了 RAM；
 
3. 但 ` bl ` 到那个 RAM 函数之前， **要先执行位于 ` 0x08000068 ` 的跳板** ；
 
4. 如果 ` 0x08000068 ` 恰好落在你正在擦的那一页里，  **取指在这里就卡死了，永远到不了 RAM** 。
 

 

**而且链接器不会提醒你** ：跳板是它自己生成的， 它只保证"跳得到"，不保证"跳得到的时候那两字节还在"。 这个坑在真机上表现为"擦写偶发死机"或"升级过程中卡死"， 而且换一版代码、地址挪几字节，症状就变了——非常难查。

 

**可操作的判据** ：如果你的工程里有 ` .RamFunc `， 就在 ` .map ` 或 ` nm ` 里搜 ` veneer `。只要出现，就说明 **有一处跨区间调用是你没规划过的** ， 必须去确认那些跳板的地址和你要擦写的页不重叠。 更稳妥的做法见下面 ` -mlong-calls ` 那一节。

 

跳板是链接器的"兜底方案"。翻过来看，还有一个" **主动方案** "： 加 ` -mlong-calls `，让编译器自己按"远调用"生成代码。同一份源码，只多一个开关：

 

**bash**  — 加 -mlong-calls 重编重链：跳板消失了

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -mlong-calls -c ramfunc.c -o ramfunc_lc.o
$ arm-none-eabi-ld -T ramfunc.ld ramfunc_lc.o -o ramfunc_lc.elf
arm-none-eabi-ld: warning: ramfunc_lc.elf has a LOAD segment with RWX permissions
$ arm-none-eabi-nm ramfunc_lc.elf | sort
08000000 T Reset_Handler
0800000a T do_erase_from_flash
08000030 T ramfunc_init
08000070 A _siramfunc
080000e0 A _sidata
20000000 T _sramfunc
20000000 T flash_erase_row
2000004c T ram_busy_wait
20000070 B _ebss
20000070 D _edata
20000070 B _end
20000070 T _eramfunc
20000070 B _sbss
20000070 D _sdata→ 搜不到任何 veneer 了；而 _siramfunc 从 0x08000078 挪到了 0x08000070。

$ arm-none-eabi-objdump -d ramfunc_lc.elf
0800000a <do_erase_from_flash>:
 800000a:	b580      	push	{r7, lr}
 800000c:	b082      	sub	sp, #8
 800000e:	af00      	add	r7, sp, #0
 8000010:	6078      	str	r0, [r7, #4]
 8000012:	200a      	movs	r0, #10
 8000014:	4b04      	ldr	r3, [pc, #16]	@ (8000028 <do_erase_from_flash+0x1e>)
 8000016:	4798      	blx	r3
 8000018:	6878      	ldr	r0, [r7, #4]
 800001a:	4b04      	ldr	r3, [pc, #16]	@ (800002c <do_erase_from_flash+0x22>)
 800001c:	4798      	blx	r3
 800001e:	bf00      	nop
 8000020:	3708      	adds	r7, #8
 8000022:	46bd      	mov	sp, r7
 8000024:	bd80      	pop	{r7, pc}
 8000026:	bf00      	nop
 8000028:	2000004d 	.word	0x2000004d
 800002c:	20000001 	.word	0x20000001
```

 

◆ 两种方案的账：谁在 Flash 里多占地方

 

|  | 默认（靠 veneer） | -mlong-calls |
| --- | --- | --- |
| 调用点的指令 | bl \<veneer\>（4 字节） | ldr r3,\[pc,#16\] \+ blx r3（8 字节） |
| 跳板 | 链接器生成 2 条，共 16 字节，在 .text | 没有 |
| .text 总大小 | 0x78 | 0x70（省 8 字节） |
| ` _siramfunc ` | 0x08000078 | 0x08000070 |
| 谁决定"要不要远调用" | 链接器事后看出够不着才补 | 编译器对每个调用都按远的生成 |

 

算一下账：跳板方案是  **"4 字节调用点 \+ 16 字节跳板" = 20 字节** ， 远调用方案是  **"8 字节调用点 × 2 = 16 字节"** 。 这次跳板略亏—— **但关键是跳板方案的 20 字节里有 16 字节躺在 Flash 里， 而这 16 字节的位置是链接器算出来的、你事前无法预知** 。

 

**所以选择标准不是"哪个省字节"，而是"谁可控"：**

 

 
- 如果那段 Flash 会被程序自己擦写（IAP / [OTA](term:ota) / 参数存储）→  **用 ` -mlong-calls `** ，把所有跳转都钉在你自己写的指令里， 地址随 ` .text ` 布局一起规划。
 
- 如果只是"为了放个大数组"而把代码搬进外部 RAM（不会擦那块 Flash）→ 让链接器补跳板更省事，但它会在 ` .text ` 尾巴上留下一段你看不见的代码。
 

 

另外 ` -mlong-calls ` 有个代价要知道：  **它对 *所有* 调用都按远调用生成** ，包括本来一墙之隔的近调用。 整个工程都开着，代码体积会涨（大约每处调用多 4 字节）。 真项目里通常只给"会被搬进 RAM 的那几个文件"单独加这个开关。

 

⚠ 段头写着 READONLY，可你的启动代码马上就要写它

 

回看一下 ` objdump -h ` 的输出，` .RamFunc ` 这一行的属性是：

 

` CONTENTS, ALLOC, LOAD, READONLY, CODE `

 

注意那个  **` READONLY `** 。 而你的 ` ramfunc_init() ` 一上电就要往这段内存里 **写**  112 字节。 在裸机上这没事（MCU 不管段的属性，只管地址）；但两件事要留意：

 

 
- 开了  **MPU** （内存保护单元）并且真的按段属性配了权限， 这次启动拷贝就会触发一个 ` MemManage ` 异常。 厂商给的 FreeRTOS 例程里经常要为此把 ` .RamFunc ` 的区域单独配成可写。
 
- 更常见的是 **把 ` .data ` 和 ` .RamFunc ` 混在一段里**  之后自己算不清哪块是代码、哪块是数据。` readelf -l ` 里那个 ` RWE ` 的 LOAD 段（可读可写可执行）就是这类混装的痕迹。
 

 

顺带解释本节开头那条警告：` has a LOAD segment with RWX permissions `。 脚本把 ` .RamFunc ` 单独放进了一个 LOAD 段， 而这个段既要"可执行"（它是代码）又要"可写"（启动时要拷进去）—— 链接器认为这种"什么权限都敢给"的段值得提醒一下。  **这条警告在这个场景下是正常的** ，不像上一节那样代表写错了。

 

*本节两份 ` ld ` 警告的原始输出里，行首带着完整的工具链安装路径； 我把它截到了 ` arm-none-eabi-ld: ` 为止，其余一字未改。*

 

```zhizhan-anchor
ch4-4-4
```



### 4.4.4 非连续的内存区：CCM / DTCM / ITCM 是怎么接进来的

 

前面两节搬来搬去，都还在" **一段 Flash \+ 一段 RAM** "这个模型里。 高性能一点的 STM32（F4 / F7 / H7）会多出 **紧耦合内存** —— CCM RAM、DTCM、ITCM。它们和主 SRAM  **地址不连续** ， 而且是 **贴着 CPU 核心** 挂的，不走总线矩阵。

 

这一节 **不讨论"它快多少"** （那要硬件才测得出）， 只讨论一个我能在本机验穿的问题：  **链接器到底管不管"你给的地址是不是真的存在、是不是连成一片"？**  先写两个数组，一个不要初值、一个要初值：

 

ccmram.c — 一个 .ccmram(NOLOAD) 暂存数组 \+ 一个 .ccmram\_init 带初值数组 \+ 只拷后者 C

 

```text
/* ccmram.c —— F-256 实测部分：把数据放进一个“非连续”的额外 RAM 区(模拟 CCM RAM)
 *
 * 编译: arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c ccmram.c
 * 链接: arm-none-eabi-ld -T ccmram.ld ccmram.o -o ccmram.elf
 */

#include <stdint.h>

extern uint32_t _siccmram_init[];   /* .ccmram_init 的 Flash 加载地址(LMA) */
extern uint32_t _sccmram_init[];    /* .ccmram_init 的 CCM 运行地址(VMA)  */
extern uint32_t _eccmram_init[];

/* ---------------------------------------------------------------
 * (a) 无初值的大数组 —— 放 .ccmram,链接时标 NOLOAD
 *     不占 Flash、启动代码也不拷贝它;上电后内容是随机的
 * --------------------------------------------------------------- */
__attribute__((section(".ccmram")))
uint32_t ccm_scratch[4096];          /* 16 KB,纯运行期暂存 */

/* ---------------------------------------------------------------
 * (b) 有初值的数组 —— 放 .ccmram_init
 *     代价:初值必须在 Flash 里存一份,启动时再拷到 CCM
 * --------------------------------------------------------------- */
__attribute__((section(".ccmram_init")))
uint32_t ccm_lut[128] = {            /* 512 字节 */
    0x00000011u, 0x00000022u, 0x00000033u, 0x00000044u,
    /* 其余元素隐式清零,但整个数组仍属“有初值”,照样占 Flash */
};

/* ---------------------------------------------------------------
 * 启动拷贝:只拷“有初值”的那块,和 .data 的拷法一样
 * --------------------------------------------------------------- */
void Reset_Handler(void)
{
    uint32_t *src = _siccmram_init;
    uint32_t *dst = _sccmram_init;
    while (dst < _eccmram_init) {
        *dst++ = *src++;
    }
    for (;;) {
        /* 真实工程里这里进 main() */
    }
}

/* 随便引用一下,避免数组被当成“未使用” */
uint32_t ccm_touch(uint32_t i)
{
    ccm_scratch[i & 4095u] = ccm_lut[i & 127u];
    return ccm_scratch[i & 4095u];
}
```

 

**刻意做成两段** ，因为它们的代价完全不同，而这正是最容易搞混的地方： ` ccm_scratch ` 只是"占住 CCM 里的一块地"， ` ccm_lut ` 则需要在 Flash 里 **留一份初值副本** 。 链接脚本里给 CCM 开了一个和另外两段都不挨着的地段：

 

ccmram.ld — 三个 MEMORY 区：Flash 0x08000000、SRAM 0x20000000、CCMRAM 0x10000000 LINKER

 

```text
/* ccmram.ld —— F-256 实测部分
 * 在常规 Flash/SRAM 之外,再开辟一个“非连续”的额外 RAM 区,模拟 CCM RAM。
 *   0x08000000 Flash
 *   0x20000000 SRAM
 *   0x10000000 CCMRAM   <-- 与上面两者都不连续
 */

ENTRY(Reset_Handler)

MEMORY
{
    FLASH  (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
    RAM    (rwx) : ORIGIN = 0x20000000, LENGTH = 128K
    CCMRAM (rw)  : ORIGIN = 0x10000000, LENGTH = 64K
}

SECTIONS
{
    .isr_vector : {
        KEEP(*(.isr_vector))
    } > FLASH

    .text : {
        *(.text*)
        *(.rodata*)
        . = ALIGN(4);
    } > FLASH

    /* ---------------------------------------------------------------
     * (a) NOLOAD 的 CCM 段:只占 CCM 地址空间,不进 Flash、不进任何 LOAD 段
     * --------------------------------------------------------------- */
    .ccmram (NOLOAD) : {
        . = ALIGN(4);
        _sccmram = .;
        *(.ccmram)
        . = ALIGN(4);
        _eccmram = .;
    } > CCMRAM

    /* ---------------------------------------------------------------
     * (b) 有初值的 CCM 段:VMA 在 CCM,LMA 在 FLASH
     *     -> 多出一个 LOAD 段,并在 Flash 里多留一份副本
     * --------------------------------------------------------------- */
    .ccmram_init : {
        . = ALIGN(4);
        _sccmram_init = .;
        *(.ccmram_init)
        . = ALIGN(4);
        _eccmram_init = .;
    } > CCMRAM AT > FLASH
    _siccmram_init = LOADADDR(.ccmram_init);

    /* 常规 .data / .bss,放在真正的 SRAM 里 */
    .data : {
        . = ALIGN(4);
        _sdata = .;
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH
    _sidata = LOADADDR(.data);

    .bss : {
        . = ALIGN(4);
        _sbss = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
    } > RAM

    . = ALIGN(4);
    _end = .;
}
```

 

注意 ` CCMRAM ` 的起点是 ` 0x10000000 `， 和 Flash 的 ` 0x08000000 `、SRAM 的 ` 0x20000000 `  **中间隔着巨大的空洞** 。链一遍：

 

**bash**  — 链一次：链接器对"地址连不连续"这件事完全没有意见

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c ccmram.c -o ccmram.o
$ arm-none-eabi-ld -T ccmram.ld ccmram.o -o ccmram.elf
（退出码 0，无输出）

$ arm-none-eabi-nm ccmram.elf | sort
08000000 T Reset_Handler
08000038 T ccm_touch
08000078 A _siccmram_init
08000278 A _sidata
10000000 B _sccmram
10000000 B ccm_scratch
10004000 B _eccmram
10004000 D _sccmram_init
10004000 D ccm_lut
10004200 D _eccmram_init
20000000 B _ebss
20000000 D _edata
20000000 B _end
20000000 B _sbss
20000000 D _sdata
$ arm-none-eabi-readelf -l ccmram.elf
Elf file type is EXEC (Executable file)
Entry point 0x8000001
There are 4 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00078 0x00078 R E 0x1000
  LOAD           0x002000 0x10004000 0x08000078 0x00200 0x00200 RW  0x1000
  LOAD           0x003000 0x20000000 0x08000278 0x00000 0x00000 RW  0x1000
  LOAD           0x000000 0x10000000 0x10000000 0x00000 0x04000 RW  0x1000

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .ccmram_init 
   02     .data .bss 
   03     .ccmram
```

 

◆ 三段地址，四个 LOAD 段 —— 把每一段的去向拆开看

 

` readelf -l ` 这次报了  **4 个**  program header， 每一段都对应链接脚本里的一个安排：

 

| LOAD 段 | VMA | LMA | 大小 | 来自脚本里的 |
| --- | --- | --- | --- | --- |
| #0 | 0x08000000 | 0x08000000 | 0x078 / 0x078 R E | ` .text > FLASH ` |
| #1 | 0x10004000 | 0x08000078 | 0x200 RW | ` .ccmram_init > CCMRAM AT > FLASH ` |
| #2 | 0x20000000 | 0x08000278 | 0x000 RW | ` .data ` / ` .bss ` |
| #3 | 0x10000000 | 0x10000000 | 0x04000 RW | ` .ccmram (NOLOAD) ` |

 

三条结论，每条都能从符号表里找到对应：

 

 
1. **CCM 里那块没初值的 16 KB，一个字节 Flash 都不占。**  ` _sccmram = 10000000 `、` _eccmram = 10004000 `、 ` ccm_scratch = 10000000 `，类型字母是 ` B `（bss）。 对应 LOAD 段 #3 的  *FileSiz = 0x00000* —— **在镜像里根本没有它** 。
 
2. **CCM 里那块有初值的 512 字节，在 Flash 里留了一整份副本。**  ` ccm_lut = 10004000 ` 在 CCM， 而 ` _siccmram_init = 08000078 ` 在 Flash—— LOAD 段 #1 的  *PhysAddr*  正是 ` 0x08000078 `、  *FileSiz = MemSiz = 0x200* （512 字节，全都要搬）。  **这就是"给 CCM 加初值"的真实价格：Flash 里多 512 字节 \+ 多一个 LOAD 段。**
 
3. **Flash 里的排列顺序跟着脚本走。**  ` _sidata = 0x08000278 `，正好等于 ` 0x08000078 + 0x200 `—— 因为脚本里 ` .ccmram_init ` 写在 ` .data ` 前面， 所以它的初值副本先占 Flash，` .data ` 接在它后面。  *改脚本里两个段的先后顺序，这两个数就会对调。*
 

 

**而全程链接器一句话都没说。**  ` 0x10000000 ` 这个地址在这颗 cortex-m3 上 **根本不存在**  （这是颗 F103 级别的核），` ld ` 照样把东西放过去了——  **它只做地址算术，不查地址表** 。

 

为了确认"多出来的那个 LOAD 段确实是有初值数组带来的"，做一个对照： 把带初值的数组整个删掉， **同一个链接脚本** 重新链。

 

ccm\_ctl.c — 对照实验：只剩 NOLOAD 数组，其余全删（这个文件只用于门禁取证，不是示例） C

 

```text
/* ccm_ctl.c —— 对照实验(不是交付给网页的示例,只用来验证
 * “给 CCM 加一个【有初值】数组会多出一个 LOAD 段” 这句话)。
 * 这里【只】有一个 NOLOAD 数组,用同一个 ccmram.ld 链接。
 */
#include <stdint.h>

__attribute__((section(".ccmram")))
uint32_t ccm_scratch[4096];

void Reset_Handler(void)
{
    for (;;) {
    }
}
```

 

**bash**  — 对照实验：LOAD 段从 4 个减到 3 个

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c ccm_ctl.c -o ccm_ctl.o
$ arm-none-eabi-ld -T ccmram.ld ccm_ctl.o -o ccm_ctl.elf
（退出码 0，无输出）

$ arm-none-eabi-readelf -l ccm_ctl.elf
Elf file type is EXEC (Executable file)
Entry point 0x8000001
There are 3 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00008 0x00008 R E 0x1000
  LOAD           0x002000 0x20000000 0x08000008 0x00000 0x00000 RW  0x1000
  LOAD           0x000000 0x10000000 0x10000000 0x00000 0x04000 RW  0x1000

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .data .bss 
   02     .ccmram → There are 3 program headers。少掉的那一个，正是 .ccmram_init 那一段。
```

 

✕ 链接器不会告诉你"这个地址在你的芯片上不存在"

 

两次链接的对比很干净：

 

|  | ccmram.c（两个数组） | ccm\_ctl.c（只留 NOLOAD） |
| --- | --- | --- |
| program header 数 | 4 | 3 |
| CCM 里的 LOAD 段 | #1（.ccmram\_init）\+#3（.ccmram） | 只剩 #2（.ccmram） |
| Flash 里的额外副本 | 0x200 字节 | 0 |
| ` ld ` 的退出码 | 0 | 0 |

 

**把地址换成一个明摆着不存在的数，结论一样。**  我只把 ` CCMRAM ` 的 ` ORIGIN ` 从 ` 0x10000000 ` 改成 ` 0xDEAD0000 `， 其余一个字符不动，原样再链一次：

 

**bash**  — 把 CCM 地址改成一个根本不存在的数

 

```text
$ sed "s/0x10000000, LENGTH = 64K/0xDEAD0000, LENGTH = 64K/" ccmram.ld > ccmram_dead.ld   # 只改这一个数
$ arm-none-eabi-ld -T ccmram_dead.ld ccmram.o -o ccmram_dead.elf
ld 退出码 = 0

$ arm-none-eabi-nm ccmram_dead.elf | grep -E "ccm_scratch|ccm_lut|_siccmram_init"
08000078 A _siccmram_init
dead4000 D ccm_lut
dead0000 B ccm_scratch
```

 

` ld ` 退出码还是  **0** ，而且它 **老老实实把数组放到了 ` 0xDEAD0000 ` 和 ` 0xDEAD4000 `** 。 这段固件烧进任何一颗真实芯片都会立刻死—— **但链接期没有任何征兆** 。

 

**这意味着一整类错误没有任何工具能替你拦住** ： 地址写错、LENGTH 写得比真实容量大、复制粘贴了别的型号的脚本—— 全都在链接期"通过"，只在真机上以 HardFault 或数据静默错乱的形式冒出来。

 

**所以这一步必须自己核对** ，核对的对象不是工具链，是 **芯片数据手册** ：

 

 
- CCM / DTCM / ITCM 的起始地址与容量，逐个和 ` MEMORY ` 块里的 ` ORIGIN ` / ` LENGTH ` 对上；
 
- 这些区域 **能不能执行代码** 、 **能不能被 [DMA](term:dma) 访问** —— 这两条因型号而异，而且 **直接决定你的缓冲区能不能放进去** ；
 
- ` LENGTH ` 一定要写对：它只用来在链接期做溢出检查 （上一节 ` heap_B_tight.ld ` 那个 ` region RAM overflowed by 6152 bytes ` 就是它干的活），  **写大了就等于把这个检查关掉** 。

 

**FIG 4.8**  三段互不相连的地址空间：链接器只管往格子里填，不管格子是否真的存在

 

```zhizhan-figure
<svg viewBox="0 0 660 356" width="660" height="356" role="img" aria-label="Flash / SRAM / CCMRAM 三段地址与四个 LOAD 段">
          <defs>
            <marker id="ah28" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--grn)"></path>
            </marker>
            <marker id="ah29" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--vio)"></path>
            </marker>
            <marker id="ah30" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--amb)"></path>
            </marker>
          </defs>

          <text x="30" y="22" class="sv-lbl-hi" style="fill:var(--amb)">Flash　0x08000000</text>
          <rect x="30" y="32" width="240" height="96" rx="6" class="sv-amb-s"></rect>
          <text x="42" y="52" class="sv-t">.text　0x08000000 + 0x78</text>
          <text x="42" y="72" class="sv-t" style="fill:var(--grn)">.ccmram_init 的初值副本</text>
          <text x="42" y="88" class="sv-t" style="fill:var(--grn)">0x08000078　0x200 字节</text>
          <text x="42" y="110" class="sv-t">_sidata = 0x08000278（.data）</text>

          <text x="390" y="22" class="sv-lbl-hi" style="fill:var(--cyn)">SRAM　0x20000000</text>
          <rect x="390" y="32" width="240" height="60" rx="6" class="sv-cyn-s"></rect>
          <text x="402" y="54" class="sv-t">.data / .bss</text>
          <text x="402" y="74" class="sv-t" style="fill:var(--amb)">LMA 0x08000278（在 Flash）</text>

          <text x="30" y="180" class="sv-lbl-hi" style="fill:var(--vio)">CCMRAM　0x10000000　（与上两段都不连续）</text>
          <rect x="30" y="192" width="600" height="84" rx="6" class="sv-vio-s"></rect>
          <text x="44" y="214" class="sv-t">0x10000000　<tspan style="fill:var(--vio)">.ccmram (NOLOAD)</tspan>　ccm_scratch[4096]　0x4000</text>
          <text x="44" y="234" class="sv-t">0x10004000　<tspan style="fill:var(--grn)">.ccmram_init</tspan>　ccm_lut[128]　0x200</text>
          <text x="44" y="256" class="sv-t">0x10004200　_eccmram_init</text>
          <text x="44" y="272" class="sv-lbl-dim">NOLOAD 段 FileSiz=0（不占镜像）；有初值段 FileSiz=0x200（Flash 里留副本）</text>

          <path d="M 150 128 L 150 192" stroke="var(--grn)" stroke-width="1.6" fill="none" stroke-dasharray="5 3" marker-end="url(#ah28)"></path>
          <text x="160" y="164" class="sv-lbl-dim" style="fill:var(--grn)">拷贝 0x200 字节</text>
          <path d="M 480 92 L 480 192" stroke="var(--amb)" stroke-width="1.5" fill="none" stroke-dasharray="5 3" marker-end="url(#ah30)"></path>
          <text x="440" y="150" class="sv-lbl-dim" style="fill:var(--amb)">拷贝 .data</text>

          <text x="30" y="306" class="sv-lbl-dim">这四个 LOAD 段是 ld 自己排出来的；把 CCMRAM 的 ORIGIN 改成 0xDEAD0000，它照样链接成功。</text>
          <text x="30" y="326" class="sv-lbl-dim">"0x10000000 在这颗芯片上是不是真的 CCM" —— 只有数据手册能回答，工具链回答不了。</text>
        </svg>
```

 

**图注：** 本图的三段地址、四个 LOAD 段、以及两个拷贝箭头全部来自本站实测的 ` ccmram.ld ` \+ ` ccmram.c ` 链接结果 （` nm ` / ` readelf -l `）。  *图中数组元素个数与尺寸都是源码里的真实值（` ccm_scratch[4096] ` = 0x4000、 ` ccm_lut[128] ` = 0x200）；虚线箭头是"数据的搬运方向"，不是物理连线。*

 

⚠ 这一节里我不能替你验的部分：CCM 到底快多少、能不能 DMA

 

到这里为止，本节所有数字都是真的链出来、读出来的。但"为什么要把东西放进 CCM"这件事，  **我只能给手册事实，不能给实测** ——本站在写这一节时没有硬件。

 

| 说法 | 本站能不能验 | 怎么才能验 |
| --- | --- | --- |
| CCM/DTCM 与主 SRAM 地址不连续，可以同时在链接脚本里声明 | 能，已实测 | 本节的 ` readelf -l ` 四段输出 |
| 给 CCM 段加初值会在 Flash 里多留一份副本、多一个 LOAD 段 | 能，已实测 | 本节 A/B 对照：4 段 vs 3 段 |
| CCM 是 **零等待周期** 、访问比 Flash 快 | 不能，手册事实 | 真机上跑 ` DWT->CYCCNT ` 计时对比 |
| **DMA 访问不到 CCM** （这是最常踩的坑） | 不能，手册事实 | 真机上用 DMA 读一块 CCM 缓冲区，看是否触发传输错误 |
| ITCM 里的代码不能和 DTCM 重叠、有些型号 CCM 不可执行 | 不能，手册事实 | 逐型号查参考手册；本机连"这颗核有没有 CCM"都测不出 |

 

**特别提醒第三条那个坑** ：把 ADC/DAC/SPI 的 DMA 缓冲区放进 CCM， 是 H7/F7 上非常经典的一类"代码看起来没问题、数据永远不对"。 原因就是 **CCM 挂在 CPU 自己的总线上，DMA 控制器根本看不见它** 。  **这一条请以你手上那颗芯片的参考手册为准，不要以本页为准。**

 

*另外说清楚：本节为了能在本机跑通，用的是一颗 cortex-m3（STM32F1 级别）， 它 **并没有**  CCM。所谓"CCM 段"只是我在链接脚本里声明的一个额外地址区间—— 这恰好也让上面那条结论更有说服力： **链接器连"这个地址是真是假"都不管， 更不会管"这块内存是什么类型的"。***

 

✓ 上手清单：给工程加一段非连续内存时要核对的四件事

 

 
1. **地址和容量** ——照参考手册的 memory map 填 ` ORIGIN `/` LENGTH `， ` LENGTH ` 宁小勿大（它是唯一的溢出检查）。
 
2. **能不能执行** ——要放代码的段必须落在可执行的区域， 否则在同一段里混放 ` .text ` 会得到一堆 HardFault。
 
3. **能不能被 DMA 访问** ——DMA 缓冲区一律放主 SRAM，这是最省事也最不容易错的选择。
 
4. **要不要初值** ——不要初值就一律加 ` (NOLOAD) `， 能省掉 Flash 副本和一个 LOAD 段；要初值就必须自己写启动拷贝循环 （` .data ` 的拷贝管不到你的自定义段）。

 

```zhizhan-anchor
ch4-5
```



## 4.5 堆：为什么嵌入式里要慎用 malloc

 





```zhizhan-anchor
ch4-5-1
```



### 4.5.1 堆的边界是谁定的：` end `、` _sbrk `，以及一次"看着更对"的改错

 

前面四节我们把 ` .data `、` .bss `、栈、自定义段全都钉到了具体地址上， 每一个都有链接脚本语法去描述它。现在剩下最后一个区域： **堆** 。

 

堆和前面所有区域都不一样，有三个"没有"：

 

 
- **没有 SECTION 语法。** 链接脚本里你找不到 ` .heap ` 这样的段—— ` malloc ` 要的内存不属于任何一个段。
 
- **它的"起点"是一个符号** ，名字约定叫 ` end `（或 ` _end `）。
 
- **它的"终点"完全没有。** 链接器给的只有起点，终点要靠你自己在 C 里画。
 

 

这一节我们就把这三件事一件一件钉死，并且——先剧透一下——  **中间会撞上一次我自己推错的结论** 。那一次恰好是本节最值钱的部分。

 

#### 第一步：` end ` 不是语言特性，是链接脚本里的一个符号

 

很多老教材会写"` end ` 是链接器自动定义的、指向 ` .bss ` 之后的地址"。 这句话听起来像语言规范，其实只是 **某些链接脚本写了这么一行** 。 下面这份 ` heap.ld ` 就是 *故意* 不写它的：

 

heap.ld — 最简脚本：只放代码和数据，刻意不定义 end Linker Script

 

```text
/* heap.ld - 最简链接脚本: 只放代码和数据, 不预留堆栈, 不定义 end */
ENTRY(main)

MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

/* 栈顶: RAM 最高地址 (栈向下生长) */
_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
  .isr_vector : {
    KEEP(*(.isr_vector))
  } >FLASH

  .text : {
    *(.text*)
    *(.rodata*)
    . = ALIGN(4);
    _etext = .;
  } >FLASH

  .data : ALIGN(4) {
    _sdata = .;
    *(.data*)
    . = ALIGN(4);
    _edata = .;
  } >RAM AT> FLASH

  .bss : ALIGN(4) {
    _sbss = .;
    *(.bss*)
    *(COMMON)
    . = ALIGN(4);
    _ebss = .;
  } >RAM

  /* 注意: 这里刻意没有 PROVIDE(end = .); 也没有 ._user_heap_stack */
}
```

 

配套一个最小 ` heap_main.c `，它只负责在 ` .bss ` 里放点东西，好让我们等会儿能对着地址看：

 

heap\_main.c — 制造一个有内容的 .bss（1 KiB 数组 \+ 几个零散变量） C

 

```text
/* heap_main.c - F-258 堆边界取证: 只关心 .bss 有没有真实内容 */
#include <stdint.h>

int main(void) { return 0; }

volatile uint32_t g_counter;          /* .bss 4 字节 */
volatile uint32_t g_table[256];       /* .bss 1 KiB */
static uint8_t    s_buffer[1024];     /* .bss 1 KiB */
static uint32_t   s_zero;             /* .bss 4 字节 */
```

 

现在把 ` sbrk.c `（下一节会整份看它，这里先只看它引用了 ` end `） 和 ` heap_main.c ` 一起交给这份脚本：

 

**bash**  — 编译两遍都没问题，链接着手就炸了

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c heap_main.c -o heap_main.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c sbrk.c -o sbrk.o
(两行都没有输出，退出码 0)

$ arm-none-eabi-ld -T heap.ld heap_main.o sbrk.o -o bare.elf
$ arm-none-eabi-ld -T heap.ld heap_main.o sbrk.o -o bare.elf
arm-none-eabi-ld: sbrk.o: in function `_sbrk':
sbrk.c:(.text+0x58): undefined reference to `end'
ld 退出码 = 1
```

 

✕ 编译器全绿，链接器才认识 ` end `——而且它不认识

 

注意报错的两层信息，缺一不可：

 

 
1. **打头的是 ` arm-none-eabi-ld: `，不是 ` cc1 `。**  ` sbrk.c ` 编译得干干净净（上面两行 ` gcc -c ` 零输出）。 编译器看见 ` extern char end; ` 只会想"这是个别处定义的外部符号"，  **先记一笔未解析引用就走人** 。这类符号叫  *未定义符号* ， 负责把它填上的从来不是编译器，是链接器。
 
2. **行号 ` sbrk.c:(.text+0x58) ` 是段内偏移，不是源文件行号。**  链接器此刻已经看不到 C 源码了，它只知道"有个目标文件里、` .text ` 往后 0x58 字节处， 有个地方要引用 ` end `"。想看真正的行号得打开调试信息（` -g `）。  *别拿 0x58 去源码里数第 88 个字符。*
 

 

**结论：` end ` 既不是 C 语言的一部分，也不是 GNU ld 的内置行为。**  它是链接脚本作者（或 CubeMX 这类代码生成器）用一行 ` PROVIDE ` 造出来的。 脚本里没写，就真的没有。

 

#### 第二步：` PROVIDE ` 是"惰性"的

 

那 CubeMX 那种脚本是怎么写的？长这样（` heap_A.ld `，和你从 CubeMX 里拿到的那份基本一致）：

 

heap\_A.ld — CubeMX 风格：靠一个 .\_user\_heap\_stack 预留段把 end 定义出来 Linker Script

 

```text
/* heap_A.ld - CubeMX 风格: 有 ._user_heap_stack 预留段 */
ENTRY(main)

_Min_Heap_Size  = 0x200;
_Min_Stack_Size = 0x400;

MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
  .isr_vector : { KEEP(*(.isr_vector)) } >FLASH

  .text : {
    *(.text*)
    *(.rodata*)
    . = ALIGN(4);
    _etext = .;
  } >FLASH

  .data : ALIGN(4) {
    _sdata = .;
    *(.data*)
    . = ALIGN(4);
    _edata = .;
  } >RAM AT> FLASH

  .bss : ALIGN(4) {
    _sbss = .;
    *(.bss*)
    *(COMMON)
    . = ALIGN(4);
    _ebss = .;
  } >RAM

  /* 预留段: end/_end 在这里被定义 */
  ._user_heap_stack : ALIGN(8) {
    PROVIDE ( end = . );
    PROVIDE ( _end = . );
    . = . + _Min_Heap_Size;
    . = . + _Min_Stack_Size;
    . = ALIGN(8);
  } >RAM
}
```

 

看到 ` PROVIDE ( end = . ); ` 这行，直觉会告诉你： *现在有 ` end ` 了。*  我们来看实测—— **先只链 ` heap_main.o `（没有任何人引用 ` end `），再链上 ` sbrk.o `：**

 

**bash**  — 同一份链接脚本，两种结果

 

```text
$ arm-none-eabi-ld -T heap_A.ld heap_main.o -o A_nosbrk.elf
$ arm-none-eabi-nm A_nosbrk.elf | grep -E "end|_ebss|_estack"
20000808 B _ebss
20010000 T _estack
(退出码 0，但输出里没有 end —— 脚本里明明写了 PROVIDE (end = .))

$ arm-none-eabi-ld -T heap_A.ld heap_main.o sbrk.o -o A.elf
$ arm-none-eabi-nm A.elf | grep -E " end$|_ebss|_estack"
2000080c B _ebss
20010000 T _estack
20000810 B end
```

 

◆ ` PROVIDE ` 只在"有人要"的时候才真的定义符号

 

上面第二次运行里出现了 ` 20000810 B end `，第一次运行里 **一个字都没有** 。 脚本没变，变的只是"有没有人引用它"。

 

更漂亮的是，这个机制在 **同一次链接** 里就能看见。看 ` map ` 文件里这一段：

 

| map 里的原文 | 含义 |
| --- | --- |
| 0x20000810 PROVIDE (end = .) | 真定义了。` sbrk.c ` 引用了 ` end `，所以 ld 把值算出来并写进符号表 |
| \[!provide\] PROVIDE (\_end = .) | **没定义。** 没有任何输入文件引用 ` _end `，ld 直接跳过 |

 

` [!provide] ` 这个方括号前缀是 ` ld `  *自己* 打的标注—— 相当于它在 map 里明说了"这一行我没执行"。

 

**规则原话：** ` PROVIDE(sym = expr) ` 定义 ` sym `， 但 **仅当 ` sym ` 被引用、且没有任何输入文件或其它脚本语句定义它时** 才生效。 这条来自 GNU ld 手册，而上面这个 ` [!provide] ` 就是它在真实输出里的长相。

 

**实用推论有两条，方向相反：**

 

 
- **你可以随便写。** 一堆 ` PROVIDE ` 没人用就自动消失，不占空间、不进符号表。
 
- **但不能靠它"提供默认值"。** 如果你的代码写成 ` #ifdef ` 风格去探测某个 ` PROVIDE ` 符号，那是探测不到的——` PROVIDE ` 的"存在"不是静态事实。

 

#### 第三步：` _Min_Heap_Size ` 到底"预留"了什么

 

到这里为止，` heap_A.ld ` 里还有一段没解释：

 

```text
  ._user_heap_stack : ALIGN(8) {
    PROVIDE ( end = . );
    . = . + _Min_Heap_Size;      /* 0x200 */
    . = . + _Min_Stack_Size;     /* 0x400 */
    . = ALIGN(8);
  } >RAM
```

 

一个很自然的读法是： *"这是给堆留 0x200、给栈留 0x400。"*  那我们把 ` _Min_Heap_Size ` 从 ` 0x200 ` 改成 ` 0x2000 ` （ **只改这一个数** ），看看堆能用的量会不会跟着变大：

 

**bash**  — 只把 \_Min\_Heap\_Size 从 0x200 改成 0x2000（heap\_B.ld）

 

```text
$ arm-none-eabi-ld -T heap_B.ld heap_main.o sbrk.o -o B.elf
   （heap_B.ld 与 heap_A.ld 的唯一差别：_Min_Heap_Size 从 0x200 改成 0x2000）
$ arm-none-eabi-nm B.elf | grep -E " end$|_ebss|_estack"
2000080c B _ebss
20010000 T _estack
20000810 B end
```

 

两边的 ` end `  **一模一样，都是 ` 0x20000810 `** 。 变的是别的东西——看 map：

 

**bash**  — 同一个数的两种取值，map 里的差别

 

```text
$ arm-none-eabi-ld -T heap_A.ld heap_main.o sbrk.o -Map=A.map -o A.elf
$ sed -n '/_Min_Heap_Size =/p;/_ebss =/p;/\._user_heap_stack/,$p' A.map | head -12
                0x00000200                        _Min_Heap_Size = 0x200
                0x2000080c                        _ebss = .
._user_heap_stack
                0x20000810      0x600 load address 0x08000070
                0x20000810                        PROVIDE (end = .)
                [!provide]                        PROVIDE (_end = .)
                0x20000a10                        . = (. + _Min_Heap_Size)
 *fill*         0x20000810      0x200 
                0x20000e10                        . = (. + _Min_Stack_Size)
 *fill*         0x20000a10      0x400 
                0x20000e10                        . = ALIGN (0x8)
LOAD heap_main.o

$ arm-none-eabi-ld -T heap_B.ld heap_main.o sbrk.o -Map=B.map -o B.elf
   （heap_B.ld = heap_A.ld 只改一个数：_Min_Heap_Size 0x200 -> 0x2000）
$ sed -n "/_Min_Heap_Size =/p;/_ebss =/p;/\._user_heap_stack/,\$p" B.map | head -12
                0x00002000                        _Min_Heap_Size = 0x2000
                0x2000080c                        _ebss = .
._user_heap_stack
                0x20000810     0x2400 load address 0x08000070
                0x20000810                        PROVIDE (end = .)
                [!provide]                        PROVIDE (_end = .)
                0x20002810                        . = (. + _Min_Heap_Size)
 *fill*         0x20000810     0x2000 
                0x20002c10                        . = (. + _Min_Stack_Size)
 *fill*         0x20002810      0x400 
                0x20002c10                        . = ALIGN (0x8)
LOAD heap_main.o
```

 

◆ 它不移动 ` end `，也不给堆"留"任何东西

 

把两次运行并列起来看，这一改动的效果只有一栏变了：

 

| 观测量 | ` heap_A.ld `（0x200） | ` heap_B.ld `（0x2000） |
| --- | --- | --- |
| ` ._user_heap_stack ` 段大小 | 0x600 | 0x2400 |
| 段内第一处 ` *fill* ` | 0x200 | 0x2000 |
| 该段结束地址 | 0x20000e10 | 0x20002c10 |
| **` end ` 的值** | 0x20000810 | 0x20000810 |
| ` nm ` 里的 ` end ` | 20000810 B end | 20000810 B end |

 

` end ` 之所以纹丝不动，是因为 ` PROVIDE (end = .) ` 写在了  **两个 ` . = . + … ` 之前** ——那两句还没执行， ` . ` 当然还在预留区的开头。

 

**那 ` _Min_Heap_Size ` 到底干了什么？**  它只做了一件事： **把 ` ._user_heap_stack ` 这个段拉长** 。 段一变长，链接器就得检查"从 ` .bss ` 末尾往后， 这块 RAM 里还有没有这么多字节"——没有就报错。

 

也就是说， **它是链接期的一道断言，不是运行期的分配。**  证据在下面：把 RAM 从 64K 改成 4K，别的都不动，链接直接失败——

 

**bash**  — 预留段的真正作用：链不到就报错

 

```text
$ arm-none-eabi-ld -T heap_B_tight.ld heap_main.o sbrk.o -o tight.elf
   （heap_B_tight.ld = heap_B.ld 再把 RAM 的 LENGTH 从 64K 改成 4K）
arm-none-eabi-ld: tight.elf section `._user_heap_stack' will not fit in region `RAM'
arm-none-eabi-ld: region `RAM' overflowed by 7184 bytes
ld 退出码 = 1
```

 

⚠ 把它读成"我给堆留了 8 KiB"是最常见的误解

 

上面那次失败的算术很简单：` .bss ` 结束在 ` 0x2000080c `， 预留段对齐到 ` 0x20000810 ` 之后要占 ` 0x2400 `， 于是需要 ` 0x20002c10 `；而 4K 的 RAM 只到 ` 0x20001000 `——  **` 0x20002c10 - 0x20001000 = 0x1c10 = 7184 ` 字节** ， 正好是 ld 报出来的数字。

 

**但请注意它 *没有* 保证任何运行期的事。**  段里的那些 ` *fill* ` 在 ELF 里就是一段空洞，运行时没有任何代码去检查堆有没有越过去。 ` _Min_Heap_Size ` 这个符号在整个工程里只出现两处 （map 里看得见）：` _Min_Heap_Size = 0x200 ` 的赋值， 和 ` . = (. + _Min_Heap_Size) ` 的使用。 **都在链接脚本里。**  ` sbrk.c ` 不知道它存在，newlib 的 ` malloc ` 也不知道。

 

**记忆法：** ` _Min_*_Size ` 这一族符号的名字里的  *Min*  是关键——它是" **至少** 给我留这么多，否则别让我链过"， 不是" **最多** 只能用这么多"。

 

#### 第四步：一次"看着更对"的改动 —— 本节最值钱的坑

 

我读 ` heap_A.ld ` 的时候觉得别扭：  *"` PROVIDE (end = .) ` 写在预留 **之前** ， 那 ` end ` 不就落在预留区 **里面** 了吗？ 堆从这里往上长，岂不是会把'留给栈的那 0x400'吃掉？应该把 ` PROVIDE ` 挪到预留 **之后** 才对。"*

 

这个推理听起来挺顺。我照做了，写成了 ` heap_C.ld ` （顺带把 ` .text ` / ` .data ` / ` .bss ` 压成单行， 让差异一眼可见—— **语义一个字没改** ）：

 

heap\_C.ld — 把两行 PROVIDE 从预留段"开头"挪到"结尾" Linker Script

 

```text
/* heap_C.ld - 变体: PROVIDE(end) 放在预留"之后", _Min_Heap_Size = 0x200 */
ENTRY(main)

_Min_Heap_Size  = 0x200;
_Min_Stack_Size = 0x400;

MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
  .isr_vector : { KEEP(*(.isr_vector)) } >FLASH
  .text : { *(.text*) *(.rodata*) . = ALIGN(4); _etext = .; } >FLASH
  .data : ALIGN(4) { _sdata = .; *(.data*) . = ALIGN(4); _edata = .; } >RAM AT> FLASH
  .bss : ALIGN(4) { _sbss = .; *(.bss*) *(COMMON) . = ALIGN(4); _ebss = .; } >RAM

  ._user_heap_stack : ALIGN(8) {
    . = . + _Min_Heap_Size;
    . = . + _Min_Stack_Size;
    . = ALIGN(8);
    PROVIDE ( end = . );        /* <-- 放在预留之后 */
    PROVIDE ( _end = . );
  } >RAM
}
```

 

链接照常成功，没有任何警告。然后 ` nm ` 给了我一个没想到的数：

 

**bash**  — 结果和我推的"更合理"完全相反

 

```text
$ arm-none-eabi-ld -T heap_C.ld heap_main.o sbrk.o -Map=C.map -o C.elf
   （heap_C.ld 把两行 PROVIDE 从预留段"开头"挪到了"结尾"）
$ sed -n '/_Min_Heap_Size =/p;/_ebss =/p;/\._user_heap_stack/,$p' C.map | head -12
                0x00000200                        _Min_Heap_Size = 0x200
                0x2000080c                        _ebss = .
._user_heap_stack
                0x20000810      0x600 load address 0x08000070
                0x20000a10                        . = (. + _Min_Heap_Size)
 *fill*         0x20000810      0x200 
                0x20000e10                        . = (. + _Min_Stack_Size)
 *fill*         0x20000a10      0x400 
                0x20000e10                        . = ALIGN (0x8)
                0x20000e10                        PROVIDE (end = .)
                [!provide]                        PROVIDE (_end = .)
LOAD heap_main.o

$ arm-none-eabi-ld -T heap_C.ld heap_main.o sbrk.o -o C.elf
   （heap_C.ld 把两行 PROVIDE 从预留段"开头"挪到了"结尾"）
$ arm-none-eabi-nm C.elf | grep -E " end$|_ebss|_estack"
2000080c B _ebss
20010000 T _estack
20000e10 B end
```

 

✕ ` end ` 从 ` 0x20000810 ` 跳到了 ` 0x20000e10 `

 

整整抬高 ` 0x600 `——正好是 ` _Min_Heap_Size + _Min_Stack_Size ` = ` 0x200 + 0x400 `。 而 ` _estack ` 还是 ` 0x20010000 `（栈顶由 ` ORIGIN(RAM)+LENGTH(RAM) ` 定， 跟这个段无关）。

 

**于是堆的起点上移了 0x600，上界一点没动** —— ` _sbrk ` 能往上走到哪儿，取决于 ` _estack ` 和它自己那个 ` STACK_GUARD `，跟 ` end ` 无关。 所以这次改动的净效果是 **可分配量整整少了 0x600** 。

 

把两次的数都算出来（` limit = 0x20010000 - 0x400 = 0x2000FC00 `）：

 

|  | ` heap_A.ld ` | ` heap_C.ld ` |
| --- | --- | --- |
| 堆起点 ` end ` | 0x20000810 | 0x20000E10 |
| 可分配上界 ` limit ` | 0x2000FC00 | 0x2000FC00 |
| **两者之差** | 0xF3F0 | 0xEDF0 |

 

**为什么？** 因为两行 ` PROVIDE ` 挪到后面以后， 预留的那 0x600 落在了 ` end `  **下面** ， 变成了一段 **谁都不用的隔离带** ： ` .bss ` 在 ` 0x2000080c ` 就结束了， ` end ` 却告诉堆"你从 ` 0x20000e10 ` 开始"， 中间这 0x600 既没被任何段装载，也永远不会有代码去碰。

 

**在 A 里同样这 0x600 是"堆的地盘"** ——它也是 ` *fill* `、 也没有代码碰它，但 ` end ` 指着它的下沿， 所以堆的第一批分配就落在这块区域里，一点不浪费。  **两种写法留给堆的 *上界* 完全相同，差的就是这 0x600 的起点。**

 

**所以这个坑的教益不是"哪个写法对"。**  两种写法都老老实实预留了 0x600，谁也没比谁"更正确"—— 差别只在这 0x600 落在 ` end ` 的哪一边，而这决定了你丢掉的可用内存。 真正的教益是后半句：

 

**链接脚本改动的效果，必须拿 ` nm ` / ` map ` 去看，不能靠读代码推。**  我这次就是靠读代码推的，推错了；是 ` nm ` 把我打回来的。 对 ` .ld ` 文件尤其如此——它没有类型、没有作用域、 ` . ` 的位置还随语句顺序变化， **肉眼推理的可靠性很低** 。

 

#### 第五步：` _sbrk ` 自己那十几行

 

说了半天"堆的起点是 ` end `"，那从 ` end ` 到"堆顶"这段路是谁在走？ 是 ` _sbrk `——` malloc ` 每次要内存都会来调它一次。 完整实现如下（这就是前面链接时缺 ` end ` 的那个文件）：

 

sbrk.c — 可用的 \_sbrk：游标 \+ 一处手写的栈碰撞检查 C

 

```text
/* sbrk.c - 真实可用的 newlib _sbrk 实现 (无编译告警版本)
 * 约定: 返回"旧的"堆顶; 失败返回 (void*)-1
 */
#include <stddef.h>
#include <stdint.h>

extern char end;                 /* 由链接脚本定义: PROVIDE ( end = . ) */
extern char _estack;             /* RAM 最高地址 = 栈顶 */

#define STACK_GUARD  0x400u      /* 给栈留的安全边距, 防止堆把栈顶穿 */

static char *heap_end = 0;       /* 静态游标; 首次调用时初始化 */

void *_sbrk(ptrdiff_t incr)
{
    char *prev;
    char *limit = (char *)((uintptr_t)&_estack - STACK_GUARD);

    if (heap_end == 0) {
        heap_end = &end;         /* 第一次: 堆从 end 开始 */
    }
    prev = heap_end;

    /* 与栈碰撞检查: 堆向上长, 栈向下长 */
    if (heap_end + incr > limit) {
        return (void *)-1;       /* 分配失败 */
    }
    heap_end += incr;
    return (void *)prev;
}
```

 

注意第 17 行的写法：` (char *)((uintptr_t)&_estack - STACK_GUARD) `。 我第一版是 **不转整数、直接拿指针减** 的。下面这份是那个版本单独摘出来的最小复现 （除了一行以外和上面一模一样，这个文件我留在页面上当反面教材）：

 

sbrk\_ptr.c — 反面写法：拿 extern char 符号直接减常数当边界 C

 

```text
/* sbrk_ptr.c - 反面写法: 拿 char* 直接减常数当边界 */
#include <stddef.h>
#include <stdint.h>
extern char end;
extern char _estack;
#define STACK_GUARD  0x400u
static char *heap_end = 0;
void *_sbrk(ptrdiff_t incr)
{
    char *prev;
    char *limit = (char *)(&_estack - STACK_GUARD);
    if (heap_end == 0) heap_end = &end;
    prev = heap_end;
    if (heap_end + incr > limit) return (void *)-1;
    heap_end += incr;
    return (void *)prev;
}
```

 

它 **编得过** ——只是被骂了一句，而且只在 ` -O2 ` 被骂：

 

**bash**  — 同一份代码的"直减版"（sbrk\_ptr.c），-O0 与 -O2 的差别

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c sbrk_ptr.c -o /dev/null
(无输出，退出码 0 —— -O0 下它一声不吭)

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -O2 -c sbrk_ptr.c -o /dev/null
sbrk_ptr.c: In function '_sbrk':
sbrk_ptr.c:11:11: warning: array subscript -1024 is outside array bounds of 'char[1]' [-Warray-bounds=]
   11 |     char *limit = (char *)(&_estack - STACK_GUARD);
      |           ^~~~~
sbrk_ptr.c:5:13: note: at offset -1024 into object '_estack' of size 1
    5 | extern char _estack;
      |             ^~~~~~~
(退出码 0 —— 只是个 warning，构建照样成功)
```

 

⚠ 这是个只在 ` -O2 ` 出现、而且 **不会** 让构建失败的警告

 

三层信息，每层都值得停一下：

 

 
1. **为什么编译器说 ` _estack ` 是 ` char[1] `？**  因为 ` extern char _estack; ` 这个声明的意思是" *别处有一个 char 对象* "， 而 C 里对象的大小至少是 1——所以它眼里 ` _estack ` 就是 **一个长度为 1 的数组** 。 链接脚本可不管你怎么声明，它只会把 ` _estack ` 当成一个 **地址** 。
 
2. **为什么是"下标 -1024"？**  ` &_estack ` 是指向那个"长度 1 的数组"首元素的指针， ` &_estack - 1024 ` 在编译器眼里等价于 **下标 -1024** ——越界 1024 格。 ` STACK_GUARD ` 正好是 ` 0x400u ` = 1024，对得上。
 
3. **` -O0 ` 一声不吭，` -O2 ` 才报，而且退出码是 0。**  越是优化等级高，编译器越愿意做这类跨越符号的静态推理； 而它发了也只是  *warning* —— **CI 只检查退出码的话，这一句会一路溜到产品里** 。 （前面讲 ` -Wstack-usage ` 时见过同样的形态： 诊断默认不改退出码，要拦下来得显式写 ` -Werror=… `。）
 

 

**而且这里不只是"消警告"。** C 标准里，对 *两个不指向同一数组元素* 的指针做减法，  **本身就是未定义行为** （只能对"同一数组内的两个元素"求差）。 ` _estack ` 和那个想象中的数组没有任何关系， ` &_estack - 1024 ` 严格来说不该被写出这种语义。 转成 ` uintptr_t ` 再减，是把这件事从"指针算术"降级成"整数减法"—— 地址本来就是整数，做整数减法天经地义。

 

**规则可以推广：凡是用 *符号名字* 冒充地址的地方——链接脚本符号、外设基址、 中断向量表地址——一律先转 ` uintptr_t ` 再运算。**  这也是 CMSIS 里 ` SCB `、` NVIC ` 那些宏全都在做 ` ((uint32_t)0xE000E000UL) ` 这类强转的原因。

 

最后一个问题：为什么 ` _sbrk ` 里非得自己写那个 ` limit ` 判断？ 链接器不是已经知道 RAM 有多少了吗？

 

**因为链接器只知道"段"，不知道"堆"。**  它能把 ` ._user_heap_stack ` 的长度算出来、 能在放不下的时候报错，但它在运行时 **不参与任何事** —— 那些 ` *fill* ` 在 ELF 里只是一个地址空洞， 没有任何一条指令会因为堆越过了它而停下来。 ` _sbrk ` 实现里的 ` limit ` 判断， 是整个系统里 **唯一** 一处会拒绝分配的地方。 这也是为什么 ` STACK_GUARD ` 必须 *手工* 填一个数： 链接器给不了你"栈当前用到哪儿了"，它只能给你一个 ` _estack `。

 

顺带回答上一节留下的问题—— **为什么很多项目的堆会"莫名其妙"写坏栈** ： 因为 ` _estack ` 在 64K RAM 的 *顶端* ，而 ` end ` 在 ` .bss ` 后面——中间那一大段既没有段、也没有符号、 链接器连"这里有空档"都不会告诉你。 **谁先越界谁赢，而症状出现在输的那一方。**

 

**FIG 4.9**  同一块 RAM，两种 ` PROVIDE ` 位置：` end ` 落在预留段的哪一边

 

```zhizhan-figure
<svg viewBox="0 0 660 404" width="660" height="404" role="img" aria-label="heap_A.ld 与 heap_C.ld 的 end 位置对比">
          <defs>
            <marker id="ah31" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--grn)"></path>
            </marker>
            <marker id="ah32" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--cyn)"></path>
            </marker>
            <marker id="ah33" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--red)"></path>
            </marker>
          </defs>

          <text x="30" y="24" class="sv-lbl-hi">heap_A.ld（CubeMX 原版）：end 在预留<tspan font-style="italic">开头</tspan></text>
          <text x="356" y="24" class="sv-lbl-hi">heap_C.ld（PROVIDE 挪到后面）：end 在预留<tspan font-style="italic">末尾</tspan></text>

          <rect x="30" y="38" width="288" height="34" rx="4" class="sv-box"></rect>
          <text x="40" y="59" class="sv-t">.bss 结束 _ebss = 0x2000080C</text>

          <rect x="30" y="78" width="288" height="26" rx="4" class="sv-grn-s"></rect>
          <text x="40" y="96" class="sv-lbl-hi" style="fill:var(--grn)">end = 0x20000810 ← 堆起点</text>

          <rect x="30" y="110" width="288" height="26" rx="4" class="sv-dash"></rect>
          <text x="40" y="128" class="sv-t">*fill* 0x200  ← _Min_Heap_Size</text>

          <rect x="30" y="142" width="288" height="26" rx="4" class="sv-dash"></rect>
          <text x="40" y="160" class="sv-t">*fill* 0x400  ← _Min_Stack_Size</text>

          <rect x="30" y="174" width="288" height="26" rx="4" class="sv-box"></rect>
          <text x="40" y="192" class="sv-t">未占用 RAM（无段、无符号）</text>

          <rect x="30" y="206" width="288" height="26" rx="4" class="sv-cyn-s"></rect>
          <text x="40" y="224" class="sv-lbl-hi" style="fill:var(--cyn)">_estack = 0x20010000 ← 栈顶（向下长）</text>

          <rect x="356" y="38" width="274" height="34" rx="4" class="sv-box"></rect>
          <text x="366" y="59" class="sv-t">.bss 结束 _ebss = 0x2000080C</text>

          <rect x="356" y="78" width="274" height="26" rx="4" class="sv-dash"></rect>
          <text x="366" y="96" class="sv-t">*fill* 0x200  ← _Min_Heap_Size</text>

          <rect x="356" y="110" width="274" height="26" rx="4" class="sv-dash"></rect>
          <text x="366" y="128" class="sv-t">*fill* 0x400  ← _Min_Stack_Size</text>

          <rect x="356" y="142" width="274" height="26" rx="4" class="sv-red-s"></rect>
          <text x="366" y="160" class="sv-lbl-hi" style="fill:var(--red)">end = 0x20000E10 ← 堆起点（上移 0x600）</text>

          <rect x="356" y="174" width="274" height="26" rx="4" class="sv-box"></rect>
          <text x="366" y="192" class="sv-t">未占用 RAM（无段、无符号）</text>

          <rect x="356" y="206" width="274" height="26" rx="4" class="sv-cyn-s"></rect>
          <text x="366" y="224" class="sv-lbl-hi" style="fill:var(--cyn)">_estack = 0x20010000 ← 栈顶（向下长）</text>

          <path d="M 70 262 L 70 300" stroke="var(--grn)" stroke-width="1.6" fill="none" marker-end="url(#ah31)"></path>
          <text x="78" y="280" class="sv-t">堆向上长：0x810 → limit 有 0xF3F0</text>
          <path d="M 274 300 L 274 262" stroke="var(--cyn)" stroke-width="1.6" fill="none" marker-end="url(#ah32)"></path>
          <text x="140" y="296" class="sv-t">栈向下长</text>

          <path d="M 396 262 L 396 300" stroke="var(--red)" stroke-width="1.6" fill="none" marker-end="url(#ah33)"></path>
          <text x="404" y="280" class="sv-t">堆向上长：0xE10 → limit 只剩 0xEDF0</text>

          <text x="30" y="336" class="sv-lbl-dim">两边的 _Min_Heap_Size / _Min_Stack_Size 完全一样（0x200 / 0x400），预留段总长都是 0x600。</text>
          <text x="30" y="356" class="sv-lbl-dim">差别只在一件事：这 0x600 落在 end 的哪一边。落在下边 = 堆的可分配量白丢 0x600。</text>
          <text x="30" y="376" class="sv-lbl-dim">地址与 *fill* 大小均为实测（ld -Map）；0xF3F0 / 0xEDF0 是按 sbrk.c 的 guard=0x400 算的，图不按比例。</text>
        </svg>
```

 

**图注：** 左右两列的 *内容物* 完全相同，只有 ` PROVIDE ` 两行的位置不同。 ` 0x600 ` 这个数字、` end ` 的两个取值 （` 0x20000810 ` / ` 0x20000E10 `） 都来自本节实测的 ` nm ` 与 ` map `。  **` 0xF3F0 ` / ` 0xEDF0 ` 是算出来的，不是测出来的** —— 它们依赖两个前提：` _estack ` 取 ` ORIGIN(RAM)+LENGTH(RAM) `， 以及 ` sbrk.c ` 里 ` STACK_GUARD `=0x400。换掉任一个这两个数就变。 图里也没有画出 ` .data ` 与向量表：它们从 ` 0x20000000 ` 起， 而本节这两份脚本编出来的 ` .data ` 长度为 0，画上去反而容易误导。

 

✓ 这一节要能不看笔记答出来的四件事

 

 
1. ` end `  **不会** 被 ld 自动定义。脚本里不写 ` PROVIDE `，链接就停在 `` undefined reference to `end' ``，而编译器全程无警告。
 
2. ` PROVIDE `  **惰性** ：同一份脚本，没人引用时 ` nm ` 里查不到 ` end `；map 里会打上 ` [!provide] `。
 
3. ` _Min_Heap_Size ` 是 **链接期断言** ，不是运行期预留。 改它只让 ` ._user_heap_stack ` 变长（0x600 → 0x2400）， ` end ` 一动不动；RAM 放不下时它才会以 ` overflowed by N bytes ` 的形式出现。
 
4. 堆的 **上界只能自己写** 。链接器给不了，` _Min_Heap_Size ` 也给不了； ` _sbrk ` 里那个 ` limit ` 判断是全系统唯一会拒绝分配的地方。 比较时先把符号转 ` uintptr_t `，否则 ` -O2 ` 会给你一个 ` -Warray-bounds `——而它 *不会* 让构建失败。

 

```zhizhan-anchor
ch4-5-2
```



### 4.5.2 那该用什么：固定块内存池与 arena 模式

 标准库的 ` malloc ` 是为通用计算设计的，它的假设（大量内存、长时间运行、有人管碎片）在 MCU 上 **全都不成立** 。 



 

| 问题 | 在 MCU 上的具体表现 | 替代方案 |
| --- | --- | --- |
| **内存碎片** | 反复分配/释放不同大小 → 堆被撕成碎片。总空闲内存够，但没有连续块，分配失败。 | 固定大小内存池；或用「分配后不释放」的 arena 模式 |
| **非确定性** | 分配耗时取决于堆的碎片状态， *可能是 1 μs，也可能是 100 μs* 。破坏实时性。 | 预分配池，O(1) 分配时间 |
| **失败处理** | 返回 NULL。很多代码忘记检查 → 空指针解引用 → HardFault。 | 静态分配，编译期就确定；或统一封装带检查的分配器 |
| **元数据开销** | 每个块有 8-16 字节头（大小、链表指针）。分配 16 字节实际消耗 32 字节。 **开销 100%** 。 | 内存池用位图或固定槽位，开销接近 0 |
| **线程安全** | RTOS 下多任务同时分配需要加锁，进一步增加不确定性。 | 每任务独立池，或只在初始化阶段分配 |

 

mempool.c — 固定块内存池（O(1) 分配，零碎片） C

 

```text
#include <stdint.h>
#include <stddef.h>
#include <string.h>

/* ============ 固定块内存池 ============ */
#define POOL_BLOCK_SIZE   64           /* 每块 64 字节 */
#define POOL_BLOCK_COUNT  32           /* 共 32 块 = 2 KB */

typedef struct {
    uint8_t  blocks[POOL_BLOCK_COUNT][POOL_BLOCK_SIZE];  /* 全部静态分配 */
    uint32_t free_bitmap;              /* 位图：1 = 空闲。32 块正好用一个 uint32_t */
    uint32_t alloc_count;              /* 统计：已分配数 */
    uint32_t fail_count;               /* 统计：分配失败次数（诊断用） */
} mempool_t;

static mempool_t g_pool;

/* ---------- 临界区：位图的"读-改-写"必须原子完成 ---------- */
/* 中断若恰好插在"读 bm"与"清 bm 位"之间，同一个块会被判定两次空闲，
   于是同一个块被分配给两个调用者。这类 bug 只在中断精确命中时出现，
   复现概率极低，靠测试几乎抓不到，只能在设计上杜绝。
   裸机用 PRIMASK；接了 FreeRTOS 就换成 taskENTER_CRITICAL() / taskEXIT_CRITICAL()。 */
static inline uint32_t crit_enter(void)
{
    uint32_t primask;
    __asm__ volatile ("mrs %0, primask\n\tcpsid i" : "=r" (primask) :: "memory");
    return primask;
}

static inline void crit_exit(uint32_t primask)
{
    /* 恢复而非无条件开中断——这样嵌套调用也不会把外层的屏蔽提前放掉 */
    __asm__ volatile ("msr primask, %0" :: "r" (primask) : "memory");
}

void pool_init(void)
{
    memset(&g_pool, 0, sizeof g_pool);
    /* 全部标记为空闲。注意：位 0 对应块 0 */
    g_pool.free_bitmap = (POOL_BLOCK_COUNT >= 32)
                       ? 0xFFFFFFFFu
                       : ((1u << POOL_BLOCK_COUNT) - 1u);
}

/* O(1) 分配：用 __builtin_ctz 找最低位的空闲块 */
void *pool_alloc(void)
{
    uint32_t pm = crit_enter();        /* ---- 进入临界区 ---- */
    uint32_t bm = g_pool.free_bitmap;
    if (bm == 0) {
        crit_exit(pm);
        g_pool.fail_count++;
        return NULL;                   /* 池耗尽 —— 可预期的、可处理的失败 */
    }
    /* __builtin_ctz 数尾部零的个数，正好是最低位 1 的下标。
       它不是"一条指令"：ARMv7-M（M3/M4/M7）上是 rbit + clz 两条
       （clz 数的是前导零，必须先翻转位序）；ARMv6-M（M0/M0+）两者都没有，
       GCC 退化为调用 libgcc 的 __ctzsi2。仍然是 O(1)，只是常数不同。 */
    int idx = __builtin_ctz(bm);
    g_pool.free_bitmap &= ~(1u << idx);
    g_pool.alloc_count++;
    crit_exit(pm);                     /* ---- 退出临界区 ---- */

    /* 清零放在临界区外：这一块此刻已归本调用者独占，
       没必要为了 64 字节的 memset 一直关着中断。 */
    void *p = g_pool.blocks[idx];
    memset(p, 0, POOL_BLOCK_SIZE);
    return p;
}

/* O(1) 释放：从指针反推索引，无需任何元数据 */
void pool_free(void *p)
{
    if (!p) return;

    /* 用指针算术反推块索引，这是"静态池"的核心技巧 */
    uintptr_t base = (uintptr_t)g_pool.blocks;
    uintptr_t addr = (uintptr_t)p;
    if (addr < base || addr >= base + sizeof g_pool.blocks) {
        return;                        /* ✔ 非法指针，静默拒绝（或断言） */
    }
    size_t offset = addr - base;
    if (offset % POOL_BLOCK_SIZE != 0) {
        return;                        /* ✔ 不是块首地址，拒绝 */
    }
    uint32_t idx = (uint32_t)(offset / POOL_BLOCK_SIZE);

    uint32_t pm = crit_enter();
    if (g_pool.free_bitmap & (1u << idx)) {
        /* ✔ 双重释放防护：这一位本来就是"空闲"，说明它已经被 free 过一次。
           若不拦下，下面两行会再归还一次 —— alloc_count 下溢成一个巨大的
           正数，而且这一块会同时落到两个调用者手里，互相覆写。 */
        crit_exit(pm);
        return;
    }
    g_pool.free_bitmap |= (1u << idx);
    g_pool.alloc_count--;
    crit_exit(pm);
}

/* ============ 使用示例 ============ */
typedef struct {
    uint8_t  data[60];
    uint16_t len;
} msg_t;

void handle_message(void)
{
    msg_t *m = (msg_t *)pool_alloc();      /* 类型安全：块大小需 ≥ sizeof(msg_t) */
    if (!m) {
        /* ✔ 失败是可预期的、确定的 —— 可以做优雅降级 */
        log_warn("pool exhausted");
        return;
    }

    /* 使用 m ... */

    pool_free(m);                          /* 归还 */
}

/* ---------- 编译期保证块大小够用 ---------- */
_Static_assert(POOL_BLOCK_SIZE >= sizeof(msg_t), "块太小，装不下 msg_t");
```

 

✔ 嵌入式内存分配的决策顺序

 

 
1. **优先静态分配** ：编译期确定的数组/结构体。零运行时开销，零失败可能。
 
2. **需要动态性时用固定池** ：O(1)、零碎片、失败可预期。 *绝大多数嵌入式场景用这个就够了。*
 
3. **确实需要变长分配时** ：用 arena / 线性分配器（只分配不释放，整块重置）。适合"一帧处理完就整体释放"的场景，比如图像处理、协议栈收包。
 
4. **最后才考虑 malloc** ：并且要封装它，加失败检查、加统计、加最大用量监控。

 

◆ 本章要点

 

 
- 五个段：` .isr_vector `（向量表）、` .text `（代码）、` .rodata `（只读）、` .data `（有初值）、` .bss `（零初始化）；再加 ` heap / stack ` 两块靠符号划界的空间。 **拿不准某个变量在哪，就用 ` nm ` 看它的地址段** 。
 
- ` .data `  **同时占 Flash 和 RAM** ；` .bss `  **只占 RAM 不占 Flash** 。 *大数组尽量全零初始化以省 Flash。*
 
- 启动流程六步：复位 → 设 SP/PC → 拷贝 ` .data ` → 清零 ` .bss ` → 系统初始化 → 跳 ` main `。 **全部发生在 main 之前。**
 
- 栈 **向下生长** ，栈溢出会静默覆盖全局变量。大缓冲区、深递归、` printf ` 是三大杀手。
 
- 链接脚本的核心概念是  **LMA/VMA** ：` >RAM AT> FLASH ` 就是"运行在 RAM，初值存 Flash"。
 
- 用 ` ASSERT ` 在链接期检查 Flash/RAM 溢出，比运行期崩溃好一万倍。
 
- 嵌入式里 **优先静态分配，其次固定块内存池** ，` malloc ` 是最后选项。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 简答：` .data ` 与 ` .bss ` 的区别是什么？启动代码各要对它们做什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` .data ` 是 **有初值** 的已初始化变量：初值存在 Flash，启动时 **从 Flash 拷贝到 RAM** ；` .bss ` 是 **零初始化** 变量：不占文件体积，启动时在 RAM 里 **清零** 。"}
   ```
 
2. 填空：` _sidata ` 是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` LOADADDR(.data) `——` .data ` 初值在  **Flash**  中的起始地址。启动拷贝循环从 ` _sidata ` 搬到 ` _sdata `~` _edata `。"}
   ```
 
3. 简答：链接脚本里的 ` >RAM AT>FLASH ` 是什么意思？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"把该段的  **运行地址（VMA）** 放在 RAM、 **装载地址（LMA）** 放在 Flash。于是镜像里既有 Flash 上的副本，变量运行期又住在 RAM——中间必须靠启动代码（或手动拷贝循环）把内容搬过去。"}
   ```
 
4. 判断：栈溢出发生后，为什么往往表现为"某个不相关的全局变量莫名变了值"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"栈从 RAM 高端向下生长，溢出时会 **静默覆盖低地址的 ` .bss `/` .data `** ，破坏相邻的全局变量——而不会立刻触发异常。所以它极难定位。工业级做法：栈填充测峰值、MPU 哨兵、或 RTOS 的 ` configCHECK_FOR_STACK_OVERFLOW `。"}
   ```
 
5. 简答：` .RamFunc ` 这种"把函数放进 RAM 跑"的段，典型用在什么场景？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**Flash 擦写期间** ：擦/写 Flash 时无法从 Flash 取指，若此时来了中断，中断处理函数必须在 RAM 里才能执行。此外 Bootloader 里擦写应用区、或需要极低延迟的代码也会这么放。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  用 ` arm-none-eabi-size ` 看看自己项目的段分布。

 

```zhizhan-assessment
{"id":"course-b01-ch4","criterion":"从 linker script/map 列出 Flash/RAM 占用，测量栈高水位但不把它当最大栈证明。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[GNU ld · SECTIONS、MEMORY、符号与链接](https://sourceware.org/binutils/docs/ld/) · [ST 官方启动文件 · 向量与复位](https://github.com/STMicroelectronics/cmsis-device-f1/blob/master/Source/Templates/gcc/startup_stm32f103xb.s)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
