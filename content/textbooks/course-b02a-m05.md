# 运算符重载与友元

```zhizhan-anchor
m05
```



让自定义类型也能用 ` + - == << ` 这些运算符，代码读起来就像在操作内置类型。 这一节讲运算符重载的基本写法，以及 ` friend ` 友元。

 

> ◷ 约 60 分钟 · ◈ operator\+ · operator\<\< · friend · ⚑ 语法糖

 

```zhizhan-anchor
m05-1
```



## 5.1 重载 ` + ` 与 ` << `

 

operator.cpp — 让 Vec2 能做加法、能 cout（可运行） C\+\+

 

```text
#include <iostream>

struct Vec2 {
    double x, y;
};
Vec2 operator+(const Vec2 &a, const Vec2 &b) {     /* 重载 + */
    return Vec2{a.x + b.x, a.y + b.y};
}
std::ostream &operator<<(std::ostream &os, const Vec2 &v) {   /* 让它能 cout */
    return os << "(" << v.x << ", " << v.y << ")";
}

int main()
{
    Vec2 a{1, 2}, b{3, 4};
    Vec2 c = a + b;                                 /* 用起来像内置类型 */
    std::cout << "a + b = " << c << "\n";
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M05）

 

```text
$ g++ -std=c++17 -Wall -Wextra operator.cpp -o operatorapp && ./operatorapp
a + b = (4, 6)
```

 

◆ 运算符重载的几条常识

 

 
- 不能发明新运算符，也不能改优先级/结合性；只能给 **已有运算符** 对自定义类型定义行为。
 
- 至少一个操作数是自定义类型（不能给两个 int 重载 ` + `）。
 
- ` operator<< ` 写成返回 ` ostream& ` 的自由函数，才能链式 ` cout << a << b `。
 
- 不是所有运算符都该重载——只在语义自然时（如向量加）才做。

 

```zhizhan-anchor
m05-2
```



## 5.2 成员运算符与友元

 

member\_op.cpp — 成员 operator== 与 friend operator\+ C\+\+

 

```text
#include <iostream>

class Money {
public:
    explicit Money(int cents) : cents_(cents) {}
    bool operator==(const Money &o) const { return cents_ == o.cents_; }   // 成员运算符
    friend Money operator+(const Money &a, const Money &b);                 // 声明友元
    friend std::ostream &operator<<(std::ostream &os, const Money &m);
private:
    int cents_;
};
Money operator+(const Money &a, const Money &b) { return Money{a.cents_ + b.cents_}; }
std::ostream &operator<<(std::ostream &os, const Money &m) { return os << m.cents_ << " 分"; }

int main()
{
    Money a(120), b(80);
    std::cout << "a + b = " << (a + b) << "\n";
    std::cout << "a == b ? " << (a == b ? "yes" : "no") << "\n";
    return 0;
}
```

 

◆ 友元 ` friend ` 是什么

 

` friend ` 声明允许某个 **外部函数** 访问类的 ` private ` 成员。 因为 ` operator+ ` 需要读两边的私有 ` cents_ `、又要写成自由函数（才能两个操作数对称），所以用友元。  *友元是"破封装"的例外，能不用就不用。*

 

```zhizhan-anchor
m05-3
```



## 5.3 与嵌入式的关系

 

⚠ 运算符重载本身零开销，但别滥用

 

重载只是"换个写法调用函数"，调用本身不引入额外开销。 **但"返回值运算符"（如本例返回 ` Vec2 `）可能产生临时对象、也可能没被内联——重载不保证比手写函数更快，取决于写法与优化。** 此外要注意： **语义要自然** （矩阵乘用 ` * `、向量加点用 ` + ` 合理；用 ` + ` 表示"发送数据"就令人困惑）。嵌入式里常见的合理重载是：定点数/时间/单位的运算、位标志的 ` | & `。

 

```zhizhan-anchor
m05-4
```



## 05.4 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 比较 | ` cmp(a,b) ` | 重载 ` == ` |
| 输出 | ` print(a) ` | 重载 ` << ` |
| 相加 | ` add(a,b) ` | 重载 ` + ` |
| 下标 | ` get(a,i) ` | 重载 ` [] ` |

 

```zhizhan-anchor
m05-5
```



## 05.5 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| ` << ` 写成成员函数 | 调用反向 | 非成员 \+ 友元 |
| 重载语义乱来 | 难懂 | 保持与内置语义一致 |
| ` operator= ` 忘记返回自身 | 链式赋值错 | 返回 ` *this ` |

 

**FIG 5.2**  运算符重载

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="把运算符映射到你类型的操作上">
[('a + b', 'sv-cyn-s'), ('operator+', 'sv-grn-s'), ('结果', 'sv-amb-s')]
        </svg>
```

 

同名映射，语义要自然。

 

**FIG 5.3**  ` operator<< ` 输出

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="把对象写进 ostream">
[('对象', 'sv-box'), ('operator&lt;&lt;', 'sv-grn-s'), ('std::cout', 'sv-amb-s')]
        </svg>
```

 

常写成非成员 \+ ` friend `。

 

```zhizhan-anchor
m05-6
```



## 05.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

vec2.cpp C\+\+

 

```text
#include <iostream>

struct V { int x, y; };
V operator+(V a, V b) { return {a.x+b.x, a.y+b.y}; }
std::ostream& operator<<(std::ostream& os, V v) { return os << "(" << v.x << "," << v.y << ")"; }

int main() { V c = V{1,2} + V{3,4}; std::cout << c << "\n"; return 0; }
```

 

counter.cpp C\+\+

 

```text
#include <iostream>

struct N { int v; N& operator++() { ++v; return *this; } };

int main() { N n{0}; ++n; ++n; std::cout << n.v << "\n"; return 0; }
```

 

◆ 迁移练习

 

给一个二维向量类型重载 ` + ` 与 ` << `，让它像内置类型一样能相加、能 ` cout ` 输出。

 

| 运算符 | 常用重载 | 形式 |
| --- | --- | --- |
| ` + - * / ` | 算术 | 非成员或成员 |
| ` == != < > ` | 比较 | 通常非成员 |
| ` << >> ` | 输入输出 | 非成员 \+ friend |
| ` [] ` | 下标 | 成员 |

 

◆ 本章要点

 

 
- 运算符重载让自定义类型用起来像内置类型（` a + b `、` cout << a `）。
 
- 只能重载已有运算符，不能改优先级；至少一个操作数是自定义类型。
 
- ` operator<< ` 常写成返回 ` ostream& ` 的自由函数。
 
- 需要访问私有成员的自由运算符，用 ` friend ` 声明。
 
- 零运行时开销，但只在语义自然时用。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 判断：可以给两个 ` int ` 重载 ` + ` 改变它的行为。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不行。运算符重载要求 **至少一个操作数是自定义类型** ，且不能改变内置类型的语义。"}
   ```
 
2. 简答：为什么 ` operator<< ` 常写成自由函数（而非成员）？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为左操作数是 ` std::ostream `（标准库类型，你改不了它的成员）。写成自由函数 ` operator<<(ostream&, const T&) ` 才能 ` cout << obj `。"}
   ```
 
3. 诊断：把 ` Money ` 的 ` operator+ ` 里 ` a.cents_ ` 直接访问时编译器报"private"，最省事的两种改法？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"要么把它声明为 ` friend `，要么给类加一个 ` int cents() const ` 只读接口（更推荐，不破封装）。"}
   ```
 
4. 动手：给 ` Vec2 ` 重载 ` operator== `，比较两个向量是否相等。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` bool operator==(const Vec2& a, const Vec2& b){ return a.x==b.x && a.y==b.y; } `。注意浮点比较的精度问题（工程里常比较差的绝对值）。"}
   ```
 
5. 判断：运算符重载会让程序变慢。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"通常不会：它只是\"换个语法调用函数\"，与普通函数调用（可内联）相同。但 **返回值运算符会有临时对象** 、且是否内联由编译器决定——别把它当成\"一定更快\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  给一个"定点小数"或"角度"类型重载 ` + - == `，并让它能 ` cout `。

 

```zhizhan-assessment
{"id":"course-b02a-m05","criterion":"为一个必要的运算符给出直观语义；不为任意转换开放隐式构造。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
