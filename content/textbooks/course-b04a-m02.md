# 类型与运算符

```zhizhan-anchor
m02
```



Python 的基本类型与 C 类似（整数/小数/字符串/布尔），但更省心： **整数不会溢出** 、字符串功能丰富、 还有好用的  **f-string**  格式化。

 

> ◷ 约 55 分钟 · ◈ int/float/str/bool · f-string · ⚑ 类型转换

 

```zhizhan-anchor
m02-1
```



## 2.1 基本类型与运算

 

m02\_types.py — 类型、运算、f-string（可运行） Python

 

```text
n = 7
x = 3.5
s = "embedded"
b = True
print(type(n).__name__, type(x).__name__, type(s).__name__, type(b).__name__)
print("7 / 2  =", 7 / 2)        # 真除法：3.5
print("7 // 2 =", 7 // 2)       # 地板除（向下取整）：3
print("7 % 2 =", 7 % 2)
print("7 ** 2 =", 7 ** 2)       # 幂
print(f"n={n}, x={x}, s={s}")   # f-string
print("int('42') + 1 =", int("42") + 1)
print("'value=' + str(n) =", "value=" + str(n))
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M02）

 

```text
$ python m02_types.py
int float str bool
7 / 2  = 3.5
7 // 2 = 3
7 % 2 = 1
7 ** 2 = 49
n=7, x=3.5, s=embedded
int('42') + 1 = 43
'value=' + str(n) = value=7
```

 

◆ 与 C 的三个关键差异

 

 
- **` / ` 是真除法** （` 7/2 = 3.5 `）；` // ` 是 **地板除（向下取整）** 。与 C 的"整数除"差异要留意 **负数** ：Python 里 ` -7 // 2 == -4 `（向下取整），而 C 的 ` -7 / 2 == -3 `（向零截断）；` -7 % 2 == 1 `（Python 取余符号跟除数走）。
 
- **整数不溢出** ：Python 的 ` int ` 是任意精度（要多大有多大），所以在 MCU 上要留心"行为与 C 不同"。
 
- **f-string** ：` f"{x:.2f}" ` 直接在字符串里嵌入表达式与格式。

 

```zhizhan-anchor
m02-2
```



## 2.2 类型转换

 

| 转换 | 说明 |
| --- | --- |
| ` int("42") ` | 字符串 → 整数（失败抛 ` ValueError `） |
| ` float("3.5") ` | 字符串 → 小数 |
| ` str(7) ` | 任意 → 字符串 |
| ` bool(0) ` | **数值零、空字符串、空容器（` [] () {} set() `）、` None ` → False** ，其余 → True |

 

⚠ 布尔与"真值"

 

在条件判断里，` 0 `、` 0.0 `、` "" `、` [] `、` None ` 都算"假"，其余算"真"（M03 详讲）。

 

```zhizhan-anchor
m02-4
```



## 02.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 整数 | ` int ` | ` int `（任意精度） |
| 浮点 | ` double ` | ` float ` |
| 布尔 | ` int ` | ` bool ` |
| 转换 | 强制转换 | ` int()/float()/str() ` |

 

**FIG 2.2**  动态类型

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="变量没有固定类型，值有">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">x=1</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">x="a"</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">x=3.5</text>

        </svg>
```

 

同名变量可先后指向不同类型。

 

**FIG 2.3**  常见转换

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="显式转换避免类型错误">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">"3"</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">int("3")</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">3</text>

        </svg>
```

 

` input() ` 得到的是字符串。

 

```zhizhan-anchor
m02-5
```



## 02.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| 整数除得浮点 | — | ` // ` 才是整除 |
| 字符串拼数字 | TypeError | 先 ` str() ` |
| ` input() ` 当数字用 | TypeError | ` int(input()) ` |

 

```zhizhan-anchor
m02-6
```



## 02.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 整除 | ` 7 // 2 → 3 ` |
| 取余 | ` 7 % 2 → 1 ` |
| 幂 | ` 2 ** 10 ` |
| 真除 | ` 7 / 2 → 3.5 ` |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

types.py Python

 

```text
a = 7
b = 2
print(a / b, a // b, a % b, a ** b)
```

 

convert.py Python

 

```text
s = input() if False else "42"   # 演示
n = int(s)
print(n + 1)
```

 

◆ 迁移练习

 

写一个温度转换程序（摄氏↔华氏），注意用 ` float() ` 转换并保留一位小数。

 

◆ 本章要点

 

 
- 基本类型：` int `/` float `/` str `/` bool `；` type(x) ` 看类型。
 
- ` / ` 真除法、` // ` 地板除（向下取整）、` % ` 取余、` ** ` 幂；负数下方差注意。
 
- Python 整数 **任意精度** ，不会溢出（与 C 不同）。
 
- ` f"{x}" ` 是最常用的格式化方式。
 
- 类型转换 ` int()/float()/str() `。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 填空：` 7 / 2 ` 的结果是 \_\_\_\_\_\_，` 7 // 2 ` 是 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` 3.5 `（真除法）/ ` 3 `（地板除）。"}
   ```
 
2. 判断：Python 的 ` int ` 到了 2^32 会像 C 一样溢出。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。Python 的 ` int ` 是任意精度，会继续增大（代价是变慢/占内存）。"}
   ```
 
3. 诊断：` "3" + 4 ` 报 ` TypeError `，怎么修？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"字符串与整数不能直接相加。应显式转换：` int(\"3\") + 4 ` 或 ` \"3\" + str(4) `。"}
   ```
 
4. 动手：写 ` f"{3.14159:.2f}" `、` f"{255:08b}" `（二进制），观察格式控制。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"分别得到 ` 3.14 ` 与 ` 11111111 `——f-string 支持宽度/精度/进制格式。"}
   ```
 
5. 判断：` bool([]) ` 是 ` True `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"是 ` False `。空列表（以及空字符串、0、None）在布尔上下文里都是假。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  读入一个数字字符串（如 ` "3.5" `），转成 float 并计算它的平方，用 f-string 保留两位小数输出。

 

```zhizhan-assessment
{"id":"course-b04a-m02","criterion":"解释可变对象别名、整数/浮点及负数整除，不把 Python 结果直接当 C 的结果。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
