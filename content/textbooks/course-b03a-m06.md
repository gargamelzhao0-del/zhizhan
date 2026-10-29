# 集合与错误处理

```zhizhan-anchor
m06
```



处理"一批数据"用 ` Vec `/` String `/` HashMap `； 处理"可能失败的操作"用 ` Result ` 与 ` ? `。两者是日常代码里出现频率最高的部分。

 

> ◷ 约 65 分钟 · ◈ Vec/String/HashMap · Result/? · ⚑ 不用异常

 

```zhizhan-anchor
m06-1
```



## 6.1 三个常用集合

 

m06\_collections.rs — Vec/String/HashMap \+ Result（可运行） Rust

 

```text
use std::collections::HashMap;

fn parse_int(s: &str) -> Result<i32, std::num::ParseIntError> {
    let n: i32 = s.trim().parse()?;              // ? 传播错误
    Ok(n)
}

fn main() {
    let mut v: Vec<i32> = Vec::new();
    for i in 1..=4 { v.push(i * i); }
    println!("vec = {:?}, sum = {}", v, v.iter().sum::<i32>());

    let s = String::from("hello");
    println!("len = {}, upper = {}", s.len(), s.to_uppercase());

    let mut counts: HashMap<&str, i32> = HashMap::new();
    for w in ["a", "b", "a", "a"] { *counts.entry(w).or_insert(0) += 1; }
    println!("a = {}, b = {}", counts["a"], counts["b"]);

    match parse_int("42") {
        Ok(n) => println!("parsed = {n}"),
        Err(e) => println!("error: {e}"),
    }
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M06）

 

```text
$ rustc --edition 2021 -O m06_collections.rs -o m06 && ./m06
vec = [1, 4, 9, 16], sum = 30
len = 5, upper = HELLO
a = 3, b = 1
parsed = 42
```

 

| 集合 | 用途 | 常用操作 |
| --- | --- | --- |
| ` Vec<T> ` | 动态数组 | ` push / len / [] / iter ` |
| ` String ` | 可增长、拥有堆内存的字符串 | ` push_str / len / to_uppercase `；` len() ` 是 **字节数** （UTF-8），不能按字符下标 ` s[0] ` |
| ` HashMap<K,V> ` | 键值表 | ` insert / get / entry().or_insert() ` |

 

```zhizhan-anchor
m06-2
```



## 6.2 ` Result ` 与 ` ? `：错误不靠异常

 

**FIG 6.1**  ` ? ` 的工作方式：Ok 取值继续，Err 直接返回

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="问号运算符传播错误">
          <rect x="240" y="20" width="180" height="34" rx="6" class="sv-box"></rect>
          <text x="330" y="42" class="sv-lbl-hi" text-anchor="middle">let n = s.parse::&lt;i32&gt;()?;</text>
          <path d="M330 54 L200 92" class="sv-arrow"></path>
          <text x="196" y="90" class="sv-lbl-dim" text-anchor="end">Ok(n) → 取 n 继续</text>
          <path d="M330 54 L460 92" class="sv-arrow-a"></path>
          <text x="464" y="90" class="sv-lbl-dim">Err(e) → 立刻 return Err(e)</text>
          <text x="240" y="126" class="sv-lbl-dim">谁调用谁处理——错误沿类型系统"显式"向上传递，无需 try/catch。</text>
        </svg>
```

 

Rust 用 ` Result ` \+ ` ? ` 取代异常： **错误是返回值的一部分** ，不会有"被忽略的异常"。可恢复错误一律这样做；` panic! ` 只留给"不可恢复"。

 

⚠ ` unwrap() ` / ` expect() ` 是"我确定不会失败"

 

` x.unwrap() ` 在 ` Err `/` None ` 时会 ` panic `（崩溃）。 在原型/测试里图方便可用，但 **生产代码里要显式处理错误** （match / ` ? ` / ` unwrap_or `）。

 

```zhizhan-anchor
m06-4
```



## 06.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 动态数组 | 手写/ malloc | ` Vec ` |
| 字符串 | ` char[] ` | ` String ` |
| 键值 | 手写哈希 | ` HashMap ` |
| 错误 | 返回码 | ` Result ` \+ ` ? ` |

 

**FIG 6.2**  常用集合

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="按需求选容器">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">Vec 顺序</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">String 文本</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">HashMap 键值</text>

        </svg>
```

 

都能安全地动态增长。

 

**FIG 6.3**  Result 与 ?

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="? 遇到 Err 提前返回错误">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">调用</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">Ok → 继续</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">Err → 返回</text>

        </svg>
```

 

错误处理显式、不靠异常。

 

```zhizhan-anchor
m06-5
```



## 06.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| 下标越界 | 运行期 panic | 用 ` get() ` |
| ` unwrap ` 了 Err | panic | 用 ` ? ` 或 match |
| ` ? ` 用在返回非 Result 的函数 | 编译错 | 函数返回 ` Result ` |

 

```zhizhan-anchor
m06-6
```



## 06.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m06b.rs Rust

 

```text
use std::collections::HashMap;

fn main() {
    let mut m: HashMap<&str, i32> = HashMap::new();
    m.insert("a", 1);
    println!("{}", m["a"]);
}
```

 

m06c.rs Rust

 

```text
fn parse(s: &str) -> Result<i32, std::num::ParseIntError> {
    let n: i32 = s.trim().parse()?;
    Ok(n * 2)
}

fn main() { println!("{:?}", parse("21")); }
```

 

◆ 迁移练习

 

用 ` Vec ` 存一组测量值求平均，用 ` HashMap ` 统计频次，用 ` Result ` 处理解析失败。

 

◆ 本章要点

 

 
- 常用集合：` Vec<T> `、` String `、` HashMap<K,V> `。
 
- 可恢复错误用 ` Result<T,E> `，不用异常。
 
- ` ? ` 是错误传播：Ok 取值、Err 提前返回。
 
- ` unwrap `/` expect ` 失败即 panic，生产代码慎用。
 
- ` entry().or_insert() ` 是计数/初始化的惯用法。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 填空：把 ` Result ` 里的 ` Err ` 直接往外传，用运算符 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` ? `。"}
   ```
 
2. 判断：Rust 用异常来处理错误。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不用。Rust 用 ` Result `/` Option ` 作为返回值显式表达；` panic! ` 只用于不可恢复情形。"}
   ```
 
3. 诊断：` let s: i32 = "abc".parse().unwrap(); ` 运行时发生什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"解析失败 → ` unwrap() ` 触发 panic → 程序崩溃。应改用 ` match `/` ? `/` unwrap_or ` 处理。"}
   ```
 
4. 动手：把 ` parse_int ` 的返回值用于 ` main `（让 main 返回 ` Result `），体验 ` ? ` 一路向上传。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` fn main() -> Result<(), Box<dyn Error>> { let n = parse_int(\"42\")?; ...; Ok(()) } `——错误可一路传到进程出口。"}
   ```
 
5. 判断：` Vec ` 的 ` [] ` 会做边界检查，越界必然 panic。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。` v[i] ` 越界会 panic（比 C 安全）。不想 panic 可用 ` v.get(i) `，返回 ` Option `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  写 ` fn parse_csv(line: &str) -> Result<Vec<i32>, ParseIntError> `：按逗号切分并解析每个数，用 ` ? ` 传播错误。

 

```zhizhan-assessment
{"id":"course-b03a-m06","criterion":"处理集合空值与解析错误；用 ? 传播并保留上下文。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
