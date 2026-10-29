# 继承与多态

```zhizhan-anchor
m06
```



继承让派生类 **复用** 基类；多态让"通过基类指针调用"时 **执行到派生类的版本** 。 这是 C\+\+ 面向对象的核心，也是嵌入式里"一套接口、多种实现"的常用手段。

 

> ◷ 约 70 分钟 · ◈ 继承 · virtual · 抽象类 · ⚑ 运行期分派

 

```zhizhan-anchor
m06-1
```



## 6.1 继承：复用基类

 

inherit.cpp — 派生类复用基类 C\+\+

 

```text
#include <iostream>
#include <string>
#include <utility>

class Animal {
public:
    explicit Animal(std::string name) : name_(std::move(name)) {}
    void breathe() const { std::cout << name_ << " 在呼吸\n"; }   // 公共行为
protected:
    std::string name_;                                            // 派生类可访问
};

class Dog : public Animal {                 /* Dog 是一种 Animal */
public:
    using Animal::Animal;                   /* 继承基类构造函数 */
    void bark() const { std::cout << name_ << ": 汪!\n"; }     // 派生类新增行为
};

int main()
{
    Dog d("旺财");
    d.breathe();                            /* 用的是基类的函数 */
    d.bark();                               /* 派生类自己的函数 */
    return 0;
}
```

 

◆ public / protected / private 继承与成员可见性

 

 
- ` public ` 成员：类外可访问；` protected `：类内 \+ 派生类；` private `：仅本类。
 
- ` class Dog : public Animal ` 里的 ` public ` 是 **继承方式** ："Animal 的 public 成员在 Dog 里仍是 public"。日常几乎都用 public 继承。

 

```zhizhan-anchor
m06-2
```



## 6.2 多态：` virtual ` 与运行期分派

 

polymorphism.cpp — 抽象基类 \+ 多态（可运行） C\+\+

 

```text
#include <iostream>
#include <vector>
#include <memory>

class Shape {
public:
    virtual double area() const = 0;          /* 纯虚：抽象类 */
    virtual ~Shape() = default;
};
class Circle : public Shape {
    double r_;
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
};
class Rect : public Shape {
    double w_, h_;
public:
    Rect(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
};

int main()
{
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(2.0));
    shapes.push_back(std::make_unique<Rect>(3.0, 4.0));
    for (const auto &s : shapes)               /* 通过基类指针多态调用 */
        std::cout << "area = " << s->area() << "\n";
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M06）

 

```text
$ g++ -std=c++17 -Wall -Wextra polymorphism.cpp -o poly && ./poly
area = 12.5664
area = 12
# 同一个 s->area()，圆形走 Circle::area、矩形走 Rect::area——运行期按真实类型分派。
```

 

**FIG 6.1**  多态：一个基类指针，多种实际实现

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="基类指针指向不同派生对象">
          <rect x="30" y="52" width="150" height="46" rx="6" class="sv-box"></rect>
          <text x="105" y="72" class="sv-lbl-hi" text-anchor="middle">Shape* s（示意）</text>
          <text x="105" y="89" class="sv-lbl-dim" text-anchor="middle">（基类指针）</text>
          <path d="M180 62 L330 40" class="sv-arrow"></path>
          <path d="M180 88 L330 118" class="sv-arrow-a"></path>
          <rect x="332" y="20" width="200" height="42" rx="6" class="sv-grn-s"></rect>
          <text x="432" y="46" class="sv-lbl-hi" text-anchor="middle">Circle::area()</text>
          <rect x="332" y="98" width="200" height="42" rx="6" class="sv-amb-s"></rect>
          <text x="432" y="124" class="sv-lbl-hi" text-anchor="middle">Rect::area()</text>
          <text x="545" y="46" class="sv-lbl-dim">同一个 s-&gt;area()</text>
          <text x="545" y="124" class="sv-lbl-dim" style="fill:var(--amb)">调到不同的实现</text>
        </svg>
```

 

` virtual ` 让 ` s->area() ` 在 **运行期** 按对象真实类型选实现（动态绑定）。没有 virtual 就是编译期绑定（静态）。

 

⚠ 多态的两条纪律

 

 
- **基类析构要 virtual** ：否则通过基类指针 ` delete ` 一个派生对象是 **未定义行为（UB）** ——不止"漏调析构/泄漏"，可能直接崩溃或破坏堆。
 
- **多态有代价** ：每对象多一个 ` vptr `，调用要经间接跳转。 **嵌入式里要按账单用** （第②册 B02 会实测）。

 

```zhizhan-anchor
m06-4
```



## 06.4 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 复用 | 结构体嵌套 | 继承 |
| 统一接口 | 函数指针表 | 虚函数 |
| 运行期分派 | 间接调用 | ` virtual ` 虚表 |
| 销毁 | 手工 | ` virtual ` 析构 |

 

```zhizhan-anchor
m06-5
```



## 06.5 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 基类析构非 virtual | 派生资源泄漏 | 析构加 ` virtual ` |
| 对象切片 | 丢了派生部分 | 用指针/引用 |
| 忘记 override | 签名不匹配 | 写 ` override ` |

 

**FIG 6.2**  继承：派生是一种基类

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="派生类复用基类并扩展">
[('基类 Animal', 'sv-cyn-s'), ('派生 Dog', 'sv-grn-s'), ('is-a', 'sv-amb-s')]
        </svg>
```

 

派生与基类满足 is-a。

 

**FIG 6.3**  虚表：运行期分派

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="通过对象里的 vptr 找到实际函数">
[('基类指针', 'sv-box'), ('vptr → 虚表', 'sv-amb-s'), ('实际函数', 'sv-grn-s')]
        </svg>
```

 

运行期才知道调哪个实现。

 

```zhizhan-anchor
m06-6
```



## 06.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

poly.cpp C\+\+

 

```text
#include <iostream>

struct Shape { virtual double area() const = 0; virtual ~Shape() {} };
struct Sq : Shape { double s; Sq(double s):s(s){} double area() const override { return s*s; } };

int main() { Sq q(3); Shape* p = &q; std::cout << p->area() << "\n"; return 0; }
```

 

inherit.cpp C\+\+

 

```text
#include <iostream>

struct Base { virtual ~Base() {} };
struct Der : Base { ~Der() { std::cout << "~Der\n"; } };

int main() { Base* p = new Der; delete p; return 0; }
```

 

◆ 迁移练习

 

写一个基类 ` Shape ` 与两个派生（圆/方），用基类指针统一调用 ` area() ` 并加虚析构。

 

| 要点 | 说明 |
| --- | --- |
| 基类析构加 ` virtual ` | 否则派生资源不释放 |
| 用基类指针/引用多态 | 避免对象切片 |
| 写 ` override ` | 让签名错误及早暴露 |
| 纯虚 = 0 | 接口类/抽象基类 |

 

◆ 本章要点

 

 
- 继承让派生类复用基类（` class Dog : public Animal `）。
 
- ` public/protected/private ` 控制成员可见性。
 
- ` virtual ` 成员函数 = 运行期多态；` override ` 声明"我在覆写基类"。
 
- 纯虚 ` = 0 ` 的类是抽象类，不能实例化，只作接口。
 
- 基类析构要 ` virtual `；多态有 vptr/间接跳转代价。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 填空：让基类成员函数可被派生类覆写并在运行期分派，要加关键字 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` virtual `。"}
   ```
 
2. 判断：抽象类可以直接创建对象。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不行。含纯虚函数的抽象类不能实例化，只能作基类/接口；你会得到编译错误。"}
   ```
 
3. 诊断：` delete basePtr; ` 时派生类的析构没执行，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"基类析构不是 virtual。要通过基类指针多态销毁，基类析构必须 ` virtual `。"}
   ```
 
4. 动手：给 ` Shape ` 加一个 ` Triangle ` 派生类，塞进同一个 ` vector ` 里，看 ` s->area() ` 是否都能正确分派。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会。多态的价值正在于此：容器里存的是基类指针（本例用 ` unique_ptr<Shape> `，本质仍是基类指针），运行时各自调到自己的实现。"}
   ```
 
5. 判断：多态是"零成本"的。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。它带来每对象 vptr、每次调用的间接跳转，且阻碍内联。嵌入式里要权衡（第②册会实测其字节与周期代价）。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  定义一个抽象基类 ` Device `（` init() ` / ` read() ` 纯虚），派生 ` SensorA ` / ` SensorB `，用基类指针数组统一调用。

 

```zhizhan-assessment
{"id":"course-b02a-m06","criterion":"通过基类接口调用派生对象；涉及多态删除时验证虚析构要求。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
