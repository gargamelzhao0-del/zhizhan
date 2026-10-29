# unsafe 的边界与 FFI

```zhizhan-anchor
m07
```



Rust 的"安全"不是"没有 ` unsafe `"，而是"不安全的地方少、且都看得见"。 寄存器读写、[DMA](term:dma)、与 C 库互调，都离不开 ` unsafe `。这一节讲 **什么时候必须 unsafe、如何把它封装成安全 API** ，以及 ` extern "C" ` 互操作。

 

> ◷ 约 70 分钟 · ◈ 安全封装 · extern "C" · ⚑ 边界必须收敛

 

```zhizhan-anchor
m07-1
```



## 7.1 什么时候必须 ` unsafe `

 

| 必须 unsafe 的操作 | 嵌入式里的场景 |
| --- | --- |
| 解引用裸指针 | MMIO 寄存器读写、访问固定地址 |
| 调用 ` extern "C" ` 函数 | 用现成的 C 库 / HAL / RTOS API |
| 访问/修改 ` static mut ` | 唯一的静态共享缓冲（Module 06） |
| 实现 ` unsafe trait ` | 把"我的类型满足某个不变量"告诉编译器（如自实现 ` Send `） |

 

` unsafe `  **不关闭借用检查、不做任何优化取舍** ——它只是把"这处不变量由人保证"标出来。所以纪律不是"消灭 unsafe"，而是 **收敛它** 。

 

**FIG 7.1**  unsafe 边界：不安全收敛在一层薄薄的"叶子"

 

```zhizhan-figure
<svg viewBox="0 0 660 198" role="img" aria-label="安全代码、unsafe 叶子层、硬件与 C 库三层的边界">
          <rect x="30" y="24" width="600" height="42" rx="6" class="sv-grn-s"></rect>
          <text x="46" y="50" class="sv-lbl-hi">安全代码（应用 / 驱动 / HAL 上层）</text>
          <text x="614" y="50" class="sv-lbl-dim" text-anchor="end">调用安全 API，自身无 unsafe</text>
          <rect x="30" y="76" width="600" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="46" y="98" class="sv-lbl-hi">unsafe 叶子层（每处 unsafe 带"安全契约"注释）</text>
          <text x="46" y="114" class="sv-lbl-dim">read/write_volatile · extern "C" 调用 · static mut 取唯一引用</text>
          <rect x="30" y="132" width="600" height="42" rx="6" class="sv-box"></rect>
          <text x="46" y="158" class="sv-lbl">硬件寄存器 · C 库 / HAL · 启动汇编</text>
          <text x="614" y="158" class="sv-lbl-dim" text-anchor="end">不受 Rust 检查，靠契约</text>
        </svg>
```

 

目标不是"没有 unsafe"，而是 **让它薄且集中** ：上层全是安全代码，unsafe 只在叶子层、每处写清契约，出问题时的审查范围极小。

 

```zhizhan-anchor
m07-2
```



## 7.2 封装规范：把 ` unsafe ` 关进一个安全函数

 

正确做法：只在 **最底层** 出现一次 ` unsafe `，外面暴露一个 **安全 API** ，并用文档注明安全契约。 典型例子——把一个寄存器地址包成"可安全读取"的类型：

 

unsafe\_wrap.rs — 安全 API 包住唯一的 unsafe Rust

 

```text
// unsafe_wrap.rs —— 用安全 API 包住一处必要的不安全
#![no_std]

pub struct Mmio { addr: *const u32 }
impl Mmio {
    pub fn new(addr: u32) -> Self { Self { addr: addr as *const u32 } }
    /// 安全契约：addr 必须是有效的只读寄存器地址（由 `new` 的调用方保证）
    pub fn read(&self) -> u32 {
        unsafe { core::ptr::read_volatile(self.addr) }   // 唯一的不安全点
    }
}

pub fn read_sensor() -> u32 { Mmio::new(0x4001_2000).read() }
```

 

◆ 一条可操作的封装规范

 

 
- **unsafe 只出现在叶子函数** ：上面的 ` read ` 是叶子；调用方 ` read_sensor ` 完全安全。
 
- **为一个 unsafe 写清"安全契约"** ：满足什么条件才能安全调用（这里是"地址有效"）。
 
- **用类型缩小契约范围** ：` Mmio::new(addr) ` 把"地址由谁保证"集中到一处，而不是处处强转。

 

```zhizhan-anchor
m07-3
```



## 7.3 与 C 互调：` extern "C" ` 与 ` #[no_mangle] `

 

两件事要分清： **调用 C** （声明外部符号，调用处 ` unsafe `）与 **导出给 C** （` #[no_mangle] pub extern "C" `，关闭名字修饰）。 这与第②册 M09 讲 C\+\+ 的 ` extern "C" ` 是同一套链接规则。

 

ffi.rs — 调用 C 函数 \+ 导出 Rust 函数 Rust

 

```text
// ffi.rs —— Rust 与 C 双向互调
#![no_std]

extern "C" {
    fn c_checksum(data: *const u8, len: usize) -> u32;   // C 提供
}
// 把 unsafe 的 C 调用包成安全函数
pub fn checksum(data: &[u8]) -> u32 {
    unsafe { c_checksum(data.as_ptr(), data.len()) }      // 唯一的不安全点
}

// 导出给 C 用：关闭名字修饰，使用 C ABI
#[no_mangle]
pub extern "C" fn rs_add(a: u32, b: u32) -> u32 { a.wrapping_add(b) }
```

 

**bash**  — 复跑：` bash tools/probes/m07.sh `（rustc 1.99 · thumbv7m-none-eabi）

 

```text
# --emit=obj 只编译不链接：extern "C" 的 c_checksum 会留成未定义符号，交给 C 侧提供
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj ffi.rs -o ffi.o
$ arm-none-eabi-size ffi.o
   text    data     bss     dec     hex filename
     36       0       0      36      24 ffi.o
$ arm-none-eabi-nm -u ffi.o
         U c_checksum
# 与第②册 C++ 侧结论一致：extern "C" 只影响链接名；混编用带 C 符号的那一侧做门面。
```

 

```zhizhan-anchor
m07-4
```



## 7.4 与 C 混编：几点工程约定

 

| 要点 | 说明 |
| --- | --- |
| 用 C ABI 的接口 | 两边都写 ` extern "C" `；Rust 导出加 ` #[no_mangle] ` |
| 结构体布局 | 跨语言传的结构体用 ` #[repr(C)] `（对应第②册的"标准布局"要求） |
| 裸设备 / 寄存器头 | 用 ` bindgen ` 从 C 头文件自动生成绑定，别手抄 |
| panic 跨 FFI | panic 穿越 ` extern "C" ` 是 UB → 导出函数要保证不 panic（或用 ` catch_unwind `/abort） |
| 链接 | 用 ` build.rs `/链接脚本把 C 目标文件与 Rust 一起链；入口符号保持 C 名 |

 

⚠ 最容易忽略的一条：panic 不能穿越 FFI 边界

 

从一个 ` extern "C" ` 函数里 ` panic ` 出去，行为是未定义的。导出给 C 的函数要么保证不 panic， 要么在内部把错误转成错误码（对应 C 的 ` err_t `）。这与第②册"异常不能跨中断/模块边界"是同一条纪律。

 

```zhizhan-anchor
m07-5
```



## 7.5 把 ` unsafe ` 关进一个安全函数

 

**FIG 7.2**  unsafe 的边界：内部不变量由你保证，外部 API 仍然安全

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="安全 API 内部可以少量 unsafe，但必须保证不变量，调用者无需 unsafe">
          <rect x="40" y="40" width="180" height="56" rx="6" class="sv-cyn-s"></rect>
          <text x="130" y="63" class="sv-lbl-hi" text-anchor="middle">pub fn api()</text>
          <text x="130" y="83" class="sv-lbl-dim" text-anchor="middle">安全接口</text>
          <path d="M220 68 L280 68" class="sv-arrow"></path>
          <rect x="282" y="40" width="200" height="56" rx="6" class="sv-red-s"></rect>
          <text x="382" y="63" class="sv-lbl-hi" text-anchor="middle">unsafe { … }</text>
          <text x="382" y="83" class="sv-lbl-dim" text-anchor="middle">不变量在此被保证</text>
          <text x="540" y="60" class="sv-lbl-dim" text-anchor="middle">调用者</text>
          <text x="540" y="80" class="sv-lbl-hi" text-anchor="middle">无需 unsafe</text>
        </svg>
```

 

unsafe 越少越好：集中一处，配注释说明"为什么这里安全"。

 

unsafe\_min.rs — 安全 API 包住唯一的 unsafe Rust

 

```text
static mut CTRL: u32 = 0;

pub fn set_ctrl(v: u32) {
    // SAFETY: 启动后单核、无并发写此寄存器
    unsafe { core::ptr::write_volatile(&mut CTRL, v); }
}
```

 

| 需要 unsafe 的场景 | 能否避免 | 替代 |
| --- | --- | --- |
| 访问内存映射寄存器 | 难 | HAL crate 封装 |
| 调用 C（FFI） | 难 | 绑定层封装 |
| 实现底层 trait | 有时 | 复用现成实现 |
| 解引用裸指针 | 多数能 | 用借用/切片 |

 

| FFI 约定 | 要求 | 否则 |
| --- | --- | --- |
| ` #[no_mangle] ` | 导出 C 符号名 | 链接找不到 |
| ` extern "C" ` | C ABI | 调用约定错 |
| ` #[repr(C)] ` | 结构体布局固定 | 布局不一致 |
| 类型映射 | 用 C 兼容类型 | ABI 不匹配 |

 

◆ 迁移练习

 

写一个 ` extern "C" ` 导出函数供 C 调用，并让它内部只含一处带 ` // SAFETY ` 注释的 ` unsafe `。

 

◆ 本章要点

 

 
- ` unsafe ` 不关闭借用检查，只是把"由人保证的不变量"标出来；目标是 **收敛** 它。
 
- 封装规范：unsafe 只出现在叶子函数，外面是安全 API，并写清安全契约。
 
- 调用 C → 声明 ` extern "C" ` 并在调用处 ` unsafe `；导出给 C → ` #[no_mangle] pub extern "C" `。
 
- 跨语言结构体用 ` #[repr(C)] `；寄存器头用 ` bindgen `。
 
- panic  **不能** 穿越 FFI 边界（UB）；导出函数要么不 panic，要么转错误码。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 简答：写 ` unsafe ` 会不会让编译器"关掉借用检查、随便写"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。` unsafe ` 只解锁那几样\"编译器无法检查\"的操作（裸指针、extern 调用、static mut 等），借用检查与所有权照常生效。"}
   ```
 
2. 判断：既然 ` Mmio::read ` 里用了 ` unsafe `，那么所有调用它的代码也都是不安全的。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对。` read ` 是安全函数（对外），不安全只在它内部一处。调用方 ` read_sensor ` 完全安全——这正是\"把 unsafe 关进安全 API\"。"}
   ```
 
3. 诊断：Rust 侧 ` extern "C" { fn c_checksum(...); } ` 编出的 ` ffi.o ` 里，` c_checksum ` 是定义还是未定义？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"未定义（` U c_checksum `），必须由 C 侧提供、链接时补上。与第②册 C\\+\\+ 侧\"extern 声明产生 U 符号\"一致。"}
   ```
 
4. 动手：给 ` ffi.rs ` 的导出函数加一段会 ` panic ` 的逻辑，想想为什么会是 UB。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"panic 要沿调用栈展开，而 C 栈帧没有 Rust 的展开信息；panic 穿过 ` extern \"C\" ` 边界即 UB。导出函数应保证不 panic，或把错误转成错误码返回。"}
   ```
 
5. 判断：跨语言传结构体时，Rust 的默认 ` struct ` 布局可以直接用。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不行。Rust 默认布局不保证与 C 一致，必须加 ` #[repr(C)] `（对应第②册\"标准布局 \\+ 可平凡拷贝\"的要求），并保证字段顺序/宽度/对齐一致。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  把你项目里的一处 MMIO/FFI 调用，收敛成一个"安全 API \+ 一处 unsafe \+ 契约注释"。

 

```zhizhan-assessment
{"id":"course-b03-m07","criterion":"逐个写明 unsafe/FFI 的指针对齐、长度、别名、生命和并发前提。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
