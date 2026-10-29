# 字符串与文件

```zhizhan-anchor
m06
```



Python 的字符串内置了几十个方法（` strip/split/replace/join `…），处理文本非常省事； 读写文件用 ` with open(...) `， **自动关闭** 、不用手动 close。

 

> ◷ 约 60 分钟 · ◈ 字符串方法 · open/with · ⚑ 自动关闭

 

```zhizhan-anchor
m06-1
```



## 6.1 字符串方法

 

m06\_strings\_files.py — 字符串 \+ 文件读写（可运行） Python

 

```text
s = "  Hello, Embedded World  "
print("strip:", repr(s.strip()))
print("upper:", s.strip().upper())
print("replace:", s.strip().replace("World", "Rust"))
print("split:", "a,b,c".split(","))
print("join:", "-".join(["a", "b", "c"]))
print(f"len('hello') = {len('hello')}, 'x'*3 = {'x' * 3}")

path = "sample.txt"
with open(path, "w", encoding="utf-8") as fh:   # with 自动关闭
    fh.write("line1\nline2\nline3\n")

with open(path, "r", encoding="utf-8") as fh:
    lines = [ln.strip() for ln in fh]           # 列表推导式读所有行
print("file lines:", lines)
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M06）

 

```text
$ python m06_strings_files.py
strip: 'Hello, Embedded World'
upper: HELLO, EMBEDDED WORLD
replace: Hello, Embedded Rust
split: ['a', 'b', 'c']
join: a-b-c
len('hello') = 5, 'x'*3 = xxx
file lines: ['line1', 'line2', 'line3']
```

 

| 方法 / 操作 | 作用 |
| --- | --- |
| ` s.strip() ` | 去掉两端空白（含换行） |
| ` s.split(",") ` | 按分隔符切成列表 |
| ` ",".join(list) ` | 把列表拼成字符串 |
| ` s.replace(a, b) ` | 替换子串 |
| ` f"{x:.2f}" ` | 格式化（宽度/精度/进制） |

 

```zhizhan-anchor
m06-2
```



## 6.2 ` with open `：文件自动关闭

 

file\_io.py — 写 / 读 / 逐行 Python

 

```text
# 写：w 覆盖、a 追加；encoding 明确用 utf-8（跨平台稳）
with open("log.csv", "w", encoding="utf-8") as fh:
    fh.write("t,value\n")
    for i in range(3):
        fh.write(f"{i},{i * i}\n")

# 读：一次读全部 / 逐行遍历
with open("log.csv", "r", encoding="utf-8") as fh:
    header = fh.readline().strip()
    rows = [ln.strip().split(",") for ln in fh]
print("header:", header)
print("rows:", rows)
```

 

◆ 为什么用 ` with `

 

 
- 离开 ` with ` 块时 **自动关闭文件** ，即使中途出错也会关（等同 C\+\+ 的 RAII）。
 
- 不用记 ` fh.close() `，不会泄漏文件句柄。
 
- **明确 ` encoding="utf-8" `** ：跨平台避免中文乱码。

 

```zhizhan-anchor
m06-4
```



## 06.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 字符串 | ` char[] ` | ` str ` |
| 长度 | ` strlen ` | ` len() ` |
| 拼接 | ` strcat ` | ` + ` / f-string |
| 文件 | ` fopen ` | ` with open ` |

 

**FIG 6.2**  with open 自动关闭

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="离开 with 块自动关文件">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">with open</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">读写</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">自动关闭</text>

        </svg>
```

 

异常时也会关闭。

 

**FIG 6.3**  f-string 格式化

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="把变量嵌进字符串">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">f"{x}"</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">替换表达式</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">结果字符串</text>

        </svg>
```

 

比 ` % ` 更直观。

 

```zhizhan-anchor
m06-5
```



## 06.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| 忘记关文件 | 句柄泄漏 | 用 ` with ` |
| 用 \+ 拼很多字符串 | 慢 | 用 ` join ` |
| 下标越界 | IndexError | — |

 

```zhizhan-anchor
m06-6
```



## 06.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 去空白 | ` .strip() ` |
| 切分 | ` .split() ` |
| 替换 | ` .replace() ` |
| 判断包含 | ` in ` |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

strs.py Python

 

```text
s = "  embedded,rust  "
parts = s.strip().split(",")
print(parts, len(parts))
```

 

files.py Python

 

```text
with open("data.txt", "w") as f:
    f.write("hello")

with open("data.txt") as f:
    print(f.read())
```

 

◆ 迁移练习

 

写一个程序读一个文本文件，按行统计非空行数、去空白后打印最长的一行。

 

◆ 本章要点

 

 
- 字符串方法：` strip/split/join/replace/upper `，链式调用很自然。 **注意字符串是 **不可变** 的：这些方法都返回 **新字符串** ，原 ` s ` 不变** （所以代码里都用了返回值）。
 
- ` f"{x:.2f}" ` 控制格式；` repr() ` 便于看清空白字符。
 
- 文件读写用 ` with open(...) `，自动关闭、异常也安全。
 
- 模式：` "w" ` 写、` "a" ` 追加、` "r" ` 读；加 ` encoding="utf-8" `。
 
- 读 CSV/日志常用"逐行 \+ split/strip \+ 推导式"。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 简答：用 ` with open(...) ` 相比手动 ` open/close ` 的好处？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"离开 with 块自动关闭文件（即使抛异常也关），不用手写 close，也不会忘记关闭导致句柄泄漏。"}
   ```
 
2. 判断：读文件时每行结尾的 ` \n ` 会自动去掉。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。逐行读到的行 **带着换行符** ，通常要 ` .strip() ` 去掉。"}
   ```
 
3. 诊断：中文写入文件后打开是乱码，最可能的原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"没指定编码。写/读时都应加 ` encoding=\"utf-8\" `，避免用系统默认编码。"}
   ```
 
4. 动手：写一个脚本读入一行 ` "3,1,4,1,5" `，用 ` split(",") ` 转成整数列表并求和。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` sum(int(x) for x in \"3,1,4,1,5\".split(\",\")) `——字符串处理是上位机解析设备输出的核心。"}
   ```
 
5. 判断：` "a,b".split(",") ` 得到 ` ["a", "b"] `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。相对地 ` \",\".join([\"a\",\"b\"]) ` 得到 ` \"a,b\" `——split 与 join 互为逆操作。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  把一组 ADC 读数写进 CSV，再读回来算出平均值——这正是 B04 里"设备日志分析"的雏形。

 

```zhizhan-assessment
{"id":"course-b04a-m06","criterion":"显式声明编码，文件由 with 管理；损坏输入能报告行号。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
