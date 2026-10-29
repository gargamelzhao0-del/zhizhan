# 类与模块

```zhizhan-anchor
m07
```



` class ` 把数据和操作打包成自定义类型，` import ` 把代码拆成模块复用。 这两样让程序从"一个脚本"成长为"一个工程"。

 

> ◷ 约 65 分钟 · ◈ class · \_\_init\_\_ · import · ⚑ 组织代码

 

```zhizhan-anchor
m07-1
```



## 7.1 类：数据 \+ 方法

 

m07\_classes.py — 类与模块（可运行） Python

 

```text
import math                                  # 导入模块

class Circle:
    def __init__(self, r):                   # 初始化器（真正创建实例的是 __new__）
        self.r = r                           # 实例属性
    def area(self):                          # 方法（第一个参数是 self）
        return math.pi * self.r ** 2
    def __str__(self):                       # 打印时的表示
        return f"Circle(r={self.r})"

c = Circle(2.0)
print(c)
print(f"area = {c.area():.2f}")
print("math.sqrt(16) =", math.sqrt(16))
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M07）

 

```text
$ python m07_classes.py
Circle(r=2.0)
area = 12.57
math.sqrt(16) = 4.0
```

 

◆ 三个要点

 

 
- ` __init__(self, ...) `：创建对象时自动调用，初始化实例属性（` self.r `）。
 
- ` self `：每个方法第一个参数，指向"当前实例"（类似 C\+\+ 的 ` this `，但要显式写）。
 
- ` __str__ `：定义 ` print(obj) ` 时显示什么（类似 C\+\+ 的 ` operator<< `）。

 

| 常见特殊方法 | 作用 |
| --- | --- |
| ` __init__ ` | 构造（初始化） |
| ` __str__ ` | ` print() ` / ` str() ` 的表示 |
| ` __repr__ ` | 调试用的表示 |
| ` __len__ ` | 让 ` len(obj) ` 可用 |

 

```zhizhan-anchor
m07-2
```



## 7.2 模块与包：拆文件、复用

 

import\_demo.py — 几种 import 方式 Python

 

```text
import math                      # 用 math.sqrt / math.pi
from math import sqrt, pi        # 直接用它俩
import os                        # 标准库：文件/路径
from collections import Counter  # 标准库：计数

print(math.floor(3.7), sqrt(9), round(pi, 3))
print("cwd:", os.path.basename(os.getcwd()))
print("counts:", Counter("hello").most_common(3))
```

 

✔ 一个文件就是一个模块

 

把函数/类放进 ` utils.py `，别的文件 ` import utils ` 即可用（或 ` from utils import foo `）。 多个模块放进一个目录就构成"常规包"（通常加 ` __init__.py `；Python 3.3\+ 的命名空间包可省）。标准库已经覆盖了数学、路径、网络、JSON、正则等大量功能—— **先查有没有，再自己写** 。

 

```zhizhan-anchor
m07-4
```



## 07.4 与 C 的对照速查

 

| 维度 | C 的做法 | Python 的做法 |
| --- | --- | --- |
| 数据\+方法 | 结构体\+函数 | ` class ` |
| 构造 | 手工初始化 | ` __init__ ` |
| 拆文件 | ` #include ` | ` import ` |
| 包 | 目录 | package（带 \_\_init\_\_） |

 

**FIG 7.2**  类＝数据\+方法

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="实例持有数据，方法操作它">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">class</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">__init__</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">self.attr</text>

        </svg>
```

 

` self ` 是实例本身。

 

**FIG 7.3**  模块与包

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="文件即模块，目录即包">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">a.py</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">import a</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">pkg/</text>

        </svg>
```

 

用 import 复用代码。

 

```zhizhan-anchor
m07-5
```



## 07.5 常见错误与修复

 

| 错误 | Python 报什么 | 修复 |
| --- | --- | --- |
| 忘记 ` self ` | TypeError | 方法首参写 ` self ` |
| 模块名冲突 | 导入到别的模块 | 改文件名 |
| 循环导入 | ImportError | 调整依赖 |

 

```zhizhan-anchor
m07-6
```



## 07.6 速查与检查清单

 

| 用法 | 写法 |
| --- | --- |
| 实例属性 | ` self.x ` |
| 实例方法 | ` def f(self) ` |
| 导入 | ` import m ` |
| 从模块导入 | ` from m import f ` |

 

| 检查项 | 确认 |
| --- | --- |
| 能运行 | ` python file.py ` |
| 无异常 | 处理可能的错误 |
| 可读 | 变量名清晰 |

 

cls.py Python

 

```text
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def total(self):
        return self.x + self.y

p = Point(2, 3)
print(p.total())
```

 

usemod.py Python

 

```text
import math
from math import sqrt

print(math.pi, sqrt(9))
```

 

◆ 迁移练习

 

把"点"写成一个类（含方法），再拆成两个文件用 ` import ` 复用，体会模块化。

 

◆ 本章要点

 

 
- ` class ` 打包数据与方法；` __init__ `  **初始化** 实例（严格说创建实例的是 ` __new__ `）、` self ` 指实例。
 
- **类属性 vs 实例属性** ：写在 ` class ` 体里、方法外的是 **类属性** （所有实例共享）；` self.x = … ` 是 **实例属性** 。用 ` class B(A) ` \+ ` super().__init__(...) ` 可继承并复用基类。
 
- ` __str__/__repr__ ` 控制打印表示。
 
- ` import 模块 ` / ` from 模块 import 名字 `。
 
- 一个 .py 就是模块；含 ` __init__.py ` 的目录是"常规包"（3.3\+ 命名空间包可省）。
 
- 标准库很丰富（math/os/json/csv/collections…），优先复用。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 填空：Python 类里访问当前实例要用 ` ______ `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` self `（方法第一个参数，调用时自动传入）。"}
   ```
 
2. 判断：` __init__ ` 是"构造"，创建对象时自动执行。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。` Circle(2.0) ` 创建对象时会自动调用 ` __init__(self, 2.0) `。"}
   ```
 
3. 诊断：` print(obj) ` 出来是 ` <__main__.Circle object at 0x...> `，怎么改好看？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"定义 ` __str__ `（或 ` __repr__ `）返回你想显示的字符串。"}
   ```
 
4. 动手：写一个 ` Stack ` 类（用 list 实现 push/pop/peek/len），体会"数据\+操作"打包。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"这正是把 C 里\"函数 \\+ 全局数组\"封装成对象的写法；在 B04 的调试台里会用到类似结构。"}
   ```
 
5. 判断：` from math import * ` 是好习惯。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不推荐。它把大量名字倒进来、可能覆盖你的变量。显式 ` import math ` 或 ` from math import sqrt ` 更清晰。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  用一个类封装"一个传感器读数"（值、时间戳、单位），并写一个方法返回格式化字符串。

 

```zhizhan-assessment
{"id":"course-b04a-m07","criterion":"模块导入不触发设备操作；把主入口置于 main，类只封装真实状态。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
