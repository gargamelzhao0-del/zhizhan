# 体积与性能

```zhizhan-anchor
m08
```



嵌入式最硬的一条预算就是 Flash/RAM。Rust 提供了与 C 同级的优化旋钮，但也多了两个"只有 Rust 才有"的体积开关：  **优化档位（` opt-level `）** 与  **panic 策略** 。这一节全部用真实交叉编译的数字说话。

 

> ◷ 约 55 分钟 · ◈ opt-level · panic=abort · ⚑ 用数字决策

 

```zhizhan-anchor
m08-1
```



## 8.1 优化档位：` z ` 与 ` 1/2/3 ` 差多少

 

Rust 的 ` -C opt-level ` 可取 ` 0/1/2/3/s/z `。` s `/` z ` 为体积优化（` z ` 更激进）。 同一份源码、同一目标、只换档位：

 

size.rs — 待测样本（含 panic 路径） Rust

 

```text
// size.rs —— 一个带 panic 路径的函数，用来看优化档位的影响
#![no_std]
use core::panic::PanicInfo;

#[panic_handler]
fn ph(_: &PanicInfo) -> ! { loop {} }

#[no_mangle]
pub extern "C" fn checksum(data: *const u8, n: usize) -> u32 {
    let mut c = 0u32; let mut i = 0usize;
    while i < n { c = c.wrapping_add(unsafe { *data.add(i) } as u32); i += 1; }
    if c == 0xFFFF_FFFF { panic!(); }
    c
}
```

 

**bash**  — 复跑：` bash tools/probes/m08.sh `（rustc 1.99 · thumbv7m-none-eabi）

 

```text
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -C opt-level=z -C panic=abort --emit=obj size.rs -o size_z.o
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -C opt-level=1 -C panic=abort --emit=obj size.rs -o size_1.o
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -C opt-level=2 -C panic=abort --emit=obj size.rs -o size_2.o
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -C opt-level=3 -C panic=abort --emit=obj size.rs -o size_3.o
$ arm-none-eabi-size size_z.o size_1.o size_2.o size_3.o
   text    data     bss     dec     hex filename
    104       0       0     104      68 size_z.o
    200       0       0     200      c8 size_1.o
    204       0       0     204      cc size_2.o
    216       0       0     216      d8 size_3.o
# 同一份代码：z=104 B，3=216 B —— 体积差了一倍。体积敏感就先用 z，再按性能需求回退。
```

 

**FIG 8.1**  优化档位对体积的影响（同一份 ` size.rs `，本机实测）

 

```zhizhan-figure
<svg viewBox="0 0 660 198" role="img" aria-label="优化档位 z/1/2/3 的 text 体积柱状图">
          <line x1="90" y1="20" x2="90" y2="160" stroke="var(--line-2)"></line>
          <text x="84" y="44" class="sv-lbl" text-anchor="end">z</text>
          <rect x="90" y="30" width="63" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="163" y="43" class="sv-lbl-hi">104 B</text>
          <text x="84" y="80" class="sv-lbl" text-anchor="end">1</text>
          <rect x="90" y="66" width="120" height="18" rx="3" class="sv-amb-s"></rect>
          <text x="220" y="79" class="sv-lbl-hi">200 B</text>
          <text x="84" y="116" class="sv-lbl" text-anchor="end">2</text>
          <rect x="90" y="102" width="123" height="18" rx="3" class="sv-amb-s"></rect>
          <text x="223" y="115" class="sv-lbl-hi">204 B</text>
          <text x="84" y="152" class="sv-lbl" text-anchor="end">3</text>
          <rect x="90" y="138" width="130" height="18" rx="3" class="sv-red-s"></rect>
          <text x="230" y="151" class="sv-lbl-hi">216 B</text>
          <text x="360" y="62" class="sv-lbl-dim">体积敏感 → 默认 <tspan style="fill:var(--grn)">z</tspan></text>
          <text x="360" y="84" class="sv-lbl-dim">热点再局部提速，不整包调到 3</text>
          <text x="90" y="182" class="sv-lbl-dim">text 段字节 · rustc 1.99 · thumbv7m-none-eabi</text>
        </svg>
```

 

同一份代码，只换优化档位，体积差约一倍。嵌入式默认 ` z `；需要速度时 **局部** 优化，而不是全局。

 

◆ 怎么选

 

**默认 ` opt-level="z" `**  做体积优化；如果某段热代码对速度敏感，把 **那一段** 单独用 ` #[inline(never)] `/特化重写，而不是整包调到 3。 这与第①册 ` -Os ` \+ 局部手写优化的思路一致—— **全局求小、热点求快** 。

 

```zhizhan-anchor
m08-2
```



## 8.2 panic 策略：嵌入式默认 ` abort `

 

` no_std ` 目标上 panic 无法"展开栈"（没有 unwinder），默认就是 ` panic=abort `——直接终止。 这对体积是好事：不必链入展开运行时。 **但"带格式化的 panic"仍会拉进 ` core::fmt `** （Module 03 已量过）。

 

| 开关 | 作用 | 本册建议 |
| --- | --- | --- |
| ` -C panic=abort ` | panic 直接终止，不展开 | 嵌入式默认就开 |
| 避免 ` panic!("…{}") ` | 不带格式化就不拉 ` core::fmt ` | 热路径别用格式化 panic |
| ` -C lto ` / ` -C codegen-units=1 ` | 跨 crate 内联 \+ 删死代码 | 发布时开，能再压一截 |
| ` opt-level="z" ` | 体积优先 | 默认 |

 

```zhizhan-anchor
m08-3
```



## 8.3 定位体积工具：` nm --size-sort `

 

Rust 编译出的仍是标准 ELF 目标文件，所以第①册/第②册的那套工具照样能用：` arm-none-eabi-size ` 看总量， ` arm-none-eabi-nm --size-sort ` 找"哪个函数最大"。定位单态化膨胀（Module 04）就靠它。

 

**bash**  — 一个实用的体积体检组合

 

```text
$ arm-none-eabi-size  build/app
$ arm-none-eabi-nm --size-sort --demangle build/app | tail -20   # 最大的 20 个符号
# 若某一类实例化特别大：考虑改泛型为 dyn（牺牲一点速度换体积），或减少实例化组合。
```

 

```zhizhan-anchor
m08-4
```



## 8.4 优化档位与体积核算

 

```zhizhan-anchor
m08-5
```



## 8.5 发布前清单

 

**FIG 8.2**  优化档位对体积的影响（真实读数示意）

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="opt-level=z 最小，release 需配合 LTO、panic=abort、strip">
          <rect x="150" y="40" width="260" height="20" rx="3" class="sv-red-s"></rect>
          <text x="140" y="55" class="sv-lbl" text-anchor="end">-O0</text>
          <text x="420" y="55" class="sv-lbl-hi">最大</text>
          <rect x="150" y="70" width="150" height="20" rx="3" class="sv-amb-s"></rect>
          <text x="140" y="85" class="sv-lbl" text-anchor="end">-O2</text>
          <text x="310" y="85" class="sv-lbl-hi">中</text>
          <rect x="150" y="100" width="90" height="20" rx="3" class="sv-grn-s"></rect>
          <text x="140" y="115" class="sv-lbl" text-anchor="end">-Oz + LTO + abort</text>
          <text x="250" y="115" class="sv-lbl-hi">最小</text>
        </svg>
```

 

发布固件用 ` opt-level="z" ` \+ ` lto ` \+ ` panic="abort" ` \+ ` strip `。

 

| 档位 | 体积 | 速度 | 用途 |
| --- | --- | --- | --- |
| ` opt-level = 0 ` | 大 | 慢 | 调试 |
| ` opt-level = 2/3 ` | 中 | 快 | 常规 |
| ` opt-level = "z" ` | 最小 | 较慢 | Flash 紧张 |
| \+ ` lto = true ` | 更小 | — | 跨 crate 优化 |

 

| panic 策略 | 体积 | 说明 |
| --- | --- | --- |
| ` panic = "unwind" ` | 大 | 需展开运行时 |
| ` panic = "abort" ` | 小 | 嵌入式默认 |
| 格式化 panic 信息 | 更大 | 发布前去掉 |

 

| 检查项 | 命令/做法 |
| --- | --- |
| 体积排序 | ` nm --size-sort ` |
| 优化档 | Cargo.toml ` [profile.release] ` |
| panic | ` panic = "abort" ` |
| strip | ` strip = true ` |

 

Cargo.toml — 发布档配置 toml

 

```text
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

 

size\_check.sh — 看谁最占体积 bash

 

```text
$ cargo build --release
$ arm-none-eabi-nm --size-sort target/thumbv7m-none-eabi/release/fw | tail
```

 

◆ 迁移练习

 

用两种优化档（` -O2 ` 与 ` -Oz+LTO+abort `）各构建一次，记录体积差并解释来源。

 

◆ 本章要点

 

 
- ` opt-level ` 对体积影响巨大：本机同一份代码 ` z=104 B `、` 3=216 B `。
 
- 体积敏感默认用 ` z `，热点代码局部优化，而不是整包调快。
 
- 嵌入式 panic 默认 ` abort `； **带格式化的 panic**  才是体积大头。
 
- ` -C lto ` / ` codegen-units=1 ` 发布时开。
 
- 用 ` size ` \+ ` nm --size-sort ` 定位膨胀，与 C 的工具链完全通用。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 简答：同一份 Rust 代码，` opt-level=z ` 与 ` =3 ` 的体积差多少？为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"本机实测 104 B vs 216 B（约一倍）。` 3 ` 偏向展开内联与速度，` z ` 偏向最小化代码。嵌入式体积敏感就选 ` z `。"}
   ```
 
2. 判断：只要用 ` panic=abort `，panic 就完全不花体积。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不对。` abort ` 省掉的是 **展开运行时** ；但带格式化的 panic 仍会拉进 ` core::fmt `（Module 03 实测明显变大）。"}
   ```
 
3. 诊断：固件超了几 KB，怎么最快定位"是谁占的"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"用 ` arm-none-eabi-nm --size-sort --demangle ` 列出最大的符号；常见来源是某个被大量单态化的泛型函数，可考虑改 ` dyn ` 或减少实例化组合。"}
   ```
 
4. 动手：给 ` size.rs ` 加 ` -C lto ` 再编一次，比较体积。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"LTO 会跨 crate 内联并删死代码，通常能再小一些（也可能因内联而略大，取决于代码）。结论： **用你的代码实测** ，别背结论。"}
   ```
 
5. 判断：定位体积时，Python/脚本语言不能编到 MCU，所以体积问题只和 C/C\+\+/Rust 有关。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"就\"固件体积\"而言基本对；但上位机脚本（如第②册 B04）常用于跑 ` size `/分析、生成报告，是工具链的一部分，不是固件的一部分。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 08 完成？**  把本册任意一个 ` .rs ` 用 ` z `/` 3 ` 各编一次，量出体积差，并找出最大的符号。

 

```zhizhan-assessment
{"id":"course-b03-m08","criterion":"记录优化级别、工具链与目标；比较尺寸和测量开销而非只看抽象语法。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
