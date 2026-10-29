# 函数与作用域

```zhizhan-anchor
m04
```



当程序变长，"从头写到尾"就乱了。函数把一段逻辑 **命名、封装、复用** 。这一节讲函数怎么定义与调用、 参数与返回值、递归，以及"变量在哪儿有效"——作用域。

 

> ◷ 约 55 分钟 · ◈ 定义/调用 · 递归 · 局部/全局 · ⚑ 分而治之

 

```zhizhan-anchor
m04-1
```



## 4.1 定义与调用

 

functions.c — 定义、调用、递归（可运行） C

 

```text
#include <stdio.h>

int add(int a, int b) { return a + b; }          /* 参数 a,b；返回 int */
int max3(int a, int b, int c) {
    int m = a;
    if (b > m) m = b;
    if (c > m) m = c;
    return m;
}
int factorial(int n) {                            /* 递归：n! = n * (n-1)! */
    if (n <= 1) return 1;                         /* 递归出口，必须有 */
    return n * factorial(n - 1);
}

int main(void)
{
    printf("add(3,4)      = %d\n", add(3, 4));
    printf("max3(3,9,5)   = %d\n", max3(3, 9, 5));
    printf("factorial(5)  = %d\n", factorial(5));
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m04.sh `

 

```text
$ gcc -std=c11 -Wall -Wextra functions.c -o functions && ./functions
add(3,4)      = 7
max3(3,9,5)   = 9
factorial(5)  = 120
```

 

```zhizhan-anchor
m04-2
```



## 4.2 递归：函数自己调用自己

 

` factorial(5) ` 展开成 ` 5 * factorial(4) * ... * factorial(1) `。 递归必须有一个 **出口** （这里 ` n <= 1 `），否则会一直调用、最终把栈撑爆（` stack overflow `）。

 

⚠ 递归与迭代的选择

 

能用循环解决的，循环更省内存（不占栈）。递归适合"问题本身就是分层的"（树、分治）。嵌入式里栈很小，递归要 **格外克制** 。

 

```zhizhan-anchor
m04-3
```



## 4.3 作用域：变量在哪儿有效

 

scope.c — 局部与全局 C

 

```text
#include <stdio.h>

int g = 100;                        /* 全局：整个文件可见 */

void f(void) {
    int g = 5;                      /* 局部：只在 f 里有效，遮蔽同名的全局 */
    printf("f 里的 g = %d\n", g);
}

int main(void)
{
    printf("main 里的 g = %d\n", g);   /* 看到全局的 100 */
    f();                              /* 看到局部的 5 */
    printf("调用后 g 仍 = %d\n", g);   /* f 的局部变量已销毁 */
    return 0;
}
```

 

◆ 三条作用域规则

 

 
- **局部变量** ：活到它所在的花括号结束，出了范围就销毁。
 
- **同名遮蔽** ：内层的局部会"挡住"外层的同名变量（上面的 ` g `）。
 
- **未初始化** ：局部变量不会自动清零，用之前一定先赋值（全局变量会自动为 0）。

 

```zhizhan-anchor
m04-4
```



## 4.4 函数调用时栈上发生了什么

 

**FIG 4.1**  调用函数＝把返回地址与参数压栈，用完再弹回

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="主函数调用 add 时，把返回地址与参数压入调用栈，返回时恢复">
          <rect x="30" y="30" width="180" height="90" rx="6" class="sv-box"></rect>
          <text x="120" y="52" class="sv-lbl-hi" text-anchor="middle">main 的栈帧</text>
          <text x="120" y="74" class="sv-lbl-dim" text-anchor="middle">局部变量 · 返回地址</text>
          <text x="120" y="96" class="sv-lbl-dim" text-anchor="middle">调用 add(2,3)</text>
          <path d="M210 75 L270 75" class="sv-arrow"></path>
          <rect x="272" y="30" width="180" height="90" rx="6" class="sv-grn-s"></rect>
          <text x="362" y="52" class="sv-lbl-hi" text-anchor="middle">add 的栈帧</text>
          <text x="362" y="74" class="sv-lbl-dim" text-anchor="middle">参数 x,y · 局部 result</text>
          <text x="362" y="96" class="sv-lbl-dim" text-anchor="middle">返回后自动弹出</text>
          <text x="530" y="70" class="sv-lbl-dim" text-anchor="middle">递归越深，</text>
          <text x="530" y="90" class="sv-lbl-hi" text-anchor="middle">栈越"高"</text>
        </svg>
```

 

这解释了"递归太深会栈溢出"：每一层调用都要占用一段栈。

 

add.c — 观察参数与返回值 C

 

```text
#include <stdio.h>

int add(int x, int y);       /* 声明 */

int main(void) {
    printf("sum = %d\n", add(2, 3));
    return 0;
}

int add(int x, int y) {      /* 定义 */
    int result = x + y;
    return result;
}
```

 

| 概念 | 含义 | 注意 |
| --- | --- | --- |
| 形参 | 函数定义里的参数名 | 是局部变量 |
| 实参 | 调用时传进去的值 | 值传递：拷贝一份 |
| 返回值 | 函数交回的结果 | 类型要匹配 |
| 栈帧 | 每次调用占用的内存 | 递归深＝栈压力大 |

 

```zhizhan-anchor
m04-5
```



## 4.5 递归：优雅但要知道边界

 

**FIG 4.2**  求 4! 时递归一层层深入再返回

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="阶乘递归调用 4→3→2→1，逐层返回相乘">
          <rect x="30" y="30" width="90" height="36" rx="6" class="sv-cyn-s"></rect>
          <text x="75" y="53" class="sv-lbl-hi" text-anchor="middle">4!</text>
          <rect x="150" y="30" width="90" height="36" rx="6" class="sv-cyn-s"></rect>
          <text x="195" y="53" class="sv-lbl-hi" text-anchor="middle">3!</text>
          <rect x="270" y="30" width="90" height="36" rx="6" class="sv-cyn-s"></rect>
          <text x="315" y="53" class="sv-lbl-hi" text-anchor="middle">2!</text>
          <rect x="390" y="30" width="90" height="36" rx="6" class="sv-grn-s"></rect>
          <text x="435" y="53" class="sv-lbl-hi" text-anchor="middle">1!=1</text>
          <path d="M120 48 L150 48" class="sv-arrow"></path>
          <path d="M240 48 L270 48" class="sv-arrow"></path>
          <path d="M360 48 L390 48" class="sv-arrow"></path>
          <text x="480" y="48" class="sv-lbl-hi" text-anchor="middle">→ 逐层返回 ×n</text>
        </svg>
```

 

**基准情形** （n≤1 返回 1）必须存在，否则无限递归直到栈溢出。

 

factorial.c — 递归求阶乘 C

 

```text
#include <stdio.h>

long fact(int n) {
    if (n <= 1) return 1;      /* 基准情形，必须有 */
    return n * fact(n - 1);
}

int main(void) {
    printf("4! = %ld\n", fact(4));
    return 0;
}
```

 

| 对比 | 递归 | 迭代（循环） |
| --- | --- | --- |
| 代码形态 | 简洁、贴近数学定义 | 直白、略长 |
| 内存 | 每层占栈帧 | 固定 |
| 风险 | 太深→栈溢出 | 较少 |
| 适用 | 树/分治、可证明边界 | 计数、遍历 |

 

| 作用域 | 可见范围 | 生命周期 |
| --- | --- | --- |
| 局部变量 | 函数内（含嵌套块） | 函数执行期间 |
| 全局变量 | 所有文件（加 extern） | 整个程序 |
| 形参 | 函数内 | 函数执行期间 |
| static 局部 | 函数内 | 整个程序（值保留） |

 

◆ 迁移练习

 

把一个用递归写的求阶乘改成迭代（循环）版本，比较两者的可读性与"n 很大时"的行为；再故意去掉基准情形，观察崩溃。

 

| 写函数的三条建议 | 原因 |
| --- | --- |
| 一个函数只做一件事 | 易读、易测、易复用 |
| 参数别太多（≤4 个） | 太多说明职责不清晰 |
| 返回值表达成功/失败 | 调用方能据此处理错误 |

 

◆ 本章要点

 

 
- 函数 = 名字 \+ 参数 \+ 返回值 \+ 自己的作用域；便于复用与分工。
 
- 返回值交给调用方；` void ` 表示不返回值。
 
- 递归必须有出口；嵌入式栈小，慎用深递归。
 
- 局部变量只在花括号内有效，离开即销毁；同名会遮蔽。
 
- 局部变量 **不自动清零** ，用前先赋值。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 填空：递归函数必须有一个 \_\_\_\_\_\_，否则会无限调用导致栈溢出。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"递归 **出口** （终止条件）。"}
   ```
 
2. 判断：局部变量会和全局变量一样自动初始化为 0。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。全局（静态）变量自动为 0； **局部变量不自动清零** ，内容是随机的，必须先赋值再用。"}
   ```
 
3. 诊断：一段程序里 ` int x; ` 未赋值就读它，会怎样？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"读到的是不确定的垃圾值（未定义）。这是常见 bug，务必\"声明即初始化\"或使用前赋值。"}
   ```
 
4. 动手：给 ` factorial ` 传入 -1，看会发生什么（出口 ` n<=1 ` 会返回 1，想想为什么这仍不够健壮）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"返回 1（因为 -1\\<=1）。但数学上阶乘对负数无意义——好的做法是 **校验参数** ，这也是后续工程化里\"防御式编程\"的雏形。"}
   ```
 
5. 判断：函数参数是按值传递的，函数里改形参不影响调用方的实参。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。C 默认按值传递；要让函数改到调用方的变量，得传 **指针** （下一节 M06）。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  写几个函数：判断素数、求最大公约数（用循环），再用一个递归函数求斐波那契第 n 项。

 

```zhizhan-assessment
{"id":"course-b00-m04","criterion":"拆出有参数和返回值的函数；解释局部对象生命与文件作用域，禁止返回局部数组地址。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
