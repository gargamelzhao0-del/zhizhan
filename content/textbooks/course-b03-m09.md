# 实战：三语言同题

```zhizhan-anchor
m09
```



用同一个题目——"定时器 PWM 呼吸灯"——分别用  **C / C\+\+ / Rust**  写一遍，逐项对比 **代码量、体积、可维护性、生态** 。 题目足够小，能把"语言本身"的影响单独看清楚；所有体积都是本机真实交叉编译所得。

 

> ◷ 约 80 分钟 · ◈ C / C\+\+ / Rust 对照 · ⚑ 全册收口

 

```zhizhan-anchor
m09-1
```



## 9.1 题目：把占空比从 0 爬到 period，再重复

 

功能极简：不断写入 PWM 比较寄存器（占空比 ` 0..period `），每次之间做一段忙等，形成呼吸效果。 三份实现都导出 C ABI 函数，便于公平比较。

 

breath\_c.c — C 版 C

 

```text
/* 定时器 PWM 呼吸灯：C 版 */
#include <stdint.h>

void breath_c(volatile uint32_t *arr, uint32_t period) {
    for (uint32_t d = 0; d < period; d++) {
        *arr = d;
        for (volatile uint32_t i = 0; i < period; i++) { }   /* 忙等 */
    }
}
```

 

breath\_cpp.cpp — C\+\+ 版（C-ABI 导出） C\+\+

 

```text
// 定时器 PWM 呼吸灯：C++ 版
#include <cstdint>

extern "C" void breath_cpp(volatile std::uint32_t* arr, std::uint32_t period) {
    for (std::uint32_t d = 0; d < period; d++) {
        *arr = d;
        for (volatile std::uint32_t i = 0; i < period; i++) { }
    }
}
```

 

breath\_rs.rs — Rust 版 Rust

 

```text
// 定时器 PWM 呼吸灯：Rust 版
#![no_std]

#[no_mangle]
pub extern "C" fn breath_rs(arr: *mut u32, period: u32) {
    let mut d: u32 = 0;
    while d < period {
        unsafe { core::ptr::write_volatile(arr, d); }   // 写 PWM 比较寄存器
        let mut i: u32 = 0;
        while i < period { i += 1; }                    // 忙等
        d += 1;
    }
}
```

 

```zhizhan-anchor
m09-2
```



## 9.2 体积对照（本机实测）

 

**bash**  — 复跑：` bash tools/probes/m09.sh `（Arm GNU Toolchain 13.3.1 / rustc 1.99，cortex-m3）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c breath_c.c -o breath_c.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti -c breath_cpp.cpp -o breath_cpp.o
$ rustc --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O -C panic=abort --emit=obj breath_rs.rs -o breath_rs.o
$ arm-none-eabi-size breath_c.o breath_cpp.o breath_rs.o
   text    data     bss     dec     hex filename
     36       0       0      36      24 breath_c.o
     36       0       0      36      24 breath_cpp.o
     84       0       0      84      54 breath_rs.o
```

 

**FIG 9.1**  同题 PWM 呼吸灯：三语言体积对照（本机实测）

 

```zhizhan-figure
<svg viewBox="0 0 660 178" role="img" aria-label="C / C++ / Rust 同题体积柱状图">
          <line x1="110" y1="24" x2="110" y2="140" stroke="var(--line-2)"></line>
          <text x="104" y="44" class="sv-lbl" text-anchor="end">C</text>
          <rect x="110" y="30" width="54" height="18" rx="3" class="sv-cyn-s"></rect>
          <text x="174" y="43" class="sv-lbl-hi">36 B</text>
          <text x="104" y="80" class="sv-lbl" text-anchor="end">C++</text>
          <rect x="110" y="66" width="54" height="18" rx="3" class="sv-amb-s"></rect>
          <text x="174" y="79" class="sv-lbl-hi">36 B</text>
          <text x="104" y="116" class="sv-lbl" text-anchor="end">Rust</text>
          <rect x="110" y="102" width="126" height="18" rx="3" class="sv-grn-s"></rect>
          <text x="246" y="115" class="sv-lbl-hi">84 B</text>
          <text x="360" y="62" class="sv-lbl-dim">都在"几十字节"量级</text>
          <text x="360" y="84" class="sv-lbl-dim">本例 Rust 偏大：忙等写法未被同样折叠</text>
          <text x="110" y="162" class="sv-lbl-dim">text 段字节 · cortex-m3 · 三方都导出 C ABI</text>
        </svg>
```

 

语言标签不决定体积， **优化器与写法** 才决定。别拿"语言对比"当结论——用自己的代码与参数实测。

 

◆ 怎么读这组数字

 

三者都在 **几十字节** 的量级——语言标签本身不决定体积， **优化器与写法** 才决定。 本例 Rust 版偏大（84 B），主因是"空忙等循环"的写法未被同样地折叠；换一种等法（调用统一的 ` delay ` 或 ` core::hint::black_box `）后三者会接近。  **动手验收** ：把三份的忙等改成"读一个 volatile 计数"，重新编一次，看差距是否收敛。

 

```zhizhan-anchor
m09-3
```



## 9.3 代码量与可维护性

 

| 维度 | C | C\+\+ | Rust |
| --- | --- | --- | --- |
| 本题代码量 | 8 行 | 8 行 | 11 行（含 ` unsafe `） |
| 类型安全 | 弱（裸指针 \+ 约定） | 中（可封装类/RAII） | 强（[所有权](term:ownership)/借用/类型状态） |
| 踩错时 | 运行期才发现 | 运行期 / 链接期 | 多为编译期 |
| 寄存器访问 | 直接、最简 | 直接 | 必须 ` unsafe `（可封装） |
| 生态成熟度 | 极成熟、资料最多 | 成熟、与 C 无缝 | 快速增长，` embedded-hal ` 标准化中 |

 

```zhizhan-anchor
m09-4
```



## 9.4 全册回顾：一张"用哪个"的速查

 

| 场景 | 推荐 |
| --- | --- |
| 纯寄存器、极简、团队只懂 C | C（最直接、资料最多） |
| 需要封装 \+ 运行期多态、要接 C 库 | C\+\+（RAII/模板/虚表，与 C 无缝） |
| 要"编译期消除悬垂/别名/数据竞争"，愿付学习成本 | Rust（所有权 \+ no\_std \+ embedded-hal） |
| M0 上的原子读-改-写 | 三语言都要用临界区（Rust 干脆不提供 ` fetch_add `） |
| 生态/量产工具链最成熟 | C / C\+\+ |

 

⚠ 别把"语言"当信仰

 

三语言都能做到"几十字节、可预测、可调试"。选型的真正依据是： **团队能力、生态、以及你最怕哪一类 bug** 。 本册的价值不是让你"改宗 Rust"，而是让你知道—— **所有权这一课，能用编译器替你挡掉一整类嵌入式经典错误** 。

 

```zhizhan-anchor
m09-5
```



## 9.5 三语言同题：各自的"代价"花在哪

 

**FIG 9.2**  同一功能，三语言各买到了什么

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="C 靠人守约定，C++ 负 RAII/模板体积，Rust 用编译期检查换运行期安全">
          <rect x="30" y="40" width="190" height="60" rx="6" class="sv-cyn-s"></rect>
          <text x="125" y="62" class="sv-lbl-hi" text-anchor="middle">C</text>
          <text x="125" y="82" class="sv-lbl-dim" text-anchor="middle">最小·约定靠人</text>
          <rect x="235" y="40" width="190" height="60" rx="6" class="sv-amb-s"></rect>
          <text x="330" y="62" class="sv-lbl-hi" text-anchor="middle">C++</text>
          <text x="330" y="82" class="sv-lbl-dim" text-anchor="middle">零开销抽象·编译期多态</text>
          <rect x="440" y="40" width="190" height="60" rx="6" class="sv-grn-s"></rect>
          <text x="535" y="62" class="sv-lbl-hi" text-anchor="middle">Rust</text>
          <text x="535" y="82" class="sv-lbl-dim" text-anchor="middle">编译期消灭内存类 bug</text>
        </svg>
```

 

没有"最好"，只有"哪种代价你能接受"：体积、学习曲线、还是运行期安全。

 

| 维度 | C | C\+\+ | Rust |
| --- | --- | --- | --- |
| 体积 | 最小 | 中 | 中 |
| 内存安全 | 靠人 | RAII 部分 | 编译期保证 |
| 多态 | ops 表 | 模板/虚表 | 泛型/dyn |
| 学习曲线 | 低 | 高 | 中高 |

 

| 你的现状 | 建议 |
| --- | --- |
| Flash 极紧、团队熟 C | 继续 C |
| 要做零开销抽象、团队熟 C\+\+ | C\+\+ 子集 |
| 最怕内存/并发 bug、愿学新语言 | Rust |
| 想逐步迁移 | 先在外围模块用 Rust/FFI |

 

◆ 迁移练习

 

用 C/C\+\+/Rust 各写一个"呼吸灯"版本，记录三者的体积与代码量，写下你为哪个项目会选哪一种、为什么。

 

◆ 本章要点

 

 
- 同一 PWM 呼吸灯：C/C\+\+/Rust 体积都在几十字节量级—— **语言不决定体积，优化器与写法才决定** 。
 
- Rust 多出的多是 ` unsafe ` 的显式标记与（本例）忙等写法差异，而非"固有权重"。
 
- 类型安全上 Rust 最强（编译期），C\+\+ 居中（可封装），C 最弱（靠纪律）。
 
- 生态与资料的成熟度目前仍是 C/C\+\+ 领先；Rust 的 ` embedded-hal ` 正在标准化。
 
- 选型看团队/生态/最怕哪类 bug，而不是"哪个语言更高级"。

 

◆ 自测 · Module 09（先答再看）

 

 
1. 判断：Rust 编出的固件一定比 C 大。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不成立。本机同题实测三者都在几十字节；本例 Rust 略大是 **写法** （忙等循环）与优化器差异，不是语言固有属性。"}
   ```
 
2. 简答：三语言在"防止悬垂/数据竞争"上，能力排序如何？为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"Rust \\> C\\+\\+ \\> C(就本题这类安全问题)。C 靠纪律、多数错误在运行期；C\\+\\+ 可用 RAII/智能指针缓解；Rust 用所有权/借用把它们变成编译错误。"}
   ```
 
3. 诊断：有人把 C 版 ` breath_c ` 的 ` arr ` 误传成另一个外设的寄存器，会怎样？Rust 版呢？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"C 里指针就是指针，编过、运行期写错寄存器（行为诡异）。Rust 里若用 newtype 区分 ` PwmReg ` 与其它寄存器，传错直接编译失败（Module 02）。"}
   ```
 
4. 动手：把三份代码的忙等都改成"读一个 ` volatile ` 计数 4096 次"，重编比较体积。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"三者会明显靠拢。结论落地： **用你自己的写法与编译参数实测** ，不要拿\"语言对比\"当结论。"}
   ```
 
5. 判断：一个项目应该"全量改成 Rust"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不建议。稳妥路径是 **自下而上、逐模块** ：先把一个纯逻辑模块改成 Rust、用 ` #[no_mangle] extern \"C\" ` 接回 C 工程，跑通验证再继续。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**全册完成？**  挑你项目里一个"最容易因指针/共享出错"的模块，评估用 C\+\+ 或 Rust 重写它，最怕的那类 bug 能否被编译期挡住。

 

```zhizhan-assessment
{"id":"course-b03-m09","criterion":"同题功能、输入、失败政策一致后再比较三种语言的成本。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Rust Embedded Book](https://docs.rust-embedded.org/book/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b03-guide)
