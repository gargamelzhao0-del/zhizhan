# 模板与 STL

```zhizhan-anchor
m07
```



**模板** 把"类型"当参数，一套代码适配多种类型； **STL**  是标准库给你的现成容器与算法 （` vector `、` string `、` map `…）——别自己造轮子。

 

> ◷ 约 70 分钟 · ◈ 模板 · vector/string/map · ⚑ 编译期生成

 

```zhizhan-anchor
m07-1
```



## 7.1 模板：类型也是参数

 

templates.cpp — 函数模板 \+ STL（可运行） C\+\+

 

```text
#include <iostream>
#include <vector>
#include <string>
#include <map>

template <class T>
T max_of(const T &a, const T &b) { return a > b ? a : b; }   /* 函数模板 */

int main()
{
    std::cout << "max_of(3,7) = " << max_of(3, 7) << "\n";
    std::cout << "max_of(2.5,1.5) = " << max_of(2.5, 1.5) << "\n";

    std::vector<int> v;
    for (int i = 1; i <= 5; i++) v.push_back(i * i);          /* 动态数组 */
    int sum = 0;
    for (int x : v) sum += x;                                 /* 范围 for */
    std::cout << "sum of squares 1..5 = " << sum << "\n";

    std::map<std::string, int> counts;                        /* 键值表 */
    counts["a"]++; counts["a"]++; counts["b"]++;
    std::cout << "a=" << counts["a"] << " b=" << counts["b"] << "\n";
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M07）

 

```text
$ g++ -std=c++17 -Wall -Wextra templates.cpp -o tpl && ./tpl
max_of(3,7) = 7
max_of(2.5,1.5) = 2.5
sum of squares 1..5 = 55
a=2 b=1
```

 

◆ 模板是"编译期生成"

 

` max_of(3,7) ` 与 ` max_of(2.5,1.5) ` 会让编译器生成 **两个** 具体函数（分别针对 int、double）。 这叫 **实例化** ：运行期零开销、可内联——代价是 **代码体积** （每种类型一份）。嵌入式里这正是"零开销抽象"的来源与边界（第②册 B02 详讲）。

 

```zhizhan-anchor
m07-2
```



## 7.2 STL：常用容器一览

 

| 容器 | 用途 | 常用操作 |
| --- | --- | --- |
| ` std::string ` | 字符串（可增长、带长度） | ` + / size() / c_str() ` |
| ` std::vector<T> ` | 动态数组 | ` push_back / size / [] / 范围 for ` |
| ` std::map<K,V> ` | 有序键值表 | ` m[key] / count / find ` |
| ` std::array<T,N> ` | 固定长度数组（无动态分配） | ` [] / size() `（嵌入式常用） |

 

⚠ 嵌入式里对 STL 要留个心眼

 

` vector `/` string `/` map ` 会 **动态分配内存** ——在 MCU 上可能带来堆碎片与不确定延迟。 嵌入式更常用 **固定容量** 的 ` std::array `、` std::span `（ **C\+\+20 起** ）、` etl ` 等。资源管理在本册 M08 讲了基础；在 MCU 上的取舍（体积/开销）由第②册《C\+\+（嵌入式向）》深入。

 

```zhizhan-anchor
m07-3
```



## 7.3 算法与迭代器（一句带过）

 

STL 还有一套算法（` std::sort `、` std::find `、` std::accumulate `…），配合迭代器或范围使用， 例如 ` std::sort(v.begin(), v.end()); `。 *注意所需头文件：` sort/find ` 在 ` <algorithm> `，` accumulate ` 在 ` <numeric> `——漏了会报 not declared。*  **先"会读、会用"，不必现在背。**

 

```zhizhan-anchor
m07-4
```



## 07.4 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 泛型 | ` #define ` 宏 | 模板 |
| 容器 | 手写数组 | ` std::vector ` |
| 排序 | 手写 qsort | ` std::sort ` |
| 字典 | 手写哈希 | ` std::unordered_map ` |

 

```zhizhan-anchor
m07-5
```



## 07.5 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 模板定义放 .cpp | 链接不到 | 放头文件 |
| ` vector ` 越界 | 未定义行为 | 用 ` .at() ` 或检查 |
| 迭代器失效 | 崩溃 | 注意增删后失效 |

 

**FIG 7.2**  模板：类型也是参数

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="一份代码为多种类型生成">
[('template&lt;T&gt;', 'sv-cyn-s'), ('T=int', 'sv-grn-s'), ('T=double', 'sv-amb-s')]
        </svg>
```

 

编译期实例化。

 

**FIG 7.3**  STL 容器速览

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="按需求选容器">
[('vector 顺序', 'sv-grn-s'), ('map 键值', 'sv-cyn-s'), ('set 去重', 'sv-amb-s')]
        </svg>
```

 

先想清楚访问模式再选。

 

```zhizhan-anchor
m07-6
```



## 07.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

tmpl.cpp C\+\+

 

```text
#include <iostream>

template <typename T>
T bigger(T a, T b) { return a > b ? a : b; }

int main() { std::cout << bigger(3,7) << " " << bigger(2.5,1.5) << "\n"; return 0; }
```

 

stl.cpp C\+\+

 

```text
#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> v{3,1,2};
    std::sort(v.begin(), v.end());
    for (int x : v) std::cout << x << " ";
    std::cout << "\n";
    return 0;
}
```

 

◆ 迁移练习

 

把 C 册里"手写求最大值 \+ 排序"改成模板函数 \+ ` std::vector `/` std::sort ` 版。

 

◆ 本章要点

 

 
- ` template <class T> ` 把类型当参数，编译期为每种类型生成代码。
 
- 模板运行期零开销，代价是体积（实例化膨胀）。
 
- STL 提供现成容器：` string `/` vector `/` map `/` array ` 与算法。
 
- 范围 for（` for (int x : v) `）让遍历更简洁。
 
- 嵌入式对会动态分配的容器要谨慎，优先固定容量类型。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 简答：` template <class T> T max_of(T,T) ` 被 int 和 double 各用一次，会生成几份代码？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**两份** （各针对一种类型实例化）。这就是模板的体积代价。"}
   ```
 
2. 判断：` std::vector ` 适合直接在 MCU 的硬实时路径里用。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不太适合。它会动态分配/扩容，带来堆碎片与不确定延迟。实时路径优先固定容量容器（` std::array `）。"}
   ```
 
3. 诊断：` std::vector<int> v; v[0] = 1; ` 崩溃了，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"空 vector 没有元素，` v[0] ` 越界。应先 ` push_back `（或先 ` resize `）。` [] ` 不检查边界。"}
   ```
 
4. 动手：把 ` templates.cpp ` 的 ` max_of ` 用于 ` std::string `（如 ` max_of(std::string("a"), std::string("b")) `），看是否可行。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"可行——` std::string ` 支持 ` > `。模板对\"支持所需运算\"的类型都适用，这正是泛型的力量（也是它报错啰嗦的原因）。"}
   ```
 
5. 判断：STL 里的 ` std::array ` 和 C 数组一样不占额外存储。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"基本对。` std::array<T,N> ` 就是\"包了层接口的定长数组\"，无动态分配、不占额外存储，且能和 STL 算法配合——嵌入式里很合适。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  写一个函数模板 ` sum(const std::vector<T>&) `，对 int 和 double 各用一次。

 

```zhizhan-assessment
{"id":"course-b02a-m07","criterion":"选一个 STL 容器，解释复杂度、容量与迭代器失效，并用算法表达转换。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
