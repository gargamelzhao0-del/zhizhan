# 存储类与链接属性

```zhizhan-anchor
ch2
```



` static `、` extern `、` volatile `、` const `—— 这四个关键字是嵌入式 C 里被误用最多的。这一章要把它们从"语法记号"变成"你与编译器的契约"。

 

> ◷ 约 60 分钟 · ◈ 含 volatile 与临界区 · ⚑ 编译模型

 

```zhizhan-anchor
ch2-1
```



## 2.1 先搞清：编译单元与链接

 

理解这些关键字的前提，是理解  **C 的编译是"逐个文件独立进行"的** 。 编译器一次只看一个 ` .c ` 文件（准确说是预处理后的结果），它对其他文件一无所知。

 

**FIG 2.1**  多文件工程：编译器各管各的，链接器负责"牵线"

 

```zhizhan-figure
<svg viewBox="0 0 660 268" width="660" height="268" role="img" aria-label="编译单元与链接过程">
          <defs>
            <marker id="ah3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <!-- 编译单元 1 -->
          <rect x="16" y="20" width="180" height="86" rx="7" class="sv-box"></rect>
          <text x="30" y="42" class="sv-lbl-hi">uart.c</text>
          <text x="30" y="62" class="sv-lbl-dim">int  g_baud = 115200;</text>
          <text x="30" y="78" class="sv-lbl-dim">static int s_state;</text>
          <text x="30" y="94" class="sv-lbl-dim">void uart_init(void){};</text>

          <!-- 编译单元 2 -->
          <rect x="16" y="126" width="180" height="86" rx="7" class="sv-box"></rect>
          <text x="30" y="148" class="sv-lbl-hi">main.c</text>
          <text x="30" y="168" class="sv-lbl-dim" style="fill:var(--red)">extern int g_baud;   ✓ 能连上</text>
          <text x="30" y="184" class="sv-lbl-dim" style="fill:var(--red)">extern int s_state;  ✕ 连不上</text>
          <text x="30" y="200" class="sv-lbl-dim">int main(void){...}</text>

          <!-- 箭头 -->
          <path d="M 200 63 L 250 63" class="sv-arrow"></path>
          <path d="M 200 169 L 250 169" class="sv-arrow"></path>

          <!-- 目标文件 -->
          <rect x="256" y="34" width="132" height="58" rx="7" class="sv-grn-s"></rect>
          <text x="322" y="56" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">uart.o</text>
          <text x="322" y="74" text-anchor="middle" class="sv-lbl-dim">符号表 + 机器码</text>
          <text x="322" y="87" text-anchor="middle" class="sv-lbl-dim">未解析地址用 0 占位</text>

          <rect x="256" y="140" width="132" height="58" rx="7" class="sv-grn-s"></rect>
          <text x="322" y="162" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">main.o</text>
          <text x="322" y="180" text-anchor="middle" class="sv-lbl-dim">符号表 + 机器码</text>
          <text x="322" y="193" text-anchor="middle" class="sv-lbl-dim">g_baud 标记为 UND</text>

          <!-- 链接器 -->
          <path d="M 392 63 L 436 100" class="sv-arrow"></path>
          <path d="M 392 169 L 436 132" class="sv-arrow"></path>
          <rect x="442" y="86" width="98" height="58" rx="7" class="sv-cyn-s"></rect>
          <text x="491" y="108" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--cyn)">ld 链接器</text>
          <text x="491" y="126" text-anchor="middle" class="sv-lbl-dim">符号解析</text>
          <text x="491" y="139" text-anchor="middle" class="sv-lbl-dim">地址重定位</text>

          <path d="M 544 115 L 580 115" class="sv-arrow"></path>
          <rect x="586" y="86" width="62" height="58" rx="7" class="sv-grn-s"></rect>
          <text x="617" y="110" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">.elf</text>
          <text x="617" y="128" text-anchor="middle" class="sv-lbl-dim">绝对地址</text>

          <!-- 底部说明 -->
          <path d="M 16 226 L 648 226" class="sv-dash"></path>
          <text x="16" y="250" class="sv-t" style="fill:var(--grn)">链接属性（linkage）决定一个名字能否被"别的编译单元看到"</text>
          <text x="16" y="266" class="sv-lbl-dim">external linkage = 全局可见（默认）· internal linkage = 仅本文件可见（static）· no linkage = 局部变量</text>
        </svg>
```

 

关键点： **编译器不检查 ` extern ` 声明是否真的存在** ——它只是留个"待解析符号"。 如果链接时找不到，错误才爆发。这也解释了为什么"编译通过但链接失败"是常见现象。

 

⚠ 编译器看不到别的文件，会做出危险假设

 

因为编译器不知道 ` g_baud ` 会不会被别的文件修改，所以在 **没有看到定义** 时，它会保守处理。 但一旦某个文件里既有定义、又有调用，它就会激进优化：

 

opt\_trap.c C

 

```text
int g_flag = 0;                 /* 本文件定义 */

void poll(void)
{
    g_flag = 0;
    /* 编译器想：这个文件里没人改 g_flag，g_flag 又不是 volatile，
       于是在 -O2 下它可能把下面的读取直接优化成 while(0) → 死循环消失 */
    while (g_flag == 0) {
        /* 等待中断服务程序把它改成 1 */
    }
}
```

 

**这正是 ` volatile ` 要解决的问题** 。2.4 节会详细拆解。

 

```zhizhan-anchor
ch2-2
```



## 2.2 static 的三重身份

 

` static ` 是 C 里语义最分裂的关键字——它有三种完全不同的含义，取决于用在哪里。 很多人只知道"静态变量"，这是不够的。

 

```zhizhan-table
{"rows":[[{"body":"使用位置","header":true,"rowSpan":1,"colSpan":1},{"body":"改变的是","header":true,"rowSpan":1,"colSpan":1},{"body":"实际效果","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**函数内部**   \n` static int x; `","header":false,"rowSpan":1,"colSpan":1},{"body":"存储期  \n(storage duration)","header":false,"rowSpan":1,"colSpan":1},{"body":"从\"自动存储期\"变为\" **静态存储期** \"。变量不再存在栈上，而是落在 ` .data `/` .bss `， **在程序运行期内只初始化一次，值跨调用保持** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**文件作用域的变量**   \n` static int x; `","header":false,"rowSpan":1,"colSpan":1},{"body":"链接属性  \n(linkage)","header":false,"rowSpan":1,"colSpan":1},{"body":"从\"外部链接\"变为\" **内部链接** \"。其他 ` .c ` 文件 **无法用 ` extern ` 引用它** ，链接器也看不到这个符号。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**函数定义**   \n` static void f(void) `","header":false,"rowSpan":1,"colSpan":1},{"body":"链接属性  \n(linkage)","header":false,"rowSpan":1,"colSpan":1},{"body":"同上：函数 **仅供本文件使用** 。配合 ` -ffunction-sections --gc-sections `，未被调用的静态函数会被链接器直接丢弃，省 Flash。","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

static\_three.c C

 

```text
/* 本文件不需要任何头文件：只用到了 C 的内置类型。
   read_id_from_flash() 的原型在下面给出 —— 让这个文件能独立编译。 */

/* ① 文件作用域 static：内部链接，别的文件看不见 */
static int s_module_state = 0;

/* ② 函数作用域 static：跨调用保持 */
int counter_next(void)
{
    static int count = 0;       /* 只初始化一次，值持久保存 */
    return ++count;
}

/* ③ static 函数：内部链接 */
static int helper(int x) { return x * 2; }
/* ⚠ helper() 定义了却没有任何人调用。这不是笔误，是故意留给你看的：
   加 -Wall 编译会收到
       warning: 'helper' defined but not used [-Wunused-function]
   这条警告非常有用 —— 它要么说明这段代码该删，要么说明你本意要调用它却漏了。
   配合 -ffunction-sections --gc-sections，未被调用的静态函数会被链接器
   直接丢弃，所以它不占 Flash；它占的是你的注意力。 */

/* ---- 常见误区：static 局部变量的初始化时机 ---- */

/* ✕ 危险写法：以为每次调用都会重新初始化 */
float bad_average(int new_sample)
{
    static float sum = 0.0f;    /* 只在程序启动时初始化一次！ */
    static int   n   = 0;
    sum += new_sample;
    n++;
    return sum / n;             /* 实际上是从开机到现在的全局平均 */
}

/* ✔ 如果需要"每次调用重置"，就不要用 static */
float good_average(const int *samples, int n)
{
    float sum = 0.0f;
    for (int i = 0; i < n; i++) sum += samples[i];
    return sum / n;
}

/* ---- 嵌入式特有场景：static 局部变量做"惰性初始化" ---- */

/* 这个函数实际定义在 flash_drv.c 里，这里给出原型，
   让本文件可以脱离那个文件单独编译（否则就是隐式声明，C99 起直接报错）。
   它的代价是：读一次 Flash 通常几十微秒，绝不能放在中断或控制回路里反复调。 */
extern int read_id_from_flash(void);

int get_device_id(void)
{
    static int cached_id = -1;          /* -1 表示"尚未读取" */
    if (cached_id < 0) {
        cached_id = read_id_from_flash();  /* 只读一次，之后走缓存 */
    }
    return cached_id;
}

/* ⚠ static 局部变量的"惰性初始化"不是线程/中断安全的：
   如果 get_device_id() 可能在中断里被调用，主循环与中断同时进入这个 if，
   就会读两次 Flash。要么在初始化阶段先调一次把它"焐热"，
   要么用原子标志位做互斥（见 Module 06 的读-改-写竞态）。 */
```

 

✕ static 局部变量的三个陷阱

 

 
1. **重入性问题** ：static 局部变量本质是全局变量。如果函数会被 *中断服务程序和主循环同时调用* ，两个上下文共享同一份数据 → 数据竞争。
 
2. **线程安全问题** ：这在后面学 RTOS 时会变成真问题。多个任务调用同一个含 static 局部变量的函数，行为不可预期。
 
3. **初始化不是"零成本"** ：带初值的 static 变量（如 ` static int count = 5; `）需要启动代码在 ` main ` 之前从 Flash 拷贝到 RAM。无初值的则在 ` .bss ` 里被清零（模块 04 详解）。

 

✔ 一条实用纪律

 

**凡是只在本文件使用的函数和全局变量，一律加 ` static `。**  好处有三：① 防止命名污染和意外符号冲突；② 向读代码的人明确表达"这是模块内部实现"； ③ 让链接器能安全地做死代码消除，减小固件体积。

 

```zhizhan-anchor
ch2-3
```



## 2.3 extern：声明与定义的区别

 

` extern ` 的含义是" **这个东西在别处定义，这里只是声明** "。 理解它的关键在于区分  *声明（declaration）*  和  *定义（definition）* 。

 

|  | 声明 Declaration | 定义 Definition |
| --- | --- | --- |
| **作用** | 告诉编译器"有这个名字，类型是这样" | 真正 **分配存储空间** 或 **生成代码** |
| **可以出现次数** | 多次（每个用到它的文件都要有） | 有且仅有一次（ODR 规则） |
| **变量示例** | ` extern int g_x; ` | ` int g_x = 10; ` 或 ` int g_x; `（文件作用域） |
| **函数示例** | ` void f(void); ` | ` void f(void) { ... } ` |
| **产生符号** | 不产生，只引用 | 产生一个已定义符号 |

 

⚠ 最隐蔽的坑：` int x; ` 才是"暂定定义"，` extern int x; ` 永远只是声明

 

在 C 里，文件作用域的 ` int x; `  **不是声明，是"暂定定义"（tentative definition）** ——暂定定义本身就是一种定义，会真的分配空间（放在 ` .bss `）。  
 但加了 ` extern ` 就完全不同： **C11 6.9.2p2 明确把"带 ` extern ` 且无初始化器"的声明排除在暂定定义之外** ——它永远只是声明，一个字节都不分配。这两者的分野，正是本节最容易被讲错的地方。 所以下面这种写法看似只是"声明一下"，实际会产生一个 4 字节的全局变量：

 

extern\_pitfall — 三个文件并列对照（非单个可编译文件） C

 

```text
/* ============================================================
   ⚠ 说明：下面用注释分隔出 uart.h / uart.c / main.c 三个文件。
     它们是【三个独立的文件】，不是这一个文件里的三段代码。
     之所以并排放在一起，是为了让你一眼看到"声明"与"定义"
     分别该待在哪里 —— 真正的工程请拆成三个文件。
   ============================================================ */

/* ---------- 文件 ①：uart.h ---------- */
extern int g_baud;          /* ✔ 正确：只是声明，不分配空间 */

/* ✕ 如果写成下面这样，每个包含该头文件的 .c 都会生成一个 g_baud！
   在 C 里这叫 tentative definition，多个 .o 链接时会报 multiple definition
   （GCC 10+ 默认 -fno-common，旧版 GCC 会静默合并，更危险） */
// int g_baud;              ← 绝对不要放在头文件里

/* ---------- 文件 ②：uart.c ---------- */
int g_baud = 115200;        /* ✔ 在这里定义，全局唯一 */

/* ---------- ✕ 反面教材：声明类型不匹配 ----------
   这两个文件各自单独编译都能过，编译器无法跨文件检查类型，
   错误只在运行期暴露。 */
/* 文件 ③：main.c  */   extern float g_baud;              /* 声明成 float */
/* 文件 ②：uart.c  */   int          g_baud = 115200;     /* 实际是 int */

/* 链接器只看符号名，不管类型 → 链接成功！
   但读取 g_baud 时按 float 解释这片内存 → 得到 1.6e-40 一类的垃圾值
   （int 的 115200 = 0x0001C200，按 IEEE 754 单精度解读是个非规格化数 ≈ 1.61e-40）
   这类 bug 极难排查。有效的防御只有一条：用同一份头文件声明，不要手写重复的 extern。
   如果确实想让工具跨编译单元检查类型，开 LTO：
       -flto -Wlto-type-mismatch
   注意 -Wl,--fatal-warnings 在这里帮不上忙——它只是把"已有的告警"升级为错误，
   而链接器根本看不见类型信息，对这类不匹配压根不会产生告警。 */
```

 

◆ 头文件组织的黄金法则

 

 
1. **变量** ：头文件里只放 ` extern ` 声明，定义放 ` .c ` 文件。
 
2. **函数** ：头文件放原型，实现放 ` .c `。
 
3. **类型/宏/枚举** ：放头文件（这些不产生存储，重复包含无害，但仍要加 include guard）。
 
4. **常量** ：优先用 ` enum ` 或 ` #define `，而不是 ` const int `——在 C 里 ` const int `  **不是编译期常量表达式** ，不能拿来当数组长度、` case ` 标签或位域宽度，而且会实实在在占一份存储（详见 2.5 节）。
 
5. 头文件必须加  **include guard** （` #ifndef ` 或 ` #pragma once `），否则循环包含会炸。

 

```zhizhan-anchor
ch2-4
```



## 2.4 volatile：与编译器的契约

 

这是嵌入式 C 最核心、也最容易被"背下来但不理解"的关键字。我们从头拆解。

 

```zhizhan-anchor
ch2-4-1
```



### 2.4.1 编译器眼中的程序 vs 硬件眼中的程序

 

编译器优化的合法性，建立在一个假设上： **程序是"封闭"的** ——除了代码里显式写出的操作，没有别的东西能改变内存。 这个假设叫  *as-if 规则* ：只要最终可观察行为一致，编译器可以随意重写代码。

 

**但嵌入式程序是"开放"的** ：中断可以随时改内存，[DMA](term:dma) 可以偷偷写 RAM，外设寄存器读一次就有副作用。 ` volatile ` 就是用来告诉编译器：" *这个对象的访问是有意义的，不许优化掉、不许合并、不许重排* "。

 

**FIG 2.2**  编译器可能对你做的四种"合法但致命"的优化

 

① 消除冗余读取

 

x = \*reg;



y = \*reg;

 

编译器认为两次读结果相同，合并成一次。 **但读 UART 数据寄存器会清标志位！**

 

→

 

② 消除"无用"写入

 

\*reg = 1;



\*reg = 2;

 

只保留最后一次写。 **但写 GPIO 是有物理后果的动作，必须两次都发生。**

 

→

 

③ 提升到循环外

 

while (\*flag == 0);

 

编译器把 ` *flag ` 提到寄存器里， **循环永不退出——因为寄存器里的值不会变。**

 

④ 重排顺序

 

buf\[i\] = data; /\* 准备数据 \*/

 

\*ctrl |= START; /\* 启动 DMA \*/

 

编译器把写 control 提到写 buf 之前（` buf ` 并非 volatile，两者"无关"）。 **DMA 已经启动，但 buf 里的数据还没写进去。**

 

→

 

✓ volatile 挡得住 ①②③，挡不住 ④

 

被 ` volatile ` 修饰的对象，其 **每一次读写都必须按代码顺序、原样发生** ——不得删除、合并、提升、重排。①②③ 由此解决。  
 但 ④ 里被挪动的是 ` buf `，它 **不是 volatile** 。volatile 只约束"volatile 访问之间"的相对次序，管不到普通访问与 volatile 访问之间的调换。要真正锁死顺序，必须再加屏障： 

\_\_asm\_\_ volatile("" ::: "memory"); /\* 编译屏障：禁止跨行重排 \*/

 

\_\_DSB(); /\* 硬件屏障：等写缓冲真正落总线 \*/

 

两者缺一不可——前者管编译器，后者管 CPU 写缓冲。DMA 是独立硬件，看不到 CPU 还没刷出去的数据。

 

注意：` volatile ` 保证的是 **编译器层面** 单个对象的访问语义。它 **不保证原子性、不产生内存屏障、不解决多核缓存一致性** ——把 ` volatile ` 当同步原语用，是嵌入式里最经典的一类误解。 这些概念的区别在 2.4 节末尾详述。

 

```zhizhan-anchor
ch2-4-2
```



### 2.4.2 实验：亲手看到优化导致的死循环

 

volatile\_demo.c — 对比有无 volatile 的反汇编 C

 

```text
#include <stdint.h>

/* 模拟一个由中断/DMA 修改的寄存器 */
static uint32_t g_plain_flag;              /* 无 volatile */
static volatile uint32_t g_volatile_flag;  /* 有 volatile */

/* ✕ 危险：编译器会把这个循环优化成死循环 */
void wait_bad(void)
{
    g_plain_flag = 0;
    while (g_plain_flag == 0) {
        /* 空转等待外部（中断）修改 g_plain_flag */
    }
}

/* ✔ 正确：每次都真实读取内存 */
void wait_good(void)
{
    g_volatile_flag = 0;
    while (g_volatile_flag == 0) {
        /* 空转等待外部修改 */
    }
}
```

 

用 ` -O2 ` 编译，看两者的反汇编差异：

 

**bash**  — arm-none-eabi-gcc -O2 -S

 

```text
$ arm-none-eabi-gcc -O2 -mcpu=cortex-m3 -S volatile_demo.c -o -

wait_bad:                          ; ✕ 无 volatile
        ldr     r3, .L2
        movs    r2, #0
        str     r2, [r3]              ; g_plain_flag = 0（写一次）
.L3:
        b       .L3                   ; ← 无限跳回自己！循环体被完全消除
                                      ; 编译器"证明"了 g_plain_flag 恒为 0

wait_good:                         ; ✔ 有 volatile
        ldr     r3, .L5
        movs    r2, #0
        str     r2, [r3]              ; g_volatile_flag = 0
.L6:
        ldr     r2, [r3]              ; ← 每次循环都真实从内存读取！
        cmp     r2, #0
        beq     .L6                   ; 读到 0 就继续循环
        bx      lr                    ; 读到非 0 才返回
```

 

✕ 这就是"程序跑飞"最经典的一种形态

 

` wait_bad ` 编译出的代码只有 3 条指令，其中一条是 **跳转到自己的死循环** 。 你在调试器里会看到程序"卡在某一行不动"，而且单步跟踪时行为正常（因为调试会改变优化）， 一旦全速运行就死住。 **这是最典型的 heisenbug（海森堡 bug）** 。

 

```zhizhan-anchor
ch2-4-3
```



### 2.4.3 哪些情况必须加 volatile

 

| 场景 | 为什么必须加 | 示例 |
| --- | --- | --- |
| **硬件寄存器** | 读写有物理副作用，且值可能被硬件改变 | ` *(volatile uint32_t *)0x40021018 ` |
| **中断与主循环共享的变量** | 中断随时可能改变它，编译器不知道 | ` volatile uint8_t g_rx_ready; ` |
| **DMA 目标缓冲区** | DMA 控制器绕过 CPU 直接写内存 | ` volatile uint8_t dma_buf[256]; ` |
| **忙等待 / 延时循环** | 防止空循环被整个删除 | ` for (volatile int i = 0; i < N; i++); ` |
| **内存映射的只读寄存器** | 即使只读，多次读也可能返回不同值 | ` volatile const uint32_t *status ` |

 

```zhizhan-anchor
ch2-4-4
```



### 2.4.4 volatile 的五个"不"

 

✕ 对 volatile 的常见误解

 

 
1. **不保证原子性** 。` volatile uint32_t x; x++; ` 依然是读-改-写三步，中断插在中间会丢计数。 *需要 ` _Atomic ` 或临界区保护。*
 
2. **不保证跨 CPU 可见性** 。多核系统（如 ESP32 双核）需要内存屏障（` __sync_synchronize() ` / ` atomic_thread_fence() `）。
 
3. **不解决缓存一致性** 。带 D-Cache 的芯片（Cortex-M7、Cortex-A）需要显式 cache 维护操作。
 
4. **不能替代锁** 。多任务/多核场景，volatile 不是同步原语。
 
5. **不会让代码变慢很多** 。它只阻止 *跨访问的* 优化，函数内部的局部计算仍然照常优化。 *滥用它才影响性能* 。

 

◆ 一句话记住 volatile

 

` volatile ` 说的是： **"这个对象的每一次读写都必须在生成的机器码里真实发生，且顺序与源码一致。"**  它管的是 *编译器* ，不管  *CPU* ，也不管  *内存系统* 。

 

```zhizhan-anchor
ch2-5
```



## 2.5 const 在嵌入式里的真实成本

 

` const ` 的语义是"只读"。但在嵌入式里， **"只读"和"不占 RAM"是两件不同的事** ， 这个区别直接关系到你的 SRAM 够不够用。

 

const\_cost.c C

 

```text
#include <stdint.h>

/* ---------- 情况 A：const 变量 —— 默认落 Flash，不占 SRAM ---------- */
const uint8_t  lut_a[256] = { /* ... 256 个字节 ... */ };
/* 在 C 里这是"只读变量"，不是编译期常量。
   它被放进 .rodata 段 —— 而 ST 官方链接脚本把 .rodata* 归入 >FLASH：
       .text : { *(.text*) *(.rodata*) . = ALIGN(4); _etext = .; } > FLASH
   所以它常驻 Flash：既不吃 SRAM，启动时也没有拷贝动作。
   Cortex-M 通过 D-Code 总线直接寻址 Flash，不需要先搬进 RAM。 */

/* ---------- 情况 B：宏 —— 编译期常量，零数据存储 ---------- */
#define LUT_B_SIZE   256
/* 数值直接内联进指令（如 movs r0, #255），不占任何数据空间。 */

/* ---------- 情况 C：enum —— 同样是编译期常量 ---------- */
typedef enum {
    UART_BAUD_9600   = 9600,
    UART_BAUD_115200 = 115200,
} uart_baud_t;

/* ---------- 情况 D：什么情况下 const 才真的吃 SRAM ---------- */
/* 1) 链接脚本被改成把 .rodata 放进 RAM —— 有些工程为了取数更快这么改：
        .rodata : { *(.rodata*) } >RAM AT> FLASH    ← 这时才需要启动拷贝，
      而且会同时多消耗一份 Flash（LMA）+ 一份 SRAM（VMA）。
   2) DMA 的源缓冲：DMA 控制器走系统总线，部分系列的 DMA 根本读不到 Flash
      （F4/F7 的 DMA 也访问不到 CCM RAM）。这类表必须显式放进 SRAM ——
      不是为了"可写"，而是为了"可达"。
   3) 运行期要自我修改的表，本来就该是普通 RAM 变量。 */

/* ---------- 用属性把对象钉到指定段 ---------- */
/* 前提：section 名必须已经在链接脚本里被显式引用。否则它成为 orphan section，
   链接器按自己的规则安置（通常紧跟 .text），未必是你想的位置。 */
__attribute__((section(".ccmram"))) const uint16_t sin_table[1024] = { /* ... */ };

/* used 只保证"不会被优化删除"，与存储位置无关 ——
   它不能让对象落 Flash，也不能阻止拷贝。 */
const char firmware_version[] __attribute__((used)) = "v1.2.3";
```

 

⚠ 嵌入式 const 的三条实务

 

 
- **小常量用 ` #define ` 或 ` enum `** ，不要用 ` const int `。前者零开销。
 
- **大查找表（LUT）默认就在 Flash，但要确认链接脚本没把它挪进 RAM** 。用 ` objdump -h ` 看段地址（` 0x0800_xxxx ` 段是 Flash，` 0x2000_xxxx ` 段是 SRAM），或在 map 文件里搜符号地址。这在端侧 AI 里尤其要紧——量化模型权重就是一张巨大的 ` const ` 表，误落 SRAM 会瞬间吃光几十到几百 KB。
 
- **不要把 const 当作"不能被改"的安全保证** 。C 的 ` const ` 是编译期的，通过指针强转或直接地址访问都能绕过。 **真正的只读保护要靠 MPU 或写保护寄存器** 。

 

```zhizhan-anchor
ch2-5-1
```



### 2.5.1 const 与指针的四种组合

 

**FIG 2.3**  ` const ` 修饰的是"指针本身"还是"指针指向的东西"？

 

```zhizhan-table
{"rows":[[{"body":"写法","header":true,"rowSpan":1,"colSpan":1},{"body":"读作","header":true,"rowSpan":1,"colSpan":1},{"body":"能否改 \\*p","header":true,"rowSpan":1,"colSpan":1},{"body":"能否改 p","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` int *p; `","header":false,"rowSpan":1,"colSpan":1},{"body":"指向 int 的指针","header":false,"rowSpan":1,"colSpan":1},{"body":"✓ 能","header":false,"rowSpan":1,"colSpan":1},{"body":"✓ 能","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` const int *p; `  \n` int const *p; `","header":false,"rowSpan":1,"colSpan":1},{"body":"指向  **const int**  的指针","header":false,"rowSpan":1,"colSpan":1},{"body":"✕ 不能","header":false,"rowSpan":1,"colSpan":1},{"body":"✓ 能","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` int *const p; `","header":false,"rowSpan":1,"colSpan":1},{"body":"**const 指针** ，指向 int","header":false,"rowSpan":1,"colSpan":1},{"body":"✓ 能","header":false,"rowSpan":1,"colSpan":1},{"body":"✕ 不能","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` const int *const p; `","header":false,"rowSpan":1,"colSpan":1},{"body":"const 指针，指向 const int","header":false,"rowSpan":1,"colSpan":1},{"body":"✕ 不能","header":false,"rowSpan":1,"colSpan":1},{"body":"✕ 不能","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

**速记法** ：从右往左读。` const int *p ` → "p is a pointer to int that is const"； ` int *const p ` → "p is a const pointer to int"。 *const 紧挨着谁，就修饰谁。*

 

```zhizhan-anchor
ch2-5-2
```



### 2.5.2 volatile \+ const 的组合：只读硬件寄存器

 

volatile\_const.c C

 

```text
#include <stdint.h>

/* ✔ 只读的状态寄存器：程序不该写它，但硬件会改它的值 */
#define UART_SR   (*(volatile const uint32_t *)0x40013800UL)

/* 头文件里的标准写法 —— 偏移量与 ST 官方 CMSIS 头文件一致 */
typedef struct {
    volatile uint32_t SR;    /* 0x00 状态寄存器：可读；部分位写 1 清除 */
    volatile uint32_t DR;    /* 0x04 数据寄存器：读收数据，写发数据 */
    volatile uint32_t BRR;   /* 0x08 波特率寄存器：可读可写，读回可校验分频值 */
    volatile uint32_t CR1;   /* 0x0C 控制寄存器 1：UE/TE/RE 使能、各类中断使能 */
    volatile uint32_t CR2;   /* 0x10 控制寄存器 2：STOP 停止位长度 */
    volatile uint32_t CR3;   /* 0x14 控制寄存器 3：DMAT/DMAR 的 DMA 使能 */
    volatile uint32_t GTPR;  /* 0x18 保护时间与预分频（智能卡/IrDA 才用得上） */
} USART_TypeDef;

/* 注意：官方头文件里绝不会给"保留位"安排一个结构体成员。
   一旦写进去，它会实实在在占掉 4 个字节，把后面所有成员的偏移量全部顶错——
   访问 CR1 时实际上写到了 CR2 的地址上。保留区靠的是显式偏移或位域占位，
   不是靠一个名字叫 RESERVED 的字段。 */

/* 读状态：const 阻止你误写，volatile 保证每次都真实读 */
static inline int uart_rx_ready(void)
{
    return (UART_SR & (1u << 5)) != 0;
}

/* ✕ 错误演示：如果漏掉 volatile 会怎样 */
#define UART_SR_BAD   (*(const uint32_t *)0x40013800UL)
int wait_bad(void)
{
    /* 编译器可能认为 UART_SR_BAD 值不变，直接优化成 while(1) 或优化掉 */
    while ((UART_SR_BAD & (1u << 5)) == 0) { }
    return 0;
}
```

 

```zhizhan-anchor
ch2-6
```



## 2.6 工具实证：` nm ` 与 ` readelf ` 里的符号真相

 

前面五节讲的都是"编译器怎么做"。但从这一节开始，我们换一个视角： **链接器眼里根本不存在"变量"和"函数"，只有符号（symbol）和段（section）** 。` .c ` 文件被编译成 ` .o ` 之后，源码的语义已经被压扁成一张符号表——谁能被外部看见、谁住在哪个段、谁还没有地址，全在这张表里写死。

 

这张表是编译器和链接器之间的接口。你不需要背 GCC 的源码，只需要学会用两个命令把它 dump 出来：` nm ` 看符号，` readelf ` 看段和重定位。这一节所有结论都来自本机实测（Arm GNU Toolchain 13.3.1，` -mcpu=cortex-m3 -mthumb `）。

 

uart.c C

 

```text
#include <stdint.h>

int          g_baud  = 115200;   /* 已初始化全局：落 .data */
int          g_rxbuf[64];        /* 未初始化全局：落 .bss  */
const int    g_ver   = 3;        /* const 全局：落 .rodata */
static int   s_state;            /* 文件内静态：落 .bss，且是【局部符号】 */
static const char s_tag[] = "uart";

void uart_init(void) { s_state = 1; }        /* 全局函数：T */
static void uart_irq(void) { s_state++; }    /* static 函数：t（局部符号） */
```

 

文件里一共 5 个对象、2 个函数，` static ` 覆盖了其中 3 个。先看 ` -O0 `（不做优化）时的符号表：

 

**bash**  — 未优化的符号表：大小写就是可见性

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O0 -c uart.c -o uart.o
$ arm-none-eabi-nm --print-size uart.o
00000000 00000100 B g_rxbuf
00000000 00000004 D g_baud
00000000 00000004 R g_ver
00000000 00000004 b s_state
00000000 00000005 r s_tag
00000000 00000004 T uart_init
00000000 00000004 t uart_irq
```

 

注意 ` nm ` 输出里第一列的字母——它不是随便取的，每一个都对应符号表里的一个 ` type ` 加一个 ` bind ` 组合：

 

```zhizhan-table
{"rows":[[{"body":"字母","header":true,"rowSpan":1,"colSpan":1},{"body":"含义","header":true,"rowSpan":1,"colSpan":1},{"body":"在本例中对应","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` T ` / ` t `","header":false,"rowSpan":1,"colSpan":1},{"body":"代码段中的符号  \n大写 = 全局，小写 = 局部","header":false,"rowSpan":1,"colSpan":1},{"body":"` uart_init ` 是 ` T `，别的文件能调用；` uart_irq ` 是 ` t `， **链接器禁止其他目标文件引用它** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` D ` / ` d `","header":false,"rowSpan":1,"colSpan":1},{"body":"已初始化的数据  \n.data","header":false,"rowSpan":1,"colSpan":1},{"body":"` g_baud ` 初值 115200， **占 Flash** （启动时拷到 RAM）。 **大小写即有无 ` static `** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` B ` / ` b `","header":false,"rowSpan":1,"colSpan":1},{"body":"未初始化的数据  \n.bss","header":false,"rowSpan":1,"colSpan":1},{"body":"` g_rxbuf ` 和 ` s_state `。 **不占 Flash** ，启动时清零即可。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` R ` / ` r `","header":false,"rowSpan":1,"colSpan":1},{"body":"只读数据  \n.rodata","header":false,"rowSpan":1,"colSpan":1},{"body":"` g_ver `（` const ` 全局，外部链接）与 ` s_tag `（` static const `，内部链接）。这就是 §2.5 说的： **` const ` 落在 Flash 里** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` U `","header":false,"rowSpan":1,"colSpan":1},{"body":"未定义  \nundefined","header":false,"rowSpan":1,"colSpan":1},{"body":"本文件 **用到但没定义** 的符号。如果链接器翻遍所有输入都找不到定义，就是那个耳熟的错误。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` W ` / ` V `","header":false,"rowSpan":1,"colSpan":1},{"body":"弱符号  \nweak","header":false,"rowSpan":1,"colSpan":1},{"body":"` W ` 是弱函数，` V ` 是弱对象。见 §2.9。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` A `","header":false,"rowSpan":1,"colSpan":1},{"body":"绝对值  \nabsolute","header":false,"rowSpan":1,"colSpan":1},{"body":"链接脚本里用算式定义的地址，比如 ` _sidata = LOADADDR(.data) `。它 **不属于任何段** ，只是一个数。","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

再看同一个文件开 ` -O2 ` 的结果——这一条会让你重新思考"我应该给多少东西加 ` static `"：

 

**bash**  — 开优化后：没人用的静态符号直接蒸发

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -c uart.c -o uart_O2.o
$ arm-none-eabi-nm uart_O2.o
00000000 B g_rxbuf
00000000 D g_baud
00000000 R g_ver
00000000 T uart_init
                                    ← s_state / s_tag / uart_irq 全部消失
```

 

◆ static 在优化下是"可丢弃"的信号

 

` s_state `、` s_tag `、` uart_irq ` 之所以在 ` -O2 ` 下彻底消失，是因为  **` static ` 把它们的可见范围锁死在本文件内** ，编译器因此能证明"没有任何外部代码可能引用它们"。` uart_irq ` 无人调用 → 整个函数被删；` s_tag ` 无人读取 → 字符串常量被删。 **这不是 bug，是 ` static ` 换来的收益。**

 

反过来看：` g_baud `、` g_rxbuf `、` g_ver ` 是全局可见的，编译器 **不敢** 假设没人用，必须保留。判断标准很清晰—— **凡是只在 ` .c ` 内部使用的函数和变量，加上 ` static `，你就给了编译器和链接器"可以扔掉它"的授权** 。配合 ` -ffunction-sections -fdata-sections --gc-sections `，误加 ` static ` 的成本接近于零，漏加的成本是白占 Flash。

 

```zhizhan-anchor
ch2-6-1
```



### 2.6.1 链接错误的原文长什么样

 

§2.3 讲了"声明可以有多次、定义只能有一次"。当这条规则被违反时，链接器的报错是你能拿到的最直接的反馈。两种典型错误各来一次——先看"声明了但没人定义"：

 

main.c C

 

```text
#include <stdint.h>

/* ✕ 错在这里：s_state 在 uart.c 里是 static，链接器根本看不到这个符号。
   在 main.c 里写 extern 声明并不能"把它变出来"——
   链接器只知道"有个叫 s_state 的符号被引用了，但没人定义它"。 */
extern int s_state;

int main(void)
{
    s_state = 5;
    return 0;
}
```

 

**bash**  — undefined reference：引用了，但没人定义

 

```text
$ arm-none-eabi-ld -e 0 main.o uart.o -o app.elf
ld: main.o: in function `main':
main.c:(.text.startup+0x24): undefined reference to `s_state'
```

 

报错信息里三个部分都有用：` main.o ` 告诉你 **是谁在引用** ，` main.c:(.text.startup+0x24) ` 给出 **精确到指令的引用点** （` .text.startup ` 是 GCC 给 ` main ` 单独分的段），最后才是 **缺哪个符号** 。很多人看到这类错误的第一反应是去改引用的那一侧，但真正的修法通常是在定义侧——要么去掉 ` s_state ` 的 ` static `，要么提供一个访问它的函数。这正是 §2.2 那条纪律存在的理由。

 

第二种错误在 C 和 C\+\+ 之间、以及不同 GCC 版本之间最容易撞上——"同一个符号被定义了两次"：

 

**bash**  — a.c 和 b.c 都写了 ` int g_tick; `

 

```text
$ arm-none-eabi-ld -e 0 a.o b.o -o dup.elf
ld: b.o:(.bss+0x0): multiple definition of `g_tick';
a.o:(.bss+0x0): first defined here
```

 

⚠ ` -fno-common `：这条报错在新工具链上才出现

 

上面这条 ` multiple definition ` 是 **加了 ` -fno-common ` 才有** 的。老的 GCC（10 以前）默认 ` -fcommon `： **未初始化的全局变量会被放进一个叫 ` COMMON ` 的特殊段** ，链接器遇到多个同名定义时 **静默合并成一个** ，不报错。

 

听起来很宽容，代价却很大：` COMMON ` 合并意味着 **任何一个文件里的 ` int g_tick = 5; ` 都会让所有引用它的文件看到 5** ，而"谁写的初值生效"取决于链接顺序——一个典型的、只在改链接顺序时才爆发的 bug。GCC 10 起把默认值改成了 ` -fno-common `，就是为了让这种错误 **在链接期就暴露** 。

 

本站所有代码块的编译验证都带 ` -fno-common `，所以上面的报错你在本机同样能复现。 **正确做法是把定义放在一个 ` .c ` 里，其余文件用 ` extern ` 声明** ——这就是 ` -fno-common ` 想逼你做的事。

 

想去掉路径噪音、只看报错本身，把 ` ld ` 的输出过滤一遍就行：

 

**bash**  — 让报错可以直接贴进 bug 报告

 

```text
$ arm-none-eabi-ld -e 0 main.o uart.o -o app.elf 2>&1 | grep -E "undefined|multiple"
ld: main.o: in function `main':
main.c:(.text.startup+0x24): undefined reference to `s_state'
```

 

```zhizhan-anchor
ch2-6-2
```



### 2.6.2 ` readelf -s `：比 ` nm ` 更完整的符号表

 

` nm ` 是给人看的缩写视图。` readelf -s ` 才是符号表原貌——它会额外告诉你 **每个符号属于哪个段** （` Ndx `）、 **绑定类型** （` GLOBAL `/` LOCAL `/` WEAK `）和 **可见性** （` DEFAULT `/` HIDDEN `）：

 

**bash**  — ` main.o ` 的符号表原貌

 

```text
$ arm-none-eabi-readelf -s main.o
Symbol table '.symtab' contains 9 entries:
   Num:    Value  Size Type    Bind   Vis      Ndx Name
     0: 00000000     0 NOTYPE  LOCAL  DEFAULT  UND 
     1: 00000000     0 FILE    LOCAL  DEFAULT  ABS main.c
     2: 00000000     0 SECTION LOCAL  DEFAULT    1 
     4: 00000000     0 NOTYPE  GLOBAL DEFAULT  UND s_state
     6: 00000000     0 NOTYPE  GLOBAL DEFAULT  UND __aeabi_read_tp
     7: 00000000     0 FUNC    GLOBAL DEFAULT    1 main
```

 

读这张表要看三个关键位：` Bind ` 告诉你这个符号 **是否可被其他目标文件解析** （` LOCAL ` 的符号链接器不可见，` static ` 就是干这个的）；` Ndx ` 是"符号住在哪个段"，` UND `（undefined）表示 **还没找到定义** ——所有 ` UND ` 都要靠链接期填坑；` Size ` 是符号占的字节数，链接脚本里做内存核算时全靠它。

 

✔ 两个命令的分工

 

**查"这个符号在不在、是不是 static"**  → ` nm `，一个字母就够。  
  **查"它在哪个段、多大、绑定类型是什么"**  → ` readelf -s `。  
  **查"段本身怎么排布、占多少 Flash/RAM"**  → ` readelf -S `（段表）与 ` size -A `。

 

```zhizhan-anchor
ch2-6-3
```



### 2.6.3 启动拷贝的 5 个符号：链接器如何把 Flash 和 RAM 缝在一起

 

§2.5 说过 ` const ` 落 Flash、普通变量落 RAM。但"已初始化的全局变量"位置更微妙： **初值必须在 Flash 里（掉电不丢），而运行时的变量必须在 RAM 里（可写）** 。同一个对象有两个地址，这个矛盾由链接器的  **VMA / LMA 分离** 解决，中间那座桥就是启动代码里的拷贝循环。

 

要看清这件事，需要一份最小的链接脚本和配套的启动代码：

 

boot.ld ld

 

```text
/* 极简链接脚本：只为了看清启动拷贝用到的 5 个符号 */
ENTRY(Reset_Handler)

MEMORY
{
    FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 64K
    RAM  (rwx) : ORIGIN = 0x20000000, LENGTH = 20K
}

SECTIONS
{
    .text : {
        KEEP(*(.isr_vector))
        *(.text*)
        *(.rodata*)
    } > FLASH
    _etext = .;                  /* Flash 里"已初始化数据"的镜像起点 */

    .data : AT(_etext) {         /* ① 运行地址在 RAM，② 加载地址在 FLASH */
        _sdata = .;              /*    RAM 侧起点 */
        *(.data*)
        _edata = .;              /*    RAM 侧终点 */
    } > RAM
    _sidata = LOADADDR(.data);   /*    FLASH 侧镜像起点 —— 和 _etext 同值 */

    .bss (NOLOAD) : {
        _sbss = .;
        *(.bss*)
        *(COMMON)
        _ebss = .;
    } > RAM
}
```

 

startup.c C

 

```text
#include <stdint.h>

/* 这 5 个符号全部由链接脚本定义，C 代码里只声明、不定义 */
extern uint32_t _sidata;   /* Flash：.data 初值镜像的起点 */
extern uint32_t _sdata;    /* RAM ：.data 的起点            */
extern uint32_t _edata;    /* RAM ：.data 的终点            */
extern uint32_t _sbss;     /* RAM ：.bss 的起点             */
extern uint32_t _ebss;     /* RAM ：.bss 的终点             */

void Reset_Handler(void)
{
    /* ① 把 .data 的初值从 Flash 拷进 RAM —— 不拷，全局变量的初值就是垃圾 */
    uint32_t *src = &_sidata;
    uint32_t *dst = &_sdata;
    while (dst < &_edata) {
        *dst++ = *src++;
    }

    /* ② 把 .bss 清零 —— C 标准保证未初始化的全局变量初值为 0，靠的就是这一步 */
    for (dst = &_sbss; dst < &_ebss; ) {
        *dst++ = 0;
    }

    /* ③ 到这里 .data / .bss 才就绪，之后才能调用 main 或 __libc_init_array */
    for (;;) { }
}
```

 

把 ` uart.c ` 和 ` startup.c ` 一起链进去，然后看这 5 个符号各自的地址。下面用的是 ` nm -n `（ **按地址排序** ）——默认的 ` nm ` 是按 **符号名** 排的，看段布局要用 ` -n `：

 

**bash**  — 一串符号按地址铺开，Flash 段与 RAM 段一目了然

 

```text
$ arm-none-eabi-ld -T boot.ld uart.o startup.o -o boot.elf
$ arm-none-eabi-nm -n boot.elf
08000000 T uart_init      ← 全局函数：大写 T，Flash
08000018 t uart_irq       ← static 函数：小写 t（局部符号）
08000034 T Reset_Handler  ← 入口就是它（见下面的 Entry point）
0800008c T g_ver          ← const 全局：被并进 .text，所以在 Flash
08000090 t s_tag          ← static const 数组：同样在 Flash
08000095 T _etext         ← .text 到此结束（Flash 里的地址）
08000095 A _sidata        ← 和 _etext 完全同值
20000000 D _sdata         ← RAM 里的地址开始了
20000000 D g_baud         ← 已初始化：运行时在 RAM
20000004 D _edata
20000004 B _sbss          ← .data 一结束就是 .bss
20000004 B g_rxbuf        ← 未初始化：在 .bss
20000104 b s_state        ← static 变量：小写 b，链接器看不见它
20000108 B _ebss
```

 

这张表里有三件事值得停下来看。 **第一，大小写就是"能不能被别的文件连上"** ：` T/B/D ` 是全局（外部链接），` t/b ` 是 ` static `（局部符号）——` uart_irq `、` s_tag `、` s_state ` 三个都是小写，另一个文件的 ` extern ` 声明对它们完全无效。 **第二，` g_ver ` 的地址是 ` 0800008c `** ——它是 ` const int `，被脚本里的 ` *(.rodata*) ` 收进了 ` .text `，于是拿到了一个 Flash 地址，这正是 §2.5 说的"` const ` 省的是 RAM"。

 

**第三，` _sidata ` 的字母是 ` A `（absolute），而 ` _sdata ` 是 ` D `。** 原因是 ` _sidata = LOADADDR(.data) ` 算出的是一个 **纯数值** ，它不代表任何段里的存储——所以 ` nm ` 只能把它标成 absolute。它在数值上恰好等于 ` _etext `，因为脚本里 ` .data ` 的加载地址就是 ` AT(_etext) `。 **启动代码里那句 ` src = &_sidata ` 之所以能取到 Flash 里的初值镜像，靠的就是这个等式。**

 

而"同一个对象有两个地址"这件事，` readelf -l `（段表）看得最清楚：

 

**bash**  — VMA 与 LMA 分离的直接证据

 

```text
$ arm-none-eabi-readelf -l boot.elf
Elf file type is EXEC (Executable file)
Entry point 0x8000035            ← 末位那个 1 是 Thumb 位，实体在 0x08000034
There are 3 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x001000 0x08000000 0x08000000 0x00095 0x00095 R E 0x1000
  LOAD           0x002000 0x20000000 0x08000095 0x00004 0x00004 RW  0x1000
  LOAD           0x000004 0x20000004 0x0800009c 0x00000 0x00104 RW  0x1000
                          └────────┘ └────────┘  └─────┘ └─────┘
                             VMA        LMA      占Flash  占RAM

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .data 
   02     .bss
```

 

◆ 三个数字，把整个启动流程讲完了

 

**先看 ` Entry point 0x8000035 `：末位的 1 不是笔误** ——Cortex-M 只有 Thumb 指令集，函数指针的 bit0 恒为 1，所以入口地址是 ` Reset_Handler ` 的 ` 0x08000034 ` 加 1。` nm ` 显示的是"真地址"，` Entry point ` 显示的是"跳转时要用的值"，两者差 1 是正常的。

 

再看编号 01 的那行 ` LOAD `： **` VirtAddr ` = ` 0x20000000 `（RAM），` PhysAddr ` = ` 0x08000095 `（Flash）** ——这就是 VMA/LMA 分离，而且 ` PhysAddr ` 正好等于上面 ` nm ` 里的 ` _sidata `。` VirtAddr ` 是"运行时代码用哪个地址访问它"，` PhysAddr ` 是"上电时这段内容从 Flash 的哪里取"。

 

最关键的是编号 02 那行，` FileSiz ` 与 ` MemSiz ` 彻底分家了： **` FileSiz = 0x00000 `，` MemSiz = 0x00104 `** 。` 0x104 ` = 260 字节，对一下账正好是 ` s_state `（4 字节）\+ ` g_rxbuf[64] `（64 × 4 = 256 字节）——它们就是 ` nm ` 里夹在 ` _sbss ` 和 ` _ebss ` 之间的那两块。` FileSiz ` 是 **烧写进 Flash 的字节数** ，` MemSiz ` 是 **运行时占的 RAM 字节数** ；` FileSiz = 0 ` 的意思是 **这段内容在 ELF 文件里一个字节都没有** ，所以那一行的 ` PhysAddr = 0x0800009c ` 只是格式上必须填的一个占位值，没有任何数据会从这里取。

 

**这就解释了 ` .bss ` 为什么能"不占 Flash"** ——它的段类型是 ` NOBITS `，文件里只有段头、没有内容，启动代码用循环清零把它"造"出来。` g_baud ` 则相反：` FileSiz = MemSiz = 0x4 `，4 字节初值必须实打实躺在 Flash 里，运行时再拷到 RAM。也解释了启动代码里那两行注释为什么那么重要： **少拷贝一次 ` .data `，所有已初始化全局变量的初值都是垃圾；少清零一次 ` .bss `，所有未初始化全局变量都是随机数** 。` reset ` 之后行为诡异、换个编译器就好，十有八九就是启动代码没写全。

 

验证 ` .data ` 的初值确实在 Flash 里对：

 

**bash**  — 0x0001c200 = 115200，就是 g\_baud 的初值

 

```text
$ arm-none-eabi-objdump -s -j .data boot.elf
Contents of section .data:
 20000000 00c20100                             ....
          └────────┘ 小端序读作 0x0001C200 = 115200 ✔
```

 

```zhizhan-anchor
ch2-7
```



## 2.7 临界区：从 ` PRIMASK ` 到 C11 ` _Atomic `

 

回顾本章 §2.4：讲 ` volatile ` 时我们说过三次"中断插在中间就会丢计数"。但那时我们只回答了" **为什么** 会丢"，从没回答" **那怎么办** "。这一节把这个缺口补上—— **这是本章唯一一节真正教你写并发安全代码的内容** 。

 

先把问题钉死。考虑一次读-改-写：

 

**FIG 2.7**  一次「读-改-写」被中断切开的两条时间线

 

```zhizhan-figure
<svg viewBox="0 0 720 250" width="100%" style="max-width:720px;display:block;margin:0 auto" role="img" aria-label="中断打断读改写导致丢计数的时序图">
          <!-- 主流程 -->
          <text x="14" y="30" fill="var(--txt-dim)" font-size="12">主流程 g_tick = g_tick + 1</text>
          <rect x="150" y="16" width="110" height="24" rx="4" fill="none" stroke="var(--grn)" stroke-width="1.4"></rect>
          <text x="205" y="32" fill="var(--grn)" font-size="11.5" text-anchor="middle">ldr r3,[g_tick]</text>
          <rect x="270" y="16" width="80" height="24" rx="4" fill="none" stroke="var(--grn)" stroke-width="1.4"></rect>
          <text x="310" y="32" fill="var(--grn)" font-size="11.5" text-anchor="middle">adds r3,#1</text>
          <rect x="360" y="16" width="120" height="24" rx="4" fill="none" stroke="var(--grn)" stroke-width="1.4"></rect>
          <text x="420" y="32" fill="var(--grn)" font-size="11.5" text-anchor="middle">str r3,[g_tick]</text>
          <!-- 中断 -->
          <text x="14" y="110" fill="var(--txt-dim)" font-size="12">中断服务 &nbsp;g_tick++</text>
          <rect x="285" y="96" width="150" height="24" rx="4" fill="none" stroke="var(--red)" stroke-width="1.4"></rect>
          <text x="360" y="112" fill="var(--red)" font-size="11.5" text-anchor="middle">读 → 加 → 写（完成一次）</text>
          <!-- 断点线 -->
          <line x1="272" y1="8" x2="272" y2="150" stroke="var(--red)" stroke-width="1" stroke-dasharray="3,3"></line>
          <text x="278" y="164" fill="var(--red)" font-size="11">此刻中断到达</text>
          <!-- 结果 -->
          <rect x="150" y="186" width="330" height="46" rx="6" fill="none" stroke="var(--red)" stroke-width="1.2"></rect>
          <text x="315" y="205" fill="var(--red)" font-size="12" text-anchor="middle">中断里写回的值，被主流程后面那条 str 覆盖</text>
          <text x="315" y="222" fill="var(--txt-dim)" font-size="11.5" text-anchor="middle">两次自增只留下一次 — 丢失更新（lost update）</text>
        </svg>
```

 

读-改-写不是一条指令，而是三条。中断只要落在读和写之间，就必然丢失一次更新。加 ` volatile ` 不解决这个问题——它只保证这三条指令真的存在，不保证它们不可分割。

 

解决手段有四个层次，代价和能力各不相同。我们逐层实测。

 

```zhizhan-anchor
ch2-7-1
```



### 2.7.1 第 1 层：直接关中断（` PRIMASK `）

 

最粗暴也最常用的办法：进入临界区前关掉所有可配置优先级的中断，出来再打开。

 

crit.c C

 

```text
#include <stdint.h>

/* ① CMSIS 风格：直接操作 PRIMASK */
__attribute__((always_inline)) static inline void irq_save(void)
{
    __asm volatile ("cpsid i" ::: "memory");      /* PRIMASK = 1，屏蔽可配置优先级中断 */
}
__attribute__((always_inline)) static inline void irq_restore(void)
{
    __asm volatile ("cpsie i" ::: "memory");
}

/* ② 保存/恢复：能嵌套的版本 */
__attribute__((always_inline)) static inline uint32_t primask_save(void)
{
    uint32_t pm;
    __asm volatile ("mrs %0, primask" : "=r" (pm) :: "memory");
    __asm volatile ("cpsid i" ::: "memory");
    return pm;
}
__attribute__((always_inline)) static inline void primask_restore(uint32_t pm)
{
    __asm volatile ("msr primask, %0" :: "r" (pm) : "memory");
}

volatile int g_tick = 0;

/* ③ 用临界区保护一次读-改-写 */
int tick_take(void)
{
    uint32_t pm = primask_save();
    int v = g_tick;
    g_tick = v + 1;          /* 读-改-写：中断插在中间就会丢计数 */
    primask_restore(pm);
    return v;
}
```

 

关键在 ` tick_take ` 的反汇编——注意那两条 ` mrs `/` msr ` 把中间的三条指令夹成了一个整体：

 

**bash**  — 保存 → 关中断 → 读改写 → 恢复，一条不缺

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -c crit.c
$ arm-none-eabi-objdump -d --no-show-raw-insn crit.o | sed -n '/<tick_take>/,/^$/p'
00000000 <tick_take>:
   0:  mrs  r2, PRIMASK   ← 先记下当前状态
   2:  cpsid i            ← 关中断
   4:  ldr  r3, [pc, #12]
   6:  ldr  r0, [r3, #0]  ← 读
   8:  adds r1, r0, #1     ← 改
   a:  str  r1, [r3, #0]  ← 写
   c:  msr  PRIMASK, r2   ← 恢复成【原来】的状态
   e:  bx   lr
```

 

◆ 为什么必须"保存—恢复"，不能简单"关—开"

 

对比 ` irq_save `/` irq_restore ` 和 ` primask_save `/` primask_restore `：前者无条件把 ` PRIMASK ` 置 1 再无条件清 0， **后者先把旧值读出来、最后写回去** 。

 

差别在 **嵌套** 。假设外层已经关了中断，然后在临界区里调了一个函数，那个函数又用了 ` irq_restore `—— **它会把中断提前打开** ，外层临界区剩下的部分就裸奔了。用保存/恢复的版本，内层恢复的是"内层进来时的状态"（= 已关闭），外层不受影响。

 

这条纪律适用于所有资源： **锁、中断状态、优先级屏蔽，凡是"设成某个值"的清理动作都应该改写成"恢复到进来时的值"** 。这也是 CMSIS 里 ` __disable_irq() ` 和 ` __get_PRIMASK() `\+` __set_PRIMASK() ` 成对出现的原因。

 

⚠ 代价：这条 8 字节的代码会拉长所有高优先级中断的响应延迟

 

` PRIMASK ` 是"全关"， **不区分优先级** 。临界区里执行了多少条指令，所有中断（包括那个必须在 1 微秒内响应的）就被推迟了多少条指令的时间。临界区里 **不能** 放：循环、函数调用、` memcpy `、浮点运算、任何可能阻塞的东西。

 

另外 ` PRIMASK ` 屏蔽不了  **NMI 和 HardFault** （它们优先级为负），所以真正需要绝对互斥的场景，光靠关中断是不够的。

 

```zhizhan-anchor
ch2-7-2
```



### 2.7.2 第 2 层：` BASEPRI `——只屏蔽一部分中断

 

` BASEPRI ` 比 ` PRIMASK ` 精细：它只屏蔽 **优先级数值大于等于某阈值** 的中断，比阈值更高（数值更小）的中断照常响应。这让"保护数据和"保留实时性"可以共存。

 

**bash**  — ` BASEPRI ` 的读写就是一条 ` mrs `/` msr `

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn bp.o | sed -n '/<crit_begin>/,/^$/p'
00000000 <crit_begin>:
   0:  msr  BASEPRI, r0   ← 一行就够，r0 = 优先级阈值
   2:  bx   lr
```

 

✕ 实测发现：` -mcpu=cortex-m0 ` 不会拒绝 ` msr BASEPRI `

 

这是本次实测里最值得单独拎出来的一条。 **Cortex-M0（ARMv6-M）根本没有 ` BASEPRI ` 寄存器** ——它是 ARMv7-M 才引入的。按常理，用 ` -mcpu=cortex-m0 ` 编译应该报错。实测结果：

 

**它编译通过了，而且汇编出的指令和 M3 一模一样。** 换句话说，编译器 **不会替你拦住这个错误** 。这段代码烧进真实的 M0 芯片，会在执行到这一行时触发 ` INVSTATE `/未定义指令相关的 fault——而且因为它在 ` __attribute__((always_inline)) ` 里，可能被内联到任何地方，现场会非常难查。

 

更麻烦的是，这件事 **没有一致性** ：同一次实测里，` ssat ` 指令在 M0 上会被汇编器正确拒绝（因为它认这条助记符并知道 M0 不支持）。也就是说， **"编译器会拦住我"这个假设是逐指令成立的，不能推广** 。

 

正确做法是 **自己用能力宏门控** ——不要靠 ` -mcpu ` 兜底：

 

```text
#if defined(__ARM_ARCH) && __ARM_ARCH >= 7
    /* BASEPRI 只在 ARMv7-M 及以上存在 */
    __asm volatile ("msr basepri, %0" :: "r" (level) : "memory");
#else
    #error "BASEPRI 需要 ARMv7-M（Cortex-M3/M4/M7），M0/M0+ 请改用 PRIMASK"
#endif
```

 

实测的能力宏对照表如下。注意 ` __ARM_FEATURE_LDREX ` 在 M0 上 **根本不存在** ，这正是下一节要用的门控条件：

 

| 能力宏 | Cortex-M0 | Cortex-M3 |
| --- | --- | --- |
| ` __ARM_ARCH ` | ` 6 ` | ` 7 ` |
| ` __ARM_ARCH_ISA_THUMB ` | ` 1 ` | ` 2 ` |
| ` __ARM_FEATURE_LDREX ` | 未定义 | ` 7 ` |
| ` __ARM_FEATURE_CLZ ` | 未定义 | ` 1 ` |
| ` __ARM_FEATURE_IDIV ` | 未定义 | ` 1 ` |
| ` __ARM_FEATURE_SAT ` | 未定义 | ` 1 ` |
| ` __ARM_FEATURE_UNALIGNED ` | 未定义 | ` 1 ` |

 

```zhizhan-anchor
ch2-7-3
```



### 2.7.3 第 3 层：` LDREX `/` STREX ` 与 C11 ` _Atomic `

 

前三层的共同缺点是"关中断会伤害实时性"。Cortex-M3 及以上提供了 **独占访问（exclusive access）** 指令对：` LDREX ` 带标记地读，` STREX ` 只在"期间没人碰过这块内存"时才写入，否则返回非 0 让你重试。 **不关中断也能保证读-改-写不可分割。**

 

C 语言里你甚至不需要手写汇编——C11 的 ` _Atomic ` 就是干这个的：

 

atomic.c C

 

```text
#include <stdint.h>
#include <stdatomic.h>

volatile int g_plain  = 0;
_Atomic int   g_atomic = 0;

/* ① 裸读-改-写：中断插在中间就会丢计数 */
void bump_plain(void) { g_plain = g_plain + 1; }

/* ② C11 原子：读-改-写不可分割，不依赖关中断 */
void bump_atomic(void) { atomic_fetch_add(&g_atomic, 1); }

/* ③ 原子比较交换：无锁自旋的典型形态 */
int cas_atomic(int expect, int desired)
{
    return atomic_compare_exchange_strong(&g_atomic, &expect, desired);
}

/* ④ 手写独占访问（CMSIS 的 __LDREXW / __STREXW 就是这么写的） */
#if defined(__ARM_FEATURE_LDREX)
static inline uint32_t ldrex_w(volatile void *p)
{
    uint32_t v;
    __asm volatile ("ldrex %0, [%1]" : "=r" (v) : "r" (p) : "memory");
    return v;
}
static inline uint32_t strex_w(uint32_t v, volatile void *p)
{
    uint32_t ok;
    __asm volatile ("strex %0, %2, [%1]" : "=r" (ok) : "r" (p), "r" (v) : "memory");
    return ok;
}
int bump_llsc(int add)
{
    uint32_t old, ok;
    do {
        old = ldrex_w(&g_atomic);
        ok  = strex_w(old + (uint32_t)add, &g_atomic);
    } while (ok != 0);                 /* STREX 非 0 = 期间被打断，重试 */
    return (int)old;
}
#endif
```

 

在 M3 上，` bump_atomic ` 和手写的 ` bump_llsc ` 编译出的东西几乎一样——都是"标记读 → 加 → 条件写 → 失败重试"：

 

**bash**  — M3：` _Atomic ` 全部内联成硬件指令

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -c atomic.c
$ arm-none-eabi-objdump -d --no-show-raw-insn atomic.o | sed -n '/<bump_atomic>/,/^$/p'
00000010 <bump_atomic>:
  10:  dmb  ish          ← 内存屏障，保证之前的访问先完成
  14:  ldr  r3, [pc, #20]
  16:  ldrex r1, [r3]    ← 独占读
  1a:  adds r1, #1
  1c:  strex r2, r1, [r3] ← 独占写，r2 = 成功标志
  20:  cmp  r2, #0
  22:  bne.n 16          ← 被打断就回到 ldrex 重试
  24:  dmb  ish
  28:  bx   lr
$ arm-none-eabi-nm -u atomic.o
(空 — 没有任何未定义符号，零运行库依赖)
```

 

但把同一份文件换成 ` -mcpu=cortex-m0 `，情况完全变了。M0 没有 ` LDREX `/` STREX `，编译器只能 **把原子操作降级成函数调用** ：

 

**bash**  — M0：原子操作变成 ` bl __atomic_* `，需要 libatomic

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -O2 -c atomic.c
$ arm-none-eabi-objdump -d --no-show-raw-insn atomic_m0.o | sed -n '/<bump_atomic>/,/^$/p'
00000010 <bump_atomic>:
  10:  push {r4, lr}
  12:  movs r2, #5
  14:  movs r1, #1
  16:  ldr  r0, [pc, #8]
  18:  bl   __atomic_fetch_add_4   ← 一次原子操作 = 一次函数调用
  1c:  pop  {r4, pc}
$ arm-none-eabi-nm -u atomic_m0.o
         U __atomic_compare_exchange_4
         U __atomic_fetch_add_4
         ↑ 这两个符号由 libatomic 提供 —— 但下面这条命令告诉我们：本工具链没有它
```

 

**bash**  — 实测：这个工具链压根没带 ` libatomic `

 

```text
$ arm-none-eabi-ld -e 0 atomic_m0.o -o /dev/null
ld: atomic_m0.o: in function `bump_atomic':
atomic.c:(.text+0x18): undefined reference to `__atomic_fetch_add_4'
ld: atomic_m0.o: in function `cas_atomic':
atomic.c:(.text+0x34): undefined reference to `__atomic_compare_exchange_4'
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb atomic_m0.o --specs=nosys.specs -e 0 -o m0.elf
ld: atomic_m0.o: in function `bump_atomic':
atomic.c:(.text+0x18): undefined reference to `__atomic_fetch_add_4'
         ↑ 换成 gcc 驱动链接、让它自动带运行库，结果完全一样
$ find . -iname "libatomic*"
(无输出 —— Arm GNU Toolchain 13.3.1 只带 libc/libm/libgcc/libstdc++，没有 libatomic)
```

 

✕ 致命的一步：` _Atomic ` 在 Cortex-M0 上会直接链接失败

 

注意 ` libgcc.a `  **不能** 替代 ` libatomic `——这是最容易误判的地方。实测时我直接指定了 ` libgcc.a ` 的绝对路径去链接，报错一字未变。这两个库分工明确：` libgcc ` 管整数除法和软件浮点，` libatomic ` 管原子操作的软件实现。

 

所以如果你的目标板是  **STM32F0 / G0 / L0 系列（Cortex-M0/M0\+）** ，写上 ` _Atomic ` 之后编译能过、 **链接一定失败** ，而你手上多半没有为 ` -mcpu=cortex-m0 ` 编好的 ` libatomic.a `。此时只能：

 

 
- 退回 ` PRIMASK ` 关中断（第 1 层）——M0 上这是最实际的选择；
 
- 或者自己实现 ` __atomic_fetch_add_4 ` 等几个函数（用关中断实现，但要注意重入）；
 
- 或者换 M3 及以上（M3/M4/M7）的芯片，让编译器内联出 ` LDREX `/` STREX `。
 

 

**这不是理论推演，"链接失败"是上面那条命令跑出来的真实输出。** 反过来说，这也说明"用 C11 原子就能跨平台写并发"是个过于乐观的想法—— **它能不能用，取决于你的核有没有独占访问指令** 。

 

◆ 四种手段的选择表

 

```zhizhan-table
{"rows":[[{"body":"手段","header":true,"rowSpan":1,"colSpan":1},{"body":"指令开销","header":true,"rowSpan":1,"colSpan":1},{"body":"对实时性的影响","header":true,"rowSpan":1,"colSpan":1},{"body":"适用场景","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**关中断**   \n` cpsid i `","header":false,"rowSpan":1,"colSpan":1},{"body":"2 条","header":false,"rowSpan":1,"colSpan":1},{"body":"**屏蔽所有** 可配置中断","header":false,"rowSpan":1,"colSpan":1},{"body":"临界区极短（几条指令）、M0 上唯一可行、数据必须绝对互斥时。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**` BASEPRI `**","header":false,"rowSpan":1,"colSpan":1},{"body":"2 条","header":false,"rowSpan":1,"colSpan":1},{"body":"只屏蔽低优先级中断","header":false,"rowSpan":1,"colSpan":1},{"body":"需要保护数据、又要留住高优先级实时响应。 **M3 及以上** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**` LDREX `/` STREX `**","header":false,"rowSpan":1,"colSpan":1},{"body":"3～4 条  \n失败要重试","header":false,"rowSpan":1,"colSpan":1},{"body":"**不关中断**","header":false,"rowSpan":1,"colSpan":1},{"body":"单个字/双字的原子读改写、无锁队列、引用计数。 **M3 及以上** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**C11 ` _Atomic `**","header":false,"rowSpan":1,"colSpan":1},{"body":"M3：同左  \nM0： **函数调用**","header":false,"rowSpan":1,"colSpan":1},{"body":"M3 上不关中断","header":false,"rowSpan":1,"colSpan":1},{"body":"想用标准语法、不想碰汇编。 **但 M0 上会链接失败** ，见上面的实测。","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

最后回到 §2.4 那句"` volatile ` 不保证原子性"。现在可以给出精确的补充： **对单个对齐的 ` int ` 的读和写，Cortex-M 上确实是一条指令、天然原子；但 ` g_tick = g_tick + 1 ` 不是一次访问，而是"读一次 \+ 写一次"两次访问** 。` volatile ` 保证这两次访问都真实发生、不被优化掉，但 **中间那个空档期对中断是完全敞开的** ——那正是本节所有手段要填的缝。

 

```zhizhan-anchor
ch2-8
```



## 2.8 ` volatile ` 补遗：` ACCESS_ONCE ` 与 volatile 位域

 

§2.4 讲了 ` volatile ` 的契约，§2.7 补上了"不保证原子性"之后该怎么补救。这一节收尾： **当 ` volatile ` 无法加到变量声明上时怎么办** ，以及  **` volatile ` 和位域撞在一起时会出什么怪事** 。

 

```zhizhan-anchor
ch2-8-1
```



### 2.8.1 ` ACCESS_ONCE `：无法改声明时的"点状 volatile"

 

现实里经常遇到这种局面：变量定义在别人的头文件里、在库的内部、或者被一堆代码共享—— **你没法给它加 ` volatile `** ，但你就是需要在某一行强制"真的去读一次内存"。Linux 内核给出的答案是 ` ACCESS_ONCE `：

 

once.c C

 

```text
#include <stdint.h>

/* ── ① ACCESS_ONCE：把任意左值「临时」当成 volatile 访问一次 ── */
#define ACCESS_ONCE(x) (*(volatile __typeof__(x) *)&(x))

/* 普通全局：编译器可以把它当常量缓存进寄存器 */
int g_plain_flag;
/* volatile 全局：每次都必须真的去内存读 */
volatile int g_vol_flag;

/* ② 轮询等待：三种写法，看谁能真正「每圈重读」 */
void wait_plain(void) { while (g_plain_flag == 0) { } }
void wait_vol(void)   { while (g_vol_flag   == 0) { } }

/* ③ 同一个普通变量，用 ACCESS_ONCE 读一次 —— 不改变它的声明 */
int take_once(void) { return ACCESS_ONCE(g_plain_flag); }

/* ④ ACCESS_ONCE 也管写：防止编译器把两次「看似无用」的写合并/删掉 */
void poke(void)
{
    ACCESS_ONCE(g_plain_flag) = 1;   /* 例如清中断标志：写一次就够，不能删 */
    ACCESS_ONCE(g_plain_flag) = 1;
}

/* ⑤ volatile 结构体整体赋值是不是逐成员？ */
struct st { uint32_t a; uint16_t b; uint8_t c; uint8_t d; };
volatile struct st g_vst;
struct st          g_pst;

void copy_vst_to_plain(void) { g_pst = g_vst; }   /* volatile 源 → 普通目标 */
void zero_vst(void)          { struct st z = {0}; g_vst = z; }
```

 

先看最要命的一组对照。两个函数逻辑完全一样，唯一区别是那个全局变量有没有 ` volatile `：

 

**bash**  — 同一个死循环，两种命运

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -c once.c
$ arm-none-eabi-objdump -d --no-show-raw-insn once.o
00000000 <wait_plain>:
   0:  ldr  r3, [pc, #8]
   2:  ldr  r3, [r3, #0]   ← 只读了【一次】
   4:  cbnz r3, 8
   6:  b.n  6              ← 跳回自己：无论标志怎么变，永远出不来
   8:  bx   lr

00000010 <wait_vol>:
  10:  ldr  r2, [pc, #8]
  12:  ldr  r3, [r2, #4]    ← 每圈真的重新读内存
  14:  cmp  r3, #0
  16:  beq.n 12            ← 回到 0x12 再读
  18:  bx   lr
```

 

✕ ` wait_plain ` 编译出来的是一条真正的死循环

 

仔细看 ` wait_plain ` 的 ` 0x6: b.n 6 `—— **它跳回自己的地址** 。编译器把 ` g_plain_flag ` 的值读进 ` r3 ` 之后就认定"这个普通变量在循环里不可能被改"，于是把整个判断 **提到了循环外** ，循环体里只剩一条无条件跳转。

 

后果是： **中断服务函数里写 ` g_plain_flag = 1 ` 会真的写进内存，但 ` wait_plain ` 永远看不到** 。它会一直转到看门狗复位。这是嵌入式里最经典的"代码看起来完全正确、行为完全错误"的案例，而且它 **只在开优化时才出现** ——` -O0 ` 下一切正常，产品上线打开 ` -O2 ` 就死机。

 

注意 ` wait_vol ` 的结构：` beq.n 12 `  **跳回去重新执行 ` ldr `** 。这就是 ` volatile ` 的全部作用——不让编译器把内存访问挪走或合并。

 

` ACCESS_ONCE ` 的第二个用途是 **保住"看起来冗余"的写** 。清中断标志这类操作经常需要"写同一个值两次"（比如某些外设"写 1 清除"，连续写两次表示清除两个标志），编译器却会认为第一次写毫无意义：

 

once2.c C

 

```text
#include <stdint.h>

#define ACCESS_ONCE(x) (*(volatile __typeof__(x) *)&(x))

int g_flag;

/* 对照组：不用 ACCESS_ONCE，两次「重复写同一个值」 */
void poke_plain(void)
{
    g_flag = 1;
    g_flag = 1;      /* 编译器：第一次写根本没被读过，删掉 */
}

/* 实验组：用 ACCESS_ONCE，两次写都必须落到总线上 */
void poke_once(void)
{
    ACCESS_ONCE(g_flag) = 1;
    ACCESS_ONCE(g_flag) = 1;
}

/* volatile 结构体整体赋值：逐成员拷贝还是整体拷贝？ */
struct st { uint32_t a; uint16_t b; uint8_t c; uint8_t d; };
volatile struct st g_vst;
struct st          g_pst;

void vst_read(void)  { g_pst = g_vst; }        /* volatile 源 → 普通目标 */
void vst_write(void) { struct st z = {0}; g_vst = z; }
```

 

**bash**  — 少了 ` ACCESS_ONCE `，第一次写就没了

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn once2.o | sed -n '/<poke_plain>/,/^$/p'
00000000 <poke_plain>:
   0:  movs r2, #1
   2:  ldr  r3, [pc, #4]
   4:  str  r2, [r3, #0]   ← 只剩一条 str，第一次写被优化掉
   6:  bx   lr
$ arm-none-eabi-objdump -d --no-show-raw-insn once2.o | sed -n '/<poke_once>/,/^$/p'
0000000c <poke_once>:
   c:  movs r2, #1
   e:  ldr  r3, [pc, #8]
  10:  str  r2, [r3, #0]   ← 两次写都保留了
  12:  str  r2, [r3, #0]   ← 这才是硬件要的「写两次」
  14:  bx   lr
```

 

◆ ` ACCESS_ONCE ` 的三条使用纪律

 

 
- **它是"点状"的，不是"范围"的** 。` ACCESS_ONCE(x) ` 只让 **这一次** 访问变成 volatile；下一行再写 ` x ` 又回到普通语义。 **要每次访问都受保护，你得每次都用 ` ACCESS_ONCE ` 包住** ——很容易漏，这是它的主要风险。
 
- **它不提供原子性和内存屏障** 。它和 ` volatile ` 同级别，只解决"这次访问不能被删/挪/合并"。跨核可见性仍然要靠 §2.7 的手段。
 
- **Linux 内核里它已改名** 。现代内核用 ` READ_ONCE() ` / ` WRITE_ONCE() `，并且用 ` union ` 技巧绕开了 ` ACCESS_ONCE ` 对 ` const ` 类型强制转换的告警问题。在应用代码里，` ACCESS_ONCE ` 那个宏定义仍然是最短最实用的形式。

 

再看 ` volatile ` 结构体的整体赋值。` struct st ` 是 8 字节（4\+2\+1\+1），` volatile struct st ` 的赋值到底怎么编译？

 

**bash**  — 8 字节的 volatile 结构体赋值 = 两次 32 位总线访问

 

```text
$ arm-none-eabi-nm once2.elf | grep -E "g_vst|g_pst"
20000004 B g_pst
2000000c B g_vst
$ arm-none-eabi-objdump -d --no-show-raw-insn once2.elf | sed -n '/<vst_read>/,/^$/p'
0800001c <vst_read>:
 800001c:  ldr  r3, [pc, #12]   ← r3 = 0x20000000
 800001e:  adds r2, r3, #4      ← r2 = &g_pst = 0x20000004
 8000020:  adds r3, #12         ← r3 = &g_vst = 0x2000000c
 8000022:  ldmia.w r3, {r0, r1}  ← 从 volatile 源一次读 8 字节
 8000026:  stmia.w r2, {r0, r1}  ← 写到普通目标
 800002a:  bx   lr
```

 

⚠ ` volatile ` 结构体赋值不是原子的，也不是"逐成员"的

 

很多人以为 ` volatile ` 结构体赋值会展开成"一个成员一个成员地 volatile 读写"。实测结果既不是逐成员、也不原子： **GCC 生成了 ` ldmia `/` stmia ` 各一条，一次性搬运 8 字节** 。

 

在 Cortex-M3 上，` ldmia ` 搬 2 个寄存器 **不是一条总线[事务](term:transaction)** ，而是 **两次 32 位读** 。` stmia ` 同理。 **中断落在两次访问之间，读到的就是"半旧半新"的结构体** ——这就是所谓  *torn read* 。而且 ` stmia ` 写回时如果被打断，硬件看到的是"新的一半 \+ 旧的一半"这种从未存在过的状态。

 

结论： **跨中断/跨任务共享的结构体，绝不能靠 ` volatile ` 赋值来同步** 。要么用 §2.7 的临界区把整个赋值夹起来，要么改成"单字量 \+ 序号/双缓冲"的无锁协议。 **这一条在写 DMA 描述符、环形缓冲区读写指针时尤其致命。**

 

```zhizhan-anchor
ch2-8-2
```



### 2.8.2 volatile 位域：` -fstrict-volatile-bitfields ` 到底管什么

 

外设寄存器最自然的 C 写法是位域——` REG->EN = 1; ` 比 ` REG = (REG & ~1) | 1; ` 好读得多。但位域和 ` volatile ` 一起用时， **编译器"用多宽的访问去读写这个位域"是有讲究的** ，而这个讲究由一个大多数人都没听过的编译选项控制。

 

vbf.c C

 

```text
#include <stdint.h>

/* 一个假的「外设寄存器」：C 语言视角是位域，硬件视角是一个 32 位寄存器。
   注意 EN/MODE 和后面的位共享同一个字 —— 写 EN 必须【读-改-写】。 */
typedef struct {
    volatile uint32_t EN   : 1;
    volatile uint32_t MODE : 2;
    volatile uint32_t      : 5;
    volatile uint32_t CNT  : 16;
    volatile uint32_t      : 8;   /* 补满 32 位 */
} CR_t;

CR_t *const REG = (CR_t *)0x40000000;

/* ① 写一个位域：必须只动 EN，不能碰 MODE/CNT */
void set_en(uint32_t v) { REG->EN = v; }

/* ② 读一个位域 */
uint32_t get_cnt(void) { return REG->CNT; }

/* ③ 对照组：同一个寄存器，用「掩码 + 整字读写」的手写形式 */
#define CR_EN (1u << 0)
void set_en_mask(uint32_t v)
{
    uint32_t t = *(volatile uint32_t *)0x40000000;
    t = (t & ~CR_EN) | (v ? CR_EN : 0u);
    *(volatile uint32_t *)0x40000000 = t;
}

/* ④ 声明类型是窄类型时，GCC 会选多宽的访问？ */
typedef struct { volatile uint8_t f : 4; volatile uint8_t g : 4; } BYTE_t;
volatile BYTE_t *const BREG = (volatile BYTE_t *)0x40000100;
void set_bf(uint8_t v) { BREG->f = v; }
```

 

先看默认行为（也就是 ` -fstrict-volatile-bitfields `）。` EN ` 的声明类型是 ` uint32_t `，所以访问就是 **整字读-改-写** ；` f ` 的声明类型是 ` uint8_t `，所以是 **字节读-改-写** 。 **规则很简单：用声明类型的宽度去访问。**

 

**bash**  — 默认（= strict）：访问宽度跟着【声明类型】走

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn vbf.o | sed -n '/<set_en>/,/^$/p;/<set_bf>/,/^$/p'
00000000 <set_en>:
   0:  mov.w r3, #1073741824  ← 0x40000000
   4:  ldr  r2, [r3, #0]      ← 32 位读（声明类型 uint32_t）
   6:  bfi  r2, r0, #0, #1    ← 插入 bit0，其它位原样保留
   a:  str  r2, [r3, #0]      ← 32 位写
   c:  bx   lr

00000034 <set_bf>:
  34:  ldr  r2, [pc, #8]
  36:  ldrb r3, [r2, #0]      ← 8 位读（声明类型 uint8_t）
  38:  bfi  r3, r0, #0, #4
  3c:  strb r3, [r2, #0]      ← 8 位写
  3e:  bx   lr
```

 

再看关掉 strict 之后同一个 ` get_cnt ` 会变成什么—— **这一组的差异是货真价实的** ：

 

**bash**  — 关掉 strict：为了"只读那 16 位"，生成了一条错位的半字访问

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn vbf_strict.o | sed -n '/<get_cnt>/,/^$/p'
00000010 <get_cnt>:                 # -fstrict-volatile-bitfields（默认）
  10:  mov.w r3, #1073741824
  14:  ldr  r0, [r3, #0]      ← 32 位读整个寄存器
  16:  ubfx r0, r0, #8, #16  ← 取出 bit8..bit23
  1a:  bx   lr
$ arm-none-eabi-objdump -d --no-show-raw-insn vbf_loose.o | sed -n '/<get_cnt>/,/^$/p'
00000010 <get_cnt>:                 # -fno-strict-volatile-bitfields
  10:  mov.w r3, #1073741824
  14:  ldrh.w r0, [r3, #1]   ← 地址 0x40000001：半字访问，还是【奇数地址】
  18:  bx   lr
```

 

✕ 两行代码的差别，可能让你的外设直接 HardFault

 

` ldrh.w r0, [r3, #1] ` 是 **对地址 ` 0x40000001 ` 的半字（16 位）访问** 。这条指令有两个独立的危险：

 

 
- **访问宽度不匹配。** 大量外设寄存器只支持 32 位访问。对这类寄存器做 16 位读写，轻则读到垃圾，重则触发总线错误（BusFault）。
 
- **地址没有按访问宽度对齐。** 半字访问要求地址是 2 的倍数，而 ` 0x40000001 ` 是奇数。Cortex-M3/M4 的 ` LDRH ` 允许非对齐访问（会拆成两次总线访问）， **但外设总线往往不允许** ——这正是"核允许、总线拒绝"的典型裂缝。
 

 

**实测确认 ARM 上的默认值就是 strict** ：不加任何选项编译出的 ` get_cnt ` 与 ` -fstrict-volatile-bitfields ` 的目标文件 **逐字节相同** 。所以默认情况下你是安全的； **但如果你（或者你用的某个 SDK/构建脚本）显式加了 ` -fno-strict-volatile-bitfields `，上面那条 ` ldrh ` 就会出现在你的固件里。**

 

行动建议： **不要为了"省几个字节"去关这个选项** 。如果你确实需要精确控制访问宽度，别依赖位域——直接用 §2.5 那种"整套掩码操作"的手写形式（` set_en_mask `），宽度由你的 ` volatile uint32_t * ` 转换决定，一目了然、不受任何编译选项影响。

 

✔ 位域的第三条纪律：用"整字类型"声明

 

把上面的证据串起来，得到一个能避开所有坑的简单规则： **给寄存器位域声明时，一律用 ` uint32_t `（或 ` unsigned int `），不要用 ` uint8_t `/` uint16_t `** 。

 

这样做的收益是：访问宽度恒等于整字，与寄存器的物理宽度一致；不会出现"为了省两个字节而生成 ` ldrh `"的情况；也不会因为声明类型不同导致相邻位域被塞进不同存储单元（§1.5.4 实测过：` unsigned char a:4 ` \+ ` uint16_t b:4 ` 让结构体从 1 字节涨到 2 字节）。

 

```zhizhan-anchor
ch2-9
```



## 2.9 链接器能给你的四种能力：` weak ` / ` section ` / ` alias ` / ` constructor `

 

§2.6 把符号表看清楚了，这一节看它能 **被怎么利用** 。GCC 提供了四个属性，它们是嵌入式工程里"用链接器做设计"的基础设施： **弱符号让库能被裁剪，自定义段让内存布局可控，别名让接口能改名，构造函数让初始化自动发生** 。

 

attr.c C

 

```text
#include <stdint.h>

/* ── ① weak：给出「可被覆盖的默认实现」── */
__attribute__((weak)) int  w_handler(void) { return 0; }   /* 弱函数 */
__attribute__((weak)) int  w_table[4];                     /* 弱对象 */
int                        s_normal(void)  { return 1; }

/* ── ② section：把变量/函数放进自定义段 ── */
__attribute__((section(".my_cfg"))) const uint32_t cfg_magic  = 0x5A5AA5A5;
__attribute__((section(".noinit"))) uint32_t       survives;
__attribute__((section(".my_cfg"))) const uint8_t  cfg_ver[2] = { 1, 7 };

/* ── ③ alias：两个名字，一个地址 ── */
int real_impl(int x) { return x + 1; }
extern int shortcut(int x) __attribute__((alias("real_impl")));

/* ── ④ constructor：在 main 之前自动跑（真正入口是 Reset_Handler）── */
static int  g_ready;
__attribute__((constructor)) static void early_init(void) { g_ready = 1; }
int is_ready(void) { return g_ready; }
```

 

```zhizhan-anchor
ch2-9-1
```



### 2.9.1 ` weak `：让库提供"可以被打败的默认实现"

 

**bash**  — 大小写之外的第三类字母：` W ` 与 ` V `

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -c attr.c
$ arm-none-eabi-nm --print-size attr.o | grep -E "w_handler|w_table|s_normal|real_impl|shortcut"
00000000 00000004 W w_handler   ← 弱【函数】
00000000 00000010 V w_table     ← 弱【对象】
00000000 00000004 T s_normal    ← 普通强符号
00000000 00000004 T real_impl
00000000 00000004 T shortcut    ← 别名，也是 T
```

 

◆ 弱符号解决的是"库作者必须先给个实现"的问题

 

链接器的规则是： **强符号只能有一个；但弱符号可以被强符号覆盖，且被覆盖时不会报 ` multiple definition `** 。这条规则让库可以这样设计—— **库里给一个"什么都不做"的弱实现，用户只要在自己代码里定义一个同名强符号，就自动接管了** ，不需要改库、不需要回调注册。

 

最典型的例子是  **中断向量表的 ` Default_Handler `** ：启动文件把所有异常处理函数都声明成 ` weak ` 且指向一个死循环。你在 ` stm32f1xx_it.c ` 里定义 ` void TIM2_IRQHandler(void) `，链接器就用你的版本替换掉启动文件里的默认版； **没写的那些中断，仍然落在默认的死循环上** ——这就是"程序跑飞后卡在 ` Default_Handler `"这个经典现象的成因。

 

字母记忆：` W ` = weak function，` V ` = weak object，小写 ` w `/` v ` 表示这个弱符号本身还是 ` static `（仅本文件可见，也就失去了"被覆盖"的意义）。

 

```zhizhan-anchor
ch2-9-2
```



### 2.9.2 ` section `：把变量放到指定的段里

 

自定义段是"我不信任默认布局，我要自己安排"的入口。看四个段各自的类型和标志：

 

**bash**  — 段的类型与标志：` NOBITS ` 不占 Flash

 

```text
$ arm-none-eabi-readelf -S attr.o
  [Nr] Name              Type     Flg
  [ 9] .init_array       INIT_ARRAY  WA
  [13] .bss.g_ready      NOBITS      WA   ← -fdata-sections 分出来的
  [14] .my_cfg           PROGBITS    A    ← 自定义段：只读、要占 Flash
  [15] .noinit           NOBITS      WA   ← 自定义段：可写、不占 Flash
  [16] .bss.w_table      NOBITS      WA
```

 

◆ ` section ` 属性压过了 ` -fdata-sections `

 

注意 ` w_table `（普通变量）被 ` -fdata-sections ` 分进了 ` .bss.w_table `，而 ` cfg_magic `/` cfg_ver ` 老老实实待在 ` .my_cfg ` 里。 **显式的 ` section ` 属性优先级高于 ` -fdata-sections `** ——你点名放哪儿，它就在哪儿。

 

两个自定义段的性质差异正是它们用途的差异：

 

 
- **` .my_cfg ` 是 ` PROGBITS ` \+ ` A `** ：有实际内容、要烧进 Flash、运行时只读。适合放 **配置表、校准参数、版本信息、资源索引** 。因为内容在 Flash 里，这些数据天然防篡改；如果放在段的首尾加上 ` KEEP() `，还能做成"固件自带的一张表"。
 
- **` .noinit ` 是 ` NOBITS ` \+ ` WA `** ： **没有内容、不占 Flash** ，只有 RAM 地址范围。这是"复位后不丢"变量的标准做法—— **前提是链接脚本别让启动代码把它清零** 。

 

` .noinit ` 那一条值得单独验证，因为它失败起来是"什么都没发生"——变量安静地被清零了：

 

**bash**  — ` survives ` 必须落在 ` [_sbss, _ebss) `  **之外**

 

```text
$ arm-none-eabi-ld -T noinit.ld attr.o -o noinit.elf
$ arm-none-eabi-nm noinit.elf | grep -E "_sbss|_ebss|_snoinit|_enoinit|survives"
20000004 B _sbss
20000018 B _ebss       ← .bss 到 0x20000018 结束
20000018 B _snoinit    ← .noinit 正好从 _ebss 开始
20000018 B survives    ← 所以 survives 【不在】清零范围内 ✔
2000001c B _enoinit
```

 

⚠ 忘了在链接脚本里写 ` .noinit `，它会变成"孤儿段"

 

实测：把 ` .noinit ` 从脚本里删掉、只保留 ` .bss `，链接器把 ` survives ` 放在了 ` 0x20000018 `—— **恰好等于 ` _ebss `，也就是恰好落在清零范围之外** 。所以这次侥幸没事。

 

但这 **是运气，不是保证** 。没有被任何 ` SECTIONS ` 规则匹配到的段叫 **孤儿段（orphan section）** ，链接器会给它找个"合适"的位置，而"合适"的定义取决于链接器版本、段的标志（可写/可执行）、以及有没有别的孤儿段竞争。 **换个工具链版本、或者多引入一个自定义段，它就可能被挪进 ` .bss ` 的地址区间里，于是每次复位都被清零** ——而你的代码看起来毫无问题。

 

**纪律：只要用了 ` section ` 属性，就必须在链接脚本里有一条对应的规则，并且用 ` .map ` 文件确认它落在了你以为的地方。** ` ld ` 的 ` -Map=out.map ` 会把每个段的最终地址和来源全部列出来，这是排查"变量莫名其妙被清零/跑到错误地址"的第一手材料。

 

```zhizhan-anchor
ch2-9-3
```



### 2.9.3 ` alias `：一个实现，多个名字

 

**bash**  — 两个名字，同一个地址 ` 0x08000014 `

 

```text
$ arm-none-eabi-nm attr.elf | grep -E "real_impl|shortcut"
08000014 T real_impl
08000014 T shortcut   ← 同一个地址，两条符号记录
```

 

` alias ` 是在符号表里 **多加一条记录指向同一个地址** ，而不是复制代码。它的价值在于 **改接口名而不破坏兼容** ：库把老名字 ` alias ` 到新实现上，老代码继续编译通过，新代码用新名字，只有一份实体、只有一份 Flash 开销。

 

值得注意的是 **别名必须是强符号** （上面两个都是 ` T `），而且目标函数不能被优化掉——如果你写了 ` alias ` 却没人调用原名，配合 ` --gc-sections ` 有可能把实体回收掉，让别名变成空指针。用 ` __attribute__((used)) ` 或 ` KEEP() ` 保住它。

 

```zhizhan-anchor
ch2-9-4
```



### 2.9.4 ` constructor `：谁在调用它？

 

最容易被误解的一个。` __attribute__((constructor)) ` 让函数"在 ` main ` 之前自动执行"——但 **裸机上根本没有魔法，必须有代码去遍历那张表** 。先看编译器做了什么：

 

**bash**  — 编译器只是往 ` .init_array ` 里塞了一个函数指针

 

```text
$ arm-none-eabi-objdump -s -j .init_array attr.o
Contents of section .init_array:
 0000 00000000                             ....
                    ↑ 现在是 0，因为地址还没定，靠重定位填
$ arm-none-eabi-readelf -r attr.o | sed -n '/init_array/,/^$/p'
Relocation section '.rel.init_array' at offset 0x3d4 contains 1 entry:
 Offset     Info    Type            Sym.Value  Sym. Name
00000000  00000d26 R_ARM_TARGET1  00000001   early_init
```

 

所以 ` constructor ` 的完整机制是： **编译器把函数指针放进 ` .init_array ` 段（并留一条重定位），然后需要有人逐个调用它们** 。这个"有人"在新公式工具链里是 ` __libc_init_array `：

 

**bash**  — 遍历 ` .init_array ` 的那段代码在 ` libc.a ` 里

 

```text
$ arm-none-eabi-nm .../arm-none-eabi/lib/thumb/v7-m/nofp/libc.a | grep libc_init_array
00000000 T __libc_init_array
```

 

✕ 用 ` -nostdlib ` 或自己写启动文件时，` constructor ` 一次都不会跑

 

这是本节最容易踩的坑，也是"为什么我的构造函数没执行"这个问题的唯一答案： **` .init_array ` 被填好了，但没人去遍历它** 。

 

默认的 C 运行时启动流程是 ` Reset_Handler ` → ` __libc_init_array ` → ` main `。` __libc_init_array ` 做的事就是"从 ` __init_array_start ` 走到 ` __init_array_end `，逐个调用其中的函数指针"。 **一旦你为了减小体积用了 ` -nostdlib `，或者用 ` -nostartfiles ` 换上了自己写的 ` Reset_Handler `（就像 §2.6 里那份 ` startup.c `），这条链就断了** ——` .data ` 会拷贝、` .bss ` 会清零，但 ` .init_array ` 无人问津，所有 ` constructor ` 静默失效。

 

**而且它是静默的** ：没有报错、没有告警，变量就是保持 0。诊断方法很简单—— **在 ` is_ready() ` 里打个断点，或者直接看 ` .map ` 里 ` .init_array ` 段有没有被放进最终镜像** 。要修就在自己的启动代码里手动加一段：

 

```text
extern void (*__init_array_start[])(void);
extern void (*__init_array_end[])(void);

void call_constructors(void)
{
    for (void (**p)(void) = __init_array_start; p < __init_array_end; p++) {
        (*p)();
    }
}
```

 

C\+\+ 的全局对象构造、` __attribute__((constructor)) `、部分库的自注册机制 **全都走这条路** ——这也解释了"为什么 ` -nostdlib ` 之后 C\+\+ 全局对象不构造了"。

 

```zhizhan-anchor
ch2-10
```



## 2.10 ` inline ` / ` register ` / ` _Thread_local `

 

这三个关键字都属于" **你以为你知道它的意思，但标准里的意思和你想的不一样** "那一类。` inline ` 不保证内联、还可能造成链接失败；` register ` 早就不再影响寄存器分配、却仍然禁止取地址；` _Thread_local ` 语法上只有一个下划线开头，运行时代价却是一串函数调用。逐个实测。

 

inl.c C

 

```text
#include <stdint.h>

/* ── ① static inline：内联 + 内部链接，头文件里最常用的写法 ── */
static inline int si_sq(int x) { return x * x; }
int use_si(int x) { return si_sq(x); }

/* ── ② extern inline（C99 语义）：只提供「内联定义」，
      本编译单元不生成外部可见的实体；一旦某处没能内联，就会链接失败 ── */
extern inline int ei_sq(int x) { return x * x; }
int use_ei(int x) { return ei_sq(x); }

/* ── ③ 普通 inline（C99 语义）：本单元生成外部定义 ── */
inline int pl_sq(int x) { return x * x; }
int use_pl(int x) { return pl_sq(x); }

/* ── ④ register 变量：取地址是违反约束的 ── */
int reg_probe(void)
{
    register int cnt = 0;
    cnt += 3;
    return cnt;
}

/* ── ⑤ _Thread_local：需要运行时提供 TLS 支持 ── */
_Thread_local int tls_counter;
int  tls_inc(void) { return ++tls_counter; }
int  tls_get(void) { return tls_counter; }
```

 

```zhizhan-anchor
ch2-10-1
```



### 2.10.1 三种 ` inline `，三种链接语义

 

先看开了优化的情况——这是"看起来一切正常"的那一面：

 

**bash**  — ` -O2 `：三个调用点全部内联，问题被掩盖

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c inl.c
$ arm-none-eabi-nm inl.o | grep -E "sq|use_"
00000000 T use_si
00000008 T ei_sq     ← extern inline：生成了外部定义
00000010 T use_ei
00000018 T use_pl
     ↑ si_sq 和 pl_sq 都不在符号表里 —— 因为都被内联进调用者了
$ arm-none-eabi-nm -u inl.o
(空 —— 没有未定义符号，链接当然成功)
```

 

把优化关掉， **内联不再发生，三种写法的真实链接语义就暴露了** ：

 

**bash**  — ` -O0 `：` pl_sq ` 变成未定义符号，链接必失败

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 -c inl.c
$ arm-none-eabi-nm inl_o0.o | grep -E "sq|use_"
00000030 T ei_sq      ← extern inline：照样有外部定义 ✔
         U pl_sq      ← 普通 inline：【只有声明，没有定义】✘
00000000 t si_sq      ← static inline：本文件内实体，小写 t ✔
00000018 T use_si
00000048 T use_ei
00000060 T use_pl
$ arm-none-eabi-ld -e 0 inl_o0.o -o app.elf
ld: inl_o0.o: in function `use_pl':
inl.c:(.text+0x6a): undefined reference to `pl_sq'
```

 

✕ 最常见的误用：头文件里写 ` inline void foo(void) { ... } `

 

在 C99/C11 语义下， **光写 ` inline ` 的函数 **不提供外部定义**** ——它只说"这是一个内联定义，编译器看着办"。只要有一个调用点没能内联（关优化、函数太大、取了函数地址、跨编译单元调用），就会产生一个 **谁都没定义的符号引用** ，链接必失败。

 

上面这条 ` undefined reference to 'pl_sq' ` 就是把 ` -O0 ` 的 ` inl_o0.o ` 单独链接的结果。而且这个错误 **极其隐蔽** ：你的 Release 构建（` -O2 `）可能完全正常，只有 Debug 构建（` -O0 `）或者某个特定的调用点会炸——因为"能不能内联"是优化器的决定，不是语言保证的。

 

顺带一提， **C99 和 GNU89 的语义正好相反** ：GNU89 下 ` inline ` 提供外部定义、` extern inline ` 不提供。` -std=gnu89 ` 和 ` -std=c11 ` 编同一份代码会得到相反的结果——这就是为什么这个坑特别难查。

 

◆ 头文件里该用哪种：只有一种答案

 

| 写法 | 有外部定义？ | 结论 |
| --- | --- | --- |
| **` static inline `** | 有（但为本文件私有，` t `） | **✔ 头文件里唯一正确的选择。** 每个包含它的 ` .c ` 各自得到一份私有副本，不会 ` multiple definition `，也不会未定义。 |
| ` inline ` | **没有** （C99/C11） | **✘ 不要单独用在头文件里。** 除非另有一个 ` .c ` 专门提供 ` extern ` 声明版本——这套"一个 ` inline ` 定义 \+ 一处 ` extern ` 声明"的写法是 C99 设计的本意，但用起来极易出错。 |
| ` extern inline ` | 有 | **✘ 头文件里会 ` multiple definition `。** 每个包含它的编译单元都生成一份外部定义，链接器会发现重复。 |

 

另外记住： **` inline ` 从来都只是"建议"** 。标准里没有任何条款要求编译器必须内联。想让 GCC 更积极，用 ` __attribute__((always_inline)) `（本节的 ` crit.c ` 就在用）；想禁止内联，用 ` __attribute__((noinline)) `——调试时给可疑函数加 ` noinline `，能让断点和调用栈恢复正常，这个技巧值得记住。

 

```zhizhan-anchor
ch2-10-2
```



### 2.10.2 ` register `：一个已经名不副实的关键字

 

**bash**  — ` register ` 剩下的唯一硬性约束

 

```text
$ cat regerr.c
int f(void) { register int cnt = 0; int *p = &cnt; return *p; }
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 -c regerr.c
regerr.c: In function 'f':
regerr.c:1:1: error: address of register variable 'cnt' requested
```

 

` register ` 的原始意图是"建议把变量放在寄存器里"。现代编译器 **完全忽略这个建议** ——它们的寄存器分配器比人聪明得多，加不加 ` register ` 生成的目标代码 **逐字节相同** 。

 

但标准里还留着一条 **硬约束** ： **不能对 ` register ` 变量取地址** ，这是编译期错误（不是警告），因为"寄存器里的东西没有内存地址"在语言层面就不成立。这一条在 C\+\+ 里已被弃用，但在 C 里依然是错误。

 

✔ 什么时候还值得写 ` register `

 

几乎没有。 **唯一还算合理的用法是把它当"意图注释"** ：在一段对时序敏感的代码里给循环计数器加 ` register `，向读代码的人表达"这个变量不该被取地址、不该被 spill"。但更有效的做法是：

 

 
- 想让循环变量进寄存器 →  **让它只在本函数内使用、且不取地址** ，编译器自然会这么做；
 
- 想确认有没有 spill → 看反汇编里有没有 ` str `/` ldr ` 访问栈；
 
- 写 ISR 里对时序敏感的代码 → 直接看反汇编数指令周期，比加关键字可靠得多。

 

```zhizhan-anchor
ch2-10-3
```



### 2.10.3 ` _Thread_local `：裸机上的代价

 

**bash**  — 每次访问 [TLS](term:tls) 变量都是一次函数调用

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn inl.o | sed -n '/<tls_inc>/,/^$/p;/<tls_get>/,/^$/p'
00000024 <tls_inc>:
  24:  push {r3, lr}
  26:  ldr  r0, [pc, #16]
  28:  bl   __emutls_get_address   ← 每次访问都要先问“我的副本在哪”
  2c:  mov  r2, r0
  2e:  ldr  r3, [r0, #0]
  30:  adds r0, r3, #1
  32:  str  r0, [r2, #0]
  34:  pop  {r3, pc}

0000003c <tls_get>:
  3c:  push {r3, lr}
  3e:  ldr  r0, [pc, #8]
  40:  bl   __emutls_get_address
  44:  ldr  r0, [r0, #0]
  46:  pop  {r3, pc}
$ arm-none-eabi-nm -u inl.o
         U __emutls_get_address
```

 

⚠ 裸机上的 ` _Thread_local ` 走的是"模拟 TLS"

 

注意那个函数名里的  **` emutls `（emulated TLS）** 。真正的线程局部存储需要操作系统/运行时在切换线程时换掉一个"线程指针"寄存器，Cortex-M 裸机上没有这种东西，所以 GCC 退回到 **模拟实现** ： **每个 TLS 变量配一份控制结构，每次访问都调用 ` __emutls_get_address() ` 去查"当前上下文对应的副本地址"** 。

 

直接后果有两个：

 

 
- **性能** ：一次 ` tls_counter++ ` 从"3 条指令"变成"一次函数调用 \+ 3 条指令"。放在中断里或热路径上，这个开销是实实在在的。
 
- **可用性** ：` __emutls_get_address ` 由 ` libgcc ` 提供（实测该符号确实在 ` libgcc.a ` 里，是 ` T `）。所以用 ` -nostdlib ` 构建时它会变成未定义符号——和 §2.6、§2.9 是同一类陷阱。
 

 

**那 RTOS 下能用吗？** 可以用，但要分清两件事：` _Thread_local ` 的语义是"每个 **线程** 一份"，而 [FreeRTOS](term:rtos) 的任务（task）不是 POSIX 线程—— **编译器不知道任务切换的存在，切换任务时 ` emutls ` 的当前副本指针不会自动跟着换** 。要在 RTOS 里用真正的任务局部存储，应该用 RTOS 自己提供的机制（FreeRTOS 的 task notification / ` pvTaskGetThreadLocalStoragePointer `），而不是 ` _Thread_local `。 **裸机上基本没有理由用它。**

 

```zhizhan-anchor
ch2-11
```



## 2.11 ESP32 侧：Xtensa 的存储与属性

 

✔ 本节的证据来源说明

 

**本节内容基于 ESP-IDF 官方文档与 Xtensa 架构手册，没有本机实测输出** ——本地工具链只有 Arm GNU Toolchain，没有 Xtensa 版 ` xtensa-esp32-elf-gcc `，因此 **本节不出现任何反汇编清单或"实测"字样** 。前面 §2.6–§2.10 的所有数字、指令、报错文本都来自本机真实编译，这一节的定位是" **把你刚在 STM32 上学到的模型，映射到 ESP32 的名字上** "，具体行为请以你手上的 ESP-IDF 版本实测为准。

 

ESP32 是 **双核 Xtensa LX6** ，它的内存与中断模型和 Cortex-M 有几处根本不同，直接决定了"STM32 上的写法搬到 ESP32 会怎样"。

 

| 能力 | Cortex-M（STM32） | Xtensa（ESP32） |
| --- | --- | --- |
| **屏蔽中断** | ` PRIMASK ` 全关，` BASEPRI ` 按优先级关 | 中断按  **1～7 级** 组织，通过 ` RSIL `（读并设中断级别）/ ` WSR ` 写 ` PS ` 寄存器实现。 **没有 ` PRIMASK `/` BASEPRI ` 这两个名字。** |
| **内存屏障** | ` DMB ` / ` DSB ` / ` ISB ` | **` MEMW `** （memory wait）——一条指令搞定，编译器在 ` __sync_synchronize() ` / ` atomic_thread_fence() ` 处生成它。 |
| **原子读改写** | ` LDREX `/` STREX ` | **` S32C1I `** （compare and swap）——和 M3 的区别是它 **自带一个内存屏障** ，语义更接近"完整的 CAS"。 |
| **临界区 API** | 自己写 ` cpsid i ` / 或用 CMSIS | **` portMUX_TYPE ` \+ ` portENTER_CRITICAL ` / ` portEXIT_CRITICAL `** 。 |

 

```zhizhan-anchor
ch2-11-1
```



### 2.11.1 为什么 ESP32 的临界区要用 ` portMUX `

 

STM32F103 是 **单核** ——关中断就等于获得了互斥。ESP32 是 **双核** ，两个核可以同时跑代码： **你在核 0 上关了中断，核 1 照样在执行它的临界区** 。这就是 ESP-IDF 必须引入 ` portMUX_TYPE ` 的原因：

 

esp\_crit.c C

 

```text
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

/* ESP32 的临界区需要两样东西：
   ① 一个自旋锁 —— 挡住【另一个核】
   ② 关中断     —— 挡住【同一个核上的中断】                       */

/* 必须是静态初始化的全局量，不能放栈上、不能放堆上 */
static portMUX_TYPE s_tick_mux = portMUX_INITIALIZER_UNLOCKED;

volatile int g_tick = 0;

/* 方式一：短临界区。内部做「取自旋锁 + 关中断」，退出时反向恢复 */
int tick_take_isr_safe(void)
{
    int v;
    portENTER_CRITICAL(&s_tick_mux);   /* 自旋锁 + 关中断 */
    v = g_tick;
    g_tick = v + 1;
    portEXIT_CRITICAL(&s_tick_mux);    /* 恢复中断 + 放锁 */
    return v;
}

/* 方式二：如果这段代码【只可能被 ISR 调用】，
   用 ISR 版本，它省掉了自旋锁（ISR 里不能自旋等待） */
int tick_take_from_isr(void)
{
    int v;
    portENTER_CRITICAL_ISR(&s_tick_mux);
    v = g_tick;
    g_tick = v + 1;
    portEXIT_CRITICAL_ISR(&s_tick_mux);
    return v;
}

/* 关键纪律：enter 和 exit 必须用【同一个】portMUX_TYPE，
   而且不能交叉、不能嵌套不同 mux —— 否则死锁 */
```

 

✕ 三个 ESP32 特有的坑

 

 
- **不能用普通 ` volatile int ` 当"锁"。** STM32 上常见的"用 ` volatile ` 标志位做软互斥"在双核上完全失效——两个核可能同时读到"未占用"，然后同时进入。必须用 ` portMUX `（它内部用的是 ` S32C1I `/原子指令）。
 
- **临界区里不能调用可能阻塞的 API。** ` portENTER_CRITICAL ` 期间中断是关的、自旋锁是持有的，此时调用 ` vTaskDelay() `、` malloc() `（非 ` _ISR ` 版）、任何会等信号量的函数，结果是 **死锁** 或断言失败。
 
- **` portMUX_TYPE ` 不能放栈上。** 它必须是一个生命周期覆盖整个临界区的静态变量。放在栈上、或者放在会被 ` free() ` 的堆内存里，另一个核可能在你还在持锁时就把这块内存重用了。

 

```zhizhan-anchor
ch2-11-2
```



### 2.11.2 存储属性：` IRAM_ATTR ` / ` DRAM_ATTR ` / ` EXT_RAM_ATTR `

 

ESP32 的代码默认跑在  **外部 Flash**  上，通过  **cache**  映射到 CPU 的地址空间。这个设计的代价是： **当 Flash 操作（写/擦除）进行时，cache 会被禁用** ——而如果此刻某个中断触发了、它的处理函数还在 Flash 里，CPU 就取不到指令，直接崩溃。这三个属性的存在就是为了把关键代码和数据"钉"在片内 RAM 里。

 

| 属性 | 放到哪里 | 为什么需要它 |
| --- | --- | --- |
| **` IRAM_ATTR `** | 片内指令 RAM | **给中断处理函数用。** Flash 操作期间（` spi_flash_* `）、以及 light sleep 唤醒后的一小段时间里 cache 是关的，只有 IRAM 里的代码能执行。典型写法 ` void IRAM_ATTR gpio_isr(void *arg) `。 |
| **` DRAM_ATTR `** | 片内数据 RAM | **给"cache 关闭期间也要访问"的数据用。** ISR 里读写的全局变量、以及  **DMA 的缓冲区** （见下）都需要它。 |
| **` EXT_RAM_ATTR `** | 外部 [PSRAM](term:psram) | 把大块数据（图像、音频缓冲、大数组）放到片外 PSRAM， **释放宝贵的片内 RAM** 。代价是访问慢、且 **依赖 cache** 。 |

 

⚠ PSRAM 与 DMA：两者根本不能共存

 

这是 ESP32 上最贵的一个认知错误。 **DMA 是硬件直接访问内存，它不经过 CPU 的 cache** 。而 PSRAM（外部 RAM） **只能通过 cache 访问** ——CPU 的地址空间里那个 PSRAM 区域是 cache 映射出来的窗口，DMA 控制器看不到这个窗口。

 

所以： **DMA 缓冲区绝对不能放在 PSRAM 里** 。放在 ` EXT_RAM_ATTR ` 数组上然后交给 ` spi_master `/` i2s ` 做 DMA，轻则数据全错、重则总线异常。 **DMA 缓冲区必须用 ` DRAM_ATTR `、并保证对齐到 cache line（ESP32 上是 32 字节）** ——不对齐的话，即使内存在片内 RAM，cache 的写回也可能把你 DMA 之外的数据一起写坏。

 

同理： **` IRAM_ATTR ` 的函数里调用的所有函数、访问的所有常量，也必须都在 IRAM/DRAM 里** 。这是一个会"传染"的属性——你把 ISR 放进 IRAM 了，但它内部 ` printf ` 了一下，` printf ` 在 Flash 里，照样崩。ESP-IDF 用 ` ESP_INTR_FLAG_IRAM ` 标志配合编译期/运行期检查来兜这件事：

 

```text
/* 声明这个中断处理函数可以在 IRAM 中运行、且 cache 关闭时也能安全执行 */
esp_err_t err = gpio_install_isr_service(ESP_INTR_FLAG_IRAM);
/* 如果 ISR 里用了 IRAM 之外的函数，ESP-IDF 会在此处或运行时给出明确报错，
   而不是让你在 Flash 操作时收到一个静默崩溃 */
```

 

◆ 把 STM32 的直觉搬到 ESP32，要改的只有四条

 

 
1. **关中断不够了** ：双核 → 必须加 ` portMUX `。单核上"关中断即互斥"的直觉会失效。
 
2. **寄存器和内存在哪变得重要** ：STM32 上代码跑在片内 Flash、读写片内 SRAM，没有 cache 概念；ESP32 上有  **Flash cache** ，于是"代码/数据在不在片内 RAM"成了一个必须显式管理的维度。
 
3. **PAS 屏障指令换名字** ：` DMB ` → ` MEMW `；` LDREX `/` STREX ` → ` S32C1I `。 **但抽象层（` _Atomic `、` __sync_* `）会替你选对指令** ——这正是前面几节建议"优先用标准原子操作而不是手写汇编"的另一个理由。
 
4. **DMA 与 cache 的交互必须显式处理** ：STM32F103 没有 D-Cache，DMA 缓冲不需要特殊处理；ESP32 有 cache， **非对齐或放在 PSRAM 的 DMA 缓冲会静默出错** 。

 

◆ 本章要点

 

 
- 编译器 **逐文件独立编译** ，对别的文件一无所知；链接器负责符号解析与地址重定位。
 
- ` static ` 有三种含义：函数内改变 **存储期** ，文件作用域改变 **链接属性** ，函数定义改变 **可见性** 。
 
- **所有仅本文件使用的函数和变量都加 ` static `** ——防污染、助优化、表意图。
 
- 区分 **声明** （可多次）与 **定义** （唯一）。头文件里放 ` extern ` 声明，绝不放定义。
 
- ` volatile ` 阻止编译器 **删除、合并、提升、重排** 对目标对象的访问。它是与编译器的契约。
 
- ` volatile `  **不保证原子性、不保证屏障、不解决缓存一致性** 。它只管编译器。
 
- C 里的 ` const `  **不是编译期常量** 。它默认落 Flash、并不吃 SRAM，但 **不能当数组长度、` case ` 标签或位域宽度** ；小常量请用 ` #define `/` enum `。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 简答：` static ` 的"三重身份"分别是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① 函数内的 ` static ` 变量： **静态存储期** （函数返回后值仍在）；② 文件级的 ` static ` 函数/变量： **内部链接** （其他 .c 看不见）；③ 只初始化一次。"}
   ```
 
2. 找错：在头文件里写 ` static int x; ` 会有什么后果？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"每个 ` #include ` 它的 .c 都会生成 **一份独立的 ` x ` 副本** ——既浪费 RAM，又让\"改一处、别处不变\"，是极隐蔽的 bug。需要共享就用 ` extern ` 声明 \\+ 某一处定义。"}
   ```
 
3. 判断：` extern int x; ` 是暂定定义（tentative definition）吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**不是** 。C11 6.9.2p2 明确把 ` extern ` 声明排除在暂定定义之外；` int x; `（不带 extern、文件作用域）才是暂定定义。"}
   ```
 
4. 简答：ISR 与主循环共享一个 ` volatile uint8_t flag `，只加 ` volatile ` 够吗？换成 ` uint32_t ` 呢？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"单字节读写天然原子，加 ` volatile ` 通常够；但 **读-改-写** （` flag |= 1 `）或 **多字节量** （` uint32_t ` 在 M0 上、或 64 位量在任何 32 位核上）仍会被中断打断，必须配 **临界区** （` __disable_irq ` / ` PRIMASK `/` BASEPRI `）或使用 C11 ` _Atomic `。"}
   ```
 
5. 简答：` __attribute__((weak)) ` 最经典的两个用途是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① 启动文件里给每个中断一个\"弱默认实现\"，用户写同名强符号就 **覆盖** 它（不改启动文件即可接管中断）；② 库提供可被上层覆盖的默认函数（HAL 的回调就是这么做的）。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  强烈建议亲手编译 ` volatile_demo.c ` 并对比反汇编。

 

```zhizhan-assessment
{"id":"course-b01-ch2","criterion":"用 nm 与两个翻译单元验证 static/extern；解释生命期、作用域、链接属性的区别。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 N1570 · 对象、类型与语言语义](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) · [GNU ld · SECTIONS、MEMORY、符号与链接](https://sourceware.org/binutils/docs/ld/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
