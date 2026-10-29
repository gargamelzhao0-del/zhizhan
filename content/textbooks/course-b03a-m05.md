# 结构体、方法与 trait

```zhizhan-anchor
m05
```



` struct ` 把数据组合起来，` impl ` 给它加方法，` trait ` 定义"能力接口"。 三者合起来，就是 Rust 的"面向对象"——但它没有继承，用 trait 组合代替。

 

> ◷ 约 70 分钟 · ◈ struct · impl · trait · derive · ⚑ 组合优于继承

 

```zhizhan-anchor
m05-1
```



## 5.1 结构体 \+ 方法 \+ trait

 

m05\_traits.rs — trait 与泛型约束（可运行） Rust

 

```text
trait Area { fn area(&self) -> f64; }           // 定义接口

#[derive(Debug)]
struct Rect { w: f64, h: f64 }
impl Area for Rect {                             // 实现 trait
    fn area(&self) -> f64 { self.w * self.h }
}
impl Rect {                                      // 普通方法
    fn new(w: f64, h: f64) -> Self { Rect { w, h } }
}

fn print_area<T: Area>(x: &T) { println!("area = {:.2}", x.area()); }   // 泛型 + trait 约束

fn main() {
    let r = Rect::new(3.0, 4.0);
    println!("{:?}", r);                         // #[derive(Debug)] 支持 {:?}
    print_area(&r);
}
```

 

**bash**  — 复跑：` bash tools/probes/run-all.sh `（M05）

 

```text
$ rustc --edition 2021 -O m05_traits.rs -o m05 && ./m05
Rect { w: 3.0, h: 4.0 }
area = 12.00
```

 

◆ 三个关键字

 

 
- ` struct `：定义数据字段。
 
- ` impl `：给类型加方法（` impl Type {} `）或实现接口（` impl Trait for Type {} `）。
 
- ` trait `：一组方法签名，作为"具备某能力"的接口；可用作泛型约束 ` <T: Area> `。

 

```zhizhan-anchor
m05-2
```



## 5.2 ` #[derive] `：自动生成常用实现

 

| derive | 给你什么 |
| --- | --- |
| ` #[derive(Debug)] ` | 能用 ` {:?} ` 打印，便于调试 |
| ` #[derive(Clone)] ` | 能用 ` .clone() ` |
| ` #[derive(Copy, Clone)] ` | 变成"按位复制"的类型（` Copy ` 是 ` Clone ` 的子 trait，所以两个都要写） |
| ` #[derive(PartialEq)] ` | 能用 ` == ` 比较 |

 

✔ Rust 没有"继承"，用 trait 组合

 

C\+\+ 用继承复用/多态；Rust 用  **trait \+ 泛型** （静态）或  **trait 对象 ` &dyn Trait `** （动态）。 这避免了继承的很多坑（脆弱基类、多重继承）。第②册 B03 会用 trait 表达"什么是显示器/输出引脚"这类硬件能力。

 

```zhizhan-anchor
m05-4
```



## 05.4 与 C 的对照速查

 

| 维度 | C 的做法 | Rust 的做法 |
| --- | --- | --- |
| 数据\+操作 | 结构体\+函数 | 结构体 \+ impl |
| 接口 | 函数指针 | trait |
| 自动实现 | 手写 | ` #[derive] ` |
| 泛型约束 | 宏 | trait bound |

 

**FIG 5.2**  struct \+ impl 打包数据与方法

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="方法定义在 impl 块里">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">struct</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">impl</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">方法</text>

        </svg>
```

 

不像 C 那样函数散落各处。

 

**FIG 5.3**  trait 是行为契约

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="谁实现 trait，谁就能提供该行为">
          <rect x="20" y="50" width="190" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="115" y="78" class="sv-lbl-hi" text-anchor="middle">trait Speak</text>
          <path d="M210 73 L220 73" class="sv-arrow"></path>
          <rect x="230" y="50" width="190" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="325" y="78" class="sv-lbl-hi" text-anchor="middle">impl for Dog</text>
          <path d="M420 73 L430 73" class="sv-arrow"></path>
          <rect x="440" y="50" width="190" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="535" y="78" class="sv-lbl-hi" text-anchor="middle">impl for Cat</text>

        </svg>
```

 

像接口，但可静态分派。

 

```zhizhan-anchor
m05-5
```



## 05.5 常见错误与修复

 

| 错误 | Rust 报什么 | 修复 |
| --- | --- | --- |
| 忘了 ` #[derive(Debug)] ` | {:?} 报错 | 补 derive |
| trait 方法签名不符 | does not match trait | 对齐签名 |
| ` impl ` 放在别处 | 找不到方法 | impl 与被实现类型同 crate |

 

```zhizhan-anchor
m05-6
```



## 05.6 上手检查清单

 

| 检查项 | 确认 |
| --- | --- |
| 能编译 | ` cargo build ` |
| 无警告 | 处理每条 warning |
| 能跑 | ` cargo run ` |

 

m05b.rs Rust

 

```text
#[derive(Debug)]
struct Point { x: i32, y: i32 }

impl Point {
    fn sum(&self) -> i32 { self.x + self.y }
}

fn main() {
    let p = Point { x: 2, y: 3 };
    println!("{}", p.sum());
}
```

 

m05c.rs Rust

 

```text
trait Speak { fn say(&self) -> &'static str; }
struct Dog;
impl Speak for Dog { fn say(&self) -> &'static str { "woof" } }

fn main() { println!("{}", Dog.say()); }
```

 

◆ 迁移练习

 

给一个 ` Sensor ` 结构体加方法（读取/换算），并为一个 ` Readable ` trait 实现它。

 

◆ 本章要点

 

 
- ` struct ` 组合数据，` impl ` 加方法。
 
- ` trait ` 定义能力接口；可用作泛型约束 ` <T: Trait> `。
 
- ` #[derive(Debug/Clone/Copy/PartialEq)] ` 自动生成常用实现。
 
- Rust 没有继承，用 trait 组合实现多态。
 
- 方法的第一个参数是 ` &self `（只读）/` &mut self `（可写）/` self `（取走）。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 填空：给 ` Rect ` 实现 ` Area ` 接口，写 ` impl ______ for Rect `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` Area `（trait 名）：` impl Area for Rect { ... } `。"}
   ```
 
2. 判断：Rust 有 ` class ` 继承机制。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"没有。Rust 用 ` struct `/` enum ` \\+ ` trait ` 组合替代继承，没有\"子类继承父类字段\"这套。"}
   ```
 
3. 诊断：` println!("{:?}", r) ` 报"doesn't implement Debug"，怎么办？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"给类型加 ` #[derive(Debug)] `（或手写 Debug 实现）。"}
   ```
 
4. 动手：给 ` Rect ` 加一个 ` fn scale(&mut self, k: f64) `（把宽高乘 k），并加 ` #[derive(Clone, Copy, Debug)] `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"注意 ` Copy ` 要求所有字段都是 Copy（f64 是），所以可行。方法用 ` &mut self ` 才能改自己。"}
   ```
 
5. 判断：` <T: Area> ` 里的 ` T ` 在编译期就确定了，调用 ` area() ` 是静态分派。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"对。泛型 \\+ trait 约束是 **编译期单态化** （零开销）；要运行期多态得用 ` &dyn Area `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  定义 ` trait Animal { fn sound(&self) -> String; } `，实现 ` Dog `/` Cat `，写泛型函数打印它们的叫声。

 

```zhizhan-assessment
{"id":"course-b03a-m05","criterion":"实现一个 trait 的两个后端，调用者不依赖具体实现。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust 官方 Book](https://doc.rust-lang.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03a-guide)
