# 结构体、枚举与 typedef

```zhizhan-anchor
m07
```



自带类型不够用时，就把数据 **打包成自己的类型** 。` struct ` 表示"一条记录"，` enum ` 表示"一组命名状态"， ` typedef ` 让类型名更短好写。

 

> ◷ 约 55 分钟 · ◈ struct · enum · typedef · ⚑ 描述现实对象

 

```zhizhan-anchor
m07-1
```



## 7.1 结构体：把相关数据打包

 

structs.c — 结构体/枚举/typedef（可运行） C

 

```text
#include <stdio.h>

typedef struct { int x, y; } Point;          /* typedef：给类型起短名 */
enum Color { RED, GREEN, BLUE };             /* 枚举：一组命名常量 */

double dist2(const Point *p) {               /* 传指针，省拷贝 */
    return (double)p->x * p->x + (double)p->y * p->y;
}

int main(void)
{
    Point pts[3] = { {0, 0}, {3, 4}, {1, 1} };
    for (int i = 0; i < 3; i++)
        printf("P%d=(%d,%d)  dist2=%.0f\n", i, pts[i].x, pts[i].y, dist2(&pts[i]));

    enum Color c = GREEN;
    printf("color index = %d\n", c);
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m07.sh `

 

```text
$ gcc -std=c11 -Wall -Wextra structs.c -o structs && ./structs
P0=(0,0)  dist2=0
P1=(3,4)  dist2=25
P2=(1,1)  dist2=2
color index = 1
```

 

```zhizhan-anchor
m07-2
```



## 7.2 三个要点

 

| 写法 | 含义 |
| --- | --- |
| ` typedef struct {…} Point; ` | 定义类型并起名 ` Point `，之后直接 ` Point p; ` |
| ` p.x ` / ` p->x ` | 结构体变量用 ` . `，结构体指针用 ` -> `（` p->x ` 等价于 ` (*p).x `） |
| ` enum Color { RED, GREEN, BLUE } ` | 命名常量，默认从 0 递增（RED=0, GREEN=1, BLUE=2） |

 

◆ 为什么嵌入式到处是结构体

 

寄存器块（GPIO 的一堆寄存器）、报文帧、传感器读数（三轴 \+ 时间戳），本质都是"多个字段打包在一起"—— 结构体正是用来描述它们的。到第①册你会看到： **用结构体映射寄存器** 是嵌入式 C 的核心技巧（并伴随对齐/填充的坑）。

 

```zhizhan-anchor
m07-3
```



## 7.3 传结构体的两种方式

 

⚠ 大结构体别按值传

 

 
- **按值传**  ` f(Point p) `：会把整个结构体复制一份，字段多时开销大。
 
- **传指针**  ` f(const Point *p) `：只传一个地址，配合 ` const ` 表示"只读不改"——嵌入式推荐。

 

```zhizhan-anchor
m07-4
```



## 7.4 结构体在内存里是"打包"的

 

**FIG 7.1**  一个结构体把不同字段装在一起

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="Sensor 结构体含 id/温度/有效标志，字段按声明顺序排列">
          <rect x="40" y="40" width="240" height="60" rx="6" class="sv-box"></rect>
          <text x="160" y="60" class="sv-lbl-hi" text-anchor="middle">struct Sensor</text>
          <text x="160" y="82" class="sv-lbl-dim" text-anchor="middle">id · temp · valid</text>
          <path d="M280 70 L340 70" class="sv-arrow"></path>
          <rect x="342" y="34" width="90" height="30" rx="4" class="sv-grn-s"></rect>
          <text x="387" y="54" class="sv-lbl-hi" text-anchor="middle">id</text>
          <rect x="342" y="64" width="90" height="30" rx="4" class="sv-cyn-s"></rect>
          <text x="387" y="84" class="sv-lbl-hi" text-anchor="middle">temp</text>
          <rect x="342" y="94" width="90" height="30" rx="4" class="sv-amb-s"></rect>
          <text x="387" y="114" class="sv-lbl-hi" text-anchor="middle">valid</text>
        </svg>
```

 

把相关数据打包后，函数可以"一次传一整个传感器状态"，而不是散落的一堆变量。

 

struct\_init.c — 定义、初始化、访问 C

 

```text
#include <stdio.h>

struct Sensor { int id; double temp; int valid; };

int main(void) {
    struct Sensor s = { .id = 1, .temp = 25.5, .valid = 1 };
    printf("id=%d temp=%.1f valid=%d\n", s.id, s.temp, s.valid);
    struct Sensor *p = &s;
    printf("via ptr: %.1f\n", p->temp);
    return 0;
}
```

 

| 访问方式 | 写法 | 说明 |
| --- | --- | --- |
| 普通变量 | ` s.temp ` | 点号访问成员 |
| 指针 | ` p->temp ` | 箭头等价 ` (*p).temp ` |
| 初始化 | ` .temp = 25.5 ` | 指定初始化，清晰 |
| typedef | ` typedef struct{...} Sensor; ` | 省写 ` struct ` |

 

```zhizhan-anchor
m07-5
```



## 7.5 传结构体：传值还是传指针？

 

**FIG 7.2**  传值＝整包拷贝；传指针＝只给地址

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="传结构体值会拷贝整个结构，传指针只拷贝地址">
          <rect x="30" y="40" width="150" height="50" rx="6" class="sv-red-s"></rect>
          <text x="105" y="70" class="sv-lbl-hi" text-anchor="middle">传值：拷贝整包</text>
          <rect x="220" y="40" width="170" height="50" rx="6" class="sv-grn-s"></rect>
          <text x="305" y="70" class="sv-lbl-hi" text-anchor="middle">传指针：只拷地址</text>
          <text x="450" y="60" class="sv-lbl-dim" text-anchor="middle">大结构用指针更快；</text>
          <text x="450" y="80" class="sv-lbl-hi" text-anchor="middle">要修改则必须传指针</text>
        </svg>
```

 

传值改不到原变量（改的是副本）；要"就地修改"必须传指针，并用 ` const ` 表达"只读不改"。

 

| 传参方式 | 开销 | 能否修改实参 |
| --- | --- | --- |
| 传值 ` f(Sensor s) ` | 大（拷贝） | 不能 |
| 传指针 ` f(Sensor *p) ` | 小（地址） | 能 |
| 传常量指针 ` const Sensor *p ` | 小 | 不能（有意约束） |

 

| 概念 | 用途 | 要点 |
| --- | --- | --- |
| ` struct ` | 打包相关数据 | 字段按声明排 |
| ` enum ` | 给整数起名字 | 状态码更可读 |
| ` typedef ` | 起别名 | 省写 ` struct ` |
| 指针对结构体 | ` p->field ` | 避免整包拷贝 |

 

◆ 迁移练习

 

定义一个 ` struct Point {int x; int y;} `，写两个函数：一个传值、一个传指针，把点平移到原点；在 main 里验证"只有传指针那个改到了"。

 

enum\_typedef.c — 状态码更可读 C

 

```text
#include <stdio.h>

typedef enum { STATE_IDLE, STATE_RUN, STATE_FAULT } State;

int main(void) {
    State s = STATE_RUN;
    if (s == STATE_RUN) printf("running\n");
    return 0;
}
```

 

◆ 本章要点

 

 
- ` struct ` 把多个字段打包成一条记录；` typedef ` 给类型起短名。
 
- 访问：变量用 ` . `，指针用 ` -> `。
 
- ` enum ` 是一组命名常量（默认 0,1,2…）。
 
- 大结构体传指针（配 ` const `），避免复制开销。
 
- 寄存器块、报文、传感器读数——嵌入式的数据都用结构体描述。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 填空：结构体 **指针** 访问成员用 \_\_\_\_\_\_，结构体 **变量** 用 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"指针用 ` -> `，变量用 ` . `；` p->x ` 等价于 ` (*p).x `。"}
   ```
 
2. 判断：` enum Color { RED, GREEN, BLUE }; ` 中 GREEN 的值是 2。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错，默认从 0 开始：RED=0，GREEN= **1** ，BLUE=2。"}
   ```
 
3. 诊断：函数 ` void init(Config c) ` 里改了 ` c `，调用方的配置为什么没变？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"按值传参传的是副本。要改到调用方，应传指针 ` void init(Config *c) ` 并用 ` c->字段 ` 修改。"}
   ```
 
4. 动手：给 ` Point ` 加一个 ` z ` 字段，改成三维点，并相应修改输出。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"这就是\"扩展一条记录\"的日常：改结构体定义 \\+ 使用处。字段一多，就越该用指针传参。"}
   ```
 
5. 判断：结构体只是"语法糖"，底层和多个独立变量没区别。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不完全。结构体在内存中是 **连续** 的（可能因对齐插入填充字节）——连续布局正是它能映射寄存器、能做网络报文的根本原因；这在第①册会重点讲。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  用结构体描述一个"学生"（姓名、学号、三门成绩），写函数计算平均分。

 

```zhizhan-assessment
{"id":"course-b00-m07","criterion":"用结构体表示样本并用枚举表示状态；不要直接发送含填充的结构体作为协议。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
