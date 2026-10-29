# 借用与引用

```zhizhan-anchor
m03
```



总把值"移动"给函数太麻烦。更好的做法是 **借用** ：把引用传进去，函数用一下、不夺走[所有权](term:ownership)。 规则很简单：同一时刻 **要么多个只读、要么一个可写** 。

 

> ◷ 约 60 分钟 · ◈ &/&mut · 借用规则 · ⚑ 编译期防别名

 

```zhizhan-anchor
m03-1
```



## 3.1 共享借用与可变借用

 

m03\_borrow.rs — & 与 &mut（可运行） Rust

 

```text
fn len(xs: &[i32]) -> usize { xs.len() }      // 共享借用（只读）

fn double_all(xs: &mut [i32]) {               // 可变借用（可写）
    for v in xs.iter_mut() { *v *= 2; }
}

fn main() {
    let mut data = vec![1, 2, 3];
    double_all(&mut data);                     // 独占可变借用
    println!("doubled = {:?}, len = {}", data, len(&data));  // 之后才共享借用
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M03）

 

```text
$ rustc --edition 2021 -O m03_borrow.rs -o m03 && ./m03
doubled = [2, 4, 6], len = 3
```

 

◆ 借用规则（背下来）

 

 
- 任意时刻：要么 **多个 ` &T `** （只读），要么 **恰好一个 ` &mut T `** （可写）—— **共享 XOR 独占** 。
 
- 借用不能比它借用的数据活得久（生命周期，M07）。
 
- ` &mut ` 用完（最后一次使用）之后，才能开始新的借用——这就是上面"先可变、后共享"能编过的原因。

 

```zhizhan-anchor
m03-2
```



## 3.2 借用检查器拦住了什么

 

borrow\_fail.rs — 反面：同一时刻两个可变借用 Rust

 

```text
// 反面：同时存在两个可变借用 —— 编译错误
fn bad() {
    let mut v = vec![1, 2, 3];
    let r1 = &mut v;
    let r2 = &mut v;      // 错误：cannot borrow `v` as mutable more than once
    r1.push(4);
    r2.push(5);
}
```

 

⚠ 这条规则消灭了"数据竞争"

 

数据竞争的前提是"同时有共享访问和写"。"共享 XOR 独占"让这种局面 **根本编译不过** ——所以 Rust 敢说"无数据竞争"。 在嵌入式里，这也正是"ISR 与主循环同改一个变量"的根本防线（第②册 B03 会接着讲）。

 

```zhizhan-anchor
m03-3
```



## 3.3 什么时候用引用、什么时候用值

 

| 函数需要 | 参数写法 |
| --- | --- |
| 只读地看一眼 | ` fn f(x: &T) ` |
| 修改调用方的值 | ` fn f(x: &mut T) ` |
| 占有它（用完就归函数） | ` fn f(x: T) `（移动） |

 

✔ 好习惯

 

默认先用 ` &T `（只读借用），需要改才升级到 ` &mut T `，确实要"交出去"才用值。 **能借用就别移动、能移动就别克隆。**

 

```zhizhan-anchor
m03-4
```



## 03.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 间接访问 | 指针 | 引用 ` & ` |
| 可写 | 任意 | ` &mut ` 且唯一 |
| 别名 | 可多个裸指针 | 共享可多、可变必须唯一 |
| 悬垂 | 运行期出错 | 编译期禁止 |

 

**FIG 3.2**  共享借用 vs 独占借用

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="多个只读可以，同时只能一个可写">
          <rect x="20" y="50" width="290" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="165" y="78" class="sv-lbl-hi" text-anchor="middle">多个 &amp;</text>
          <path d="M310 73 L320 73" class="sv-arrow"></path>
          <rect x="330" y="50" width="290" height="46" rx="6" class="sv-red-s"></rect>
          <text x="475" y="78" class="sv-lbl-hi" text-anchor="middle">一个 &amp;mut</text>

        </svg>
```

 

二者不能同时存在。

 

**FIG 3.3**  借用的作用域

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="借用活到不再使用为止">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">借用开始</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">使用</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">借用结束</text>

        </svg>
```

 

NLL 会尽量缩短借用。

 

```zhizhan-anchor
m03-5
```



## 03.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| 同时两个 ` &mut ` | cannot borrow as mutable more than once | 缩小作用域 |
| 借用期间移动 | borrow later used here | 先结束借用 |
| 返回局部引用 | missing lifetime | 返回值或加生命周期 |

 

```zhizhan-anchor
m03-6
```



## 03.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m03b.rs Rust

 

```text
fn main() {
    let mut v = vec![1, 2, 3];
    let r = &v;            // 共享借用
    println!("{:?}", r);
    v.push(4);               // 借用已结束，可改
}
```

 

m03c.rs Rust

 

```text
fn sum(xs: &[i32]) -> i32 {
    let mut s = 0;
    for x in xs { s += *x; }
    s
}
fn main() { println!("{}", sum(&[1, 2, 3])); }
```

 

◆ 迁移练习

 

写一个函数接受 ` &[i32] ` 求平均，再写一个接受 ` &mut Vec ` 做排序，体会共享与独占借用。

 

◆ 本章要点

 

 
- 借用 = 传引用；不夺走所有权。
 
- 规则：` &T ` 可多个（只读），` &mut T ` 同时只能一个（可写）。
 
- 违反规则是 **编译错误** ，因此从源头杜绝数据竞争。
 
- 先可变借用、用完再共享借用，是合法且常见的模式。
 
- 参数选择：只读 ` &T ` / 修改 ` &mut T ` / 占有 ` T `。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 填空：同一时刻，要么多个 ` &T `，要么一个 ` ______ `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` &mut T `（可变借用）。"}
   ```
 
2. 判断：把 ` Vec ` 传给 ` fn f(x: &Vec<i32>) ` 后，原 Vec 就失效了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。传的是 **引用** （借用），所有权没转移，原 Vec 仍可用。"}
   ```
 
3. 诊断：遍历 ` v ` 的同时想 ` v.push(...) `，为什么报错？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"遍历持有对 ` v ` 的借用，此时再可变借用 ` v ` 违反\"共享 XOR 独占\"（且会导致迭代器失效）。应先收集再改，或用索引。"}
   ```
 
4. 动手：写 ` fn sum(xs: &[i32]) -> i32 ` 与 ` fn zero(xs: &mut [i32]) `，各自调用一次 ` data `，看编译器是否允许（先后顺序）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"两种顺序都能编过。关键在于 **两次借用的\"活跃区间\"是否重叠** （Rust 用非词法生命周期 NLL 判断，而非\"哪种借用写在前面\"）：` sum(&data) ` 返回的是 ` i32 `（值，不含引用），这次共享借用在调用后就结束了，随后 ` zero(&mut data) ` 不与之重叠 —— 先共享后可变同样合法。只有当共享引用 **被继续使用** 、与可变借用重叠时才会报错。"}
   ```
 
5. 判断：借用检查是运行期检查，会拖慢程序。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。借用检查全在 **编译期** 完成，运行期零开销。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  把一个"按值接收 Vec"的函数改成"按引用接收"，确认原变量不再失效。

 

```zhizhan-assessment
{"id":"course-b03a-m03","criterion":"给共享/独占借用做成功和 compile_fail 对照，不靠原始指针绕过冲突。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
