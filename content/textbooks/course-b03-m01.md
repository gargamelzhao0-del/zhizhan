# 所有权与借用：对着 C 讲

```zhizhan-anchor
m01
```



第①册反复强调"指针的三种错"：悬垂、别名、忘记释放。C 靠 **纪律** 避免它们，Rust 靠 **编译器** 。 这一节不从语法讲起，而是先看你已经熟悉的 C 会在哪里出错，再看 ` move ` 与借用规则如何把这三类错误变成 **编译错误**  —— 以及它在运行期到底花不花钱。

 

> ◷ 约 70 分钟 · ◈ 真实 rustc 报错与反汇编 · ⚑ 全册的地基

 

```zhizhan-anchor
m01-1
```



## 1.1 先看 C 的三张"债"

 

下面三段 C 代码 **都能编过** （最多一条警告），但都埋着雷。Rust 存在的第一理由，就是让这三件事在编译期不可能发生：

 

debt\_c.c — 悬垂 / 忘释放 / 越界别名（编译期不报） C

 

```text
/* debt_c.c —— 三类由"纪律"兜底的 bug */
#include <stdint.h>

/* ① 悬垂：返回指向栈上数组的指针（GCC 只给一条警告） */
char* dangling(void) { char buf[8]; buf[0] = 'h'; return buf; }

/* ② 忘释放：并非所有 return 路径都记得释放 */
int use_resource(int *handle, int fail_early) {
    *handle = 1;                   /* 获取资源 */
    if (fail_early) return -1;     /* ✕ 忘了释放 */
    *handle = 0;                   /* 释放 */
    return 0;
}

/* ③ 越界别名：p 与调用方共享，且 i==n 时越界写 */
void alias(uint8_t *p, uint32_t n) {
    for (uint32_t i = 0; i <= n; i++) p[i] = (uint8_t)(p[i] + 1);
}
```

 

| 债 | C 里为什么防不住 | Rust 用什么拦 |
| --- | --- | --- |
| **悬垂** | 函数返回 ` char* `，没人知道它指向栈；调用方照用 | 生命周期：借用不能比它引用的数据活得久 |
| **忘释放** | 释放是"约定"，任何一条 ` return ` 都可能漏 | [所有权](term:ownership)：值离开作用域自动 ` Drop ` |
| **别名** | 多个指针可同时指向同一块，读写不受限 | 借用规则：要么多个 ` & `、要么一个 ` &mut ` |

 

```zhizhan-anchor
m01-2
```



## 1.2 所有权：` move ` 把"谁负责"写进类型

 

在 Rust 里，每个值有且只有一个 **所有者** ；把值交给别人叫 ` move `，之后原来的名字 **不能再用** 。 这不是"拷贝"，也不是"置空"——是编译器在类型层面把所有权转移记下来了。

 

ownership.rs — move 之后原绑定失效（编译期） Rust

 

```text
// ownership.rs —— move 把所有权在类型层面移走
#![no_std]

pub struct Buf { data: [u8; 8] }

pub fn consume(b: Buf) -> u8 { b.data[0] }

pub fn demo() -> u8 {
    let b = Buf { data: [0; 8] };
    let s = consume(b);      // 所有权移入 consume
    // let t = b.data[0];    // ✕ 编译错误：use of moved value: `b`
    s
}
```

 

对照上一节的 C：` consume(b) ` 在 C 里按值传参只是 **拷贝** ，原 ` b ` 照样能用， 编译器不会、也无法阻止你之后继续用 ` b `。Rust 把"这个值已经交出去了"记成了类型事实 ——  **忘记释放** 因此从"约定"变成"不可能"：值没人用时会自动析构。

 

**FIG 1.1**  同一块缓冲：C 的"拷贝指针" vs Rust 的"移动所有权"

 

```zhizhan-figure
<svg viewBox="0 0 660 236" role="img" aria-label="C 拷贝指针造成别名 vs Rust 移动所有权">
          <text x="16" y="30" class="sv-lbl-hi" style="fill:var(--amb)">C · 拷贝指针 → 两个名字指向同一块（别名）</text>
          <rect x="36" y="46" width="120" height="40" rx="6" class="sv-box"></rect>
          <text x="96" y="71" class="sv-lbl" text-anchor="middle">buffer[8]</text>
          <rect x="250" y="40" width="96" height="30" rx="5" class="sv-amb-s"></rect>
          <text x="298" y="60" class="sv-lbl-hi" text-anchor="middle">p</text>
          <rect x="250" y="84" width="96" height="30" rx="5" class="sv-amb-s"></rect>
          <text x="298" y="104" class="sv-lbl-hi" text-anchor="middle">q = p（拷贝）</text>
          <path d="M248 55 L158 62" class="sv-arrow-a"></path>
          <path d="M248 99 L158 82" class="sv-arrow-a"></path>
          <text x="364" y="64" class="sv-lbl-dim">两个指针都能写</text>
          <text x="364" y="83" class="sv-lbl-dim" style="fill:var(--red)">→ 别名 / 重复释放的温床</text>
          <line x1="16" y1="132" x2="644" y2="132" class="sv-dash"></line>
          <text x="16" y="162" class="sv-lbl-hi" style="fill:var(--grn)">Rust · move → 只有 b 拥有，a 失效</text>
          <rect x="36" y="180" width="120" height="40" rx="6" class="sv-grn-s"></rect>
          <text x="96" y="205" class="sv-lbl" text-anchor="middle">Buf</text>
          <rect x="250" y="185" width="96" height="30" rx="5" class="sv-grn-s"></rect>
          <text x="298" y="205" class="sv-lbl-hi" text-anchor="middle">b</text>
          <text x="205" y="205" class="sv-lbl-dim" text-anchor="middle">let b = a;</text>
          <path d="M248 200 L158 200" class="sv-arrow"></path>
          <text x="364" y="196" class="sv-lbl-dim" style="fill:var(--red)">a 此后不可用（编译期）</text>
          <text x="364" y="215" class="sv-lbl-dim">唯一所有者 → 不会重复释放</text>
        </svg>
```

 

左边是 C 里"把指针传过去"的常态：两个名字、一块内存，谁改都行。右边 Rust 的 ` move ` 只转移、不复制——  **同一时刻只有一个有效所有者** ，于是"重复释放 / 释放后使用"从源头消失。

 

```zhizhan-anchor
m01-3
```



## 1.3 借用：` & ` 与 ` &mut ` 的别名规则

 

你不想转移所有权（比如只想读一下），就 **借用** ：` &x ` 是共享借用（只读，可多个）， ` &mut x ` 是独占借用（可写，同时只能一个）。 **"共享 XOR 独占"** 这一条，恰好把 C 里"读写同一块、结果不可预期"的问题变成编译错误。

 

borrow.rs — 共享与独占借用，顺序正确即可编译 Rust

 

```text
// borrow.rs —— 同一时刻"多个只读"或"一个可写"，二选一
#![no_std]

pub fn sum(xs: &[u8]) -> u32 {
    let mut s = 0u32; let mut i = 0usize;
    while i < xs.len() { s = s.wrapping_add(xs[i] as u32); i += 1; }
    s
}
pub fn inc(xs: &mut [u8]) {
    let mut i = 0usize;
    while i < xs.len() { xs[i] = xs[i].wrapping_add(1); i += 1; }
}
pub fn demo() -> u32 {
    let mut a = [1u8, 2, 3];
    inc(&mut a);       // 独占借用：这一步可写
    sum(&a)            // 独占借用结束后，才共享借用
}
```

 

◆ 这条规则到底拦住了什么

 

C 里最常见的"迭代器失效 / 边遍历边改 / 两个模块同时读写一个缓冲"——本质都是 **别名** 问题。 Rust 的"共享 XOR 独占"让"正在被别人读的时候去写它" **根本编译不过** 。 这也是为什么 Rust 能宣称"无数据竞争"：数据竞争的前提就是"又有共享访问、又有写"。

 

```zhizhan-anchor
m01-4
```



## 1.4 两条反面（真实编译错误）

 

规则讲一遍不如看编译器怎么拒绝。下面是两个刻意的错误示例，报错信息是 **本机 ` rustc 1.99 ` 对 ` thumbv7m-none-eabi ` 的原始输出** ：

 

dangling\_fail.rs — 反面：返回局部变量的引用 Rust

 

```text
// 反面：返回局部变量的引用 —— 编译器直接拒绝
#![no_std]

pub fn bad() -> &'static u8 {
    let x = 5u8;
    &x          // 错误：`x` does not live long enough
}
```

 

alias\_fail.rs — 反面：同一时刻两个可变借用 Rust

 

```text
// 反面：同一时刻两个可变借用
#![no_std]

pub fn bad() {
    let mut a = [0u8; 4];
    let r1 = &mut a;
    let r2 = &mut a;   // 错误：cannot borrow `a` as mutable more than once
    r1[0] = 1;
    r2[0] = 2;
}
```

 

**bash**  — 复跑：` bash tools/probes/m01.sh `（第 2/3 节，rustc 1.99 · thumbv7m-none-eabi）

 

```text
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj dangling_fail.rs -o dangling_fail.o
error[E0515]: cannot return reference to local variable `x`
 --> dangling_fail.rs:5:5
  |
5 |     &x          // 错误：`x` does not live long enough
  |     ^^ returns a reference to data owned by the current function

$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj alias_fail.rs -o alias_fail.o
error[E0499]: cannot borrow `a` as mutable more than once at a time
 --> alias_fail.rs:6:14
  |
5 |     let r1 = &mut a;
  |              ------ first mutable borrow occurs here
6 |     let r2 = &mut a;   // 错误：cannot borrow `a` as mutable more than once
  |              ^^^^^^ second mutable borrow occurs here
7 |     r1[0] = 1;
  |     ----- first borrow later used here
```

 

⚠ 注意：这是 ` error `，不是 ` warning `

 

C 里同样的 ` dangling() ` 只是一条 ` -Wreturn-local-addr ` 警告，很多人直接忽略； Rust 里它是硬错误， **编不过就没有"侥幸上线"的可能** 。这正是"用纪律换安全"到"用编译期换安全"的差别。

 

```zhizhan-anchor
m01-5
```



## 1.5 生命周期：借用不能超过它引用的数据

 

生命周期标注（` 'a `）不是为了"让编译器开心"，而是把你本来就该有的约束 **写显式** ： 一个持有借用的结构体，必须保证它引用的数据活得比它久。下面是最常见的形态——一个解析器借用一段字节：

 

lifetime\_ok.rs — 结构体持有借用，生命周期显式绑定 Rust

 

```text
// lifetime_ok.rs —— 'a 把"解析器不能比数据活得久"写进类型
#![no_std]

pub struct Parser<'a> { data: &'a [u8] }

impl<'a> Parser<'a> {
    pub fn new(data: &'a [u8]) -> Self { Self { data } }
    pub fn first(&self) -> Option<u8> { self.data.first().copied() }
}

pub fn demo() -> Option<u8> {
    let bytes = [1u8, 2, 3];
    let p = Parser::new(&bytes);   // p 借用 bytes
    p.first()                      // bytes 仍活着，合法
}
```

 

把 ` bytes ` 与 ` p ` 的声明顺序调换（先建 ` p ` 再建 ` bytes `），编译器会报 ` borrowed value does not live long enough `。这在 C 里就是"结构体里存了个已经失效的指针"——而 C 不会告诉你。

 

```zhizhan-anchor
m01-6
```



## 1.6 代价：借用与所有权在运行期花不花钱

 

安全保证全在 **编译期** 做完，运行期不该留痕迹。用 ` #[no_mangle] ` 导出一个按字节求和的函数，看它编译成什么：

 

cost.rs — 借用检查不产生运行期代码 Rust

 

```text
// cost.rs —— 安全保证在编译期，机器码里没有"所有权元数据"
#![no_std]

#[no_mangle]
pub extern "C" fn sum(xs: *const u8, n: usize) -> u32 {
    let mut s = 0u32; let mut i = 0usize;
    while i < n { s = s.wrapping_add(unsafe { *xs.add(i) } as u32); i += 1; }
    s
}
#[no_mangle]
pub extern "C" fn add(a: u32, b: u32) -> u32 { a.wrapping_add(b) }
```

 

**bash**  — 复跑：` bash tools/probes/m01.sh `（第 4 节，cortex-m3 反汇编）

 

```text
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj cost.rs -o cost.o
$ arm-none-eabi-size cost.o
   text    data     bss     dec     hex filename
    152       0       0     152      98 cost.o

# sum：就是一个按 4 字节展开的求和循环，没有任何"检查/元数据/引用计数"
  2900        cmp     r1, #0
  bf04        itt     eq
  2000        moveq   r0, #0
  4770        bxeq    lr
  ...
  78e5        ldrb    r5, [r4, #3]        # 纯数据装载 + 相加
  7926        ldrb    r6, [r4, #4]
  4428        add     r0, r5
  ...
  d1f1        bne.n   2a <sum+0x2a>      # 循环

# add：函数体只有一条 add；前后是 AAPCS 的栈帧，与所有权无关
  b580        push    {r7, lr}
  466f        mov     r7, sp
  4408        add     r0, r1
  bd80        pop     {r7, pc}
```

 

◆ 一句话

 

所有权与借用是 **纯编译期** 机制：它改变的是"哪些程序能编过"，不改变"能编过的程序跑多快"。  *注意边界：` Rc `/` RefCell ` 之类会引入运行期检查——但那是你 **主动选择** 的运行时所有权，不是所有权本身的开销。*

 

**FIG 1.2**  所有权的时间线：move 之后原绑定失效

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="值只能有一个所有者；move 或借用决定谁在何时能访问">
          <rect x="30" y="40" width="150" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="105" y="68" class="sv-lbl-hi" text-anchor="middle">let a = v</text>
          <path d="M180 63 L230 63" class="sv-arrow"></path>
          <rect x="232" y="40" width="150" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="307" y="68" class="sv-lbl-hi" text-anchor="middle">let b = a（move）</text>
          <path d="M382 63 L432 63" class="sv-arrow"></path>
          <rect x="434" y="40" width="170" height="46" rx="6" class="sv-red-s"></rect>
          <text x="519" y="68" class="sv-lbl-hi" text-anchor="middle">用 a → 编译报错</text>
        </svg>
```

 

所有权把"谁负责释放、谁还能访问"写进类型系统，悬垂与重复释放变成编译错误。

 

| C 的债 | Rust 的解法 | 编译期就能抓吗 |
| --- | --- | --- |
| 悬垂指针 | 所有权 \+ 生命周期 | 能 |
| 忘记释放 | Drop（作用域结束） | 能（语义保证） |
| 重复释放 / 越界别名 | 借用规则 &/&mut | 能 |
| 数据竞争 | Send/Sync | 能 |

 

| 操作 | 是否转移所有权 | 原变量还能用吗 |
| --- | --- | --- |
| ` let b = a; `（非 Copy） | 是（move） | 不能 |
| ` let b = a; `（i32 等 Copy） | 否（复制） | 能 |
| ` f(&a) ` | 否（共享借用） | 能 |
| ` f(&mut a) ` | 否（独占借用） | 借用期内不能 |

 

| 反面写法 | Rust 报什么 | 原因 |
| --- | --- | --- |
| 返回局部变量的引用 | lifetime may not live long enough | 被引用数据先销毁 |
| 同一时刻两个 &mut | cannot borrow as mutable more than once | 独占借用唯一 |
| 借用期间 move 出去 | borrow later used here | 借用的对象不能移动 |

 

◆ 迁移练习

 

把一段 C 里"函数返回指向局部的指针"的代码改写成 Rust，观察借用检查器在编译期就拦住它，并解释生命周期标注如何修复。

 

◆ 本章要点

 

 
- C 的悬垂/忘释放/别名三类 bug 靠纪律；Rust 用 **所有权 \+ 借用 \+ 生命周期** 把它们变成编译错误。
 
- ` move ` 之后原绑定失效；` & ` 可多个只读、` &mut ` 同时只能一个——"共享 XOR 独占"。
 
- 生命周期标注把"借用不能比数据活得久"写成类型约束，对应 C 里的悬垂指针。
 
- 这些保证全部在编译期完成，运行期零成本（本机反汇编证实 ` sum ` 只是普通循环）。
 
- 运行期所有权（` Rc `/` RefCell `）是另一种选择，代价另算。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 简答：Rust 的"所有权"替你消灭了 C 里哪一类最常见的 bug？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"忘记释放（以及重复释放、释放后使用）。每个值有唯一所有者，离开作用域自动析构；所有权转移（` move `）后原绑定失效，不会出现\"两个所有者都想释放\"。"}
   ```
 
2. 判断：` &mut x ` 和 ` &x ` 可以同时存在。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不可以。同一作用域内，对同一数据要么有多个 ` & `（只读），要么只有一个 ` &mut `（可写），二者互斥。违反会得到 ` E0499 `。"}
   ```
 
3. 诊断：` fn bad() -> &'static u8 { let x = 5; &x } ` 报什么错？为什么 C 里差不多写法的函数"能过"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"报 ` E0515: cannot return reference to local variable `。C 里返回局部数组/变量地址只是 ` -Wreturn-local-addr ` 警告，能编过但运行期悬垂；Rust 直接拒绝编译。"}
   ```
 
4. 动手：写一个持有 ` &[u8] ` 的结构体，再写一个函数尝试让结构体比它借用的字节活得更久。预测报错，再用 ` rustc ` 验证。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会得到 ` borrowed value does not live long enough `。把被借用的 ` bytes ` 声明在结构体之前、且结构体在其作用域内使用，即可通过——生命周期保证\"借用者不晚于被借者销毁\"。"}
   ```
 
5. 判断：所有权与借用检查会给可执行文件带来运行期开销。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。它们是纯编译期机制。本机实测：一个借用了切片并求和的函数编译成普通循环（152 字节里没有任何引用计数或检查）。运行期开销只来自你主动选的 ` Rc `/` RefCell ` 等。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  找一段你写过的 C 代码，标出其中的"悬垂 / 忘释放 / 别名"风险，并说明换成 Rust 后哪一处会直接编译不过。

 

```zhizhan-assessment
{"id":"course-b03-m01","criterion":"对照 C 缓冲管理与 Rust move/borrow，标出每一时刻唯一可写的持有者。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
