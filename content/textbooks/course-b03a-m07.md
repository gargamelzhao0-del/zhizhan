# 生命周期与迭代器

```zhizhan-anchor
m07
```



**生命周期** 确保引用不会悬垂； **闭包** 与 **迭代器** 则让"处理一串数据"既简洁又高效。 这三样是写出地道 Rust 代码的关键。

 

> ◷ 约 60 分钟 · ◈ 'a · 闭包 · iterator · ⚑ 零成本抽象

 

```zhizhan-anchor
m07-1
```



## 7.1 生命周期标注：让引用不悬垂

 

m07\_iterators.rs — 生命周期 \+ 闭包 \+ 迭代器（可运行） Rust

 

```text
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {   // 生命周期标注
    if a.len() >= b.len() { a } else { b }
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    let evens_sq: Vec<i32> = nums.iter()
        .filter(|&&x| x % 2 == 0)      // 闭包捕获
        .map(|&x| x * x)
        .collect();
    println!("evens squared = {:?}", evens_sq);

    let add = |a, b| a + b;            // 闭包
    println!("add(2,3) = {}", add(2, 3));

    println!("longest = {}", longest("hello", "hi"));
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M07）

 

```text
$ rustc --edition 2021 -O m07_iterators.rs -o m07 && ./m07
evens squared = [4, 16, 36]
add(2,3) = 5
longest = hello
```

 

◆ ` 'a ` 是什么

 

` longest<'a>(a: &'a str, b: &'a str) -> &'a str ` 的意思是："返回值至少不超出 ` a `、` b ` 中 **较短者** 的存活范围"（编译器取两者生命周期的交集）。 编译器据此保证调用方拿到的引用 **不会指向已经释放的数据** ——正是 C 里悬垂指针的解药。很多情况下生命周期能自动推导，不必手写。

 

```zhizhan-anchor
m07-2
```



## 7.2 闭包与迭代器：链式处理数据

 

iter\_chain.rs — 一眼看懂流水线 Rust

 

```text
// 迭代器 = "取数据"的流水线：惰性、可组合、通常编译成与手写循环相同的代码
fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    let evens_sq: Vec<i32> = nums.iter()
        .filter(|&&x| x % 2 == 0)   // 只留偶数
        .map(|&x| x * x)            // 平方
        .collect();                 // 收集成 Vec
    println!("evens squared = {:?}", evens_sq);
}
```

 

| 迭代器方法 | 作用 |
| --- | --- |
| ` .iter() ` | 遍历（借用元素） |
| ` .filter(pred) ` | 只保留满足条件的元素 |
| ` .map(f) ` | 把每个元素变换成新值 |
| ` .collect() ` | 把结果收集成集合（Vec 等） |
| ` .sum() / .count() ` | 求和 / 计数 |

 

✔ 迭代器是"零成本"的

 

上面的链式写法和手写 ` for ` 循环编译后性能相当（编译期把闭包内联、消除中间数组）。  **可读性更好、性能不打折** ——这正是 Rust"零成本抽象"的体现。

 

```zhizhan-anchor
m07-4
```



## 07.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 回调 | 函数指针 | 闭包 |
| 遍历 | 循环 | 迭代器链 |
| 借用范围 | 靠人 | 生命周期标注 |
| 组合 | 手写循环 | map/filter/collect |

 

**FIG 7.2**  生命周期保证引用不悬垂

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="标的借用不能超过被引用数据">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">数据</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">借用</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">不超出范围</text>

        </svg>
```

 

编译器保证引用有效。

 

**FIG 7.3**  迭代器链

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="逐步变换，惰性、可读">
          <rect x="20" y="50" width="140" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="90" y="78" class="sv-lbl-hi" text-anchor="middle">iter</text>
          <path d="M160 73 L170 73" class="sv-arrow"></path>
          <rect x="180" y="50" width="140" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="250" y="78" class="sv-lbl-hi" text-anchor="middle">map</text>
          <path d="M320 73 L330 73" class="sv-arrow"></path>
          <rect x="340" y="50" width="140" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="410" y="78" class="sv-lbl-hi" text-anchor="middle">filter</text>
          <path d="M480 73 L490 73" class="sv-arrow"></path>
          <rect x="500" y="50" width="140" height="46" rx="6" class="sv-box"></rect>
          <text x="570" y="78" class="sv-lbl-hi" text-anchor="middle">collect</text>

        </svg>
```

 

链式表达数据处理。

 

```zhizhan-anchor
m07-5
```



## 07.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| 闭包借用了会被移动的值 | borrow/move error | 用 move 闭包 |
| 返回引用缺生命周期 | missing lifetime specifier | 加 ` <'a> ` |
| 迭代器用了没消费 | unused 警告 | collect/for 消费 |

 

```zhizhan-anchor
m07-6
```



## 07.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m07b.rs Rust

 

```text
fn main() {
    let v = vec![1, 2, 3, 4, 5];
    let evens: Vec<i32> = v.iter().filter(|x| *x % 2 == 0).copied().collect();
    println!("{:?}", evens);
}
```

 

m07c.rs Rust

 

```text
fn main() {
    let add = |a: i32, b: i32| a + b;
    println!("{}", add(2, 3));
}
```

 

◆ 迁移练习

 

用迭代器链把一组数过滤出正数、平方、求和；再写一个闭包作为排序比较器。

 

◆ 本章要点

 

 
- 生命周期 ` 'a ` 标注"引用能活多久"，保证不悬垂；多数能自动推导。
 
- 闭包可 **捕获环境变量** （示例的 ` |a, b| a + b ` 没捕获，只是演示语法）；常配合迭代器。
 
- 迭代器可链式：` filter → map → collect `。
 
- 迭代器是零成本抽象，可读性与性能兼得。
 
- 这些机制在嵌入式里同样适用（第②册 B03 会用它们处理缓冲/数据）。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 简答：生命周期标注解决了什么问题？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"保证引用 **不会比它引用的数据活得久** ，即杜绝悬垂引用/悬垂指针。"}
   ```
 
2. 判断：` v.iter().map(...) ` 会立刻生成一个新数组。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。迭代器是 **惰性** 的：直到 ` collect() `（或消费方法）才真正计算。"}
   ```
 
3. 诊断：闭包里修改了外部变量，编译器报"cannot borrow as mutable"，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"闭包捕获方式的规则：需要修改外部变量时，闭包要声明为 ` FnMut `（并让被捕获变量 ` mut `、闭包本身 ` mut `）。这与借用规则一致。"}
   ```
 
4. 动手：把 ` evens_sq ` 的计算改成"先 filter 奇数、再 sum"，比较链式与手写循环的可读性。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"链式表达意图更直接；性能相当。日常优先用迭代器链。"}
   ```
 
5. 判断：生命周期标注会带来运行期开销。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。它只在编译期用于检查，运行期没有任何影响。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  写一个函数返回切片中最长的字符串（用生命周期标注），再用迭代器求一串数的平方和。

 

```zhizhan-assessment
{"id":"course-b03a-m07","criterion":"说明返回借用来自哪个输入，避免为通过编译滥加 static。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
