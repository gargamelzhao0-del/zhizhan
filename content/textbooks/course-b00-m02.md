# 变量、类型与表达式

```zhizhan-anchor
m02
```



程序做的事就是"把数据存起来、算出来"。这一节讲清 C 的 **基本类型** 、变量怎么声明、` printf ` 怎么输出， 以及一个新手最容易踩的坑： **整数除法** 。

 

> ◷ 约 55 分钟 · ◈ int/double/char · printf · 运算符 · ⚑ 类型决定一切

 

```zhizhan-anchor
m02-1
```



## 2.1 四个最常用的类型

 

| 类型 | 存什么 | 本机大小 | 输出格式 |
| --- | --- | --- | --- |
| ` int ` | 整数（如 7, -3） | 4 字节 | ` %d ` |
| ` double ` | 小数（如 3.5） | 8 字节 | ` %.2f `（保留 2 位） |
| ` char ` | 单个字符（如 'A'） | 1 字节 | ` %c ` |
| ` unsigned ` | 非负整数（如计数） | 4 字节 | ` %u ` |

 

◆ "类型"到底决定了什么

 

① 能存什么（整数还是小数）；② 占多少字节（` sizeof `）；③ 能做哪些运算、结果是什么类型。三者都由类型决定。

 

```zhizhan-anchor
m02-2
```



## 2.2 声明变量、算一算、打印出来

 

types.c — 变量/类型/运算符（可运行） C

 

```text
#include <stdio.h>

int main(void)
{
    int    n = 7;              /* 整数 */
    double x = 3.5;            /* 小数（双精度） */
    char   c = 'A';            /* 单个字符 */
    int    y = n / 2;          /* 整数相除：结果取整 */
    double z = n / 2.0;        /* 有一个是小数 → 结果是小数 */

    printf("int    = %d,  sizeof = %zu 字节\n", n, sizeof(int));
    printf("double = %.2f, sizeof = %zu 字节\n", x, sizeof(double));
    printf("char   = %c,  sizeof = %zu 字节\n", c, sizeof(char));
    printf("7/2 = %d,  7/2.0 = %.1f\n", y, z);
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m02.sh `

 

```text
$ gcc -std=c11 -Wall -Wextra types.c -o types && ./types
int    = 7,  sizeof = 4 字节
double = 3.50, sizeof = 8 字节
char   = A,  sizeof = 1 字节
7/2 = 3,  7/2.0 = 3.5
```

 

```zhizhan-anchor
m02-3
```



## 2.3 最容易踩的坑：整数除法

 

上面输出里 ` 7/2 = 3 ` 而不是 3.5——因为  **两个 int 相除，结果还是 int，小数部分被丢掉** 。 想得到小数，必须让其中一个操作数变成小数（写成 ` 7 / 2.0 ` 或把整数转成 double）。

 

⚠ 运算符优先级与"意外结果"

 

 
- ` a + b * c ` 先算乘除、后算加减；不确定就 **加括号** 。
 
- ` = ` 是赋值，` == ` 是判断相等——写 ` if (x = 0) ` 是常见错误（永远为"假"且改了 x）。
 
- ` % ` 是取余（只对整数）；` 7 % 2 == 1 `。

 

```zhizhan-anchor
m02-4
```



## 2.4 从键盘读入：` scanf `

 

read\_input.c — 用 scanf 读两个整数求和 C

 

```text
#include <stdio.h>

int main(void)
{
    int a, b;
    printf("输入两个整数（空格分隔）：");
    if (scanf("%d %d", &a, &b) != 2) {      /* 注意：scanf 需要"地址"(&) */
        printf("输入格式不对\n");
        return 1;
    }
    printf("%d + %d = %d\n", a, b, a + b);
    return 0;
}
```

 

⚠ scanf 必须传"地址"

 

写 ` scanf("%d", a) ` 是错的——要写 ` &a `（` & ` 取地址）。原因在 M06 讲指针时你会彻底明白：` scanf ` 要往你的变量里写值，就得知道它在内存的 **地址** 。

 

```zhizhan-anchor
m02-5
```



## 2.5 类型占多少字节：` sizeof `

 

**FIG 2.1**  同样"一个数"，占的内存不一样

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="int 4 字节、short 2 字节、char 1 字节、double 8 字节">
          <rect x="20" y="46" width="70" height="40" rx="4" class="sv-grn-s"></rect>
          <text x="55" y="64" class="sv-lbl-hi" text-anchor="middle">char</text>
          <text x="55" y="80" class="sv-lbl-dim" text-anchor="middle">1 B</text>
          <rect x="110" y="46" width="120" height="40" rx="4" class="sv-cyn-s"></rect>
          <text x="170" y="64" class="sv-lbl-hi" text-anchor="middle">short</text>
          <text x="170" y="80" class="sv-lbl-dim" text-anchor="middle">2 B</text>
          <rect x="250" y="46" width="160" height="40" rx="4" class="sv-amb-s"></rect>
          <text x="330" y="64" class="sv-lbl-hi" text-anchor="middle">int</text>
          <text x="330" y="80" class="sv-lbl-dim" text-anchor="middle">4 B</text>
          <rect x="430" y="46" width="210" height="40" rx="4" class="sv-red-s"></rect>
          <text x="535" y="64" class="sv-lbl-hi" text-anchor="middle">double</text>
          <text x="535" y="80" class="sv-lbl-dim" text-anchor="middle">8 B</text>
        </svg>
```

 

类型决定"存什么、占多少、能做什么运算"。嵌入式里省 RAM 就从类型开始（能用 ` uint8_t ` 别用 ` int `）。

 

sizeof.c — 打印各类型的大小 C

 

```text
#include <stdio.h>

int main(void) {
    printf("char=%zu short=%zu int=%zu long=%zu double=%zu\n",
           sizeof(char), sizeof(short), sizeof(int),
           sizeof(long), sizeof(double));
    return 0;
}
```

 

| 类型 | 常见字节 | 范围（近似） |
| --- | --- | --- |
| ` char ` | 1 | -128 ~ 127 |
| ` short ` | 2 | -32768 ~ 32767 |
| ` int ` | 4 | 约 ±21 亿 |
| ` double ` | 8 | 约 15 位有效数字 |

 

```zhizhan-anchor
m02-6
```



## 2.6 整数除法会"截断"

 

**FIG 2.2**  ` 7 / 2 ` 得 3，不是 3.5

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="两个整数相除，结果是整数，小数部分被直接丢弃">
          <rect x="40" y="44" width="150" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="64" class="sv-lbl-hi" text-anchor="middle">7 / 2</text>
          <text x="115" y="81" class="sv-lbl-dim" text-anchor="middle">两个 int</text>
          <path d="M190 67 L250 67" class="sv-arrow"></path>
          <rect x="252" y="44" width="150" height="46" rx="6" class="sv-red-s"></rect>
          <text x="327" y="64" class="sv-lbl-hi" text-anchor="middle">3</text>
          <text x="327" y="81" class="sv-lbl-dim" text-anchor="middle">小数被丢弃</text>
          <text x="480" y="60" class="sv-lbl-dim" text-anchor="middle">要小数：把其中一个写成 7.0 或 (double)7</text>
          <text x="480" y="80" class="sv-lbl-hi" text-anchor="middle">7.0 / 2 = 3.5</text>
        </svg>
```

 

这是新手最常踩的坑：求平均分、算百分比时忘了转成浮点，结果全是整数。

 

| 写法 | 结果 | 说明 |
| --- | --- | --- |
| ` 7 / 2 ` | 3 | 整数除法，截断 |
| ` 7 % 2 ` | 1 | 取余 |
| ` 7.0 / 2 ` | 3.5 | 有浮点参与 |
| ` (double)7 / 2 ` | 3.5 | 强制转换 |

 

| 格式符 | 对应类型 | 例子 |
| --- | --- | --- |
| ` %d ` | int | ` printf("%d", 42) ` |
| ` %f ` | double | ` printf("%f", 3.14) ` |
| ` %c ` | char | ` printf("%c", 'A') ` |
| ` %s ` | 字符串 | ` printf("%s", "hi") ` |

 

◆ 迁移练习

 

写一个程序读入两个整数，分别打印它们的商（保留小数）与余数；再故意用整数除法看差在哪里，亲手对一次答案。

 

◆ 本章要点

 

 
- 常用类型：` int `/` double `/` char `/` unsigned `；类型决定取值范围、字节数、运算结果。
 
- ` printf ` 用格式符：` %d ` 整数、` %.2f ` 小数、` %c ` 字符、` %zu ` 大小。
 
- **整数除法会截断** ：要小数就让操作数含小数。
 
- ` = ` 赋值、` == ` 比较，别混。
 
- ` scanf ` 要传变量 **地址** （` &a `）。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 填空：` int avg = 9 / 2; ` 之后 ` avg ` 是多少？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**4** 。两个 int 相除结果为 int，小数被截断。要 4.5 需写 ` 9 / 2.0 ` 并存进 double。"}
   ```
 
2. 判断：` double x = 1; ` 里 1 是小数。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"1 本身是 int，但赋给 double 变量时会自动转成 1.0。真正影响结果的是\"运算时两个操作数的类型\"。"}
   ```
 
3. 诊断：` scanf("%d", a); ` 为什么不对？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"少了取地址符 ` & `。应写 ` scanf(\"%d\", &a); `，否则 scanf 拿不到变量地址，无法写入。"}
   ```
 
4. 动手：把 ` types.c ` 里的 ` n / 2 ` 改成 ` n / 2.0 ` 与 ` (double)n / 2 `，各打印一次，比较结果。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"两者都得到 3.5；区别在写法。` (double)n ` 是\"显式类型转换\"，比隐式依赖一个小数点更清楚。"}
   ```
 
5. 判断：` if (x = 0) ` 是想判断 x 是否为 0。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错。这是 **赋值** ：先把 0 赋给 x，表达式值为 0（假），且 x 被改坏。判断相等要写 ` if (x == 0) `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  写一个小程序：读入两个整数，输出它们的和、差、积、商（商保留两位小数）。

 

```zhizhan-assessment
{"id":"course-b00-m02","criterion":"对有符号/无符号混合表达式先预测再运行；找出一次整数提升和越界风险，避免用未定义行为作为预期。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
