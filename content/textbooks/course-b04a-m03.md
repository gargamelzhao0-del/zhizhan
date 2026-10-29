# 控制流：分支与循环

```zhizhan-anchor
m03
```



` if/elif/else ` 做分支，` for/while ` 做循环，` break/continue ` 提前跳出。 与 C 类似，但 Python 用 **缩进** 分块、` for ` 是"遍历"而非"计数"。

 

> ◷ 约 55 分钟 · ◈ if/for/while · range · 真值 · ⚑ 缩进即结构

 

```zhizhan-anchor
m03-1
```



## 3.1 分支与两种循环

 

m03\_control.py — if/for/while（可运行） Python

 

```text
for i in range(1, 6):          # 1..5
    if i % 2 == 0:
        print(i, "even")
    else:
        print(i, "odd")

total = 0
n = 10
while n > 0:
    total += n
    n -= 1
print("sum 1..10 =", total)

for x in range(1, 10):
    if x == 3:
        continue               # 跳过 3
    if x == 6:
        break                  # 到 6 停止
    print("x =", x)
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M03）

 

```text
$ python m03_control.py
1 odd
2 even
3 odd
4 even
5 odd
sum 1..10 = 55
x = 1
x = 2
x = 4
x = 5
```

 

◆ Python 的 ` for ` 是"遍历"

 

 
- ` for i in range(1, 6) `：` range(a, b) ` 生成 ` a..b-1 `（含左不含右）。
 
- 它遍历的是"可迭代对象"，不只是数字——可以直接 ` for x in [3,1,4] `、` for k in d `（字典键）。
 
- ` range(5) ` 是 ` 0..4 `；` range(1, 6) ` 是 ` 1..5 `；` range(0, 10, 2) ` 是偶数步进。
 
- **负步长** ：` range(5, 0, -1) ` 得到 ` 5 4 3 2 1 `（含左不含右）；注意 ` range(5, 0) `（步长为正）是 **空** 的——这正对应 C 里写 ` for(i=5;i>0;i--) `。

 

```zhizhan-anchor
m03-2
```



## 3.2 "真值"：什么算假

 

| 表达式 | 布尔值 |
| --- | --- |
| ` 0 ` / ` 0.0 ` | False |
| ` "" `（空字符串） | False |
| 空容器：` [] ` / ` () ` / ` {} ` / ` set() ` | False |
| ` None ` | False |
| 其余非零/非空 | True |

 

所以 ` if xs: ` 常用来判断"列表非空"，` if not s: ` 判断"字符串为空"——比 C 里写 ` len > 0 ` 更自然。

 

```zhizhan-anchor
m03-4
```



## 03.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 分支 | ` if/else ` | ` if/elif/else ` |
| 循环 | ` for(;;) ` | ` for x in ... ` |
| 遍历 | 下标 | 直接迭代元素 |
| 区间 | 手动 | ` range() ` |

 

**FIG 3.2**  if / elif / else

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="从上到下匹配第一个为真的分支">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">if</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">elif</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">else</text>

        </svg>
```

 

只执行第一个命中的分支。

 

**FIG 3.3**  for 直接迭代

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="不用下标，直接拿元素">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">for x in xs</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">x 是元素</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">循环体</text>

        </svg>
```

 

也可以 ` enumerate ` 拿下标。

 

```zhizhan-anchor
m03-5
```



## 03.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| ` elif ` 写成 ` else if ` | SyntaxError | 用 ` elif ` |
| ` range(n) ` 少循环一次 | — | ` range ` 不含尾部 |
| 循环里改不了原列表 | — | 用索引或新列表 |

 

```zhizhan-anchor
m03-6
```



## 03.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 假值 | ` 0 / 0.0 / "" / [] / None ` |
| 真值 | 其它 |
| ` for ` | 已知次数/可迭代 |
| ` while ` | 条件驱动 |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

branch.py Python

 

```text
score = 85
if score >= 90:
    print("A")
elif score >= 60:
    print("pass")
else:
    print("fail")
```

 

loop.py Python

 

```text
total = 0
for i in range(1, 6):
    total += i
print(total)
```

 

◆ 迁移练习

 

写一个 FizzBuzz：1–20，3 的倍数打印 Fizz，5 的倍数打印 Buzz，15 的倍数打印 FizzBuzz。

 

◆ 本章要点

 

 
- ` if/elif/else ` 从上往下，命中第一个为真的分支。
 
- ` for ` 遍历可迭代对象；` range(a,b) ` 含左不含右。
 
- ` while ` 按条件循环；` break ` 跳出、` continue ` 跳过本次。
 
- 用缩进划分代码块——缩进错就是语法错误。
 
- 空/零/None 在条件里是假。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 填空：` range(1, 5) ` 会产生 \_\_\_\_\_\_ 到 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**1**  到  **4** （含左不含右，共 4 个数）。"}
   ```
 
2. 判断：` for i in range(10) ` 里 ` i ` 会取到 10。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会，取 0..9。"}
   ```
 
3. 诊断：` while x < 10: print(x) ` 停不下来，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"循环体没改 ` x `，条件恒真。应加 ` x += 1 `。"}
   ```
 
4. 动手：用 ` for n in range(1, 16) ` 实现 FizzBuzz（3 的倍数 Fizz、5 的倍数 Buzz、15 的倍数 FizzBuzz）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"先判 15、再判 3、再判 5，其余打印数字——与 C 版思路一致，但代码更短。"}
   ```
 
5. 判断：` if []: ` 会执行它的分支。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。空列表为假，` if []: ` 不进入。判断\"列表非空\"直接写 ` if xs: `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  用 ` for ` 求出 1~100 中所有能被 7 整除的数之和，并打印个数。

 

```zhizhan-assessment
{"id":"course-b04a-m03","criterion":"对迭代零次/一次/多次与异常退出写断言。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
