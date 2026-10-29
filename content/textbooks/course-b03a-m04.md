# 枚举与模式匹配

```zhizhan-anchor
m04
```



Rust 的 ` enum ` 比 C 强大得多：每个"变体" **可以带数据** 。 配合 ` match `，能把"这个值是什么情形、里面的数据是什么"一次讲清楚。这也是 ` Option `/` Result ` 的基础。

 

> ◷ 约 70 分钟 · ◈ enum · match · Option/Result · ⚑ 取代空指针

 

```zhizhan-anchor
m04-1
```



## 4.1 带数据的枚举 \+ ` match `

 

m04\_enums.rs — enum/match/Option（可运行） Rust

 

```text
#[derive(Debug)]
enum Shape { Circle(f64), Rect(f64, f64) }

impl Shape {
    fn area(&self) -> f64 {
        match self {                            // 模式匹配：穷尽所有变体
            Shape::Circle(r) => 3.14159 * r * r,
            Shape::Rect(w, h) => w * h,
        }
    }
}

fn find_first_even(xs: &[i32]) -> Option<i32> {   // Some / None
    for &x in xs { if x % 2 == 0 { return Some(x); } }
    None
}

fn main() {
    let shapes = [Shape::Circle(1.0), Shape::Rect(2.0, 3.0)];
    for s in &shapes { println!("area = {:.2}", s.area()); }

    match find_first_even(&[1, 3, 4, 7]) {
        Some(v) => println!("first even = {v}"),
        None => println!("no even"),
    }
    if let Some(v) = find_first_even(&[1, 3]) { println!("even {v}"); } else { println!("none"); }
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M04）

 

```text
$ rustc --edition 2021 -O m04_enums.rs -o m04 && ./m04
area = 3.14
area = 6.00
first even = 4
none
```

 

◆ ` match ` 必须"穷尽"

 

编译器要求你覆盖 **所有** 变体，少一个就编译错误——这消灭了 C 里"忘了处理某分支"的 bug。 *若图省事写 ` _ => ... ` 兜底，就 **放弃了** 这个好处：将来给 enum 加变体时，编译器不会再提醒你更新这个 match（自测第 4 题正演示相反的用法）。* 只想处理一种情形时用 ` if let Some(v) = ... `。

 

```zhizhan-anchor
m04-2
```



## 4.2 ` Option<T> `：用类型表达"可能没有"

 

**FIG 4.1**  ` Option ` 取代空指针：要么有值、要么明确"没有"

 

```zhizhan-figure
<svg viewBox="0 0 660 130" role="img" aria-label="Option 的两个变体">
          <rect x="60" y="40" width="200" height="50" rx="8" class="sv-grn-s"></rect>
          <text x="160" y="62" class="sv-lbl-hi" text-anchor="middle">Some(T)</text>
          <text x="160" y="80" class="sv-lbl-dim" text-anchor="middle">有值，可取出来用</text>
          <rect x="400" y="40" width="200" height="50" rx="8" class="sv-amb-s"></rect>
          <text x="500" y="62" class="sv-lbl-hi" text-anchor="middle">None</text>
          <text x="500" y="80" class="sv-lbl-dim" text-anchor="middle">明确表示"没有值"</text>
          <text x="60" y="118" class="sv-lbl-dim">C 里用 NULL / 返回 -1 表示"没有"，忘了判断就崩溃；Option 逼你在类型层面处理。</text>
        </svg>
```

 

对 ` Option `，编译器 **不允许你"忘了它可能为空"** ：要么 ` match `、要么 ` if let `、要么 ` unwrap `（显式承认"我赌它有值"）；失败即 panic，M06 详讲。

 

| 类型 | 含义 | 典型用法 |
| --- | --- | --- |
| ` Option<T> ` | 有 / 无（Some/None） | 查找、可能缺失的字段 |
| ` Result<T, E> ` | 成功 / 失败（Ok/Err） | 可能出错的操作（M06） |

 

```zhizhan-anchor
m04-4
```



## 04.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 多选一 | 枚举 \+ switch | enum \+ match |
| 可空 | NULL | ` Option<T> ` |
| 解构 | 手动取字段 | match 绑定 |
| 穷尽检查 | 无 | 编译器强制穷尽 |

 

**FIG 4.2**  enum 的值可以有数据

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="每个变体可携带不同类型">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">Red</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">Rgb(u8,u8,u8)</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">None</text>

        </svg>
```

 

比整数枚举表达力更强。

 

**FIG 4.3**  Option\<T\> 表达"可能没有"

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="Some 有值，None 无值">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">Option<t></t></text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">Some(v)</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">None</text>

        </svg>
```

 

用类型消灭空指针。

 

```zhizhan-anchor
m04-5
```



## 04.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| match 没穷尽 | non-exhaustive patterns | 补 ` _ => ` |
| ` unwrap ` 了 None | 运行期 panic | 用 ` match `/` if let ` |
| 忘记 derive Debug | {:?} 编译错 | 加 ` #[derive(Debug)] ` |

 

```zhizhan-anchor
m04-6
```



## 04.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m04b.rs Rust

 

```text
#[derive(Debug)]
enum Color { Red, Green, Rgb(u8, u8, u8) }

fn main() {
    let c = Color::Rgb(10, 20, 30);
    match c {
        Color::Red => println!("red"),
        Color::Green => println!("green"),
        Color::Rgb(r, g, b) => println!("{},{},{}", r, g, b),
    }
}
```

 

m04c.rs Rust

 

```text
fn half(x: i32) -> Option<i32> {
    if x % 2 == 0 { Some(x / 2) } else { None }
}

fn main() {
    match half(10) {
        Some(v) => println!("{}", v),
        None => println!("odd"),
    }
}
```

 

◆ 迁移练习

 

定义一个 ` Shape ` 枚举（圆/方），用 ` match ` 计算面积；再用 ` Option ` 表达"查找可能失败"。

 

◆ 本章要点

 

 
- Rust 的 ` enum ` 变体 **可以带数据** （如 ` Circle(f64) `）。
 
- ` match ` 按变体分支并取出数据，且必须穷尽。
 
- ` Option<T> ` 用 Some/None 表达"可能没有"，取代空指针。
 
- ` if let ` 是"只关心一种情形"的简写。
 
- ` Result<T,E> ` 表达可能失败的操作（M06 详讲 ` ? ` 与错误传播）。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 判断：Rust 的 enum 变体只能像 C 那样是整数常量。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对。Rust 的 enum 变体 **可以携带任意数据** （元组/结构体形式），这也是 Option/Result 的实现基础。"}
   ```
 
2. 填空：函数"可能返回一个值、也可能没有"，返回类型应写成 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` Option<T> `。"}
   ```
 
3. 诊断：` match opt { Some(v) => ... } ` 漏了 ` None `，会怎样？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"编译错误：` match ` 必须穷尽所有变体（除非有 ` _ => ... ` 兜底）。这正是它比 C 的 switch 安全的地方。"}
   ```
 
4. 动手：给 ` Shape ` 加一个 ` Triangle(a,b,c) ` 变体（面积用海伦公式），看 ` match ` 是否逼你补上这一分支。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会。加了变体后，原来的 ` match ` 立即报\"未覆盖 Triangle\"——编译器帮你找到所有需要更新的地方。"}
   ```
 
5. 判断：` Option ` 和 ` Result ` 是同一种东西，只是名字不同。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不同。` Option ` 表达\"有/无\"（无错误信息）；` Result<T,E> ` 表达\"成功/失败\"，并 **携带错误值 E** 。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  定义一个 ` enum Token { Num(i32), Op(char) } `，写 ` eval ` 用 ` match ` 处理两种 token。

 

```zhizhan-assessment
{"id":"course-b03a-m04","criterion":"对所有枚举分支处理并表达 Option/Result；禁止把错误悄悄变成零。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
