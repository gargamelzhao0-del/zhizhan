# 智能指针、异常与 RAII

```zhizhan-anchor
m08
```



手动 ` new/delete ` 容易忘、容易重复释放。C\+\+ 的答案是  **RAII \+ 智能指针** ：把"释放"交给对象的析构。 这一节讲 ` unique_ptr `、异常，并把你引向《C\+\+（嵌入式向）迁移地图》(B02)。

 

> ◷ 约 65 分钟 · ◈ unique\_ptr · try/catch · RAII · ⚑ 过渡到 B02

 

```zhizhan-anchor
m08-1
```



## 8.1 RAII 与析构：把释放交给对象

 

smartptr.cpp — RAII \+ 智能指针 \+ 异常（可运行） C\+\+

 

```text
#include <iostream>
#include <memory>
#include <stdexcept>

class Res {
public:
    Res()  { std::cout << "获取资源\n"; }
    ~Res() { std::cout << "释放资源（RAII）\n"; }
};

int main()
{
    {
        std::unique_ptr<Res> p(new Res());   /* 离开作用域自动释放 */
        std::cout << "使用资源…\n";
    }                                        /* 这里自动析构 */

    try {
        throw std::runtime_error("模拟错误");
    } catch (const std::exception &e) {
        std::cout << "捕获异常: " << e.what() << "\n";
    }
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M08）

 

```text
$ g++ -std=c++17 -Wall -Wextra smartptr.cpp -o smart && ./smart
获取资源
使用资源…
释放资源（RAII）
捕获异常: 模拟错误
# 抛出异常时，unique_ptr 也在栈展开中析构 → "释放资源（RAII）"照样打印：这就是异常安全。
```

 

```zhizhan-anchor
m08-2
```



## 8.2 智能指针：别再用裸 new/delete

 

| 指针 | [所有权](term:ownership) | 说明 |
| --- | --- | --- |
| ` std::unique_ptr<T> ` | 独占 | 同一时刻只有一个所有者；不能拷贝、只能移动。 **首选** |
| ` std::shared_ptr<T> ` | 共享 | 引用计数，最后一个释放；有原子计数开销，嵌入式慎用。 |
| 裸 ` T* ` \+ ` new/delete ` | 你自己 | 容易忘记/重复释放——除非必要，别用。 |

 

◆ 为什么智能指针更好

 

 
- 离开作用域 **自动释放** ，不会忘；
 
- 不能被拷贝（unique\_ptr）， **不会重复释放** ；
 
- 异常抛出时也会释放（因为走的是析构）。

 

```zhizhan-anchor
m08-3
```



## 8.3 异常：` try / catch `

 

` throw ` 抛出一个异常对象，沿调用栈向上找匹配的 ` catch `。它把"错误"从返回值里分离出来， 让正常路径更干净。规则： **可恢复错误用返回值/错误码，不可恢复的意外才抛异常** 。

 

⚠ 嵌入式里通常关掉异常

 

异常需要"展开表 \+ 运行时"（体积与不确定性），嵌入式常编译时加 ` -fno-exceptions ` 关掉，改用错误码。  **本册为了讲全语言特性用了异常；到 B02 你会学到"MCU 上该不该开异常"的账单。**

 

```zhizhan-anchor
m08-4
```



## 8.4 你已经会 C\+\+ 了——下一步

 

**FIG 8.1**  从"会 C\+\+"到"把 C\+\+ 用到 MCU"

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="B02a 到 B02 的过渡">
          <rect x="20" y="52" width="230" height="46" rx="6" class="sv-box"></rect>
          <text x="135" y="72" class="sv-lbl-hi" text-anchor="middle">B02a（本册）</text>
          <text x="135" y="89" class="sv-lbl-dim" text-anchor="middle">类/继承/多态/模板/STL/RAII</text>
          <path d="M250 75 L310 75" class="sv-arrow"></path>
          <rect x="312" y="30" width="328" height="90" rx="8" class="sv-grn-s"></rect>
          <text x="330" y="54" class="sv-lbl-hi" style="fill:var(--grn)">B02《C++（嵌入式向）迁移地图》</text>
          <text x="330" y="76" class="sv-lbl-dim">每项特性的真实代价（字节/指令/周期）</text>
          <text x="330" y="96" class="sv-lbl-dim">-fno-exceptions/-fno-rtti、ISR 里的 C++</text>
          <text x="330" y="114" class="sv-lbl-dim">与 C 互操作、模板实例化膨胀</text>
        </svg>
```

 

本册教" **怎么写** "；B02 教" **在 MCU 上值不值得、代价多大、怎么落地** "。两册配对，缺一不可。

 

```zhizhan-anchor
m08-5
```



## 08.5 与 C 的对照速查

 

| 维度 | C 的做法 | C\+\+ 的做法 |
| --- | --- | --- |
| 释放 | 手工 free | 析构/智能指针 |
| 所有权 | 靠约定 | ` unique_ptr ` |
| 错误 | 返回码 | 异常 try/catch |
| 拷贝资源 | 易重复释放 | 移动/独占 |

 

```zhizhan-anchor
m08-6
```



## 08.6 常见错误与修复

 

| 错误 | 后果 | 修复 |
| --- | --- | --- |
| 裸 ` new ` 忘记 delete | 泄漏 | 用智能指针 |
| 析构里抛异常 | terminate | 析构不抛 |
| catch(...) 吞掉一切 | 难定位 | 至少记录 |

 

**FIG 8.2**  RAII：把释放交给对象

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="对象析构时自动释放">
[('获取（构造）', 'sv-grn-s'), ('使用', 'sv-cyn-s'), ('释放（析构）', 'sv-red-s')]
        </svg>
```

 

提前 return 也会释放。

 

**FIG 8.3**  智能指针的所有权

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="unique 独占、shared 共享">
[('unique_ptr 独占', 'sv-grn-s'), ('shared_ptr 共享', 'sv-amb-s')]
        </svg>
```

 

默认先用 ` unique_ptr `。

 

```zhizhan-anchor
m08-7
```



## 08.7 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译运行 | ` g++ -std=c++17 -Wall ` |
| 无警告 | 处理每条 warning |
| 理解每行 | 不照抄 |

 

raii.cpp C\+\+

 

```text
#include <iostream>
#include <memory>

int main() {
    auto p = std::make_unique<int>(42);
    std::cout << *p << "\n";
    return 0;   // 自动释放
}
```

 

except.cpp C\+\+

 

```text
#include <iostream>

int main() {
    try { throw 7; }
    catch (int e) { std::cout << "caught " << e << "\n"; }
    return 0;
}
```

 

◆ 迁移练习

 

把一段"裸 new/delete"改成 ` unique_ptr `，并给可能失败的函数加 ` try/catch `。

 

◆ 本章要点

 

 
- RAII：构造获取、析构释放；是 C\+\+ 资源管理的基石。
 
- 用 ` unique_ptr ` 表达独占所有权，自动释放、不可复制。
 
- ` shared_ptr ` 共享所有权但有开销，嵌入式慎用。
 
- 异常用 ` try/catch `；可恢复错误仍优先用错误码。
 
- 嵌入式常关异常（` -fno-exceptions `）——到 B02 学"该不该开"的账单。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 简答：RAII 一句话是什么？它靠什么自动生效？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"构造获取资源、析构释放资源；靠\"对象离开作用域必调析构\"自动生效，把\"记得释放\"交给编译器。"}
   ```
 
2. 判断：` unique_ptr ` 可以拷贝给另一个 ` unique_ptr `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能拷贝，只能 **移动** （` std::move `）。这正是\"独占所有权\"的保证。"}
   ```
 
3. 诊断：函数中 ` new ` 了对象，中途 ` return ` 或抛异常，为什么漏了 ` delete `？怎么根治？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"提前返回/异常跳过了 delete。根治办法：用 ` unique_ptr ` 持有它——无论怎么离开，析构都会释放。"}
   ```
 
4. 动手：把 ` smartptr.cpp ` 里的 ` unique_ptr ` 换成裸 ` new Res() ` 且不 delete，再在中间 ` throw `，观察"释放资源"是否消失。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"释放不再发生（内存/资源泄漏）——直观展示为什么智能指针在异常路径下也安全。"}
   ```
 
5. 判断：学完本册就可以直接写 MCU 上的 C\+\+ 了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"可以写、但还不懂\"值不值得\"：异常/RTTI/动态分配/多态在 MCU 上的代价、与 C 互操作、ISR 纪律都在 B02。请继续读 B02。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**B02a 完成？**  恭喜——你已经掌握 C\+\+ 语言本体。下一步请打开《C\+\+（嵌入式向）迁移地图》(B02)，学"在 MCU 上的代价与落地"。

 

```zhizhan-assessment
{"id":"course-b02a-m08","criterion":"使用 unique_ptr 或值对象表达唯一所有权；异常路径仍能释放资源。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
