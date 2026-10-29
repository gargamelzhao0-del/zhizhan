# 从 C 到 C++：第一印象

```zhizhan-anchor
m01
```



你已经会 C。C\+\+ 与 C 的关系是" **兼容并增强** "：C 的多数写法在 C\+\+ 里依然可用，同时多了类、模板、命名空间等能力。 这一节先建立第一印象：怎么编译、怎么输出、多出来的几个关键字。

 

> ◷ 约 55 分钟 · ◈ g\+\+ · iostream · namespace · ⚑ 兼容并增强

 

```zhizhan-anchor
m01-1
```



## 1.1 用 g\+\+ 编译，用 ` cout ` 输出

 

hello.cpp — 第一个 C\+\+ 程序 C\+\+

 

```text
#include <iostream>                 // C++ 的输入输出流
using std::cout;                    // 用到哪个名字就显式引入哪个

int main()
{
    int year = 2026;
    cout << "Hello, C++!\n";          // << 把内容"推向"输出流
    cout << "year = " << year << "\n";
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m01.sh `（本机 g\+\+ 15.2）

 

```text
$ g++ -std=c++17 -Wall -Wextra hello.cpp -o hello && ./hello
Hello, C++!
year = 2026
# 与 C 的 printf 相比：cout 会自动按类型输出，不用记 %d/%f，也不会写错格式符。
```

 

```zhizhan-anchor
m01-2
```



## 1.2 C 与 C\+\+ 的常见写法对照

 

| 想做的事 | C | C\+\+ |
| --- | --- | --- |
| 输出 | ` printf("%d\n", x) ` | ` std::cout << x << "\n" ` |
| 头文件 | ` #include <stdio.h> ` | ` #include <iostream> ` / ` <cstdint> ` |
| 布尔类型 | C99 前用 ` int `；C99 起有 ` <stdbool.h> ` | 内建 ` bool `（` true/false `） |
| 空指针 | ` NULL `（常是 0） | ` nullptr `（真正的指针类型） |
| 常量 | ` #define N 10 ` | ` const int N = 10; `（有类型） |
| 编译 | ` gcc ` | ` g++ ` |

 

◆ C\+\+ 的头文件"去 .h"

 

C\+\+ 标准库头文件通常不带 ` .h `：` stdio.h → <cstdio> `、` stdlib.h → <cstdlib> `。` <iostream> ` 是 C\+\+ 独有的。

 

```zhizhan-anchor
m01-3
```



## 1.3 命名空间：` std:: ` 是什么

 

C\+\+ 标准库的东西都放在 ` std ` 命名空间里，所以写 ` std::cout `。 命名空间是为了 **避免名字冲突** ——大型工程里两个模块都叫 ` log ` 也不会打架。

 

ns.cpp — 自定义命名空间 C\+\+

 

```text
#include <iostream>

namespace gpio {                    // 给这批名字分组
    int pin = 13;
    void high() { std::cout << "pin " << pin << " -> HIGH\n"; }
}
namespace uart {
    int pin = 17;                   // 同名 pin，互不冲突
}

int main()
{
    gpio::high();                   // 用 命名空间::名字 访问
    std::cout << "uart pin = " << uart::pin << "\n";
    return 0;
}
```

 

⚠ 别在头文件里写 ` using namespace std; `

 

` using namespace std; ` 会把整个 std 的名字"倒进"全局，极易冲突。头文件里 **绝对不要** ；源文件里偶尔图方便可以，但更推荐 ` using std::cout; ` 这种精确引入。

 

```zhizhan-anchor
m01-4
```



## 01.4 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 输出 | ` printf("%d",x) ` | ` std::cout << x ` |
| 头文件 | ` <stdio.h> ` | ` <iostream> ` |
| 编译 | ` gcc ` | ` g++ ` |
| 字符串 | ` char[] ` | ` std::string ` |

 

```zhizhan-anchor
m01-5
```



## 01.5 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 忘了 ` std:: ` | ` cout ` 未声明 | 加 ` std:: ` 或 ` using ` |
| 用 gcc 编 .cpp | 链接 C\+\+ 运行库缺失 | 用 ` g++ ` |
| ` << ` 链方向反 | 编译错 | 数据流向 ` cout ` |

 

**FIG 1.2**  编译 → 链接 → 运行（C\+\+ 同 C）

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="C++ 源文件经 g++ 编译链接为可执行文件">
[('hello.cpp', 'sv-box'), ('g++ 编译', 'sv-amb-s'), ('可执行', 'sv-grn-s')]
        </svg>
```

 

用 ` g++ `，不是 ` gcc `。

 

**FIG 1.3**  std 命名空间

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="标准库的东西都住在 std 里，用 :: 访问">
[('std', 'sv-cyn-s'), ('cout', 'sv-grn-s'), ('endl', 'sv-amb-s'), ('string', 'sv-box')]
        </svg>
```

 

` using namespace std; ` 可省去前缀，但小工程才推荐。

 

```zhizhan-anchor
m01-6
```



## 01.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

hello.cpp C\+\+

 

```text
#include <iostream>

int main() {
    std::cout << "Hello, C++!\n";
    return 0;
}
```

 

sum.cpp C\+\+

 

```text
#include <iostream>

int main() {
    int a = 2, b = 3;
    std::cout << a + b << "\n";
    return 0;
}
```

 

◆ 迁移练习

 

把你在 C 册里写的 hello 程序改成 C\+\+ 版（` cout ` 输出），用 ` g++ ` 编译运行。

 

◆ 本章要点

 

 
- C\+\+ 兼容 C，用 ` g++ ` 编译；多了 ` cout `/命名空间/引用/类/模板。
 
- ` std::cout << x ` 在 **编译期按 x 的类型** 选 ` operator<< ` 重载，不用格式符； *但注意 ` uint8_t `（即 ` unsigned char `）会按字符打印——要按数值就转成 ` int `。*
 
- C\+\+ 头文件去 ` .h `（` <cstdio> `/` <iostream> `）。
 
- ` bool `/` nullptr `/` const ` 是 C\+\+ 更安全的写法。
 
- 命名空间避免名字冲突；` std ` 是标准库的命名空间。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 填空：C\+\+ 里输出用 ` std::______ << x `，编译用 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` cout `；编译用 ` g++ `。"}
   ```
 
2. 判断：C 程序直接改后缀为 .cpp 用 g\+\+ 编译，一般能过。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"多数可以（C\\+\\+ 兼容 C）。但要注意 C\\+\\+ 更严格的类型检查，个别 C 写法（如 ` void* ` 隐式转换）会报错——这是\"更安全\"的代价。"}
   ```
 
3. 诊断：` cout << x; ` 报 ` 'cout' was not declared `，最可能的原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"要么没 ` #include <iostream> `，要么没写 ` std:: `（也没 ` using `）。"}
   ```
 
4. 动手：把 ` hello.cpp ` 的输出改成用 ` printf `（加 ` #include <cstdio> `），两种都能编过，体会"兼容"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"能编过且输出相同——C\\+\\+ 里 C 的库也完全可用。这正是\"迁移友好\"。"}
   ```
 
5. 判断：` nullptr ` 和 ` NULL ` 完全一样。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不完全。` NULL ` 常被定义成 0（int），在某些重载场景会选错函数；` nullptr ` 是专门的指针空值类型，更安全。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  用 g\+\+ 编译并运行 ` hello.cpp `，再写一个自定义命名空间并访问其中的名字。

 

```zhizhan-assessment
{"id":"course-b02a-m01","criterion":"独立构建一个 C++ 程序，说明编译器、标准选项和与 C 链接的边界。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
