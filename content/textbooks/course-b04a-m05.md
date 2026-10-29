# 数据结构：list / dict / set

```zhizhan-anchor
m05
```



Python 内置了强大的容器，很多在 C 里要手写的东西，这里一行就有： **列表、元组、字典、集合、推导式** 。

 

> ◷ 约 65 分钟 · ◈ list/tuple/dict/set · 推导式 · ⚑ 随手可用

 

```zhizhan-anchor
m05-1
```



## 5.1 四种容器

 

m05\_data.py — list/tuple/dict/set \+ 推导式（可运行） Python

 

```text
nums = [3, 1, 4, 1, 5]                 # list
nums.append(9)
print("list:", nums, "len:", len(nums))
print("slice[:2]:", nums[:2], "sorted:", sorted(nums))

point = (3, 4)                          # tuple（不可变）
print("tuple:", point, "point[0] =", point[0])

person = {"name": "Ann", "age": 30}     # dict
person["city"] = "Chengdu"
print("dict:", person, "get('age'):", person.get("age"))

unique = {1, 2, 2, 3, 3, 3}             # set（自动去重）
print("set:", unique)

squares = [x * x for x in range(1, 6)]  # 推导式
print("squares:", squares)
evens = [x for x in range(10) if x % 2 == 0]
print("evens:", evens)
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M05）

 

```text
$ python m05_data.py
list: [3, 1, 4, 1, 5, 9] len: 6
slice[:2]: [3, 1] sorted: [1, 1, 3, 4, 5, 9]
tuple: (3, 4) point[0] = 3
dict: {'name': 'Ann', 'age': 30, 'city': 'Chengdu'} get('age'): 30
set: {1, 2, 3}
squares: [1, 4, 9, 16, 25]
evens: [0, 2, 4, 6, 8]
```

 

| 容器 | 可变 | 用途 / 常用操作 |
| --- | --- | --- |
| ` list ` | 是 | 有序序列：` append / 索引 / 切片 [a:b] `；` xs.sort() ` 原地排序返回 ` None `，` sorted(xs) ` 返回新列表 |
| ` tuple ` | 否 | 不可变序列：作"记录"或字典键 |
| ` dict ` | 是 | 键值表：` d[k] / get(k) / keys() ` |
| ` set ` | 是 | 去重、交并差：` \| & - ` |

 

```zhizhan-anchor
m05-2
```



## 5.2 推导式：一行生成容器

 

comprehension.py — 三种推导式 Python

 

```text
squares = [x * x for x in range(1, 6)]          # 列表推导式
scores = {"a": 90, "b": 60}
passed = {k: v for k, v in scores.items() if v >= 70}   # 字典推导式
names = {s.strip() for s in ["a ", "b", " a"]}          # 集合推导式（去重）
print(squares, passed, names)
```

 

◆ 推导式读起来就是"自然语言"

 

` [x*x for x in xs if x%2==0] ` 读作"对 xs 里每个偶数 x，取 x\*x，组成列表"。 它替代了"C 里先建数组、再循环赋值"的样板代码——这是 Python 提高 **阅读收益/时间比** 的典型。

 

```zhizhan-anchor
m05-4
```



## 05.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 数组 | ` int a[N] ` | ` list ` |
| 键值 | 手写 | ` dict ` |
| 去重 | 手写 | ` set ` |
| 固定 | 数组 | ` tuple ` |

 

**FIG 5.2**  四种容器

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="按需求选">
          <rect x="20" y="50" width="140" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="90" y="78" class="sv-lbl-hi" text-anchor="middle">list 有序</text>
          <path d="M160 73 L170 73" class="sv-arrow"></path>
          <rect x="180" y="50" width="140" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="250" y="78" class="sv-lbl-hi" text-anchor="middle">dict 键值</text>
          <path d="M320 73 L330 73" class="sv-arrow"></path>
          <rect x="340" y="50" width="140" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="410" y="78" class="sv-lbl-hi" text-anchor="middle">set 去重</text>
          <path d="M480 73 L490 73" class="sv-arrow"></path>
          <rect x="500" y="50" width="140" height="46" rx="6" class="sv-box"></rect>
          <text x="570" y="78" class="sv-lbl-hi" text-anchor="middle">tuple 不可变</text>

        </svg>
```

 

先想访问模式再选。

 

**FIG 5.3**  推导式一行生成

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="把循环+条件压缩成一行">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">[x for x in xs]</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">加 if 过滤</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">结果列表</text>

        </svg>
```

 

可读性优先，别写太复杂。

 

```zhizhan-anchor
m05-5
```



## 05.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| 索引越界 | IndexError | 先判断长度 |
| 字典取不存在的键 | KeyError | 用 ` .get() ` |
| 遍历时改列表 | 行为不确定 | 遍历副本 |

 

```zhizhan-anchor
m05-6
```



## 05.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 列表 | ` [1,2,3] ` |
| 元组 | ` (1,2) ` 不可变 |
| 字典 | ` {"a":1} ` |
| 集合 | ` {1,2} ` |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

containers.py Python

 

```text
xs = [3, 1, 2]
d = {"a": 1, "b": 2}
s = {1, 1, 2}
print(xs, d.get("c"), s)
```

 

comprehension.py Python

 

```text
squares = [x * x for x in range(5) if x % 2 == 0]
print(squares)
```

 

◆ 迁移练习

 

用列表/字典/集合处理一组数据：去重、统计频次、用推导式生成平方表。

 

◆ 本章要点

 

 
- ` list ` 有序可变、` tuple ` 不可变、` dict ` 键值、` set ` 去重。
 
- ` sorted(xs) ` 返回 **新列表** ；` xs.sort() `  **原地** 排序且返回 ` None `（别写 ` x = xs.sort() `）。
 
- 切片 ` xs[a:b] `、` xs[:] ` 返回新列表，但是 **浅拷贝** ——嵌套的可变对象仍共享；要深拷贝用 ` copy.deepcopy `。
 
- ` set ` 是 **无序** 的：示例输出看着是 ` {1, 2, 3} `，但那是实现细节，别依赖集合的输出顺序。
 
- ` dict.get(k, default) ` 安全取值（键不存在不报错）。
 
- 推导式一行生成 list/dict/set，可读性高。
 
- 这些容器在嵌入式上位机脚本里极其常用（处理日志/采样/配置）。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 填空：想去掉列表里的重复项，最省事的是转成 ` ______ `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` set `（集合自动去重）。若要 **保序去重** ，可用 ` list(dict.fromkeys(xs)) `（` dict.fromkeys ` 返回的是 dict，要再 ` list(...) ` 转回列表，否则会误以为得到列表）。"}
   ```
 
2. 判断：` tuple ` 的元素可以修改。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能，tuple 不可变。需要可变就用 ` list `。"}
   ```
 
3. 诊断：` d["missing"] ` 报 ` KeyError `，怎么安全取值？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"用 ` d.get(\"missing\") `（返回 ` None `）或 ` d.get(\"missing\", 默认值) `。"}
   ```
 
4. 动手：用列表推导式生成 1~20 中 3 的倍数；再用字典推导式建"数→平方"的表。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` [x for x in range(1,21) if x%3==0] ` 与 ` {x: x*x for x in range(1,6)} `。"}
   ```
 
5. 判断：` nums[:2] ` 会修改原列表。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。切片返回一个 **新列表** （浅拷贝），原列表不变；但若元素本身是可变对象，新旧列表会共享它们。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  用字典统计一段文字里每个单词出现的次数（提示：` split() ` \+ ` d.get(w, 0) + 1 `）。

 

```zhizhan-assessment
{"id":"course-b04a-m05","criterion":"按有序性、重复与查找需要选 list/dict/set，并测试空集合。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
