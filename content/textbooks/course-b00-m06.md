# 指针入门

```zhizhan-anchor
m06
```



指针是 C 的"分水岭"，也是嵌入式绕不开的东西（寄存器、[DMA](term:dma)、缓冲区都要它）。 别怕：指针就是 **一个保存"地址"的变量** 。` & ` 取地址，` * ` 按地址取内容。

 

> ◷ 约 60 分钟 · ◈ &/\* · 指针与数组 · 传址 · ⚑ 嵌入式的核心

 

```zhizhan-anchor
m06-1
```



## 6.1 指针是什么：一张图

 

**FIG 6.1**  变量有名有地址；指针保存的就是"地址"

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="变量、地址与指针"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--grn)"></path></marker></defs>
          <rect x="40" y="50" width="120" height="46" rx="6" class="sv-box"></rect>
          <text x="100" y="72" class="sv-lbl-hi" text-anchor="middle">int x = 3</text>
          <text x="100" y="89" class="sv-lbl-dim" text-anchor="middle">住在地址 0x1000</text>
          <rect x="360" y="50" width="150" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="435" y="72" class="sv-lbl-hi" text-anchor="middle">int *p = &amp;x</text>
          <text x="435" y="89" class="sv-lbl-dim" text-anchor="middle">p 里存着 0x1000</text>
          <path d="M360 73 L160 73" class="sv-arrow" style="marker-end:url(#ah)"></path>
          <text x="260" y="65" class="sv-lbl-dim" text-anchor="middle">&amp;x（取地址）→ 存进 p</text>
          <text x="100" y="126" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--amb)">*p 表示"顺着 p 里的地址找过去"= x 的值 3</text>
        </svg>
```

 

` &x `：取 x 的地址；` *p `：按 p 里的地址访问那块内存。 **p 是指针（存地址），\*p 是它指向的值。**

 

```zhizhan-anchor
m06-2
```



## 6.2 三个最实用的用法

 

pointer.c — 取地址/解引用/传址/数组遍历（可运行） C

 

```text
#include <stdio.h>

void swap(int *a, int *b) {                  /* 交换：通过指针改调用方的变量 */
    int t = *a; *a = *b; *b = t;
}

int main(void)
{
    int x = 3, y = 8;
    int *p = &x;                             /* p 保存 x 的地址 */
    printf("x=%d   *p=%d   (p 指向 x，所以 *p 就是 x)\n", x, *p);

    *p = 10;                                 /* 通过指针改 x */
    printf("after *p=10: x=%d\n", x);

    swap(&x, &y);                            /* 传"地址"进去，才能改出来 */
    printf("after swap:  x=%d  y=%d\n", x, y);

    int a[4] = {1, 2, 3, 4};
    int *q = a;                              /* 数组名就是首元素地址 */
    int s = 0;
    for (int i = 0; i < 4; i++) s += *(q + i);
    printf("array sum via pointer = %d\n", s);
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m06.sh `

 

```text
$ gcc -std=c11 -Wall -Wextra pointer.c -o pointer && ./pointer
x=3   *p=3   (p 指向 x，所以 *p 就是 x)
after *p=10: x=10
after swap:  x=8  y=10
array sum via pointer = 10
```

 

```zhizhan-anchor
m06-3
```



## 6.3 为什么函数要"传指针"才能改到实参

 

回顾 M04：C 的函数 **按值传参** ——你把 ` x ` 传进去，函数拿到的是副本，改副本不影响 ` x `。 要真正改到调用方的变量，就得告诉函数"变量在哪儿"，也就是传 ` &x `（地址），函数用 ` int * ` 接收。

 

◆ 读指针的两条口诀

 

 
- ` &变量 ` → 得到地址；` *指针 ` → 得到那块地址上的值。
 
- 声明里的 ` * ` 表示"这是指针类型"（` int *p `）；表达式里的 ` * ` 是"解引用"（` *p = 10 `）。

 

```zhizhan-anchor
m06-4
```



## 6.4 空指针与悬垂指针

 

null\_ptr.c — 用 NULL 表示"没有指向" C

 

```text
#include <stdio.h>

int main(void)
{
    int *p = NULL;                       /* 明确表示"暂时不指向任何东西" */
    if (p != NULL) {
        printf("%d\n", *p);             /* 只有非空才解引用，避免崩溃 */
    } else {
        printf("p 是空指针，先别解引用\n");
    }
    return 0;
}
```

 

⚠ 两大类指针错误

 

 
- **解引用空指针** （` *NULL `）：程序崩溃。解引用前先判 ` != NULL `。
 
- **悬垂指针** ：指向的对象已经失效（如指向已返回函数的局部变量）。用之前要保证对象还活着。

 

```zhizhan-anchor
m06-5
```



## 6.5 指针与数组的关系

 

**FIG 6.2**  数组名在多数场合"就是"首元素地址

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="a 与 &amp;a[0] 相同；a[i] 等价于 *(a+i)">
          <rect x="40" y="46" width="140" height="44" rx="6" class="sv-box"></rect>
          <text x="110" y="65" class="sv-lbl-hi" text-anchor="middle">a</text>
          <text x="110" y="81" class="sv-lbl-dim" text-anchor="middle">= &amp;a[0]</text>
          <path d="M180 68 L240 68" class="sv-arrow"></path>
          <rect x="242" y="46" width="150" height="44" rx="6" class="sv-grn-s"></rect>
          <text x="317" y="65" class="sv-lbl-hi" text-anchor="middle">a[i]</text>
          <text x="317" y="81" class="sv-lbl-dim" text-anchor="middle">= *(a + i)</text>
          <text x="520" y="60" class="sv-lbl-dim" text-anchor="middle">指针 +1 = 前进</text>
          <text x="520" y="80" class="sv-lbl-hi" text-anchor="middle">一个"元素"的大小</text>
        </svg>
```

 

` int* ` 加 1 前进 4 字节，` char* ` 加 1 前进 1 字节——步长由所指类型决定。

 

ptr\_array.c — 两种等价的遍历 C

 

```text
#include <stdio.h>

int main(void) {
    int a[4] = {1, 2, 3, 4};
    for (int i = 0; i < 4; i++) printf("%d ", a[i]);
    printf("\n");
    for (int *p = a; p < a + 4; p++) printf("%d ", *p);
    printf("\n");
    return 0;
}
```

 

| 写法 | 含义 | 何时用 |
| --- | --- | --- |
| ` *p ` | 取 p 指向的值 | 解引用访问数据 |
| ` &x ` | 取 x 的地址 | 传地址给函数 |
| ` p->m ` | 取指针所指结构体的成员 | 结构体指针 |
| ` p[i] ` | 等价 ` *(p+i) ` | 指针当数组用 |

 

```zhizhan-anchor
m06-6
```



## 6.6 指针最常见的三类错误

 

| 错误 | 现象 | 防范 |
| --- | --- | --- |
| 空指针解引用 | 段错误/崩溃 | 使用前判 ` if (p != NULL) ` |
| 悬垂指针 | 读到随机值 | free 后置 NULL，别再用 |
| 越界指针 | 读到别人的数据 | 只在 ` [0,n) ` 内 |
| 类型不匹配 | 警告/错值 | 别把 ` int* ` 当 ` char* ` |

 

| 概念 | 符号 | 读法 |
| --- | --- | --- |
| 定义指针 | ` int *p; ` | p 是一个指向 int 的指针 |
| 取地址 | ` p = &x; ` | p 指向 x |
| 解引用 | ` *p = 5; ` | 把 5 写到 p 指向处 |
| 空指针 | ` p = NULL; ` | p 不指向任何对象 |

 

◆ 迁移练习

 

写一个函数 ` void swap(int *a, int *b) ` 交换两个整数，在 main 里调用并验证；再把参数改成传值，观察为什么"换不了"。

 

| 平台 | ` sizeof(int*) ` | 说明 |
| --- | --- | --- |
| 常见 32 位 MCU | 4 字节 | 地址 32 位 |
| 64 位 PC | 8 字节 | 地址 64 位 |
| 结论 | 随平台变 | 别假设指针大小 |

 

◆ 本章要点

 

 
- 指针 = 保存地址的变量；` & ` 取地址，` * ` 解引用。
 
- 要改调用方的变量，就得传地址（` &x `），函数用指针接收。
 
- 数组名在表达式中等于首元素地址，可用 ` *(q+i) ` 遍历。
 
- ` NULL ` 表示"不指向任何东西"，解引用前先判断。
 
- 空指针、悬垂指针是 C 最危险的两类 bug——这也是后续 C\+\+/Rust 想替你解决的问题。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 填空：` &x ` 表示 \_\_\_\_\_\_，` *p ` 表示 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"取 x 的 **地址** ；按 p 里的地址 **取值** （解引用）。"}
   ```
 
2. 简答：为什么 ` swap(int a, int b) ` 改不了调用方的变量，而 ` swap(int *a, int *b) ` 可以？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"前者按值传副本，改的是副本；后者传入地址，函数通过地址直接改到了原变量。"}
   ```
 
3. 诊断：` int *p = NULL; printf("%d", *p); ` 会怎样？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"解引用空指针，通常直接崩溃（段错误）。解引用前应判 ` p != NULL `。"}
   ```
 
4. 动手：把 ` swap(&x, &y) ` 改成 ` swap(x, y) ` 试编译，看编译器报什么错——体会"类型不匹配"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会报类似 ` expected 'int *' but argument is of type 'int' ` 的错误——参数还是要地址。"}
   ```
 
5. 判断：指针本身也是变量，也占内存、也有地址。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。指针变量同样住在内存里（32 位机上通常 4 字节），它存的内容是\"另一个地址\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  写一个函数 ` void minmax(int a[], int n, int *mn, int *mx) `，一次求出数组的最小值与最大值（用指针带回结果）。

 

```zhizhan-assessment
{"id":"course-b00-m06","criterion":"画出数组、指针、指向指针的对象关系；解释 sizeof 数组和函数参数的区别。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
