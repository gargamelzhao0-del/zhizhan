# 指针：从地址到硬件

```zhizhan-anchor
ch3
```



在嵌入式里，指针不只是数据结构工具，它是 **你与硬件对话的唯一通道** 。 ` *(volatile uint32_t *)0x40021018 = 0x10; ` 这一行之所以能点亮 LED，靠的全是指针语义。

 

> ◷ 约 125 分钟 · ◈ 全书承重章节 · ⚑ 内存模型 \+ 执行模型

 

```zhizhan-anchor
ch3-1
```



## 3.1 指针到底是什么：地址 \+ 类型

 

初学者常把指针理解成"存地址的变量"。这只说对了一半，而且漏掉的那一半才是关键。

 

◆ 指针 = 起始地址 \+ 类型（解释方式）

 

一个指针变量里确实只存了一个数字（地址）。但 **指针的类型决定了编译器如何解释这个地址上的数据** ： 读几个字节？按整数还是浮点解释？` p + 1 ` 前进多少字节？ 同一个地址值，用 ` uint8_t * ` 和 ` uint32_t * ` 去读，得到的完全是两个东西。

 

**FIG 3.1**  同一个地址 ` 0x20000000 `，两种指针类型，两种结果

 

```zhizhan-figure
<svg viewBox="0 0 660 308" width="660" height="308" role="img" aria-label="指针类型的解释差异">
          <defs>
            <marker id="ah4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
            <marker id="ah5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path>
            </marker>
          </defs>

          <!-- 内存块 -->
          <text x="30" y="26" class="sv-lbl-hi">SRAM 实际内容</text>
          <g>
            <rect x="30" y="38" width="62" height="40" class="sv-box"></rect>
            <text x="61" y="63" text-anchor="middle" class="sv-lbl-hi">0x78</text>
            <rect x="96" y="38" width="62" height="40" class="sv-box"></rect>
            <text x="127" y="63" text-anchor="middle" class="sv-lbl-hi">0x56</text>
            <rect x="162" y="38" width="62" height="40" class="sv-box"></rect>
            <text x="193" y="63" text-anchor="middle" class="sv-lbl-hi">0x34</text>
            <rect x="228" y="38" width="62" height="40" class="sv-box"></rect>
            <text x="259" y="63" text-anchor="middle" class="sv-lbl-hi">0x12</text>
          </g>
          <text x="61" y="94" text-anchor="middle" class="sv-lbl-dim">0x20000000</text>
          <text x="127" y="94" text-anchor="middle" class="sv-lbl-dim">+1</text>
          <text x="193" y="94" text-anchor="middle" class="sv-lbl-dim">+2</text>
          <text x="259" y="94" text-anchor="middle" class="sv-lbl-dim">+3</text>

          <!-- uint8_t* 路径 -->
          <path d="M 330 58 L 300 58" class="sv-arrow"></path>
          <rect x="336" y="38" width="290" height="40" rx="6" class="sv-cyn-s"></rect>
          <text x="350" y="56" class="sv-lbl-hi" style="fill:var(--cyn)">uint8_t *p8 = (uint8_t *)0x20000000;</text>
          <text x="350" y="72" class="sv-lbl" style="fill:var(--cyn)">*p8 == 0x78 &nbsp;·&nbsp; p8+1 前进 1 字节</text>

          <!-- uint32_t* 路径 -->
          <path d="M 330 152 L 300 152" stroke="var(--amb)" stroke-width="1.6" fill="none" marker-end="url(#ah5)"></path>
          <rect x="336" y="132" width="290" height="40" rx="6" class="sv-amb-s"></rect>
          <text x="350" y="150" class="sv-lbl-hi" style="fill:var(--amb)">uint32_t *p32 = (uint32_t *)0x20000000;</text>
          <text x="350" y="166" class="sv-lbl" style="fill:var(--amb)">*p32 == 0x12345678 &nbsp;·&nbsp; p32+1 前进 4 字节</text>

          <!-- 指针变量本身 -->
          <path d="M 259 100 L 259 120 L 400 120 L 400 132" stroke="var(--line-2)" stroke-width="1.2" stroke-dasharray="4 4" fill="none"></path>
          <text x="330" y="116" text-anchor="middle" class="sv-lbl-dim">同一个地址值，不同解释</text>

          <!-- 底部结论 -->
          <path d="M 30 196 L 630 196" class="sv-dash"></path>
          <text x="30" y="220" class="sv-lbl-hi" style="fill:var(--grn)">结论 1：解引用读到什么，由指针类型决定</text>
          <text x="30" y="242" class="sv-t">p8 读 1 字节 → 0x78　·　p32 读 4 字节并按小端拼装 → 0x12345678</text>
          <text x="30" y="268" class="sv-lbl-hi" style="fill:var(--grn)">结论 2：指针算术的步长，也由指针类型决定</text>
          <text x="30" y="288" class="sv-t">p8 + 1 → 地址 +1　·　p32 + 1 → 地址 +4　·　<tspan font-style="italic">指针加 1 永远是"跳过一个元素"，不是"跳过一个字节"</tspan></text>
        </svg>
```

 

这个认知是理解后面所有内容的基础。 **当你写 ` p + n ` 时，编译器实际生成的是 ` p + n * sizeof(*p) `** 。 这就是为什么指针算术必须以类型为前提。

 

```zhizhan-anchor
ch3-1-1
```



### 3.1.1 用代码验证指针算术

 

ptr\_arith.c C

 

```text
#include <stdio.h>
#include <stdint.h>

struct Frame {           /* 假设 sizeof = 12（含填充） */
    uint32_t id;
    uint16_t len;
    uint8_t  type;
};                       /* 4 + 2 + 1 + 1(pad) = 8 实际是 8 */

int main(void)
{
    uint8_t  a8[8];
    uint32_t a32[8];
    struct Frame fr[4];

    printf("sizeof(struct Frame) = %zu\n\n", sizeof(struct Frame));

    /* 用 uintptr_t 打印地址，避免 %p 的不确定性 */
    printf("uint8_t*  基数=%lu  步长=%lu\n",
           (unsigned long)(uintptr_t)a8,
           (unsigned long)((uintptr_t)(a8 + 1) - (uintptr_t)a8));

    printf("uint32_t* 基数=%lu  步长=%lu\n",
           (unsigned long)(uintptr_t)a32,
           (unsigned long)((uintptr_t)(a32 + 1) - (uintptr_t)a32));

    printf("Frame*    基数=%lu  步长=%lu\n",
           (unsigned long)(uintptr_t)fr,
           (unsigned long)((uintptr_t)(fr + 1) - (uintptr_t)fr));

    /* 指针相减：得到的是"元素个数"，不是字节数 */
    uint32_t *p = &a32[3];
    uint32_t *q = &a32[7];
    printf("\nq - p = %td  (元素个数，不是字节数)\n", q - p);
    printf("字节差  = %td\n", (uint8_t *)q - (uint8_t *)p);

    /* ✕ 经典错误：指针类型不匹配导致步长错误 */
    uint32_t buf[4] = {0x11111111, 0x22222222, 0x33333333, 0x44444444};
    uint8_t *bp = (uint8_t *)buf;          /* 强转成字节指针 */
    printf("\n*(buf+1)   = 0x%08X\n", *(buf + 1));    /* ✔ 0x22222222 */
    printf("*(bp+1)    = 0x%02X        ← 只前进 1 字节\n", *(bp + 1));
    return 0;
}
```

 

**输出**

 

```text
sizeof(struct Frame) = 8

uint8_t*  基数=140721234395136  步长=1
uint32_t* 基数=140721234395200  步长=4
Frame*    基数=140721234395328  步长=8

q - p = 4  (元素个数，不是字节数)
字节差  = 16

*(buf+1)   = 0x22222222
*(bp+1)    = 0x11        ← 只前进 1 字节，读到 0x11111111 的第二个字节
```

 

```zhizhan-anchor
ch3-1-2
```



### 3.1.2 void 指针：唯一的例外

 

` void * ` 是"无类型指针"，它 **只存地址，不携带类型信息** 。这意味着：

 

 
- **不能解引用** ：` *vp ` 是编译错误——编译器不知道读几个字节。
 
- **不能做算术** （标准 C 里）：` vp + 1 ` 在标准 C 中是非法的。 *GCC 扩展允许，等价于按字节前进，但不可移植。*
 
- **可以自由地和其他对象指针互相转换** ，不需要强转（C 里）。
 

 

void\_ptr.c — 泛型接口的标准写法 C

 

```text
#include <stddef.h>
#include <string.h>
#include <stdint.h>

/* 用 void* + 元素大小 实现泛型交换 —— 标准库 qsort 的做法 */
void swap_any(void *a, void *b, size_t elem_size)
{
    uint8_t tmp[64];                    /* 小对象用栈缓冲，避免动态分配 */
    uint8_t *pa = (uint8_t *)a;         /* 转成字节指针才能按字节搬运 */
    uint8_t *pb = (uint8_t *)b;

    if (elem_size > sizeof tmp) {
        /* 超大对象：用循环逐字节交换，不需要额外缓冲 */
        for (size_t i = 0; i < elem_size; i++) {
            uint8_t t = pa[i]; pa[i] = pb[i]; pb[i] = t;
        }
        return;
    }
    memcpy(tmp, pa, elem_size);
    memcpy(pa, pb, elem_size);
    memcpy(pb, tmp, elem_size);
}

/* -------------------- 嵌入式重要提醒 -------------------- */
/* ✕ void* 会丢掉类型信息，也就丢掉了编译器的类型检查。

   下面这个错误在编译期完全无法发现： */
void bad_api(void *data, size_t len);
/* 调用方传了 &float_var，实现里当成 uint32_t* 用
   → 链接通过、编译通过、运行期得到垃圾数据。

   ✔ 更安全的做法：用具体的类型，或者带上类型标签 */
typedef enum { VAL_INT, VAL_FLOAT, VAL_BYTES } val_type_t;
typedef struct {
    val_type_t type;
    union {
        int32_t  i;
        float    f;
        struct { uint8_t *p; size_t n; } bytes;
    } u;
} value_t;                                   /* tagged union，类型自描述 */
```

 

```zhizhan-anchor
ch3-1-3
```



### 3.1.3 ` const ` / ` volatile ` 到底加在指针的哪一侧

 

"指针 \+ 限定符"是 C 里最常读错的一处语法，而读错会直接变成 **改错了对象** 或 **丢掉了编译期检查** 。 规则只有一条，但它管住全部六种组合：

 

◆ 看 ` const `/` volatile ` 紧挨着 ` * ` 的哪一侧

 

紧挨在 ` * ` 的 **左边**  → 修饰的是 ` *p `（ **指向的内容** ）； 紧挨在 ` * ` 的 **右边**  → 修饰的是 ` p `（ **指针变量本身** ）。   
  *（也可以从右往左读英文：` const T *p ` = "p is a pointer to const T"； ` T * const p ` = "p is a const pointer to T"。）*

 

```zhizhan-table
{"rows":[[{"body":"写法","header":true,"rowSpan":1,"colSpan":1},{"body":"谁不能改","header":true,"rowSpan":1,"colSpan":1},{"body":"嵌入式里的典型用途","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` T *p `","header":false,"rowSpan":1,"colSpan":1},{"body":"都能改","header":false,"rowSpan":1,"colSpan":1},{"body":"普通可读写指针","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` const T *p `  \n（= ` T const *p `）","header":false,"rowSpan":1,"colSpan":1},{"body":"` *p = … ` 报错；` p = … ` 可以","header":false,"rowSpan":1,"colSpan":1},{"body":"只读接口参数：\"我保证不通过这个指针改你的数据\"。如 ` size_t crc8(const uint8_t *data, size_t len) `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` T * const p `","header":false,"rowSpan":1,"colSpan":1},{"body":"` p = … ` 报错；` *p = … ` 可以","header":false,"rowSpan":1,"colSpan":1},{"body":"初始化后就固定不变的句柄（指向哪块内存不许变，但内容要能改）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` const T * const p `","header":false,"rowSpan":1,"colSpan":1},{"body":"两者都不能改","header":false,"rowSpan":1,"colSpan":1},{"body":"既固定指向、又只读的表","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` volatile T *p `","header":false,"rowSpan":1,"colSpan":1},{"body":"内容每次访问都真读真写（\"不能改\"不适用）","header":false,"rowSpan":1,"colSpan":1},{"body":"**硬件寄存器、ISR 与主循环共享变量**  —— 这一侧才是你要的","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` T * volatile p `","header":false,"rowSpan":1,"colSpan":1},{"body":"指针变量本身每次真读","header":false,"rowSpan":1,"colSpan":1},{"body":"极少见：指针被别的上下文改（如中断里改一个指针的指向）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` volatile T * volatile p `","header":false,"rowSpan":1,"colSpan":1},{"body":"两者都每次真访问","header":false,"rowSpan":1,"colSpan":1},{"body":"更少见，通常只出现在寄存器地址本身也会变的场合","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ 硬件寄存器要的是 ` volatile T * `，不是 ` T * volatile `

 

访问寄存器时"内容会随时变，必须每次真读"—— 所以限定符要加在 ` * ` 左边： ` *(volatile uint32_t *)0x40021018 `。 把 ` volatile ` 加到指针变量自己身上（` uint32_t * volatile p `）， 约束的是"` p ` 这个变量别被优化进寄存器"， **指向的硬件却仍可能被当成普通内存**  —— 这不是你想要的，而且编译器不会提醒你。

 

```zhizhan-anchor
ch3-2
```



## 3.2 数组与指针：似是而非的关系

 

"数组名就是指针"——这句话流传极广，但 **它是错的** 。准确说法是：  *数组名在大多数表达式里会"退化"（decay）为指向首元素的指针，但数组本身不是指针。*

 

**FIG 3.2**  数组名的"退化"规则

 

```zhizhan-figure
<svg viewBox="0 0 660 232" width="660" height="232" role="img" aria-label="数组名退化规则">
          <rect x="20" y="18" width="300" height="90" rx="7" class="sv-grn-s"></rect>
          <text x="36" y="40" class="sv-lbl-hi" style="fill:var(--grn)">✕ 会退化（decay）为指针</text>
          <text x="36" y="62" class="sv-lbl-dim" style="font-size:11.5px">int a[10];</text>
          <text x="36" y="80" class="sv-lbl-dim" style="font-size:11.5px">int *p = a;          → a 变成 &amp;a[0]</text>
          <text x="36" y="98" class="sv-lbl-dim" style="font-size:11.5px">func(a);             → 传的是首元素地址</text>

          <rect x="340" y="18" width="300" height="90" rx="7" class="sv-amb-s"></rect>
          <text x="356" y="40" class="sv-lbl-hi" style="fill:var(--amb)">✓ 不会退化（保持数组类型）</text>
          <text x="356" y="62" class="sv-lbl-dim" style="font-size:11.5px">sizeof(a)            → 40，不是 8</text>
          <text x="356" y="80" class="sv-lbl-dim" style="font-size:11.5px">&amp;a                   → 类型是 int(*)[10]</text>
          <text x="356" y="98" class="sv-lbl-dim" style="font-size:11.5px">char s[] = "hi";     → 初始化时是数组</text>

          <path d="M 20 126 L 640 126" class="sv-dash"></path>

          <text x="20" y="152" class="sv-lbl-hi" style="fill:var(--cyn)">所以 &amp;a 和 a 的值相同，但类型不同 —— 这决定了指针算术的步长</text>
          <text x="20" y="176" class="sv-lbl" style="font-size:11.5px">a      → int*        ，a + 1 前进 4 字节（一个 int）</text>
          <text x="20" y="196" class="sv-lbl" style="font-size:11.5px">&amp;a     → int(*)[10] ，&amp;a + 1 前进 40 字节（整个数组）</text>
          <text x="20" y="220" class="sv-lbl-dim" style="font-size:11px">这就是"数组指针"和"指针数组"容易混淆的根源 —— 见 3.3 节</text>
        </svg>
```

 

记住： **数组名是一个"不可修改的左值"，类型是 ` int[10] `；它只是经常被自动转换成 ` int * `** 。 ` sizeof ` 和 ` & ` 是两个"不触发退化"的例外。

 

array\_vs\_ptr.c — 数组不是指针的铁证 C

 

```text
#include <stdio.h>

void func(int arr[])          /* 注意：这里的 arr 实际是指针！ */
{
    /* ✕ 千万别在函数里用 sizeof 求数组长度 —— 它拿到的是指针大小 */
    printf("  函数内 sizeof(arr) = %zu   ← 指针大小，不是数组大小！\n", sizeof(arr));
}

int main(void)
{
    int a[10] = {0};
    int *p = a;

    printf("sizeof(a) = %zu           ← 整个数组 40 字节\n", sizeof(a));
    printf("sizeof(p) = %zu            ← 指针 8 字节\n", sizeof(p));
    printf("sizeof(&a) = %zu           ← 数组指针也是 8 字节\n", sizeof(&a));

    printf("\na       = %p\n", (void *)a);
    printf("&a      = %p   ← 值相同\n", (void *)&a);
    printf("&a[0]   = %p   ← 值相同\n", (void *)&a[0]);

    /* 但步长不同！ */
    printf("\n(char*)(a+1)   - (char*)a   = %td 字节\n", (char *)(a + 1) - (char *)a);
    printf("(char*)(&a+1)  - (char*)&a  = %td 字节  ← 整个数组\n",
           (char *)(&a + 1) - (char *)&a);

    /* 数组名不能被赋值 —— 它不是左值 */
    /* a = p;   ✕ 编译错误：array type is not assignable */

    func(a);   /* 这里 a 退化成 int* */
    return 0;
}
```

 

⚠ 这是嵌入式里最常见的数组 bug

 

array\_bug.c C

 

```text
/* ✕ 错误：以为 sizeof 能得到数组长度 */
void send_bad(const uint8_t *buf)
{
    size_t n = sizeof(buf);        /* 得到的是指针大小（4 或 8），不是缓冲区长度！ */
    /* 在 32 位 MCU 上 n = 4，于是只发了 4 个字节，其余数据丢失 */
    uart_write(buf, n);
}

/* ✔ 正确：长度必须显式传参 */
void send_good(const uint8_t *buf, size_t len)
{
    uart_write(buf, len);
}

/* ✔ 或者用宏在"数组还在作用域内"时求出元素个数 */
#define ARRAY_SIZE(arr) (sizeof(arr) / sizeof((arr)[0]))
/* 注意：这个宏只对真正的数组有效，传指针进去会得到错误结果。
   防御性写法（编译期检测）： */
#define ARRAY_SIZE_SAFE(arr) \
    ((void)sizeof(char[1 - 2 * __builtin_types_compatible_p( \
        __typeof__(arr), __typeof__(&(arr)[0]))]), \
     (sizeof(arr) / sizeof((arr)[0])))
```

 

` ARRAY_SIZE_SAFE ` 的原理：真数组 ` a ` 的 ` __typeof__(a) ` 是 ` int[10] `， 而 ` __typeof__(&(a)[0]) ` 是 ` int* `，两者 **不兼容**  → 内置函数返回 0 → 数组维度算得 ` 1 `，合法； 传入指针 ` p ` 时两边都是 ` int* ` → 返回 1 → 维度算得 ` -1 `， ` sizeof(char[-1]) ` 直接 **编译报错** 。报错原文形如：

 

编译报错stderr

 

```text
error: size of array 'char[-1]' is negative

数组维度在编译期就必须是正常量，负数直接判错。
注意报错落在"宏展开处"，栈回溯会指向宏定义那一行，而不是你的调用点——
这是这类技巧唯一的易用性代价。
```

 

⚠ 极易抄错的细节：检查项绝不能参与求和

 

网上流传的版本写成 ` sizeof(arr)/sizeof((arr)[0]) + sizeof(char[1 - 2 * …]) `。 指针场景它确实会报错，看起来"能用"；但传 **真数组** 时那个检查项求值为 ` 1 `， 会被 **加进结果** ——` ARRAY_SIZE_SAFE(a) ` 得到  **11**  而不是 10。 正确写法必须让检查项作废：` ((void)sizeof(…), sizeof(arr)/sizeof((arr)[0])) `， 用逗号表达式先执行检查、丢弃结果（本章 3.5 节的 ` MUST_BE_ARRAY ` 就是这个写法）。

 

两个使用限制：` __typeof__ ` 与 ` __builtin_types_compatible_p ` 都是  **GCC/Clang 扩展** 、不是标准 C，必须用 ` -std=gnu11 ` 而不是 ` -std=c11 `； 从 C11 起，这类需求更推荐 ` _Static_assert `，可移植性更好。

 

```zhizhan-anchor
ch3-3
```



## 3.3 函数指针：嵌入式的核心武器

 

如果说指针是 C 的灵魂，那么 **函数指针就是嵌入式 C 的战术核心** 。 它实现了三件在裸机环境里极其重要的事： *回调、跳转表、驱动抽象层* 。

 

```zhizhan-anchor
ch3-3-1
```



### 3.3.1 语法：先读懂再写

 

func\_ptr\_syntax.c — 函数指针语法的读法 C

 

```text
#include <stdint.h>

/* 目标：声明一个指向"接收 uint8_t 返回 int"的函数的指针 */

/* ① 最直白的写法 */
int (*fp1)(uint8_t);        /* fp1 是"指向函数的指针"，该函数接收 uint8_t 返回 int */

/* ② 用 typedef 简化（强烈推荐，可读性天差地别） */
typedef int (*handler_t)(uint8_t);
handler_t fp2;              /* 等价于上面 */

typedef int handler_func_t(uint8_t);   /* 这是"函数类型"，不是指针类型 */
handler_func_t *fp3;        /* 等价于 fp1 */
handler_func_t  f_decl;     /* 这是函数声明，不是变量！ */

/* ---------- 语法的"从内向外"读法 ----------
   int (*fp1)(uint8_t);
       ^^^^                          fp1 是
              ^^^^^^^^               一个指针
       ^^^              ^^^^^^^^^    指向函数，接收 uint8_t
   int                            返回 int
------------------------------------------------ */

/* ---------- 最容易混淆的三组 ---------- */

int  *f_arr[5];        /* ① 指针数组：5 个元素的数组，每个元素是 int*      */
int (*f_ptr)[5];       /* ② 数组指针：一个指针，指向含 5 个 int 的数组     */
int (*f_fn[5])(void);  /* ③ 函数指针数组：5 个元素的数组，每个元素是函数指针 */
                       /*    ← 这个就是"跳转表" */

/* 记忆口诀：[ ] 的优先级高于 *，所以带括号的先结合指针 */

/* ---------- 实际使用 ---------- */
static int handle_led(uint8_t v)   { return v + 1; }
static int handle_uart(uint8_t v)  { return v + 2; }

/* ③ 跳转表：按命令字直接索引到处理函数，O(1)，无分支 */
static int (*const g_dispatch[4])(uint8_t) = {
    handle_led,
    handle_uart,
    NULL,                    /* 预留，调用前必须判空 */
    handle_led,
};

int dispatch(uint8_t cmd, uint8_t arg)
{
    /* ✔ 边界检查 + 空指针检查，一个都不能少 */
    if (cmd >= 4 || g_dispatch[cmd] == NULL) {
        return -1;
    }
    return g_dispatch[cmd](arg);      /* 通过函数指针调用 */
}
```

 

```zhizhan-anchor
ch3-3-2
```



### 3.3.2 应用一：回调机制（解耦的基石）

 

callback.c — 让驱动层不用知道上层逻辑 C

 

```text
#include <stdint.h>
#include <stddef.h>

/* ============ 驱动层（uart.c）—— 只依赖抽象，不依赖具体业务 ============ */

typedef void (*uart_rx_cb_t)(const uint8_t *data, size_t len, void *user);

typedef struct {
    uart_rx_cb_t on_rx;       /* 收到数据的回调 */
    void        *user;        /* 回调时原样传回的用户数据（上下文） */
} uart_cfg_t;

static uart_cfg_t g_cfg;

void uart_init(const uart_cfg_t *cfg)
{
    g_cfg = *cfg;
}

/* 中断服务程序：收到数据后触发回调 */
void USART1_IRQHandler(void)
{
    static uint8_t buf[64];
    static size_t  n;

    buf[n++] = read_uart_data_register();

    if (n >= 64 || is_frame_end()) {
        if (g_cfg.on_rx) {                        /* ✔ 必须判空！ */
            g_cfg.on_rx(buf, n, g_cfg.user);      /* 把上下文透传给上层 */
        }
        n = 0;
    }
}

/* ============ 应用层（app.c）—— 关心业务，不关心硬件 ============ */

typedef struct {
    uint32_t frame_count;
    uint8_t  last_cmd;
} app_ctx_t;

static void on_frame_received(const uint8_t *data, size_t len, void *user)
{
    app_ctx_t *ctx = (app_ctx_t *)user;    /* 恢复上下文，无需全局变量 */
    if (!ctx || len == 0) return;

    ctx->frame_count++;
    ctx->last_cmd = data[0];
    /* 业务处理... */
}

void app_start(void)
{
    static app_ctx_t ctx = {0};            /* 上下文由应用层自己管理 */

    uart_cfg_t cfg = {
        .on_rx = on_frame_received,
        .user  = &ctx,                      /* 把上下文挂上去 */
    };
    uart_init(&cfg);
}
```

 

◆ 这个模式的价值：user 上下文指针

 

回调最大的问题是"回调函数怎么拿到它需要的数据"。新手常写全局变量，导致： **无法实例化多份、难以测试、中断里访问全局变量有竞争风险** 。   
  
 标准解法就是那个 ` void *user `—— *注册回调时把上下文一起传进去，回调时原样传回* 。 这是 C 语言里实现"闭包"的惯用手法，Linux 内核、[FreeRTOS](term:rtos)、lwIP 全都这么干。

 

```zhizhan-anchor
ch3-3-3
```



### 3.3.3 应用二：状态机跳转表

 

这是函数指针在嵌入式里最经典的应用。对比一下三种实现：

 

state\_machine.c — 从 switch 到跳转表的演进 C

 

```text
#include <stdint.h>
#include <stddef.h>

/* ==================== 方案 A：switch-case（易懂，但会膨胀）==================== */
typedef enum { ST_IDLE, ST_HEAD, ST_BODY, ST_CRC, ST_DONE, ST_MAX } state_t;

state_t fsm_switch(state_t st, uint8_t byte)
{
    switch (st) {
    case ST_IDLE:
        if (byte == 0xAA) return ST_HEAD;
        return ST_IDLE;
    case ST_HEAD:
        return (byte == 0x55) ? ST_BODY : ST_IDLE;
    case ST_BODY:
        return (byte == 0x0D) ? ST_CRC : ST_BODY;
    case ST_CRC:
        return ST_DONE;
    default:
        return ST_IDLE;
    }
}
/* 优点：直观。缺点：状态一多就臃肿；每个字节都要做跳转判断 */

/* ==================== 方案 B：函数指针跳转表（推荐）==================== */

typedef struct fsm_s fsm_t;
typedef state_t (*state_fn_t)(fsm_t *fsm, uint8_t byte);

struct fsm_s {
    state_t     cur;
    uint8_t     buf[128];
    uint16_t    len;
};

/* 每个状态一个函数，职责单一，易测试 */
static state_t st_idle(fsm_t *f, uint8_t b)
{
    if (b == 0xAA) { f->len = 0; return ST_HEAD; }
    return ST_IDLE;
}

static state_t st_head(fsm_t *f, uint8_t b)
{
    (void)f;
    return (b == 0x55) ? ST_BODY : ST_IDLE;
}

static state_t st_body(fsm_t *f, uint8_t b)
{
    if (b == 0x0D) return ST_CRC;
    if (f->len < sizeof f->buf) f->buf[f->len++] = b;
    else return ST_IDLE;                    /* 溢出保护 → 回 IDLE */
    return ST_BODY;
}

static state_t st_crc(fsm_t *f, uint8_t b)
{
    (void)f; (void)b;
    return ST_DONE;
}

static state_t st_done(fsm_t *f, uint8_t b)
{
    (void)b;
    f->cur = ST_IDLE;
    return ST_IDLE;
}

/* 状态转移表：加新状态只需在这里加一行，不用改任何逻辑 */
static const state_fn_t g_state_table[ST_MAX] = {
    [ST_IDLE] = st_idle,
    [ST_HEAD] = st_head,
    [ST_BODY] = st_body,
    [ST_CRC]  = st_crc,
    [ST_DONE] = st_done,
};

/* 核心循环只有两行 —— 与状态数量无关，O(1) */
void fsm_feed(fsm_t *fsm, const uint8_t *data, size_t n)
{
    for (size_t i = 0; i < n; i++) {
        state_fn_t fn = g_state_table[fsm->cur];
        if (fn) {
            fsm->cur = fn(fsm, data[i]);
        } else {
            fsm->cur = ST_IDLE;             /* 防御：无效状态自恢复 */
        }
    }
}
```

 

| 维度 | switch-case | 函数指针跳转表 |
| --- | --- | --- |
| **可读性** | 状态少时更直观 | 状态多时更清晰，每个状态独立成函数 |
| **扩展性** | 加状态要改 switch，易漏改 | 加一行表项即可，逻辑不动 |
| **可测试性** | 只能整体测 | 每个状态函数可单独单元测试 |
| **执行效率** | 状态多时是跳转表或比较链 | O(1) 直接索引，无比较 |
| **Flash 占用** | 通常更小 | 表本身占空间（每项 4 字节） |
| **代码复用** | 难以复用 | 状态函数可在多个状态机间复用 |

 

```zhizhan-anchor
ch3-3-4
```



### 3.3.4 应用三：硬件抽象层（HAL 的本质）

 

这是函数指针最有价值的用法。 **你现在用的 HAL 库、RTOS 的设备驱动模型，底层都是这个结构** 。

 

hal\_ops.c — 用函数指针实现驱动抽象 C

 

```text
#include <stdint.h>
#include <stddef.h>

/* ============ ① 抽象接口：定义"一个串口应该能做什么" ============ */
typedef struct uart_dev uart_dev_t;

typedef struct {
    int  (*init)   (uart_dev_t *dev, uint32_t baud);
    int  (*write)  (uart_dev_t *dev, const uint8_t *buf, size_t len);
    int  (*read)   (uart_dev_t *dev, uint8_t *buf, size_t len);
    int  (*deinit) (uart_dev_t *dev);
} uart_ops_t;

/* 设备基类：所有具体串口都以此开头 */
struct uart_dev {
    const uart_ops_t *ops;      /* ← 虚函数表，等价于 C++ 的 vtable */
    void             *priv;     /* 具体驱动的私有数据 */
};

/* ============ ② 上层只依赖抽象，不依赖任何具体芯片 ============ */
static inline int uart_write(uart_dev_t *d, const uint8_t *b, size_t n)
{
    /* 统一入口：参数校验 + 分发，业务代码只调这个 */
    if (!d || !d->ops || !d->ops->write) return -1;
    return d->ops->write(d, b, n);
}

/* ============ ③ 具体实现 A：STM32 ============ */
typedef struct {
    uint32_t instance;          /* 如 USART1 的基地址 */
} stm32_uart_priv_t;

static int stm32_uart_write(uart_dev_t *dev, const uint8_t *buf, size_t len)
{
    stm32_uart_priv_t *p = (stm32_uart_priv_t *)dev->priv;
    for (size_t i = 0; i < len; i++) {
        while (!(*(volatile uint32_t *)(p->instance + 0x00) & (1u << 7))) { }
        *(volatile uint32_t *)(p->instance + 0x04) = buf[i];
    }
    return (int)len;
}
static const uart_ops_t stm32_uart_ops = {
    .init = NULL, .write = stm32_uart_write, .read = NULL, .deinit = NULL,
};

/* ============ ④ 具体实现 B：ESP32 ============ */
static int esp32_uart_write(uart_dev_t *dev, const uint8_t *buf, size_t len)
{
    (void)dev;
    /* ESP32 的 FIFO 写入逻辑... */
    return (int)len;
}
static const uart_ops_t esp32_uart_ops = {
    .init = NULL, .write = esp32_uart_write, .read = NULL, .deinit = NULL,
};

/* ============ ⑤ 使用：上层代码完全不变，换平台只需换 ops ============ */
void send_banner(uart_dev_t *log_uart)
{
    const uint8_t msg[] = "System boot OK\r\n";
    uart_write(log_uart, msg, sizeof msg - 1);   /* ← 一行代码，两个平台通用 */
}
```

 

◆ 这就是"面向对象 C"

 

` struct uart_dev ` 里的 ` ops ` 指针，就是 C\+\+ 的虚函数表（vtable）； ` uart_dev_t * ` 就是基类指针。区别只是：C 里 **你得手动写这套机制** ，而 C\+\+ 编译器替你生成。   
  
  **Linux 内核的 ` file_operations `、` platform_driver `，FreeRTOS 的设备框架，全都是这个结构。**  看懂这一段，你就拿到了阅读内核驱动代码的钥匙。Module 07 会继续展开。

 

```zhizhan-anchor
ch3-4
```



## 3.4 指针与硬件寄存器映射

 

现在回到最核心的问题： **为什么 ` *(volatile uint32_t *)0x40021018 ` 能操作硬件？**

 

◆ 答案：因为 Cortex-M 是统一编址的

 

在 ARM Cortex-M 的内存映射里， **外设寄存器被分配在固定的物理地址区间** ， 和 SRAM、Flash 共享同一个 4 GB 地址空间。地址总线把落在外设区间的访问路由到外设控制器，而不是内存。   
  
 所以"写寄存器"和"写变量"在指令层面 *完全一样* ——都是 ` str ` 指令。  **区别只在于地址落到了哪里，以及该地址是否必须用 ` volatile ` 访问** 。

 

**FIG 3.3**  Cortex-M 内存映射（简化版）

 

```zhizhan-figure
<svg viewBox="0 0 660 340" width="660" height="340" role="img" aria-label="Cortex-M 内存映射图">
          <rect x="40" y="14" width="250" height="46" rx="6" class="sv-box" stroke="var(--vio)"></rect>
          <text x="56" y="34" class="sv-lbl-hi" style="fill:var(--vio)">0xE000_0000 – 0xE00F_FFFF</text>
          <text x="56" y="52" class="sv-t">系统控制空间 · NVIC / SysTick / SCB</text>

          <rect x="40" y="66" width="250" height="56" rx="6" class="sv-box" stroke="var(--red)"></rect>
          <text x="56" y="86" class="sv-lbl-hi" style="fill:var(--red)">0x4000_0000 – 0x5FFF_FFFF</text>
          <text x="56" y="104" class="sv-t">外设区 · GPIO / UART / SPI / TIM</text>
          <text x="56" y="118" class="sv-lbl-dim">↑ 你写的每个寄存器都在这里</text>

          <rect x="40" y="130" width="250" height="46" rx="6" class="sv-box" stroke="var(--amb)"></rect>
          <text x="56" y="150" class="sv-lbl-hi" style="fill:var(--amb)">0x2000_0000 – 0x3FFF_FFFF</text>
          <text x="56" y="168" class="sv-t">SRAM · 变量 / 栈 / 堆</text>

          <rect x="40" y="184" width="250" height="46" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="56" y="204" class="sv-lbl-hi" style="fill:var(--grn)">0x0800_0000 – 0x0FFF_FFFF</text>
          <text x="56" y="222" class="sv-t">Flash · 代码 / 常量表</text>

          <rect x="40" y="238" width="250" height="46" rx="6" class="sv-box"></rect>
          <text x="56" y="258" class="sv-lbl-hi">0x0000_0000 – 0x1FFF_FFFF</text>
          <text x="56" y="276" class="sv-t">代码区 · 复位后从这里取向量表</text>

          <!-- 右侧说明 -->
          <path d="M 300 89 L 340 89" class="sv-arrow"></path>
          <rect x="346" y="46" width="298" height="88" rx="7" class="sv-red-s"></rect>
          <text x="362" y="68" class="sv-lbl-hi" style="fill:var(--red)">示例：GPIOB 的寄存器</text>
          <text x="362" y="90" class="sv-lbl-dim" style="font-size:11px">#define GPIOB_CRL  (*(volatile uint32_t*)0x40010C00)</text>
          <text x="362" y="108" class="sv-lbl-dim" style="font-size:11px">#define GPIOB_IDR  (*(volatile uint32_t*)0x40010C08)</text>
          <text x="362" y="126" class="sv-lbl-dim" style="font-size:11px">#define GPIOB_ODR  (*(volatile uint32_t*)0x40010C0C)</text>

          <path d="M 300 157 L 340 157" class="sv-arrow" stroke="var(--amb)"></path>
          <rect x="346" y="146" width="298" height="66" rx="7" class="sv-amb-s"></rect>
          <text x="362" y="168" class="sv-lbl-hi" style="fill:var(--amb)">SRAM 里的普通变量</text>
          <text x="362" y="188" class="sv-lbl-dim" style="font-size:11px">int counter;   → 0x2000_01A4 之类</text>
          <text x="362" y="204" class="sv-lbl-dim" style="font-size:11px">无需 volatile（除非被中断/DMA 访问）</text>

          <path d="M 300 297 L 340 297" class="sv-arrow" stroke="var(--vio)"></path>
          <rect x="346" y="258" width="298" height="66" rx="7" class="sv-grn-s"></rect>
          <text x="362" y="280" class="sv-lbl-hi" style="fill:var(--grn)">关键区别</text>
          <text x="362" y="300" class="sv-lbl-dim" style="font-size:11px">同一台机器、同一条 str 指令，</text>
          <text x="362" y="316" class="sv-lbl-dim" style="font-size:11px">只是地址不同 → 硬件替你完成了动作</text>
        </svg>
```

 

注意 ` 0x40010C00 ` 这类地址是 **芯片手册规定的** ，不是随便编的。 写驱动第一步永远是查参考手册（Reference Manual）的 Memory Map 章节。

 

```zhizhan-anchor
ch3-4-1
```



### 3.4.1 寄存器映射的三种写法（从差到好）

 

reg\_map.c — 三种寄存器定义方式对比 C

 

```text
#include <stdint.h>

/* ============ 写法 ①：裸地址（能跑，但不可维护）============ */
void led_on_v1(void)
{
    /* 每个数字都要对应手册，改一处要全文搜索替换 */
    *(volatile uint32_t *)0x40021018 |= (1u << 3);   /* RCC 使能 GPIOB */
    *(volatile uint32_t *)0x40010C00 &= ~(0xFu << 0);
    *(volatile uint32_t *)0x40010C00 |=  (0x3u << 0);
    *(volatile uint32_t *)0x40010C0C |=  (1u << 0);  /* PB0 = 1 */
}

/* ============ 写法 ②：宏定义（官方库风格，可读性好）============ */
#define PERIPH_BASE     0x40000000UL
#define APB2PERIPH_BASE (PERIPH_BASE + 0x10000UL)
#define GPIOB_BASE      (APB2PERIPH_BASE + 0x0C00UL)

#define GPIOB_CRL  (*(volatile uint32_t *)(GPIOB_BASE + 0x00UL))
#define GPIOB_CRH  (*(volatile uint32_t *)(GPIOB_BASE + 0x04UL))
#define GPIOB_IDR  (*(volatile uint32_t *)(GPIOB_BASE + 0x08UL))
#define GPIOB_ODR  (*(volatile uint32_t *)(GPIOB_BASE + 0x0CUL))

#define RCC_BASE      (PERIPH_BASE + 0x21000UL)
#define RCC_APB2ENR   (*(volatile uint32_t *)(RCC_BASE + 0x18UL))

void led_on_v2(void)
{
    RCC_APB2ENR |= (1u << 3);
    GPIOB_CRL &= ~(0xFu << 0);
    GPIOB_CRL |=  (0x3u << 0);
    GPIOB_ODR |=  (1u << 0);
}

/* ============ 写法 ③：结构体映射（推荐，最清晰）============ */
typedef struct {
    volatile uint32_t CRL;    /* 0x00 端口配置低寄存器 */
    volatile uint32_t CRH;    /* 0x04 端口配置高寄存器 */
    volatile uint32_t IDR;    /* 0x08 输入数据寄存器   */
    volatile uint32_t ODR;    /* 0x0C 输出数据寄存器   */
    volatile uint32_t BSRR;   /* 0x10 位设置/清除寄存器 */
    volatile uint32_t BRR;    /* 0x14 位清除寄存器      */
    volatile uint32_t LCKR;   /* 0x18 配置锁定寄存器    */
} GPIO_TypeDef;

typedef struct {
    volatile uint32_t CR;
    volatile uint32_t CFGR;
    volatile uint32_t CIR;
    volatile uint32_t APB2RSTR;
    volatile uint32_t APB1RSTR;
    volatile uint32_t AHBENR;
    volatile uint32_t APB2ENR;   /* 偏移 0x18 */
    /* ... */
} RCC_TypeDef;

/* 把地址"翻译"成指针，只需要一次强转 */
#define GPIOB  ((GPIO_TypeDef *)0x40010C00UL)
#define RCC    ((RCC_TypeDef  *)0x40021000UL)

void led_on_v3(void)
{
    RCC->APB2ENR |= (1u << 3);           /* 读起来就像在操作对象 */
    GPIOB->CRL  &= ~(0xFu << 0);
    GPIOB->CRL  |=  (0x3u << 0);
    GPIOB->ODR  |=  (1u << 0);
}

/* ============ 附加技巧：BSRR 原子置位/复位 ============ */
/* STM32 的 BSRR 寄存器：低 16 位写 1 置位，高 16 位写 1 复位
   —— 单次写操作完成，天然原子，不需要读-改-写，中断安全 */
static inline void gpio_set(GPIO_TypeDef *port, uint8_t pin)
{
    port->BSRR = (1u << pin);                  /* 原子置位 */
}
static inline void gpio_reset(GPIO_TypeDef *port, uint8_t pin)
{
    port->BSRR = (1u << (pin + 16));           /* 原子复位 */
}
/* 对比：port->ODR |= (1u<<pin) 是读-改-写三步，可能被中断打断 */
```

 

✔ 写法 ③ 的三个额外好处

 

 
1. **可用 ` _Static_assert ` 校验偏移量** （见 Module 01），把手册上的地址变成编译期检查。
 
2. **调试器里可以直接展开** 。用 ` GPIOB->ODR ` 这种形式，在 IDE 的 watch 窗口里能看到结构体树形展开，比裸地址友好得多。
 
3. **可以用 ` .bss ` 之外的方式放多个实例** 。比如把同一套结构体映射到 GPIOA/GPIOB/GPIOC，传参即可，代码复用率高。

 

```zhizhan-anchor
ch3-5
```



## 3.5 指针安全：五类致命错误

 

```zhizhan-table
{"rows":[[{"body":"错误类型","header":true,"rowSpan":1,"colSpan":1},{"body":"成因","header":true,"rowSpan":1,"colSpan":1},{"body":"典型症状与防御","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**野指针**   \nwild pointer","header":false,"rowSpan":1,"colSpan":1},{"body":"指针未初始化就使用，值是栈上的垃圾数据","header":false,"rowSpan":1,"colSpan":1},{"body":"随机地址写入 → 静默破坏别的变量。  \n **防御** ：声明即初始化 ` int *p = NULL; `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**悬空指针**   \ndangling","header":false,"rowSpan":1,"colSpan":1},{"body":"指向的对象已销毁（局部变量出作用域 / 内存已 free）","header":false,"rowSpan":1,"colSpan":1},{"body":"读到的是\"看起来合理\"的旧数据，或已被复用。  \n **防御** ：销毁后立即置 NULL；绝不用局部变量地址做返回值","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**越界访问**","header":false,"rowSpan":1,"colSpan":1},{"body":"索引超出数组范围，指针算术跑出有效区间","header":false,"rowSpan":1,"colSpan":1},{"body":"踩坏相邻变量（可能是另一个缓冲区或栈帧）。  \n **防御** ：所有循环边界用 ` ARRAY_SIZE ` 宏；开启 ` -fsanitize=bounds `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**类型不匹配**","header":false,"rowSpan":1,"colSpan":1},{"body":"强转后按错误的类型解释内存（违反严格别名）","header":false,"rowSpan":1,"colSpan":1},{"body":"` -O2 ` 下行为异常，` -O0 ` 下正常——典型优化相关 bug。  \n **防御** ：用 ` memcpy ` 或 ` union ` 做类型双关","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**空指针解引用**","header":false,"rowSpan":1,"colSpan":1},{"body":"忘记判空，或回调注册时传了 NULL","header":false,"rowSpan":1,"colSpan":1},{"body":"Cortex-M 的地址 0 属于  **Code 区别名** （BOOT0=0 时映射到 Flash 起始，也就是向量表）。  \n  **读**  ` *p ` 通常 **静默成功** ——你拿到的是 ` _estack ` 的值，程序继续跑，问题在后面某个毫不相干的地方爆发，这比崩溃更难查；  \n  **写**  ` *p = x ` 才触发 BusFault → HardFault（因为 Code 区不可写）。  \n  **防御** ：所有指针参数入口判空；回调调用前判空；开 ` SCB->SHCSR ` 的 ` USGFAULTENA ` 让用法错误更早暴露","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

ptr\_safety.c — 防御性写法模板 C

 

```text
#include <stdint.h>
#include <string.h>
#include <stddef.h>

/* ---------- ① 绝不要返回局部变量的地址 ---------- */
char *bad_get_name(void)
{
    char buf[32] = "sensor";
    return buf;                 /* ✕ buf 在函数返回后立即失效 */
}

/* ✔ 方案 A：调用方提供缓冲区（嵌入式首选，无动态分配） */
int get_name(char *out, size_t out_size)
{
    const char *name = "sensor";
    size_t n = strlen(name);
    if (out_size <= n) return -1;         /* ✔ 边界检查 */
    memcpy(out, name, n + 1);
    return 0;
}

/* ✔ 方案 B：返回静态/常量字符串（只读场景） */
const char *get_name_static(void)
{
    return "sensor";            /* 字符串字面量在 .rodata，生命周期贯穿全程 */
}

/* ---------- ② 释放后置空，避免二次释放 ---------- */
void safe_free(void **pp)
{
    if (pp && *pp) {           /* ✔ 双重检查，容忍传 NULL 进来 */
        my_pool_free(*pp);
        *pp = NULL;             /* ✔ 关键：置空，防止悬空 */
    }
}

/* ---------- ③ 严格别名：正确的类型双关方式 ---------- */
float u32_to_float_bad(uint32_t u)
{
    return *(float *)&u;        /* ✕ 违反严格别名规则，-O2 下可能出错 */
}
float u32_to_float_good(uint32_t u)
{
    float f;
    memcpy(&f, &u, sizeof f);   /* ✔ 编译器会优化成单条指令，零开销 */
    return f;
}

/* ---------- ④ 缓冲区的"安全带"：哨兵 + 长度校验 ----------
   ⚠ 注意：这是一个【线性】的定长字节缓冲 —— 写满就拒绝，
     永远不会回绕，它不是环形缓冲区。
     环形缓冲区见 6.4，那里才叫 ringbuf_t（head/tail/mask 那套）。
     两者名字必须区分开，否则读代码的人会以为是同一个东西。 */
typedef struct {
    uint8_t  data[64];
    size_t   len;                /* 必须与 data 同步维护 */
    uint32_t magic;              /* 魔数：检测结构体是否被踩 */
} bytebuf_t;

#define BYTEBUF_MAGIC 0x42595445u   /* "BYTE" */

int bytebuf_push(bytebuf_t *bb, uint8_t byte)
{
    if (!bb || bb->magic != BYTEBUF_MAGIC) return -1;   /* ✔ 完整性检查 */
    if (bb->len >= sizeof bb->data) return -1;          /* ✔ 容量检查 */
    bb->data[bb->len++] = byte;
    return 0;
}

/* ---------- ⑤ 编译期辅助：断言指针的预期类型 ---------- */
#define MUST_BE_ARRAY(arr) \
    ((void)sizeof(char[1 - 2 * __builtin_types_compatible_p( \
        __typeof__(arr), __typeof__(&(arr)[0]))]))

/* 如果传指针进来，编译期直接报错 */
```

 

✔ 嵌入式指针安全的三条实用准则

 

 
1. **所有接收指针的函数，第一件事是判空** 。这一行的成本是一个 ` cmp ` \+ 条件跳转，换来的是避免整个系统崩掉。
 
2. **所有接收"缓冲区 \+ 长度"的接口，第二件事是检查长度** 。缓冲区溢出是嵌入式设备最严重的安全漏洞来源。
 
3. **开启编译器的全部警告** ：` -Wall -Wextra -Wpointer-arith -Wcast-align -Wstrict-aliasing=2 -Wnull-dereference `。 *警告不是噪音，是免费的代码审查。*

 

```zhizhan-anchor
ch3-6
```



## 3.6 指针宽度：把"假设"写成编译期护栏

 

§3.1 说"指针就是地址"。但地址本身有多宽、一个指针能不能安全地装进一个整数里，这件事  **在不同平台上答案不同** 。嵌入式工程里最常见的移植事故，不是指针用错， 而是代码里藏着一个 **从没写下来的宽度假设** ——在 32 位 ARM 上跑得好好的代码， 挪去做主机单元测试、或者换一颗 64 位内核，就在某个深夜崩掉。

 

◆ 把假设变成编译错误，成本是零

 

把"我以为 ` sizeof(void *) == 4 `"写成 ` _Static_assert `， 编译器在 **编译期** 求值：成立就什么也不生成，不成立就直接拒绝编译。 于是这个假设一旦失效，你在 **敲下 make 的那一秒** 就知道， 而不是等设备到了客户手里才发现。 *这正是 Module 01 里 ` _Static_assert ` 最值得用的场景。*

 

```zhizhan-anchor
ch3-6-1
```



### 3.6.1 三条护栏：指针宽度、整数装指针、指针差值

 

ptr\_guard.c — 三条编译期护栏 C

 

```text
#include <stdint.h>
#include <stddef.h>

/* 三条编译期护栏：不成立就编译失败，不会拖到上板才诡异 */
_Static_assert(sizeof(void *) == 4,             "本工程假设 32 位指针");
_Static_assert(sizeof(void *) == sizeof(uintptr_t), "uintptr_t 必须装得下指针");
_Static_assert(sizeof(intptr_t) == sizeof(void *),  "intptr_t 必须能表示指针差值");

/* 指针 → 整数：唯一可移植的写法是走 uintptr_t */
uint32_t addr_of(const void *p) { return (uint32_t)(uintptr_t)p; }
void    *ptr_of(uint32_t a)     { return (void *)(uintptr_t)a; }

/* 指针差值用 ptrdiff_t：它是有符号的，可能为负 */
ptrdiff_t gap(const int *a, const int *b) { return a - b; }
```

 

**bash**  — 实测编译（arm-none-eabi-gcc 13.3.1 ` -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c ptr_guard.c -o ptr_guard.o
$ echo $?
0

（-Wall -Wextra 下也没有任何输出 —— 三条断言全部成立）
```

 

注意这份文件 **没有 ` main `** ：三条断言的检查全部发生在编译期， 所以只加 ` -c `（只编译不链接）就足以验完。 这也是它适合放进构建体系的原因—— **不需要跑起来就能拦人** 。

 

```zhizhan-anchor
ch3-6-2
```



### 3.6.2 反面教材：护栏该拦住的，正是这种改动

 

护栏有没有用，不看它通过的时候，看它 **拦住的时候** 。 下面这份文件和上一份只差一个数字——把 ` 4 ` 写成了 ` 8 `， 模拟"有人把代码拷到了 64 位平台、但以为宽度没变"：

 

ptr\_guard\_fail.c — 反面教材：护栏该拦住的就是这种改动 C

 

```text
#include <stdint.h>
_Static_assert(sizeof(void *) == 8, "32-bit pointers expected on this target");
```

 

**bash**  — 实测编译失败（就是为了看这句话）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c ptr_guard_fail.c -o ptr_guard_fail.o
ptr_guard_fail.c:2:1: error: static assertion failed: "32-bit pointers expected on this target"
    2 | _Static_assert(sizeof(void *) == 8, "32-bit pointers expected on this target");
      | ^~~~~~~~~~~~~~

→ 编译失败，构建停在原地。这就是我们要的效果：
  编译器的诊断里【原样带出】了断言消息，读的人立刻知道是哪条前提不成立。
```

 

⚠ 实测踩到的坑：断言消息写中文，会变成八进制转义

 

第一版我把消息写成了中文（` "本工程假设 32 位指针" `）， 结果这条诊断在终端里长这样：

 

```text
ptr_guard_cn.c:2:1: error: static assertion failed: "\37777777746\37777777634\37777777654\37777777745\37777777667\37777777645\37777777747\37777777650\37777777613\37777777745\37777777601\37777777607\37777777750\37777777656\37777777676 32 \37777777744\37777777675\37777777615\37777777746\37777777614\37777777607\37777777751\37777777622\37777777610"
```

 

**每个 UTF-8 字节被打印成了一个八进制转义** ，消息完全不可读 （能认出中间那个孤零零的 ` 32 `，是因为它是 ASCII）。 这不是 bug，是这套 GCC 打印诊断时的转义策略。  
  **结论：` _Static_assert ` 的消息一律写 ASCII（英文）， 别写中文。** 护栏的意义是"失败时让人秒懂"，一条看不懂的报错等于没有报错。 这条不是从文档里抄的，是把中文消息真的喂给编译器之后看到的。

 

那到底该用哪些类型？把指针相关的一族类型放在一起看，答案很清楚：

 

| 类型 | 本站主线实测 | 它保证什么 | 什么时候用它 |
| --- | --- | --- | --- |
| ` void * ` | 4 字节 | 能装下任何对象指针 | 存地址、传泛型参数。 **不要** 直接强转成 ` int ` 或 ` long ` |
| ` uintptr_t ` | 4 字节 | 无符号整数， **保证能装下指针** | 指针 ↔ 整数转换的 **唯一可移植写法** ；算地址偏移、做字节级比较 |
| ` intptr_t ` | 4 字节 | 有符号版本，保证与指针同宽 | 需要指针的 **有符号** 差值/比较时（少见，多数时候用 ` ptrdiff_t `） |
| ` ptrdiff_t ` | 4 字节 | 两个指针相减的结果类型， **有符号** | ` p2 - p1 ` 的结果；可以为负，所以绝不要用无符号类型接 |
| ` size_t ` | 4 字节 | 无符号，能表示任何对象的大小 | ` sizeof `、长度、下标；打印用 ` %zu ` |
| ` int ` / ` long ` | 都是 4 字节 | **什么都不保证** ——它跟指针宽度没关系 | 用它装指针 = 把可移植性提前扔掉。这正是下面那张表要说的 |

 

上表的"实测"一列来自本站工具链的预定义宏 （` __SIZEOF_POINTER__ `、` __SIZEOF_LONG__ `……）。 换一个数据模型，这一列会整片变样，而 **第二列的名字不变** —— 这就是为什么代码里该出现的是 ` uintptr_t ` 而不是 ` long `：

 

| 数据模型 | 典型平台 | int | long | 指针 | 后果 |
| --- | --- | --- | --- | --- | --- |
| **ILP32** | ARM 32 位 EABI（ **本站主线，已实测** ） | 4 | 4 | 4 | ` long ` 恰好等于指针宽度， **所以错误代码在这里能跑** ——这是最危险的情况 |
| **LP64** | 64 位 Linux / macOS | 4 | 8 | 8 | 用 ` long ` 装指针侥幸对了；用 ` int ` 装指针则会 **截断高位** |
| **LLP64** | 64 位 Windows | 4 | 4 | 8 | 用 ` long ` 装指针 **当场截断** ，而且这里的 ` long ` 看起来"和 ARM 上一样" |

 

⚠ 这张表的读法（诚实声明）

 

**ILP32 那一行是本站用真工具链量出来的** （` __SIZEOF_* ` 预定义宏 \+ 三条 ` _Static_assert ` 全部成立）。 LP64 / LLP64 两行是 **各平台 ABI 的规定** ，本章没有对应的 64 位工具链可跑， 所以这里只作为"事实陈述"列出， *不冒充实测* 。 但这不影响结论——结论恰恰是"别依赖任何一行的具体数字，只依赖类型名字"。

 

✔ 四条可以当纪律来执行的规则

 

 
1. **指针转整数，只走 ` uintptr_t `** ；转换前先 ` #include <stdint.h> `。写 ` (uint32_t)p ` 或 ` (unsigned long)p ` 都算违规——哪怕它在你的板子上"能跑"。
 
2. **指针相减的结果用 ` ptrdiff_t ` 接** ，不要用 ` size_t ` 或 ` uint32_t `：差值可能为负，无符号会把它变成一个天文数字。
 
3. **把宽度假设写进 ` _Static_assert `** ，并且消息用英文。假设写在代码里叫"设计约束"，只写在工程师脑子里叫"定时炸弹"。
 
4. **把这三条断言放进一个工程公共头文件** （比如 ` portability.h `），让每一个编译单元都自动检查一遍——成本是零，因为它不生成代码。

 

```zhizhan-anchor
ch3-7
```



## 3.7 restrict 与 \_\_packed：把"我不知道"变成"我保证"

 

这两个关键字看起来毫不相干，但它们是同一件事的两面：  **它们在向编译器传递"你从源码里推不出来、但我知道"的信息** 。 编译器掌握的信息越多，生成的代码越好；而这两种信息，一种换来优化，一种换来更差的代码—— 但都是 **你主动选的** ，而不是编译器替你猜的。

 

```zhizhan-anchor
ch3-7-1
```



### 3.7.1 restrict：一句承诺，换掉整个循环

 

` restrict ` 的语义只有一句话：  **在被修饰的指针的生命周期内，通过它访问的那块内存，不会再通过别的指针访问** 。 对 ` dst ` 和 ` src ` 同时加上 ` restrict `， 等于向编译器承诺"这两块内存不重叠"。

 

restrict\_demo.c — 一句 restrict，循环变成 memcpy C

 

```text
#include <stdint.h>
/* 不写 restrict：dst 与 src 可能重叠，编译器必须按"可能重叠"生成 */
void copy_plain(int32_t *dst, const int32_t *src, uint32_t n)
{ for (uint32_t i = 0; i < n; i++) dst[i] = src[i]; }

/* 写了 restrict：向编译器承诺两块内存不重叠 */
void copy_restrict(int32_t *restrict dst, const int32_t *restrict src, uint32_t n)
{ for (uint32_t i = 0; i < n; i++) dst[i] = src[i]; }
```

 

两份源码的循环体一模一样，只差那两个关键字。实测生成的代码：

 

**bash**  — 实测反汇编（` -O2 -mcpu=cortex-m3 -mthumb `，objdump -d）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c restrict_demo.c -o restrict_demo.o
$ arm-none-eabi-objdump -d restrict_demo.o

00000000 <copy_plain>:
   0:	b14a      	cbz	r2, 16 <copy_plain+0x16>
   2:	3904      	subs	r1, #4
   4:	3804      	subs	r0, #4
   6:	eb01 0282 	add.w	r2, r1, r2, lsl #2
   a:	f851 3f04 	ldr.w	r3, [r1, #4]!      ← 循环体：读一个字
   e:	4291      	cmp	r1, r2
  10:	f840 3f04 	str.w	r3, [r0, #4]!      ← 写一个字（写回后地址自增）
  14:	d1f9      	bne.n	a <copy_plain+0xa>   ← 循环 4 条指令
  16:	4770      	bx	lr

00000018 <copy_restrict>:
  18:	b112      	cbz	r2, 20 <copy_restrict+0x8>
  1a:	0092      	lsls	r2, r2, #2          ← n * 4 = 字节数
  1c:	f7ff bffe 	b.w	0 <memcpy>          ← 整个循环没了，直接尾调用 memcpy
```

 

◆ 为什么加上 restrict 之后，编译器"敢"换成 memcpy

 

因为它终于知道 ` dst ` 和 ` src ` 不重叠， 于是这段逐元素拷贝 **在语义上等价于 ` memcpy `** 。 而 ` memcpy ` 是标准库里被优化得最狠的函数之一（可能用上多字加载、[DMA](term:dma) 友好序等）， 把活儿交给它，比编译器自己展开循环更划算。 **这不是"优化"，这是"换了个更强的实现"。**

 

有个细节值得注意：这里是 ` b.w `（尾调用），不是 ` bl `（压栈调用）—— 编译器连函数调用开销都省了。顺带一个可以自己验证的事实：  **` memcpy ` 自己就是靠 ` restrict ` 才敢这么快的** ， 本站工具链的 ` string.h ` 里它的声明是 ` void * memcpy (void *__restrict, const void *__restrict, size_t); ` ——两个形参都带 ` __restrict `。换句话说， **你刚把最重的活儿外包给了一个同样在做承诺的函数** 。

 

⚠ restrict 是承诺，不是请求：违背它是 UB，不是"慢一点"

 

标准对违背 ` restrict ` 承诺的定义是 **未定义行为** —— 不是"编译器会保守处理"，而是"程序从此没有任何保证"。 最典型的翻车写法是原地搬移：

 

` memcpy(p + 1, p, 8); ` —— 源与目标重叠， 这句话本身就是错的，正确工具是 ` memmove `。  **好消息是这个错误能被编译器抓出来** ：加上 ` -Wrestrict `，实测报 ` warning: 'memcpy' accessing 8 bytes at offsets 1 and 0 overlaps 7 bytes at offset 1 [-Wrestrict] ` ——连重叠了几个字节都算给你了。 *把 ` -Wrestrict ` 加进你的编译选项。*

 

restrict\_overlap.c — 反面教材：请 -Wrestrict 来抓这行代码 C

 

```text
#include <string.h>

/* ✕ 往右错开一格地拷自己：源和目标重叠，memcpy 的契约不成立 */
void shift_right(char *p) { memcpy(p + 1, p, 8); }
```

 

**bash**  — 实测让编译器自己算重叠了几个字节

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -Wrestrict -c restrict_overlap.c -o ro.o
restrict_overlap.c: In function 'shift_right':
restrict_overlap.c:4:29: warning: 'memcpy' accessing 8 bytes at offsets 1 and 0 overlaps 7 bytes at offset 1 [-Wrestrict]

→ 目标从偏移 1 开始写 8 个字节，源从偏移 0 开始读 8 个字节，重叠区间是 offset 1 起的 7 个字节。
  编译器把这段账算给你了 —— 而它之所以能算，正是因为 memcpy 的两个形参都带 restrict：
  "重叠"这件事，在这种声明下【本来就是违约的】。
```

 

```zhizhan-anchor
ch3-7-2
```



### 3.7.2 \_\_packed：为了对上协议格式，主动放弃对齐

 

` __packed `（GCC 写法 ` __attribute__((packed)) `） 的语义同样一句话： **这个结构体里不许有任何填充字节** 。 你需要它，是因为对面那个协议/报文/Flash 里的数据结构 **本来就没有填充** —— 而编译器默认会为了对齐塞进填充。看一份真实对照：

 

packed\_demo.c — 紧凑结构体的代价取决于内核版本 C

 

```text
#include <stdint.h>
typedef struct { uint8_t type; uint32_t value; } frame_t;                    /* 自然对齐 */
typedef struct __attribute__((packed)) { uint8_t type; uint32_t value; } pframe_t; /* 紧凑 */

uint32_t get_normal(const frame_t *f) { return f->value; }   /* 偏移 4，天然对齐 */
uint32_t get_packed(const pframe_t *f) { return f->value; }  /* 偏移 1，对齐未知 */
```

 

` frame_t `（自然对齐）里 ` value ` 落在偏移 4， ` pframe_t `（紧凑）里落在偏移 1—— **两者都只读一个 ` uint32_t `， 写出来的源码也一样** 。看内核不同的两颗芯片上，编译器分别交出了什么：

 

**bash**  — 实测反汇编 · Cortex-M3（` -O2 `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c packed_demo.c -o packed_demo.o
$ arm-none-eabi-objdump -d packed_demo.o

00000000 <get_normal>:
   0:	6840      	ldr	r0, [r0, #4]        ← 对齐访问，一条搞定
   2:	4770      	bx	lr

00000004 <get_packed>:
   4:	f8d0 0001 	ldr.w	r0, [r0, #1]        ← 一条 ldr.w 直接取
                                                   （地址 0x…01 是【不对齐】的）
```

 

**bash**  — 同一份源码 · Cortex-M0\+（` -O2 `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0plus -mthumb -std=c11 -O2 -c packed_demo.c -o packed_demo_m0.o
$ arm-none-eabi-objdump -d packed_demo_m0.o

00000000 <get_normal>:
   0:	6840      	ldr	r0, [r0, #4]        ← 和 M3 上一模一样
   2:	4770      	bx	lr

00000004 <get_packed>:
   4:	7882      	ldrb	r2, [r0, #2]        ← 只能一个字节一个字节地取
   6:	7843      	ldrb	r3, [r0, #1]
   8:	0212      	lsls	r2, r2, #8
   a:	431a      	orrs	r2, r3
   c:	78c3      	ldrb	r3, [r0, #3]
   e:	7900      	ldrb	r0, [r0, #4]
  10:	041b      	lsls	r3, r3, #16
  12:	4313      	orrs	r3, r2
  14:	0600      	lsls	r0, r0, #24
  16:	4318      	orrs	r0, r3              ← 4 次 ldrb + 3 次 lsls + 3 次 orrs
```

 

**FIG 3.7**  同一个字段，两种偏移：` __packed ` 改的是布局，代价落在指令上

 

```zhizhan-figure
<svg viewBox="0 0 660 330" width="660" height="330" role="img" aria-label="自然对齐与紧凑结构体的内存布局对比">
          <defs>
            <marker id="ah14" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path>
            </marker>
          </defs>

          <text x="30" y="24" class="sv-lbl-hi" style="fill:var(--cyn)">frame_t — 自然对齐（sizeof = 8）</text>

          <rect x="30" y="36" width="40" height="40" class="sv-cyn-s"></rect>
          <text x="50" y="61" text-anchor="middle" class="sv-lbl-hi">type</text>
          <rect x="70" y="36" width="120" height="40" class="sv-box"></rect>
          <text x="130" y="61" text-anchor="middle" class="sv-lbl-dim">填充 3 字节</text>
          <rect x="190" y="36" width="160" height="40" class="sv-grn-s"></rect>
          <text x="270" y="61" text-anchor="middle" class="sv-lbl-hi">value</text>

          <text x="50" y="92" text-anchor="middle" class="sv-lbl-dim">0</text>
          <text x="70" y="92" text-anchor="middle" class="sv-lbl-dim">1</text>
          <text x="190" y="92" text-anchor="middle" class="sv-lbl-dim">4</text>
          <text x="350" y="92" text-anchor="middle" class="sv-lbl-dim">8</text>
          <path d="M 30 98 L 350 98" class="sv-dash"></path>
          <text x="360" y="102" class="sv-lbl-dim">字节偏移</text>

          <path d="M 270 76 L 270 112" stroke="var(--amb)" stroke-width="1.4" fill="none" marker-end="url(#ah14)"></path>
          <text x="30" y="132" class="sv-lbl" style="fill:var(--amb)">偏移 4 = 天然 4 字节对齐 → M3 与 M0+ 都只需一条 <tspan class="sv-lbl-hi">ldr r0, [r0, #4]</tspan></text>

          <path d="M 30 152 L 630 152" class="sv-dash"></path>

          <text x="30" y="180" class="sv-lbl-hi" style="fill:var(--red)">pframe_t — __packed（sizeof = 5）</text>

          <rect x="30" y="192" width="40" height="40" class="sv-cyn-s"></rect>
          <text x="50" y="217" text-anchor="middle" class="sv-lbl-hi">type</text>
          <rect x="70" y="192" width="160" height="40" class="sv-red-s"></rect>
          <text x="150" y="217" text-anchor="middle" class="sv-lbl-hi">value</text>

          <text x="50" y="248" text-anchor="middle" class="sv-lbl-dim">0</text>
          <text x="70" y="248" text-anchor="middle" class="sv-lbl-dim">1</text>
          <text x="230" y="248" text-anchor="middle" class="sv-lbl-dim">5</text>
          <path d="M 30 254 L 230 254" class="sv-dash"></path>
          <text x="240" y="258" class="sv-lbl-dim">没有填充，省下 3 字节</text>

          <path d="M 150 232 L 150 268" stroke="var(--amb)" stroke-width="1.4" fill="none" marker-end="url(#ah14)"></path>
          <text x="30" y="288" class="sv-lbl" style="fill:var(--amb)">偏移 1 = <tspan class="sv-lbl-hi">不对齐</tspan> → 编译器必须按目标内核的能力生成代码：</text>
          <text x="30" y="308" class="sv-lbl-hi" style="fill:var(--grn)">　Cortex-M3：<tspan class="sv-t" style="fill:var(--grn)">ldr.w r0, [r0, #1]　—— 1 条指令</tspan></text>
          <text x="30" y="326" class="sv-lbl-hi" style="fill:var(--red)">　Cortex-M0+：<tspan class="sv-t" style="fill:var(--red)">4×ldrb + 3×lsls + 3×orrs　—— 10 条指令</tspan></text>
        </svg>
```

 

**省下 3 字节填充，代价是每次访问都要多付几条指令** ——这笔账划不划算， 取决于你访问这个字段的频率、以及目标内核是哪一颗。  *注意 ` value ` 用红色标出，不是说它"错"，而是说它"不对齐"：在 M0/M0\+ 上不对齐访问会触发 HardFault，所以编译器只能绕着走。*

 

◆ 同一个 ` f->value `：M3 是 1 条指令，M0\+ 是 10 条

 

**Cortex-M3/M4**  的硬件支持 **单次** 不对齐访问， 所以 ` ldr.w r0, [r0, #1] ` 一条就取完了，代价几乎为零。  
  **Cortex-M0/M0\+**  不支持任何不对齐访问（` ldr ` 落在非对齐地址上会直接触发 HardFault），所以编译器必须 **退化成 4 次字节读取 \+ 移位拼装** —— ` 10 ` 条指令换一条，而且多了 3 个中间寄存器。  *如果这段代码在一个高频中断里，或者在一个逐字节解析报文的循环里，这就是实打实的性能损失。*   
  **结论：` __packed ` 的代价与内核版本强相关。**  在 M3/M4 上它几乎是免费的，在 M0/M0\+ 上它很贵——所以"要不要 packed"这个问题，  **不能脱离目标内核来回答** 。

 

⚠ packed 的四个坑（第 1 个最常踩）

 

 
1. **取成员的地址会得到一个不对齐的指针** 。 ` &pf->value ` 的类型是 ` uint32_t * `， 但它指向的地址可能不对齐。你把它传给 ` memcpy ` 通常没事， 但解引用、或在 M0 上做任何访问都可能触发 HardFault。  **编译器对此会警告：` -Waddress-of-packed-member `** （` -Wall ` 已含）。
 
2. **packed 结构体成员不能用在需要对齐的指令里** 。 ` LDM `/` STM ` 这类多字传送在 M3 上也要求对齐， 编译器会把它们拆成单字指令（这又回到上面的"变贵"）。
 
3. **` volatile ` \+ ` packed ` 一起用要格外小心** 。 位域、volatile、packed 三者叠加时，"一次访问"的语义会被拆散， 硬件可能因此收到多次读写。寄存器相关的内容见 §2.8.2。
 
4. **用 ` memcpy ` 而不是强转来读写不对齐数据** 。 从缓冲区里取一个 ` uint32_t `，正确写法是 ` memcpy(&v, buf + 1, 4) `——它明确表达了"我要拷 4 个字节"， 编译器会把它优化成最合适的形式（在 M3 上就是一条 ` ldr `）， 而且 **不依赖任何 packed 声明、符合严格别名规则** 。

 

```zhizhan-anchor
ch3-8
```



## 3.8 M0/M0\+ 的隐形降级：CLZ、CTZ 与 libgcc

 

上一节的对比暴露了一类更普遍的现象： **同一份 C 代码，在 M3 上是一两条指令， 换到 M0\+ 就悄悄变成了一次函数调用** 。这里的"悄悄"是字面意思—— 源码一个字没改，编译也没有报错，只有反汇编或者性能测试才看得出来。

 

最典型的例子是"找最高位/最低位的 1"：内存池要找第一个空闲块、位图调度器要找下一个可用槽位、 滑动窗口要找结束位置——都要它。

 

builtin\_probe.c — 找最高位/最低位的 1：CLZ 与 CTZ C

 

```text
#include <stdint.h>
/* 找最高位/最低位的 1：内存池、位图调度器里天天用 */
uint32_t highest_bit(uint32_t x)  { return x ? 31u - (uint32_t)__builtin_clz(x) : 0u; }
uint32_t lowest_bit(uint32_t x)   { return (uint32_t)__builtin_ctz(x); }
```

 

**bash**  — 实测反汇编 · Cortex-M3（` -O2 `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c builtin_probe.c -o bp_m3.o
$ arm-none-eabi-objdump -d bp_m3.o

00000000 <highest_bit>:
   0:	b118      	cbz	r0, a <highest_bit+0xa>
   2:	fab0 f080 	clz	r0, r0          ← 一条 CLZ 指令
   6:	f1c0 001f 	rsb	r0, r0, #31
   a:	4770      	bx	lr

0000000c <lowest_bit>:
   c:	fa90 f0a0 	rbit	r0, r0          ← RBIT 反转位序
  10:	fab0 f080 	clz	r0, r0          ← 再 CLZ，两条指令搞定
  14:	4770      	bx	lr
```

 

**bash**  — 同一份源码 · Cortex-M0\+（` -O2 `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0plus -mthumb -std=c11 -O2 -c builtin_probe.c -o bp_m0.o
$ arm-none-eabi-objdump -d bp_m0.o

00000000 <highest_bit>:
   0:	b510      	push	{r4, lr}       ← 先压栈
   2:	2800      	cmp	r0, #0
   4:	d003      	beq.n	e <highest_bit+0xe>
   6:	f7ff fffe 	bl	0 <__clzsi2>   ← 调用 libgcc 里的软件实现
   a:	231f      	movs	r3, #31
   c:	1a18      	subs	r0, r3, r0
   e:	bd10      	pop	{r4, pc}

00000010 <lowest_bit>:
  10:	b510      	push	{r4, lr}
  12:	f7ff fffe 	bl	0 <__ctzsi2>   ← 同样是一次库调用
  16:	bd10      	pop	{r4, pc}
```

 

◆ 编译器没有报错，它只是"替你兜底"了

 

M0/M0\+ 的指令集里 **没有 CLZ，也没有 RBIT** 。 但 GCC 不会因此拒绝编译——它会调用  **libgcc**  里的软件实现 （` __clzsi2 ` / ` __ctzsi2 `，名字里的 ` si ` 就是  *signed int* ）。 实测证据很直接：M0\+ 的目标文件里有两个 **未定义符号**  ` U __clzsi2 `、` U __ctzsi2 `（由 libgcc 在链接时提供）， 而 M3 的目标文件里 **一个未定义符号都没有** ——活儿全用指令干完了。

 

```zhizhan-table
{"rows":[[{"body":"能力","header":true,"rowSpan":1,"colSpan":1},{"body":"Cortex-M3 / M4","header":true,"rowSpan":1,"colSpan":1},{"body":"Cortex-M0 / M0\\+","header":true,"rowSpan":1,"colSpan":1},{"body":"你要注意什么","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` __builtin_clz `  \n前导零个数","header":false,"rowSpan":1,"colSpan":1},{"body":"**1 条 ` clz `** （实测）","header":false,"rowSpan":1,"colSpan":1},{"body":"调用 ` __clzsi2 `（实测）","header":false,"rowSpan":1,"colSpan":1},{"body":"M0\\+ 上代价 = 压栈 \\+ 跳转 \\+ libgcc 代码体积。高频路径里要记账","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` __builtin_ctz `  \n尾随零个数","header":false,"rowSpan":1,"colSpan":1},{"body":"**2 条** ：` rbit ` \\+ ` clz `（实测）","header":false,"rowSpan":1,"colSpan":1},{"body":"调用 ` __ctzsi2 `（实测）","header":false,"rowSpan":1,"colSpan":1},{"body":"同上。内存池的\"找下一个空闲位\"会走这条路","header":false,"rowSpan":1,"colSpan":1}],[{"body":"硬件除法 ` / `、` % `","header":false,"rowSpan":1,"colSpan":1},{"body":"` sdiv ` / ` udiv ` 指令","header":false,"rowSpan":1,"colSpan":1},{"body":"调用 ` __aeabi_uidiv ` 等 libgcc 例程","header":false,"rowSpan":1,"colSpan":1},{"body":"M0\\+ 上一次除法是几十个周期。 **能移位就别除法** ；常量除法请交给 ` -O2 ` 转乘法","header":false,"rowSpan":1,"colSpan":1}],[{"body":"不对齐访问","header":false,"rowSpan":1,"colSpan":1},{"body":"单字 ` ldr `/` str ` 支持（见 §3.7.2 的实测）","header":false,"rowSpan":1,"colSpan":1},{"body":"**完全不支持** ，会触发 HardFault","header":false,"rowSpan":1,"colSpan":1},{"body":"协议缓冲区一律按字节解析，或用 ` memcpy `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"位带（bit-band）","header":false,"rowSpan":1,"colSpan":1},{"body":"支持，可对单个位做原子读改写","header":false,"rowSpan":1,"colSpan":1},{"body":"**不存在** ，地址别名区无效","header":false,"rowSpan":1,"colSpan":1},{"body":"写\"跨平台位操作宏\"时必须以 M0 为准。 *位带的完整机制见 §6.2*","header":false,"rowSpan":1,"colSpan":1}],[{"body":"指令集基线","header":false,"rowSpan":1,"colSpan":1},{"body":"Thumb-2（混合 16/32 位指令）","header":false,"rowSpan":1,"colSpan":1},{"body":"只有 Thumb-1（16 位为主）","header":false,"rowSpan":1,"colSpan":1},{"body":"这也是上面那些差异的总根源—— **不是编译器偏心，是硬件真没有**","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

✔ 怎么知道自己踩没踩到这条线

 

 
1. **看未定义符号** ：` arm-none-eabi-nm your.o | grep " U " `。出现 ` __clzsi2 `、` __aeabi_uidiv `、` __aeabi_ldivmod ` 这类名字，就说明目标内核没有对应指令，编译器去调库了。
 
2. **看预定义宏** ：` __ARM_ARCH `、` __ARM_FEATURE_CLZ ` 等宏由编译器按 ` -mcpu ` 给出，是判断"这颗核有什么"的权威依据。
 
3. **交叉编译两边都编一遍** ：本站这条对照的全部证据，就是"同一份源码，` -mcpu ` 换一个，` objdump ` 换一张脸"。 *这是你手上最便宜的性能回归测试。*

 

```zhizhan-anchor
ch3-9
```



## 3.9 寄存器结构体的工程化收口

 

§3.4 给出了三种寄存器映射写法，并推荐了"结构体映射 \+ ` volatile `"。 但那个推荐还差两道 **收口** ： 结构体成员的偏移量 **没人替你核对** ，访问权限 **也没人替你标注** 。 这两件事都能变成编译期检查，代价同样是零。

 

```zhizhan-anchor
ch3-9-1
```



### 3.9.1 收口一：把手册里的偏移量钉进编译期

 

参考手册上写着 ` BSRR ` 在 ` 0x10 `。 这句话现在只活在手册里——直到你把它写成 ` _Static_assert `，它才变成 **代码的一部分** 。

 

regmap\_check.c — offsetof \+ \_Static\_assert 把手册钉进代码 C

 

```text
#include <stdint.h>
#include <stddef.h>

/* 结构体成员顺序 = 手册里的寄存器地址顺序，一个都不能少 */
typedef struct {
    volatile uint32_t CRL;    /* 0x00 端口配置低 */
    volatile uint32_t CRH;    /* 0x04 端口配置高 */
    volatile uint32_t IDR;    /* 0x08 输入数据 */
    volatile uint32_t ODR;    /* 0x0C 输出数据 */
    volatile uint32_t BSRR;   /* 0x10 置位/复位（原子） */
    volatile uint32_t BRR;    /* 0x14 复位 */
    volatile uint32_t LCKR;   /* 0x18 配置锁定 */
} GPIO_t;

/* 把数据手册上的四句话，变成四条编译期断言 */
_Static_assert(offsetof(GPIO_t, BSRR) == 0x10, "BSRR must sit at 0x10");
_Static_assert(offsetof(GPIO_t, ODR)  == 0x0C, "ODR must sit at 0x0C");
_Static_assert(offsetof(GPIO_t, LCKR) == 0x18, "LCKR must sit at 0x18");
_Static_assert(sizeof(GPIO_t)         == 0x1C, "GPIO_t size must be 28 bytes");

#define GPIOB ((GPIO_t *)0x40010C00u)

static inline void led_on(void)  { GPIOB->BSRR = (1u << 0); }
static inline void led_off(void) { GPIOB->BRR  = (1u << 0); }
```

 

**bash**  — 实测编译（四条断言全部成立，无输出）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c regmap_check.c -o regmap_check.o
$ echo $?
0
```

 

这四条断言有什么用？它们在你 **手滑** 的时候救你。下面这份"反面教材"只做了一件事： 漏写一个 ` ODR ` 成员。

 

regmap\_bad.c — 反面教材：漏一个成员，后面的寄存器全部前移 C

 

```text
#include <stdint.h>
#include <stddef.h>
typedef struct {
    volatile uint32_t CRL;    /* 0x00 */
    volatile uint32_t CRH;    /* 0x04 */
    volatile uint32_t IDR;    /* 0x08 */
    volatile uint32_t BSRR;   /* 手滑漏掉 ODR —— BSRR 实际落在 0x0C */
    volatile uint32_t BRR;    /* 0x10 */
    volatile uint32_t LCKR;   /* 0x14 */
} GPIO_t;
_Static_assert(offsetof(GPIO_t, BSRR) == 0x10, "BSRR must sit at 0x10");
```

 

**bash**  — 实测编译失败：错在结构体，报在断言

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c regmap_bad.c -o regmap_bad.o
regmap_bad.c:11:1: error: static assertion failed: "BSRR must sit at 0x10"
   11 | _Static_assert(offsetof(GPIO_t, BSRR) == 0x10, "BSRR must sit at 0x10");
      | ^~~~~~~~~~~~~~
```

 

◆ 这条断言拦住的是最阴的一类 bug

 

漏一个成员，结构体不会报错、编译不会报错、程序也能跑—— 但它会 **把后面所有寄存器整体前移 4 字节** 。 于是"点亮 PB0"变成了"改写了 ` BRR `"， LED 不亮，而你对着 **完全正确的调用代码** 查一整天。 这类 bug 的可怕之处在于： **错的地方和出症状的地方隔了很远** 。 ` _Static_assert ` 把它拉回到编译期，代价为零。

 

```zhizhan-anchor
ch3-9-2
```



### 3.9.2 收口二：用 ` __IO ` / ` __I ` / ` __O ` 标注访问权限

 

你在 STM32 的例程里一定见过这几个前缀：` __IO uint32_t CR; `。 它们不是编译器关键字，而是  **CMSIS 头文件里的宏** 。 本站把官方 ` core_cm3.h ` 里的定义原样抄过来，一个字没改：

 

| 宏 | 展开成 | 含义 | 写错时会发生什么 |
| --- | --- | --- | --- |
| ` __I ` | ` volatile const ` | 只读 | **写它会编译报错** （实测见下）。用于状态寄存器 SR |
| ` __O ` | ` volatile ` | 只写 | 读它 **不会** 报错——这个标注只是给人看的。用于数据寄存器 DR |
| ` __IO ` | ` volatile ` | 可读可写 | 什么都没挡住。用于控制寄存器 CR。 *注意它就等于 ` __O `* |
| ` __IM ` | ` volatile const ` | 只读（结构体成员版） | 与 ` __I ` 完全同义。CMSIS 注释写明这一组"should be used for structure members" |
| ` __OM ` | ` volatile ` | 只写（结构体成员版） | 与 ` __O ` 同义 |
| ` __IOM ` | ` volatile ` | 可读可写（成员版） | 与 ` __IO ` 同义 |

 

这张表就回答了一个很常见的困惑： **` __I ` 和 ` __IM ` 是同一个东西， ` __O ` 和 ` __OM ` 也是** ——分两组只是因为历史： 早期只有 ` __I/__O/__IO ` 三个名字，后来 CMSIS 又加了一组带 ` M ` 的， 并在注释里明确"这组才是给结构体成员用的"。两个名字都在用，你都会见到。

 

cmsis\_io.c — \_\_IO / \_\_I / \_\_O 展开之后到底是什么 C

 

```text
#include <stdint.h>

/* 取自 CMSIS core_cm3.h（C 编译路径），一字未改 */
#define __I   volatile const
#define __O   volatile
#define __IO  volatile
#define __IM  volatile const
#define __OM  volatile
#define __IOM volatile

typedef struct {
    __IO uint32_t CR;      /* 控制寄存器：可读可写 */
    __I  uint32_t SR;      /* 状态寄存器：只读 */
    __O  uint32_t DR;      /* 数据寄存器：只写 */
} UART_t;

#define UART1 ((UART_t *)0x40013800u)

void uart_enable(void)
{
    UART1->CR = 0x1u;                        /* ✔ __IO 可写 */
    while ((UART1->SR & 0x20u) == 0u) { }    /* ✔ __I 可读 */
    UART1->DR = 0x41u;                       /* ✔ __O 可写 */
}
```

 

这几个宏真正的价值，是 **把"这个寄存器是只读的"这句手册上的话， 变成编译器能执行的规则** 。看下面这份反面教材——想清一个状态标志位，于是写了一个只读寄存器：

 

cmsis\_readonly\_fail.c — 反面教材：写只读寄存器是编译错误 C

 

```text
#include <stdint.h>
#define __I volatile const
typedef struct { __I uint32_t SR; } UART_t;   /* SR 只读 */
void clear_error(UART_t *u) { u->SR = 0u; }   /* ✕ 想清标志位，写只读成员 */
```

 

**bash**  — 实测编译失败

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c cmsis_readonly_fail.c -o c.o
cmsis_readonly_fail.c: In function 'clear_error':
cmsis_readonly_fail.c:4:37: error: assignment of read-only member 'SR'

→ 手册上那句"SR 是只读寄存器"，现在由编译器替你记着了。
  而且报错点就在那一行赋值上 —— 一眼看到问题，不用去猜。
```

 

⚠ 别忘了：` __I ` 只读，但 ` __O ` / ` __IO ` 什么都没挡住

 

**只有 ` volatile const ` 这一种组合是编译器能强制的** 。 ` __O `（只写）和 ` __IO `（可读写）都展开成 **普通的 ` volatile `** ， 所以"别去读 DR"、"别乱写保留位"这类规则，编译器 **管不了** ——它们只是注释。  *把这一点记住，就不会误以为加了 ` __O ` 就安全了。*    
另外：C\+\+ 编译路径下 ` core_cm3.h ` 里的 ` __I ` 是 ` volatile `（ **不带 const** ），只读保护会消失——这是它用 ` #ifdef __cplusplus ` 分开定义的原因。 **用 C\+\+ 写嵌入式时要注意这个差异。**

 

✔ 一个寄存器结构体的完整模板

 

把 §3.4 的映射写法、§3.9.1 的偏移量断言、§3.9.2 的权限标注合起来， 一个"工程级"的寄存器定义长这样： **结构体成员按手册顺序排列 → 每个成员的访问权限用 ` __IM `/` __OM `/` __IOM ` 标注 → 结构体下方紧跟一组 ` offsetof ` 断言 → 最后是基地址宏** 。 这套写法在整个 Module 06 的外设编程里会反复出现， 更完整的 CMSIS 用法见 §6.5.1，位域描述寄存器见 §6.3， 而"为什么要 ` volatile `"见 §2.8.2。

 

```zhizhan-anchor
ch3-10
```



## 3.10 函数指针的终极形态：中断向量表

 

§3.3 讲了函数指针的三个用途：回调、跳转表、硬件抽象层。 在嵌入式里它还有第四个身份，而且是最根本的一个：  **中断向量表本质上就是一个函数指针数组** 。 仔细看它的类型：` void (* const g_vectors[])(void) `—— "元素是 **指向「无参无返回函数」的指针** 的常量数组"。 你已经在 §3.3.3 见过一模一样的语法。

 

```zhizhan-anchor
ch3-10-1
```



### 3.10.1 第一步：让向量表落在 Flash 的最开头

 

复位时，内核会从地址 ` 0x00000000 `（在 BOOT0=0 时映射到 Flash 起始 ` 0x08000000 `）读两个东西：第 0 个字是 **初始 MSP 值** ， 第 1 个字是 **复位入口地址** 。所以向量表必须被放到 .text 的最前面， 而且不能被优化掉——这两件事都靠链接脚本 \+ 一个属性一起完成。

 

vec.ld — 向量表必须先落地：KEEP 与 .isr\_vector linker

 

```text
ENTRY(Reset_Handler)
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 64K
         RAM  (rwx) : ORIGIN = 0x20000000, LENGTH = 20K }
SECTIONS {
  .text : { KEEP(*(.isr_vector)) *(.text*) *(.rodata*) } > FLASH
  .data : { *(.data*) } > RAM
  .bss (NOLOAD) : { *(.bss*) *(COMMON) } > RAM
  _estack = ORIGIN(RAM) + LENGTH(RAM);
}
```

 

◆ ` KEEP ` 不是可选项，是必需的

 

链接器有一个"看起来没用就删掉"的习惯（` --gc-sections ` 时更激进）。 ` g_vectors ` 这个数组在 C 代码里 **没有任何地方引用它** —— 它是给 **硬件** 看的，不是给 C 代码看的。 没有 ` KEEP `，链接器完全有理由把它当垃圾清掉， 然后你的程序从第一条指令开始就跑飞。  *而"KEEP(` *(.isr_vector) `)"这句话，是告诉链接器"这一段无论如何都要留"。*

 

```zhizhan-anchor
ch3-10-2
```



### 3.10.2 第二步：给每个中断一个"可被覆盖的默认实现"

 

向量表有几十上百个条目，你不可能每个都写。但如果某个条目是空的（` 0 `）， 一旦那个中断真的来了，内核会跳到地址 0，然后一切失控。 标准解法是 **给每一项都填一个"默认实现"，再让需要的人去覆盖它** —— 这正是 §2.9 讲的 ` weak ` \+ ` alias ` 属性最经典的应用场景。

 

vec\_table.c — 向量表：函数指针数组 \+ weak 默认实现 C

 

```text
#include <stdint.h>

void Reset_Handler(void) { for (;;) { } }   /* 复位入口：真正干活的地方 */
void default_handler(void) { for (;;) { } } /* 其余中断的默认归宿 */

/* weak + alias：给向量表每一项一个"可被覆盖的默认实现" */
void NMI_Handler(void) __attribute__((weak, alias("default_handler")));
void SVC_Handler(void) __attribute__((weak, alias("default_handler")));

extern uint32_t _estack;
void Reset_Handler(void);

/* 向量表本身就是一个【函数指针数组】 */
__attribute__((section(".isr_vector"), used))
void (* const g_vectors[])(void) = {
    (void (*)(void))&_estack,   /* 0x00 初始 MSP */
    Reset_Handler,              /* 0x04 复位 */
    NMI_Handler,                /* 0x08 弱定义 */
    SVC_Handler,                /* 0x0C 弱定义 */
};
```

 

用户侧只需要写自己真正关心的那一个。注意 **他完全不需要知道"默认实现"存在** —— 这正是 weak 机制的价值： **它把"我没写"和"我忘了写"分开了** 。

 

vec\_user.c — 用户只写自己关心的那一个 C

 

```text
/* 用户只写自己关心的那一个：NMI 被覆盖，SVC 仍然落到默认实现 */
void NMI_Handler(void) { /* 用户自己的实现 */ }
```

 

```zhizhan-anchor
ch3-10-3
```



### 3.10.3 第三步：把这三份文件真的链一遍，看结果

 

**bash**  — 实测链接与符号表（` arm-none-eabi-nm -n `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c vec_table.c -o vec_table.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c vec_user.c  -o vec_user.o
$ arm-none-eabi-ld -T vec.ld vec_table.o vec_user.o -o vec.elf
$ arm-none-eabi-nm -n vec.elf
08000000 T g_vectors        ← 向量表落在 Flash 最开头
08000010 T Reset_Handler    ← 复位入口
08000016 T default_handler  ← 默认实现
08000016 W SVC_Handler      ← W【弱符号】，与 default_handler 同一个地址
0800001c T NMI_Handler      ← T【强符号】，用户写了，占了新地址
20005000 T _estack          ← 初始 MSP（RAM 末尾）
```

 

` nm ` 已经把两件事说清楚了：  **` SVC_Handler ` 是 ` W `（weak），和 ` default_handler ` 同址； ` NMI_Handler ` 是 ` T `（强符号），落在自己的地址上。**  但真正有说服力的是 **向量表里的那几个字节** ——毕竟硬件读的是字节，不是符号表：

 

**bash**  — 实测向量表原始字节（` objdump -s -j .text `）

 

```text
$ arm-none-eabi-objdump -s -j .text vec.elf
Contents of section .text:
 8000000 00500020 11000008 1d000008 17000008  .P. ............

逐项解码（小端）：
  0x08000000: 00 50 00 20 → 0x20005000  = _estack                （第 0 项：初始 MSP）
  0x08000004: 11 00 00 08 → 0x08000011  = Reset_Handler  (0x10)|1
  0x08000008: 1d 00 00 08 → 0x0800001d  = NMI_Handler      (0x1c)|1  ← 用户的实现
  0x0800000c: 17 00 00 08 → 0x08000017  = SVC_Handler      (0x16)|1  ← 默认实现
```

 

**FIG 3.8**  向量表 4 个字逐项解码（数据来自上面 ` objdump -s ` 的真实输出）

 

```zhizhan-figure
<svg viewBox="0 0 660 300" width="660" height="300" role="img" aria-label="中断向量表原始字节逐项解码">
          <defs>
            <marker id="ah15" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <text x="30" y="24" class="sv-lbl-hi">偏移</text>
          <text x="105" y="24" class="sv-lbl-hi">Flash 里的 4 个字节</text>
          <text x="330" y="24" class="sv-lbl-hi">小端拼出来的值</text>
          <text x="470" y="24" class="sv-lbl-hi">内核会跳到</text>
          <path d="M 30 32 L 630 32" class="sv-dash"></path>

          <!-- 第 0 项 -->
          <text x="30" y="58" class="sv-lbl-dim">0x00</text>
          <rect x="100" y="42" width="150" height="24" class="sv-box"></rect>
          <text x="106" y="59" class="sv-lbl-hi">00 50 00 20</text>
          <path d="M 254 54 L 322 54" class="sv-arrow"></path>
          <text x="330" y="58" class="sv-lbl-hi">0x20005000</text>
          <text x="470" y="58" class="sv-lbl" style="fill:var(--cyn)">_estack（初始 MSP）</text>

          <!-- 第 1 项 -->
          <text x="30" y="90" class="sv-lbl-dim">0x04</text>
          <rect x="100" y="74" width="150" height="24" class="sv-box"></rect>
          <text x="106" y="91" class="sv-lbl-hi">11 00 00 08</text>
          <path d="M 254 86 L 322 86" class="sv-arrow"></path>
          <text x="330" y="90" class="sv-lbl-hi">0x08000011</text>
          <text x="470" y="90" class="sv-lbl" style="fill:var(--grn)">Reset_Handler（0x10 + 1）</text>

          <!-- 第 2 项 -->
          <text x="30" y="122" class="sv-lbl-dim">0x08</text>
          <rect x="100" y="106" width="150" height="24" class="sv-cyn-s"></rect>
          <text x="106" y="123" class="sv-lbl-hi">1d 00 00 08</text>
          <path d="M 254 118 L 322 118" class="sv-arrow"></path>
          <text x="330" y="122" class="sv-lbl-hi">0x0800001d</text>
          <text x="470" y="122" class="sv-lbl" style="fill:var(--grn)">NMI_Handler（0x1c + 1）</text>

          <!-- 第 3 项 -->
          <text x="30" y="154" class="sv-lbl-dim">0x0c</text>
          <rect x="100" y="138" width="150" height="24" class="sv-amb-s"></rect>
          <text x="106" y="155" class="sv-lbl-hi">17 00 00 08</text>
          <path d="M 254 150 L 322 150" class="sv-arrow"></path>
          <text x="330" y="154" class="sv-lbl-hi">0x08000017</text>
          <text x="470" y="154" class="sv-lbl" style="fill:var(--amb)">SVC_Handler（0x16 + 1）</text>

          <path d="M 30 174 L 630 174" class="sv-dash"></path>

          <text x="30" y="198" class="sv-lbl-hi" style="fill:var(--grn)">◆ 青框 = 用户提供强定义的 NMI；琥珀框 = 没人覆盖、落到 weak 默认实现的 SVC</text>
          <text x="30" y="222" class="sv-lbl-hi" style="fill:var(--amb)">◆ 每个处理函数地址的最低位都是 <tspan style="fill:var(--red)">1</tspan>：0x…11 / 0x…1d / 0x…17</text>
          <text x="30" y="242" class="sv-t">而真实函数地址是 0x…10 / 0x…1c / 0x…16，全是偶数 —— 差的这一位就是 <tspan class="sv-lbl-hi">Thumb 位</tspan></text>
          <text x="30" y="266" class="sv-lbl" style="fill:var(--grn)">Cortex-M 只有 Thumb 状态，所以跳转目标的最低位必须是 1。</text>
          <text x="30" y="286" class="sv-t">你没写 <tspan class="sv-lbl-hi">| 1</tspan> 也对，是因为 C 里 Thumb 函数的函数指针本身就自带这一位。</text>
        </svg>
```

 

这张图的每一格都能和上面的 ` nm ` 输出对上： ` SVC_Handler ` 的 ` W ` 对应"琥珀框仍在默认实现上"， ` NMI_Handler ` 的 ` T ` 对应"青框拿到了自己的地址"。  **符号表说结论，字节说证据——两者对上了，才算真的看懂。**

 

◆ 为什么这些地址都是奇数？—— 末位那个 1 是 Thumb 位

 

每一个处理函数地址的 **最低位都是 1** ： ` 0x08000011 `、` 0x0800001d `、` 0x08000017 `—— 而它们的真实函数地址是 ` 0x08000010 `、` 0x0800001c `、` 0x08000016 `，都是偶数。

 

这不是笔误，是 ARM 的 **约定** ：地址最低位表示"目标状态是 Thumb 还是 ARM"，  **1 = Thumb** 。Cortex-M  **只有**  Thumb 状态， 所以所有跳转目标的最低必须是 1。  *你在源码里并没有手动 ` |1 `* ——为什么写出来是对的？ 因为  **C 语言里 Thumb 函数的函数指针本身就自带这个位** ： ` Reset_Handler ` 作为函数指针参与初始化时，值就已经是 ` 0x08000011 ` 了。这也是为什么 **向量表必须用 C 的函数指针来填， 而不是手写一串数字** ——手写你就得自己记得加这个位，还得在函数挪位置之后重算； 用函数指针，这两件事编译器全包了。   
顺带印证：§2.6.3 里 ` readelf -l ` 输出的 ` Entry point 0x8000035 ` 末位也是 1，同一个道理。

 

| 偏移 | 实测值 | 对应符号 | 谁填的 / 怎么被覆盖 |
| --- | --- | --- | --- |
| ` 0x00 ` | ` 0x20005000 ` | ` _estack ` | 链接脚本算出来的 ` ORIGIN(RAM)+LENGTH(RAM) `。复位后内核把它装进 MSP， **先于任何 C 代码执行** |
| ` 0x04 ` | ` 0x08000011 ` | ` Reset_Handler ` | 由 ` ENTRY() ` 标为入口。 **必须** 是强符号——没人能覆盖复位入口 |
| ` 0x08 ` | ` 0x0800001d ` | ` NMI_Handler ` | 默认是 weak 别名；` vec_user.c ` 提供了强定义， **链接器选了强的** |
| ` 0x0c ` | ` 0x08000017 ` | ` SVC_Handler ` | 没人覆盖 → 落在 ` default_handler `（` 0x16 `）。 **中断来了也不会跑飞，只是什么都不做** |

 

✔ 这套机制为什么值得单独讲一节

 

 
1. **它是 ` weak ` 属性唯一"不可替代"的应用场景** 。别的场景（比如提供可选功能）用宏也能凑合，向量表不行：几百个中断条目，用户只写其中几个，剩下的必须有个安全的落脚点。
 
2. **它把三个知识点串成了一条线** ：函数指针（§3.3）→ 数组与指针类型（§3.2）→ 链接脚本与 section 属性（§2.6、§2.9）。 *能自己把这条线走通，说明前三章真的读懂了。*
 
3. **它解释了启动文件里那几百行 DCD 到底在干什么** 。你在 ` startup_stm32f103xb.s ` 里看到的 ` DCD Reset_Handler `，就是本节这个数组的 **汇编写法** ；` IMPORT ` / ` EXPORT ` 对应的就是强/弱符号声明。
 
4. **你能自己写一个最小可运行的启动代码了** ：一份 ` vec.ld ` \+ 一个向量表 \+ 一个复位入口，就是整个工程的起点。

 

◆ 本章要点

 

 
- **指针 = 地址 \+ 类型** 。类型决定解引用读几个字节、以及 ` p+1 ` 前进多远。
 
- 指针加减法的单位是 **元素** ，不是字节。指针相减得到元素个数。
 
- **数组不是指针** 。数组名在多数表达式中退化为首元素指针，但 ` sizeof ` 和 ` & ` 不触发退化。
 
- 函数指针是嵌入式的核心武器： **回调、跳转表、驱动抽象层** 三件套都靠它。
 
- 用 ` void *user ` 上下文指针传递回调状态，替代全局变量——这是 C 语言实现"闭包"的标准手法。
 
- Cortex-M 统一编址， **外设寄存器就是固定地址上的变量** 。用结构体映射 \+ ` volatile ` 是寄存器定义的最佳实践。
 
- 优先使用硬件的 **原子寄存器** （如 STM32 的 BSRR）替代读-改-写，天然中断安全。
 
- 五类指针错误（野指针、悬空、越界、类型不匹配、空指针）都有对应的防御模板， **把它们变成肌肉记忆** 。
 
- 宽度假设要写成 ` _Static_assert `（消息用英文——中文消息在诊断里会变成八进制转义，实测）。指针转整数只走 ` uintptr_t `，指针差值用 ` ptrdiff_t `。
 
- ` restrict ` 是承诺不是请求：它能把逐元素拷贝换成一次 ` memcpy ` 尾调用（实测），但违背它是未定义行为。
 
- ` __packed ` 的代价与内核强相关：同一个 ` f->value `，M3 是  **1 条指令** ，M0\+ 是  **10 条** （实测）。
 
- M0/M0\+ 上 ` __builtin_clz/ctz `、除法、不对齐访问都会 **悄悄退化成 libgcc 调用或字节拼装** ——源码看不出，反汇编才看得见。
 
- 寄存器结构体的两道收口：` offsetof ` \+ ` _Static_assert ` 钉住偏移量，` __IM/__OM/__IOM ` 标注访问权限（只有 ` volatile const ` 是真能被编译器强制的）。
 
- 中断向量表就是 **函数指针数组** ：` weak ` 默认实现 \+ 用户强符号覆盖，靠链接脚本的 ` KEEP ` 保住。表里地址末位的 1 是  **Thumb 位** 。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 填空：` T *p; p + 1 ` 实际前进的字节数是 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` sizeof(T) `。指针算术以\"指向类型\"为单位：` int* ` 加 1 走 4 字节，` char* ` 加 1 走 1 字节。 *类型就是指针的\"步长\"。*"}
   ```
 
2. 判断：数组名和指向首元素的指针完全等价吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**不等价** 。数组名在多数表达式里退化为指针，但 ` sizeof(arr) ` 是 **整个数组** 的大小、` &arr ` 的类型是\"数组指针\"，而且数组名 **不可赋值** 。` sizeof(数组形参) ` 之所以退化成指针宽度，正是\"形参会退化\"这条规则在起作用。"}
   ```
 
3. 找错：` ((void(*)(void))0x08001000)(); ` 调用即崩溃，为什么？怎么改？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"Thumb 芯片要求函数指针 **最低位为 1** （表示 Thumb 状态）。偶数地址 ` 0x08001000 ` 会触发 INVSTATE。应写 ` 0x08001001 `——正常情况下这个位由编译器自动处理，手填地址时才要自己加。"}
   ```
 
4. 简答：` restrict ` 是一个什么承诺？撒谎会导致什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"承诺\"这段内存 **只通过这个指针访问** \"，好让编译器放心优化（如把拷贝循环变成 ` memcpy `）。 **撒谎** （其实有两个指针指向同一块内存）会产生\"源码看不出错、结果却错\"的诡异行为——这是 UB，编译器不会替你兜。"}
   ```
 
5. 选择：在 Cortex-M0/M0\+ 上，` __builtin_ctz(x) ` 会被编成什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"退化为对  **libgcc ` __ctzsi2 ` 的调用** （软件实现）。在 Cortex-M3 上，它是 ` rbit ` \\+ ` clz ` 两条指令；M0/M0\\+ 指令集里没有 ` RBIT `/` CLZ `，源码一个字没改、代价却变了。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  试着把 ` state_machine.c ` 里的状态表改成你自己的协议。

 

```zhizhan-assessment
{"id":"course-b01-ch3","criterion":"用有界数组说明合法指针运算；MMIO 访问按外设宽度、对齐、副作用设计。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 N1570 · 对象、类型与语言语义](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) · [ST RM0008 · 外设地址与寄存器语义](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
