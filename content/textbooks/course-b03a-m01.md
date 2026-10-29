# 从 C 到 Rust：第一印象

```zhizhan-anchor
m01
```



Rust 与 C 一样贴近硬件，但把"内存安全"做进了编译器。这一节先建立第一印象：怎么编译运行、变量默认不可变、 类型推断、以及用 ` println! ` 输出。

 

> ◷ 约 55 分钟 · ◈ rustc · let/mut · println! · ⚑ 默认安全

 

```zhizhan-anchor
m01-1
```



## 1.1 第一个 Rust 程序

 

m01\_hello.rs — 变量与输出（可运行） Rust

 

```text
fn main() {
    let name = "Rust";          // 不可变绑定
    let mut n = 0;              // 可变绑定
    n += 1;
    let pi = 3.14;              // 类型由字面量推断为 f64
    println!("Hello, {}!", name);
    println!("n = {}, pi = {}", n, pi);
    let sum: i32 = (1..=5).sum();   // 1+2+3+4+5
    println!("sum 1..=5 = {}", sum);
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M01）

 

```text
$ rustc --edition 2021 -O m01_hello.rs -o m01 && ./m01
Hello, Rust!
n = 1, pi = 3.14
sum 1..=5 = 15
```

 

◆ 三个与 C 不同的小地方

 

 
- ` let ` 默认 **不可变** ；要改必须写 ` let mut `。忘了 ` mut ` 会编译错误——这是把"意外修改"挡在编译期。
 
- **类型推断** ：多数时候不用写类型（` let pi = 3.14 `），必要时才标注（` sum: i32 `）。
 
- ` println! ` 是 **宏** （带 ` ! `），占位符是 ` {} `，按顺序取参数。

 

```zhizhan-anchor
m01-2
```



## 1.2 与 C 的对照

 

| 想做的事 | C | Rust |
| --- | --- | --- |
| 输出 | ` printf("%d\n", x) ` | ` println!("{}", x) ` |
| 变量 | ` int x = 5; `（可改） | ` let x = 5; `（不可改）/ ` let mut x = 5; ` |
| 编译 | ` gcc ` | ` rustc `（或用 ` cargo `） |
| 入口 | ` int main(void) ` | ` fn main() ` |
| 字符串 | ` char* / char[] ` | ` &str `（字面量）/` String `（可增长） |

 

✔ 两个编译命令

 

单文件：` rustc m.rs -o m && ./m `。真实工程用  **Cargo** ：` cargo new proj `、` cargo run `（M08 详讲）。

 

```zhizhan-anchor
m01-3
```



## 1.3 为什么变量默认不可变

 

C 里几乎所有变量都可写，所以"谁在什么时候改了它"很难查。Rust 默认不可变： **要改，就得显式声明 ` mut `** —— 这让"可变性"在代码里一目了然，也帮助编译器做更多推导。

 

```zhizhan-anchor
m01-4
```



## 01.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 输出 | ` printf ` | ` println! ` |
| 引入 | ` #include ` | ` use ` |
| 可变变量 | 默认可变 | ` let mut ` 才是可变 |
| 编译 | ` gcc ` | ` rustc ` / ` cargo ` |

 

**FIG 1.2**  rustc 编译 → 运行

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="源文件经 rustc 生成可执行文件">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-box"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">main.rs</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">rustc</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">可执行</text>

        </svg>
```

 

` cargo run ` 是更常用的方式。

 

**FIG 1.3**  默认不可变

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="不加 mut，值不能被改">
          <rect x="20" y="50" width="140" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="90" y="78" class="sv-lbl-hi" text-anchor="middle">let x = 1</text>
          <path d="M160 73 L170 73" class="sv-arrow"></path>
          <rect x="180" y="50" width="140" height="46" rx="6" class="sv-red-s"></rect>
          <text x="250" y="78" class="sv-lbl-hi" text-anchor="middle">x = 2 → 报错</text>
          <path d="M320 73 L330 73" class="sv-arrow"></path>
          <rect x="340" y="50" width="140" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="410" y="78" class="sv-lbl-hi" text-anchor="middle">let mut x</text>
          <path d="M480 73 L490 73" class="sv-arrow"></path>
          <rect x="500" y="50" width="140" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="570" y="78" class="sv-lbl-hi" text-anchor="middle">x = 2 可以</text>

        </svg>
```

 

不可变是默认，安全从变量开始。

 

```zhizhan-anchor
m01-5
```



## 01.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| 忘了 ` mut ` | cannot assign twice to immutable | 加 ` mut ` |
| ` println! ` 少了感叹号 | 宏没被调用 | 补 ` ! ` |
| 格式化占位写错 | 编译错 | ` {} ` 对应参数 |

 

```zhizhan-anchor
m01-6
```



## 01.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m01b.rs Rust

 

```text
fn main() {
    let name = "embedded";
    println!("Hello, {}!", name);
}
```

 

m01c.rs Rust

 

```text
fn main() {
    let mut n = 0;
    n += 1;
    println!("n = {}", n);
}
```

 

◆ 迁移练习

 

用 Rust 写一个"读入两个整数打印和"的程序（可用 ` let ` 直接赋值），体会 ` mut ` 的必要。

 

◆ 本章要点

 

 
- ` fn main() ` 是入口；` rustc ` 编译，` cargo ` 管工程。
 
- ` let ` 默认不可变，` let mut ` 才可改。
 
- 类型常可推断，必要时用 ` : i32 ` 标注。
 
- ` println!("{}", x) ` 是宏，占位符 ` {} `。
 
- 范围 ` 1..=5 ` 可配合迭代器方法（如 ` .sum() `）。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 填空：Rust 里让变量可修改要写 ` let ______ x = 5; `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` mut `。"}
   ```
 
2. 判断：` let x = 5; x = 6; ` 能编过。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。` x ` 不可变，二次赋值是编译错误。要么 ` let mut x = 5; `，要么用 ` let x = 6; ` 遮蔽（shadowing）。"}
   ```
 
3. 诊断：` println!("{}", x) ` 报"cannot find value x"，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"没有声明 ` x `（没写 ` let x = ... `），或写在了别的作用域。Rust 不允许使用未声明的变量。"}
   ```
 
4. 动手：把 ` m01_hello.rs ` 里 ` pi ` 改成整数 ` 3 ` 再打印，观察类型推断（会不会报错？为什么）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会报错：` 3 ` 被推断为整数类型（如 i32），` {} ` 也能打印整数——推断随字面量走。"}
   ```
 
5. 判断：Rust 的 ` fn main ` 必须返回 ` int ` 0 表示成功。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对。` fn main() ` 默认返回 ` () `（空）；要返回错误码可写 ` fn main() -> Result<(), E> `。这与 C 的 ` return 0 ` 不同。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  用 rustc 编译并运行 ` m01_hello.rs `，再故意去掉一个 ` mut ` 看编译器怎么报错。

 

```zhizhan-assessment
{"id":"course-b03a-m01","criterion":"cargo new/build/run 完成最小程序；从编译错误定位变量不可变等约束。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
