# 类与对象

```zhizhan-anchor
m04
```



这是 C\+\+ 最核心的一节： **类** 把"数据"和"操作数据的函数"打包成一个自定义类型， **对象** 是它的一个实例。 构造/析构、封装、` this `——理解这些，才算真正进入 C\+\+。

 

> ◷ 约 70 分钟 · ◈ 构造/析构 · 封装 · this · ⚑ C\+\+ 的核心

 

```zhizhan-anchor
m04-1
```



## 4.1 一个类：数据 \+ 操作

 

class.cpp — 类/构造/析构/封装（可运行） C\+\+

 

```text
#include <iostream>
#include <cstdint>

class Counter {
public:
    Counter(int start) : value_(start) { std::cout << "构造: " << value_ << "\n"; }
    ~Counter() { std::cout << "析构: " << value_ << "\n"; }

    void inc() { ++value_; }                 // 成员函数可改私有成员
    int value() const { return value_; }     // const 成员函数：不修改对象

private:
    int value_;                              // 私有：外部不能直接改
};

int main()
{
    Counter c(10);
    c.inc();
    c.inc();
    std::cout << "value = " << c.value() << "\n";
    // c.value_ = 99;                        // 错误：value_ 是 private
    return 0;                                // main 结束时自动调用析构
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M04）

 

```text
$ g++ -std=c++17 -Wall -Wextra class.cpp -o classapp && ./classapp
构造: 10
value = 12
析构: 12
# 构造在对象创建时自动调用；析构在对象离开作用域时自动调用。
```

 

```zhizhan-anchor
m04-2
```



## 4.2 构造、析构与 RAII 的思想

 

**FIG 4.1**  对象的生命周期：构造 → 使用 → 析构，全自动

 

```zhizhan-figure
<svg viewBox="0 0 660 130" role="img" aria-label="对象生命周期">
          <rect x="40" y="46" width="130" height="44" rx="6" class="sv-cyn-s"></rect>
          <text x="105" y="66" class="sv-lbl-hi" text-anchor="middle">构造</text>
          <text x="105" y="83" class="sv-lbl-dim" text-anchor="middle">Counter(10)</text>
          <path d="M170 68 L230 68" class="sv-arrow"></path>
          <rect x="232" y="46" width="180" height="44" rx="6" class="sv-box"></rect>
          <text x="322" y="66" class="sv-lbl-hi" text-anchor="middle">使用（调用成员函数）</text>
          <text x="322" y="83" class="sv-lbl-dim" text-anchor="middle">inc() / value()</text>
          <path d="M412 68 L472 68" class="sv-arrow"></path>
          <rect x="474" y="46" width="150" height="44" rx="6" class="sv-amb-s"></rect>
          <text x="549" y="66" class="sv-lbl-hi" text-anchor="middle">析构</text>
          <text x="549" y="83" class="sv-lbl-dim" text-anchor="middle">~Counter() 自动</text>
        </svg>
```

 

把"获取资源"放构造、"释放资源"放析构，就是  **RAII** （本册 M08 会用 ` unique_ptr ` 完整演示）。在 C 里你要手写 ` xxx_init/xxx_deinit ` 并保证配对；C\+\+ 让编译器替你保证。

 

```zhizhan-anchor
m04-3
```



## 4.3 封装：` public ` 与 ` private `

 

` private ` 成员只有 **类自己的成员函数** 能访问，外部只能通过 ` public ` 接口。 好处：对象内部怎么实现可以随时改，只要接口不变，使用者不受影响。

 

◆ const 成员函数

 

写成 ` int value() const ` 表示"这个函数 **不修改对象** "。对 ` const ` 对象，只能调用 const 成员函数——这是编译期的一种"只读保证"。

 

```zhizhan-anchor
m04-4
```



## 4.4 ` this ` 与成员初始化列表

 

point.cpp — 初始化列表与 this C\+\+

 

```text
#include <iostream>

class Point {
public:
    Point(int x, int y) : x_(x), y_(y) {}     // 初始化列表：直接初始化成员
    Point &move(int dx, int dy) {             // 返回 *this，支持链式调用
        x_ += dx; y_ += dy;
        return *this;
    }
    void print() const { std::cout << "(" << x_ << ", " << y_ << ")\n"; }
private:
    int x_, y_;
};

int main()
{
    Point p(0, 0);
    p.move(1, 2).move(3, 4);                  // 链式调用
    p.print();
    return 0;
}
```

 

◆ 初始化列表 ` : x_(x), y_(y) `

 

成员应在 **初始化列表** 里初始化（而不是在构造体内赋值）：对 ` const ` 成员、引用成员、没有默认构造的成员，这是 **唯一** 能初始化的地方。

 

```zhizhan-anchor
m04-5
```



## 04.5 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 数据\+操作 | 结构体 \+ 一组函数 | 类（成员函数） |
| 访问控制 | 无 | ` public/private ` |
| 初始化 | 手工赋值 | 构造函数 |
| 清理 | 手工释放 | 析构函数 |

 

```zhizhan-anchor
m04-6
```



## 04.6 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 构造/析构名字写错 | 编译错 | 与类同名；析构加 ` ~ ` |
| 成员没初始化 | 随机值 | 用成员初始化列表 |
| 把实现写进头文件 | 重复定义 | 实现放 .cpp |

 

**FIG 4.2**  类＝数据 \+ 操作

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="把相关数据和方法包在一个类型里">
[('成员变量', 'sv-cyn-s'), ('成员函数', 'sv-grn-s'), ('对象', 'sv-amb-s')]
        </svg>
```

 

对象是类的一个实例。

 

**FIG 4.3**  构造与析构的时机

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="对象创建时构造，离开作用域时析构">
[('构造（创建）', 'sv-grn-s'), ('使用', 'sv-cyn-s'), ('析构（销毁）', 'sv-red-s')]
        </svg>
```

 

这就是 RAII 的思想基础。

 

```zhizhan-anchor
m04-7
```



## 04.7 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

point.cpp C\+\+

 

```text
#include <iostream>

class Point {
public:
    Point(int x, int y) : x_(x), y_(y) {}
    int sum() const { return x_ + y_; }
private:
    int x_, y_;
};

int main() { Point p(2,3); std::cout << p.sum() << "\n"; return 0; }
```

 

ctor.cpp C\+\+

 

```text
#include <iostream>

struct Guard {
    Guard()  { std::cout << "acquire\n"; }
    ~Guard() { std::cout << "release\n"; }
};

int main() { Guard g; std::cout << "work\n"; return 0; }
```

 

◆ 迁移练习

 

把一个 C 结构体 \+ 操作函数改写成 C\+\+ 类（构造函数初始化、成员函数访问），编译运行验证行为一致。

 

| 关键字 | 含义 | 默认 |
| --- | --- | --- |
| ` public ` | 谁都能访问 | 结构体默认 |
| ` private ` | 只有类内可访问 | 类默认 |
| ` protected ` | 派生类可访问 | — |
| ` const ` 成员函数 | 不修改对象 | 只读方法 |

 

◆ 本章要点

 

 
- ` class ` 把数据与操作打包；对象是它的实例。
 
- 构造函数初始化、析构函数清理——生命周期自动管理（RAII 基础）。
 
- ` private ` 封装内部实现，` public ` 暴露接口。
 
- ` const ` 成员函数承诺不修改对象。
 
- 成员用初始化列表初始化；` return *this ` 可做链式调用。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 填空：对象创建时自动调用 \_\_\_\_\_\_ 函数，销毁时自动调用 \_\_\_\_\_\_ 函数。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**构造** 函数、 **析构** 函数。"}
   ```
 
2. 判断：` private ` 成员在任何地方都能读。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。只有类的成员函数（及友元）能访问 ` private `；外部只能通过 ` public ` 接口。"}
   ```
 
3. 诊断：` class A { const int id; public: A(int i){ id = i; } }; ` 为什么编不过？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` id ` 是 ` const ` 成员，必须在 **初始化列表** 里初始化：` A(int i) : id(i) {} `，不能在构造体内赋值。"}
   ```
 
4. 动手：给 ` Counter ` 加一个 ` reset() ` 把值清零，并保证 ` value() ` 仍是 const 成员函数。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` reset() ` 会改成员， **不能** 是 const；` value() ` 只读，保持 const。这体现了 const 正确性的用法。"}
   ```
 
5. 判断：构造函数没有返回值，所以要写 ` void Counter() `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错。构造函数 **连 void 都不写** ，写成 ` Counter(...) `；写 ` void Counter() ` 反而变成普通函数。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  写一个 ` Rectangle ` 类（宽、高），有构造、` area() `、` scale(k) `，并用 private 封装宽高。

 

```zhizhan-assessment
{"id":"course-b02a-m04","criterion":"使类在构造后保持不变量；构造失败和析构时资源归属明确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
