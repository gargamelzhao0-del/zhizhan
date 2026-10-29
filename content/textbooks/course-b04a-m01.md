# 从 C 到 Python：第一印象

```zhizhan-anchor
m01
```



Python 与 C 最大的不同： **解释执行、动态类型、用缩进分块** 。这一节先跑起来，建立第一印象。

 

> ◷ 约 55 分钟 · ◈ 解释器 · print · 动态类型 · ⚑ 无需编译

 

```zhizhan-anchor
m01-1
```



## 1.1 第一个 Python 程序

 

m01\_hello.py — 变量与输出（可运行） Python

 

```text
name = "Python"          # 无需声明类型
count = 3
pi = 3.14
nothing = None           # 表示"没有值"
print("Hello,", name)
print("count =", count, "pi =", pi, "nothing =", nothing)
# 动态类型：同一个名字可以指向不同类型
count = "now a string"   # 合法，但类型变了（C 里不允许）
print(count)
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M01）

 

```text
$ python m01_hello.py
Hello, Python
count = 3 pi = 3.14 nothing = None
now a string
```

 

◆ 三个与 C 不同的地方

 

 
- **不用编译** ：` python m.py ` 直接跑；也可以进交互解释器（REPL）逐句试。
 
- **动态类型** ：变量不绑定类型，同一个名字可以先后指向不同类型（` count ` 从整数变字符串）。
 
- **缩进分块** ：用缩进（通常 4 空格）代替 C 的 ` {} `；缩进错就是语法错误。

 

```zhizhan-anchor
m01-2
```



## 1.2 与 C 的对照

 

| 想做的事 | C | Python |
| --- | --- | --- |
| 输出 | ` printf("%d\n", x) ` | ` print(x) `（自动加换行） |
| 变量 | ` int x = 5; `（要声明类型） | ` x = 5 `（类型自动） |
| 代码块 | ` { } ` | 缩进 |
| 运行 | 先 ` gcc ` 编译再执行 | ` python m.py ` 直接执行 |
| 空值 | ` NULL `（指针） | ` None `（一个对象） |

 

✔ 交互式解释器（REPL）

 

命令行敲 ` python ` 进入 ` >>> ` 提示符，随手输入 ` 2+3 `、` "hi".upper() ` 立刻见结果——学习 Python 最快的工具。

 

```zhizhan-anchor
m01-4
```



## 01.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 输出 | ` printf ` | ` print() ` |
| 分号 | 必须 | 不需要 |
| 类型 | 声明 | 动态 |
| 编译 | 需编译 | 直接解释运行 |

 

**FIG 1.2**  写 → 运行

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="源码交给解释器直接运行">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">main.py</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">python 解释器</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">输出</text>

        </svg>
```

 

没有独立编译步骤。

 

**FIG 1.3**  缩进就是语法

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="同一块代码缩进要一致">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">if x:</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">    缩进块</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">缩进不一致 → 报错</text>

        </svg>
```

 

缩进不是排版，是语法。

 

```zhizhan-anchor
m01-5
```



## 01.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| 缩进不一致 | IndentationError | 统一 4 空格 |
| 中文标点 | SyntaxError | 用英文标点 |
| 忘了冒号 | SyntaxError | ` if x: ` |

 

```zhizhan-anchor
m01-6
```



## 01.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 运行 | ` python file.py ` |
| REPL | ` python ` 交互 |
| 注释 | ` # ` |
| 版本 | 用 ` python3 ` |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

hello.py Python

 

```text
name = "embedded"
print("Hello,", name)
```

 

sum.py Python

 

```text
a = 2
b = 3
print(a + b)
```

 

◆ 迁移练习

 

用 Python 写一个"读入两个数打印和"的程序（可用 ` input ` \+ ` int() `），对比 C 的写法。

 

◆ 本章要点

 

 
- Python 解释执行、无需编译；` python m.py ` 直接运行。
 
- 变量动态类型：` x = 5 `，无需声明；同一名字可改指不同类型。
 
- 用缩进表示代码块，替代 C 的 ` {} `。
 
- ` print(x) ` 自动换行；` None ` 表示"没有值"。
 
- REPL 是随手的实验台。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 判断：Python 变量要像 C 那样先声明类型。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不用。Python 动态类型：` x = 5 ` 直接赋值，类型由值决定。"}
   ```
 
2. 简答：` count = 3 ` 之后又 ` count = "hi" `，能运行吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"能。变量是名字，可重新绑定到不同类型的对象（这是与 C 的关键差异；也要求你更注意类型）。"}
   ```
 
3. 诊断：程序报 ` IndentationError `，最可能是什么原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"缩进不一致（该缩进的没缩进，或混用空格与 Tab）。Python 用缩进划分代码块。"}
   ```
 
4. 动手：进入 REPL（` python `），输入 ` 2 + 3 * 4 `、` "abc".upper() `，观察即时结果。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"得到 ` 14 ` 与 ` 'ABC' `——REPL 立即求值，非常适合做小实验。"}
   ```
 
5. 判断：` None ` 和 C 的 ` 0 ` 是一回事。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不同。` None ` 是表示\"没有值\"的独立对象；` 0 ` 是整数。判断用 ` x is None `—— **` is ` 比较\"是不是同一个对象\"（身份），` == ` 比较\"值是否相等\"** ；` None ` 是单例，所以惯用 ` is None `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  运行 ` m01_hello.py `，再用 REPL 试三条表达式。

 

```zhizhan-assessment
{"id":"course-b04a-m01","criterion":"在隔离环境运行脚本，解释解释器与工作目录，并保留完整异常信息。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
