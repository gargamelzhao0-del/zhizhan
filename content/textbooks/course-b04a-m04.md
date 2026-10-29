# 函数

```zhizhan-anchor
m04
```



` def ` 定义函数。Python 的函数比 C 更灵活： **默认参数、关键字参数、返回多个值、lambda、闭包** 。

 

> ◷ 约 60 分钟 · ◈ def · 参数 · lambda · 闭包 · ⚑ 多返回值

 

```zhizhan-anchor
m04-1
```



## 4.1 定义、参数与返回值

 

m04\_functions.py — 参数/lambda/闭包（可运行） Python

 

```text
def add(a, b):
    return a + b

def greet(name, greeting="hello"):    # 默认参数
    return f"{greeting}, {name}!"

def stats(xs):
    return min(xs), max(xs), sum(xs)  # 返回多个值（元组）

print(add(3, 4))
print(greet("world"))
print(greet("C", greeting="hi"))       # 关键字参数
print(stats([3, 1, 9, 4]))

square = lambda x: x * x               # lambda：匿名函数
print("square(5) =", square(5))

def make_counter():
    c = 0
    def inc():
        nonlocal c                     # 修改外层变量
        c += 1
        return c
    return inc

cnt = make_counter()
print(cnt(), cnt(), cnt())
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M04）

 

```text
$ python m04_functions.py
7
hello, world!
hi, C!
(1, 9, 17)
square(5) = 25
1 2 3
```

 

◆ 三个亮点

 

 
- **默认参数 / 关键字参数** ：` greet("C", greeting="hi") `——按名字传参，可读性更好。
 
- **返回多个值** ：` return a, b ` 实际返回一个元组，调用方 ` x, y = f() ` 拆包。
 
- **闭包** ：` inc ` 捕获了外层变量 ` c `；修改要用 ` nonlocal `。

 

```zhizhan-anchor
m04-2
```



## 4.2 参数形态速查

 

| 写法 | 含义 |
| --- | --- |
| ` def f(a, b): ` | 位置参数 |
| ` def f(a, b=0): ` | 默认参数（必须放后面） |
| ` def f(*args): ` | 可变位置参数（收成元组） |
| ` def f(**kwargs): ` | 可变关键字参数（收成字典） |
| ` lambda x: x+1 ` | 匿名函数（单表达式） |

 

⚠ 作用域与 global/nonlocal

 

函数内 **读** 全局变量不需要声明； **改** 全局要 ` global `，改外层函数的变量要 ` nonlocal `。 尽量少用 ` global `——它让数据流难以追踪（与 C 里到处改全局变量是同一个教训）。

 

**一个必须记住的陷阱——可变默认参数：** ` def f(x, lst=[]) ` 里的 ` [] `  **只在函数定义时求值一次** ，被所有调用共享：多次调用 ` f(1) ` 会一直往同一个列表里加。正确写法：默认用 ` None `，函数内再 ` if lst is None: lst = [] `。

 

```zhizhan-anchor
m04-4
```



## 04.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 定义 | ` int f(int) ` | ` def f(x): ` |
| 返回 | ` return ` | ` return `（可多值） |
| 默认参 | 无 | 默认参数 |
| 关键字参 | 无 | ` f(x=1) ` |

 

**FIG 4.2**  定义与调用

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="函数把一段逻辑打包复用">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">def f()</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">调用 f()</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">返回结果</text>

        </svg>
```

 

一个函数只做一件事。

 

**FIG 4.3**  多返回值其实是元组

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="return a, b 返回一个元组">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">return a, b</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">(a, b)</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">a, b = f()</text>

        </svg>
```

 

解包即得两个值。

 

```zhizhan-anchor
m04-5
```



## 04.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| 可变默认参数 | 共享状态 bug | 用 ` None ` 占位 |
| 忘记 return | 返回 ` None ` | 显式 return |
| 参数顺序错 | TypeError | 关键字传参 |

 

```zhizhan-anchor
m04-6
```



## 04.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 位置参 | ` f(1,2) ` |
| 关键字 | ` f(a=1,b=2) ` |
| 默认值 | ` def f(a, b=10) ` |
| \*args | 可变位置参 |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

func.py Python

 

```text
def add(a, b=10):
    return a + b

print(add(2))
print(add(2, 3))
```

 

multi.py Python

 

```text
def minmax(xs):
    return min(xs), max(xs)

lo, hi = minmax([3, 1, 2])
print(lo, hi)
```

 

◆ 迁移练习

 

把 C 册里的"求数组最大最小"写成 Python 函数，用多返回值一次返回两个结果。

 

◆ 本章要点

 

 
- ` def ` 定义函数；用 ` return ` 返回值（无则返回 ` None `）。
 
- 支持默认参数、关键字参数、` *args `/` **kwargs `。
 
- ` return a, b ` 返回元组，调用方可拆包。
 
- ` lambda ` 是单表达式匿名函数。
 
- 闭包捕获外层变量；改外层用 ` nonlocal `，改全局用 ` global `（少用）。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 填空：函数不写 ` return `，调用结果是 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` None `。"}
   ```
 
2. 判断：` return a, b ` 返回两个独立的值。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"实际返回一个 **元组**  ` (a, b) `；调用方 ` x, y = f() ` 是\"拆包\"。"}
   ```
 
3. 诊断：` def f(a=1, b): ` 报语法错误，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"默认参数必须排在非默认参数之后。应写成 ` def f(b, a=1): `。"}
   ```
 
4. 动手：写一个 ` def apply(xs, f): return [f(x) for x in xs] `，分别传入 ` lambda x: x*x ` 与 ` str `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"能得到平方列表与字符串列表——函数是一等公民，可作为参数传递，这是 Python 简洁的关键之一。"}
   ```
 
5. 判断：函数里读到全局变量也必须先 ` global ` 声明。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不用。只有 **修改** 全局变量才需要 ` global `；读取直接用即可。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  写一个函数接收任意个数字（` *nums `），返回它们的平均值；再写一个用 ` lambda ` 排序列表的函数。

 

```zhizhan-assessment
{"id":"course-b04a-m04","criterion":"避免可变默认参数共享状态，明确返回值和异常契约。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
