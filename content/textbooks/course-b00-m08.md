# 多文件、头文件与 Makefile

```zhizhan-anchor
m08
```



真实项目不会只有一个 ` .c `。这一节把代码 **拆成多个文件** 、用 **头文件** 共享声明、 用  **Makefile**  一条 ` make ` 完成编译链接。这是从"练习"走向"工程"的第一步。

 

> ◷ 约 60 分钟 · ◈ 声明/定义 · include guard · make · ⚑ 工程化起点

 

```zhizhan-anchor
m08-1
```



## 8.1 为什么拆文件：声明与定义分离

 

约定： **` .h ` 放"声明"** （别人能调用什么）， **` .c ` 放"定义"** （具体怎么实现）。 头文件被多个 ` .c ` 用 ` #include ` 引入，于是大家"看到同一个接口"。

 

math\_utils.h — 声明 \+ include guard C

 

```text
#ifndef MATH_UTILS_H
#define MATH_UTILS_H
int add(int a, int b);
int max3(int a, int b, int c);
#endif
```

 

math\_utils.c — 定义（实现） C

 

```text
#include "math_utils.h"
int add(int a, int b) { return a + b; }
int max3(int a, int b, int c) {
    int m = a;
    if (b > m) m = b;
    if (c > m) m = c;
    return m;
}
```

 

main.c — 使用这些函数 C

 

```text
#include <stdio.h>
#include "math_utils.h"
int main(void) {
    printf("add(3,4)    = %d\n", add(3, 4));
    printf("max3(3,9,5) = %d\n", max3(3, 9, 5));
    return 0;
}
```

 

◆ include guard 是什么

 

` #ifndef MATH_UTILS_H / #define / #endif `：防止同一个头文件被重复展开（比如 A 和 B 都包含了它）， 否则会出现"重复定义"。 **每个头文件都该有它。**

 

```zhizhan-anchor
m08-2
```



## 8.2 编译与链接：多个 .o 拼成一个程序

 

每个 ` .c ` 先各自编译成 ` .o `（目标文件），最后链接器把它们拼成 ` app `。 ` main.o ` 里调用 ` add ` 时只是"占个位"，链接阶段才在 ` math_utils.o ` 里找到它。

 

```zhizhan-anchor
m08-3
```



## 8.3 Makefile：增量构建

 

Makefile — 目标、依赖、命令 Makefile

 

```text
CC = gcc
CFLAGS = -std=c11 -Wall -Wextra
app: main.o math_utils.o
	$(CC) $(CFLAGS) main.o math_utils.o -o app
main.o: main.c math_utils.h
	$(CC) $(CFLAGS) -c main.c -o main.o
math_utils.o: math_utils.c math_utils.h
	$(CC) $(CFLAGS) -c math_utils.c -o math_utils.o
clean:
	rm -f *.o app
```

 

◆ Makefile 的读法：` 目标: 依赖 ` \+ 一行命令

 

` app ` 依赖 ` main.o math_utils.o `；只要依赖比目标新，就重新执行下面那行命令。 改一个 ` .c ` 只会重编它， **增量构建** 因此很快。命令行 **必须以 Tab 开头** （不能用空格）。

 

**bash**  — 复跑：` bash tools/probes/m08.sh `（本机 gcc 15.2 \+ GNU Make 4.4）

 

```text
$ make
gcc -std=c11 -Wall -Wextra -c main.c -o main.o
gcc -std=c11 -Wall -Wextra -c math_utils.c -o math_utils.o
gcc -std=c11 -Wall -Wextra main.o math_utils.o -o app
$ ./app
add(3,4)    = 7
max3(3,9,5) = 9
# 再跑一次 make：会提示 "make: 'app' is up to date."（没有文件变化就不重编）。
```

 

```zhizhan-anchor
m08-4
```



## 8.4 头文件里放什么、不放什么

 

**FIG 8.1**  声明放 .h，定义放 .c，链接器把它们接起来

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="头文件提供声明供他人 include，实现写在 .c 里，链接时合并">
          <rect x="30" y="42" width="150" height="50" rx="6" class="sv-cyn-s"></rect>
          <text x="105" y="63" class="sv-lbl-hi" text-anchor="middle">utils.h</text>
          <text x="105" y="82" class="sv-lbl-dim" text-anchor="middle">声明（接口）</text>
          <path d="M180 67 L230 67" class="sv-arrow"></path>
          <rect x="232" y="42" width="150" height="50" rx="6" class="sv-grn-s"></rect>
          <text x="307" y="63" class="sv-lbl-hi" text-anchor="middle">utils.c</text>
          <text x="307" y="82" class="sv-lbl-dim" text-anchor="middle">定义（实现）</text>
          <path d="M382 67 L432 67" class="sv-arrow"></path>
          <rect x="434" y="42" width="150" height="50" rx="6" class="sv-amb-s"></rect>
          <text x="509" y="63" class="sv-lbl-hi" text-anchor="middle">链接器</text>
          <text x="509" y="82" class="sv-lbl-dim" text-anchor="middle">拼成程序</text>
        </svg>
```

 

头文件被多个 ` .c ` 包含，所以只能放"声明"，不能放会重复的"定义"。

 

| 放到 .h | 放到 .c |
| --- | --- |
| 函数声明（原型） | 函数定义（实现） |
| ` #define ` 常量/宏 | 全局变量的实质定义 |
| ` struct `/` enum ` 定义 | 该模块的私有细节 |
| ` extern ` 声明 | 静态辅助函数 |

 

| 机制 | 写法 | 作用 |
| --- | --- | --- |
| include guard | ` #ifndef X_H ` | 防止重复包含 |
| 或 ` #pragma once ` | ` #pragma once ` | 更简洁 |
| 声明 | ` int add(int,int); ` | 告诉编译器存在 |
| 定义 | ` int add(...){...} ` | 真正实现 |

 

```zhizhan-anchor
m08-5
```



## 8.5 Makefile：只重编改过的文件

 

**FIG 8.2**  目标依赖关系决定"要不要重编"

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="make 检查目标与依赖的时间戳；依赖更新才重跑命令">
          <rect x="40" y="42" width="140" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="110" y="70" class="sv-lbl-hi" text-anchor="middle">app（目标）</text>
          <rect x="260" y="30" width="150" height="34" rx="4" class="sv-box"></rect>
          <text x="335" y="52" class="sv-lbl-hi" text-anchor="middle">main.o</text>
          <rect x="260" y="70" width="150" height="34" rx="4" class="sv-box"></rect>
          <text x="335" y="92" class="sv-lbl-hi" text-anchor="middle">utils.o</text>
          <path d="M260 47 L180 60" class="sv-arrow"></path>
          <path d="M260 87 L180 74" class="sv-arrow"></path>
          <text x="500" y="60" class="sv-lbl-dim" text-anchor="middle">改过的 .c 时间戳更新</text>
          <text x="500" y="80" class="sv-lbl-hi" text-anchor="middle">→ 只重编它</text>
        </svg>
```

 

make 的价值是"增量"：只重编改动过的文件，大工程能省大量时间。

 

| 报错 | 多半原因 | 去哪找 |
| --- | --- | --- |
| 缺少声明 | 没 include 头文件 | 看 .h 是否被包含 |
| 重复定义 | 把定义写进了 .h | 把实现移到 .c |
| undefined reference | 没把 .c/.o 加进链接 | 补进编译命令或 Makefile |
| 编译器找不到头文件 | 头文件路径不对 | 加 ` -I ` |

 

| 命令 | 作用 |
| --- | --- |
| ` make ` | 按依赖增量构建 |
| ` make clean ` | 删除中间产物 |
| ` gcc *.c -o app ` | 简单工程一步到位 |
| ` gcc -c x.c ` | 单独编译一个文件 |

 

◆ 迁移练习

 

把你的多文件工程写成一个最小 Makefile（目标、依赖、编译命令），跑一次 ` make `；改一个 ` .c ` 再 make，观察它是否"只重编改过的部分"。

 

◆ 本章要点

 

 
- 约定：` .h ` 放声明、` .c ` 放定义；头文件用 ` #include ` 共享。
 
- 头文件加  **include guard** ，防止重复展开。
 
- 多个 ` .c ` 先各自编译成 ` .o `，再由链接器拼成可执行文件。
 
- ` Makefile ` 描述"目标—依赖—命令"，实现增量构建。
 
- 命令行必须以  **Tab**  开头，这是 Makefile 最常见的坑。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 简答：为什么 ` .h ` 里放声明、` .c ` 里放定义？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"让多个 .c \"共用同一个接口\"：头文件被各自 #include，编译器据此检查调用是否匹配；实现只在一处（.c），避免重复定义。"}
   ```
 
2. 判断：include guard 可以省略，只要不重复 include 就行。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不建议。多层包含很容易间接触发重复展开；加 guard 是最稳的防重复手段。"}
   ```
 
3. 诊断：Makefile 报 ` missing separator `，最可能是？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"命令行没有以  **Tab**  开头（用了空格）。Makefile 的规则命令必须用 Tab。"}
   ```
 
4. 动手：改 ` math_utils.c ` 里 ` max3 ` 的实现，再 ` make `，观察是否只重编相关文件。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"只会重新编译 ` math_utils.c ` 并重新链接（` main.c ` 未变则不重编）——这就是增量构建。"}
   ```
 
5. 判断：链接时的 ` undefined reference to 'add' ` 说明语法写错了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是语法错，是 **链接** 问题：某个目标文件/库没被加进链接命令，或函数只有声明没有定义。这是\"编译过了、链接没过\"的典型。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 08 完成？**  把你在 M04 写的几个函数拆成 ` .h ` \+ ` .c `，写一个 Makefile，用 ` make ` 构建。

 

```zhizhan-assessment
{"id":"course-b00-m08","criterion":"把一个程序拆为两个 .c 与一个 .h，头文件重复包含安全；遗漏实现时能定位链接错误。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
