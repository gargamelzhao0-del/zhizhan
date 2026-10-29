# 控制流：分支与循环

```zhizhan-anchor
m03
```



程序不是从头到尾只跑一遍。这一节讲三样：` if/else `（怎么选）、` for/while `（怎么重复）、 ` break/continue `（怎么提前跳出）。

 

> ◷ 约 50 分钟 · ◈ if/else · for/while · break/continue · ⚑ 制造循环

 

```zhizhan-anchor
m03-1
```



## 3.1 分支：` if / else if / else `

 

branch.c — 按分数分级 C

 

```text
#include <stdio.h>

int main(void)
{
    int score = 82;
    if (score >= 90)       printf("A\n");
    else if (score >= 80)  printf("B\n");     /* 只走第一个为真的分支 */
    else if (score >= 60)  printf("C\n");
    else                   printf("D\n");
    return 0;
}
```

 

◆ else if 是"从上往下，第一个命中"

 

写条件时 **顺序很重要** 。若把 ` score >= 60 ` 放在最前，80 分会先命中它、判成 C。范围判断要从"最严"写到"最松"。

 

```zhizhan-anchor
m03-2
```



## 3.2 循环：` for ` 与 ` while `

 

loops.c — for / while 两种写法 C

 

```text
#include <stdio.h>

int main(void)
{
    /* for：已知次数 */
    int sum = 0;
    for (int i = 1; i <= 100; i++) sum += i;
    printf("1..100 的和 = %d\n", sum);

    /* while：次数不确定、看条件 */
    int n = 27, steps = 0;
    while (n != 1) {
        n = (n % 2 == 0) ? n / 2 : 3 * n + 1;   /* 三目运算符：条件 ? 甲 : 乙 */
        steps++;
    }
    printf("27 到 1 用了 %d 步\n", steps);
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m03.sh `

 

```text
$ gcc -std=c11 -Wall -Wextra loops.c -o loops && ./loops
1..100 的和 = 5050
27 到 1 用了 111 步
```

 

```zhizhan-anchor
m03-3
```



## 3.3 break 与 continue

 

fizzbuzz.c — 综合练习（可运行） C

 

```text
#include <stdio.h>

int main(void)
{
    for (int i = 1; i <= 15; i++) {
        if (i % 15 == 0)      printf("FizzBuzz\n");   /* 先判最特殊的 */
        else if (i % 3 == 0)  printf("Fizz\n");
        else if (i % 5 == 0)  printf("Buzz\n");
        else                  printf("%d\n", i);
    }
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m03.sh `

 

```text
$ ./fizzbuzz
1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz
```

 

⚠ ` break ` 与 ` continue ` 的区别

 

 
- ` break `： **跳出整个循环** ，后面的迭代不再执行。
 
- ` continue `： **跳过本次迭代剩下的部分** ，进入下一次。
 
- 新手最常见的死循环：` while (i < n) ` 里忘了让 ` i ` 自增。

 

```zhizhan-anchor
m03-4
```



## 3.4 三个循环变量别写错

 

**FIG 3.1**  ` for ` 的三段：初始化 → 判断 → 自增

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="for 循环先初始化，判断成立则执行循环体并自增，再回到判断">
          <rect x="40" y="42" width="120" height="44" rx="6" class="sv-cyn-s"></rect>
          <text x="100" y="69" class="sv-lbl-hi" text-anchor="middle">i = 0</text>
          <path d="M160 64 L210 64" class="sv-arrow"></path>
          <rect x="212" y="42" width="140" height="44" rx="6" class="sv-amb-s"></rect>
          <text x="282" y="69" class="sv-lbl-hi" text-anchor="middle">i &lt; n ?</text>
          <path d="M352 64 L402 64" class="sv-arrow"></path>
          <rect x="404" y="42" width="130" height="44" rx="6" class="sv-grn-s"></rect>
          <text x="469" y="69" class="sv-lbl-hi" text-anchor="middle">循环体</text>
          <path d="M469 86 L469 116 L100 116 L100 90" class="sv-arrow-a"></path>
          <text x="285" y="128" class="sv-lbl-dim" text-anchor="middle">i++ 后回判断；条件不成立则结束</text>
        </svg>
```

 

漏写 ` i++ ` 会死循环；用 ` i <= n ` 还是 ` i < n ` 决定"多跑一次还是少跑一次"。

 

| 写法 | 循环次数 | 用途 |
| --- | --- | --- |
| ` for(i=0;i<n;i++) ` | n | 遍历 0..n-1 |
| ` for(i=1;i<=n;i++) ` | n | 计数 1..n |
| ` while(1){...} ` | 无限 | 前后台主循环 |
| ` do{...}while(cond) ` | ≥1 | 至少执行一次 |

 

```zhizhan-anchor
m03-5
```



## ` break ` 与 ` continue ` 的区别

 

**FIG 3.2**  ` continue ` 跳过本轮，` break ` 结束整个循环

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="continue 回到循环判断继续下一轮，break 直接跳出循环">
          <rect x="30" y="30" width="150" height="40" rx="6" class="sv-box"></rect>
          <text x="105" y="55" class="sv-lbl-hi" text-anchor="middle">循环体开始</text>
          <rect x="220" y="30" width="150" height="40" rx="6" class="sv-amb-s"></rect>
          <text x="295" y="55" class="sv-lbl-hi" text-anchor="middle">continue → 下一轮</text>
          <rect x="410" y="30" width="150" height="40" rx="6" class="sv-red-s"></rect>
          <text x="485" y="55" class="sv-lbl-hi" text-anchor="middle">break → 结束循环</text>
          <text x="330" y="105" class="sv-lbl-dim" text-anchor="middle">两者都只影响"最近的一层"循环</text>
        </svg>
```

 

嵌套循环里 ` break ` 只跳出内层——想跳出全部，需要标志位或 ` goto `。

 

continue\_break.c — 只打印偶数，遇到负数就停 C

 

```text
#include <stdio.h>

int main(void) {
    int a[] = {1, -2, 3, 4, 5, -1};
    for (int i = 0; i < 6; i++) {
        if (a[i] < 0) break;          /* 遇到负数，整个循环结束 */
        if (a[i] % 2 != 0) continue;  /* 奇数，跳过本轮 */
        printf("%d ", a[i]);
    }
    return 0;
}
```

 

| 控制语句 | 作用范围 | 常见误用 |
| --- | --- | --- |
| ` break ` | 最近一层循环/switch | 以为能跳出外层 |
| ` continue ` | 最近一层循环 | for 里忘了自增 |
| ` return ` | 整个函数 | 在 main 里当 break 用 |
| 标志位 | 配合 break 跳出外层 | 忘记在每个循环里判断 |

 

| 场景 | 推荐写法 |
| --- | --- |
| 已知次数 | ` for ` |
| 未知次数、条件驱动 | ` while ` |
| 至少执行一次 | ` do...while ` |
| 遍历数组 | ` for(i=0;i<n;i++) ` |

 

◆ 迁移练习

 

写一段程序：从 1 数到 20，跳过所有 3 的倍数，并在遇到 15 时提前结束；用输出验证 ` continue ` 与 ` break ` 的行为。

 

| 循环常见 bug | 症状 | 修复 |
| --- | --- | --- |
| 漏写 ` i++ ` | 死循环 | 补上自增 |
| ` i<=n ` 越界 | 多访问一个元素 | 改 ` i<n ` |
| 循环里改循环变量 | 次数不可预测 | 用独立变量 |
| 浮点做循环变量 | 精度误差 | 改用整数计数 |

 

◆ 本章要点

 

 
- ` if/else if/else ` 从上往下，命中第一个为真的分支——范围判断从严到松。
 
- ` for ` 适合已知次数，` while ` 适合看条件。
 
- ` break ` 跳出循环，` continue ` 跳过本次。
 
- 三目运算符 ` 条件 ? 甲 : 乙 ` 是 if-else 的简洁写法。
 
- 循环里别忘了让条件 **逐步逼近结束** ，否则死循环。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 填空：想让循环"提前结束"，用 \_\_\_\_\_\_；想"跳过本次继续下一次"，用 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` break ` / ` continue `。"}
   ```
 
2. 判断：` for (int i = 0; i < 5; i++) ` 会执行 6 次循环体。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错，执行 5 次（i = 0,1,2,3,4）。条件是\"小于 5\"。"}
   ```
 
3. 诊断：` while (i < 10) { printf("%d", i); } ` 为什么会停不下来？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"循环体里没有改变 ` i `，条件永远为真。应在体内 ` i++ `。"}
   ```
 
4. 动手：把 ` branch.c ` 的条件顺序打乱（把 ` >=60 ` 放最前），看 82 分变成什么等级，体会"顺序敏感"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会先命中 ` >=60 ` → 输出 C。这说明分支顺序会改变结果。"}
   ```
 
5. 判断：` for ` 和 ` while ` 能互相改写。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"能。任何 ` for ` 都能写成 ` while `；` for ` 只是把\"初始化 / 条件 / 步进\"三件事写在一行，更紧凑。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  写一个程序：用循环找出 1~100 里所有能被 7 整除的数，并统计个数。

 

```zhizhan-assessment
{"id":"course-b00-m03","criterion":"给分支和循环列零次、一次、边界输入；写出循环不变量并解释终止条件。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
