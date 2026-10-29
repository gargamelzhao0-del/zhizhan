# 综合小项目 + 过渡到第①册

```zhizhan-anchor
m09
```



把前面学的拼起来：用 **结构体 \+ 数组 \+ 函数 \+ 多文件 \+ Makefile** 写一个真实的小工具（统计一组数的 min/max/mean）， 然后告诉你——第①册会把这些知识引向哪里。

 

> ◷ 约 70 分钟 · ◈ 多文件综合 · 工程结构 · ⚑ 从练习到工程

 

```zhizhan-anchor
m09-1
```



## 9.1 题目：统计一组测量值

 

需求：给一组小数，算出 **最小值、最大值、平均值** ，并以一条记录（结构体）返回。这正是设备日志/传感器数据的常见处理。

 

stats.h — 接口：一个结构体 \+ 一个函数 C

 

```text
#ifndef STATS_H
#define STATS_H
typedef struct { double min, max, mean; int n; } Stats;
Stats stats_of(const double *xs, int n);
#endif
```

 

stats.c — 实现（数组 \+ 循环 \+ 指针参数） C

 

```text
#include "stats.h"
Stats stats_of(const double *xs, int n) {
    Stats s = {0, 0, 0, n};
    if (n <= 0) return s;
    s.min = s.max = xs[0];
    double sum = 0;
    for (int i = 0; i < n; i++) {
        if (xs[i] < s.min) s.min = xs[i];
        if (xs[i] > s.max) s.max = xs[i];
        sum += xs[i];
    }
    s.mean = sum / n;
    return s;
}
```

 

main.c — 驱动 C

 

```text
#include <stdio.h>
#include "stats.h"
int main(void) {
    double xs[] = {3.2, 1.5, 9.8, 4.0, 2.6, 7.1};
    int n = (int)(sizeof(xs) / sizeof(xs[0]));
    Stats s = stats_of(xs, n);
    printf("samples=%d  min=%.1f  max=%.1f  mean=%.2f\n", s.n, s.min, s.max, s.mean);
    return 0;
}
```

 

Makefile — 用模式规则少写重复 Makefile

 

```text
CC = gcc
CFLAGS = -std=c11 -Wall -Wextra
app: main.o stats.o
	$(CC) $(CFLAGS) main.o stats.o -o app
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@
clean:
	rm -f *.o app
```

 

**bash**  — 复跑：` bash tools/probes/m09.sh `

 

```text
$ make
gcc -std=c11 -Wall -Wextra -c main.c -o main.o
gcc -std=c11 -Wall -Wextra -c stats.c -o stats.o
gcc -std=c11 -Wall -Wextra main.o stats.o -o app
$ ./app
samples=6  min=1.5  max=9.8  mean=4.70
# 一个完整的"工程结构"雏形：接口(.h) / 实现(.c) / 驱动(main.c) / 构建(Makefile)。
```

 

```zhizhan-anchor
m09-2
```



## 9.2 你现在具备了什么

 

| 能力 | 来源 |
| --- | --- |
| 写、编译、运行一个 C 程序 | M01 |
| 用类型/变量/表达式表达数据与计算 | M02 |
| 用分支与循环控制流程 | M03 |
| 用函数拆分逻辑、理解作用域 | M04 |
| 用数组与字符串处理批量数据 | M05 |
| 用指针传址、访问"地址" | M06 |
| 用结构体/枚举/typedef 描述对象 | M07 |
| 多文件组织 \+ Makefile 构建 | M08 |

 

```zhizhan-anchor
m09-3
```



## 9.3 过渡：第①册会发现什么

 

**FIG 9.1**  本册到第①册：从"会用 C"到"看懂 C 与硬件之间的每一层"

 

```zhizhan-figure
<svg viewBox="0 0 660 168" role="img" aria-label="B00 到 B01 的过渡">
          <rect x="20" y="52" width="200" height="62" rx="8" class="sv-box"></rect>
          <text x="120" y="78" class="sv-lbl-hi" text-anchor="middle">B00（本册）</text>
          <text x="120" y="97" class="sv-lbl-dim" text-anchor="middle">会写、会编、能调小工具</text>
          <path d="M220 83 L300 83" class="sv-arrow"></path>
          <rect x="302" y="30" width="338" height="106" rx="8" class="sv-grn-s"></rect>
          <text x="320" y="54" class="sv-lbl-hi" style="fill:var(--grn)">B01《嵌入式 C 精读》会继续深入</text>
          <text x="320" y="76" class="sv-lbl-dim">数据在内存里怎么摆、存储期/链接属性</text>
          <text x="320" y="96" class="sv-lbl-dim">指针的本质、内存分区、编译链接全流程</text>
          <text x="320" y="116" class="sv-lbl-dim">位操作与寄存器编程、调试与工具链</text>
        </svg>
```

 

本册是"能用"；第①册是"看透"。尤其 **指针与内存** ——你在这里学了"指针是地址"，第①册会讲清"地址背后是内存布局、段、对齐"，直到你能直接操作单片机寄存器。

 

◆ 下一步怎么走

 

 
- 打开第①册《嵌入式 C 精读》——它会重讲指针/内存，但从"硬件"的角度。
 
- 再往后：C\+\+/Rust（把 C 的经验带到现代语言）、Python（上位机工具），然后进入外设、RTOS……
 
- 学习方式不变： **每个示例都亲手编译、运行、改错。**

 

```zhizhan-anchor
m09-4
```



## 9.4 把项目拆成数据流

 

**FIG 9.2**  综合项目：输入 → 计算 → 输出

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="数据从数组读入，经统计函数处理，结果打印；接口用结构体打包">
          <rect x="30" y="44" width="140" height="48" rx="6" class="sv-box"></rect>
          <text x="100" y="66" class="sv-lbl-hi" text-anchor="middle">测量值数组</text>
          <text x="100" y="84" class="sv-lbl-dim" text-anchor="middle">输入</text>
          <path d="M170 68 L220 68" class="sv-arrow"></path>
          <rect x="222" y="44" width="180" height="48" rx="6" class="sv-grn-s"></rect>
          <text x="312" y="66" class="sv-lbl-hi" text-anchor="middle">stats()</text>
          <text x="312" y="84" class="sv-lbl-dim" text-anchor="middle">min/max/avg</text>
          <path d="M402 68 L452 68" class="sv-arrow"></path>
          <rect x="454" y="44" width="150" height="48" rx="6" class="sv-amb-s"></rect>
          <text x="529" y="66" class="sv-lbl-hi" text-anchor="middle">Stats 结构体</text>
          <text x="529" y="84" class="sv-lbl-dim" text-anchor="middle">输出</text>
        </svg>
```

 

接口用"一个结构体 \+ 一个函数"表达，实现细节（数组、循环、指针）藏在 ` stats.c ` 里。

 

| 阶段 | 文件 | 职责 |
| --- | --- | --- |
| 接口 | ` stats.h ` | 声明结构体与函数 |
| 实现 | ` stats.c ` | 数组\+循环\+指针 |
| 驱动 | ` main.c ` | 准备数据、调用、打印 |
| 构建 | ` Makefile ` | 模式规则增量编译 |

 

| 常见报错 | 原因 | 修复 |
| --- | --- | --- |
| ` undefined reference to stats ` | 没链接 stats.c | 把 stats.c 加进编译 |
| ` too few arguments ` | 调用参数个数不对 | 对齐声明 |
| avg 为整数 | 除法用了 int | 用 ` (double) ` 或 ` sum/n.0 ` |
| 读越界 | 循环 ` i<=n ` | 改成 ` i<n ` |

 

```zhizhan-anchor
m09-5
```



## 9.5 学完自评与下一步

 

| 能力 | 你现在应该能 | 对应模块 |
| --- | --- | --- |
| 读懂程序 | 说出从 .c 到运行的链路 | M01 |
| 基本语法 | 变量/类型/分支/循环 | M02–M03 |
| 组织代码 | 函数/数组/指针/结构体 | M04–M07 |
| 多文件工程 | 拆文件、写 Makefile | M08 |
| 综合应用 | 独立完成一个小项目 | M09 |

 

| 下一步 | 书名 | 为什么 |
| --- | --- | --- |
| 原理主线 | 《嵌入式 C 精读》 | 看懂内存/指针/硬件的每一层 |
| 平台实践 | 单片机裸机与外设驱动 | 把 C 用到真实硬件 |
| 系统入门 | 嵌入式 Linux 系统 | 从小到大、从单机到系统 |

 

◆ 迁移练习

 

给自己出一道"小项目"题（比如统计一段温度数据的最高/最低/平均），用本册学到的"接口 \+ 实现 \+ 驱动 \+ Makefile"结构独立完成并让它跑出正确结果。

 

◆ 本章要点

 

 
- 把结构体、数组、函数、多文件、Makefile 组合起来，就是一个"工程结构"雏形。
 
- 接口放 ` .h `、实现放 ` .c `、驱动放 ` main.c `、构建用 ` Makefile `。
 
- 模式规则 ` %.o: %.c ` 减少重复。
 
- 你已经具备"写、编译、调试一个小 C 程序"的能力。
 
- 继续读第①册：从"会用 C"走向"看懂 C 与硬件之间的每一层"。

 

◆ 自测 · Module 09（先答再看）

 

 
1. 填空：一个清晰的 C 工程通常有 接口(\_\_\_\_\_\_)、实现(\_\_\_\_\_\_)、驱动(\_\_\_\_\_\_)、构建(\_\_\_\_\_\_)。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` .h ` / ` .c ` / ` main.c ` / ` Makefile `。"}
   ```
 
2. 判断：本册学完就已经能驱动单片机外设了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"还不行。本册是语言与工具基础；驱动外设需要第①册（寄存器/内存）到第③册（外设驱动）的知识。"}
   ```
 
3. 诊断：` stats_of ` 对空数组（n=0）返回了全 0，为什么要单独判断 ` n<=0 `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"否则 ` mean = sum/0 ` 会除以零（浮点得到 inf/nan）。防御式处理边界，是工程代码的基本习惯。"}
   ```
 
4. 动手：给 ` Stats ` 加一个 ` median `（中位数）字段，并在 ` stats.c ` 里算出来（提示：需要先排序或找中位）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"这是很好的综合练习：涉及数组操作、排序（M03 循环 \\+ M05 数组）、以及接口改动（.h 同步改）——正是工程里\"改一处、动多处、靠编译器帮你查\"的体验。"}
   ```
 
5. 判断：学完本册可以跳过第①册直接学单片机。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不建议。第①册讲的内存布局、指针本质、寄存器编程，正是驱动外设的前提；跳过去会\"能抄不能懂\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**B00 完成？**  恭喜——你已经能从零写、编译、调试一个小型 C 程序。下一步请打开《嵌入式 C 精读》(B01)。

 

```zhizhan-assessment
{"id":"course-b00-m09","criterion":"从空目录完成记录 CLI，正常输出可对拍，坏输入有错误退出码与定位信息。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
