# 程序是怎么跑起来的

```zhizhan-anchor
m01
```



在写第一行代码前，先建立一张地图： **你写的文本，怎么变成会运行的程序** 。 理解这条链路（写→编译→链接→运行），你就知道"报错时该看哪一环"。

 

> ◷ 约 45 分钟 · ◈ 源文件 · 编译 · 链接 · 运行 · ⚑ 第一个程序

 

```zhizhan-anchor
m01-1
```



## 1.1 一张地图：从文本到运行

 

**FIG 1.1**  从源文件到可执行程序：编译与链接是两件事

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="源文件经过编译器与链接器变成可执行文件">
          <rect x="16" y="52" width="120" height="46" rx="6" class="sv-box"></rect>
          <text x="76" y="72" class="sv-lbl-hi" text-anchor="middle">hello.c</text>
          <text x="76" y="89" class="sv-lbl-dim" text-anchor="middle">你写的文本</text>
          <path d="M136 75 L176 75" class="sv-arrow-a"></path>
          <rect x="178" y="52" width="130" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="243" y="72" class="sv-lbl-hi" text-anchor="middle">编译器 gcc</text>
          <text x="243" y="89" class="sv-lbl-dim" text-anchor="middle">查语法/生成机器码</text>
          <path d="M308 75 L348 75" class="sv-arrow"></path>
          <rect x="350" y="52" width="120" height="46" rx="6" class="sv-box"></rect>
          <text x="410" y="72" class="sv-lbl-hi" text-anchor="middle">.o 目标文件</text>
          <text x="410" y="89" class="sv-lbl-dim" text-anchor="middle">半成品</text>
          <path d="M470 75 L510 75" class="sv-arrow"></path>
          <rect x="512" y="52" width="132" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="578" y="72" class="sv-lbl-hi" text-anchor="middle">可执行文件</text>
          <text x="578" y="89" class="sv-lbl-dim" text-anchor="middle">双击/命令行可运行</text>
          <text x="410" y="126" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--amb)">↑ 链接器在这里把多个 .o 和库拼起来</text>
        </svg>
```

 

记忆点： **编译** 管"单个文件对不对"， **链接** 管"各个文件能不能接上"。报"语法错误"多是编译期，报"undefined reference"是链接期。

 

```zhizhan-anchor
m01-2
```



## 1.2 第一个程序

 

约定：所有示例都在命令行用 ` gcc ` 编译。先看这个最小程序，逐行读注释：

 

hello.c — 最小可运行程序 C

 

```text
#include <stdio.h>          /* 引入 printf 的声明 */

int main(void)              /* 程序从 main 开始执行；void 表示"不接收参数" */
{
    printf("Hello, embedded!\n");   /* \n 表示换行 */
    return 0;               /* 返回 0 表示"正常结束" */
}
```

 

**bash**  — 复跑：` bash tools/probes/m01.sh `（本机 gcc 15.2）

 

```text
$ gcc -std=c11 -Wall -Wextra hello.c -o hello
$ ./hello
Hello, embedded!
# -Wall -Wextra：打开常用警告。编译期就把问题提示出来，比运行期翻车好得多。
```

 

```zhizhan-anchor
m01-3
```



## 1.3 每一步在做什么

 

| 命令 | 产物 | 作用 |
| --- | --- | --- |
| ` gcc hello.c -o hello ` | ` hello `（可执行） | 编译 \+ 链接一步到位 |
| ` gcc -c hello.c -o hello.o ` | ` hello.o `（目标文件） | 只编译，不链接 |
| ` gcc hello.o -o hello ` | ` hello ` | 只链接 |
| ` ./hello ` | 运行结果 | 执行程序 |

 

⚠ 新手最常见的三个报错

 

 
- **` error: expected ';' `** ：漏了分号——去报错指出的 **上一行** 找。
 
- **` warning: implicit declaration of function 'printf' `** ：忘了 ` #include <stdio.h> `。
 
- **` undefined reference to 'main' `** ：没有 ` main `，或没把它加进编译命令。

 

```zhizhan-anchor
m01-4
```



## 1.4 程序运行时的样子

 

程序运行起来后，代码在被"一条条执行"，用到的变量住在内存里。 这一册后面会不断回到"内存里到底发生了什么"——这也是第①册《嵌入式 C 精读》的主线。 现在你只要记住： **变量 = 内存里的一块，有名字、有类型** 。

 

```zhizhan-anchor
m01-5
```



## 1.5 编译期报错 vs 链接期报错

 

报错先判断"在哪一环"，再对症下药。前者看源文件语法，后者看"谁没被提供"。

 

| 报错关键字 | 发生阶段 | 典型原因 |
| --- | --- | --- |
| ` expected ';' ` | 编译期 | 漏分号——看上一行 |
| ` undeclared ` | 编译期 | 变量没声明 / 拼错名字 |
| ` implicit declaration ` | 编译期 | 忘了 ` #include ` |
| ` undefined reference ` | 链接期 | 函数没实现 / 没加进编译 |
| ` multiple definition ` | 链接期 | 同名全局符号定义了两次 |

 

```zhizhan-anchor
m01-6
```



## 1.6 把三步拆开做一次

 

**FIG 1.2**  ` -c ` 只编译，再手动链接

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="源文件经 gcc -c 得到目标文件，再链接为可执行文件">
          <rect x="16" y="40" width="120" height="46" rx="6" class="sv-box"></rect>
          <text x="76" y="60" class="sv-lbl-hi" text-anchor="middle">hello.c</text>
          <text x="76" y="77" class="sv-lbl-dim" text-anchor="middle">源文件</text>
          <path d="M136 63 L176 63" class="sv-arrow"></path>
          <rect x="178" y="40" width="130" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="243" y="60" class="sv-lbl-hi" text-anchor="middle">gcc -c</text>
          <text x="243" y="77" class="sv-lbl-dim" text-anchor="middle">只编译</text>
          <path d="M308 63 L348 63" class="sv-arrow"></path>
          <rect x="350" y="40" width="120" height="46" rx="6" class="sv-box"></rect>
          <text x="410" y="60" class="sv-lbl-hi" text-anchor="middle">hello.o</text>
          <text x="410" y="77" class="sv-lbl-dim" text-anchor="middle">目标文件</text>
          <path d="M470 63 L510 63" class="sv-arrow"></path>
          <rect x="512" y="40" width="132" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="578" y="60" class="sv-lbl-hi" text-anchor="middle">hello</text>
          <text x="578" y="77" class="sv-lbl-dim" text-anchor="middle">可执行</text>
        </svg>
```

 

停在 ` .o ` 能单独验证"编译"；再链接验证"谁调用了谁"。

 

三步拆开（bash） bash

 

```text
$ gcc -std=c11 -Wall -Wextra -c hello.c -o hello.o   # 只编译
$ gcc hello.o -o hello                          # 只链接
$ ./hello
```

 

| 阶段 | 命令 | 产物 |
| --- | --- | --- |
| 编译 | ` gcc -c hello.c -o hello.o ` | ` hello.o ` |
| 链接 | ` gcc hello.o -o hello ` | ` hello ` |
| 一步到位 | ` gcc hello.c -o hello ` | ` hello ` |

 

◆ 迁移练习

 

把 ` hello.c ` 拆成"先 ` -c ` 出 ` .o `、再链接"两步各跑一次；故意删掉一个分号，观察报错出现在编译期还是链接期。

 

| 新手问题 | 一句话答案 |
| --- | --- |
| 为什么要有 ` main `？ | 它是程序入口，运行时从这里开始 |
| ` .o ` 能直接运行吗？ | 不能，必须链接成可执行文件 |
| ` -Wall ` 是必须的吗？ | 不是必须，但强烈建议开 |
| 报错很多，先看哪条？ | 第一条，后面的常是它的连锁反应 |

 

hello.c — 亲手编译运行 C

 

```text
#include <stdio.h>

int main(void) {
    printf("Hello, embedded!\n");
    return 0;
}
```

 

◆ 本章要点

 

 
- 链路：源文件 →（编译）→ 目标文件 →（链接）→ 可执行文件 →（运行）。
 
- 编译管"单文件对不对"，链接管"各文件能不能接上"。
 
- 程序从 ` main ` 开始；` return 0 ` 表示正常结束。
 
- 编译时加 ` -Wall -Wextra `，让编译器尽早提醒。
 
- 看到报错先判断"是编译期还是链接期"，再去对应环节找。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 填空：把 ` hello.c ` 变成可执行文件的两个阶段是 \_\_\_\_\_\_ 和 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**编译** 与 **链接** 。编译把源文件变成目标文件（.o），链接把目标文件与库拼成可执行文件。"}
   ```
 
2. 判断：` gcc hello.c -o hello ` 这条命令里，` hello.c ` 是输出的程序名。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错。` hello.c ` 是输入（源文件），` -o hello ` 才指定输出名为 ` hello `。"}
   ```
 
3. 诊断：报错 ` undefined reference to 'main' `，最可能的原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"本章的宿主环境程序缺少 ` main ` 函数，或它没有被编译进去。裸机等独立环境的启动入口由实现、启动文件和链接配置约定，不能把这里的规则直接套用到所有 C 程序。"}
   ```
 
4. 动手：把 ` hello.c ` 的最后一行 ` return 0; ` 删掉再编译运行，看会发生什么；再删掉一个分号试试。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"删 ` return 0; ` 在 C99 及之后的宿主环境中仍是合法程序：走到 main 末尾等价于返回 0，不要求编译器告警；删分号会得到 ` expected ';' `——亲手制造一次错误，比看文字记得牢。"}
   ```
 
5. 判断：编译器报的错，位置一定就在那一行的语法上。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。C 的报错常指向\"发现问题的位置\"，而问题往往在 **上一行或更早** （比如漏分号）。第一处报错最值得看。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  在本机装好 gcc，把 ` hello.c ` 亲手编译并运行一次。

 

```zhizhan-assessment
{"id":"course-b00-m01","criterion":"分别执行编译与链接；漏分号是编译错误，漏目标文件是链接错误；解释 C99 宿主 main 走到末尾的返回值。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
