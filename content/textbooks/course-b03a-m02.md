# 所有权与移动

```zhizhan-anchor
m02
```



这是 Rust 最核心、也最独特的概念： **每个值只有一个所有者** 。交出去叫"移动"，之后原变量就不能再用。 它一次消灭了"忘记释放 / 重复释放 / 释放后使用"一整类 bug。

 

> ◷ 约 65 分钟 · ◈ move · Copy · Clone · Drop · ⚑ Rust 的地基

 

```zhizhan-anchor
m02-1
```



## 2.1 移动：交出去就不能再用

 

m02\_ownership.rs — 移动/Copy/Clone（可运行） Rust

 

```text
#[derive(Clone)]
struct Buf { data: [u8; 4] }

fn consume(b: Buf) {                 // 取得所有权
    println!("consume 拿到 Buf, data[0] = {}", b.data[0]);
}

fn main() {
    let a = Buf { data: [1, 2, 3, 4] };
    consume(a);                      // a 被移动进 consume
    // println!("{}", a.data[0]);    // 取消注释会编译错误：a 已被移动

    let x = 5;                       // i32 是 Copy：赋值/传参是复制
    let y = x;
    println!("x = {}, y = {} (Copy: x 仍可用)", x, y);

    let s = String::from("hi");
    let t = s.clone();               // 需要复制堆数据时显式 clone
    println!("s = {}, t = {}", s, t);
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M02）

 

```text
$ rustc --edition 2021 -O m02_ownership.rs -o m02 && ./m02
consume 拿到 Buf, data[0] = 1
x = 5, y = 5 (Copy: x 仍可用)
s = hi, t = hi
```

 

**FIG 2.1**  移动：[所有权](term:ownership)像"接力棒"，同一时刻只有一个所有者

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="所有权移动">
          <rect x="40" y="52" width="140" height="46" rx="6" class="sv-box"></rect>
          <text x="110" y="72" class="sv-lbl-hi" text-anchor="middle">let a = Buf{…}</text>
          <text x="110" y="89" class="sv-lbl-dim" text-anchor="middle">a 拥有数据</text>
          <path d="M180 75 L300 75" class="sv-arrow"></path>
          <text x="240" y="67" class="sv-lbl-dim" text-anchor="middle">consume(a) 移动</text>
          <rect x="302" y="52" width="150" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="377" y="72" class="sv-lbl-hi" text-anchor="middle">参数 b</text>
          <text x="377" y="89" class="sv-lbl-dim" text-anchor="middle">现在是唯一所有者</text>
          <text x="470" y="72" class="sv-lbl-dim" style="fill:var(--red)">a 此后不可用</text>
          <text x="470" y="92" class="sv-lbl-dim">（编译期检查）</text>
          <text x="40" y="128" class="sv-lbl-dim">函数结束 → b 离开作用域 → 自动释放。不会有人"忘了 free"。</text>
        </svg>
```

 

C 里 ` consume(a) ` 按值传会 **拷贝** ，两个都能用；Rust 是 **移动** ，交出去后原变量失效——释放责任随所有权转移，不可能重复释放。

 

```zhizhan-anchor
m02-2
```



## 2.2 Copy：哪些类型"赋值=c 复制"

 

内建标量（整数、浮点、` bool `、` char `）和共享引用 ` &T ` 是 ` Copy `；它们的赋值/传参是 **按位复制** ，原变量仍可用（像 C）。 **注意：` Copy ` 是"显式选择加入"的枚举/结构体——即使所有字段都是 ` Copy `，只要不写 ` #[derive(Copy, Clone)] `（或手写 ` impl Copy `），它就 **不是**  ` Copy `，赋值默认仍是移动。** （本例的 ` Buf ` 正是如此：` [u8; 4] ` 是 Copy，但 ` Buf ` 没 derive，所以 ` consume(a) ` 会移动。）而 ` String `/` Vec ` 这类 **拥有堆内存** 的类型天生 **不能 Copy** ，只能是移动或显式 clone。

 

| 类型 | Copy？ | 赋值时 |
| --- | --- | --- |
| ` i32 `/` f64 `/` bool `/` char ` | 是 | 复制，原变量仍可用 |
| ` String `/` Vec<T> `/` HashMap ` | 否 | 移动（或显式 ` .clone() `） |
| 含非 Copy 成员的结构体 | 否 | 移动 |

 

⚠ 全量 clone 常常是"用错"的信号

 

到处 ` .clone() ` 能让代码编过，但可能付出不必要的复制（尤其大对象/嵌入式）。更好的做法往往是 **传引用** （下一节 M03）。

 

```zhizhan-anchor
m02-3
```



## 2.3 Drop：离开作用域自动清理

 

值离开作用域时，Rust 自动调用它的 ` Drop `（析构）——` String ` 释放堆、文件句柄关闭、锁释放。 这就是 Rust 版的 RAII： **你不用写 free，也不会忘** 。

 

```zhizhan-anchor
m02-4
```



## 02.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 赋值 | 拷贝指针 | move（转移所有权） |
| 释放 | 手工 free | 作用域结束 Drop |
| 浅拷贝 | 易双重释放 | 编译期禁止 |
| 简单类型 | 同 | Copy（按位复制） |

 

**FIG 2.2**  move 之后原绑定失效

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="所有权只在一个地方">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">let a</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">let b = a</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">用 a → 报错</text>

        </svg>
```

 

转移所有权，杜绝双重释放。

 

**FIG 2.3**  Drop 在作用域结束时运行

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="离开作用域自动清理">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">进入作用域</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">使用</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-red-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">离开 → Drop</text>

        </svg>
```

 

资源清理自动发生。

 

```zhizhan-anchor
m02-5
```



## 02.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| move 后继续用原值 | borrow of moved value | 用克隆或改结构 |
| 循环里 move 出去 | use of moved value | 用引用 ` & ` |
| 实现 Copy 又实现 Drop | 编译错 | 二者不可兼得 |

 

```zhizhan-anchor
m02-6
```



## 02.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m02b.rs Rust

 

```text
fn main() {
    let a = String::from("hi");
    let b = a;              // move
    println!("{}", b);
    // println!("{}", a);   // 取消注释会报错
}
```

 

m02c.rs Rust

 

```text
fn main() {
    let x = 5;
    let y = x;              // i32 是 Copy
    println!("{} {}", x, y);
}
```

 

◆ 迁移练习

 

把一段 C 里"两个指针指向同一块堆内存导致双重释放"的代码改写成 Rust，观察编译期如何拦住。

 

◆ 本章要点

 

 
- 每个值只有一个所有者；交出去（move）后原变量失效。
 
- 移动让"释放责任"随所有权转移，天然杜绝重复释放/释放后使用。
 
- ` Copy ` 类型（整数等）赋值是复制；` String `/` Vec ` 默认移动。
 
- 需要复制堆数据时显式 ` .clone() `；能用引用就别 clone。
 
- 离开作用域自动 ` Drop `（析构），无需手写 free。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 判断：` let s2 = s1; `（s1 是 String）之后 s1 还能用。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。` String ` 非 Copy，这行把 s1  **移动** 进了 s2，s1 失效。要保留就 ` s1.clone() `。"}
   ```
 
2. 简答：为什么 Rust 不需要手写 free？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"值离开作用域自动调用 ` Drop `（析构）；且所有权唯一，不会重复释放。"}
   ```
 
3. 诊断：函数返回后用 ` a.data[0] ` 报"use of moved value"，怎么修？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"改成把引用传进去（` fn consume(b: &Buf) `），这样不夺走所有权，a 仍可用。"}
   ```
 
4. 动手：把 ` consume(a) ` 改成 ` consume(a.clone()) `，再取消注释打印 ` a.data[0] `，体会 clone 的代价与用途。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"clone 复制了一份数据交给函数，a 仍可用——能编过，但多了一次拷贝（对大的缓冲要谨慎）。"}
   ```
 
5. 判断：` Copy ` 是给"能安全按位复制"的类型打的标记。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。整数/浮点等纯值类型是 Copy，赋值即复制；拥有堆资源的类型不能 Copy（否则会双重释放）。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  写一个函数按值接收 ` Vec<i32> `，另写一个按引用接收；分别调用，观察哪个会让原变量失效。

 

```zhizhan-assessment
{"id":"course-b03a-m02","criterion":"区分 move/Copy/clone，解释移动后旧变量为何不可再用。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
