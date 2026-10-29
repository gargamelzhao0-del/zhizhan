# 异常、迭代器与测试 + 过渡到 B04

```zhizhan-anchor
m08
```



最后三样：用 ` try/except ` 处理错误、用生成器 ` yield ` 惰性产出数据、用断言做测试。 然后你就可以进入《Python（嵌入式向）》(B04) 了。

 

> ◷ 约 65 分钟 · ◈ try/except · 生成器 · 测试 · ⚑ 过渡到 B04

 

```zhizhan-anchor
m08-1
```



## 8.1 异常：` try / except `

 

m08\_exceptions.py — 异常 \+ 生成器 \+ 测试（可运行） Python

 

```text
def parse(s):
    try:
        return int(s)
    except ValueError:
        return None                          # 转换失败返回 None

print(parse("42"), parse("abc"))

def countdown(n):                            # 生成器：惰性产出
    while n > 0:
        yield n
        n -= 1

print("countdown:", list(countdown(4)))

# 一个极简"测试"（真实项目用 pytest）
def test_add():
    assert 1 + 1 == 2
test_add()
print("test_add OK")
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M08）

 

```text
$ python m08_exceptions.py
42 None
countdown: [4, 3, 2, 1]
test_add OK
```

 

◆ 异常 vs C 的错误码

 

 
- Python 的错误是 **异常对象** ，沿调用栈传播到最近的 ` except `；用 ` raise ValueError("bad") ` 主动抛出（也可 ` raise ` 重抛当前异常）。C 用返回值/错误码。
 
- ` assert ` 只用于 **内部自检/测试** ：` python -O ` 会把它优化掉，所以 **不要用 assert 校验外部输入** （那要用 if \+ raise）。
 
- ` try/except/else/finally `：` finally ` 无论成败都执行（清理）。
 
- **只捕获你确实能处理的异常** ：` except ValueError ` 比裸 ` except: ` 好，后者会吞掉所有错误。

 

```zhizhan-anchor
m08-2
```



## 8.2 生成器：惰性、省内存

 

generator.py — 逐行处理大文件（不占内存） Python

 

```text
def read_values(path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            yield float(line)          # 一行一行吐，不一次性载入

# 处理百万行的日志/采样也不会把内存吃光
# for v in read_values("adc.csv"):
#     total += v
```

 

✔ 迭代器是 for 的底层

 

` for ` 遍历的对象都是"可迭代"的（list/str/dict/生成器…）。生成器让你用"一次一个值"的方式处理大序列—— 这在 B04 里处理设备回传的长时间日志/采样时非常关键。

 

```zhizhan-anchor
m08-3
```



## 8.3 你已经会 Python 了——下一步

 

**FIG 8.1**  从"会 Python"到"用 Python 做嵌入式工具"

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="B04a 到 B04 的过渡">
          <rect x="20" y="52" width="230" height="46" rx="6" class="sv-box"></rect>
          <text x="135" y="72" class="sv-lbl-hi" text-anchor="middle">B04a（本册）</text>
          <text x="135" y="89" class="sv-lbl-dim" text-anchor="middle">语言本体：类型/函数/类/异常…</text>
          <path d="M250 75 L310 75" class="sv-arrow"></path>
          <rect x="312" y="30" width="328" height="90" rx="8" class="sv-grn-s"></rect>
          <text x="330" y="54" class="sv-lbl-hi" style="fill:var(--grn)">B04《Python（嵌入式向）》</text>
          <text x="330" y="76" class="sv-lbl-dim">pyserial 串口协议工具链</text>
          <text x="330" y="96" class="sv-lbl-dim">numpy/pandas/matplotlib 数据分析</text>
          <text x="330" y="114" class="sv-lbl-dim">构建/CI 脚本、GUI 调试台、MicroPython</text>
        </svg>
```

 

本册教" **Python 怎么写** "；B04 教" **用 Python 在嵌入式里做什么** "——串口、分析、构建、调试台。两册配对。

 

```zhizhan-anchor
m08-4
```



## 08.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 错误处理 | 返回码 | ` try/except ` |
| 出错 | errno | 抛异常 |
| 惰性 | 无 | 生成器 |
| 资源 | 手工释放 | ` with `/` finally ` |

 

**FIG 8.2**  try / except / finally

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="异常被捕获，finally 一定执行">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">try</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">except</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">finally</text>

        </svg>
```

 

` finally ` 用来释放资源。

 

**FIG 8.3**  生成器惰性产出

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="yield 一次产一个，省内存">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">yield</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">取一个</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">再取</text>

        </svg>
```

 

适合大数据流。

 

```zhizhan-anchor
m08-5
```



## 08.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| ` except ` 捕获太宽 | 掩盖 bug | 捕获具体异常 |
| 生成器用完再取 | StopIteration | for 自动处理 |
| 忘记 ` finally ` 释放 | 泄漏 | 用 ` with ` |

 

```zhizhan-anchor
m08-6
```



## 08.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 捕获 | ` try/except ` |
| 无论是否异常 | ` finally ` |
| 主动抛 | ` raise ` |
| 惰性序列 | ` yield ` |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

exc.py Python

 

```text
try:
    x = int("abc")
except ValueError as e:
    print("bad:", e)
finally:
    print("done")
```

 

gen.py Python

 

```text
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fib(6)))
```

 

◆ 迁移练习

 

写一个生成器按需产出数据（如斐波那契），并用 ` try/except/finally ` 处理一次文件读取失败。

 

◆ 本章要点

 

 
- 异常用 ` try/except `；只捕获能处理的、` finally ` 做清理。
 
- 生成器用 ` yield ` 惰性产出，处理大序列不占内存。
 
- 测试用 ` assert `（工程里用 pytest）。
 
- 你现在能写函数、类、处理数据结构、读写文件、处理异常。
 
- 进入 B04：把它们用到串口工具、数据分析、构建脚本与 MicroPython。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 简答：为什么"只捕获能处理的异常"（如 ` except ValueError `）比裸 ` except: ` 好？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"裸 ` except: ` 会吞掉所有异常（包括你没想到的 bug），让问题被隐藏；精确捕获让其它异常正常暴露。"}
   ```
 
2. 判断：生成器会一次性算出所有值。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。生成器 **按需产出** （惰性），每要一个才算一个——省内存。"}
   ```
 
3. 诊断：` int("abc") ` 抛出异常使程序崩溃，怎么让它"优雅失败"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"用 ` try/except ValueError ` 捕获，或先做校验；也可返回 ` None ` 让调用方判断。"}
   ```
 
4. 动手：写一个生成器 ` read_nonempty(path) `，逐行产出非空行（用 ` yield `），再 ` for ` 遍历打印。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"这是\"流式处理文件\"的标准写法，B04 处理设备日志时会反复用到。"}
   ```
 
5. 判断：学完本册就能用 Python 直接跑在单片机上做硬实时控制。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。上位机 Python（CPython）跑在 PC；单片机上是 MicroPython（B04 另讲），且不适合硬实时。本册是\"语言 \\+ 上位机工具\"的基础。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**B04a 完成？**  恭喜——你已经掌握 Python 语言本体。下一步请打开《Python（嵌入式向）》(B04)，学"串口工具链、数据分析、构建脚本与 MicroPython"。

 

```zhizhan-assessment
{"id":"course-b04a-m08","criterion":"区分可恢复异常与程序错误，测试迭代停止与资源释放。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
