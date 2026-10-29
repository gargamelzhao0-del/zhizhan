# 函数进阶

```zhizhan-anchor
m03
```



C\+\+ 给函数加了三样方便的东西： **重载** （同名不同参）、 **默认参数** 、 **内联** 。 再加上 **命名空间** ，大型工程的组织能力就上来了。

 

> ◷ 约 55 分钟 · ◈ 重载 · 默认参数 · 内联 · ⚑ 编译期决定

 

```zhizhan-anchor
m03-1
```



## 3.1 函数重载：同名不同参

 

overload.cpp — 重载与默认参数（可运行） C\+\+

 

```text
#include <iostream>

int area(int w, int h) { return w * h; }          /* 两个 int */
double area(double r) { return 3.14159 * r * r; }  /* 一个 double：重载 */

int greet(const std::string &name = "world") {     /* 默认参数 */
    std::cout << "hello, " << name << "\n";
    return 0;
}
int main()
{
    std::cout << "area(3,4)   = " << area(3, 4) << "\n";
    std::cout << "area(2.0)   = " << area(2.0) << "\n";
    greet();                                          /* 用默认参数 */
    greet("C++");
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M03）

 

```text
$ g++ -std=c++17 -Wall -Wextra overload.cpp -o overload && ./overload
area(3,4)   = 12
area(2.0)   = 12.5664
hello, world
hello, C++
# 编译器按实参类型自动选 area(int,int) 还是 area(double)。
```

 

◆ 重载的判据

 

重载靠 **参数列表** 区分（个数/类型/顺序）， **不能只靠返回值不同** 重载。调用哪个在 **编译期** 就定下来了。

 

```zhizhan-anchor
m03-2
```



## 3.2 默认参数

 

给参数一个默认值，调用时可以省略。规则： **默认参数必须从右往左连续** （不能再有非默认参数跟在它后面）。 上例 ` greet() ` 用默认值 ` "world" `，` greet("C++") ` 覆盖它。

 

```zhizhan-anchor
m03-3
```



## 3.3 内联与命名空间

 

inline\_ns.cpp — 内联函数与命名空间分组 C\+\+

 

```text
#include <iostream>

namespace mathx {
    inline int square(int x) { return x * x; }   /* 建议内联：小函数避免调用开销 */
    int cube(int x) { return x * x * x; }
}

int main()
{
    std::cout << "square(5) = " << mathx::square(5) << "\n";
    std::cout << "cube(3)   = " << mathx::cube(3) << "\n";
    return 0;
}
```

 

◆ inline 是"建议"，不是命令

 

` inline ` 告诉编译器"这个函数展开到调用处更合适"（省掉调用开销）。但最终是否内联由 **编译器\+优化等级** 决定。 更重要的是：写在头文件里的 **函数定义** 必须加 ` inline `，否则被多个 .cpp 包含时会"重复定义"。

 

```zhizhan-anchor
m03-4
```



## 03.4 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 同名多参 | 不支持（要改函数名） | 重载 |
| 默认参数 | ` #define ` 变通 | 默认参数 |
| 内联 | ` static inline ` | ` inline ` |
| 命名空间 | 前缀命名 | ` namespace ` |

 

```zhizhan-anchor
m03-5
```



## 03.5 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 重载只看返回类型 | 编译错 | 返回类型不参与重载 |
| 默认参数写在定义里 | 重定义错 | 默认值写在声明处 |
| ` inline ` 当强制内联 | 只是建议 | 编译器可忽略 |

 

**FIG 3.2**  函数重载：同名不同参

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="编译器按参数类型/个数选具体版本">
[('f(int)', 'sv-grn-s'), ('f(double)', 'sv-amb-s'), ('f(int,int)', 'sv-box')]
        </svg>
```

 

调用时按实参匹配。

 

**FIG 3.3**  默认参数

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="省略的实参用默认值填充">
[('f(a,b=10)', 'sv-cyn-s'), ('f(1) → b=10', 'sv-amb-s'), ('f(1,2) → b=2', 'sv-grn-s')]
        </svg>
```

 

默认值必须在参数表尾部。

 

```zhizhan-anchor
m03-6
```



## 03.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

overload.cpp C\+\+

 

```text
#include <iostream>

int add(int a, int b) { return a + b; }
double add(double a, double b) { return a + b; }

int main() { std::cout << add(1,2) << " " << add(1.5,2.5) << "\n"; return 0; }
```

 

default.cpp C\+\+

 

```text
#include <iostream>

int area(int w, int h = 10) { return w * h; }

int main() { std::cout << area(3) << " " << area(3,4) << "\n"; return 0; }
```

 

◆ 迁移练习

 

写一组重载的 ` max ` 函数（int/double），再给一个带默认参数的函数，各调用一次。

 

| 写法 | 占用 | 建议 |
| --- | --- | --- |
| 传值 | 拷贝 | 小类型 |
| 传 ` const & ` | 不拷贝 | 大对象 |
| 返回对象 | 可能移动/优化 | 现代 C\+\+ 友好 |
| 返回引用 | 不拷贝 | 别返回局部 |

 

◆ 本章要点

 

 
- 重载：同名函数按参数列表区分，编译期决定调用哪个。
 
- 重载 **不能** 只靠返回值不同。
 
- 默认参数从右往左连续；调用时可省略。
 
- ` inline ` 是小函数的调用开销优化，也是头文件函数定义的必要标记。
 
- 命名空间给名字分组，避免冲突（` mathx::square `）。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 判断：` int f(int); double f(int); ` 是合法的重载。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不合法。参数列表相同、仅返回值不同 **不能** 重载，会报\"重复定义\"。"}
   ```
 
2. 填空：` void g(int a, int b = 0, int c) ` 这个声明 \_\_\_\_\_\_（合法/非法）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**非法** 。默认参数后面的参数也必须都有默认值；应写成 ` void g(int a, int b=0, int c=0) ` 或把 c 提前。"}
   ```
 
3. 诊断：把一个普通函数定义放进头文件，被两个 .cpp 包含，链接时报"重复定义"，怎么修？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"给函数加 ` inline `（或放到匿名命名空间/改成 .cpp 里的定义）。头文件里的函数定义默认会有多个副本。"}
   ```
 
4. 动手：想把 ` area(int w, int h) ` 的 ` h ` 默认成"和 w 一样"（正方形），写 ` int area(int w, int h = w) ` 能编过吗？为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**不能，报错** ：` parameter 'w' may not appear in this context `。原因不是\"重载歧义\"，而是 **默认实参不能引用其它形参** （默认值是编译期常量/表达式，屏蔽不到形参名）。正确做法是用哨兵值：` int area(int w, int h = -1) { return h < 0 ? w * w : w * h; } `。"}
   ```
 
5. 判断：内联一定会让程序变快。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。内联省了调用开销、但可能增大代码体积（嵌入式尤其敏感）。是否内联由编译器按优化等级决定。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  写一组重载的 ` print `（int/double/string），再用命名空间把它们分到 ` io ` 里。

 

```zhizhan-assessment
{"id":"course-b02a-m03","criterion":"解释重载决议与默认参数；设计一个不会误选重载的接口并测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
