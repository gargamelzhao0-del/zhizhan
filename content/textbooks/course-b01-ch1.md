# 数据在内存中长什么样

```zhizhan-anchor
ch1
```



变量不是一个抽象名字，而是 **一段有长度、有字节序、有对齐要求的比特** 。 这一章要建立的直觉是：看到任何一个变量声明，脑子里能立刻浮现出它在 SRAM 里的字节排布图。

 

> ◷ 约 75 分钟 · ◈ 本册最基础的一章 · ⚑ 内存模型

 

```zhizhan-anchor
ch1-1
```



## 1.1 从位到地址：基本单位

 

嵌入式世界里，所有数据最终都是电平和比特。C 语言给你的是对这些比特的分组和解释方式：

 

| 单位 | 位数 | 嵌入式语境下的含义 |
| --- | --- | --- |
| **bit** | 1 | 一根线上的高低电平。GPIO 的输入输出寄存器每一位对应一个引脚。 |
| **byte** | 8 | ` char `。 **C 标准规定 ` sizeof(char) == 1 `，而"1 字节"至少 8 位** ——在几乎所有实际平台上就是 8 位。 |
| **half word** | 16 | ` uint16_t `。Cortex-M 支持半字对齐访问。 |
| **word** | 32 | ` uint32_t `。 *注意：ARM 语境下 "word" = 32 位，不是 x86 语境的 16 位* 。Cortex-M 的通用寄存器是 32 位。 |

 

⚠ 别死记"C 的 int 是 4 字节"

 

C 标准 **没有规定 ` int ` 的字节数** ，只规定它至少能表示 −32767 ~ 32767。 在 Cortex-M 和 x86-64 上 ` int ` 是 4 字节，但在某些 8 位/16 位 MCU 上可能是 2 字节。  **嵌入式代码必须用 ` <stdint.h> ` 的定长类型** （` uint8_t ` / ` int32_t `）， 而不是裸的 ` int ` / ` long `。这是可移植代码的第一条纪律。

 

```zhizhan-anchor
ch1-1-1
```



### 1.1.1 sizeof 的真实返回值

 

Cortex-M（ILP32 模型）与 x86-64（LP64 模型）的对照：

 

| 类型 | Cortex-M | x86-64 | 说明 |
| --- | --- | --- | --- |
| ` char ` | 1 | 1 | 标准保证为 1 |
| ` short ` | 2 | 2 | 至少 16 位 |
| ` int ` | 4 | 4 | 通常等于机器字长 |
| ` long ` | 4 | 8 | **⚠ 差异点！** 跨平台代码的经典坑 |
| ` long long ` | 8 | 8 | 至少 64 位 |
| ` void * ` | 4 | 8 | **⚠ 指针宽度不同** ，决定了 ` int ` 能否存指针 |
| ` float ` | 4 | 4 | IEEE 754 单精度 |
| ` double ` | 8 | 8 | Cortex-M4F 可选单精度 FPU，双精度靠软件模拟（很慢） |

 

✕ 经典事故：把指针塞进 int

 

下面这段代码在 32 位 MCU 上工作正常，迁到 64 位 Linux 上必崩：

 

bad\_cast.c C

 

```text
#include <stdint.h>   /* uintptr_t 在这里 */
#include <stdlib.h>   /* malloc / free 在这里 */

/* ---------- ✕ 反面教材：把指针塞进 int ---------- */
void f_bad(void)
{
    void *p = malloc(16);
    int   v = (int)p;          /* ✕ 32 位平台侥幸能过，64 位平台截断高 32 位 */
    void *q = (void *)v;       /* ✕ q 已损坏，解引用 → 段错误 */

    free(p);
    (void)q;                   /* 这里只是演示类型转换，不真去解引用 */
}

/* ---------- ✔ 正确写法：用 uintptr_t ----------
   uintptr_t 是"能装下指针的无符号整数"，标准保证它够宽。
   它的宽度随平台变化（32 位 MCU 上就是 32 位），你不需要关心具体是几位。 */
void f_good(void)
{
    void *p = malloc(16);
    if (!p) {
        return;                /* 嵌入式里 malloc 失败是常态，必须判空 */
    }

    uintptr_t u = (uintptr_t)p;
    void     *q = (void *)u;   /* ✔ 往返转换无损：q == p 恒成立 */

    free(q);
}
```

 

```zhizhan-anchor
ch1-2
```



## 1.2 整数怎么表示：补码的必然性

 

计算机只会存 0 和 1，那负数怎么办？历史上试过三种方案，最终 **只有补码（Two's Complement）活了下来** 。 理解为什么，比记住"取反加一"重要得多。

 

```zhizhan-anchor
ch1-2-1
```



### 1.2.1 三种方案对比（以 8 位、表示 −5 为例）

 

**FIG 1.1**  三种负数编码方案的对比

 

原码

 

1



0



0



0

 

0



1



0



1

 

符号位\+数值

 

反码

 

1



1



1



1

 

1



0



1



0

 

按位取反

 

补码 ✓

 

1



1



1



1

 

1



0



1



1

 

反码 \+ 1

 

位权

 

−128 × b7 \+ 64 × b6 \+ 32 × b5 \+ 16 × b4 \+ 8 × b3 \+ 4 × b2 \+ 2 × b1 \+ 1 × b0

 

**原码** 的问题：` +0 ` 和 ` −0 ` 是两个不同的位模式，减法电路还得单独设计。  **反码** 的问题：同样有 ±0，且需要循环进位。  **补码** 的杀手锏： *减法可以直接用加法电路完成* —— ` a − b == a + (~b + 1) `，硬件只需一个加法器。而且 0 只有唯一表示（全 0）。

 

```zhizhan-anchor
ch1-2-2
```



### 1.2.2 补码的三个关键性质

 

 
- **最高位是符号位，但权重是 −2(n−1)，不是 −1** 。这是理解补码的核心。8 位时最高位代表 −128。
 
- **表示范围不对称** ：8 位是 −128 ~ \+127。 *负数比正数多一个* 。所以 ` abs(INT_MIN) ` 是未定义行为——它没有对应的正数。
 
- **符号扩展规则** ：小类型转大类型时， *把最高位复制到所有新增的高位* 。这保证了数值不变。
 

 

sign\_extend.c — 亲手验证补码行为 C

 

```text
#include <stdio.h>
#include <stdint.h>

int main(void)
{
    int8_t  a = -5;                 /* 内存: 0xFB */
    int16_t b = a;                  /* 符号扩展: 0xFFFB */
    int32_t c = a;                  /* 符号扩展: 0xFFFFFFFB */

    /* ⚠ 注意这里为什么转成 (unsigned) 而不是 (uint8_t)：
       可变参数会做"默认实参提升" —— uint8_t/uint16_t 传给 printf 时
       先被提升成 int（有符号！），而 %X 要求的实参类型是 unsigned int。
       类型对不上是标准明说的未定义行为，实测常见后果是负值被打印成
       8 位十六进制补码（如 0xFFFFFFFB），看起来"格式串写错了"。
       正确做法：先截断成目标宽度，再显式转成 (unsigned)。
       编译器帮不上忙：-Wformat 只能看到 int，看不到你本意是 uint8_t。 */
    printf("a = 0x%02X\n", (unsigned)(uint8_t)a);
    printf("b = 0x%04X\n", (unsigned)(uint16_t)b);
    printf("c = 0x%08X\n", (unsigned)(uint32_t)c);

    /* 补码陷阱：INT_MIN 取反 */
    int32_t min = INT32_MIN;        /* -2147483648 */
    printf("min     = %d\n", min);
    printf("-min    = %d   ← 溢出！未定义行为，实际仍是负数\n", -min);
    /* 编译器在 -O2 下可能假设 -min > 0 而优化掉某些分支 */

    /* 正确做法：先转无符号再取负 */
    uint32_t safe = (uint32_t)(-(int64_t)min);
    printf("safe    = %u\n", safe);

    /* 无符号回绕是良定义（有符号溢出才是 UB） */
    uint8_t u = 250;
    u += 10;                        /* 260 mod 256 = 4，标准保证 */
    printf("u       = %u\n", u);
    return 0;
}
```

 

**输出**

 

```text
a = 0xFB
b = 0xFFFB          ← 高位全部补 1
c = 0xFFFFFFFB
min     = -2147483648
-min    = -2147483648   ← 注意！没有变成正数
safe    = 2147483648
u       = 4
```

 

✕ 有符号溢出是未定义行为（UB），不是"回绕"

 

很多教材说"有符号溢出会回绕"，这是 **错的** 。C 标准明确规定有符号整数溢出是  *undefined behavior* 。 这意味着编译器可以在溢出发生时做 **任何事** ——包括假设它永不发生，从而删掉你的判断分支。 而无符号溢出是 **明确定义的模运算** ，可以放心依赖。   
  
 实践建议：需要回绕语义时， **显式使用无符号类型** ；需要中间计算时， **提升到更宽的整型** 。

 

⚠ 上面这段在 PC 上编得过，交叉编译到 Cortex-M 会冒出一串 ` -Wformat= `

 

同一个 ` printf("%d", min) `，其中 ` min ` 是 ` int32_t `： GCC 编 PC 版一声不吭，` arm-none-eabi-gcc ` 却会警告  *"format '%d' expects argument of type 'int', but argument 2 has type 'long int'"* 。  **代码一个字没改，警告却凭空出现** ——这不是你的错，是两边的 ABI 不一样。

 

亲手查一下，只需一条命令（` -dM -E ` 把编译器预定义宏全部打印出来）：

 

` echo | arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -dM -E - | grep INT32_TYPE `   
 ` #define __INT32_TYPE__ long int ` ← 在 ARM 上，` int32_t `  **就是 ` long int `**    
 ` #define __UINT32_TYPE__ long unsigned int `

 

**为什么两边不一样？** 因为 ` int32_t ` 不是某个固定类型，而是一句 "给我一个正好 32 位的整型"的要求，编译器自己挑：

 

 
- **x86-64（PC）** ：` long ` 是  **64 位** ，塞不进 32 位， 于是 ` int32_t ` 只能取 ` int ` → ` %d ` 正确。
 
- **ARM EABI（Cortex-M）** ：` long ` 是  **32 位** ， 于是 GCC 选了 ` long int ` → ` %d ` 类型对不上。
 

 

**注意别过度惊慌** ：两边都能跑出正确结果（32 位就是 32 位，传参寄存器也兼容）， 所以这是个" *形式上是 UB、实践中碰巧能过* "的问题。但 ` -Wformat ` 是实打实的类型检查， 它指出的分歧在 64 位 MCU（如 Cortex-A 的 LP64）上会变成 **真的算错** 。 想在 PC 和板子上用同一份代码，就得认真对待。

 

**只有 32 位类型中招。** ` int8_t ` / ` int16_t ` 会先 *整型提升* 成 ` int `，所以 ` %d ` 配 ` int8_t ` 完全没问题； ` int32_t ` / ` uint32_t ` 因为已经是 32 位，提升前后不变，才会暴露 ABI 差异。

 

GCC 的措辞很贴心，它直接把真实类型写出来了： ` 'int32_t' {aka 'long int'} `——  *aka*  就是"又名"，等于替你做完了上面那条命令。

 

**三种写法，按场景选：**

 

 
1. **直接用 ` %d ` / ` %X `，不管警告** ——上面的 ` sign_extend.c `，以及后面 1.3 的 ` float_bits.c `、 1.4 的 ` endian.c `、3.x 的 ` ptr_arith.c ` 都是这么写的。理由：它们 **只在 PC 上跑** ，而 PC 上 ` int32_t ` 恰好就是 ` int `，类型完全正确、输出好看、读者一眼能对上位模式。 代价是 *交叉编译时会冒警告* ——本书的编译门禁全站共记录到 4 个块报 ` -Wformat= `， 其中 3 个就在本章（` sign_extend.c ` / ` float_bits.c ` / ` endian.c `），第 4 个是 3.x 的 ` ptr_arith.c `。 知道它为什么响，比盲目消掉它重要。
 
2. **改用 ` %ld ` / ` %08lX `** ——在 ARM 上类型完全正确。 8.x 那几章写的是 **要烧进板子的固件** ，所以走的就是这条路，是合理选择。 但它把平台差异刻进了格式串：搬到 PC 上又反过来了。
 
3. **` PRId32 `（两边都要编时用这个）** ——` <inttypes.h> ` 为每个定长类型都提供了配套的格式宏，由编译器按当前平台展开成正确的那一个。 它靠 **字符串字面量拼接** 拼进格式串（` %"PRId32" ` 连写会当普通文本，必须分开）：   
    ` printf("n = %" PRId32 "\n", x); `   
    常用的还有 ` PRIu32 `（无符号十进制）、` PRIX32 `（大写十六进制）、 ` PRId64 `（64 位）。 **凡是 PC 与板子共用同一份源码的代码，一律用这套宏** —— 比如你自己写的、要跑单元测试又要烧进固件的中间层。
 

 

**一句话记法** ：只在一个平台上编 → 用那个平台顺手的写法（PC 用 ` %d `、 ARM 用 ` %l ` 系列）；两个平台都要编 → ` PRId32 `。  *真正要避免的是第三种情况：在 ARM 上写了 ` %d ` 却以为它和 PC 一样对。*

 

```zhizhan-anchor
ch1-2-3
```



### 1.2.3 整数提升：比 ` int ` 窄的类型必须先「长大」

 

前面讲的是「一个变量在内存里怎么摆」。现在换个角度： **当你把它取出来做运算，它还是它自己吗？**  答案是不一定。C 语言规定，参与运算的类型要先经过 **两级转换** ，而这两级转换里藏着嵌入式 C 最密集的一批 bug。 它们也是「数据在内存中」这件事最容易咬人的地方——因为你写的是 8 位变量，机器算的却是 32 位。

 

**FIG 1.5**  运算前的两级类型转换：先各自「长大」，再统一到同一类型

 

第一级

 

整数提升 · 两侧各自独立发生

 

秩低于 ` int ` 的整型（` char ` / ` short ` / 位域 / 枚举 / ` bool `） 先各自变成 ` int `， *与对面的类型无关* 。

 

第二级

 

常规算术转换 · 两侧协商

 

两边都已经是 ` int ` 或更宽了，再按 **等级从低到高** 统一： 窄的向宽的看齐；等级相同时，无符号的那个获胜。

 

**结果类型只由这两步决定，与「你以为在算什么」无关。**  所以 ` uint8_t ` 减法的结果是 ` int `； ` int8_t ` 与 ` uint8_t ` 比较会在 ` int ` 上比（都是正数，安全）； 而 ` int32_t ` 与 ` uint32_t ` 比较会统一成 **无符号** （负数变巨大，危险）。

 

两级是 **顺序** 关系：先提升，后统一。跳过第一级直接理解第二级，是绝大多数误判的来源。

 

#### 第一级：整数提升 —— 因为机器只有 32 位算术单元

 

先把第一级的规则原样抄下来： **凡是秩低于 ` int ` 的整型，只要参与运算，就先被转换成 ` int `** 。 注意是 ` int `，不是 ` unsigned int `—— *即使原来那个变量是无符号的 ` uint8_t `* 。 只要 ` int ` 装得下它的全部取值（对 8 位、16 位类型恒成立），提升目标就是有符号的 ` int `。

 

promote\_demo.c — 提升与转换的四个直接观测点 C

 

```text
#include <stdio.h>
#include <stdint.h>

int main(void)
{
    uint8_t a = 0, b = 200;

    /* ① 提升看得见：sizeof 告诉你运算发生在几字节上 */
    printf("sizeof((uint8_t)0 + (uint8_t)0) = %zu\n", sizeof((uint8_t)0 + (uint8_t)0));
    printf("sizeof(+(uint8_t)0)             = %zu\n", sizeof(+(uint8_t)0));

    /* ② 取反发生在 int 上，不是 uint8_t 上 */
    printf("~(uint8_t)0                     = 0x%08X\n", (unsigned)~(uint8_t)0);
    printf("(uint8_t)~0u                    = 0x%02X\n", (unsigned)(uint8_t)~0u);

    /* ③ 减法在 32 位上算完，只有【赋值或强制转换】才截断 */
    printf("(uint8_t)(0 - 200)              = %u\n", (unsigned)(uint8_t)(a - b));

    /* ④ 类型不同时按等级统一：窄的先变 int，宽的无符号会把有符号"拉过去" */
    int8_t   s8  = -1;
    uint8_t  u8  = 1;
    int32_t  s32 = -1;
    uint32_t u32 = 1;
    printf("-1(int8_t)  < 1(uint8_t)        = %d\n", s8 < u8);
    printf("-1(int32_t) < 1(uint32_t)       = %d\n", s32 < u32);
    return 0;
}
```

 

**输出（x86-64 / MSVC，实测）**

 

```text
sizeof((uint8_t)0 + (uint8_t)0) = 4
sizeof(+(uint8_t)0)             = 4
~(uint8_t)0                     = 0xFFFFFFFF
(uint8_t)~0u                    = 0xFF
(uint8_t)(0 - 200)              = 56
-1(int8_t)  < 1(uint8_t)        = 1
-1(int32_t) < 1(uint32_t)       = 0
```

 

这份输出里有四个结论，每一个都值得单独记住

 

 
1. **` sizeof((uint8_t)0 + (uint8_t)0) ` 是 4，不是 1。**  两个 8 位值相加，结果的类型是 ` int `。同理 ` sizeof(+(uint8_t)0) ` 也是 4—— 连 *一元加号* 这种「什么都不做」的运算符都会触发提升。  **只要 ` uint8_t ` 出现在表达式里，它就已经不是 8 位了。**
 
2. **` ~(uint8_t)0 ` 是 ` 0xFFFFFFFF `。**  取反的对象是「被提升成 ` int ` 的 0」，不是「` uint8_t ` 的 0」。 想要 ` 0xFF `，必须先算完再收窄：` (uint8_t)~0u `。  *顺序永远是「先提升 → 参与运算 → 最后收窄」，收窄发生在最后一步。*
 
3. **` (uint8_t)(0 - 200) ` 是 56。**  ` 0 - 200 ` 在 32 位上有符号地算出 ` -200 `（` 0xFFFFFF38 `）， 强制转换只保留最低字节 ` 0x38 = 56 `。  **中间结果不会「自动回绕」到 8 位** ——回绕只发生在你显式写下的那次转换或赋值。
 
4. **` int8_t ` 和 ` uint8_t ` 比较是安全的，` int32_t ` 和 ` uint32_t ` 比较是危险的。**  这正是第一级和第二级的区别：前一对的两个操作数 **都已经变成了 ` int `** ， 在同一个有符号类型上比，` -1 < 1 ` 当然成立； 后一对的两个操作数本身就是 32 位， *不会再提升* ，于是进入第二级—— 按「同宽时无符号胜出」统一成 ` uint32_t `，` -1 ` 的位模式 ` 0xFFFFFFFF ` 变成了 42 亿多， 于是 ` -1 < 1 ` 输出 ` 0 `。  **同一个数学式，因为操作数宽度不同，一个对、一个错。**

 

为什么标准要这么规定？不是想为难你，而是因为 **机器的算术单元本来就只有 ` int ` 那么宽** 。Cortex-M 是 32 位内核，ALU 只能做 32 位加减； 要算两个 ` uint8_t `，CPU 的做法天生就是「先零扩展进 32 位寄存器 → 做 32 位减法 → 需要时再截回 8 位」。 标准只是把这件已经发生的事 *写了下来* 。汇编里能直接看到这一点：

 

promote\_asm.c — 同一个减法，只差一个强制转换 C

 

```text
#include <stdint.h>

/* 运算在 int 上完成，返回值才收窄 */
int32_t keep(uint8_t a, uint8_t b) { return (uint32_t)(a - b); }
uint8_t cut (uint8_t a, uint8_t b) { return (uint8_t)(a - b); }
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O1 -c promote\_asm.c

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O1 -c promote_asm.c
$ arm-none-eabi-objdump -d promote_asm.o
00000000 <keep>:
   0:	subs	r0, r0, r1
   2:	bx	lr

00000004 <cut>:
   4:	subs	r0, r0, r1
   6:	uxtb	r0, r0
   8:	bx	lr
```

 

` uxtb ` 就是「整数提升」的物证

 

两条函数的减法部分 **一模一样** ：都是 ` subs r0, r0, r1 ` 这一条 32 位减法。 差别只在收尾：` cut() ` 多了一条 ` uxtb r0, r0 `（ *unsigned extend byte* ，把 r0 的高 24 位清零、只留低 8 位）。

 

这说明什么？说明 **减法本身从未以 8 位进行过** 。 编译器先把两个参数当成 32 位做减法， *然后* 因为返回类型是 ` uint8_t ` 才补一条掩码。 「提升」不是一个抽象的语法概念，它在你的固件里 **占用真实的指令槽和真实的周期** 。   
  
 顺带解开一个常见困惑：为什么 ` keep() ` 里写了 ` (uint32_t) ` 却没有任何指令？ 因为在 Cortex-M 上 ` int ` 和 ` uint32_t ` 宽度相同、寄存器也相同， 这次转换是 **纯类型层面** 的，编译器无事可做。（函数名 ` keep ` 也是这个意思：  *keep all 32 bits* ——把 32 位全留着。）

 

#### 第二级：常规算术转换 —— 谁把谁「拉过去」

 

两个操作数各自提升完之后，如果类型仍然不同，就进入第二级。规则可以压成一句话：  **朝「等级更高」的类型看齐；等级相同时，无符号的那个获胜。**

 

```zhizhan-table
{"rows":[[{"body":"等级","header":true,"rowSpan":1,"colSpan":1},{"body":"类型","header":true,"rowSpan":1,"colSpan":1},{"body":"统一到","header":true,"rowSpan":1,"colSpan":1},{"body":"嵌入式注意点","header":true,"rowSpan":1,"colSpan":1}],[{"body":"最低","header":false,"rowSpan":1,"colSpan":1},{"body":"` bool ` / ` char ` / ` short ` / 位域 / 枚举","header":false,"rowSpan":1,"colSpan":1},{"body":"` int `","header":false,"rowSpan":1,"colSpan":1},{"body":"一级提升：一律变成 **有符号**  ` int `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"↓","header":false,"rowSpan":1,"colSpan":1},{"body":"` int ` / ` unsigned int `","header":false,"rowSpan":1,"colSpan":1},{"body":"看对面","header":false,"rowSpan":1,"colSpan":1},{"body":"32 位 MCU 上就是 ` int32_t ` / ` uint32_t `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"↓","header":false,"rowSpan":1,"colSpan":1},{"body":"` long ` / ` unsigned long `","header":false,"rowSpan":1,"colSpan":1},{"body":"看对面","header":false,"rowSpan":1,"colSpan":1},{"body":"ARM 上 ` long ` 只有 32 位，与 ` int ` 同宽同等级","header":false,"rowSpan":1,"colSpan":1}],[{"body":"↓","header":false,"rowSpan":1,"colSpan":1},{"body":"` long long ` / ` unsigned long long `","header":false,"rowSpan":1,"colSpan":1},{"body":"—","header":false,"rowSpan":1,"colSpan":1},{"body":"64 位；ARM 上做 64 位运算要用成对指令，性能要付代价","header":false,"rowSpan":1,"colSpan":1}],[{"body":"最高","header":false,"rowSpan":1,"colSpan":1},{"body":"` float ` → ` double ` → ` long double `","header":false,"rowSpan":1,"colSpan":1},{"body":"—","header":false,"rowSpan":1,"colSpan":1},{"body":"整型与浮点混合时先把整型转成浮点（见 1.3.4 的 ` -Wdouble-promotion `）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**等级相同时**","header":false,"rowSpan":1,"colSpan":2},{"body":"**无符号胜出**","header":false,"rowSpan":1,"colSpan":1},{"body":"这是唯一会「凭空造出巨大正数」的规则","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

把「同宽时无符号胜出」这条规则单独拎出来，就是嵌入式里最经典的一个陷阱。 下面两个函数语义完全相同——都想知道「` a ` 是否小于 ` b `」：

 

safe\_cmp.c — 同一个语义，两种类型搭配 C

 

```text
#include <stdint.h>

/* 危险：int32_t 与 uint32_t 混比，有符号那侧被"拉"成无符号 */
int bad(int32_t a, uint32_t b)  { return a < b; }

/* 安全：两侧都提到足够宽的有符号类型 */
int good(int32_t a, uint32_t b) { return (int64_t)a < (int64_t)b; }
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -c safe\_cmp.c

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -c safe_cmp.c
safe_cmp.c:4:44: warning: comparison of integer expressions of different signedness:
  'int32_t' {aka 'long int'} and 'uint32_t' {aka 'long unsigned int'} [-Wsign-compare]
$ arm-none-eabi-objdump -d safe_cmp.o
00000000 <bad>:
   0:	cmp	r0, r1
   2:	ite	cs          @ cs = carry set = 无符号的「大于等于」
   4:	movcs	r0, #0
   6:	movcc	r0, #1
   8:	bx	lr

0000000c <good>:
   c:	asrs	r3, r0, #31  @ 取出 a 的符号位，充当 64 位比较的高位
   e:	cmp	r0, r1
  10:	sbcs.w	r3, r3, #0   @ 带借位的 64 位比较
  14:	ite	lt           @ lt = 有符号的「小于」
  16:	movlt	r0, #1
  18:	movge	r0, #0
  1a:	bx	lr
```

 

✕ ` bad() ` 里的 ` cs ` 和 ` good() ` 里的 ` lt `，是两种完全不同的数学

 

` bad() ` 用的是 ` cs `（ *carry set* ），即 **无符号比较** ： 它把 ` a ` 与 ` b ` 的位模式当成两个 0…4294967295 的数来比。 调用 ` bad(-1, 1) `，实际比较的是 ` 4294967295 < 1 `，结果是  **0（假）** 。

 

` good() ` 用的是 ` lt `，即 **有符号比较** ， 并且老老实实把两个数都扩到 64 位（` asrs ` 取符号位 \+ ` sbcs ` 处理高位）。 同样调用 ` good(-1, 1) `，得到  **1（真）** 。

 

**代价是 2 条指令** （4 条对 2 条，实际循环里还会被摊薄）。 这就是「正确性」在嵌入式里的标价：一个字宽的类型选择，或者一次显式的宽化转换。  *当 ` b ` 的取值范围你 **确知** 不会超过 ` INT32_MAX `（比如它来自一个 12 位 ADC）， ` bad() ` 的写法是安全的、而且更快——但这个「确知」必须写进注释， 因为它是一个前提，不是一个事实。*

 

✕ ` for (uint8_t i = 0; i < 256; i++) ` 是一个死循环

 

这个写法在教科书里极常见，也是提升规则最著名的一个后果。 ` i ` 被提升成 ` int ` 参与比较， 而 ` uint8_t ` 的值域是 0…255， **` i < 256 ` 永远为真** 。 即使 ` i ` 回绕到 0，比较结果也没变。GCC 完全能看穿：

 

loop256.c — 两种计数器宽度的实测对比 C

 

```text
#include <stdint.h>

int never_ends(void)
{
    int total = 0;
    for (uint8_t i = 0; i < 256; i++) total += i;   /* i 被提升成 int，永远 < 256 */
    return total;
}

int fine(void)
{
    int total = 0;
    for (uint16_t i = 0; i < 256; i++) total += i;  /* uint16_t 提升成 int，上限 65535，能退出 */
    return total;
}
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -c loop256.c

 

```text
loop256.c:6:27: warning: comparison is always true due to limited range of data type
  [-Wtype-limits]
$ arm-none-eabi-objdump -d loop256.o
00000000 <never_ends>:
   0:	b.n	0 <never_ends>  @ 编译器证明它退不出：自己跳自己
   2:	nop

00000004 <fine>:
   4:	mov.w	r0, #32640	 @ 0x7f80 = 0+1+…+255，整个循环折成一个常数
   8:	bx	lr
```

 

` never_ends() ` 被编成 **一条跳回自己的指令** —— 这不是「优化得不好」，而是编译器在编译期就 *证明了* 这个循环没有出口，于是诚实地生成一个无限循环。 而 ` fine() ` 直接算出 ` 0+1+…+255 = 32640 ` 放进返回寄存器，整个循环消失了。   
  
  **修正写法** ：计数器用 ` int ` 或 ` uint16_t `； 如果确实需要用 8 位计数器遍历 0…255，写成 ` for (unsigned i = 0; i <= 255u; i++) { uint8_t c = (uint8_t)i; … } `， 或者用 ` do { … } while (++i); `。  *凡是和字面量 ` 256 ` 比较的 8 位计数器，都是可疑的。*

 

⚠ 两个关于 ` -Wsign-compare ` 的实务提醒

 

**第一，这个警告只在混合符号比较时出现，而它恰好是最该打开的一类警告。**  ` -Wall -Wextra ` 里已经包含它。上面 ` safe_cmp.c ` 和 ` promote_demo.c ` 都被它抓了出来——注意 ` promote_demo.c ` 在 PC 上编是 **一声不吭** 的， 同一份代码交叉编译到 Cortex-M 才冒出来，位置是 ` promote_demo.c:25:58 `。 这又是 1.2.2 那个 ABI 差异的另一种表现：ARM 上 ` int32_t ` 就是 ` long int `、 ` uint32_t ` 就是 ` long unsigned int `， 于是「两个 32 位类型混比」被 GCC 判定为符号不匹配。

 

**第二，别用强制转换去消掉这个警告。**  ` (uint32_t)a < b ` 能让警告闭嘴，但语义 **一点没变** —— 它本来就是被转成无符号的。警告说的是「你的意图可能不是这个」，而不是「这里有个语法错误」。 正确做法只有两条： *确认取值范围后写注释说明* ，或者 *显式宽化到 ` int64_t ` 并接受那 2 条指令* 。

 

本节最小结论（记住这三句）

 

 
- **写出 ` uint8_t `，机器算的是 ` int `。**  窄类型只决定 *存储* 宽度，不决定 *运算* 宽度。
 
- **截断永远在最后一步。** 先提升、再运算、最后才按目标类型收窄。中间结果不会自动回绕。
 
- **` int8_t ` 混 ` uint8_t ` 安全，` int32_t ` 混 ` uint32_t ` 危险。**  区别就在于前者会双双提升成 ` int `，后者不会。 调试这类问题最可靠的手段是 ` -Wconversion ` 配 ` -Wsign-compare `： 前者点出每一次隐式窄化，后者点出每一次符号混比。

 

```zhizhan-anchor
ch1-2-4
```



### 1.2.4 ` char ` 的符号性是实现定义的

 

标准里有一句很不起眼的话： **普通 ` char ` 究竟等价于 ` signed char ` 还是 ` unsigned char `，由实现自行决定**  （C11 §6.2.5p15）。注意这三者是 **三个不同的类型** ， 只是 ` char ` 的取值行为必须和其中某一个一样。 这条规则在 PC 和 MCU 上恰好落在两边——于是同一份代码搬一次家，行为就变了。

 

char\_sign.c — 让编译器自己交代 C

 

```text
#include <stdio.h>

int main(void)
{
#ifdef __CHAR_UNSIGNED__
    printf("__CHAR_UNSIGNED__ is defined  -> char is UNSIGNED\n");
#else
    printf("__CHAR_UNSIGNED__ is NOT defined -> char is SIGNED\n");
#endif
    printf("(char)0xFF == -1    = %d\n", (char)0xFF == -1);
    printf("(char)0xFF <  0     = %d\n", (char)0xFF < 0);
    printf("(int)(char)0xFF     = %d\n", (int)(char)0xFF);
    printf("(unsigned char)0xFF = %u\n", (unsigned)(unsigned char)0xFF);
    return 0;
}
```

 

` __CHAR_UNSIGNED__ ` 不是标准宏，而是 GCC 约定用来报告这个选择的预定义宏。 它比任何文档都可靠，因为它就是编译器当前的立场。两边实测结果：

 

| 检查项 | STM32 / arm-none-eabi-gcc | x86-64 / MSVC |
| --- | --- | --- |
| ` __CHAR_UNSIGNED__ ` | 已定义（` #define __CHAR_UNSIGNED__ 1 `） | 未定义 |
| ` char ` 的实际符号性 | **无符号** （0…255） | **有符号** （−128…127） |
| ` (char)0xFF == -1 ` | **0** （假） | **1** （真） |
| ` (char)0xFF < 0 ` | **0** （假） | **1** （真） |
| ` (int)(char)0xFF ` | **255** | **−1** |
| ` (unsigned char)0xFF ` | 255 | 255 |

 

x86-64 侧是实测输出；ARM 侧不是「跑出来」的，而是从编译器自己的预定义宏读出来的—— 在无法上板的环境里，这是最硬的证据来源：

 

**bash**  — 直接问编译器：char 到底有没有符号

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -dM -E - </dev/null | grep CHAR_UNSIGNED
#define __CHAR_UNSIGNED__ 1

$ gcc -o chk chk.c && ./chk     # 同一份源码在 PC 上（char 有符号）
-1
```

 

汇编层面看得更绝对。ARM 上因为 ` char ` 本来就是无符号的， ` (int)c ` 和 ` (int)(unsigned char)c ` 编出来 **完全相同** —— 两条 ` bx lr `，什么都不用做：

 

**bash**  — ARM 上 (int)c 与 (int)(unsigned char)c 没有区别

 

```text
// csch.c
int widen(char c)       { return (int)c; }   // 需要符号扩展吗？
int widen_u8(uint8_t c) { return (int)c; }   // 需要零扩展吗？

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c csch.c
$ arm-none-eabi-objdump -d csch.o
00000018 <widen>:
  18:	bx	lr        @ 空函数：传参时调用方已按 ABI 零扩展过
  1a:	nop

0000001c <widen_u8>:
  1c:	bx	lr        @ 一模一样
  1e:	nop
```

 

这个「空函数」值得多想一秒：它同时证明了两件事。  **其一** ，` char ` 在 ARM 上确实是无符号的，所以 ` (int)c ` 就是零扩展，而零扩展不需要指令。  **其二** ，AAPCS 规定调用方在传 ` char ` 参数时 *已经* 按该类型的符号性把它扩展到了 32 位寄存器—— 所以被调用方什么都不用做。反过来，如果 ` char ` 是有符号的，这里就必须有一条 ` sxtb `（x86 上是 ` movsx `）。 *有没有那条指令，就是符号性的直接体现。*

 

✓ 工程铁律：协议数据、缓冲区里的字节，一律用 ` uint8_t `

 

既然 ` char ` 的符号性不可移植，那凡是「这个字节代表数据」的地方就都不该用 ` char `。 具体到嵌入式，以下三处是重灾区：

 

 
1. **串口/网络协议的校验与解析。** 一个帧的校验和算出来是 ` 0xFF `， 如果你用 ` char ` 接收，然后写 ` if (sum < 0) ` 判错误—— 这段代码在 PC 上的单元测试会通过（真为负），烧进 STM32 之后 **永远不会进这个分支** 。  *正确写法是 ` uint8_t sum ` 配 ` if (sum != expected) `。*
 
2. **` getchar() ` 的返回值。**  ` getchar() ` 返回 ` int `，目的是能同时表示 0…255 和 ` EOF `（−1）。 一旦你写成 ` char c = getchar(); if (c == EOF) `，在 ` char ` 无符号的平台上 ` c ` 永远不可能等于 −1， **EOF 判断彻底失效** 。 这是唯一一个 *必须* 用 ` int ` 接的字符场景。后文 7.x 的 CLI 解析会再遇到它。
 
3. **缓冲区与 ` memcmp `。**  ` memcmp ` 按 ` unsigned char ` 逐字节比较，与 ` char ` 的符号性无关—— 这一点标准保证了。但如果你的缓冲区声明成 ` char buf[] `， 再写 ` buf[i] < 0 ` 去判「最高位」，就又在依赖实现定义了。

 

⚠ 反过来，` char ` 也不是不能用

 

如果这段数据 **确定是文本** （ASCII 只用到 0x00–0x7F，最高位恒为 0），那有没有符号都一样， 用 ` char ` 反而更好地表达了「这是字符」的意图， 而且 ` strlen ` / ` strcpy ` 系列的参数类型本来就是 ` char * `。   
  **判据很简单：这个字节会参与算术或大小比较吗？**  会 → 用 ` uint8_t `（确实需要负数时用 ` int8_t `，意图更明确）； 不会、只当字符用 → 用 ` char `。  *最该避免的是两者混着用：` char ` 收进来、` uint8_t ` 存下去， 中间某处忘了转换——那时候符号性差异会以一个极难复现的 bug 的形式出现。*

 

```zhizhan-anchor
ch1-2-5
```



### 1.2.5 定长类型「定」到什么程度：定长 / 最小 / 最快三兄弟

 

` <stdint.h> ` 提供了三组整型，名字很像，含义完全不同。 它们的区别不是学术细节—— **选错一组会让你的循环从 11 条指令变成 4 条，也会让你的结构体无声地膨胀 4 倍** 。

 

| 系列 | 含义 | 能保证什么 | 典型用途 |
| --- | --- | --- | --- |
| ` int8_t ` / ` int16_t ` / ` int32_t ` / ` int64_t ` | **定长** （exact） | 宽度 **正好** 等于名字里的位数；平台若无此宽度，该类型 *根本不存在* | 协议字段、寄存器结构体、共享内存布局——凡是「字节数必须精确」的地方 |
| ` int_least8_t ` 等 | **最小** （least） | 至少这么宽（允许更宽） | 只需要「装得下这个范围」时；实测中它几乎总是取到刚好那个宽度 |
| ` int_fast8_t ` 等 | **最快** （fast） | 至少这么宽，并且是该平台上 **运算最快** 的那个 | 循环计数器、频繁参与算术的局部变量 |

 

第三组最容易被误用。「` int_fast8_t `」听起来像「快一点的 8 位整数」， 它的真实含义是 **「至少 8 位、并且在这台机器上算得最快的类型」** —— 在 Cortex-M 上这个类型是 ` int `，也就是  **4 字节** 。 这和 PC 的结果对不上，而且反直觉。把每个 ` sizeof ` 结果铺进一个数组再 dump 出来， 是最不容易自欺的做法：

 

sizes\_arm.c — 不用 printf，把宽度铺成一串字节 C

 

```text
#include <stdint.h>
#include <stddef.h>
#include <inttypes.h>

/* 把每个 sizeof 结果铺成一个字节数组，之后 dump .rodata 就能读出真值。
   为什么不用 printf：目标板未必有串口，而这些宽度是【编译期常量】，
   本来就不需要在运行时才知道。 */
const unsigned char sizes[] = {
    sizeof(char),          /* [0]  */
    sizeof(short),         /* [1]  */
    sizeof(int),           /* [2]  */
    sizeof(long),          /* [3]  */
    sizeof(long long),     /* [4]  */
    sizeof(void *),        /* [5]  */
    sizeof(size_t),        /* [6]  */
    sizeof(intptr_t),      /* [7]  */
    sizeof(int8_t),        /* [8]  */
    sizeof(int_fast8_t),   /* [9]  */
    sizeof(int_fast16_t),  /* [10] */
    sizeof(int_least8_t),  /* [11] */
    sizeof(ptrdiff_t),     /* [12] */
    sizeof(float),         /* [13] */
    sizeof(double),        /* [14] */
    sizeof(long double),   /* [15] */
};

/* 打印宏本身也是编译期常量，同样可以 dump 出来看它展开成什么 */
const char pr32[]  = PRIu32;
const char prd32[] = PRId32;
const char prx64[] = PRIx64;
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O1 -c sizes\_arm.c

 

```text
$ arm-none-eabi-objdump -s -j .rodata sizes_arm.o
Contents of section .rodata:
 0000 6c6c7800 6c640000 6c750000 01020404  llx.ld..lu......
 0010 08040404 01040401 04040808           ............

// 前 12 个字节是那三个字符串（链接器把它们放在了数组前面）
//   6c 6c 78 00  = "llx"  -> PRIx64 在 ARM 上展开为 "llx"
//   6c 64 00 00  = "ld"   -> PRId32 在 ARM 上展开为 "ld"
//   6c 75 00 00  = "lu"   -> PRIu32 在 ARM 上展开为 "lu"

// 从 0x0c 起的 16 个字节才是 sizes[]，按上表顺序逐个读：
//  char=1  short=2  int=4  long=4  long long=8  void*=4
//  size_t=4  intptr_t=4  int8_t=1  int_fast8_t=4  int_fast16_t=4
//  int_least8_t=1  ptrdiff_t=4  float=4  double=8  long double=8
```

 

把这些字节和 PC 侧直接 ` printf ` 出来的结果并排放，差异一目了然：

 

```zhizhan-table
{"rows":[[{"body":"类型","header":true,"rowSpan":1,"colSpan":1},{"body":"STM32 / Cortex-M3  \narm-none-eabi-gcc","header":true,"rowSpan":1,"colSpan":1},{"body":"x86-64 Windows  \nMSVC","header":true,"rowSpan":1,"colSpan":1},{"body":"说明","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` char ` / ` short `","header":false,"rowSpan":1,"colSpan":1},{"body":"1 / 2","header":false,"rowSpan":1,"colSpan":1},{"body":"1 / 2","header":false,"rowSpan":1,"colSpan":1},{"body":"一致","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` int `","header":false,"rowSpan":1,"colSpan":1},{"body":"4","header":false,"rowSpan":1,"colSpan":1},{"body":"4","header":false,"rowSpan":1,"colSpan":1},{"body":"一致","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` long `","header":false,"rowSpan":1,"colSpan":1},{"body":"**4**","header":false,"rowSpan":1,"colSpan":1},{"body":"**4**","header":false,"rowSpan":1,"colSpan":1},{"body":"数值相同，但数据模型不同（见下）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"指针 / ` size_t ` / ` intptr_t `","header":false,"rowSpan":1,"colSpan":1},{"body":"**4**","header":false,"rowSpan":1,"colSpan":1},{"body":"**8**","header":false,"rowSpan":1,"colSpan":1},{"body":"最需要警惕的一行","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` int8_t ` / ` int_least8_t `","header":false,"rowSpan":1,"colSpan":1},{"body":"1","header":false,"rowSpan":1,"colSpan":1},{"body":"1","header":false,"rowSpan":1,"colSpan":1},{"body":"一致，都是 ` signed char `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` int_fast8_t `","header":false,"rowSpan":1,"colSpan":1},{"body":"**4**","header":false,"rowSpan":1,"colSpan":1},{"body":"**1**","header":false,"rowSpan":1,"colSpan":1},{"body":"同一份源码，这个字段的内存占用差 4 倍","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` int_fast16_t `","header":false,"rowSpan":1,"colSpan":1},{"body":"4","header":false,"rowSpan":1,"colSpan":1},{"body":"4","header":false,"rowSpan":1,"colSpan":1},{"body":"碰巧一致","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` float ` / ` double ` / ` long double `","header":false,"rowSpan":1,"colSpan":1},{"body":"4 / 8 /  **8**","header":false,"rowSpan":1,"colSpan":1},{"body":"4 / 8 / 8","header":false,"rowSpan":1,"colSpan":1},{"body":"ARM 上 ` long double ` 就是 ` double `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` PRIu32 ` / ` PRId32 ` / ` PRIx64 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` \"lu\" ` / ` \"ld\" ` / ` \"llx\" `","header":false,"rowSpan":1,"colSpan":1},{"body":"` \"u\" ` / ` \"d\" ` / ` \"llx\" `","header":false,"rowSpan":1,"colSpan":1},{"body":"这就是 1.2.2 那个 ` -Wformat= ` 警告的根源","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

两侧的数据模型名字不同，记住这两个缩写就够了：  **ARM Cortex-M 是 ILP32** （` int ` / ` long ` / 指针 都是 32 位），  **x86-64 Windows 是 LLP64** （只有 ` long long ` 和指针是 64 位，` long ` 仍是 32 位）。 PC 上 ` sizeof(long) == 4 ` 这一点经常让人误以为「两边一样」—— 不一样的是 **指针** ，而指针宽度才是真正决定行为的那一个。

 

✕ 把 ` int_fast8_t ` 当「省内存的 8 位类型」用

 

一个结构体里放 8 个 ` int_fast8_t ` 字段，作者的意图显然是「8 个字节搞定」。 在 ARM 上实际是  **32 字节** 。这不是 bug，是 ` int_fast8_t ` 的定义如此—— 它承诺的是 *速度* ，从来不是 *宽度* 。

 

**判据** ：  *要精确布局* （协议、寄存器映射、[DMA](term:dma) 描述符，以及任何会被 ` memcpy ` 或跨设备传输的结构） → 一律用 ` intN_t ` / ` uintN_t `；  *只想要一个局部计数器*  → 直接用 ` int ` 或 ` unsigned ` 最省事， 想表达「这个数很小」的意图时可用 ` int_least8_t `，  **但不要拿它做内存规划** 。

 

` int_fast8_t ` 到底快在哪：11 条对 4 条的实测

 

为什么 Cortex-M 把「最快的小整数」定为 32 位？因为 32 位是它的 **原生字长** ： ALU、寄存器、数据总线都是 32 位。用一个窄类型做循环计数器，等于每轮都要额外做一次 「收窄 \+ 扩展」，编译器还不敢做向量化。同一段求和代码，只改计数器的类型：

 

loop8.c — 计数器类型决定循环能不能被优化 C

 

```text
#include <stdint.h>

int sum_i8(const int8_t *a, int n)
{
    int s = 0;
    for (int8_t i = 0; i < n; i++) s += a[i];
    return s;
}

int sum_f8(const int_fast8_t *a, int n)
{
    int s = 0;
    for (int_fast8_t i = 0; i < n; i++) s += a[i];
    return s;
}
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c loop8.c

 

```text
00000000 <sum_i8>:
   0:	cmp	r1, #0
   2:	mov	ip, r0
   4:	ble.n	1a <sum_i8+0x1a>
   6:	movs	r3, #0
   8:	mov	r0, r3
   a:	ldrsb.w	r2, [ip, r3]
   e:	adds	r3, #1
  10:	sxtb	r3, r3        @ 每轮都要把计数器重新符号扩展到 8 位
  12:	cmp	r3, r1
  14:	add	r0, r2
  16:	blt.n	a <sum_i8+0xa>
  18:	bx	lr
  1a:	movs	r0, #0
  1c:	bx	lr

00000020 <sum_f8>:
  20:	cmp	r1, #0
  22:	mov	r3, r0
  24:	mov.w	r0, #0
  28:	ble.n	3c <sum_f8+0x1c>
  2a:	subs	r3, #4
  2c:	add.w	r1, r3, r1, lsl #2   @ 一次算好终点，每轮走 4 字节
  30:	ldr.w	r2, [r3, #4]!
  34:	cmp	r3, r1
  36:	add	r0, r2
  38:	bne.n	30 <sum_f8+0x10>
  3a:	bx	lr
```

 

` sum_i8 ` 的循环体是 7 条指令，其中 ` sxtb ` 是纯粹的类型开销； ` ldrsb.w ` 一次还只能取 1 字节。 ` sum_f8 ` 因为计数器本身就是 32 位、不需要截断，编译器直接让它  **每轮处理 4 字节** （` ldr.w ` 一次读进 4 个 ` int8_t `， ` lsl #2 ` 就是 ×4 的步长），循环体只剩 4 条指令。   
  
  *注意 ` a ` 仍然指向 ` int8_t ` 数组，数据的布局一个字节都没浪费—— 变快的只是「计数器」这一件事。* 这正是 ` int_fast8_t ` 想表达的：  **数据的宽度和运算的宽度是两回事** ，这一句也是 1.2.3 整节的总结。

 

✓ ` %zu ` 与 ` size_t `：同一个坑的另一半

 

指针宽度不一样，` size_t ` 和 ` ptrdiff_t ` 自然也不一样 （ARM 4 字节 / PC 8 字节）。` sizeof ` 的结果类型正是 ` size_t `， 所以上文 ` promote_demo.c ` 与本节都用 ` %zu ` 打印它。

 

**` %zu ` 是 C99 引入的，配 ` size_t ` 是天造地设的一对** —— 它不仅在 ARM 与 PC 之间可移植，在 32 位与 64 位 PC 之间也可移植。 相比之下 ` %d ` 在 64 位 PC 上会因为 ` size_t ` 是 8 字节而出错， ` %lu ` 在 ARM 上碰巧对、在 PC 上错。  *` %zu ` 是唯一在两边都正确的写法。*    
  
 一个实用例外： **早期 newlib 与部分老编译器不支持 ` %zu `** 。 如果你的工具链报「unknown conversion type character 'z'」， 退路是 ` printf("%u", (unsigned)sizeof(x)) `—— 显式转成 ` unsigned ` 再用 ` %u `， 只要对象不超过 4 GB 就正确，而这个前提在 MCU 上恒成立。

 

```zhizhan-anchor
ch1-3
```



## 1.3 浮点数：IEEE 754 拆解

 

嵌入式里的浮点数有三个现实问题： **很多 MCU 没有 FPU** （软件模拟极慢）、  **精度会咬人** 、 **内存占用是整数的两倍** 。先彻底搞清它的位布局。

 

```zhizhan-anchor
ch1-3-1
```



### 1.3.1 float（32 位）的位域划分

 

**FIG 1.2**  IEEE 754 单精度浮点数的内存布局

 

S31

 

E30

 

E29

 

E28

 

E27

 

E26

 

E25

 

E24

 

E23

 

M22

 

M21

 

M20

 

M19

 

M18

 

M17

 

M16

 

M15

 

M14

 

M13

 

M12

 

M11

 

M10

 

M9

 

M8

 

M7

 

M6

 

M5

 

M4

 

M3

 

M2

 

M1

 

M0

 

符号位 S · 1 bit

 

0 = 正，1 = 负。注意： **不是补码** ，是独立的符号位，所以 float 有 ±0。

 

阶码 E · 8 bit

 

实际指数 = E − 127（偏移码）。决定 **数量级** ，范围约 10−38 ~ 1038。

 

尾数 M · 23 bit

 

隐含前导 1（规格化数），实际精度  **24 位 ≈ 7 位十进制** 。决定 **有效数字** 。

 

数值公式：` (−1)S × 1.M × 2(E−127) `。  **精度只有约 7 位十进制有效数字** ——这就是为什么 ` 0.1f + 0.2f != 0.3f `。

 

float\_bits.c — 用联合体窥探浮点的位模式 C

 

```text
#include <stdio.h>
#include <stdint.h>
#include <string.h>

/* 方法一：联合体（C99 允许读写不同成员，但存在字节序问题） */
union f2u { float f; uint32_t u; };

/* 方法二：memcpy（最安全，也是编译器能优化成零开销的写法） */
static uint32_t f2bits(float f)
{
    uint32_t u;
    memcpy(&u, &f, sizeof u);   /* 不会违反严格别名规则 */
    return u;
}

static void dump(const char *name, float f)
{
    uint32_t u = f2bits(f);
    uint32_t s = (u >> 31) & 1u;
    uint32_t e = (u >> 23) & 0xFFu;
    uint32_t m =  u         & 0x7FFFFFu;

    printf("%-10s = %-14g  bits=0x%08X  S=%u E=%-3u(exp %-4d) M=0x%06X\n",
           name, f, u, s, e, (int)e - 127, m);
}

int main(void)
{
    dump("1.0f",     1.0f);
    dump("-2.5f",   -2.5f);
    dump("0.1f",     0.1f);
    dump("0.2f",     0.2f);
    dump("0.3f",     0.3f);
    dump("1e-40f",   1e-40f);      /* 低于最小规格化数 → 非规格化 */
    dump("INFINITY", 1.0f / 0.0f);
    dump("NaN",      0.0f / 0.0f);

    printf("\n0.1f + 0.2f == 0.3f ?  %s\n",
           (0.1f + 0.2f == 0.3f) ? "true" : "FALSE  ← 经典陷阱");
    printf("0.1f + 0.2f = %.10f\n", (double)(0.1f + 0.2f));
    printf("0.3f        = %.10f\n", (double)0.3f);
    return 0;
}
```

 

**输出**  — 位模式一目了然

 

```text
1.0f       = 1              bits=0x3F800000  S=0 E=127(exp 0   ) M=0x000000
-2.5f      = -2.5           bits=0xC0200000  S=1 E=128(exp 1   ) M=0x200000
0.1f       = 0.1            bits=0x3DCCCCCD  S=0 E=123(exp -4  ) M=0x4CCCCD
0.2f       = 0.2            bits=0x3E4CCCCD  S=0 E=124(exp -3  ) M=0x4CCCCD
0.3f       = 0.3            bits=0x3E99999A  S=0 E=124(exp -3  ) M=0x19999A
1e-40f     = 9.99995e-41    bits=0x000116C2  S=0 E=0  (exp -127) M=0x016C2
                                                  ↑ E=0 表示非规格化数
INFINITY   = inf            bits=0x7F800000  S=0 E=255(exp 128 ) M=0x000000
NaN        = nan            bits=0x7FC00000  S=0 E=255(exp 128 ) M=0x400000

0.1f + 0.2f == 0.3f ?  FALSE  ← 经典陷阱
0.1f + 0.2f = 0.3000000119
0.3f        = 0.3000000119
```

 

◆ 从输出里看出的规律

 

 
- ` 1.0f ` 的尾数全 0，阶码 127——因为隐含的 1 不算在 23 位里。
 
- ` 0.1f ` 和 ` 0.2f ` 的尾数都是 ` 4CCCCD `，这是 0.1 二进制展开后 **被截断** 的痕迹。0.1 在二进制中是无限循环小数，存不下。
 
- **E = 0**  表示非规格化数（denormal），此时隐含位变成 0，用来表示非常接近 0 的数。
 
- **E = 255**  是特殊值：尾数全 0 是无穷大，非 0 是 NaN。

 

```zhizhan-anchor
ch1-3-2
```



### 1.3.2 浮点比较的正确姿势

 

float\_cmp.c C

 

```text
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include <float.h>          /* FLT_EPSILON / FLT_MIN / FLT_MAX 都在这里 */

/* ✕ 错误：直接比较，精度误差会导致意外结果 */
bool bad_eq(float a, float b) { return a == b; }

/* ✔ 方法一：绝对误差 —— 只适合数值范围已知且远离 0 的场景 */
bool near_abs(float a, float b, float eps)
{
    return fabsf(a - b) < eps;
}

/* ✔ 方法二：相对误差 —— 通用做法，能适应不同数量级 */
bool near_rel(float a, float b, float rel)
{
    float diff = fabsf(a - b);
    float maxv = fmaxf(fabsf(a), fabsf(b));
    return diff <= rel * maxv;    /* 用 <=；rel 取 FLT_EPSILON 的若干倍，见下方说明 */
}

/* 调用示例：容差为什么不能就用 FLT_EPSILON 本身？
   FLT_EPSILON ≈ 1.19e-7 是"1.0 与下一个 float 之间的距离"，
   而一次减法 + 一次比较至少要经过两次舍入，误差可能已累积到几倍 EPSILON。
   工程上通常取 4× 到 8× FLT_EPSILON 作为起点。 */
bool float_eq(float x, float y)
{
    return near_rel(x, y, 4.0f * FLT_EPSILON);
}

/* ✔ 方法三：ULP 比较 —— 最严格，比较位模式的距离 */
int32_t ulp_diff(float a, float b)
{
    int32_t ia, ib;
    memcpy(&ia, &a, 4);
    memcpy(&ib, &b, 4);
    /* 把 float 位模式映射成单调递增的整数域 */
    if (ia < 0) ia = (int32_t)0x80000000u - ia;
    if (ib < 0) ib = (int32_t)0x80000000u - ib;
    return ia > ib ? ia - ib : ib - ia;
}
```

 

✔ 嵌入式实践建议

 

 
- **能用整数就别用浮点** 。没有 FPU 的 MCU（如 STM32F103）做一次 ` float ` 乘法要几百个周期，` double ` 更是上千周期。
 
- 必须用浮点时， **优先 ` float ` 而非 ` double `** ——Cortex-M4F 的 FPU 只支持单精度，` double ` 会退化成软件模拟。
 
- 用 ` sqrtf ` / ` fabsf ` / ` sinf ` 而 **不是**  ` sqrt ` / ` fabs ` / ` sin `，后者会拉入双精度库。
 
- 编译时加 ` -Wdouble-promotion `，让编译器提醒你哪里意外产生了双精度提升。

 

```zhizhan-anchor
ch1-3-3
```



### 1.3.3 定点数：没有 FPU 时的正解

 

定点数的思想是： **用整数存，但约定小数点固定在某个位置** 。最常用的是 Q 格式（Qm.n，m 位整数 \+ n 位小数）。

 

fixed\_q15.c — Q15 定点数（DSP 常用格式） C

 

```text
#include <stdint.h>

/* Q15: 1 位符号 + 0 位整数 + 15 位小数，范围 [-1, 1)，分辨率 2^-15 */
typedef int16_t q15_t;
typedef int32_t q31_t;
#define Q15_ONE   (1 << 15)          /* 32768，代表 1.0 */
#define Q15_SHIFT 15

static inline q15_t q15_from_float(float f)
{
    /* 加 0.5f 实现四舍五入；先判边界防止溢出 */
    if (f >=  0.999969f) return  32767;
    if (f <= -1.0f)      return -32768;
    return (q15_t)(f * Q15_ONE + (f >= 0 ? 0.5f : -0.5f));
}

static inline float q15_to_float(q15_t q) { return (float)q / Q15_ONE; }

/* 乘法：先升到 32 位，再右移 15 位并饱和 */
static inline q15_t q15_mul(q15_t a, q15_t b)
{
    q31_t t = (q31_t)a * (q31_t)b;      /* Q30 */
    t += (1 << (Q15_SHIFT - 1));         /* 舍入 */
    t >>= Q15_SHIFT;                    /* → Q15 */
    if (t >  32767) t =  32767;         /* 饱和，防止回绕 */
    if (t < -32768) t = -32768;
    return (q15_t)t;
}

/* 验证精度 */
void test_q15(void)
{
    q15_t a = q15_from_float(0.5f);
    q15_t b = q15_from_float(0.25f);
    q15_t c = q15_mul(a, b);            /* 0.5 * 0.25 = 0.125 */
    /* 结果 4096/32768 = 0.125，精确无误差 */
}
```

 

◆ 定点数的代价与收益

 

**收益** ：一条整数乘法指令（Cortex-M3 上 1 个周期）完成，无 FPU 也能跑；行为完全确定，无舍入不确定性。  **代价** ：动态范围固定，需要你自己管理溢出和饱和；开发时的心智负担比浮点高。   
  
 这也是为什么  **端侧 AI 的量化推理几乎都用 int8/int16 定点** ——不只是省内存，更是因为整数运算在 MCU 上快一到两个数量级。

 

```zhizhan-anchor
ch1-3-4
```



### 1.3.4 定点数的硬件落点：饱和指令与 CMSIS-DSP

 

上一节的 ` q15_mul ` 里有这么两行： ` if (t > 32767) t = 32767; `。 写出来很自然，但它在语言层面暴露了一个空白： **C 里没有任何运算符能表达「饱和」** 。 加减乘除要么按补码回绕，要么就是有符号溢出（未定义行为），你只能事后拿 ` if ` 去比较。 而硬件早就为此准备了专门的指令。

 

sat\_demo.c — 回绕 vs 饱和 C

 

```text
#include <stdint.h>

/* C 语言无法表达"饱和"：直接窄化就是回绕 */
int16_t wrap_add(int16_t a, int16_t b)
{
    return (int16_t)(a + b);            /* 30000 + 30000 -> -5536 */
}

/* CMSIS 风格：内联汇编写出带饱和的窄化 */
static inline int32_t sat16(int32_t v)
{
    __asm__ volatile ("ssat %0, #16, %1" : "=r"(v) : "r"(v));
    return v;
}

int16_t sat_add(int16_t a, int16_t b)
{
    return (int16_t)sat16((int32_t)a + (int32_t)b);   /* 30000 + 30000 -> 32767 */
}
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O1 -c sat\_demo.c

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn sat_m3.o
00000000 <wrap_add>:
   0:	add	r0, r1
   2:	sxth	r0, r0        @ 只是窄化：超范围就回绕
   4:	bx	lr

00000006 <sat_add>:
   6:	add	r0, r1
   8:	ssat	r0, #16, r0   @ 饱和：超出 [-32768,32767] 就钳位
   c:	sxth	r0, r0        @ 多余但无害：见下方说明
   e:	bx	lr
```

 

◆ ` ssat ` 是一条指令，不是一个"慢一点的库函数"

 

` wrap_add ` 与 ` sat_add ` 的差别就是第 2 行那一条指令。  **饱和在硬件上不花额外代价** ——这是定点 DSP 能跑在 MCU 上的根本原因之一。   
  
 末尾那条 ` sxth ` 是 GCC 加的：内联汇编的约束 ` "=r" ` 只承诺「32 位寄存器」，编译器并不知道 ` ssat ` 已经把结果限制在 ` int16_t ` 范围内，所以它按 ` int32_t ` → ` int16_t ` 的转换规则又补了一次符号扩展。结果正确，只是多一个周期。  *这也是内联汇编的通病：你比编译器知道得多，但它不会因此少做一步。*

 

不过这里有个更容易踩的坑： **` ssat ` 并不是所有 Cortex-M 都有** 。 把 ` -mcpu ` 换成 ` cortex-m0 `，同一份源码直接编不过：

 

**bash**  — 同一份源码，换成 cortex-m0 之后

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O1 -c sat_demo.c
Assembler messages:
  ...:43: Error: selected processor does not support `ssat r0,#16,r0' in Thumb mode
// （... 是 GCC 生成的汇编临时文件路径，每次都不一样）
```

 

这不是 GCC 的毛病，是内核本身就没有这条指令。编译器自己会告诉你它有没有—— 查预定义宏是判定的标准手段：

 

**bash**  — 用编译器的预定义宏判断内核能力

 

```text
$ echo | arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -dM -E - | grep -E "FEATURE_SAT|__ARM_ARCH "
#define __ARM_FEATURE_SAT 1     <- M3/M4/M7（ARMv7-M）有饱和指令
#define __ARM_ARCH 7

$ echo | arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -dM -E - | grep -E "FEATURE_SAT|__ARM_ARCH "
#define __ARM_ARCH 6            <- M0/M0+（ARMv6-M）连这个宏都没有
```

 

所以正规写法是用编译器内建函数 ` __ssat `，而不是手写内联汇编—— CMSIS 里的 ` __SSAT ` 就是它的一个宏包装。 它在 ` arm_acle.h ` 里，并且被 ` #ifdef __ARM_FEATURE_SAT ` 包住 （可以自己打开那个头文件确认：` __ssat ` 的定义紧跟在 ` #ifdef __ARM_FEATURE_SAT ` 之后）：

 

acle.c — 用内建函数，让编译器自己选指令 C

 

```text
#include <arm_acle.h>
#include <stdint.h>

int32_t a_sat(int32_t v) { return __ssat(v, 16); }
```

 

**bash**  — M3 上完美，M0 上直接没有这个函数

 

```text
# ---- cortex-m3：-O1 就已经是最优形式，连 sxth 都省了 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O1 -c acle.c
$ arm-none-eabi-objdump -d --no-show-raw-insn acle_m3.o
00000000 <a_sat>:
   0:	ssat	r0, #16, r0
   4:	bx	lr          @ 就这一条，没有多余动作

# ---- cortex-m0：__ssat 根本没被定义 ----
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O1 -c acle.c
acle.c: In function 'a_sat':
acle.c:3:35: warning: implicit declaration of function '__ssat'; did you mean 'a_sat'? [-Wimplicit-function-declaration]
// 注意：这只是个 warning，编译会"成功"；真正的失败发生在链接期
//      （undefined reference to `__ssat'）——或者更糟，你把 warning 关掉了
```

 

✕ 在 M0 工程里直接用 ` __ssat `：一个被忽略的 warning 换一次链接失败

 

上面对话里最值得记住的不是那条错误，而是 **它只是一条 warning** 。 隐式声明在 C99 里本该是错误，GCC 13 仍默认按「假设返回 ` int `」处理并放行。 如果工程里加了 ` -Wno-implicit-function-declaration `（很多老工程的 Makefile 里都有）， 你会得到一个「编译通过、链接报一堆 undefined reference」的现场，而错误信息指向的根本不是你真正常的那一行。  *所以凡是跨 M0/M3 的代码，都不能直接写 ` __ssat `，必须显式做条件编译。*

 

sat\_portable.h — 同时服务 M0 与 M3 双路的写法 C

 

```text
#include <stdint.h>

#if defined(__ARM_FEATURE_SAT)
  /* ARMv7-M：M3 / M4 / M7 有 SSAT 指令 */
  #include <arm_acle.h>
  #define SAT16(v)  ((int16_t)__ssat((int32_t)(v), 16))

#elif defined(__arm__)
  /* ARMv6-M：M0 / M0+ 没有这条指令，退回纯 C。
     -O2 下 GCC 在 M3 上其实也能识别这个 clamp 模式并自动生成 ssat，
     但在 M0 上无能为力——因为没有任何一条指令可以生成。 */
  static inline int16_t arm_v6m_sat16(int32_t v)
  {
      if (v >  32767) return  32767;
      if (v < -32768) return -32768;
      return (int16_t)v;
  }
  #define SAT16(v)  arm_v6m_sat16((int32_t)(v))

#else
  /* 非 ARM（PC 上跑单元测试）：同样退回纯 C */
  static inline int16_t generic_sat16(int32_t v)
  {
      if (v >  32767) return  32767;
      if (v < -32768) return -32768;
      return (int16_t)v;
  }
  #define SAT16(v)  generic_sat16((int32_t)(v))
#endif
```

 

这个双路写法的代价是可以量化的。把纯 C 的钳位版本单独编一次，对比 M0 与 M3：

 

**bash**  — 纯 C 钳位版本在 M0 与 M3 上的差别

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O1 -c swsat.c
$ arm-none-eabi-objdump -d --no-show-raw-insn swsat_m0.o
00000000 <sat_add_sw>:
   0:	adds	r0, r0, r1
   2:	ldr	r3, [pc, #20]	@ 从字面量池取 0xffff8000
   4:	cmp	r0, r3
   6:	bge.n	a <sat_add_sw+0xa>
   8:	movs	r0, r3
   a:	movs	r3, #128
   c:	lsls	r3, r3, #8	@ 0x8000，M0 没有 movw 只能用移位凑
   e:	cmp	r0, r3
  10:	blt.n	14 <sat_add_sw+0x14>
  12:	ldr	r0, [pc, #8]	@ 再从字面量池取 0x00007fff
  14:	sxth	r0, r0
  16:	bx	lr
  18:	.word	0xffff8000
  1c:	.word	0x00007fff
// M0 上 -O2 编出来一模一样：没有指令可生成，优化器也就无从下手

# ---- 同一份源码，M3 -O2 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c swsat.c
$ arm-none-eabi-objdump -d --no-show-raw-insn swsat_m3_O2.o
   0:	add	r0, r1
   2:	ssat	r0, #16, r0   @ GCC 认出了这个 if 模式，自动生成 ssat
   6:	sxth	r0, r0
   8:	bx	lr
```

 

◆ 三句话记住这一节

 

 
1. **饱和是硬件能力，不是算法。**  有 ` ssat ` 的内核一条指令完成； 没有的内核（M0/M0\+）只能 9 条指令加两次字面量池访问，而且 **优化器救不了你** 。
 
2. **M3 上不写内建函数通常也没关系（` -O2 ` 会替你生成），M0 上写了反而报错。**  所以判据是「这个工程要不要同时支持 M0」——要，就必须条件编译。
 
3. **用 ` __ARM_FEATURE_SAT ` 而不是 ` __ARM_ARCH ` 做判定。**  ` __ARM_ARCH >= 7 ` 也能用，但前者是「这个能力有没有」的直接表述， 以后遇到 ARMv8-M Baseline（` __ARM_ARCH 8 ` 但没有 DSP 扩展）时不会判断错。

 

最后落到库。工程里没人会自己写 Q15 乘法，用的是  **CMSIS-DSP** —— ARM 官方的定点/浮点信号处理库，STM32 的 HAL 包里自带。它的 API 全部按 ` q7_t / q15_t / q31_t / f32 ` 这些类型组织，函数名有严格前缀：

 

| 函数 | 作用 | 类型 | 典型用途 |
| --- | --- | --- | --- |
| ` arm_q15_to_float ` | Q15 → float | ` q15_t → float32_t ` | 把 ADC 采到的定标数据转成物理量 |
| ` arm_float_to_q15 ` | float → Q15 | ` float32_t → q15_t ` | 把滤波系数（设计时用浮点算好）落到定点 |
| ` arm_mult_q15 ` | 逐点相乘 \+ 自动饱和 | ` q15_t[] → q15_t[] ` | 加窗、增益调节 |
| ` arm_add_q15 ` / ` arm_sub_q15 ` | 逐点加减 \+ 饱和 | ` q15_t[] ` | 信号合成、差分 |
| ` arm_dot_prod_q15 ` | 点积（累加在 q63 上） | ` q15_t[] → q63_t ` | FIR 卷积的核心、相关运算 |
| ` arm_biquad_cascade_df1_q15 ` | 二阶节 IIR 滤波 | ` q15_t ` | 最常用的实时滤波器，直接抄系数就能用 |
| ` arm_rfft_q15 ` / ` arm_cfft_q15 ` | 实数/复数 FFT | ` q15_t ` | 频谱分析、振动检测、音频特征 |
| ` arm_svm_q15 ` / ` arm_nn_* ` | 机器学习算子 | ` q7_t / q15_t ` | 端侧推理（见阶段 ⑥） |

 

接进工程时躲不开的那个宏：` -DARM_MATH_CM3 `

 

CMSIS-DSP 是 **源码级** 的库：它靠一个宏来选内核相关的实现和寄存器定义。 你在 STM32F103（Cortex-M3）上要写的编译选项通常是：

 

**makefile**  — CMSIS-DSP 的典型编译选项

 

```text
CFLAGS += -DARM_MATH_CM3            # 选内核：M0/M0+ 用 ARM_MATH_CM0PLUS，M4 用 ARM_MATH_CM4
CFLAGS += -DARM_MATH_LOOPUNROLL     # 允许 4 次循环展开（DSP 指令效率的关键）
CFLAGS += -I$(CMSIS)/DSP/Include -I$(CMSIS)/Core/Include
CFLAGS += -O2 -mcpu=cortex-m3 -mthumb
# 库本体：把 Source/*.c 一起编进去，或直接链预编译的 libarm_cortexM3l_math.a
```

 

**这个宏写错的症状很有代表性** ：编译能过，但运行结果不对或直接 HardFault。 原因是 ` ARM_MATH_CM4 ` 会启用 M4 独有的 DSP 指令（` SIMD ` 类的 双半字乘加）而 M3 上没有，编出来的指令在 M3 上执行就是未定义指令异常。  *换芯片时先改这个宏，再看其它。*

 

⚠ 关于本节证据范围的说明

 

本节所有汇编与宏输出，都是在本机用  **arm-none-eabi-gcc 13.3.1**  对 ` -mcpu=cortex-m0 / cortex-m3 ` 实际编译得到的，可以逐条复现。 但  **CMSIS-DSP 的函数列表是库文档，不是本地实测** —— 它需要单独下载 CMSIS 包（STM32CubeMX 生成工程时自动带上）， 而且不同版本的 API 有增删（例如 ` arm_svm_* ` 在 CMSIS-DSP 1.9 之后才稳定）。  *上面那个 ` -DARM_MATH_CM3 ` 片段同理：它来自 CMSIS-DSP 的官方用法， 本机没有装这份库，所以同样没有实测输出。*   *真要用的时候，请以你工程里那份 ` arm_math.h ` 的实际声明为准， 或者生成一份 Doxygen 看函数原型。*

 

```zhizhan-anchor
ch1-3-5
```



### 1.3.5 浮点的编译与链接开关：三个必须知道的开关

 

MCU 上的浮点问题，一半出在语言，一半出在 **编译器和链接器的默认设置** 。 下面三个开关的共同点是： *出问题时不会有任何报错* —— 代码编得过、跑得动，只是数据是错的，或者 Flash 悄悄多了 10 KB。

 

开关一 · ` -Wdouble-promotion `：让编译器告诉你哪里偷偷变成了双精度

 

在 C 里，` float ` 和 ` double ` 混在一个表达式里时， ` float ` 会被提升为 ` double `（规则同 1.2.3 的常规算术转换，只是往上走）。 问题是有个极隐蔽的触发源： **一个不带后缀的浮点字面量，类型就是 ` double `** 。 写 ` x * 1.3 ` 的那一瞬间，整个运算就掉进双精度了。

 

fprom.c — 一行代码，三次软件浮点调用 C

 

```text
float scale(float x) { return x * 1.3; }
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wdouble-promotion -c fprom.c

 

```text
fprom.c: In function 'scale':
fprom.c:1:33: warning: implicit conversion from 'float' to 'double' to match other operand of binary expression [-Wdouble-promotion]
    1 | float scale(float x) { return x * 1.3; }
      |                                 ^

$ arm-none-eabi-objdump -d --no-show-raw-insn fprom.o
00000000 <scale>:
   0:	push	{r3, lr}
   2:	bl	0 <__aeabi_f2d>     @ float  -> double（软件模拟）
   6:	add	r3, pc, #16
   8:	ldrd	r2, r3, [r3]        @ 取 8 字节的 double 常量 1.3
   c:	bl	0 <__aeabi_dmul>    @ double 乘法（软件模拟）
  10:	bl	0 <__aeabi_d2f>     @ double -> float（软件模拟）
  14:	pop	{r3, pc}
  18:	.word	0xcccccccd      @ double 1.3 = 0x3FF4CCCCCCCCCCCD
  1c:	.word	0x3ff4cccc

# ---- 加上 -fsingle-precision-constant 之后 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -fsingle-precision-constant -c fprom.c
00000000 <scale>:
   0:	push	{r3, lr}
   2:	ldr	r1, [pc, #8]        @ 4 字节的 float 常量
   4:	bl	0 <__aeabi_fmul>    @ 一次单精度乘法，完事
   8:	pop	{r3, pc}
   c:	.word	0x3fa66666          @ float 1.3f = 0x3FA66666
```

 

对比一眼就够： **三次库调用 \+ 一次 8 字节常量读取 \+ 栈操作** ， 变成 **一次库调用** 。在没有 FPU 的 M3 上，` __aeabi_dmul ` 本身就是上百个周期；Cortex-M4F 虽然有单精度 FPU， 但 ` double ` 依旧走软件模拟—— *FPU 帮不了双精度* 。   
  
 而这一切 **不会产生任何警告** ：` -Wall -Wextra ` 都不管， 只有 ` -Wdouble-promotion ` 会说话。  *这个开关在嵌入式工程里应该是默认打开的。*

 

触发 double 提升的常见位置，除了裸字面量，还有三处： ` printf("%f", x) `（可变参数对 ` float ` 一律做默认实参提升， 强制转成 ` double `——这个无法避免，也正因如此 ` %f ` 才那么贵，见开关三）、 忘了 ` f ` 后缀的数学函数（` fabs ` / ` sqrt ` / ` sin ` 都是双精度版本，对应的是 ` fabsf ` / ` sqrtf ` / ` sinf `），以及 ` 1.0 / 3 ` 这种「整数和 double 混合」的常量表达式。

 

开关二 · ` -ffast-math `（或 ` /fp:fast `）：把 NaN 检查优化成「恒为假」

 

` -ffast-math ` 是一组开关的集合，其中一个叫 ` -ffinite-math-only `：  **它允许编译器假定程序里不存在 NaN 和无穷大** 。 于是「` x != x ` 用来检测 NaN」这个经典手法，会被直接折叠成常量 ` 0 `：

 

nanq.c — NaN 是唯一不等于自己的值 C

 

```text
#include <stdbool.h>

bool is_nan(float x) { return x != x; }
```

 

**bash**  — 同一份源码，两种开关下的编译结果

 

```text
# ---- 默认 -O2 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c nanq.c
00000000 <is_nan>:
   0:	mov	r1, r0
   2:	push	{r3, lr}
   4:	bl	0 <__aeabi_fcmpeq>   @ 真正做一次"相等"比较
   8:	clz	r0, r0               @ 相等 -> 1，取反后归一化
   c:	lsrs	r0, r0, #5
   e:	pop	{r3, pc}

# ---- 加上 -ffast-math ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -ffast-math -c nanq.c
00000000 <is_nan>:
   0:	movs	r0, #0               @ 整个函数被折叠成"恒返回 false"
   2:	bx	lr
```

 

编译器 **没有做错** ：在 ` -ffast-math ` 的语义下， 「不存在 NaN」是它被授权的假设，所以 ` x != x ` 恒假是逻辑正确的推论。 问题在于这个优化 *静默地* 发生了——你的代码里那行 ` if (isnan(v)) ` 从此永远不进分支。   
  
  **最典型的受害场景** ：用 NaN 当哨兵值，比如 ` float latest = NAN; ` 表示「还没读到有效数据」， 或者滤波器的「保持上一帧」逻辑。 开了 ` -ffast-math ` 之后哨兵永远不成立， 程序会拿着初始化时的垃圾值一路算下去，输出一个看起来平滑合理的错误结果。   
  
  **判据** ：算法里用 NaN 传递状态（哨兵、缺失值、无效标记）→  **禁止 ` -ffast-math `** ； 只做纯数值计算且结果对末位不敏感 → 可以用， 但它同时关闭了 ` -ftrapping-math ` 并允许浮点重结合 （` (a+b)+c ` 可能被算成 ` a+(b+c) `），  *控制回路里运算顺序改变就会改变输出* ，调参时会让你怀疑人生。

 

开关三 · ` -u _printf_float `：一个 ` %f ` 值 10 KB Flash

 

GCC 的 ARM 工具链默认用  **newlib-nano** （` -specs=nano.specs `）， 它的 ` printf `  **默认不支持浮点格式化** 。 而它不支持的方式非常阴险：转换代码放在一个 **弱符号**  ` _printf_float ` 后面， 没人定义时该引用被解析为 0，运行时那一段直接被跳过——  **链接不报错、运行不报错，` %f ` 的位置就是空的** 。

 

**bash**  — 用 nm 确认弱符号，用 size 量出代价

 

```text
# 在 newlib-nano 的静态库里，_printf_float 是弱符号（W）
$ arm-none-eabi-nm "$(dirname $(arm-none-eabi-gcc -print-file-name=libc.a))/libc_nano.a" | grep _printf_float
00000000 W _printf_float

# 完整的 libc.a 里则根本没有这个符号（它的浮点支持是内建在 vfprintf 里的）
$ arm-none-eabi-nm .../libc.a | grep -c _printf_float
0

# 三个版本，只差在链接选项，源码都是 printf("v = %f\n", 3.14);
$ arm-none-eabi-size -A pf_nano.elf       # nano，无 -u
.text  5608
$ arm-none-eabi-size -A pf_nano_f.elf     # nano + -u _printf_float
.text  16456     <- +10848 字节 ≈ 10.6 KB
$ arm-none-eabi-size -A pf_int.elf        # nano，源码只用 %ld
.text  5588      <- 和第一个几乎一样，整数格式化几乎不花钱

# 多出来的 10 KB 是什么？把 -u 版本里最大的几个符号按体积排一下：
$ arm-none-eabi-nm --print-size --size-sort pf_nano_f.elf | tail -5
0000b698 0000027a T __aeabi_dsub      @ 双精度减法
0000b69c 00000276 T __aeabi_dadd      @ 双精度加法
0000b69c 00000276 T __adddf3
0000ba08 00000254 T __muldf3          @ 双精度乘法
00009080 00000b7c T _dtoa_r           @ 浮点转十进制字符串（最大的一个）
000082a0 00000458 W _printf_float     @ 转换逻辑本身只有 1112 字节
```

 

注意最后一段： **真正的格式化逻辑只有 1112 字节，剩下的 9 KB 全是双精度软件算术和 ` _dtoa_r `** 。 这就是为什么 ` printf("%f") ` 在 MCU 上是一个需要被认真对待的决定： STM32F103C8 只有 64 KB Flash， *一个 ` %f ` 就吃掉 15%* 。

 

⚠ ` %f ` 的替代方案（按推荐程度排序）

 

 
1. **先转成整数再打印。**  ` printf("%ld.%03ld", (long)v, (long)((v - (long)v) * 1000)) ` 或者干脆全程用「毫伏 / 微秒 / 千分之一度」这类整数单位传输。  *零额外 Flash，零额外周期，而且避免了浮点的舍入不确定性。*
 
2. **只在调试构建里开 ` -u _printf_float `。**  在 Makefile 里写成 ` ifdef DEBUG ` 的条件链接选项， 发布版本不带它——这样日志代码不用改，二进制也不会变胖。
 
3. **用 ` %d ` \+ 抖动法近似看数。**  例如用 ` %d ` 打印 ` (int)(v * 100) `， 心里知道小数点在第 2 位。适合临时排查，不适合长期留在代码里。

 

◆ 三个开关速查

 

| 开关 | 不开会怎样 | 开了的代价 | 建议 |
| --- | --- | --- | --- |
| ` -Wdouble-promotion ` | 无意中的 double 提升悄悄发生，每处多 2~3 次软件浮点调用 | **零** （只是多打几条警告） | 所有工程都开 |
| ` -ffast-math ` | 浮点慢，但不慢在开关上——它主要影响向量化与重结合 | NaN/Inf 语义被破坏，运算顺序可被改变 | 用 NaN 做哨兵时禁用；纯数值计算可开 |
| ` -u _printf_float ` | ` %f ` 静默输出空白（不报错） | **≈ \+10 KB Flash** （F103C8 的 15%） | 只在调试构建里开 |

 

三者有一个共同点值得再强调一次： **它们造成的都不是编译错误，而是「行为悄悄变了」** 。 嵌入式调试里最难查的从来不是编不过的代码，而是编得过、跑得动、结果不对的代码。  *凡是能用一个编译开关把这类问题提前暴露出来的，就都值得打开。*

 

```zhizhan-anchor
ch1-4
```



## 1.4 字节序：通信协议里的隐形杀手

 

多字节数据在内存中的排列顺序叫 **字节序（endianness）** 。ARM Cortex-M 默认 **小端** ， ESP32（Xtensa 和 RISC-V）也是小端。但网络协议 **规定用大端** ，传感器手册可能用大端——这是数据错乱的常见根源。

 

**FIG 1.3**  ` uint32_t v = 0x12345678; ` 在两种字节序下的内存布局

 

小端 Little-Endian · ARM Cortex-M / x86 / ESP32

 

78

 

低字节优先

 

56

 

34

 

12

 

高字节在后

 

addr\+0

 

addr\+1

 

addr\+2

 

addr\+3

 

大端 Big-Endian · 网络字节序 / 部分传感器

 

12

 

高字节优先

 

34

 

56

 

78

 

低字节在后

 

addr\+0

 

addr\+1

 

addr\+2

 

addr\+3

 

注意： **字节序只影响"多字节数据在内存/传输中的排列"，不影响数值本身** 。 ` v ` 的值在两种机器上都是 ` 0x12345678 `，只是拆成字节后顺序相反。 问题出在 **你把内存直接当字节数组发送、或把字节数组直接当整数解释** 的时候。

 

endian.c — 检测字节序 \+ 安全转换 C

 

```text
#include <stdio.h>
#include <stdint.h>
#include <string.h>

/* ---- 运行期检测字节序 ---- */
int is_little_endian(void)
{
    uint16_t x = 0x0001;
    return *(uint8_t *)&x == 0x01;      /* 低地址存低字节 → 小端 */
}

/* 更优雅的编译期检测（C99 起可用） */
#if defined(__BYTE_ORDER__) && __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
  #define HOST_IS_LE 1
#elif defined(__BYTE_ORDER__)
  #define HOST_IS_LE 0
#else
  #define HOST_IS_LE is_little_endian()
#endif

/* ---- 手工字节序转换：不依赖任何库，最可移植 ---- */
static inline uint32_t swap32(uint32_t v)
{
    return ((v & 0x000000FFu) << 24) |
           ((v & 0x0000FF00u) <<  8) |
           ((v & 0x00FF0000u) >>  8) |
           ((v & 0xFF000000u) >> 24);
}
static inline uint16_t swap16(uint16_t v)
{
    return (uint16_t)((v << 8) | (v >> 8));
}

/* ---- 安全地按大端解析字节流（推荐做法，与主机字节序无关） ---- */
static uint32_t read_be32(const uint8_t *p)
{
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) |
           ((uint32_t)p[2] <<  8) | ((uint32_t)p[3]);
}
static uint32_t read_le32(const uint8_t *p)
{
    return ((uint32_t)p[3] << 24) | ((uint32_t)p[2] << 16) |
           ((uint32_t)p[1] <<  8) | ((uint32_t)p[0]);
}

/* ---- ✕ 反面教材：危险的"指针强转"解析 ---- */
static uint32_t bad_parse(const uint8_t *p)
{
    return *(const uint32_t *)p;   /* ✕ 三重问题：
                                      1) 字节序依赖主机
                                      2) p 可能未 4 字节对齐 → Cortex-M0 上直接 HardFault
                                      3) 违反严格别名规则 → -O2 下可能被优化错 */
}

int main(void)
{
    printf("host is little-endian: %s\n", is_little_endian() ? "yes" : "no");

    uint32_t v = 0x12345678u;
    uint8_t  raw[4];
    memcpy(raw, &v, 4);
    /* 同样要转 (unsigned)：raw[i] 是 uint8_t，会先提升成 int */
    printf("raw bytes (LE host): %02X %02X %02X %02X\n",
           (unsigned)raw[0], (unsigned)raw[1],
           (unsigned)raw[2], (unsigned)raw[3]);

    /* 模拟收到一段网络数据（大端） */
    uint8_t pkt[4] = {0x12, 0x34, 0x56, 0x78};
    printf("parsed as BE: 0x%08X\n", read_be32(pkt));
    printf("parsed as LE: 0x%08X\n", read_le32(pkt));
    return 0;
}
```

 

**输出**

 

```text
host is little-endian: yes
raw bytes (LE host): 78 56 34 12
parsed as BE: 0x12345678     ← 正确
parsed as LE: 0x78563412     ← 字节序搞错，数据完全错乱
```

 

⚠ 字节序问题的三条铁律

 

 
1. **收发数据永远用字节数组** ，不用结构体直接 memcpy——除非你明确处理了对齐和填充（见 1.5 节）。
 
2. **协议解析永远显式指定字节序** 。` read_be32() ` 这类函数是标准做法，别省这几行。
 
3. **不要用指针强转解析未对齐的数据** 。Cortex-M0/M0\+  *不支持非对齐访问* ，会直接触发 HardFault；M3/M4 支持但对性能有影响。

 

```zhizhan-anchor
ch1-4-3
```



### 1.4.1 字节序的硬件落点：一条 ` rev ` 指令

 

上面那个手写的 ` swap32 ` 要 4 次移位、4 次掩码、3 次或运算。 但字节交换在硬件上是一条指令：Cortex-M 的 ` rev `（reverse bytes）。 你不需要写内联汇编去够到它——` __builtin_bswap32 ` 就够了：

 

swp.c — 内建函数 vs 手写位运算 C

 

```text
#include <stdint.h>

static inline uint32_t swap32_manual(uint32_t v)
{
    return ((v & 0x000000FFu) << 24) | ((v & 0x0000FF00u) <<  8) |
           ((v & 0x00FF0000u) >>  8) | ((v & 0xFF000000u) >> 24);
}

uint32_t bs32(uint32_t v) { return __builtin_bswap32(v); }
uint32_t sw32(uint32_t v) { return swap32_manual(v); }
```

 

**bash**  — arm-none-eabi-gcc -mcpu=\<核\> -mthumb -std=c11 -O2 -c swp.c

 

```text
# ---- cortex-m3 ----
00000000 <bs32>:
   0:	rev	r0, r0
   2:	bx	lr

00000004 <sw32>:
   4:	rev	r0, r0        @ 手写版本被 GCC 认出来，编成了同一条指令
   6:	bx	lr

# ---- cortex-m0：一模一样 ----
00000000 <bs32>:
   0:	rev	r0, r0
   2:	bx	lr
00000004 <sw32>:
   4:	rev	r0, r0
   6:	bx	lr

# ---- cortex-m4：还是一样 ----
# 同上，两条都是 rev
```

 

三件事在这里同时成立，值得逐条说清：

 

 
- **Cortex-M 上字节交换永远是 1 条指令，M0 也不例外。**  ` rev ` 属于 ARMv6-M 的基线指令集，所以 M0/M0\+/M3/M4/M7 全都有。  *换核心不会让字节序转换变慢。*
 
- **手写的位运算模式，GCC 在 ` -O2 ` 下能识别出来。**  所以「用 ` __builtin_bswap32 ` 是为了性能」这个说法在本例里并不成立。 用它的真正理由是 **可读性和正确性** —— 手写版本里 ` 0x0000FF00u ` 少写一个 ` u `、 或者某一项移错了位数，是很容易发生而且很难看出来的（编译器不会警告）。
 
- **无符号 16 位需要两条指令，**  ` __builtin_bswap16 ` → ` rev16 ` \+ ` uxth `。 原因是 ` rev16 ` 会交换寄存器里 *两个* 半字内部的字节， 而 ` uint16_t ` 参数只用到低 16 位， 高 16 位是垃圾——所以必须再 ` uxth ` 把高半字清零。  *这正是 1.2.3 里「窄类型参与运算要先长大」的另一面。*
 
- **有符号 16 位反而只有一条：` revsh `。**  这一条值得单独记：同一次字节交换，写成 ` uint16_t ` 是两条指令，写成 ` int16_t ` 是一条指令。 ` revsh `（reverse signed halfword）在交换低半字两个字节的同时， 把结果的第 15 位 **符号扩展** 到整个寄存器——它一条就干完了 ` rev16 ` \+ ` uxth ` \+ ` sxth ` 三件事。  *硬件专门为"有符号 16 位字节交换"准备了一条指令，因为这个操作在协议解析里太常见了。*
 

 

**bash**  — 同一个字节交换，有符号与无符号的代价并不相同

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c bswap16.c && arm-none-eabi-objdump -d bswap16.o
00000000 <bs16s>:
   0:	revsh	r0, r0          @ int16_t：一条指令，顺带符号扩展
   2:	bx	lr

00000004 <bs16u>:
   4:	rev16	r0, r0          @ uint16_t：rev16 会把高半字也一起搅乱……
   6:	uxth	r0, r0          @ ……所以必须再清一次高 16 位
   8:	bx	lr
```

 

✔ 实战对照：lwIP 的 ` lwip_htonl() ` 就是"手写交换模式"的活例子

 

第一次读 lwIP 的人容易在两个方向上都想错。一是以为它会调用一个函数—— 其实 ` lwip_htonl() ` 是个宏，小端平台上展开成 ` PP_HTONL(x) `，而 ` PP_HTONL ` 就是  **四个掩码加移位拼起来的表达式** （本节的第 2 条规则正是"GCC 认得出这个模式"）。

 

二是以为"宏 = 慢"。把 lwIP 那段展开式原样搬进一个函数，在 Cortex-M3 上编译：

 

**bash**  — 复刻 lwIP 小端平台的 PP\_HTONL 展开式

 

```text
#define PP_HTONL(x) ((((x) & 0x000000ffUL) << 24) | (((x) & 0x0000ff00UL) << 8) | \
                     (((x) & 0x00ff0000UL) >> 8) | (((x) & 0xff000000UL) >> 24))
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c lwip_htonl.c && arm-none-eabi-objdump -d lwip_htonl.o
00000000 <lwip_htonl>:
   0:	rev	r0, r0          @ 四次掩码 + 三次移位，全部消失，只剩这一条
   2:	bx	lr
```

 

需要说清边界： *"` PP_HTONL ` 长这个样子"来自 lwIP 的 ` def.h `（本机没有引入 lwIP，没有直接编译它的头文件）； 但上面这段汇编是把同一段展开式在本机真编出来的结果，那一条 ` rev ` 是实测。*    
  
  **这件事的教训和本节完全一致** ：字节交换该发生在「字节流 ↔ 变量」这一个边界上。 lwIP 把转换压进宏、并且只在收发边界调用；你在自己的协议解析里也该这么做， 而不是在每个使用点各转一次。

 

◆ 那 ` -mcpu ` 到底有没有被尊重？

 

上面看到 ` rev ` 在三个核上完全一样，容易得出「` -mcpu ` 只是摆设」的错误结论。 其实它被严格遵守，只是 **要挑一个真正有差别的操作才看得出来** 。 整数除法就是最典型的例子——32 位除以常数 7：

 

**bash**  — uint32\_t div7(uint32\_t x) { return x / 7u; }

 

```text
# ---- cortex-m3（有硬件除法 udiv/sdiv，且支持 umull）----
00000000 <div7>:
   0:	ldr	r3, [pc, #12]	@ 取魔数 0x24924925
   2:	umull	r2, r3, r3, r0   @ 用乘法代替除法（编译器算出的倒数）
   6:	subs	r0, r0, r3
   8:	add.w	r0, r3, r0, lsr #1
   c:	lsrs	r0, r0, #2
   e:	bx	lr
  10:	.word	0x24924925

# ---- cortex-m0（没有 umull，只能调用软件除法例程）----
00000000 <div7>:
   0:	push	{r4, lr}        @ 一次真实的函数调用
   2:	movs	r1, #7
   4:	bl	0 <__aeabi_uidiv>   @ 软件除法：几十到几百个周期
   8:	pop	{r4, pc}
```

 

差别是数量级的。 **M3 用 5 条指令 \+ 一个魔数完成，M0 是一次函数调用。**  而在本节开头，同一份 ` sat_demo.c ` 里的 ` ssat ` 在 M0 上甚至 *编不过* ——那是最硬的证据，因为汇编器不会假装。   
  
  **结论** ：` -mcpu ` 是精确生效的。 「` rev ` 在 M0 上代价更高」这个流传很广的说法是错的—— M0 代价高的是 **除法、乘法（无 ` umull `）、饱和、以及所有 DSP 类运算** ， 而不是字节序。写代码时该担心的方向别搞反了。

 

✔ 实战：协议解析里该在哪里做字节交换

 

不要在收到数据的那一刻就急着 ` rev ` 全部字段，也不要在每个使用点各转一次。 正确的位置是 **在「字节流」和「结构体」的边界上转换一次** ： 收到一帧 → 用 ` read_be32() ` 这类函数把需要的字段提出来 → 之后全程用主机字节序运算。  *这样字节序只在一个地方出现，出问题只需要看那一个函数。*  反过来，把 ` htonl `/` ntohl ` 撒得到处都是的代码， 最后没人能说清哪个字段到底转了几次。   
  
 补充一个容易被忽略的场合： **Flash 里持久化的结构体也要考虑字节序** 。 如果你把 ` struct Config ` 直接写进 Flash，那么这份数据换一颗不同字节序的芯片就读不出来了。 规范做法是持久化时也走显式的小端（或大端）编码。

 

```zhizhan-anchor
ch1-5
```



## 1.5 对齐与填充：结构体的隐藏字节

 

这是嵌入式 C 里 **最容易造成"协议对不上"和"内存莫名浪费"** 的知识点。 规则本身只有两条，但影响深远。

 

◆ 对齐的两条规则

 

 
1. **成员对齐规则** ：结构体中每个成员的偏移量，必须是 *该成员自身对齐要求* 的整数倍。不足则在前面插入填充字节（padding）。
 
2. **结构体总大小规则** ：结构体总大小必须是 *其内部最大对齐要求* 的整数倍。不足则在末尾补填充，保证数组中每个元素都正确对齐。

 

**FIG 1.4**  成员顺序如何决定结构体大小（32 位 ARM）

 

顺序 A：char → int → char → short 共 12 字节

 

a



char

 

PAD



3 字节

 

b



int

 

c



char

 

P



1B

 

d



short

 

偏移量 0 → 1 | 4 ← b 必须 4 对齐 | 8 → 9(PAD) → 10

 

顺序 B：int → short → char → char 共 8 字节

 

b



int

 

d



short

 

a



char

 

c



char

 

紧凑排列，零填充 → 省下 33% 内存

 

**同样的成员，只调整声明顺序，大小从 12 字节降到 8 字节** 。 在只有几 KB RAM 的 MCU 上，或者当一个结构体数组有上千个元素时，这个差别非常实在。 规律： *把最大的成员放在前面，或者按对齐要求从大到小排列* 。

 

padding.c — 用 offsetof 精确观察填充 C

 

```text
#include <stdio.h>
#include <stddef.h>      /* offsetof */
#include <stdint.h>

struct OrderA {
    uint8_t  a;     /* 偏移 0  */
    uint32_t b;     /* 偏移 4  ← 前面插了 3 字节 padding */
    uint8_t  c;     /* 偏移 8  */
    uint16_t d;     /* 偏移 10 ← 前面插了 1 字节 padding */
};                  /* 总大小 12，末尾补齐到 4 的倍数 */

struct OrderB {
    uint32_t b;     /* 偏移 0 */
    uint16_t d;     /* 偏移 4 */
    uint8_t  a;     /* 偏移 6 */
    uint8_t  c;     /* 偏移 7 */
};                  /* 总大小 8，零填充 */

/* 用位域压缩：适合与硬件寄存器/协议位域对应 */
struct Flags {
    uint32_t enable  : 1;   /* bit 0  */
    uint32_t mode    : 3;   /* bit 1-3 */
    uint32_t speed   : 4;   /* bit 4-7 */
    uint32_t         : 0;   /* 强制下一个成员从新的存储单元开始 */
    uint32_t reserved: 8;
};

#define SHOW(T, m) printf("  offsetof(%-8s %-4s) = %2zu\n", #T, #m, offsetof(T, m))

int main(void)
{
    printf("sizeof(struct OrderA) = %zu\n", sizeof(struct OrderA));
    SHOW(struct OrderA, a); SHOW(struct OrderA, b);
    SHOW(struct OrderA, c); SHOW(struct OrderA, d);

    printf("\nsizeof(struct OrderB) = %zu\n", sizeof(struct OrderB));
    SHOW(struct OrderB, b); SHOW(struct OrderB, d);
    SHOW(struct OrderB, a); SHOW(struct OrderB, c);

    printf("\nsizeof(struct Flags)  = %zu\n", sizeof(struct Flags));
    printf("  节省比例: 12 → 8 字节 (%.0f%%)\n",
           100.0 * (12 - 8) / 12);
    return 0;
}
```

 

**输出**

 

```text
sizeof(struct OrderA) = 12
  offsetof(struct OrderA a   ) =  0
  offsetof(struct OrderA b   ) =  4     ← 跳过了 1,2,3
  offsetof(struct OrderA c   ) =  8
  offsetof(struct OrderA d   ) = 10     ← 跳过了 9

sizeof(struct OrderB) = 8
  offsetof(struct OrderB b   ) =  0
  offsetof(struct OrderB d   ) =  4
  offsetof(struct OrderB a   ) =  6
  offsetof(struct OrderB c   ) =  7

sizeof(struct Flags)  = 8
  节省比例: 12 → 8 字节 (33%)
```

 

```zhizhan-anchor
ch1-5-1
```



### 1.5.1 \_\_attribute\_\_((packed))：什么时候该用，什么时候是灾难

 

packed.c C

 

```text
/* GCC/Clang 语法：取消所有填充，成员紧密排列 */
struct __attribute__((packed)) WireFrame {
    uint8_t  cmd;
    uint32_t payload;      /* 偏移 1 ← 非对齐！ */
    uint16_t crc;
};                          /* sizeof = 7 */

/* ---------- 什么时候用 packed ---------- */

/* ✔ 场景 1：协议帧结构，需要与线上字节流严格一一对应 */
/* ✔ 场景 2：Flash/EEPROM 存储格式，需要跨版本兼容 */
/* ✔ 场景 3：访问别人的二进制数据结构 */

/* ---------- 为什么 packed 是危险的 ---------- */

void danger(const struct WireFrame *f)
{
    /* ✕ Cortex-M0/M0+ 上，读取非对齐的 f->payload 会触发 HardFault */
    uint32_t v = f->payload;

    /* ✔ 安全做法：逐字节拷贝到对齐的局部变量 */
    uint32_t safe;
    __builtin_memcpy(&safe, &f->payload, sizeof safe);
    (void)safe; (void)v;
}

/* ---------- 更推荐的做法：手工序列化 ---------- */

/* 用独立的解析函数代替 packed 结构体，兼顾可移植性与可读性 */
static inline uint32_t get_u32_le(const uint8_t *p)
{
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
           ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

int parse_frame(const uint8_t *buf, size_t len, uint8_t *cmd, uint32_t *payload)
{
    if (len < 7) return -1;             /* 长度校验永远是第一道防线 */
    *cmd     = buf[0];
    *payload = get_u32_le(buf + 1);     /* 显式字节序 + 无对齐问题 */
    return 0;
}
```

 

✕ packed 的三大代价

 

 
1. **非对齐访问异常** ：Cortex-M0/M0\+ 完全不支持，M3/M4 支持但会拆成多次访问，性能下降。
 
2. **无法取成员地址** ：` &f->payload ` 得到一个非对齐指针，传给任何库函数都可能崩。编译器通常会警告 ` -Waddress-of-packed-member `。
 
3. **代码膨胀** ：GCC 会为 packed 结构的每次访问生成逐字节拼接的代码，Flash 占用上升。

 

```zhizhan-anchor
ch1-5-2
```



### 1.5.2 \_Static\_assert：把对齐假设变成编译期检查

 

这一节要守住的是内存布局。` static_assert ` 的语义是"编译期断言"： 条件不成立就 **直接编译失败** ，不生成任何运行时代码、不占一点 Flash —— 这是零成本地把"我以为布局是这样"变成"编译器替我证明布局就是这样"。

 

C11 提供了 **两种写法** ，语义完全相同，区别只在"要不要 include"：

 

| 写法 | 是否需要头文件 | 说明 |
| --- | --- | --- |
| ` _Static_assert(cond, msg) ` | ✔ 不需要 | 关键字形式，语言内建。任何 C11 编译器、任何 ` -std=c11 ` 下都能直接用 |
| ` static_assert(cond, msg) ` | 需 ` <assert.h> ` | 由 ` <assert.h> ` 提供的宏，展开后就是 ` _Static_assert `。名字更好看 |

 

✔ 本教程的约定：代码块统一用 ` _Static_assert `

 

原因很实际： **它不需要任何 ` #include `，所以永远不会因为"这段代码是片段、没写头文件"而编不过** 。 下面示例里两种都出现，是为了让你都认得； 全书其他地方（Module 02/04/06 的代码块）一律用关键字形式 ` _Static_assert `。 写生产代码时用哪个都行， **但一个工程里最好只有一种** 。

 

assert\_layout.c — 让编译器帮你守住内存布局 C

 

```text
#include <assert.h>      /* C11: static_assert */
#include <stdint.h>
#include <stddef.h>

/* 这个结构体直接映射硬件寄存器，布局不能变 */
typedef struct {
    volatile uint32_t CRL;    /* 0x00 */
    volatile uint32_t CRH;    /* 0x04 */
    volatile uint32_t IDR;    /* 0x08 */
    volatile uint32_t ODR;    /* 0x0C */
    volatile uint32_t BSRR;   /* 0x10 */
    volatile uint32_t BRR;    /* 0x14 */
    volatile uint32_t LCKR;   /* 0x18 */
} GPIO_TypeDef;

/* 任何一条不成立，编译直接失败 —— 而不是等到板子上跑飞 */
static_assert(sizeof(GPIO_TypeDef) == 28,            "GPIO_TypeDef 大小错误");
static_assert(offsetof(GPIO_TypeDef, ODR)  == 0x0C,  "ODR 偏移错误");
static_assert(offsetof(GPIO_TypeDef, BSRR) == 0x10,  "BSRR 偏移错误");

/* 协议帧也要锁死 */
#pragma pack(push, 1)                 /* MSVC/GCC 通用写法，等价于 packed */
typedef struct {
    uint8_t  head;      /* 0xAA */
    uint8_t  cmd;
    uint16_t len;
    uint8_t  data[16];
    uint16_t crc;
} ProtoFrame;
#pragma pack(pop)

static_assert(sizeof(ProtoFrame) == 22, "协议帧长度必须与文档一致！");
```

 

✔ 这一节最该带走的东西

 

**凡是"内存布局不能变"的地方，都要加 ` _Static_assert `。**  硬件寄存器映射、通信协议帧、Flash 存储格式——这三类结构一旦布局错了就是难查的间歇性故障。 用编译期断言把它变成一次编译错误，成本几乎为零。

 

```zhizhan-anchor
ch1-5-3
```



### 1.5.3 强行指定对齐：` _Alignas ` 与 DMA / Cache

 

到目前为止讲的是编译器 *自动* 插入填充。但有些情况下填充不够，你要主动 **指定** 对齐： DMA 的缓冲区、Cache 行、以及需要和硬件寄存器的位段精确对齐的结构体。 标准工具是 C11 的 ` _Alignas ` / ` _Alignof `， GCC 扩展是 ` __attribute__((aligned(n))) `。

 

align2.c — 七条断言，把对齐假设全部钉死 C

 

```text
#include <stdint.h>
#include <stddef.h>

struct natural { uint8_t a; uint32_t b; uint16_t c; };
struct packed_s { uint8_t a; uint32_t b; uint16_t c; } __attribute__((packed));

_Static_assert(sizeof(struct natural)  == 12, "natural layout");
_Static_assert(sizeof(struct packed_s) == 7,  "packed layout");
_Static_assert(offsetof(struct natural, a) == 0, "");
_Static_assert(offsetof(struct natural, b) == 4, "b must sit at 4");
_Static_assert(offsetof(struct natural, c) == 8, "");
_Static_assert(_Alignof(struct natural) == 4, "struct self-alignment = max member");
_Static_assert(_Alignof(double) == 8, "double needs 8");

/* 强制 32 字节对齐的 DMA 缓冲区 */
_Alignas(32) uint8_t dma_buf[64];

const unsigned offs[] = {
    offsetof(struct natural, a), offsetof(struct natural, b), offsetof(struct natural, c),
    _Alignof(struct natural),
};
```

 

**bash**  — 编译通过＝七条断言全部成立；再用 objdump 看对齐是否真的落到了目标文件里

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O1 -c align2.c
(无输出 = 编译成功，7 条 _Static_assert 全部通过)

$ arm-none-eabi-objdump -h align2.o
Idx Name      Size      VMA       LMA       File off  Algn
  1 .data     00000000  00000000  00000000  00000034  2**0
  2 .bss      00000040  00000000  00000000  00000040  2**5   <- 32 字节对齐
  3 .rodata   00000010  00000000  00000000  00000040  2**2

$ arm-none-eabi-objdump -s -j .rodata align2.o
Contents of section .rodata:
 0000 00000000 04000000 08000000 04000000  ................
//           a=0      b=4      c=8    _Alignof=4
```

 

◆ 从这份输出里读出的两条硬规则

 

 
1. **` _Alignas(32) ` 的作用落到了符号所在的节上。**  ` .bss ` 的对齐栏显示 ` 2**5 `（即 32）， 说明 ` dma_buf ` 确实会被放在 32 字节边界上—— 这不是"编译器尽量"，而是链接器必须遵守的节属性。  *可以用 ` objdump -h ` 验证你的对齐声明到底有没有生效，不必等上板。*
 
2. **结构体的对齐要求 = 它内部最大的成员对齐要求。**  ` natural ` 里有 ` uint32_t `，所以 ` _Alignof(struct natural) == 4 `。 这就是 1.5 开头那条「总大小必须是最大对齐的整数倍」规则的来源—— 为了让数组里每个元素都满足自对齐，结构体本身必须继承最强的那个要求。

 

✕ DMA 缓冲区：对齐错了不会报错，只会偶尔传错数据

 

在带 D-Cache 的 Cortex-M7（如 STM32H7、F7）上，DMA 的对齐要求比「省不省内存」严重得多：

 

 
- **缓冲区必须按 Cache 行对齐（Cortex-M7 是 32 字节）。**  原因是 Cache 的维护操作（` SCB_CleanDCache_by_Addr ` / ` InvalidateDCache_by_Addr `）粒度就是整行。 如果你的缓冲区跨越了两行，而相邻那半行里装的是 *别的* 变量， 一次 clean 就会把别人的数据也写进内存，一次 invalidate 就会丢掉别人还没写回的修改。  *这类 bug 的典型表现是：单独测这个功能一切正常，一加上别的任务就开始偶尔出错。*
 
- **只读的 DMA 目标缓冲区还要防止编译器"顺手"优化掉。**  编译器不知道 DMA 会往那块内存里写东西，可能把你的读取提前或消除—— 所以 DMA 缓冲区通常要 ` volatile ` 或者用内存屏障， 光靠 ` _Alignas ` 是不够的（这一点在第 03、04 模块展开）。
 
- **最常见的现场** ：` uint8_t rx_buf[64]; ` 声明在函数里当局部变量， 再把它的地址交给 DMA。栈上变量的对齐你根本没控制权， 而且函数一返回这块内存就被复用了。
 

 

*D-Cache 与 DMA 的一致性规则本身来自 ARM 与 ST 的官方文档（Cortex-M7 的 Cache 行宽 32 字节）， 本节无法在本机实测——没有带 D-Cache 的目标板。这里标注清楚，是为了让你知道哪些结论可以直接复现、 哪些需要在你自己的板子上验证。*

 

✔ 对齐这件事，尽量让它在编译期就确定

 

MCU 上没有 ` posix_memalign `，运行时动态对齐既麻烦又费 RAM。 所以 **优先用静态的 ` _Alignas ` 或 ` __attribute__((aligned(n))) `** ， 让链接器一次性把地址安排好。需要动态分配对齐内存时（比如协议栈的缓冲区池）， 标准做法是自己实现一个「按 max\_align\_t 对齐分配、向上取整到 2 的幂」的小分配器—— 这也正是 RTOS 的 ` pvPortMalloc ` 会做的事（模块 04 会看到它的实现）。   
  
 如果想确认某块内存地址是否满足要求，运行时判断只要一行： ` if ((uintptr_t)buf & 31u) { /* 没有 32 字节对齐 */ } `。  *把它写成断言，比事后查 DMA 的间歇性故障便宜得多。*

 

```zhizhan-anchor
ch1-5-4
```



### 1.5.4 位域：最像硬件、也最不可移植的东西

 

位域（` struct { unsigned a : 1; ... } `）看起来天生就是为了操作寄存器而生的。 但它是整个 C 语言里 **「实现定义」密度最高的特性** ： 分配方向、存储单元大小、能否跨越边界、有符号字段的符号性——全都不归标准管。 先用实测把 GCC 的行为确定下来，再谈怎么用。

 

bf.c — 三种声明类型的位域，尺寸完全不同 C

 

```text
#include <stdint.h>

struct bf8_t  { uint8_t  a : 1; uint8_t  b : 2; uint8_t  c : 3; };
struct bf32_t { uint32_t a : 1; uint32_t b : 2; uint32_t c : 3; };
struct bf_straddle { uint32_t a : 20; uint32_t b : 20; };
struct bf_sign { int8_t s : 1; };

_Static_assert(sizeof(struct bf8_t)  == 1, "byte-sized storage");
_Static_assert(sizeof(struct bf32_t) == 4, "32-bit storage");
_Static_assert(sizeof(struct bf_straddle) == 8, "straddling needs two units");

uint32_t get_b_c(struct bf32_t *p)   { return p->b; }
uint32_t get_abc(struct bf32_t *p)   { return (uint32_t)p->a << 2 | p->b; }
int      get_sign(struct bf_sign *p) { return p->s; }
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c bf.c

 

```text
$ arm-none-eabi-objdump -d --no-show-raw-insn bf.o
00000000 <get_b_c>:
   0:	ldrb	r0, [r0, #0]      @ 整个结构体只有 1 字节
   2:	ubfx	r0, r0, #1, #2    @ 从第 1 位起取 2 位  -> b 在低位那一侧
   6:	bx	lr

00000008 <get_abc>:
   8:	ldrb	r3, [r0, #0]
   a:	and.w	r0, r3, #1        @ a = bit0
   e:	ubfx	r3, r3, #1, #2    @ b = bit[2:1]
  12:	orr.w	r0, r3, r0, lsl #2  @ c = bit[5:3]，整体左移 2 拼上去
  16:	bx	lr

00000018 <get_sign>:
  18:	ldrb	r0, [r0, #0]
  1a:	sbfx	r0, r0, #0, #1    @ 取 1 位并【符号扩展】
  1e:	sxtb	r0, r0
  20:	bx	lr
```

 

◆ GCC/ARM 的三条实测规则

 

 
1. **从低位往高位分配（LSB-first）。**  ` ubfx r0, r0, #1, #2 ` 的含义是「从第 1 位开始取 2 位」， 正好是从低位算起的第 2、3 位。如果按高位优先分配， 在 1 字节的存储单元里 ` b ` 会落在第 5、6 位，指令就不可能是这个形式。   
    *注意这只在同一个位域单元内成立。跨单元时的排列顺序依然要看具体实现。*
 
2. **存储单元的大小由声明类型决定，而不是由总位数决定。**  ` bf8_t ` 全部用 ` uint8_t ` 声明 → 1 字节， 访问靠 ` ldrb `； ` bf32_t ` 用 ` uint32_t ` 声明 → 4 字节。  **两者装的信息一样多，占用差 4 倍。**   *这是位域最容易被误用的一点：以为「用位域就省内存」， 实际上省不省取决于你写的基类型。*
 
3. **放不下就整体挪到下一个存储单元。**  ` 20 + 20 = 40 > 32 `，GCC 不会把 ` b ` 拆成一半在第一个字、一半在第二个字，而是让 ` b ` 从第 2 个字的第 0 位重新开始，中间空出 12 位：  **总大小 8 字节，其中 12 位是浪费的** 。 ` _Static_assert ` 把这一点锁死了。

 

还有两个位域的写法值得单独说： **零宽位域 ` :0 `**  和  **` _Bool ` 位域** 。它们都很像"语法糖"， 但一个真的改变布局，另一个基本什么都没改变——只有实测才能分清是哪一个。

 

bf\_zero.c — 零宽位域与 \_Bool 位域的对照实验 C

 

```text
#include <stdint.h>
#include <stdbool.h>

/* ① 零宽位域 :0 —— 不占位，只是把「当前存储单元」封口 */
struct noz { unsigned a : 3; unsigned b : 3; };               /* 对照组：无 :0 */
struct y0  { unsigned a : 3; unsigned : 0; unsigned b : 3; }; /* 有 :0 */

/* ② _Bool 位域：合法，而且 GCC 把它当 1 位无符号看待 */
struct bl_bool { _Bool    f : 1; _Bool    g : 1; unsigned n : 6; };
struct bl_uint { unsigned f : 1; unsigned g : 1; unsigned n : 6; };

/* ③ 存储单元大小跟着【声明类型】走：位宽一样，类型一换结构体就变胖 */
struct two_u8 { unsigned char a : 4; unsigned char b : 4; };  /* 1 字节 */
struct u8_u16 { unsigned char a : 4; uint16_t      b : 4; };  /* 2 字节 */

_Static_assert(sizeof(struct noz)     == 4, "noz");
_Static_assert(sizeof(struct y0)      == 8, ":0 把 b 顶到了下一个存储单元");
_Static_assert(sizeof(struct bl_bool) == 4, "_Bool 位域并不额外占空间");
_Static_assert(sizeof(struct bl_uint) == 4, "与上一行完全一样");
_Static_assert(sizeof(struct two_u8)  == 1, "同族窄类型能挤在一起");
_Static_assert(sizeof(struct u8_u16)  == 2, "换一个声明类型就翻倍");

unsigned rb_noz(const struct noz *p) { return p->b; }
unsigned rb_y0 (const struct y0  *p) { return p->b; }
```

 

**bash**  — arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -c bf\_zero.c && arm-none-eabi-objdump -d bf\_zero.o

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -c bf_zero.c
# 六条 _Static_assert 全部成立，一条错误都没有 —— 上面那些大小就是实测值
$ arm-none-eabi-objdump -d bf_zero.o
00000000 <rb_noz>:
   0:	ldrb	r0, [r0, #0]
   2:	ubfx	r0, r0, #3, #3      @ 无 :0：b 就紧跟在 a 后面，仍在第 0 个字节里
   6:	bx	lr

00000008 <rb_y0>:
   8:	ldrb	r0, [r0, #4]        @ 有 :0：b 被顶到了偏移 4
   a:	and.w	r0, r0, #7
   e:	bx	lr
```

 

零宽位域 ` :0 `：一个不占位的"封口符"

 

` unsigned :0; ` 是位域语法里唯一的"无名且零宽"组合。 它 **不占用任何一位** ，作用只有一个： *把当前存储单元封口， 下一个字段必须从新的存储单元开始* 。

 

实测对照很干净：` struct noz { unsigned a:3; unsigned b:3; } ` 是  **4 字节** ，` b ` 就在第 0 个字节的第 3~5 位 （反汇编里是 ` ldrb r0,[r0,#0] ` \+ ` ubfx r0,r0,#3,#3 `）； 中间插一个 ` unsigned :0; ` 之后变成  **8 字节** ，` b ` 的访问指令直接变成 ` ldrb r0,[r0,#4] `——偏移量从 0 跳到 4。 也就是说，这一个"零宽"的声明让结构体白白多了一倍。

 

它真正的用途是 **让位域和字节边界对齐** ：比如你希望每组 8 位的字段各自 落在独立的字节上、方便按字节读写时，用 ` :0 ` 把每一组封口， 比手工凑位数可靠得多。 *但要清楚它是"花钱买整齐"，每封一次口就可能浪费掉当前单元的剩余位。*

 

⚠ ` _Bool ` 位域与「非法类型」的边界

 

C11 §6.7.2.1p5 规定位域的类型只能是 ` _Bool `、` signed int `、 ` unsigned int `， *或实现自行定义的其他类型* 。 GCC 把"其他类型"放宽到了任意整数类型，所以 ` unsigned char a:4 `、` uint16_t b:4 ` 都能编过， 连 ` -Wpedantic ` 都不吭声—— **这不是扩展，是标准授权的实现定义行为** ， 也正因如此，它跨编译器就不可靠。

 

非整数类型则是硬错误，这条边界很干脆：

 

**bash**  — struct bad { float f : 3; };

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c badbf.c
badbf.c:1:20: error: bit-field 'f' has invalid type
    1 | struct bad { float f : 3; };
      |                    ^
```

 

至于 ` _Bool ` 位域：实测 ` _Bool f:1; _Bool g:1; unsigned n:6; ` 与把两个 ` _Bool ` 换成 ` unsigned ` 的版本  **大小完全相同（都是 4 字节）、访问代码完全相同**  （都是 ` ldrb r0,[r0,#0] ` 加一个移位）。 所以"用 ` _Bool ` 位域会省空间"是错觉；它唯一的实际差别是语义—— 读回来只可能是 0 或 1。 **别为了省一位去用它，为了表意清楚才用它。**

 

✕ 协议帧和跨平台数据里，绝对不要用位域

 

上面三条规则都是「GCC \+ ARM」这个组合下的行为。 换成 MSVC 或换成大端平台，以下每一条都可能变：

 

 
- **分配方向** ：ARM 小端上是从低位开始填，某些实现在大端或不同 ABI 下从高位开始填。 同一个结构体，字节序一换，字段位置就全错。
 
- **能否跨越存储单元** ：GCC 选择"不跨、直接挪"， 别的实现可能真的把一个字段拆成两半。 于是 ` bf_straddle ` 在别处的 ` sizeof ` 可能是 5 而不是 8。
 
- **有符号位域的符号性** ：` int8_t s : 1 ` 在实测里 ` get_sign ` 会做符号扩展，所以 ` s = 1 ` 读出来是 ` −1 ` 而不是 ` 1 `。 如果换成 ` uint8_t s : 1 `，同样的位读出来就是 ` 1 `。  *区别只在一个关键字上，而结果从 −1 变成 1。*
 

 

**结论** ：凡是 *要序列化、要跨设备、要跨编译器* 的数据布局， 一律用「一个整数 \+ 显式掩码和移位」，写在 ` #define ` 里： ` #define FIELD_B_POS 1u ` / ` #define FIELD_B_MSK 0x6u ` / ` #define FIELD_B_GET(r) (((r) & FIELD_B_MSK) >> FIELD_B_POS) `。  *多写几行，换来的是「这份代码在任何编译器上都是同一个字节」。*

 

⚠ 位域唯一站得住的场合：就在你本地的寄存器映射里

 

如果位域只用于 **访问某个确定的硬件寄存器** ，而且这个工程一辈子只面向这一颗芯片、这一个工具链—— 那么它是合适的：可读性好，而且 ADC / 定时器 / 通信外设的控制寄存器本来就 **是按位定义的** 。 用位域写出来的代码更接近手册的表述。

 

但即使是这种场合，也请做两件事：   
①  **整个结构体加 ` volatile `** ， 否则编译器可能把「先写 A 字段、再写 B 字段」合并成一次写——对寄存器来说，那是两次完全不同的操作；   
②  **用 ` _Static_assert ` 锁住每一段的偏移和总大小** ， 这样换编译器版本时一旦布局变了，你会在编译期知道，而不是在现场的设备上知道。   
  
 另外 GCC 有一个和这个场景直接相关的选项： ` -fstrict-volatile-bitfields ` （ARM 平台上默认开启）。它强制 volatile 位域的每次访问都按声明类型的宽度进行一次完整读写， 而不是只访问包含该位的那一个字节。  *对「读-改-写会误清其他位」的寄存器，这个行为是你想要的；但你要知道它开着。*

 

```zhizhan-anchor
ch1-5-5
```



### 1.5.5 ` _Static_assert ` 的 C99 回退与「平台体检」

 

1.5.2 讲了 ` _Static_assert ` 能做什么。这里解决两个纯工程问题：  **老标准怎么办** ，以及 **该断言哪些东西** 。 先纠正一个流传很广的说法——「C99 不能用 ` _Static_assert `」并不准确。 GCC 在 ` -std=c99 ` 下 **接受** 它，只是在 ` -Wpedantic ` 时提醒一句：

 

**bash**  — 分开测：\_Static\_assert 与小写 static\_assert 的命运完全不同

 

```text
// sa99b.c —— 只用了 _Static_assert，没有包含 <assert.h>
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c99 -Wall -Wextra -pedantic -c sa99b.c
sa99b.c:1:1: warning: ISO C99 does not support '_Static_assert' [-Wpedantic]
    1 | _Static_assert(1 == 1, "ok");
      | ^~~~~~~~~~~~~~
// 只是警告，目标文件正常产出 —— 能用，但不够干净

// sa99.c —— 还用了小写的 static_assert
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c99 -Wall -Wextra -pedantic -c sa99.c
sa99.c:2:15: error: expected declaration specifiers or '...' before numeric constant
    2 | static_assert(2 == 2, "also ok");
      |               ^
// 这是【硬错误】：小写 static_assert 是 <assert.h> 里的宏，
// 而 <assert.h> 只在 C11 及以上才定义它。C99 下它就是一个未声明的标识符，
// 编译器把它当成了「声明说明符」，于是报出上面这个看不懂的错。
```

 

✕ 该警惕的是小写 ` static_assert `，不是 ` _Static_assert `

 

两种写法的区别不是风格问题， **而是编译结果不同** ： ` _Static_assert ` 是 C11 的关键字，GCC 当作扩展在所有标准下都支持， C99 下只是 ` -Wpedantic ` 抱怨； 小写 ` static_assert ` 是 ` <assert.h> ` 提供的宏， *而 ` assert.h ` 只在 ` __STDC_VERSION__ >= 201112L ` 时才定义它* ，C99 下直接编译失败，而且报错信息（「expected declaration specifiers」） 完全指不到真正的原因。   
  
 所以： **C99 工程里要么统一用 ` _Static_assert `，要么用下面的宏回退。**  不要直接用 ` static_assert `，也不要以为「包含了 ` <assert.h> ` 就稳了」。

 

static\_assert\_portable.h — 一份宏，覆盖 C99 到 C17 C

 

```text
#include <stdint.h>

/* 拼接要靠两层宏：__LINE__ 必须先展开再拼接 */
#define SA_CAT_(a,b) a##b
#define SA_CAT(a,b)  SA_CAT_(a,b)

#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L
  #define STATIC_ASSERT(cond, msg) _Static_assert(cond, msg)   /* C11+ 原生 */
#else
  /* C99 回退：用"长度为负的数组"制造编译错误。
     这是 C99 时代的标准手法，本质是让类型非法，而不是让值非法。 */
  #define STATIC_ASSERT(cond, msg) \
      typedef char SA_CAT(sa_line_, __LINE__)[(cond) ? 1 : -1]
#endif

struct natural { uint8_t a; uint32_t b; uint16_t c; };

STATIC_ASSERT(sizeof(struct natural) == 12, "struct natural must stay 12 bytes");
STATIC_ASSERT(sizeof(void *) == 4, "this code assumes 32-bit pointers");

int main(void) { return 0; }
```

 

**bash**  — 三个标准下都干净通过；故意写错时错误信息依然能读懂

 

```text
$ for STD in c99 c11 c17; do arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=$STD -Wall -Wextra -c sa_fb.c -o /dev/null; done
(三个标准全部无警告通过 —— 因为 c99 分支根本没碰 _Static_assert)

# 故意把断言写错，看回退版本的报错长什么样
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c99 -c sa_bad.c
sa_bad.c:4:54: error: size of array 'sa_line_5' is negative
    4 | #define STATIC_ASSERT(cond, msg) typedef char SA_CAT(sa_line_, __LINE__)[(cond) ? 1 : -1]
    2 | note: in definition of macro 'SA_CAT_'
// 报错信息里有 sa_line_5 —— 行号就在名字里，能直接定位到出错的位置
```

 

**关于那个 ` msg ` 参数** ：C99 回退版里它没用上 （数组技巧没法带消息），所以断言失败时你只能看到「数组大小为负」\+ 行号。 这是回退方案的固有代价。 *如果团队里 C99 和 C11 混用，建议把消息写进标识符里* ， 例如 ` STATIC_ASSERT_PTR_IS_4_BYTES ` 这种命名—— 名字本身就是消息。

 

◆ 平台体检：每个工程都该断言的六件事

 

把这些断言收进一个 ` platform.h `，所有源文件第一句就包含它。 好处是： **换芯片、换工具链、换优化等级时，问题会在编译期暴露，而不是在现场的设备上** 。

 

| 断言 | 在防什么 |
| --- | --- |
| ` STATIC_ASSERT(CHAR_BIT == 8, ...) ` | 字节不是 8 位。理论上存在（DSP 上有 16 位 char），实际上你所有的协议解析都会崩 |
| ` STATIC_ASSERT(sizeof(void *) == 4, ...) ` | 指针宽度。把 PC 上的代码搬过来时，这条会第一时间拦住你（见 1.2.5 的 ILP32/LLP64） |
| ` STATIC_ASSERT(sizeof(int) == 4, ...) ` | 隐含依赖 ` int ` 是 32 位的代码（整数提升的结论全部建立在它之上） |
| ` STATIC_ASSERT(sizeof(float) == 4 && sizeof(double) == 8, ...) ` | IEEE 754 布局前提。定点/浮点混算的代码依赖这个 |
| ` STATIC_ASSERT(_Alignof(double) == 8, ...) ` | 对齐假设。DMA 缓冲区和 packed 结构体的偏移全部依赖它 |
| ` STATIC_ASSERT(sizeof(ProtoFrame) == 22, ...) ` | 具体的协议帧 / Flash 存储结构布局。这一类一旦错了就是间歇性故障 |

 

除了这六条，还有一类值得单独关注： **「能力宏」断言** 。 例如 1.3.4 里用到的 ` __ARM_FEATURE_SAT `、 汇编与 C 的 ` __ARM_EABI__ `、以及 ` __CHAR_UNSIGNED__ `（1.2.4）。 这些不能断言成「必须有」，而应该写成条件编译的双路实现， 再用一条断言保证「至少有一路被选中」——否则你会得到一个什么都没实现的空函数。

 

```zhizhan-anchor
ch1-6
```



## 1.6 类型双关与严格别名：C 里最容易忽略的规则

 

最后这一节讲一条规则。它的特点是： **违反它，编译器不会给任何警告； 代码在 ` -O0 ` 下完全正常；换到 ` -O2 ` 就开始出错** 。 这条规则叫 **严格别名（strict aliasing）** ， 写在 C11 §6.5p7 里，只有一句话的篇幅。

 

◆ 规则本身

 

一个对象的 **有效类型** （effective type）是它被声明时的类型。 访问这个对象时，只能用以下几类左值： *与它兼容的类型* 、  *它的限定版本* （` const ` / ` volatile `）、  *对应的有符号/无符号版本* 、  *包含它的聚合类型* （结构体/联合体）、 以及 **字符类型** （` char ` / ` signed char ` / ` unsigned char `）。

 

换句话说： **用 ` int * ` 去读一个 ` float ` 对象是未定义行为。**    
  
 而 ` char ` 那一条例外是 **单向** 的，这一点常被误读： 你可以用字符指针去读 *任何* 对象的字节（这正是 ` memcpy ` 合法的原因）， 但反过来 *不行* ——把一个 ` char ` 数组当成 ` uint32_t ` 读，依然是 UB。

 

为什么编译器要关心这个规则？因为它带来一个极其重要的优化机会：  **如果两个指针指向的类型不同，编译器就可以假定它们不重叠** ， 从而把中间那次写入当作不存在。用一个函数就能看到这个假设的威力：

 

clobber.c — 一个 float 指针和一个 int 指针 C

 

```text
#include <stdint.h>

/* BAD: 用 int 指针读 float 对象 —— 违反严格别名（C11 6.5p7） */
int32_t bad_read(const float *f) { return *(const int32_t *)f; }

/* GOOD: memcpy 是标准认可的"类型双关"通道 */
int32_t good_read(const float *f) { int32_t i; __builtin_memcpy(&i, f, 4); return i; }

/* 让编译器"看得见"别名：如果 p 指向 x，那次写入会改掉 *x */
float clobber(float *x, int *p)
{
    *x = 1.0f;
    *p = 0;          /* 若 p 与 x 指向同一块内存，*x 现在应该是 0 */
    return *x;
}
```

 

**bash**  — 同一份源码，三种编译方式

 

```text
# ---- -O0：老老实实，每次读都回到内存 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 -c clobber.c
00000030 <clobber>:
  30:	push	{r7}
  32:	sub	sp, #12
  34:	add	r7, sp, #0
  36:	str	r0, [r7, #4]        @ 保存 x
  38:	str	r1, [r7, #0]        @ 保存 p
  3a:	ldr	r3, [r7, #4]
  3c:	mov.w	r2, #1065353216	@ 0x3f800000 = 1.0f
  40:	str	r2, [r3, #0]        @ *x = 1.0f
  42:	ldr	r3, [r7, #0]
  44:	movs	r2, #0
  46:	str	r2, [r3, #0]        @ *p = 0
  48:	ldr	r3, [r7, #4]
  4a:	ldr	r3, [r3, #0]        @ 真的把 *x 从内存里读回来
  4c:	mov	r0, r3

# ---- -O2：严格别名生效，那次读被消掉了 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c clobber.c
00000008 <clobber>:
   8:	mov	r2, r0
   a:	movs	r3, #0
   c:	mov.w	r0, #1065353216	@ 直接把 1.0f 放进返回值寄存器
  10:	str	r0, [r2, #0]        @ *x = 1.0f
  12:	str	r3, [r1, #0]        @ *p = 0
  14:	bx	lr                  @ 结束 —— 根本没有再读一次内存
// 编译器认为：int* 和 float* 不可能指向同一块内存，
// 所以 *p = 0 影响不到 *x，*x 还是刚才写进去的 1.0f。
// 如果调用方真的让 p 指向 x，这个函数【返回了错误的值】。

# ---- -O2 加上 -fno-strict-aliasing：那次读回来了 ----
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -fno-strict-aliasing -c clobber.c
00000008 <clobber>:
   8:	movs	r3, #0
   a:	mov.w	r2, #1065353216	@ 0x3f800000
   e:	str	r2, [r0, #0]
  10:	str	r3, [r1, #0]
  12:	ldr	r0, [r0, #0]        @ 老实读回来，$ 返回 0
  14:	bx	lr
```

 

三段输出放在一起，这条规则的全部含义就清楚了：  **同一个函数，` -O2 ` 返回 1.0f， ` -O2 -fno-strict-aliasing ` 返回 0** 。 而 GCC 在 ` -Wall -Wextra -Wstrict-aliasing=2 ` 下  *一条警告都没有* ——它认为自己没有做错任何事，因为你违反了规则。

 

✕ UB 不是「一定会崩溃的错误」，而是「编译器被允许做任何事的许可证」

 

这是理解本节的钥匙。 **未定义行为不等于程序会崩** ， 它的意思是「标准对结果不作任何承诺」，于是编译器有权基于「这不会发生」的假设去优化。 下面这段代码在 PC 上跑给你看，结果是 *完全正常* 的：

 

**输出**  — 同一份 UB，在 MSVC 上没有发作

 

```text
bad_read  = 0x40600000       @ 3.5f 的位模式，正确
good_read = 0x40600000       @ memcpy 版本，同样正确
clobber(&g, (int*)&g) = 0     @ MSVC 老老实实重载了一次，得到了"正确"结果
```

 

同样的 ` clobber `，MSVC 在这次编译里返回了 0（正确）， GCC ` -O2 ` 在 ARM 上返回了 1.0f（错误）。  **这恰恰是最坏的情况** ：你会先在 PC 上测通、以为没问题， 烧进板子之后才发现行为不一样；或者反过来——在 ` -O0 ` 调试版里一切正常， 改成 ` -O2 ` 发布版就出问题。  *线上最难查的一类 bug，特征就是「换优化等级就变」。*

 

◆ 类型双关的三条合法通道

 

 
1. **` memcpy ` —— 首选，标准保证，而且不花代价。**  GCC 在 ` -O2 ` 下会把这种「复制 4 字节」直接编译成一次寄存器搬移， 不会真的调用函数。` float_bits.c ` 里的 ` f2bits() ` 用的就是这个方法，和 ` union ` 版本编出来的代码一样好。  *任何"我要把一个 float 当整数看"的需求，都写 memcpy。*
 
2. **` union ` —— C99 起明确允许（C11 §6.5.2.3p3）。**  写 ` union { float f; uint32_t u; } ` 然后读另一个成员是合法的， 结果是实现定义的位模式重解释。但要注意 **这只在 C 里成立** ： C\+\+ 里读非活跃成员依然是 UB（虽然 GCC 和 MSVC 都作为扩展支持）。  *工程里如果 C 和 C\+\+ 混编，就统一用 memcpy。*
 
3. **字符指针 —— 单向豁免。**  用 ` const unsigned char * ` 遍历任何对象的字节是合法的， 这也是 ` memcmp `、CRC 计算、DMA 填充这些代码能正常工作的原因。  *注意方向：可以「把任何东西当字节看」，不能「把字节当任何东西看」。*

 

✔ 工程上的三个实用判断

 

 
1. **寄存器访问不受这条规则困扰，但要用 ` volatile ` 指针。**  ` *(volatile uint32_t *)0x40021018 ` 是标准写法： ` volatile ` 告诉编译器「每次访问都必须真的发生」， 它不会把这个访问缓存到寄存器里，也不会因为别名假设而移动它。  *但请注意 ` volatile ` 不是并发保护，它只约束编译器不约束 CPU—— 中断与主循环共享变量时的完整做法见模块 02。*
 
2. **协议解析和 DMA 缓冲区，永远走 ` memcpy ` 或逐字节解析。**  这既是规避严格别名，也顺带解决了 1.5 讲的未对齐访问问题 （` memcpy ` 在 ARM 上会被编成安全的字节访问序列， 不会产生未对齐的 ` ldr `）。 **一举两得，没有理由不用。**
 
3. **什么时候可以无视这条规则？**  当你 *确定* 整个工程都用 ` -fno-strict-aliasing ` 编译时 ——Linux 内核就是这么干的（它明确关闭严格别名，因为内核里到处是合法的双关需求）。 另一个精细做法是给类型加 ` __attribute__((may_alias)) `， 只对需要双关的那一个类型放宽。   
    *但要清楚：` -fno-strict-aliasing ` 是全局开关， 它会让你损失一部分优化（就像上面那三段汇编看到的，` -O2 ` 的那次读回来了）。 能改代码就别改开关。*

 

⚠ 本节结论对整本书的影响

 

严格别名是模块 01 这一整套「数据在内存中长什么样」的收尾， 因为它是 **唯一一条「你完全按内存布局的正确直觉写代码、编译器却依然有权让程序出错」的规则** 。 前面几节讲的都是「内存里的字节是什么样」； 这一节补上了另一半： **「编译器对这块内存做了什么假设」** 。   
  
 后面几个模块会反复用到这个视角： 模块 02 的 ` volatile ` 和 ` restrict ` 都是「给编译器的额外承诺或限制」；模块 04 的栈与链接脚本决定这些对象落在哪里； 模块 05 的 ` -O2 ` 与 ` -flto ` 会把本节这些假设的威力放大到整个程序。  *凡是遇到「-O0 正常、-O2 出错」的故障，第一件事就是回来查这里。*

 

◆ 本章要点

 

 
- 用 ` <stdint.h> ` 定长类型，永远不用裸 ` int `/` long ` 做协议和指针运算；指针要用 ` uintptr_t ` 承载。注意 ` int_fast8_t ` 在 Cortex-M 上是  **4 字节** ，别拿它做内存规划。
 
- **补码** 统治了整数世界，因为减法可以复用加法器。代价是范围不对称（` abs(INT_MIN) ` 是 UB）。
 
- **有符号溢出是 UB** ，无符号溢出才是良定义的模运算。
 
- **比 ` int ` 窄的类型参与运算前一律先提升为 ` int `** ，所以 ` ~(uint8_t)0 == 0xFFFFFFFF ` 而不是 ` 0xFFFFFF00 `；第二级常规算术转换里，` int32_t ` 与 ` uint32_t ` 混比时 **有符号那侧会被静默拉成无符号** （` -1 < 1u ` 为假）。
 
- ` char ` 的符号性是 **实现定义** 的：STM32 上无符号、x86 上有符号。协议字节一律用 ` uint8_t `，` getchar() ` 必须用 ` int ` 接。
 
- IEEE 754 的 32 位浮点 = 1 符号 \+ 8 阶码 \+ 23 尾数， **有效精度仅约 7 位十进制** 。没 FPU 就用 Q 格式定点数；有饱和指令的内核（M3/M4）一条 ` ssat ` 完成，M0 只能纯 C 模拟。
 
- 浮点真正的坑多数在 **开关** 上：` -Wdouble-promotion ` 该常开（一个裸 ` 1.3 ` 就是 3 次双精度库调用），` -ffast-math ` 会让 NaN 哨兵失效，` -u _printf_float ` 一个 ` %f ` 值  **约 10 KB Flash** ——而不开时它 *静默* 输出空白。
 
- 字节序只影响多字节数据的内存排布。 **协议解析必须显式指定字节序** ，禁用指针强转。Cortex-M 上字节交换永远是 1 条 ` rev `（M0 也一样）；真正体现内核差异的是除法与乘法。
 
- 结构体成员顺序决定 padding 大小；` packed ` 能省空间但会带来非对齐访问风险，优先手工序列化。DMA 缓冲区要用 ` _Alignas ` 强对齐（带 D-Cache 的 M7 上必须按 32 字节 Cache 行对齐）。
 
- **位域是实现定义密度最高的特性** ：基类型决定存储单元（` uint8_t ` 声明 → 1 字节，` uint32_t ` → 4 字节），跨单元时整体后移，有符号 1 位字段读出来是 −1。协议与跨平台数据一律用掩码 \+ 移位，不用位域。
 
- 用 ` _Static_assert ` 把内存布局假设固化到编译期 —— 零运行时开销。C99 下它是扩展（只报 ` -Wpedantic `）， **小写 ` static_assert ` 才是硬错误** 。
 
- **严格别名（C11 6.5p7）** ：用 ` int * ` 读 ` float ` 对象是 UB，且无警告。实测同一个函数 ` -O2 ` 返回 1.0f、` -O2 -fno-strict-aliasing ` 返回 0。 **类型双关一律走 ` memcpy `** ，它零开销且顺带规避未对齐访问。
 
- 一条贯穿全章的判据： **「` -O0 ` 正常、` -O2 ` 出错」的故障，根源几乎总在本章** ——整数提升、实现定义行为、或编译器的别名假设。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 计算：` ~(uint8_t)0 ` 的值是多少？为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` 0xFFFFFF00 `。` (uint8_t)0 ` 先被 **整数提升** 为 ` int ` 0，按 32 位取反得到 ` 0xFFFFFF00 `——不是 ` 0xFF `。 *窄类型参与运算前几乎都会被提升到 ` int `，这是\"数据在内存中\"最核心的机制。*"}
   ```
 
2. 判断：` int8_t a; uint8_t b; a < b ` 比较时，两边各自被提升成什么类型？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**都提升为 ` int `** （不止是 unsigned）。所以这次比较在 ` int ` 层面进行、按 **有符号** 语义——` int8_t ` 的负值是真负值。这正是\"有符号 vs 无符号比较\"最容易踩反的地方。"}
   ```
 
3. 选择：` arm-none-eabi-gcc ` 默认把 ` char ` 当作有符号还是无符号？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**无符号** （ARM 上 ` char ` 默认 unsigned）；x86 上默认是有符号。所以 ` char c = getchar(); if (c == 0xFF) ` 在两个平台上行为相反。 *要符号明确，就用 ` signed char `/` unsigned char ` 或 ` int8_t `/` uint8_t `。*"}
   ```
 
4. 找错：` if (f == 3.14f) ` 为什么不可靠？正确写法是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"十进制小数  **3.14 不能精确表示** 为二进制浮点，` == ` 会因舍入误差失败。正确：` if (fabsf(f - 3.14f) < 1e-5f) `（记得 ` #include <math.h> `）。"}
   ```
 
5. 计算：小端 32 位机上 ` struct { uint8_t a; uint32_t b; } ` 的 ` sizeof ` 是多少？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**8** 。` a ` 占 1 字节，` b ` 需要 4 字节对齐，中间补 3 字节填充；整个结构体再按最大成员对齐到 4 的倍数。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  建议动手跑一遍 ` padding.c `，换成自己的结构体看看。

 

```zhizhan-assessment
{"id":"course-b01-ch1","criterion":"逐字节检查整数、结构体和浮点对象表示；区分标准保证、ABI 约定与本次观察。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 N1570 · 对象、类型与语言语义](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
