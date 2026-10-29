# 引用与 const

```zhizhan-anchor
m02
```



**引用** 是 C\+\+ 比 C 更好用的第一件武器：它是变量的"别名"，既能像指针一样避免拷贝，又没有指针的许多坑。  **const**  则把"这块数据不该被改"写成编译期约束。

 

> ◷ 约 55 分钟 · ◈ 引用 vs 指针 · const · ⚑ 少写 \* 和 &

 

```zhizhan-anchor
m02-1
```



## 2.1 引用：变量的别名

 

reference.cpp — 引用参数与别名（可运行） C\+\+

 

```text
#include <iostream>
#include <string>

void add_one(int &x) { x += 1; }          /* 引用参数：直接改实参 */
void print(const std::string &s) {        /* const 引用：不改，也不拷贝 */
    std::cout << "print: " << s << "\n";
}
int main()
{
    int n = 5;
    add_one(n);                            /* 传引用，行为像传变量本身 */
    std::cout << "n = " << n << "\n";

    int &r = n;                            /* r 是 n 的别名 */
    r = 42;
    std::cout << "n via ref = " << n << "\n";

    std::string msg = "hello reference";
    print(msg);
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M02）

 

```text
$ g++ -std=c++17 -Wall -Wextra reference.cpp -o reference && ./reference
n = 6
n via ref = 42
print: hello reference
```

 

◆ 引用 vs 指针

 

| 维度 | 指针 ` T* ` | 引用 ` T& ` |
| --- | --- | --- |
| 能否为空 | 可以（NULL） | 不能，必须绑定对象 |
| 能否改指向 | 可以 | 不能（一旦绑定就不变） |
| 语法 | 要写 ` * `/` & ` | 像普通变量 |
| 用途 | 可空、可改指向、C 互操作 | 函数参数/返回、避免拷贝 |

 

```zhizhan-anchor
m02-2
```



## 2.2 用 const 引用避免拷贝

 

传大对象（字符串、结构体、容器）时，按值传会 **复制一份** ，很贵。 传 ` const T& `：既 **不拷贝** 、又保证函数 **不会改它** ——这是 C\+\+ 里最常用的参数形式。

 

◆ 参数传递的三档

 

 
- ` f(int x) `：小类型，按值传（拷贝也便宜）。
 
- ` f(const T& x) `：大对象只读， **不发拷贝、不可修改** （首选）。
 
- ` f(T& x) `：需要修改调用方的大对象时用。

 

```zhizhan-anchor
m02-3
```



## 2.3 const 正确性：把"只读"写进类型

 

const\_demo.cpp — 各种 const C\+\+

 

```text
#include <iostream>

int main()
{
    const int MAX = 100;          /* 常量：不能再赋值 */
    // MAX = 200;                 // ✕ 编译错误

    int a = 1, b = 2;
    const int *p = &a;            /* 指向的内容不可改（指针可变） */
    // *p = 5;                    // ✕
    p = &b;                      /* ✔ 指针本身可以改指向 */

    int *const q = &a;            /* 指针本身不可改（内容可变） */
    *q = 9;                       /* ✔ */
    // q = &b;                    // ✕

    std::cout << "MAX=" << MAX << " a=" << a << " *p=" << *p << "\n";
    return 0;
}
```

 

⚠ ` const ` 的位置有讲究

 

` const int *p `： **内容** 只读（ *p is a pointer to const int* ）；` int *const p `： **指针本身** 只读（ *p is a const pointer to int* ）。记法：从右往左读，` const ` 挨着谁就限制谁。

 

```zhizhan-anchor
m02-4
```



## 02.4 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 取地址 | ` int *p = &x; ` | ` int &r = x; ` |
| 使用 | ` *p ` 解引用 | ` r ` 直接用 |
| 能否为空 | 可以 ` NULL ` | 引用必须绑定对象 |
| 只读传参 | ` const int * ` | ` const int & ` |

 

```zhizhan-anchor
m02-5
```



## 02.5 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 引用未初始化 | 编译错 | 引用必须绑定到对象 |
| 返回局部变量的引用 | 悬垂 | 返回对象或按值 |
| 该用 const 引用时用了值 | 多一次拷贝 | 大对象用 ` const & ` |

 

**FIG 2.2**  引用是别名，不是指针

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="引用与原变量是同一块内存的两个名字">
[('变量 x', 'sv-grn-s'), ('引用 r', 'sv-cyn-s'), ('同一地址', 'sv-amb-s')]
        </svg>
```

 

改 ` r ` 就是改 ` x `。

 

**FIG 2.3**  值传递 vs const 引用传递

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="值传递拷贝一份，const 引用只借用不拷贝">
[('值传递 → 拷贝', 'sv-red-s'), ('const 引用 → 借用', 'sv-grn-s')]
        </svg>
```

 

大对象优先 ` const & `。

 

```zhizhan-anchor
m02-6
```



## 02.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

ref.cpp C\+\+

 

```text
#include <iostream>

int main() {
    int x = 5;
    int &r = x;
    r = 9;
    std::cout << x << "\n";   // 9
    return 0;
}
```

 

constref.cpp C\+\+

 

```text
#include <iostream>
#include <string>

void show(const std::string &s) { std::cout << s << "\n"; }

int main() { show("hi"); return 0; }
```

 

◆ 迁移练习

 

把 C 册里"用指针交换两个数"的函数改成 C\+\+ 的引用版 ` void swap(int&, int&) `，对比可读性。

 

◆ 本章要点

 

 
- 引用是别名：不能为空、不能改绑定，语法比指针干净。
 
- ` const T& ` 是"只读 \+ 不拷贝"的黄金参数形式。
 
- ` const ` 把"不该改"写成编译期约束，比注释可靠。
 
- ` const int * ` 与 ` int *const ` 含义不同，看 ` const ` 靠近谁。
 
- 引用适合参数/返回；需要"可空/可改指向"时仍用指针。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 填空：要"只读且不拷贝"地传一个大对象，参数写成 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` const T& `（const 引用）。"}
   ```
 
2. 判断：引用一旦绑定，可以再改成引用别的变量。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。引用初始化时绑定，此后一直是它的别名（这点和指针不同）。"}
   ```
 
3. 诊断：` void f(const std::string &s){ s += "!"; } ` 为什么编不过？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` s ` 是 const 引用，不能修改。想改就写 ` std::string &s `（非 const）。"}
   ```
 
4. 动手：写 ` void swap2(int &a, int &b) ` 用引用交换两个整数，和《编程与 C 语言基础》(B00) 里"传指针才能改实参"的写法对比，体会引用更清爽。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"引用版：` int t=a; a=b; b=t; `，调用 ` swap2(x,y) `——不用写 ` & ` 和 ` * `，更清爽。"}
   ```
 
5. 判断：` const int *p ` 表示 p 本身不能改。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错。它表示\" **p 指向的内容** 不可改\"，p 可以改指向；\"p 本身不可改\"是 ` int *const p `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  把你在 C 里"传指针才能改实参"的函数，改用引用重写一遍，体会差别。

 

```zhizhan-assessment
{"id":"course-b02a-m02","criterion":"比较引用、指针和 const，不能经悬空引用读取已销毁对象。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
