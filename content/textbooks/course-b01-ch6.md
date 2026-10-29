# 位操作与寄存器级编程

```zhizhan-anchor
ch6
```



前面五章建立的是"理解"。这一章开始动手： **不借助 HAL，直接用寄存器把 STM32 和 ESP32 跑起来** 。 当你能亲手写出一个点灯和串口初始化的寄存器版本，你对嵌入式的掌控感会完全不同。

 

> ◷ 约 165 分钟 · ◈ 双平台实战 · ⚑ 从寄存器到可用外设

 

```zhizhan-anchor
ch6-1
```



## 6.1 位运算：嵌入式工程师的母语

 

在 PC 编程里，位运算是个"偶尔用到的技巧"。在嵌入式里，它是 **日常操作** —— 每一个寄存器的配置、每一个协议帧的解析、每一个状态标志的管理，都是位运算。

 

**FIG 6.1**  五个基本位操作与其硬件语义

 

```zhizhan-figure
<svg viewBox="0 0 660 330" width="660" height="330" role="img" aria-label="基本位操作">
          <!-- 表头 -->
          <text x="20" y="22" class="sv-lbl-dim" style="font-size:11px">操作</text>
          <text x="150" y="22" class="sv-lbl-dim" style="font-size:11px">写法</text>
          <text x="330" y="22" class="sv-lbl-dim" style="font-size:11px">硬件语义</text>

          <line x1="20" y1="30" x2="640" y2="30" stroke="var(--line-2)"></line>

          <!-- OR -->
          <text x="20" y="56" class="sv-lbl-hi" style="fill:var(--grn);font-size:12px">置位</text>
          <rect x="146" y="40" width="172" height="24" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="156" y="57" style="font-family:var(--mono);font-size:11.5px;fill:var(--grn)">REG |= (1u &lt;&lt; n);</text>
          <text x="330" y="57" class="sv-lbl-dim" style="font-size:11px">把第 n 位置 1，其他位不动</text>

          <!-- AND -->
          <text x="20" y="94" class="sv-lbl-hi" style="fill:var(--cyn);font-size:12px">清零</text>
          <rect x="146" y="78" width="172" height="24" rx="4" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="152" y="95" style="font-family:var(--mono);font-size:11.5px;fill:var(--cyn)">REG &amp;= ~(1u &lt;&lt; n);</text>
          <text x="330" y="95" class="sv-lbl-dim" style="font-size:11px">把第 n 位置 0，其他位不动</text>

          <!-- XOR -->
          <text x="20" y="132" class="sv-lbl-hi" style="fill:var(--amb);font-size:12px">翻转</text>
          <rect x="146" y="116" width="172" height="24" rx="4" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="156" y="133" style="font-family:var(--mono);font-size:11.5px;fill:var(--amb)">REG ^= (1u &lt;&lt; n);</text>
          <text x="330" y="133" class="sv-lbl-dim" style="font-size:11px">第 n 位取反（常用于翻转 LED）</text>

          <!-- TEST -->
          <text x="20" y="170" class="sv-lbl-hi" style="fill:var(--vio);font-size:12px">读取</text>
          <rect x="146" y="154" width="172" height="24" rx="4" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="156" y="171" style="font-family:var(--mono);font-size:11.5px;fill:var(--vio)">if (REG &amp; (1u &lt;&lt; n))</text>
          <text x="330" y="171" class="sv-lbl-dim" style="font-size:11px">判断第 n 位是否为 1</text>

          <!-- WRITE FIELD -->
          <text x="20" y="208" class="sv-lbl-hi" style="fill:var(--red);font-size:12px">写多位域</text>
          <rect x="146" y="192" width="238" height="24" rx="4" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="152" y="209" style="font-family:var(--mono);font-size:11px;fill:var(--red)">REG = (REG &amp; ~MASK) | (v &lt;&lt; s);</text>
          <text x="392" y="209" class="sv-lbl-dim" style="font-size:11px">先清掩码区，再写新值</text>

          <!-- 底部：实际例子 -->
          <rect x="20" y="232" width="620" height="88" rx="7" class="sv-grn-s"></rect>
          <text x="36" y="254" class="sv-lbl-hi" style="fill:var(--grn)">为什么"先清后写"是必须的</text>
          <text x="36" y="276" class="sv-lbl-dim" style="font-size:11px">假设 bit[3:2] 是某个 2 位字段，当前值是 11（二进制），要写入 01：</text>
          <text x="36" y="296" style="font-family:var(--mono);font-size:11px;fill:var(--red)">✕ REG |= (1u &lt;&lt; 2);&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ 只置位，结果是 11 | 01 = 11，写了个寂寞</text>
          <text x="36" y="314" style="font-family:var(--mono);font-size:11px;fill:var(--grn)">✔ REG = (REG &amp; ~(3u &lt;&lt; 2)) | (1u &lt;&lt; 2);&nbsp;&nbsp;→ 先清成 00，再写入 01 = 01 ✔</text>
        </svg>
```

 

**新手最容易犯的错就是把"写多位域"当成"置位"来写。**  单 bit 用 ` |= `，多 bit 字段必须用"清掩码 \+ 写值"。

 

bitops.h — 一套工业级的位操作宏（可直接用在你项目里） C

 

```text
#ifndef BITOPS_H
#define BITOPS_H

#include <stdint.h>

/* ============ 基础单 bit 操作 ============ */

#define BIT(n)                    (1UL << (n))
#define BIT_MASK(n)               (1UL << (n))

/* 置位：把第 n 位置 1 */
#define SET_BIT(reg, n)           ((reg) |=  (1UL << (n)))
/* 清零：把第 n 位置 0 */
#define CLR_BIT(reg, n)           ((reg) &= ~(1UL << (n)))
/* 翻转 */
#define TOG_BIT(reg, n)           ((reg) ^=  (1UL << (n)))
/* 读取：返回 0 或 1 */
#define GET_BIT(reg, n)           (((reg) >> (n)) & 1UL)
/* 按值写单 bit（v 是 0 或 1） */
#define PUT_BIT(reg, n, v)        ((reg) = (v) ? ((reg) | (1UL << (n))) \
                                               : ((reg) & ~(1UL << (n))))

/* ============ 多位域操作（关键！）============ */

/* 生成连续 n 位的掩码。注意 (1UL << 32) 是 UB，必须特判 */
#define MASK_BITS(n)              (((n) >= 32UL) ? 0xFFFFFFFFUL : ((1UL << (n)) - 1UL))

/* 从偏移 off 开始，连续 n 位的掩码 */
#define FIELD_MASK(n, off)        (MASK_BITS(n) << (off))

/* 提取字段：把 [off+n-1 : off] 右对齐取出 */
#define FIELD_GET(reg, n, off)    (((reg) & FIELD_MASK(n, off)) >> (off))

/* 写入字段：先清后写。v 超出 n 位会被自动截断（安全） */
#define FIELD_SET(reg, n, off, v) \
    ((reg) = ((reg) & ~FIELD_MASK(n, off)) | (((v) & MASK_BITS(n)) << (off)))

/* ============ 常用复合操作 ============ */

/* 判断某位是否为 1（可读性更好） */
#define IS_BIT_SET(reg, n)        (((reg) & (1UL << (n))) != 0UL)

/* 把寄存器的一部分清零（常用于清中断标志：写 1 清零） */
#define CLEAR_BITS(reg, mask)     ((reg) = (mask))

/* ============ 实际使用示例 ============ */
#if 0
/* 假设某个寄存器：
   bit[1:0]  模式：00=输入 01=输出 10=复用 11=模拟
   bit[3:2]  输出速度
   bit[7:4]  上拉下拉配置
   bit[8]    锁定
*/

#define GPIO_MODE_Pos      0
#define GPIO_MODE_Msk      FIELD_MASK(2, 0)
#define GPIO_SPEED_Pos     2
#define GPIO_SPEED_Msk     FIELD_MASK(2, 2)
#define GPIO_PUPD_Pos      4
#define GPIO_PUPD_Msk      FIELD_MASK(4, 4)
#define GPIO_LCK_Pos       8

/* ✔ 用宏配置：一行一个字段，自解释，不易错 */
static inline void gpio_config_output(volatile uint32_t *cr)
{
    uint32_t tmp = *cr;

    tmp &= ~(GPIO_MODE_Msk | GPIO_SPEED_Msk | GPIO_PUPD_Msk);  /* 一次清掉所有要改的字段 */
    tmp |=  (1UL << GPIO_MODE_Pos);                            /* MODE = 01 输出 */
    tmp |=  (2UL << GPIO_SPEED_Pos);                           /* SPEED = 10 中速 */
    tmp |=  (1UL << GPIO_PUPD_Pos);                            /* PUPD = 0001 上拉 */

    *cr = tmp;                       /* 一次性写回，减少时序窗口 */
}
#endif

#endif /* BITOPS_H */
```

 

✕ 位操作的四个经典陷阱

 

 
1. **` 1 << 31 ` 是未定义行为** （` int ` 是 32 位有符号，符号位溢出）。 永远写 ` 1UL << 31 ` 或 ` 1u << 31 `。
 
2. **` MASK_BITS(32) ` 是未定义行为** 。` 1UL << 32 ` 在 32 位平台上移位量等于位宽，结果未定义。 上面的宏用 ` (n) >= 32 ? 0xFFFFFFFFUL : ... ` 做了特判—— *这个特判是必须的，很多开源库都漏了。*
 
3. **在 8 位/16 位寄存器上用了 32 位掩码** 。比如给 ` uint8_t ` 寄存器写 ` |= 0x100 `， 编译不报错，但高 8 位被静默丢弃。 *用 ` -Wconversion ` 能抓到一部分。*
 
4. **宏参数没有括号** 。` #define SET_BIT(r,n) r |= 1<<n ` 在 ` SET_BIT(a+b, c) ` 时会展开成 ` a+b |= 1<<c `，由于 ` |= ` 优先级低于 ` + `，结果是 ` a + (b |= 1<<c) `—— **编译能过，但改了错的变量** 。 *每个参数都要加括号，整个表达式也要加。*

 

```zhizhan-anchor
ch6-2
```



## 6.2 位带（Bit-Banding）：Cortex-M 的原子位操作

 

Cortex-M3/M4 提供了一个非常优雅的硬件特性： **位带** 。 它让"操作单个 bit"变成一次普通的 32 位写， *无需读-改-写，天然原子* 。

 

**FIG 6.2**  位带地址映射原理

 

```zhizhan-figure
<svg viewBox="0 0 660 316" width="660" height="316" role="img" aria-label="位带映射">
          <defs>
            <marker id="ah11" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <!-- 位带区别名区 -->
          <text x="20" y="24" class="sv-lbl-hi" style="fill:var(--cyn)">位带别名区（Bit-band Alias）· 每个字对应一个 bit</text>
          <rect x="20" y="34" width="270" height="150" rx="7" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="36" y="56" class="sv-lbl-dim" style="font-size:10.5px">SRAM 别名区</text>
          <text x="36" y="74" style="font-family:var(--mono);font-size:11px;fill:var(--cyn)">0x2200_0000 – 0x23FF_FFFF</text>
          <text x="36" y="100" class="sv-lbl-dim" style="font-size:10.5px">外设别名区</text>
          <text x="36" y="118" style="font-family:var(--mono);font-size:11px;fill:var(--cyn)">0x4200_0000 – 0x43FF_FFFF</text>

          <text x="36" y="148" class="sv-lbl-dim" style="font-size:10.5px">每个 32 位地址 = 原区的一个 bit</text>
          <text x="36" y="166" class="sv-lbl-dim" style="font-size:10.5px">写 1 → 该 bit 置 1；写 0 → 该 bit 清 0</text>

          <!-- 箭头 -->
          <path d="M 296 108 L 372 108" stroke="var(--grn)" stroke-width="1.6" fill="none" marker-end="url(#ah11)"></path>
          <text x="334" y="100" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">地址变换</text>
          <text x="334" y="126" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">纯硬件，零开销</text>

          <!-- 原位带区 -->
          <text x="380" y="24" class="sv-lbl-hi" style="fill:var(--grn)">位带区（Bit-band Region）· 实际寄存器/内存</text>
          <rect x="380" y="34" width="262" height="150" rx="7" fill="var(--grn-d)" stroke="var(--grn)"></rect>

          <text x="396" y="58" class="sv-lbl-dim" style="font-size:10.5px">SRAM 区（1 MB）</text>
          <text x="396" y="76" style="font-family:var(--mono);font-size:11px;fill:var(--grn)">0x2000_0000 – 0x200F_FFFF</text>
          <text x="396" y="102" class="sv-lbl-dim" style="font-size:10.5px">外设区（1 MB）</text>
          <text x="396" y="120" style="font-family:var(--mono);font-size:11px;fill:var(--grn)">0x4000_0000 – 0x400F_FFFF</text>

          <text x="396" y="148" class="sv-lbl-dim" style="font-size:10.5px">每个 bit 膨胀成 32 位</text>
          <text x="396" y="166" class="sv-lbl-dim" style="font-size:10.5px">1 MB 位带区 → 32 MB 别名区</text>

          <!-- 底部：计算公式 -->
          <rect x="20" y="200" width="622" height="100" rx="7" class="sv-amb-s"></rect>
          <text x="36" y="222" class="sv-lbl-hi" style="fill:var(--amb)">地址换算公式</text>
          <text x="36" y="246" style="font-family:var(--mono);font-size:11.5px;fill:var(--txt)">别名地址 = 别名区基址 + (目标地址 − 位带区基址) × 32 + bit序号 × 4</text>
          <text x="36" y="272" class="sv-lbl-dim" style="font-size:10.5px">例：想操作 0x20000000 的第 3 位（SRAM 别名区基址 0x22000000）</text>
          <text x="36" y="290" style="font-family:var(--mono);font-size:11.5px;fill:var(--grn)">0x22000000 + (0x20000000 − 0x20000000) × 32 + 3 × 4 = 0x2200000C</text>
        </svg>
```

 

**核心价值：单条 ` str ` 指令完成位操作，天然原子，且省 code 空间。**  在没有位带的芯片上（Cortex-M0/M0\+，以及 *取消了位带的 Cortex-M7 及之后的核* ）， 只能靠 ` BSRR ` 这类硬件提供的原子寄存器。

 

bitband.h — 位带宏实现 C

 

```text
#ifndef BITBAND_H
#define BITBAND_H

#include <stdint.h>

/* 位带区与别名区基址（Cortex-M3/M4，STM32F1/F4 等） */
#define BITBAND_SRAM_BASE      0x20000000UL
#define BITBAND_SRAM_ALIAS     0x22000000UL
#define BITBAND_PERIPH_BASE    0x40000000UL
#define BITBAND_PERIPH_ALIAS   0x42000000UL

/* 通用换算：addr 是目标字地址，bit 是位序号 0-31 */
#define BITBAND_ADDR(alias_base, region_base, addr, bit) \
    ((volatile uint32_t *)((alias_base) + \
      (((uint32_t)(addr) - (region_base)) * 32UL) + ((uint32_t)(bit) * 4UL)))

/* SRAM 位带 */
#define BITBAND_SRAM(addr, bit)   BITBAND_ADDR(BITBAND_SRAM_ALIAS, BITBAND_SRAM_BASE, addr, bit)
/* 外设位带 */
#define BITBAND_PERIPH(addr, bit) BITBAND_ADDR(BITBAND_PERIPH_ALIAS, BITBAND_PERIPH_BASE, addr, bit)

/* ============ 使用示例 ============ */
#if 0
/* 假设要操作 SRAM 里的一个标志变量 */
static uint32_t g_flags;

/* 传统方式：读-改-写，3 条以上指令，非原子 */
void set_flag_bad(void) { g_flags |= (1UL << 5); }

/* 位带方式：1 条 str 指令，原子 */
void set_flag_good(void) { *BITBAND_SRAM(&g_flags, 5) = 1; }
void clr_flag_good(void) { *BITBAND_SRAM(&g_flags, 5) = 0; }
int  get_flag_good(void) { return *BITBAND_SRAM(&g_flags, 5) ? 1 : 0; }

/* 在外设上：操作 GPIOA 的 ODR 寄存器第 5 位（PA5） */
#define GPIOA_ODR  (*(volatile uint32_t *)0x4001080CUL)
void led_on_bitband(void)  { *BITBAND_PERIPH(&GPIOA_ODR, 5) = 1; }  /* 一次 str，原子 */
void led_off_bitband(void) { *BITBAND_PERIPH(&GPIOA_ODR, 5) = 0; }  /* 一次 str，原子 */

/* ❌ 不要这样写"翻转"：
 *      *BITBAND_PERIPH(&GPIOA_ODR, 5) ^= 1;
 *    它展开成   t = *alias;  t ^= 1;  *alias = t;   仍然是"读-改-写"三步，
 *    中断落在中间照样会出错（甚至把两次翻转互相抵消）。
 *    位带只保证【单次 32 位写】是原子的，它不提供硬件异或——
 *    Cortex-M 里根本没有"位带 XOR"这种东西，别名区只能写 0 或 1。
 *    要原子翻转，用软件状态变量记意图，再配合 BSRR（见 6.4 节）。
 */
#endif

#endif /* BITBAND_H */

/* ============================================================
   验证：在 GDB 里对比两种实现的指令数

   (gdb) disassemble set_flag_bad
       ldr r3, [pc, #8]      ; 取 g_flags 地址
       ldr r2, [r3]          ; 读
       orr r2, r2, #32       ; 改
       str r2, [r3]          ; 写回    ← 4 条指令，中间可被中断打断
       bx  lr

   (gdb) disassemble set_flag_good
       ldr r3, [pc, #4]      ; 取别名地址 0x22000000+20
       movs r2, #1
       str r2, [r3]          ; 单条写入，硬件自动置位    ← 1 条指令
       bx  lr

   反面写法也一并看看，证据就摆在指令里：
   (gdb) disassemble led_toggle_bitband        ; 里面写的是 *alias ^= 1
       ldr r3, [pc, #12]     ; 取别名地址
       ldr r2, [r3]          ; 读别名    ← 一旦有这条 ldr，就不再原子了
       eors r2, r2, #1       ; 异或
       str r2, [r3]          ; 写回      ← 中断落在 ldr 和 str 之间就出错
       bx  lr
   ============================================================ */
```

 

⚠ 位带的四个限制

 

 
1. **只有 Cortex-M3 / M4 支持 —— 而且只到 M4 为止。**  位带 **不是 ARMv7-M 架构规定的特性** ：ARMv7-M 架构参考手册（ARM DDI 0403） 通篇没有"位带"这个词，它只是 M3 / M4 这两款 **具体实现** 额外加的可选功能 —— Cortex-M4 的技术参考手册（ARM DDI 0439）把位带列在 "Configurable options" 里， 原话是  *"Bit-banding is an optional feature of the Cortex-M4 processor."*  （Cortex-M3 的 TRM，ARM DDI 0337，则把位带当作程序员模型下的正式章节来写，没有标注 optional）。 既然是"实现可选项"，ARM 在 Cortex-M7 上就直接把这个特性 **省掉了** ： M7 的存储映射里根本没有 ` 0x22000000 ` / ` 0x42000000 ` 这两个别名区，往那儿写不会报错，但也不会作用到目标位。 Cortex-M7 的技术参考手册（ARM DDI 0489）里唯一一次提到位带，是这么一句：  *"Code designed for the Cortex-M3 and Cortex-M4 processors is compatible with the Cortex-M7 processor as long as it does not rely on bit-banding."*  —— 直说"从 M3/M4 移植到 M7 时，不能依赖位带"。   
   所以实际的适用面是：   
   ·  **Cortex-M3 / M4** ：有。STM32F1 / F4、GD32F1/F3 之类都在此列 —— 本站的主平台正好都能用。   
   ·  **Cortex-M0 / M0\+** ：没有（架构里就没有）。STM32F0、G0、L0 等。   
   ·  **Cortex-M7 及之后** ：没有。STM32F7 / H7 不可用，STM32H7 的参考手册 RM0433 全文不含位带章节。ARMv8-M（M33 / M55 / M85）同样没有。   
    *这也意味着：写给 F1 的位带代码迁到 F7/H7 上会"编译通过、毫无效果"—— 这是从 M3 换到 M7 时最隐蔽的一类移植事故。位带代码一定要和平台宏绑在一起， 换个核就自动退回 BSRR。*
 
2. **只覆盖 1 MB 的 SRAM 和 1 MB 的外设区** 。地址超出这个范围就没有别名区。   
   STM32 的做法是 **照抄内核规定的整 1 MB，不按芯片实际容量裁剪** 。 ST 的编程手册（Cortex-M4 的 PM0214 §2.2.4 内存映射表、§2.2.5「Bit-banding」表 14/15） 把两段区域钉死为： SRAM 位带区 ` 0x20000000–0x200FFFFF ` → 别名区 ` 0x22000000–0x23FFFFFF `； 外设位带区 ` 0x40000000–0x400FFFFF ` → 别名区 ` 0x42000000–0x43FFFFFF ` （这正是上面 ` bitband.h ` 里那四个基址的出处）。   
   所以" *算得出别名地址* "和" *这个地址上真有一块存储单元* "是两件事： 位带区名义上 1 MB，但 F103 只有 20 KB SRAM、F407 只有 128/192 KB —— 落在真实存储之外的别名地址， 读写都不报错，也都不生效。   
    **一个只有 F4 才会踩到的坑：CCM RAM 在 ` 0x10000000 `** ， 不在 ` 0x20000000 ` 开头的那 1 MB 里， **因此没有别名地址、不可位带**  （RM0090 §2.3.3：CCM "is not part of the bus matrix and can be accessed only through the CPU"）。 "把热点变量挪进 CCM 提速 \+ 用位带原子访问它"这个组合在 F4 上会静默失效 —— 两个优化各自都对，凑一起就不行。
 
3. **别名区地址不能直接用 ` & ` 取** ，也不能做指针运算后访问——必须精确算出 4 字节对齐的别名地址。 上面宏里的 ` volatile uint32_t * ` 强制转换是必须的。
 
4. **能原子"置位/清位/读位"，不能原子"翻转"** 。别名区只接受"写 0 或写 1"这一个动作， 硬件里没有"位带异或"。所以 ` *alias ^= 1 ` 会退化回读-改-写——  *看见 ` ^= `、` |= `、` &= ` 出现在位带指针上，就是写错了* 。 原子翻转必须靠软件状态变量或临界区，见 6.4 节。

  

```zhizhan-anchor
ch6-2b
```



### 6.2.1 位带的四个坑：编译器一个都不会替你拦

 

上面那四条限制是"知道就行"。下面这四条不一样 —— 它们的共同点是 **出错时没有任何反馈** ： 编译通过、下载成功、程序也不崩，只是那个灯不亮（或者 [DMA](term:dma) 搬回来的数据永远是旧值）。 所以这几条得当心法记住。

 

#### 坑一：选型 —— 同一份代码，一半的板子上是死的

 

| 内核 | 位带 | 常见 STM32 系列 | 依据 |
| --- | --- | --- | --- |
| Cortex-M3 | 有 | STM32F1、F2 | M3 的 TRM（ARM DDI 0337）把位带写进"程序员模型"章节， **没有** 标注 optional |
| Cortex-M4 | 有 | STM32F3、F4、L4、G4 | M4 的 TRM（ARM DDI 0439）把它列在 "Configurable options"，原话是 optional |
| Cortex-M0 / M0\+ | 无 | STM32F0、G0、L0、C0 | ARMv6-M 架构里根本没有这个特性 |
| Cortex-M7 | 无 | STM32F7、H7 | M7 的 TRM（ARM DDI 0489）全文只提到位带一次，内容是"别依赖它"的兼容性警告 |
| Cortex-M33 / M55 / M85 | 无 | STM32L5、U5、H5、WBA | ARMv8-M 不再提供位带 |

 

"内核 ↔ 系列"这一列是 **手册事实** （本站工具链验证不了它，来源是各系列数据手册的器件选型表）； "有 / 无"这一列有 ARM 官方文档的逐条出处，就是最后一列。 两张表对起来看，结论很直接： **写给 F1 的位带代码，搬到 F7 / H7 / L5 / U5 上不会报任何错。**  所以位带代码不要裸写，包一层平台宏，在没有位带的核上自动退回 ` BSRR `。

 

#### 坑二：别名区只有内核自己能访问 —— DMA 用不了

 

这一条最容易被忽略，因为它的直觉是反的：既然 ` 0x42210194 ` 写进去就等于写 ` 0x4001080C ` 的第 5 位，那让 DMA 往别名地址搬数据，不就能自动置位了吗？  **不行。**  两本 ST 参考手册都写死了这件事，措辞几乎一样：

 

📖 手册原文（两处，措辞几乎相同）

 

**F4 — RM0090 Rev 22 §2.3.3「Bit banding」（印刷页 68–69）**   
  *"In the STM32F4xx devices both the peripheral registers and the SRAM are mapped to a bitband region, so that single bit-band write and read operations are allowed.  **The operations are only available for Cortex®-M4 with FPU accesses, and not from other bus masters (e.g. DMA).** "*

 

**F1 — RM0008 DocID13902 Rev 17 §3.3.2「Bit banding」（印刷页 52）**   
  *"In the STM32F10xxx both peripheral registers and SRAM are mapped in a bit-band region. This allows single bit-band write and read operations to be performed.  **The operations are only available for Cortex®-M3 accesses, not from other bus masters (e.g. DMA).** "*

 

为什么是这样？回到位带的实现方式就明白了。ARM 的 Cortex-M3 / M4 技术参考手册在 "Bit-banding" 一节里描述这套逻辑挂在谁身上：

 

📖 手册原文（ARM DDI 0337 rev h / DDI 0439 rev b，Cortex-M3 / M4 的 "Bit-banding" 一节）

  *"The System bus interface contains logic that controls bit-band accesses as follows: It remaps bit-band alias addresses to the bit-band region. For reads, it extracts the requested bit from the read byte, and returns this in the Least Significant Bit (LSB) of the read data returned to the core. For writes, it converts the write to an atomic read-modify-write operation."*

 

关键词是  **"The System bus interface"**  —— 做重映射的那块逻辑长在 **处理器内核的 系统总线接口里** ，是内核的一部分。DMA 控制器是挂在总线矩阵上的另一个主设备， 它发出的访问 **根本不经过内核的这层逻辑** ： 对 DMA 来说 ` 0x42210194 ` 就只是别名区里的一个普通字， 写进去既不置位、读出来也不是那个位。   
所以结论很干脆： **位带是"给 CPU 用"的原子操作手段，不是给 DMA 用的。**  需要 DMA 搬运的数据，地址一律用寄存器原地址（这里是 ` 0x4001080C `）； 上面那段反汇编恰好把这两个地址并排摆出来了 —— 位带写法产生的是 ` 0x42210194 `，原写法产生的是 ` 0x4001080C `， 它们在硬件上是 **两套解码路径** ，不是同一个地址的两种写法。

 

💡 顺带说清楚一条"查不到的出处"

 这条限制在 ST 的  **PM0214（Cortex-M4 编程手册）** 里是 **查不到** 的 —— 它的 §2.2.5「Bit-banding」只讲了重映射和"指令取指不被重映射"，全文的位带段落里  **一次都没出现 DMA** 。所以别拿 PM0214 当这条的出处，要引就引具体芯片的 参考手册（RM0090 / RM0008）。   
这也是一条通用的查证习惯： **架构手册讲"能不能"，芯片手册讲"这颗上是不是这样"** ， 两者都不能互相顶替。

 

#### 坑三：别名地址得自己算，算错了没人告诉你

 

位带的换算规则只有两条： **目标地址每 \+1 字节，别名地址 \+32 字节** ；  **位号每 \+1，别名地址 \+4 字节** 。规则简单，可它是纯算术 —— 抄错一个十六进制数，编译器、链接器、调试器都不会有任何意见。 唯一的办法是把它 **搬到编译期** ，让编译器每天替你复核一遍。

 

bitband\_alias.c — 把位带换算写成 \_Static\_assert C

 

```text
/* bitband_alias.c — 别名地址是编译期常量：让编译器替你复核这套换算
 *
 * 位带的换算规则本身不难记（跨一个字节 = 别名跨 32 字节；位号 +1 = 别名 +4 字节），
 * 难的是【抄错一个常数没有任何人会发现】：灯不亮你会去查电路、查时钟、查引脚复用，
 * 最后才怀疑到一个写错的十六进制数上。
 *
 * 下面这组断言把规则搬到编译期：谁把 32 改成 16、把别名基址写错，编译立刻失败。
 *
 * ⚠ 两点都是踩出来的：
 *
 *   一、断言里只能用【整数宏】（..._BASE / ..._ALIAS），不能用 BITBAND_SRAM() /
 *       BITBAND_PERIPH() —— 它们产出的是指针。GCC 对这件事分两档，都很坑：
 *         · 参数是"真变量的地址"（&g）：直接 error，连 -Wall 都不用加；
 *         · 参数是"常量地址强转成指针"：-Wall -Wextra 下【静默通过】，只有加
 *           -Wpedantic 才警告 "... is not an integer constant expression"。
 *       第二种最危险 —— 它编得过、算出来的值也对，只是标准 C 不保证。
 *
 *   二、断言里那句说明文字【写 ASCII】。写中文的话，一旦断言失败，GCC 会把每个
 *       非 ASCII 字节转义成八进制，你看到的是
 *           static assertion failed: "\37777777744\37777777670..."
 *       而不是人话（加 -finput-charset=UTF-8 也没用）。中文写在注释里就好。
 */
#include <stdint.h>
#include "bitband.h"

/* ---- 1. 两个别名区基址，就是 Cortex-M 存储映射里规定的数 ---- */
_Static_assert(BITBAND_SRAM_ALIAS   == 0x22000000UL, "SRAM alias base");
_Static_assert(BITBAND_PERIPH_ALIAS == 0x42000000UL, "periph alias base");

/* ---- 2. 位带区 1 MB → 别名区 32 MB：比值必须是 32，两段都要对 ---- */
_Static_assert(BITBAND_SRAM_ALIAS   - BITBAND_SRAM_BASE   == 32UL * 1024 * 1024,
               "SRAM: 1MB bit-band region -> 32MB alias region");
_Static_assert(BITBAND_PERIPH_ALIAS - BITBAND_PERIPH_BASE == 32UL * 1024 * 1024,
               "periph: 1MB bit-band region -> 32MB alias region");

/* ---- 3. 换算规则本身：目标地址 +1 字节 → 别名 +32 字节；位号 +1 → 别名 +4 字节 ---- */
_Static_assert(BITBAND_SRAM_ALIAS + (0x20000001UL - BITBAND_SRAM_BASE) * 32UL == 0x22000020UL,
               "target address +1 byte -> alias address +32 bytes");
_Static_assert(BITBAND_SRAM_ALIAS + (0x20000000UL - BITBAND_SRAM_BASE) * 32UL + 1UL * 4UL == 0x22000004UL,
               "bit number +1 -> alias address +4 bytes");

/* ---- 4. 边界：位带区最后一个字节的最后一位，别名仍落在别名区之内 ---- */
_Static_assert(0x200FFFFFUL <  BITBAND_SRAM_BASE + 1024UL * 1024UL, "0x200FFFFF inside");
_Static_assert(!(0x20100000UL < BITBAND_SRAM_BASE + 1024UL * 1024UL), "0x20100000 outside");

/* ---- 5. 只有 F4 会踩的坑：CCM RAM 在 0x10000000，不在位带区那 1 MB 里 ---- */
_Static_assert(!(0x10000000UL >= BITBAND_SRAM_BASE &&
                 0x10000000UL <  BITBAND_SRAM_BASE + 1024UL * 1024UL),
               "CCM RAM is outside the bit-band region");

/* ============================================================
   下面是三个【真正会被用到】的别名地址。写成宏再拿去填表，而不是直接写表里 ——
   直接写表里就【没人检查】了：const 数组的下标不是整数常量表达式，塞不进
   _Static_assert。先断言、再拿宏去填表，两处就绑成了一处。

   别小看这一点：把 PA5 那个位号 5 改成 6，如果只写在表里，编译一无所知，
   板子上表现就是"灯不亮"。这种事查起来能查一整天。
   ============================================================ */
#define ALIAS_SRAM_BIT0  (BITBAND_SRAM_ALIAS   + (0x20000000UL - BITBAND_SRAM_BASE)   * 32UL + 0UL  * 4UL)
#define ALIAS_PA5        (BITBAND_PERIPH_ALIAS + (0x4001080CUL - BITBAND_PERIPH_BASE) * 32UL + 5UL  * 4UL)
#define ALIAS_SRAM_LAST  (BITBAND_SRAM_ALIAS   + (0x200FFFFCUL - BITBAND_SRAM_BASE)   * 32UL + 31UL * 4UL)

_Static_assert(ALIAS_SRAM_BIT0 == 0x22000000UL, "first alias word = SRAM 0x20000000 bit0");
_Static_assert(ALIAS_PA5       == 0x42210194UL, "PA5 = STM32F1 GPIOA_ODR(0x4001080C) bit5");
_Static_assert(ALIAS_SRAM_LAST == 0x23FFFFFCUL, "last alias word = SRAM 0x200FFFFC bit31");

/* 让这三个数原样落进 .rodata，用 objdump -s 就能读出来（正文有实测输出） */
const uint32_t alias_table[3] = { ALIAS_SRAM_BIT0, ALIAS_PA5, ALIAS_SRAM_LAST };
```

 

这个文件在 M3 / M4 / M0 三个核上都是 **零告警** 通过的。下面这条命令 **不加**  ` -j .rodata `，把整份段表都 dump 出来 —— 顺便能看到一件小事：

 

**bash**  — 编译并 dump 全部段（` -mcpu=cortex-m3 -mthumb -std=c11 -O2 `）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c bitband_alias.c
$ arm-none-eabi-objdump -s bitband_alias.o

Contents of section .rodata:
 0000 00000022 94012142 fcffff23           ..."..!B...#    
Contents of section .comment:
 0000 00474343 3a202841 726d2047 4e552054  .GCC: (Arm GNU T
 0010 6f6f6c63 6861696e 2031332e 332e5265  oolchain 13.3.Re
 0020 6c312028 4275696c 64206172 6d2d3133  l1 (Build arm-13
 0030 2e323429 29203133 2e332e31 20323032  .24)) 13.3.1 202
 0040 34303631 3400                        40614.          
Contents of section .ARM.attributes:
 0000 412c0000 00616561 62690001 22000000  A,...aeabi.."...
 0010 05372d4d 00060a07 4d090212 04140115  .7-M....M.......
 0020 01170318 0119011a 011e0222 01        ...........".
```

 

三个字依次是 ` 0x22000000 `（别名区第一个字）、 ` 0x42210194 `（PA5）、` 0x23FFFFFC `（别名区最后一个字）。  **把断言、宏、表绑成一处** 是关键：这三个数先写成宏、被断言检查、再拿去填表， 所以改错任何一处都会在编译期炸出来。

 

💡 顺带看一件事：这个文件 **没有 ` .text `**

 段表里只有 ` .rodata `、` .comment `、 ` .ARM.attributes ` 三个 ——  **没有 ` .text `、没有 ` .data `、没有 ` .bss `** 。 因为 ` _Static_assert ` 在编译期就消失了，一行指令都不生成； 这个文件对固件的全部贡献就是 ` .rodata ` 里那 12 个字节。   
这就是" **零运行时开销** "最直接的证据 —— 不是"应该没有开销"，是段表里确实查无此段。 （` .comment ` 是 GCC 盖的版本戳，` .ARM.attributes ` 记的是 ` 7-M ` 这类架构属性；两者都不占 Flash 的运行时空间，但都在告诉你"这份 .o 是谁、 按哪个架构编的"。）

 

实测一下断言是怎么炸的 —— 把 PA5 的位号从 5 改成 6：

 

**bash**  — 故意把 PA5 的位号写成 6，看编译器怎么反应

 

```text
$ sed -i 's/+ 5UL  \* 4UL)/+ 6UL  * 4UL)/' bitband_alias.c   # 把 PA5 的位号 5 改成 6
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c bitband_alias.c

bitband_alias.c:64:1: error: static assertion failed: "PA5 = STM32F1 GPIOA_ODR(0x4001080C) bit5"
   64 | _Static_assert(ALIAS_PA5       == 0x42210194UL, "PA5 = STM32F1 GPIOA_ODR(0x4001080C) bit5");
      | ^~~~~~~~~~~~~~
```

 

这就是想要的效果：错误在 **编译期** 、带着 **具体是哪一条** 、而且不用上板子。 注意报错里那句话是可读的英文 —— 这不是偶然，见下面的提醒。

 

💡 静态断言的说明文字请写 ASCII

 实测：断言里的说明文字如果写中文，一旦触发，GCC 会把每个非 ASCII 字节转义成八进制， 你看到的是一串 ` "\37777777744\37777777670…" `，完全读不出人话； 加 ` -finput-charset=UTF-8 ` 也一样。同样的断言换成 ASCII 文字，输出就是干净的原文。   
所以： **代码里的中文写注释，别写进断言消息**  —— 那行字是给"将来出错的你"看的， 恰恰是最需要可读的地方。

 

⚠ 别名地址不能塞进 ` _Static_assert `，两种写法都很坑

 ` bitband.h ` 里的 ` BITBAND_SRAM() ` / ` BITBAND_PERIPH() ` 产出的是 **指针** ，指针进不了静态断言的常量表达式。 GCC 对这件事的态度分两档，两档都容易让人误判：   
· 参数是 **真变量的地址** （` &g_flags `）：直接 ` error `， 连 ` -Wall ` 都不用加；   
· 参数是 **常量地址强转成指针** ：门禁那套 ` -Wall -Wextra ` 下 **静默通过** ， 只有补上 ` -Wpedantic ` 才会警告。   
第二种最危险 —— 它编得过、算出来的值也对，只是标准 C 不保证。 所以记地址就用上面那种纯整数式。

 

#### 坑四：编译器和 ` -Wall ` 都不会告诉你"这个核没有位带"

 

最容易吃的一次亏在这里。下面这个文件没有任何平台判断，就是最普通的位带用法：

 

bitband\_insn.c — 位带真正省掉的是什么 C

 

```text
/* bitband_insn.c — 位带省掉的到底是什么？把两种写法各编一遍，数指令
 *
 * 同一个动作（把 PA5 拉高），两种写法：
 *   传统：取 ODR 地址 → 读整个字 → 置位 → 写回
 *   位带：取别名地址 → 直接写 1
 *
 * 差别不在"少一条指令"，而在【少了那一次读】—— 读和写之间的窗口可以被
 * 中断、可以被 DMA、可以被另一个核塞进来，单次写入没有这个窗口。
 *
 * ⚠ 这个文件在 cortex-m0 上【照样编得过、也没有任何告警】，而它生成的
 *   别名地址 0x42210194 所在的那段区域，在 M0 上并不存在。见正文实测。
 */
#include <stdint.h>
#include "bitband.h"

#define GPIOA_ODR  (*(volatile uint32_t *)0x4001080CUL)   /* STM32F1：PA5 = ODR 第 5 位 */

/* 传统写法：读-改-写，读和写之间可以被中断打断 */
void led_on_plain(void)   { GPIOA_ODR |= (1UL << 5); }

/* 位带写法：只对别名地址写一次，置位由硬件完成 */
void led_on_bitband(void) { *BITBAND_PERIPH(&GPIOA_ODR, 5) = 1; }
```

 

先在有位带的 M3 上编：

 

**bash**  — M3 实测（` -O2 -mcpu=cortex-m3 -mthumb `，objdump -d）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c bitband_insn.c -o bitband_insn.o
$ arm-none-eabi-objdump -d bitband_insn.o

00000000 <led_on_plain>:
   0:	4a03      	ldr	r2, [pc, #12]	@ (10 <led_on_plain+0x10>)   ← 字面量池里取的是 ODR 所在的【页基址】
   2:	f8d2 380c 	ldr.w	r3, [r2, #2060]	@ 0x80c   ← 读整个 ODR —— 这一读就是竞态的窗口
   6:	f043 0320 	orr.w	r3, r3, #32   ← 置第 5 位
   a:	f8c2 380c 	str.w	r3, [r2, #2060]	@ 0x80c   ← 把整个字写回去：读和写之间可以被中断
   e:	4770      	bx	lr
  10:	40010000 	.word	0x40010000   ← 基址 0x40010000，剩下的 0x80C 折进了上面的 ldr 偏移

00000014 <led_on_bitband>:
  14:	2201      	movs	r2, #1   ← 要写的值：1
  16:	4b02      	ldr	r3, [pc, #8]	@ (20 <led_on_bitband+0xc>)   ← 取别名区基址
  18:	f8c3 2194 	str.w	r2, [r3, #404]	@ 0x194   ← ★ 一次写入，没有 ldr —— 不可打断
  1c:	4770      	bx	lr
  1e:	bf00      	nop
  20:	42210000 	.word	0x42210000   ← 0x42210000 + 0x194 = 0x42210194，正是 PA5 的别名地址
```

 

先看条数：M3 上两边 **都是 5 条**  —— 位带那一版并没有更短。它多出来的第 5 条是 ` nop `（` bf00 `），编译器为了对齐后面的字面量池补的， 不属于函数逻辑。   
（"条数"的口径写死在这儿：` objdump -d ` 里从函数标签数到下一个空行，  **排除**  ` .word ` 这类字面量池数据行 —— 不排除的话常量会被当成指令， 两边会各多出一条。这个数由门禁逐条复核，不是人眼数的。）   
所以 **真正的差别不在条数，而在有没有那一条 ` ldr `** ： 传统写法必须先把整个 ODR 读出来才能改，读和写之间就是一个可以被中断、被 DMA、被另一个执行流插进来的窗口； 位带写法只有一次 ` str `，没有窗口。   
另外注意 ` 0x42210194 ` 是被拆成两截的：字面量池里只有 ` 0x42210000 `，剩下的 ` 0x194 `（=404）折进了 ` str.w ` 的立即数偏移里 —— 这是 ARM 指令编码的限制，不是地址算错了。

 

现在， **一个字都不改** ，把编译器换成 Cortex-M0：

 

**bash**  — 同一份文件、同一条命令行，只把 ` -mcpu ` 换成 cortex-m0

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O2 -c bitband_insn.c -o bitband_insn.o
$ arm-none-eabi-objdump -d bitband_insn.o

00000000 <led_on_plain>:
   0:	2120      	movs	r1, #32   ← M0 没有"orr 立即数"这条指令：掩码得先放进寄存器
   2:	4a02      	ldr	r2, [pc, #8]	@ (c <led_on_plain+0xc>)   ← 取 ODR 地址
   4:	6813      	ldr	r3, [r2, #0]   ← 读整个字
   6:	430b      	orrs	r3, r1   ← 置位
   8:	6013      	str	r3, [r2, #0]   ← 写回：6 条指令，比 M3 还多一条
   a:	4770      	bx	lr
   c:	4001080c 	.word	0x4001080c   ← M0 没有 ldr.w 的 12 位偏移，只能把完整地址放进池子

00000010 <led_on_bitband>:
  10:	2201      	movs	r2, #1   ← 要写的值：1
  12:	4b01      	ldr	r3, [pc, #4]	@ (18 <led_on_bitband+0x8>)   ← 取别名地址
  14:	601a      	str	r2, [r3, #0]   ← 同样只有一次写入
  16:	4770      	bx	lr
  18:	42210194 	.word	0x42210194   ← ★ 这个地址在 M0 上不存在 —— 编译器和链接器都不会告诉你
```

 

换成 M0 之后 **指令序列整个变了** （Thumb-1 没有 ` orr.w ` 这种双字指令， 编译器的选择完全换了套打法），条数这才拉开： **6 条对 4 条** 。 但这 4 条 **照样是一条不缺的位带写入**  —— 唯一的区别是那个地址 ` 0x42210194 ` 没有任何硬件应答。 注意这一点： **从指令层面完全看不出对错** ，这恰恰是它危险的地方。

 

把告警开到最严，再并排验一次 —— 这是"编译器不吭声"这句话的直接证据：

 

**bash**  — 同一份源码，两个核，都加上 ` -Wall -Wextra `

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -fsyntax-only bitband_insn.c
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -Wall -Wextra -fsyntax-only bitband_insn.c

（两条命令都：无任何输出，退出码 0）
```

 

💀 同一份代码，M0 上照样编过、零告警 —— 而且它把 0x42210194 写进了字面量池

 对比两边的退出码和告警数： **完全一样** （都是 0 退出、0 告警）。 编译器只知道"你在往一个地址写数"，它不知道这个地址所在的那 32 MB 别名区在 M0 上根本不存在。   
后果是：` led_on_bitband() ` 在 M0 上照样生成了一条干净的 ` str `、照样返回、 **什么都不做** 。 没有 HardFault —— 因为那段地址空间不是"非法访问"，只是"没有人应答"。   
 **这就是位带事故的完整画像：编译过、下载成功、灯不亮。**  所以位带代码一定要和平台宏绑死，换个核就自动退回 ` BSRR `； 凡是"编译通过"就当没事的验收方式，在这类问题上完全不设防。

  

```zhizhan-anchor
ch6-3
```



## 6.3 位域（Bit-field）：看起来很美的陷阱

 

C 语言提供了 ` struct ` 位域语法，看起来是描述寄存器布局的理想工具。但它在嵌入式里的 **实际表现高度依赖编译器** 。

 

bitfield\_trap.c — 位域的真实问题 C

 

```text
#include <stdint.h>
#include <stdio.h>

/* ============ 陷阱 1：位序依赖编译器 ============ */
typedef struct {
    uint32_t enable   : 1;
    uint32_t mode     : 3;
    uint32_t speed    : 2;
    uint32_t reserved : 2;
    uint32_t counter  : 16;
    uint32_t          : 8;      /* 无名填充 */
} ctrl_bits_t;

/* ARM GCC 在 little-endian 下：第一个成员在最低位
   bit[0] = enable, bit[3:1] = mode, bit[5:4] = speed ... */

/* 但如果你把这个结构体用于网络协议解析（大端字节序），
   或者换一个编译器 → 位序可能完全反过来 */

/* ============ 陷阱 2：volatile + 位域 = 灾难 ============ */
typedef struct {
    volatile uint32_t flag_a : 1;
    volatile uint32_t flag_b : 1;
    volatile uint32_t data   : 30;
} status_t;

/* ✕ 编译器无法对位域做原子访问。
   写 flag_a 时，它需要：读整个 32 位 → 改 bit0 → 写回整个 32 位。
   如果这期间硬件改了 data 字段 → 你的写回会覆盖掉硬件的变化！
   volatile 只保证"每次都真的读写内存"，不能保证"只写那一位" */

/* ============ 陷阱 3：不能取地址、不能 sizeof 单成员 ============ */
void func(ctrl_bits_t *c)
{
    /* &c->mode;        ✕ 编译错误：位域没有地址 */
    /* sizeof(c->mode);  ✕ 编译错误 */
    /* 不能对位域用 & 运算符 —— 因为它不属于任何字节边界 */
}

/* ============ 陷阱 4：跨编译器二进制不兼容 ============ */
/* 用位域描述硬件寄存器 → 换编译器/换优化等级 → 布局可能变 → 寄存器配置全错
   最保险的做法：不用位域描述硬件，改用"掩码 + 移位"宏 */

/* ============ 正确做法：掩码宏 ============ */
#define CTRL_ENABLE_Pos     0
#define CTRL_ENABLE_Msk     (1UL << CTRL_ENABLE_Pos)
#define CTRL_MODE_Pos       1
#define CTRL_MODE_Msk       (0x7UL << CTRL_MODE_Pos)
#define CTRL_SPEED_Pos      4
#define CTRL_SPEED_Msk      (0x3UL << CTRL_SPEED_Pos)
#define CTRL_COUNTER_Pos    8
#define CTRL_COUNTER_Msk    (0xFFFFUL << CTRL_COUNTER_Pos)

static inline void ctrl_config(volatile uint32_t *reg,
                               uint32_t enable, uint32_t mode,
                               uint32_t speed, uint32_t counter)
{
    uint32_t t = *reg;
    t &= ~(CTRL_ENABLE_Msk | CTRL_MODE_Msk | CTRL_SPEED_Msk | CTRL_COUNTER_Msk);
    t |= (enable  << CTRL_ENABLE_Pos)
      |  ((mode   << CTRL_MODE_Pos)   & CTRL_MODE_Msk)
      |  ((speed  << CTRL_SPEED_Pos)  & CTRL_SPEED_Msk)
      |  ((counter<< CTRL_COUNTER_Pos)& CTRL_COUNTER_Msk);
    *reg = t;
}

/* ============ 位域唯一合适的场景：纯软件内部数据结构 ============ */
/* 不进硬件、不跨平台传输、同一编译器编译 —— 这时位域可以省内存 */
typedef struct {
    uint8_t  is_active   : 1;
    uint8_t  has_error   : 1;
    uint8_t  retry_count : 3;
    uint8_t  priority    : 3;
} __attribute__((packed)) task_flags_t;   /* 1 字节 */

/* 注意：即便这样，也要在编译期确认大小 */
_Static_assert(sizeof(task_flags_t) == 1, "task_flags_t 应该正好 1 字节");
```

 

◆ 位域使用准则

 

**用它来描述硬件寄存器？——不要。** 用掩码宏。  
  **用它来压缩纯软件的内部数据结构？——可以，但必须用 ` _Static_assert ` 验证大小。**   
  **用它来做协议帧解析？——绝对不要。** 协议有明确的字节序规定，位域没有。  *这正是 Module 01 讲的字节序问题会咬人的地方。*

  

#### 位域的四个硬规则

 

上面说的「别用位域描述硬件」，指的是 *别拿它当寄存器映射* 。位域在纯软件场合仍然有价值 —— 压缩一堆布尔标志、解析自家定义的报文。要用得踏实，先得知道编译器对它定下的四条硬规则。 这四条下面全部有实测证据，不是「据说」。

 

| # | 规则 | 具体表现 |
| --- | --- | --- |
| ① | **布局由实现决定** | 标准只规定「同一存储单元内的分配方式由实现定义」，跨存储单元更是完全自由。 同一个结构体，GCC 和 IAR 排出来的字节可能不一样 —— 所以  **位域不能用来描述跨编译器、跨网络的二进制协议** |
| ② | **` :0 ` 是强制换单元，无名 ` :8 ` 只是留空位** | 这两个写法长得像，作用完全不同。` :0 ` 把下一个字段推到  *下一个存储单元* 的开头；无名 ` :8 ` 只是在本单元里空出 8 位， 下一个字段 *紧跟着* 填。差别在于「换不换单元」，不在于「空几位」 |
| ③ | **宽度 1 的有符号位域只能表示 0 和 −1** | ` int32_t flag : 1 ` 是 *补码* 的一位字段，取值范围是 ` {0, −1} `，不是 ` {0, 1} `。 拿它当布尔用，` if (s->flag) ` 能正常工作（非零即真）， 但一旦参与算术、或者被赋成 ` 2 ` 之类，结果就不是你以为的那个数了 |
| ④ | **位域没有地址，也没有类型** | 不能 ` & `、不能 ` sizeof `、不能 ` offsetof `，也不存在「指向位域的指针」。原因很直接： 一个位域可能 *不足一个字节* ，也可能 *横跨两个字节* ， 「地址」这个概念对它根本不成立 |

 

规则 ① 和 ② 的解决办法是同一个： **把布局写进编译期断言，让编译器替你确认， 而不是靠你记住** 。下面这块代码里每一行 ` _Static_assert ` 都是一个真实的布局事实 —— 断言过不去，就编不出来：

 

bitfield\_layout.c — 用断言把布局钉死 C

 

```text
/* bitfield_layout.c — 位域的布局由实现决定：用断言把它钉死，别靠猜 */
#include <stdint.h>
#include <stddef.h>

/* ① 普通位域：三个 6 位字段共 18 位，落在一个 32 位存储单元里 */
struct flags { uint32_t a : 6; uint32_t b : 6; uint32_t c : 6; };

/* ② packed：按字节紧排，18 位压进 3 字节 —— 代价是 b 和 c 都跨了字节边界 */
struct tight { uint8_t a : 6; uint8_t b : 6; uint8_t c : 6; } __attribute__((packed));

/* ③ 跨存储单元：12 位的 val 从前一字节的末尾接下去，tail 被挤到第 4 字节 */
struct mix { uint8_t tag; uint32_t val : 12; uint8_t tail; };

/* ④ 1 位有符号：取值只有 0 和 -1 */
struct sign1 { int32_t flag : 1; };

_Static_assert(sizeof(struct flags) == 4, "三个 6 位字段占满一个存储单元");
_Static_assert(sizeof(struct tight) == 3, "packed 版只占 3 字节");
_Static_assert(sizeof(struct mix)   == 4, "val 跨存储单元，tail 落在第 4 字节");
_Static_assert(offsetof(struct mix, tail) == 3, "tail 的字节偏移是 3");
_Static_assert(sizeof(struct sign1) == 4, "位域容器仍是 int32");

int32_t sign_extend(struct sign1 *s) { return s->flag; }   /* 取出来是 -1，不是 1 */

void set_flags_a(volatile struct flags *f, uint32_t v) { f->a = v; }
void set_tight_a(volatile struct tight *t, uint32_t v) { t->a = v; }
void set_tight_c(volatile struct tight *t, uint32_t v) { t->c = v; }
```

 

大小这件事编译期就定了。 **真正要在运行时付出代价的是「写」**  —— 看编译器为上面那三个 ` set_* ` 生成了什么：

 

**bash**  — 实测反汇编（` -O2 -mcpu=cortex-m3 -mthumb `，objdump -d）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c bitfield_layout.c -o bitfield_layout.o
$ arm-none-eabi-objdump -d bitfield_layout.o

00000000 <sign_extend>:
   0:	7800      	ldrb	r0, [r0, #0]   ← sbfx 抽出 1 位再符号扩展 —— 取出来是 -1，不是 1
   2:	f340 0000 	sbfx	r0, r0, #0, #1
   6:	b240      	sxtb	r0, r0
   8:	4770      	bx	lr
   a:	bf00      	nop

0000000c <set_flags_a>:
   c:	6803      	ldr	r3, [r0, #0]    ← 普通位域：一次读-改-写
   e:	f361 0305 	bfi	r3, r1, #0, #6  ← bfi：一条指令把 6 位插进去
  12:	6003      	str	r3, [r0, #0]
  14:	4770      	bx	lr
  16:	bf00      	nop

00000018 <set_tight_a>:
  18:	7803      	ldrb	r3, [r0, #0]   ← packed 的 a 仍在同一字节内，一样是 3 条
  1a:	f361 0305 	bfi	r3, r1, #0, #6
  1e:	7003      	strb	r3, [r0, #0]
  20:	4770      	bx	lr
  22:	bf00      	nop

00000024 <set_tight_c>:
  24:	7843      	ldrb	r3, [r0, #1]   ← packed 的 c 横跨 byte1~byte2 ⇒ 变成【两段】独立的读-改-写
  26:	f001 020f 	and.w	r2, r1, #15
  2a:	f003 030f 	and.w	r3, r3, #15
  2e:	ea43 1302 	orr.w	r3, r3, r2, lsl #4
  32:	7043      	strb	r3, [r0, #1]   ← 第一段写回 byte1
  34:	7883      	ldrb	r3, [r0, #2]   ← 第二段：另起一次读
  36:	f3c1 1101 	ubfx	r1, r1, #4, #2
  3a:	f023 0303 	bic.w	r3, r3, #3
  3e:	430b      	orrs	r3, r1
  40:	7083      	strb	r3, [r0, #2]   ← 第二段写回 byte2
  42:	4770      	bx	lr
```

 

⚠ packed 位域跨字节 = 一次赋值两条读-改-写，这是真的竞态源

 

上面 ` set_tight_c ` 的 11 条指令里，藏着两个 **互相独立** 的 读-改-写序列（` ldrb…strb ` 出现了两次，中间没有任何保护）。它意味着：

 

 
- 一条赋值语句 **不是原子的** ，甚至 **不是单次内存访问**  —— 它碰了两个字节；
 
- 中断如果在第一段和第二段之间插进来，并且也改了 byte1 或 byte2 里的 *别的* 字段， 就会有一方的修改被整个覆盖掉；
 
- 对比 ` set_flags_a `：同样的三个字段，只要不 packed， 就老老实实是 ` ldr ` / ` bfi ` / ` str ` 的 3 条指令、一次读-改-写。
 

 

**结论：packed 位域能省 RAM，代价是把「一次写」变成了「两次读-改-写」。**  6.4 节讲读-改-写竞态时用的是引脚寄存器，容易让人以为「只有碰硬件才要小心」—— 这里说明： *只要结构体里有一个跨字节的 packed 位域，纯软件数据同样会中招* ， 而 ` c ` 看上去只是结构体里一个平平无奇的成员。

 

另外两件事，编译器其实都提示过你，只是很容易被划过去。第一件是  **packed 位域的偏移变过** ——不用开 ` -Wall `，默认就会报：

 

**bash**  — 同一条命令，不加 ` -Wall ` 也有这两条 note

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c bitfield_layout.c
bitfield_layout.c:9:8: note: offset of packed bit-field 'b' has changed in GCC 4.4
    9 | struct tight { uint8_t a : 6; uint8_t b : 6; uint8_t c : 6; } __attribute__((packed));
      |        ^~~~~
bitfield_layout.c:9:8: note: offset of packed bit-field 'c' has changed in GCC 4.4
```

 

这不是在抱怨你的代码，而是在提醒： **GCC 4.4 改过 packed 位域的排布规则** ， 所以更老的 GCC 编出来的二进制和现在 *不兼容* 。它是 ABI 变更留下的一块化石。 维护十年前的老固件时，这条 note 就是「升级编译器会让存储格式变化」的正式通知 —— 这也正是规则 ① 的现实版： *布局是实现的属性，不是语言的属性。*

 

第二件是  **ARMv6-M 没有 ` bfi ` / ` ubfx `** 。 同一个文件、同一个 ` -O2 `，只把目标从 M3 换成 M0：

 

**bash**  — 同一个 ` bitfield_layout.c `，目标换成 ` cortex-m0 `

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O2 -c bitfield_layout.c -o bitfield_layout.o
$ arm-none-eabi-objdump -d bitfield_layout.o

00000000 <sign_extend>:
   0:	7800      	ldrb	r0, [r0, #0]
   2:	07c0      	lsls	r0, r0, #31    ← ARMv6-M 没有 sbfx：lsls + asrs 手工凑出符号扩展
   4:	17c0      	asrs	r0, r0, #31
   6:	4770      	bx	lr

00000008 <set_flags_a>:
   8:	223f      	movs	r2, #63	@ 0x3f
   a:	6803      	ldr	r3, [r0, #0]
   c:	4011      	ands	r1, r2
   e:	4393      	bics	r3, r2
  10:	430b      	orrs	r3, r1
  12:	6003      	str	r3, [r0, #0]
  14:	4770      	bx	lr
  16:	46c0      	nop			@ (mov r8, r8)

00000018 <set_tight_a>:
  18:	223f      	movs	r2, #63	@ 0x3f
  1a:	7803      	ldrb	r3, [r0, #0]
  1c:	4011      	ands	r1, r2
  1e:	4393      	bics	r3, r2
  20:	430b      	orrs	r3, r1
  22:	7003      	strb	r3, [r0, #0]
  24:	4770      	bx	lr
  26:	46c0      	nop			@ (mov r8, r8)

00000028 <set_tight_c>:
  28:	233f      	movs	r3, #63	@ 0x3f ← 同一个 set_tight_c：bfi / ubfx 不见了，全手工位运算
  2a:	4019      	ands	r1, r3
  2c:	3b30      	subs	r3, #48	@ 0x30
  2e:	001a      	movs	r2, r3
  30:	b510      	push	{r4, lr}       ← 寄存器不够用，编译器只好 push 一个出来
  32:	7844      	ldrb	r4, [r0, #1]
  34:	400a      	ands	r2, r1
  36:	0112      	lsls	r2, r2, #4
  38:	4023      	ands	r3, r4
  3a:	4313      	orrs	r3, r2
  3c:	2203      	movs	r2, #3
  3e:	7043      	strb	r3, [r0, #1]
  40:	7883      	ldrb	r3, [r0, #2]
  42:	0909      	lsrs	r1, r1, #4
  44:	4393      	bics	r3, r2
  46:	430b      	orrs	r3, r1
  48:	7083      	strb	r3, [r0, #2]
  4a:	bd10      	pop	{r4, pc}        ← 收尾 pop —— M3 上这对指令根本不存在
```

 

◆ 位域这四条规则，一句话收到一起

 

**能用 ` _Static_assert ` 钉住的，就别写进注释里；能不用 packed 的， 就别为了省那两个字节用。** 上面三个函数里，` set_tight_c ` 在 M3 上是 11 条指令、在 M0 上变成 18 条（干活的从 10 条涨到 16 条，外加一对 ` push `/` pop `）；而 ` set_flags_a ` 只有 3 条干活的指令，在两个核上都是 3 条。 功能完全等价，代价差了一个数量级 —— 这就是「布局由实现决定」在真实项目里的分量。

 

最后是规则 ④ 的实测。这一段是 **反面教材** ：它 *就应该编译不过* 。 正文下面贴的每一句报错，都是编译器当场说出来的原话：

 

bitfield\_fail.c — 位域没有地址（反面教材，必然编译失败） C

 

```text
/* bitfield_fail.c — 位域没有地址：下面三个函数没有一个能编过 */
#include <stdint.h>

struct flags {
    uint32_t ready : 1;
    uint32_t error : 1;
    uint32_t mode  : 3;
};

uint32_t addr_of_field(struct flags *f) { return (uint32_t)&f->ready; }       /* ① 取地址 */
uint32_t size_of_field(struct flags *f) { return (uint32_t)sizeof(f->mode); }  /* ② sizeof */
uint32_t *ptr_to_field(struct flags *f) { return &f->error; }                /* ③ 造指针 */
```

 

**bash**  — 实测编译失败，退出码 1

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c bitfield_fail.c
bitfield_fail.c: In function 'addr_of_field':
bitfield_fail.c:10:60: error: cannot take address of bit-field 'ready'
   10 | uint32_t addr_of_field(struct flags *f) { return (uint32_t)&f->ready; }       /* ① 取地址 */
      |                                                            ^
bitfield_fail.c: In function 'size_of_field':
bitfield_fail.c:11:66: error: 'sizeof' applied to a bit-field
   11 | uint32_t size_of_field(struct flags *f) { return (uint32_t)sizeof(f->mode); }  /* ② sizeof */
      |                                                                  ^
bitfield_fail.c: In function 'ptr_to_field':
bitfield_fail.c:12:50: error: cannot take address of bit-field 'error'
   12 | uint32_t *ptr_to_field(struct flags *f) { return &f->error; }                /* ③ 造指针 */
      |                                                  ^
bitfield_fail.c: In function 'addr_of_field':
bitfield_fail.c:10:71: warning: control reaches end of non-void function [-Wreturn-type]
   10 | uint32_t addr_of_field(struct flags *f) { return (uint32_t)&f->ready; }       /* ① 取地址 */
      |                                                                       ^
bitfield_fail.c: In function 'ptr_to_field':
bitfield_fail.c:12:61: warning: control reaches end of non-void function [-Wreturn-type]
   12 | uint32_t *ptr_to_field(struct flags *f) { return &f->error; }                /* ③ 造指针 */
      |                                                             ^
```

 

✦ 三条错误里藏着两个知识点

 

 
- **① 和 ③ 报的是同一句话。** 「取地址」和「造指针」在编译器眼里是一回事， 连措辞都没变：` cannot take address of bit-field `。
 
- **后面那两条 ` -Wreturn-type ` 警告是连带产物，值得看一眼。**  取地址失败之后，第 10 和第 12 行那两个函数各多了一条 ` control reaches end of non-void function ` —— 意思是 ` return ` 整条没编过，函数就真的没有返回值了。 第 11 行 *没有* 这条警告：同样是「取不出值」，编译器对 ` sizeof ` 那一路的处理和取地址并不一样。 这两条警告只是现象，不必为它去猜编译器内部的实现细节 —— 要紧的是记住： **一条错误往往会把后面的诊断一起带出来， 看报错要从第一条开始看。**
 
- **` offsetof ` 也躲不掉。** 它内部就是「取成员地址再减基址」， 所以对位域同样编不过，报的是 ` attempt to take address of bit-field structure member 'mode' ` —— 换了个说法，底层是同一件事。
 

 

四条禁令，一条都绕不过去。这不是编译器的坏脾气，而是「位域没有地址」这条语言事实的必然结果。

  

```zhizhan-anchor
ch6-4
```



## 6.4 读-改-写竞态：嵌入式最隐蔽的 bug

 

这是初学者几乎必然会遇到、但很难定位的一类问题。看这个场景：

 

**FIG 6.3**  读-改-写竞态：一个位丢失的全过程

 

```zhizhan-figure
<svg viewBox="0 0 660 340" width="660" height="340" role="img" aria-label="读改写竞态">
          <!-- 时间轴 -->
          <line x1="30" y1="40" x2="640" y2="40" stroke="var(--line-2)"></line>
          <text x="30" y="30" class="sv-lbl-dim" style="font-size:10.5px">时间 →</text>
          <text x="120" y="30" class="sv-lbl-dim" text-anchor="middle" style="font-size:10.5px">T1</text>
          <text x="240" y="30" class="sv-lbl-dim" text-anchor="middle" style="font-size:10.5px">T2</text>
          <text x="360" y="30" class="sv-lbl-dim" text-anchor="middle" style="font-size:10.5px">T3</text>
          <text x="480" y="30" class="sv-lbl-dim" text-anchor="middle" style="font-size:10.5px">T4</text>
          <text x="580" y="30" class="sv-lbl-dim" text-anchor="middle" style="font-size:10.5px">T5</text>

          <!-- 主循环 -->
          <text x="20" y="72" class="sv-lbl-hi" style="fill:var(--grn);font-size:11px">主循环</text>
          <rect x="110" y="58" width="120" height="34" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="170" y="79" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">读 ODR = 0x00</text>

          <rect x="330" y="58" width="130" height="34" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="395" y="79" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">改 bit0 → 0x01</text>

          <rect x="500" y="58" width="130" height="34" rx="4" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="565" y="79" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px" fill="var(--red)">写 ODR = 0x01 ✕</text>

          <!-- 中断 -->
          <text x="20" y="152" class="sv-lbl-hi" style="fill:var(--amb);font-size:11px">中断 ISR</text>
          <rect x="240" y="138" width="150" height="34" rx="4" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="315" y="159" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">读 ODR = 0x00</text>

          <rect x="410" y="138" width="150" height="34" rx="4" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="485" y="159" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">改 bit1 → 0x02</text>

          <rect x="575" y="138" width="70" height="34" rx="4" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="610" y="159" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">写 0x02</text>

          <!-- 结果 -->
          <rect x="30" y="196" width="615" height="60" rx="7" class="sv-red-s"></rect>
          <text x="46" y="218" class="sv-lbl-hi" style="fill:var(--red)">结果：bit0 被丢失了</text>
          <text x="46" y="240" class="sv-lbl-dim" style="font-size:11px">主循环想置 bit0，中断想置 bit1。最终 ODR = 0x02（bit1 生效，bit0 消失）。</text>

          <!-- 时序交错示意 -->
          <rect x="30" y="268" width="615" height="56" rx="7" class="sv-grn-s"></rect>
          <text x="46" y="290" class="sv-lbl-hi" style="fill:var(--grn)">为什么 <tspan style="font-family:var(--mono)">|=</tspan> 会出问题</text>
          <text x="46" y="312" style="font-family:var(--mono);font-size:11px;fill:var(--txt)">ODR |= (1&lt;&lt;0);&nbsp;&nbsp;展开成三条指令：ldr (读) → orr (改) → str (写)。这三条之间可以被中断打断。</text>
        </svg>
```

 

**注意：这不是 ` volatile ` 能解决的问题。**  ` volatile ` 保证了"每次都真的读写内存"，但读和写 *之间的时间窗口依然存在* 。  **正确的解法是使用硬件提供的原子寄存器（如 BSRR/BRR）。**

 

atomic\_gpio.c — 三种解法对比 C

 

```text
#include <stdint.h>

/* STM32 GPIO 寄存器（GPIOA 在 APB2 上）*/
#define GPIOA_BASE      0x40010800UL
#define GPIOA_CRL       (*(volatile uint32_t *)(GPIOA_BASE + 0x00))
#define GPIOA_CRH       (*(volatile uint32_t *)(GPIOA_BASE + 0x04))
#define GPIOA_IDR       (*(volatile uint32_t *)(GPIOA_BASE + 0x08))
#define GPIOA_ODR       (*(volatile uint32_t *)(GPIOA_BASE + 0x0C))
#define GPIOA_BSRR      (*(volatile uint32_t *)(GPIOA_BASE + 0x10))  /* 原子置位/复位 */
#define GPIOA_BRR       (*(volatile uint32_t *)(GPIOA_BASE + 0x14))  /* 原子复位 */

/* 第 5 位（PA5，很多板子的板载 LED） */
#define LED_PIN         5

/* ============ ✕ 解法 0：错误示范 ============ */
void led_set_bad(void)
{
    GPIOA_ODR |= (1UL << LED_PIN);      /* ldr → orr → str，三步之间可被打断 */
}
void led_clr_bad(void)
{
    GPIOA_ODR &= ~(1UL << LED_PIN);     /* 同样有竞态 */
}

/* ============ ✔ 解法 1：BSRR（首选，零开销，硬件保证原子）============ */
/* BSRR 低 16 位：写 1 → 对应引脚置 1
   BSRR 高 16 位：写 1 → 对应引脚清 0
   写 0 的位：不产生任何影响 —— 这正是"原子"的关键 */

void led_set(void)
{
    GPIOA_BSRR = (1UL << LED_PIN);            /* 单条 str，只置位 PA5 */
}

void led_clr(void)
{
    GPIOA_BSRR = (1UL << (LED_PIN + 16));      /* 单条 str，只清零 PA5 */
    /* 或者：GPIOA_BRR = (1UL << LED_PIN); */
}

/* ⚠ 那"翻转"怎么办？BSRR 只能"置位或清位"，硬件层面没有"翻转"。
   唯一能写出来的形式是"先读状态、再决定写哪个 BSRR"，而这个组合
   仍然带着竞态窗口 —— 它是本章最容易写错的一个点，所以单独放到
   解法 2 之后讨论（那里已经有临界区工具了）。 */

/* 一次操作多个引脚（BSRR 的真正威力） */
void led_pattern(uint32_t set_mask, uint32_t clr_mask)
{
    /* 同时置位 PA0/PA2，同时清零 PA1/PA3 —— 只有一次写操作 */
    GPIOA_BSRR = (set_mask & 0xFFFFUL) |
                 ((clr_mask & 0xFFFFUL) << 16);
    /* 这两个动作在同一时刻生效，不会出现"先亮一个再灭一个"的中间态 */
}

/* ============ ✔ 解法 2：关中断（没有专用寄存器时）============ */
static inline uint32_t critical_enter(void)
{
    uint32_t primask;
    __asm__ volatile ("mrs %0, primask" : "=r" (primask));
    __asm__ volatile ("cpsid i" ::: "memory");   /* 关中断 */
    return primask;
}
static inline void critical_exit(uint32_t primask)
{
    if (!(primask & 1UL)) {
        __asm__ volatile ("cpsie i" ::: "memory"); /* 只有原本开着才恢复 */
    }
}

void led_set_critical(void)
{
    uint32_t s = critical_enter();
    GPIOA_ODR |= (1UL << LED_PIN);     /* 临界区内，不会被中断打断 */
    critical_exit(s);
}
/* ⚠ 代价：关中断期间所有中断都被延迟。临界区必须极短（几条指令）。
   ⚠ 不适用于多核（ESP32 双核），多核需要自旋锁 */


/* ============ ✕ 陷阱：翻转（toggle）没有硬件原子实现 ============
   网上到处都是这个写法，它"看起来"用了 BSRR，其实仍然是读-改-写： */
void led_toggle_not_atomic(void)
{
    if (GPIOA_ODR & (1UL << LED_PIN)) {        /* ① 读 ODR 判断当前电平 */
        GPIOA_BSRR = (1UL << (LED_PIN + 16));  /* ② 写 BSRR 清位 */
    } else {
        GPIOA_BSRR = (1UL << LED_PIN);         /* ② 写 BSRR 置位 */
    }
}
/* 问题出在 ①② 之间的窗口：如果中断在那一刻也翻转了同一个引脚，
   两次翻转各自都基于"同一份旧状态"判断方向，于是执行了同一个动作，
   净效果只翻转了一次 —— 丢了一次操作。
   ⚠ 常见辩解"中断操作的是别的位，不会互相覆盖"只是在【假设】
     中断碰巧不动这个引脚，它不是任何硬件保证。
   ⚠ 另一个细节：F1 上"输出电平"要读 ODR（它回读的是引脚的输出状态），
     不是 IDR（那是引脚上的实际电平，输出模式下两者通常一致，
     但一旦引脚被外部强拉、或处于开漏上拉状态就会分叉）。
     判断"我上次写的是什么"，就该读 ODR。 */

/* ---------- ✔ 正确做法 A：软件影子状态（单点所有权）----------
   让"这个灯现在应该是什么状态"由软件唯一拥有，不再去猜硬件。 */
static volatile uint8_t s_led_on = 0;

void led_toggle_shadow(void)
{
    s_led_on = !s_led_on;                       /* 翻转软件状态 */
    if (s_led_on) { GPIOA_BSRR = (1UL << LED_PIN); }
    else          { GPIOA_BSRR = (1UL << (LED_PIN + 16)); }
}
/* ⚠ 影子状态只解决了"读硬件"的歧义，它自己仍是读-改-写。
   所以它成立的前提是【调用方唯一】：只有主循环调用它。
   主循环和 ISR 都调用，照样会丢 —— 那时必须用做法 B。 */

/* ---------- ✔ 正确做法 B：临界区把"读+写"整体保护起来 ---------- */
void led_toggle_safe(void)
{
    uint32_t s = critical_enter();
    led_toggle_shadow();                        /* 状态更新与 BSRR 写入一起受保护 */
    critical_exit(s);
}
/* 临界区必须极短：这里只有几条指令，可以接受。
   中断被延迟的时间就是这个临界区的执行时间。 */


/* ============ ✔ 解法 3：位带（Cortex-M3/M4，见 6.2）============ */
/* 如果芯片有位带，且目标在可位带区，这也是原子的 */
#define BITBAND_PERIPH(addr, bit) \
    ((volatile uint32_t *)(0x42000000UL + \
     (((uint32_t)(addr) - 0x40000000UL) * 32UL) + ((uint32_t)(bit) * 4UL)))

void led_set_bitband(void)
{
    *BITBAND_PERIPH(&GPIOA_ODR, LED_PIN) = 1;   /* 单条 str，原子 */
}
```

 

| 方法 | 原子性 | 开销 | 适用条件 |
| --- | --- | --- | --- |
| **BSRR/BRR** | ✔ 硬件保证 | 1 条指令 | **首选** 。所有带 GPIO 的 STM32 都有。ESP32 用 ` GPIO.out_w1ts / w1tc ` |
| **位带** | ✔ 硬件保证 | 1 条指令 | Cortex-M3/M4（ **M7 已取消位带** ）；地址在可位带区 |
| **关中断** | ✔ 软件保证 | 数条 \+ 中断延迟 | 没有专用寄存器时的通用兜底。临界区必须极短 |
| **读-改-写** | ✕ 有竞态 | 3 条指令 | 仅在 *确定无并发访问* 时可用（如初始化阶段） |

 

```zhizhan-anchor
ch6-5
```



## 6.5 实战一：STM32 寄存器级点灯

 

现在把前面的知识全部串起来—— **不依赖 HAL，只用寄存器，让 PC13 上的 LED 闪起来** 。 这是理解 STM32 的最佳起点。

 

```zhizhan-anchor
ch6-5-1
```



### 6.5.1 先回答一个问题：为什么不直接用 CMSIS？

 

下面这段代码会用一堆 ` #define GPIOC_CRH (*(volatile uint32_t *)0x40011004UL) ` 这样的 **裸宏** 。而你此前读到的东西恰恰相反：Module 01 给出过 ` GPIO_TypeDef `， Module 03 的"写法 ③"明确写了"结构体映射（推荐，最清晰）"，要点里还有一句 " **结构体映射 \+ ` volatile ` 是最佳实践** "。 既然那样更好，这一章为什么倒回去写裸宏？先把这件事交代清楚，免得你学完反而写退步了。

 

**裸宏是教学工具，不是生产写法。** 它的唯一价值是：每一个地址、每一个位偏移都明明白白摊在你眼前， 中间没有任何一层抽象。把这节看完，"STM32 的寄存器就是内存某个地址上的一个 ` volatile ` 变量" 这件事就再也不会模糊——以后看到 HAL 或 CMSIS 的代码，你能一眼看穿它在干什么。

 

但它有三个真实缺点，在正经项目里每一个都会变成麻烦：

 

 
1. **易错且无法自检** ：一颗芯片几百个寄存器就要写几百行宏，地址写错一位编译器不会拦你， 运行时表现为"寄存器就是不动"。
 
2. **换型号等于重写** ：F103 的 ` GPIOC_BASE ` 是 ` 0x40011000 `， 换到 F407、G0、H7 全部要重新查手册改一遍。
 
3. **没有类型信息** ：IDE 无法补全、无法跳转、无法静态检查，只能靠手翻手册。
 

 

生产环境的事实标准是  **CMSIS** （Cortex Microcontroller Software Interface Standard， ARM 定义的 Cortex-M 软件接口规范）。ST 为每颗芯片提供的 ` stm32f103xb.h ` 就是它的实现， 而它做的正是 Module 03 推荐的那件事—— *用结构体映射寄存器，用 ` volatile ` 保证每次访问都真的落到总线上* 。 所以本节的关系不是"两种互斥写法"，而是： **裸宏让你看懂原理，CMSIS 让你把原理写成能维护的代码** 。

 

led\_cmsis.c — 同样一段点灯，CMSIS 写法 C

 

```text
#include <stdint.h>
#include "stm32f103xb.h"      /* ST 提供的 CMSIS 设备头文件 */

/* ============================================================
   ① 外设是【结构体指针】，不是一堆散装宏
   ------------------------------------------------------------
   stm32f103xb.h 里的定义（简化）：

       typedef struct {
           __IO uint32_t CRL;    __IO uint32_t CRH;
           __IO uint32_t IDR;    __IO uint32_t ODR;
           __IO uint32_t BSRR;   __IO uint32_t BRR;
           __IO uint32_t LCKR;
       } GPIO_TypeDef;

       #define GPIOC   ((GPIO_TypeDef *)0x40011000UL)

   三个关键点：
     • __IO 展开就是 volatile —— 这是 CMSIS 的灵魂，别手写时漏掉；
     • 偏移由编译器按字段顺序算，GPIOC->CRH 自动就是 base+0x04，
       不用你手算，也就不会算错；
     • 换芯片时这套定义由厂商头文件提供，代码几乎不用改。
   ============================================================ */

#define LED_PIN   13
#define LED_ON    (GPIOC->BSRR = (1UL << LED_PIN) << 16)   /* 置高 16 位 = 复位 */
#define LED_OFF   (GPIOC->BSRR = (1UL << LED_PIN))          /* 置低 16 位 = 置位 */

void led_init_cmsis(void)
{
    /* 开时钟：位掩码由头文件提供，不再手写 magic number */
    RCC->APB2ENR |= RCC_APB2ENR_IOPCEN;

    /* 配 PC13：先清 4 位，再写 MODE/CNF —— 就是 6.1"先清后写"的要求 */
    GPIOC->CRH &= ~(0xFUL << 20);
    GPIOC->CRH |=  (0x2UL << 20);        /* MODE=10(2MHz), CNF=00(推挽) */
}

/* ============================================================
   ② CMSIS 自带的位操作宏（core_cm3.h）
   ------------------------------------------------------------
   ⚠ 第二个参数是【掩码 MASK】，不是【位号 n】！
     这和 6.1 里我们自己写的 SET_BIT(reg, n) 语义完全不同。
     两者混用会编过、会跑，但行为是错的 —— 详见下面的红框。
   ============================================================ */
void cmsis_bitops_demo(void)
{
    SET_BIT(GPIOC->CRH, (0xFUL << 20));      /* REG |= MASK   */
    CLEAR_BIT(GPIOC->CRH, (0xFUL << 20));    /* REG &= ~MASK  */

    if (READ_BIT(GPIOC->IDR, (1UL << LED_PIN))) {
        /* REG & MASK，读输入电平 */
    }

    /* MODIFY_REG 就是"先清后写"的封装，一个宏干完两件事：
           MODIFY_REG(REG, CLEARMASK, SETMASK)
       等价于 REG = (REG & ~CLEARMASK) | SETMASK  */
    MODIFY_REG(GPIOC->CRH, (0xFUL << 20), (0x2UL << 20));

    /* WRITE_REG 用于"只写"寄存器（如 BSRR），省掉一次多余的读 */
    WRITE_REG(GPIOC->BSRR, (1UL << LED_PIN));
}

/* ============================================================
   ③ CMSIS 还顺手解决了内核侧的一堆裸操作
   ------------------------------------------------------------
   这些都在 core_cm3.h / core_cm4.h 里，比手写 PRIMASK/SCB 安全得多：

       __disable_irq() / __enable_irq()        关/开中断
       __get_PRIMASK() / __set_PRIMASK(x)      保存与恢复中断状态
                                                 （嵌套临界区必须这么写）
       __DSB() / __DMB() / __ISB()             内存屏障，顺序语义三件套
       __NOP() / __WFI() / __WFE() / __SEV()   指令
       NVIC_SetPriority(IRQn, prio)            中断优先级（自动算寄存器偏移）
       NVIC_EnableIRQ(IRQn)                    使能中断（不用背 ISER 编号）

   还有一组位运算内建，在 Cortex-M3 上都是【单条指令】：

       __CLZ(x)     前导零个数   → 用于找最高有效位、二分查找
       __RBIT(x)    32 位整体反转（配合 __CLZ 就能找最低有效位）
       __REV(x)     字节序反转   → 处理网络协议大端字段

   这些的硬件基础见 6.7 末尾关于独占访问（LDREX/STREX）的说明。
   ============================================================ */
```

 

✕ 宏名撞车：本章的 ` SET_BIT ` 和 CMSIS 的 ` SET_BIT ` 不是一回事

 

6.1 的 ` bitops.h ` 里，` SET_BIT(reg, n) ` 的第二个参数是 **位号** ， 内部自己做 ` 1UL << n `。 CMSIS 的 ` SET_BIT(REG, BIT) ` 第二个参数是 **掩码** ，直接 ` REG |= BIT `。

 

这两个宏 **同名、同参数个数、编译期都不报错** 。如果哪天你的工程里同时存在两份定义， 编译器会按包含顺序静静选一个，另一个默默失效——写出来的代码能编过、能下载，行为却完全不是你想要的。

 

结论很实在： **用 CMSIS 就别再自己定义同名的位操作宏** ； 本教程 6.1 那套 ` BIT / SET_BIT / FIELD_SET ` 只作为原理演示， 真要放进工程，请改成 ` MY_SET_BIT ` 这类带前缀的名字。

 

◆ 本章代码的定位：看得懂裸宏，写得出 CMSIS

 

 
- **接下来 6.5 / 6.6 的代码块用裸宏** ——因为这一章的目标是让你亲眼看到地址和位偏移， 抽象越少越好。它们都标了"教学用"。
 
- **你在项目里应该用 CMSIS** （或 ST 的 LL 库，它是 CMSIS 之上的薄封装， 函数名如 ` LL_GPIO_SetPinMode() `，行为可预测、无隐藏状态）。
 
- **不要用裸宏搭生产工程** ：一旦型号变更或硬件改版，几百行手工地址就是几百个待爆的雷。
 
- 而判断 CMSIS 代码对不对，靠的恰恰是裸宏这一层知识—— ` GPIOC->CRH &= ~(0xFUL << 20) ` 为什么是 20， 只有从 6.5.1 上面那张位置表推出来才踏实。

 

**FIG 6.4**  配置一个 GPIO 需要动哪几个寄存器

 

```zhizhan-figure
<svg viewBox="0 0 660 258" width="660" height="258" role="img" aria-label="GPIO 配置涉及的总线">
          <!-- 总线层次 -->
          <rect x="20" y="20" width="620" height="52" rx="7" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="36" y="42" class="sv-lbl-hi" style="fill:var(--vio)">① 开时钟：RCC_APB2ENR —— 没有时钟，外设寄存器写不进去</text>
          <text x="36" y="62" class="sv-lbl-dim" style="font-size:10.5px">STM32 所有外设默认时钟关闭以省电。第 1 步永远是开时钟，这一步漏了 → 后面的写入全部无效，且不报错。</text>

          <path d="M 330 72 L 330 88" class="sv-arrow"></path>

          <rect x="20" y="92" width="620" height="52" rx="7" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="36" y="114" class="sv-lbl-hi" style="fill:var(--cyn)">② 配模式：GPIOx_CRL / CRH —— 输入/输出/复用/模拟 + 速度 + 上下拉</text>
          <text x="36" y="134" class="sv-lbl-dim" style="font-size:10.5px">CRL 管 pin 0-7，CRH 管 pin 8-15。每个引脚占 4 位：2 位 MODE + 2 位 CNF。共 16 个引脚 × 4 位 = 64 位。</text>

          <path d="M 330 144 L 330 160" class="sv-arrow"></path>

          <rect x="20" y="164" width="620" height="52" rx="7" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="36" y="186" class="sv-lbl-hi" style="fill:var(--grn)">③ 操作输出：GPIOx_BSRR / ODR / BRR —— 原子置位、复位、读回</text>
          <text x="36" y="206" class="sv-lbl-dim" style="font-size:10.5px">用 BSRR 避免读-改-写竞态（见 6.4）。IDR = 引脚实际电平；ODR = 你写出去的锁存值。读输入用 IDR，判断"上次写了什么"用 ODR，别混用。</text>

          <rect x="20" y="226" width="620" height="26" rx="6" class="sv-amb-s"></rect>
          <text x="36" y="244" class="sv-lbl-dim" style="font-size:10.5px">顺序不能乱：① → ② → ③。开时钟必须最先，引脚配置必须在操作之前。</text>
        </svg>
```

 

led\_reg.c — STM32F103 纯寄存器点灯（完整可编译） C

 

```text
/**
 * STM32F103C8T6（蓝板）纯寄存器点灯
 * LED 接在 PC13，低电平点亮（板载 LED 是共阳极接法）
 *
 * 编译：arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c led_reg.c
 * 需要搭配 startup 文件与链接脚本（见 Module 04/05）
 *
 * 目标：彻底搞清楚"点灯"这件事在最底层发生了什么
 * 风格：纯裸宏，仅作教学演示。生产代码请用 CMSIS（见 6.5.1）
 */

#include <stdint.h>

/* ============================================================
   第一部分：寄存器地址定义
   ============================================================ */

/* ---- RCC（复位与时钟控制）---- */
#define RCC_BASE        0x40021000UL
#define RCC_APB2ENR     (*(volatile uint32_t *)(RCC_BASE + 0x18))
/* 位定义（来自 ST《STM32F10xxx 参考手册》RM0008：
   RCC_APB2ENR 的位表见"复位和时钟控制 (RCC)"章，GPIO 的位表见 GPIO 章） */
#define RCC_APB2ENR_IOPAEN      (1UL << 2)    /* GPIOA 时钟使能 */
#define RCC_APB2ENR_IOPBEN      (1UL << 3)    /* GPIOB 时钟使能 */
#define RCC_APB2ENR_IOPCEN      (1UL << 4)    /* GPIOC 时钟使能 */
#define RCC_APB2ENR_AFIOEN      (1UL << 0)    /* 复用功能时钟 */
#define RCC_APB2ENR_USART1EN    (1UL << 14)

/* ---- GPIOC ---- */
#define GPIOC_BASE      0x40011000UL
#define GPIOC_CRL       (*(volatile uint32_t *)(GPIOC_BASE + 0x00))  /* pin 0-7 */
#define GPIOC_CRH       (*(volatile uint32_t *)(GPIOC_BASE + 0x04))  /* pin 8-15 */
#define GPIOC_IDR       (*(volatile uint32_t *)(GPIOC_BASE + 0x08))  /* 输入数据 */
#define GPIOC_ODR       (*(volatile uint32_t *)(GPIOC_BASE + 0x0C))  /* 输出数据 */
#define GPIOC_BSRR      (*(volatile uint32_t *)(GPIOC_BASE + 0x10))  /* 原子置位/复位 */
#define GPIOC_BRR       (*(volatile uint32_t *)(GPIOC_BASE + 0x14))  /* 原子复位 */

/* ---- LED 引脚 ---- */
#define LED_PIN         13                     /* PC13 */

/* ============================================================
   第二部分：寄存器位域定义（CRH 寄存器，管 pin 8-15）
   ------------------------------------------------------------
   每个引脚占 4 位，16 个引脚 × 4 位 = 64 位（= CRL 的 32 位 + CRH 的 32 位）。
   这 4 位的排布是【低 2 位 MODE、高 2 位 CNF】：

       bit[1:0] = MODE   该引脚的方向 + 最大输出速度
       bit[3:2] = CNF    输出/输入的具体形式（推挽、开漏、复用、模拟…）

   ⚠ 这一条务必记死。把 MODE 和 CNF 的位置记反，是新手最常见的错误之一：
     写出来的值不会报错、寄存器也真的写进去了，但引脚就是不动，而且用调试器
     看"我明明写了 0x2"也看不出问题——因为 0x2 落在 CNF 位上，含义完全不同。
     （对照：ST 的《STM32F10xxx 参考手册》RM0008 里 GPIOx_CRL / GPIOx_CRH 的位表，
       HAL 里的 GPIO_CRL_MODE0_Pos = 0、GPIO_CRL_CNF0_Pos = 2 就是这两个位置。）

   PIN13 位于 CRH 的 bit[23:20]
   ============================================================ */
#define CRH_PIN_SHIFT(pin)      (((pin) - 8) * 4)     /* pin13 → 20 */
#define CRH_PIN_MASK(pin)       (0xFUL << CRH_PIN_SHIFT(pin))

/* MODE 值（输出模式下）*/
#define MODE_INPUT              0x0UL
#define MODE_OUT_10MHZ          0x1UL
#define MODE_OUT_2MHZ           0x2UL
#define MODE_OUT_50MHZ          0x3UL

/* CNF 字段的取值（输出模式下，占本引脚的 bit[3:2]）
   注意下面写的是【CNF 这个 2 位字段本身的值】，不是它在寄存器里的绝对位置。
   CNF 在 MODE 的高 2 位，所以拼进寄存器时要额外左移 2：
       GPIOx_CRL |= (MODE << shift) | (CNF << (shift + 2))
   CNF = 00 → 通用推挽输出
   CNF = 01 → 通用开漏输出
   CNF = 10 → 复用推挽
   CNF = 11 → 复用开漏
   （输入模式下 CNF 的含义完全不同：00 模拟/01 浮空/10 上下拉/11 保留） */
#define CNF_OUT_PP              0x0UL   /* 推挽输出 */
#define CNF_OUT_OD              0x1UL   /* 开漏输出 */
#define CNF_AF_PP               0x2UL   /* 复用推挽 */
#define CNF_AF_OD               0x3UL   /* 复用开漏 */

/* ============================================================
   第三部分：延时（最简单的方式 —— 忙等）
   ============================================================ */
/* ⚠ 必须用 volatile！否则 -O2 下整个循环会被优化删除（见 Module 02） */
static void delay_cycles(volatile uint32_t count)
{
    while (count--) {
        __asm__ volatile ("nop");       /* 防止循环被优化 */
    }
}

/* 大致延时（未精确校准，仅用于演示；真实项目用 SysTick） */
static void delay_ms(uint32_t ms)
{
    /* STM32F103 @ 8 MHz 内部 RC（默认时钟）：约 8000 周期/ms */
    while (ms--) {
        delay_cycles(8000UL / 4UL);     /* 每条循环约 4 周期 */
    }
}

/* ============================================================
   第四部分：GPIO 初始化 —— 三步走
   ============================================================ */
static void led_init(void)
{
    /* ---- 第 1 步：开 GPIOC 时钟 ---- */
    /* 没有这一步，下面所有对 GPIOC 寄存器的写入都会被硬件丢弃，
       而且不会有任何报错 —— 这是新手最常卡住的地方 */
    RCC_APB2ENR |= RCC_APB2ENR_IOPCEN;

    /* 读-改-写完成，给硬件一点同步时间（可选，保险做法） */
    (void)RCC_APB2ENR;

    /* ---- 第 2 步：配置 PC13 为推挽输出 ---- */
    /* 先清掉 PC13 的 4 位配置域，再写入新值 */
    GPIOC_CRH &= ~CRH_PIN_MASK(LED_PIN);
    GPIOC_CRH |=  (MODE_OUT_2MHZ << CRH_PIN_SHIFT(LED_PIN))
               |  (CNF_OUT_PP    << (CRH_PIN_SHIFT(LED_PIN) + 2));

    /* ---- 第 3 步：初始状态设为灭（PC13 低电平点亮，所以先写高）---- */
    GPIOC_BSRR = (1UL << LED_PIN);        /* 置位 → 输出高 → LED 灭 */
}

/* ============================================================
   第五部分：LED 控制
   ------------------------------------------------------------
   led_on / led_off 用 BSRR：对 BSRR 的一次写入就是一次原子操作，
   不存在"读-改-写"窗口，天然线程/中断安全 —— 这是 BSRR 存在的全部理由。
   led_toggle 做不到这一点，原因见它自己的注释。
   ============================================================ */
static inline void led_on(void)
{
    /* PC13 是低电平点亮，所以"亮"= 输出低电平 = BSRR 高 16 位写 1 */
    GPIOC_BSRR = (1UL << (LED_PIN + 16));
}

static inline void led_off(void)
{
    GPIOC_BSRR = (1UL << LED_PIN);
}

/* ------------------------------------------------------------
   翻转：先"读回当前输出"，再决定写 BSRR 的哪一半
   ------------------------------------------------------------
   读的是 ODR（输出数据寄存器），不是 IDR（输入数据寄存器）：
     · ODR = 你上一次写出去、被锁存住的值   ← 判断"该往哪边翻"要用它
     · IDR = 引脚上的实际电平               ← 判断"外部世界现在是什么"用它
   输出模式下两者通常一致，但引脚被外部拉拽、或配成开漏外接上拉时就会分家。
   这里要的是"我上次写了什么"，所以用 ODR。

   ⚠ 这个函数不是原子的：读 ODR 和写 BSRR 之间存在一个窗口，
     如果此刻来了中断、而中断里也翻转同一个引脚，翻转会被"吃掉"一次。
     本例中只有主循环在动 LED，所以可以这么写；
     多上下文共用同一个引脚时的正确做法见 6.4 节。 */
static inline void led_toggle(void)
{
    if (GPIOC_ODR & (1UL << LED_PIN)) {
        led_on();      /* 当前输出高 → 走 BSRR 高 16 位（BR）拉低，点亮 */
    } else {
        led_off();     /* 当前输出低 → 走 BSRR 低 16 位（BS）拉高，熄灭 */
    }
}

/* ============================================================
   第六部分：入口
   ============================================================ */
int main(void)
{
    led_init();

    /* 上电先闪三下，作为"程序跑起来了"的视觉信号 */
    for (int i = 0; i < 3; i++) {
        led_on();
        delay_ms(100);
        led_off();
        delay_ms(100);
    }

    /* 主循环：1 Hz 闪烁 */
    for (;;) {
        led_toggle();
        delay_ms(500);
    }

    /* 永不返回 —— 嵌入式 main 必须是无限循环（见 Module 04） */
}

/* ============================================================
   验证与调试

   ① 检查生成的代码是否符合预期
      $ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c led_reg.c -o led_reg.o
      $ arm-none-eabi-objdump -d led_reg.o | grep -A12 '<led_init>:'

      应该看到：
        ldr  r3, [pc, #xx]        ; 取 RCC_APB2ENR 地址 0x40021018
        ldr  r2, [r3]
        orr  r2, r2, #16          ; 置 bit4（IOPCEN）
        str  r2, [r3]
        ldr  r3, [pc, #xx]        ; 取 GPIOC_CRH 地址
        ...

   ② 确认 BSRR 写入是单条 str（原子的）
      $ arm-none-eabi-objdump -d led_reg.o | grep -A6 '<led_on>:'

   ③ 如果没有专用调试器，用"二分法"定位问题：
      - 卡在哪一步？先在 led_init 末尾加个死循环，
        用调试器看 PC 停在哪，或看 LED 有没有变化
      - 时钟开了吗？用调试器读 RCC_APB2ENR，确认 bit4 = 1
      - 寄存器写对了吗？读回 GPIOC_CRH，确认 bit[23:20] = 0x2
        （MODE=10 输出2MHz，CNF=00 推挽）

   ④ 常见失败原因排序（经验排序：从最高频到偶见）
      1. 忘记开时钟                              ← 头号原因
      2. CRH/CRL 选错（pin13 在 CRH 不在 CRL）
      3. 移位量算错（pin13 → shift (13-8)*4 = 20）
      4. LED 极性搞反（以为是高电平点亮）
      5. 硬件问题（LED 焊反、限流电阻缺失）
   ============================================================ */
```

 

✔ ` STM32F103C8T6 ` 上 ` PC13 ` 的关键数字（背下来）

 

| 项目 | 值 |
| --- | --- |
| GPIOC 基地址 | ` 0x40011000 `（APB2 总线） |
| RCC\_APB2ENR 地址 | ` 0x40021018 `，IOPCEN = bit 4 |
| PC13 配置位置 | ` GPIOC_CRH ` 的 bit\[23:20\] |
| 移位量公式 | ` (pin - 8) * 4 `，pin13 → 20 |
| LED 极性 | 蓝板板载 LED 接 ` VDD → LED → 电阻 → PC13 `， **低电平点亮** |
| 这 4 位怎么排 | ` bit[1:0] = MODE `（方向 \+ 速度， **低 2 位** ），` bit[3:2] = CNF `（推挽/开漏/复用， **高 2 位** ） |
| 推挽输出的 4 位值 | ` MODE=10（2MHz） ` 放低 2 位、` CNF=00（推挽） ` 放高 2 位 → ` 0b0010 ` = ` 0x2 ` |

 

**验证方法** ：用调试器读回 ` GPIOC_CRH `，如果 bit\[23:20\] 等于 ` 0x2 `，说明配置成功。  *这是排查 GPIO 问题最直接的一步——不要靠猜。*

  

```zhizhan-anchor
ch6-5-2
```



### 6.5.2 同一个引脚，三个系列三套寄存器

 

上面那段点灯代码，原样搬到一块 F4 的板子上 —— 灯纹丝不动。 这不是笔误，编译器也不会报错： **F1 和 F4 的 GPIO 是两代完全不同的设计** 。 寄存器个数不同、每个引脚占的位数不同、外设挂在哪条总线上不同、连时钟使能位在第几位都不同。 这一节把三代并排摆出来，让你看清楚 **哪些东西能跨系列照抄，哪些一个字都不能抄** 。

 

```zhizhan-table
{"rows":[[{"body":"项目","header":true,"rowSpan":1,"colSpan":1},{"body":"F1（STM32F103，Cortex-M3）","header":true,"rowSpan":1,"colSpan":1},{"body":"F4（STM32F407，Cortex-M4）","header":true,"rowSpan":1,"colSpan":1},{"body":"H7（STM32H743，Cortex-M7）","header":true,"rowSpan":1,"colSpan":1}],[{"body":"每引脚占几位","header":false,"rowSpan":1,"colSpan":1},{"body":"**4 位（nibble）**","header":false,"rowSpan":1,"colSpan":1},{"body":"2 位","header":false,"rowSpan":1,"colSpan":1},{"body":"2 位","header":false,"rowSpan":1,"colSpan":1}],[{"body":"配置寄存器","header":false,"rowSpan":1,"colSpan":1},{"body":"` CRL `（pin0–7）\\+ ` CRH `（pin8–15）","header":false,"rowSpan":1,"colSpan":1},{"body":"` MODER `","header":false,"rowSpan":1,"colSpan":1},{"body":"` MODER `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"输出类型","header":false,"rowSpan":1,"colSpan":1},{"body":"挤在 nibble 的 ` CNF ` 两位里","header":false,"rowSpan":1,"colSpan":1},{"body":"` OTYPER `（1 位/引脚）","header":false,"rowSpan":1,"colSpan":1},{"body":"` OTYPER `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"速度","header":false,"rowSpan":1,"colSpan":1},{"body":"挤在 nibble 的 ` MODE ` 两位里","header":false,"rowSpan":1,"colSpan":1},{"body":"` OSPEEDR `","header":false,"rowSpan":1,"colSpan":1},{"body":"` OSPEEDR `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"上下拉","header":false,"rowSpan":1,"colSpan":1},{"body":"**有内部弱上下拉** ，但没有独立的配置寄存器：输入模式下 ` CNF=10 `，方向由 ` PxODR ` 那一位决定 （0 = 下拉，1 = 上拉）","header":false,"rowSpan":1,"colSpan":1},{"body":"` PUPDR `（专设寄存器，2 位/引脚）","header":false,"rowSpan":1,"colSpan":1},{"body":"` PUPDR `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"复用功能","header":false,"rowSpan":1,"colSpan":1},{"body":"靠 ` CNF=10/11 ` 表示， **没有 AF 编号**","header":false,"rowSpan":1,"colSpan":1},{"body":"` AFRL `/` AFRH `，4 位/引脚","header":false,"rowSpan":1,"colSpan":1},{"body":"同 F4","header":false,"rowSpan":1,"colSpan":1}],[{"body":"GPIOC 基址","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x4001_1000 `（APB2）","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x4002_0800 `（AHB1）","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x5802_0800 `（D3 域）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"时钟使能寄存器","header":false,"rowSpan":1,"colSpan":1},{"body":"` RCC_APB2ENR `（\\+0x18）","header":false,"rowSpan":1,"colSpan":1},{"body":"` RCC_AHB1ENR `（\\+0x30）","header":false,"rowSpan":1,"colSpan":1},{"body":"` RCC_AHB4ENR `（\\+0xE0）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"GPIOC 使能位","header":false,"rowSpan":1,"colSpan":1},{"body":"**bit 4**","header":false,"rowSpan":1,"colSpan":1},{"body":"bit 2","header":false,"rowSpan":1,"colSpan":1},{"body":"bit 2","header":false,"rowSpan":1,"colSpan":1}],[{"body":"寄存器内部偏移","header":false,"rowSpan":1,"colSpan":1},{"body":"` CRL 0x00 / CRH 0x04 / IDR 0x08 / ODR 0x0C / BSRR 0x10 / BRR 0x14 / LCKR 0x18 ` —— 共 7 个","header":false,"rowSpan":1,"colSpan":1},{"body":"` MODER 0x00 … AFRH 0x24 / LCKR 0x1C `，  **这两代完全一致**","header":false,"rowSpan":1,"colSpan":2}]]}
```

 

🔍 这张表里，哪一列是"实测"，哪一列是"手册事实"

 

**右边三列的每一个数字，都是手册事实 —— 本站的工具链证明不了它。**  出处逐条列在下面，你可以在 ST 官方的 PDF 里按节号翻到：

 

| 系列 | 手册 | 用到的节 |
| --- | --- | --- |
| F1 | RM0008，` DocID13902 Rev 17 ` | §9.1.1 与 Table 20 端口位配置表（内部弱上下拉靠 ` PxODR ` 选方向，印刷页 160）；§9.2.1 CRL / §9.2.2 CRH / §9.2.5 BSRR / §9.2.7 LCKR（印刷页 170–174）；§9.3 末尾 OSC32 / PC14–PC15 的 Note（印刷页 174）；§9.5 GPIO 与 AFIO 寄存器映像（印刷页 193）；§7.2.4 LSE clock（印刷页 95）；§7.3.7 RCC\_APB2ENR 的 bit4 ` IOPCEN `（印刷页 111–113）；§5.1.2 PC13–PC15 限制（印刷页 68） |
| F4 | RM0090，` Rev 22 ` | §8.4.1 MODER / §8.4.2 OTYPER / §8.4.3 OSPEEDR / §8.4.4 PUPDR / §8.4.7 BSRR / §8.4.8 LCKR / §8.4.9 AFRL / §8.4.10 AFRH / §8.4.11 寄存器映像（` LCKR ` 落在 0x1C，印刷页 289–290）；§7.3.10 RCC\_AHB1ENR 的 bit2 ` GPIOCEN `（印刷页 243–245）；§2.3 存储器映像与 Table 1 边界地址（印刷页 64–67） |
| H7 | RM0433，` Rev 9 ` | §11.4 GPIO 寄存器（印刷页 541–547，偏移表见 Table 95）；§8.7.43 RCC\_AHB4ENR 的 bit2 ` GPIOCEN `（印刷页 458）；§2.3.2 与 Table 8 寄存器边界地址（印刷页 130 / 132） |

 

下面那些反汇编 **不是用来证明这些数字正确的**  —— 编译器只看得见你在源码里写的常量， 它没法知道芯片上那个地址真不真。反汇编能证明的是另外两件事，而且都很值钱：   
①  **这些数字确实按你写的那样被算了下去** （移位量、掩码、地址都经得起复核）；   
②  **同一条语句在三代之间产生的机器码差多远**  —— 这一条才是"抄错系列"的直观画像。

 

gpio\_f1\_vs\_f4.c — 三代 GPIO 摆在同一张表里，用 \_Static\_assert 钉住 C

 

```text
/* gpio_f1_vs_f4.c — 同一个引脚，三个系列三套寄存器
 *
 * 这篇文章里所有的地址和位号都是【手册事实】（出处见正文表格），编译器证明不了
 * 它们跟真实芯片对不对得上 —— 它只能证明"这套数字内部自洽"。
 * 所以这个文件的作用不是"验证手册"，而是：
 *
 *   ① 把手册里散在几章的数字，写成一份能编译、能被 _Static_assert 复核的常量表；
 *   ② 让编译器把每个系列的"引脚 → 位域移位量"算一遍，把结果摊在反汇编里 ——
 *      F1 的 (pin-8)*4 和 F4 的 pin*2 差多少，一眼看得见；
 *   ③ 把"抄错系列"这件事变成编译期错误：PC13 在 F1 上是 CRH 的 bit[23:20]，
 *      在 F4 上是 MODER 的 bit[27:26]，两组数字完全不搭界。
 *
 * ⚠ 本文件【不碰任何硬件】，全部是整数常量与纯函数，所以它能在
 *   cortex-m3 / m4 / m0 上编过，也能在反汇编里一眼看完。
 *
 * 断言消息一律写 ASCII：中文会被 GCC 转义成八进制串，出错时读不出人话
 * （§6.2 坑三实测过）。
 *
 * 出处（正文表格里逐条列了节号和印刷页码）：
 *   F1  — RM0008  DocID13902 Rev 17  §9.2.1 / §9.2.2 / §9.2.7 / §5.1.2
 *   F4  — RM0090  Rev 22             §8.4.1 … §8.4.9 / §6.3.10
 *   H7  — RM0433  Rev 9              §11.4 / §8.7.43 / Table 8
 */
#include <stdint.h>

/* ============================================================
   第一组：F1（STM32F103，Cortex-M3）—— nibble 布局
   GPIOC 挂在 APB2 上，每引脚 4 位配置：低 2 位 MODE，高 2 位 CNF。
   CRL 管 pin0~7，CRH 管 pin8~15。
   ============================================================ */
#define F1_GPIOC_BASE    0x40011000UL      /* APB2 */
#define F1_CRL_OFF       0x00UL
#define F1_CRH_OFF       0x04UL
#define F1_IDR_OFF       0x08UL
#define F1_ODR_OFF       0x0CUL
#define F1_BSRR_OFF      0x10UL
#define F1_BRR_OFF       0x14UL
#define F1_LCKR_OFF      0x18UL

#define F1_RCC_BASE      0x40021000UL
#define F1_APB2ENR_OFF   0x18UL
#define F1_APB2ENR       (F1_RCC_BASE + F1_APB2ENR_OFF)
#define F1_IOPCEN_BIT    4U                /* RCC_APB2ENR 的 bit4 使能 GPIOC */

/* F1 的 MODE 编码【不是】二进制递增，这是 F1 独有的反直觉：
 *   00 = 输入     01 = 输出 10 MHz     10 = 输出 2 MHz     11 = 输出 50 MHz
 * 10 MHz 的编码比 2 MHz 还小 —— 记成"越大越快"的人，这里会写出 2 MHz 当 50 MHz。
 * PC13 必须用 10（2 MHz）：RM0008 对 PC13/14/15 有额外限制，见正文。 */
#define F1_MODE_IN       0x0U
#define F1_MODE_OUT_10M  0x1U
#define F1_MODE_OUT_2M   0x2U
#define F1_MODE_OUT_50M  0x3U
#define F1_CNF_OUT_PP    0x0U              /* 通用推挽输出 */
#define F1_CNF_OUT_OD    0x1U              /* 通用开漏输出 */
#define F1_CNF_AF_PP     0x2U              /* 复用推挽 */
#define F1_CNF_AF_OD     0x3U              /* 复用开漏 */

_Static_assert(F1_CRH_OFF == F1_CRL_OFF + 4UL, "CRL/CRH adjacent");
_Static_assert(F1_BSRR_OFF == F1_ODR_OFF + 4UL, "ODR/BSRR adjacent");
_Static_assert(F1_APB2ENR == 0x40021018UL, "F1 RCC_APB2ENR address");

/* ============================================================
   第二组：F4（STM32F407，Cortex-M4）—— 现代布局
   GPIOC 挂在 AHB1 上（不是 APB2！），每引脚 2 位：
   MODER / OTYPER(1 位) / OSPEEDR / PUPDR，复用功能在 AFRL/AFRH。
   ============================================================ */
#define F4_GPIOC_BASE    0x40020800UL      /* AHB1 */
#define F4_MODER_OFF     0x00UL
#define F4_OTYPER_OFF    0x04UL
#define F4_OSPEEDR_OFF   0x08UL
#define F4_PUPDR_OFF     0x0CUL
#define F4_IDR_OFF       0x10UL
#define F4_ODR_OFF       0x14UL
#define F4_BSRR_OFF      0x18UL
#define F4_LCKR_OFF      0x1CUL
#define F4_AFRL_OFF      0x20UL
#define F4_AFRH_OFF      0x24UL

#define F4_RCC_BASE      0x40023800UL
#define F4_AHB1ENR_OFF   0x30UL
#define F4_AHB1ENR       (F4_RCC_BASE + F4_AHB1ENR_OFF)
#define F4_GPIOCEN_BIT   2U                /* RCC_AHB1ENR 的 bit2 使能 GPIOC */

#define F4_MODER_OUT     0x1U              /* 通用输出 */
#define F4_MODER_AF      0x2U              /* 复用功能 */
#define F4_OTYPER_PP     0x0U
#define F4_OTYPER_OD     0x1U
#define F4_OSPEED_LOW    0x0U
#define F4_OSPEED_MED    0x1U
#define F4_OSPEED_HIGH   0x2U
#define F4_OSPEED_VHIGH  0x3U

_Static_assert(F4_OTYPER_OFF  == F4_MODER_OFF   + 4UL, "MODER/OTYPER adjacent");
_Static_assert(F4_OSPEEDR_OFF == F4_OTYPER_OFF  + 4UL, "OTYPER/OSPEEDR adjacent");
_Static_assert(F4_AFRH_OFF    == F4_AFRL_OFF    + 4UL, "AFRL/AFRH adjacent");
_Static_assert(F4_AHB1ENR == 0x40023830UL, "F4 RCC_AHB1ENR address");

/* 同一个偏移表，F1 与 F4 从 AFRL 开始就【完全对不上】——
 * 这不是笔误，是两代外设的寄存器映射本来就不一样。
 * 下面断言的是"两套表确实不同"，防止哪天有人"顺手统一"成一份。 */
_Static_assert(F1_ODR_OFF != F4_ODR_OFF, "F1/F4 ODR offsets must differ");
_Static_assert(F1_BSRR_OFF != F4_BSRR_OFF, "F1/F4 BSRR offsets must differ");

/* ============================================================
   第三组：H7（STM32H743，Cortex-M7）—— 寄存器布局和 F4 一模一样，
   但整个 GPIO 搬到了另一个地址空间（D3 域，0x5800_0000 起），
   时钟也从 AHB1ENR 换成了 AHB4ENR。
   【位号还是 bit2】—— 这就是最容易骗人的地方：位号对、内部布局也对，
   只有基址变了；而基址写错照样编得过、照样什么都不发生。
   ============================================================ */
#define H7_GPIOC_BASE    0x58020800UL
#define H7_RCC_BASE      0x58024400UL
#define H7_AHB4ENR_OFF   0x0E0UL
#define H7_AHB4ENR       (H7_RCC_BASE + H7_AHB4ENR_OFF)
#define H7_GPIOCEN_BIT   2U

_Static_assert(H7_AHB4ENR == 0x580244E0UL, "H7 RCC_AHB4ENR address");

/* F4 与 H7 的 GPIO 寄存器偏移表【完全相同】（MODER 0x00 … AFRH 0x24）。
 * 所以"布局同构"是真的 —— 但同构的只是【外设内部】，
 * 基址和时钟使能寄存器这两样，H7 全换过了。 */
_Static_assert(F4_AFRH_OFF == 0x24UL, "F4/H7 modern layout: AFRH at 0x24");

/* 三个系列并排看，差别一目了然：
 *   使能位号：F1 = 4（APB2ENR.bit4）   F4 = 2   H7 = 2      ← 后两个一样
 *   使能地址：F1 = 0x40021018     F4 = 0x40023830   H7 = 0x580244E0   ← 三个全不一样
 * 只记住"GPIO 时钟使能是 bit2"的人，在 F1 上必错；
 * 只背下一个地址的人，换一代就全废。两样都得记，而且都得跟着具体芯片走。 */
_Static_assert(F1_IOPCEN_BIT != H7_GPIOCEN_BIT, "F1 uses bit4, H7 uses bit2");
_Static_assert(F4_GPIOCEN_BIT == H7_GPIOCEN_BIT, "F4/H7 share the bit number");
_Static_assert(F4_AHB1ENR != H7_AHB4ENR, "F4/H7 enable registers differ");
_Static_assert(F4_GPIOC_BASE != H7_GPIOC_BASE, "F4/H7 GPIO bases differ");

/* ============================================================
   第四组：引脚 → 移位量。这是四个系列差别最硬的地方。
   ============================================================ */
/* F1：4 位/引脚，pin<8 在 CRL，pin>=8 在 CRH */
#define F1_CFG_SHIFT(pin)   (((pin) & 7U) * 4U)
#define F1_CFG_REG_IS_CRH(pin)  ((pin) >= 8U)

/* F4/G0：2 位/引脚（MODER/OSPEEDR/PUPDR），1 位/引脚（OTYPER） */
#define MODERN_SHIFT_2BIT(pin)  ((pin) * 2U)
#define MODERN_SHIFT_1BIT(pin)  ((pin) * 1U)
/* 复用功能：pin<8 用 AFRL，pin>=8 用 AFRH，都是 4 位/引脚 */
#define MODERN_AF_SHIFT(pin)    (((pin) & 7U) * 4U)

/* PC13（板上 LED）在四个系列里各自落在哪一位 —— 把这三行并排看一眼，
 * "抄错系列"的后果就清楚了：三组完全不同的数字，编译器都不会拦你。 */
_Static_assert(F1_CFG_SHIFT(13) == 20U, "F1 PC13 -> CRH bit[23:20]");
_Static_assert(F1_CFG_REG_IS_CRH(13),   "F1 PC13 lives in CRH, not CRL");
_Static_assert(MODERN_SHIFT_2BIT(13) == 26U, "F4/G0 PC13 -> MODER bit[27:26]");
_Static_assert(MODERN_SHIFT_1BIT(13) == 13U, "F4/G0 PC13 -> OTYPER bit 13");
_Static_assert(MODERN_AF_SHIFT(13) == 20U, "F4/G0 PC13 -> AFRH bit[23:20]");

/* F1 那 4 位的组装：MODE 放低 2 位、CNF 放高 2 位。
 * 推挽 + 2 MHz = CNF(00) << 2 | MODE(10) = 0b0010 = 0x2 */
#define F1_CFG_NIBBLE(cnf, mode)  (((cnf) << 2) | (mode))
_Static_assert(F1_CFG_NIBBLE(F1_CNF_OUT_PP, F1_MODE_OUT_2M) == 0x2U,
               "F1 push-pull 2MHz nibble = 0x2");

/* 而现代布局里"推挽 + 低速"是【两个寄存器各写一半】：
 * MODER 写 01（通用输出）、OTYPER 写 0（推挽）、OSPEEDR 写 00（低速）。
 * 同一件事，F1 一个 nibble 说完，F4 要写三个寄存器。 */
_Static_assert(F4_MODER_OUT == 0x1U && F4_OTYPER_PP == 0x0U && F4_OSPEED_LOW == 0x0U,
               "F4 push-pull low-speed spans three registers");

/* ============================================================
   第五组：真函数 —— 让反汇编把移位量摊出来
   四个函数做同一件事：算出"PC13 的配置字该往哪个地址、哪一位写"。
   返回值就是最终要写进寄存器的立即数。
   ============================================================ */
#define LED_PIN  13U

/* 先把三个系列的【目标地址】算出来。地址这一半比移位量更容易出错：
 * 移位量算错至少还能看出"位置不对"，地址写错是往一片没人应答的空间里写，
 * 现象和 §6.2 的位带事故一模一样 —— 编译过、下载成功、什么都不发生。 */
_Static_assert(F1_GPIOC_BASE + F1_CRH_OFF == 0x40011004UL, "F1 GPIOC_CRH");
_Static_assert(F4_GPIOC_BASE + F4_MODER_OFF == 0x40020800UL, "F4 GPIOC_MODER");
_Static_assert(H7_GPIOC_BASE + 0x00UL == 0x58020800UL, "H7 GPIOC_MODER");

uint32_t f1_crh_addr(void)     { return F1_GPIOC_BASE + F1_CRH_OFF; }
uint32_t f4_moder_addr(void)   { return F4_GPIOC_BASE + F4_MODER_OFF; }
uint32_t h7_moder_addr(void)   { return H7_GPIOC_BASE; }
uint32_t f1_clock_addr(void)   { return F1_APB2ENR; }   /* 0x40021018 */
uint32_t f4_clock_addr(void)   { return F4_AHB1ENR; }   /* 0x40023830 */
uint32_t h7_clock_addr(void)   { return H7_AHB4ENR; }   /* 0x580244E0 */

/* F1：先清 4 位、再写 0x2。清掩码要算在 32 位寄存器的正确半区。 */
uint32_t f1_pc13_clear_mask(void)
{
    return ~(0xFUL << F1_CFG_SHIFT(LED_PIN));       /* 注意取反后是高半区为 1 */
}
uint32_t f1_pc13_value(void)
{
    return (uint32_t)F1_CFG_NIBBLE(F1_CNF_OUT_PP, F1_MODE_OUT_2M) << F1_CFG_SHIFT(LED_PIN);
}
uint32_t f1_clock_enable(void)
{
    return 1UL << F1_IOPCEN_BIT;                    /* 0x40021018 的 bit4 */
}

/* F4 / G0：同一个引脚，三个寄存器各算各的 */
uint32_t modern_moder_mask(void)
{
    return ~(0x3UL << MODERN_SHIFT_2BIT(LED_PIN));
}
uint32_t modern_moder_value(void)
{
    return (uint32_t)F4_MODER_OUT << MODERN_SHIFT_2BIT(LED_PIN);
}
uint32_t modern_otyper_mask(void)
{
    return ~(0x1UL << MODERN_SHIFT_1BIT(LED_PIN));
}
uint32_t modern_clock_enable(void)
{
    /* F4 是 AHB1ENR.bit2，H7 是 AHB4ENR.bit2 —— 位号一样，地址差着十万八千里。
     * 下面这个函数故意用 F4 的位号：正文要讲的就是"位号一样最容易骗人"。 */
    return 1UL << F4_GPIOCEN_BIT;
}

/* ============================================================
   第六组：LCKR —— 配置锁定
   写进去之后，这个端口的配置位就锁死了，后续对 CRL/CRH（或 MODER 等）的写入
   被硬件忽略，直到复位。序列是固定的五步，顺序错一步就锁不上，
   而且【锁不上不会有任何报错】—— 读回 LCKK 才发现没成。
   ============================================================ */
#define LCKK_BIT  16U

/* 序列里真正要写进 LCKR 的只有【两个值】，交替出现：
 *   带 key 的 = (1 << 16) | (1 << pin)
 *   不带 key = (1 << pin)
 * 第 4、5 步是【读】LCKR 并检查 bit16，读出来的值不写回去。 */
#define LCKR_PIN_VALUE(pin)  (1UL << (pin))
#define LCKR_KEY_VALUE(pin)  ((1UL << LCKK_BIT) | (1UL << (pin)))

_Static_assert(LCKR_PIN_VALUE(13) == 0x00002000UL, "LCKR pin13 alone");
_Static_assert(LCKR_KEY_VALUE(13) == 0x00012000UL, "LCKR pin13 + LCKK");
/* 两个值只差 bit16，也就是 LCKK 那一位。 */
_Static_assert((LCKR_KEY_VALUE(13) ^ LCKR_PIN_VALUE(13)) == (1UL << LCKK_BIT),
               "key and non-key values differ only in LCKK");

/* ★ 顺序是手册写死的 1 / 0 / 1，不是 0 / 1 / 1。
 * 两本手册的原文都是 "WR LCKR[16] = 1 … WR LCKR[16] = 0 … WR LCKR[16] = 1"，
 * ST 的 HAL（HAL_GPIO_LockPin）也照着这个顺序实现。
 * 早期 StdPeriph 库里那套写法不一定是这个次序 —— 以上板为准时，认手册。 */
uint32_t lckr_step1_write(void)   { return LCKR_KEY_VALUE(LED_PIN); }  /* 写：LCKK=1，pin 位=1 */
uint32_t lckr_step2_write(void)   { return LCKR_PIN_VALUE(LED_PIN); }  /* 写：LCKK=0，pin 位不变 */
uint32_t lckr_step3_write(void)   { return LCKR_KEY_VALUE(LED_PIN); }  /* 写：LCKK=1，再来一遍 */
/* 第 4 步读回 LCKR（丢弃结果）、第 5 步再读回并检查 bit16 == 1，锁定才算成立。
 * 这两步没有"值"可算，所以这里没有对应的函数 —— 缺的这两步正是
 * 新手最常漏掉的：写完就不管了，其实压根没锁上。
 * 手册对失败的态度也很干脆："Any error in the lock sequence aborts the lock."
 * 锁不上不会有异常、不会有中断、没有任何反馈，只能靠读回 LCKK 自己查。 */
uint32_t lckr_check_key(void)     { return LCKR_KEY_VALUE(LED_PIN); }  /* 期望读回这个值 */
```

 

先看 **地址** 这一半。三个"取寄存器地址"的函数，编译出来各自揣着一个立即数：

 

**bash**  — 三代的目标地址并排（` -O2 -mcpu=cortex-m3 `，objdump -d）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c gpio_f1_vs_f4.c -o gpio_cortex-m3.o
$ arm-none-eabi-objdump -d gpio_cortex-m3.o | sed -n '/<f1_crh_addr>:/,/<f1_pc13_clear_mask>:/p'

00000000 <f1_crh_addr>:
   0:	4800      	ldr	r0, [pc, #0]	@ (4 <f1_crh_addr+0x4>)
   2:	4770      	bx	lr
   4:	40011004 	.word	0x40011004   ← F1：GPIOC_CRH，即 0x40011000 + 0x04

00000008 <f4_moder_addr>:
   8:	4800      	ldr	r0, [pc, #0]	@ (c <f4_moder_addr+0x4>)
   a:	4770      	bx	lr
   c:	40020800 	.word	0x40020800   ← F4：GPIOC_MODER，即 0x40020800 + 0x00

00000010 <h7_moder_addr>:
  10:	4800      	ldr	r0, [pc, #0]	@ (14 <h7_moder_addr+0x4>)
  12:	4770      	bx	lr
  14:	58020800 	.word	0x58020800   ← H7：还是 GPIOC_MODER，整个外设换了地址空间

00000018 <f1_clock_addr>:
  18:	4800      	ldr	r0, [pc, #0]	@ (1c <f1_clock_addr+0x4>)
  1a:	4770      	bx	lr
  1c:	40021018 	.word	0x40021018   ← F1：RCC_APB2ENR

00000020 <f4_clock_addr>:
  20:	4800      	ldr	r0, [pc, #0]	@ (24 <f4_clock_addr+0x4>)
  22:	4770      	bx	lr
  24:	40023830 	.word	0x40023830   ← F4：RCC_AHB1ENR

00000028 <h7_clock_addr>:
  28:	4800      	ldr	r0, [pc, #0]	@ (2c <h7_clock_addr+0x4>)
  2a:	4770      	bx	lr
  2c:	580244e0 	.word	0x580244e0   ← H7：RCC_AHB4ENR

00000030 <f1_pc13_clear_mask>:
```

 

六个常量全都原样躺在字面量池里 —— 这是它们 **没有被编译器改写或优化掉** 的证据。 但请注意这个说法有多小：它只说明"我写的就是我算的"。至于 ` 0x40011000 ` 在 F103 上是不是真等于 GPIOC，得翻手册。   
不过光是这一屏就够说明问题了： **同一个 GPIOC，三个地址分属三个完全不同的地址空间** 。 把 ` 0x40011000 ` 抄到 F4 上，你写的是一个没人应答的地址， 现象和 §6.2 那次位带事故一模一样。

 

再看 **位域** 这一半。同一个 PC13，在三代里要往寄存器里放的值：

 

**bash**  — 同一个引脚，四组完全不同的立即数（` -O2 -mcpu=cortex-m3 `）

 

```text
$ arm-none-eabi-objdump -d gpio_cortex-m3.o | sed -n '/<f1_pc13_clear_mask>:/,/<lckr_step1_write>:/p'

00000030 <f1_pc13_clear_mask>:
  30:	f46f 0070 	mvn.w	r0, #15728640	@ 0xf00000   ← F1 清掩码 ~0xF00000
  34:	4770      	bx	lr
  36:	bf00      	nop

00000038 <f1_pc13_value>:
  38:	f44f 1000 	mov.w	r0, #2097152	@ 0x200000   ← F1 写值 0x200000（CRH bit[23:20]）
  3c:	4770      	bx	lr
  3e:	bf00      	nop

00000040 <f1_clock_enable>:
  40:	2010      	movs	r0, #16   ← F1 使能位 1<<4
  42:	4770      	bx	lr

00000044 <modern_moder_mask>:
  44:	f06f 6040 	mvn.w	r0, #201326592	@ 0xc000000   ← F4/H7 清掩码 ~0xC000000（与 F1 那位无一相同）
  48:	4770      	bx	lr
  4a:	bf00      	nop

0000004c <modern_moder_value>:
  4c:	f04f 6080 	mov.w	r0, #67108864	@ 0x4000000   ← F4/H7 写值 0x4000000（MODER bit[27:26]）
  50:	4770      	bx	lr
  52:	bf00      	nop

00000054 <modern_otyper_mask>:
  54:	f46f 5000 	mvn.w	r0, #8192	@ 0x2000   ← OTYPER 每引脚 1 位，第三个掩码
  58:	4770      	bx	lr
  5a:	bf00      	nop

0000005c <modern_clock_enable>:
  5c:	2004      	movs	r0, #4   ← F4/H7 使能位 1<<2
  5e:	4770      	bx	lr

00000060 <lckr_step1_write>:
```

 

把这四个数并排念一遍：F1 的清掩码是 ` ~0xF00000 `、写的值是 ` 0x200000 `；F4 / H7 的清掩码是 ` ~0xC000000 `、 写的值是 ` 0x4000000 `。 **没有一位是对得上的**  —— 因为一个落在 ` bit[23:20] `（4 位），另一个落在 ` bit[27:26] `（2 位）。   
这也解释了 F1 为什么要把配置拆成 ` CRL ` / ` CRH ` 两个寄存器： 16 个引脚 × 4 位 = 64 位，一个 32 位寄存器装不下；而现代布局 16 × 2 = 32 位，一个 ` MODER ` 正好装完 ——  **这才是"分不分两个寄存器"的真正原因， 不是 ST 当年随手这么定的** 。

 

⚠ F1 独有的坑：` MODE ` 那两位不是二进制递增

 现代布局里，速度字段的值越大越快，符合直觉。F1 不是： 

| 编码 | 含义 | 直觉对不对 |
| --- | --- | --- |
| ` 00 ` | 输入 | — |
| ` 01 ` | 输出，最大 10 MHz | 还行 |
| ` 10 ` | 输出，最大  **2 MHz** | **反了** |
| ` 11 ` | 输出，最大 50 MHz | 跳变 |

 ` 10 ` 比 ` 01 ` 大，速度却低一个数量级。 把"值大就快"的经验带进 F1，你会给一个需要 50 MHz 的引脚写上 ` 10 `， 然后得到一个 2 MHz 的引脚 —— 而且它 **照样能点亮 LED，只是在示波器上慢得离谱** ， 所以这个错误能潜伏很久。   
上表这个编码是  **手册事实** （RM0008 §9.2.1 / §9.2.2 的 MODE 位说明）。 代码里 ` F1_MODE_OUT_10M=0x1 `、` F1_MODE_OUT_2M=0x2 ` 这几行就是照抄手册，没有任何"推导"。

 

同一份源码，只把 ` -mcpu ` 换成 cortex-m0 —— 你会看到 F1 的掩码和写值  **整块从指令变成了字面量池里的数据** ：

 

**bash**  — 同样的源码换到 Cortex-M0（ARMv6-M，没有 32 位 Thumb 编码）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O2 -c gpio_f1_vs_f4.c -o gpio_cortex-m0.o
$ arm-none-eabi-objdump -d gpio_cortex-m0.o | sed -n '/<f1_pc13_clear_mask>:/,/<modern_clock_enable>:/p'

00000030 <f1_pc13_clear_mask>:
  30:	4800      	ldr	r0, [pc, #0]	@ (34 <f1_pc13_clear_mask+0x4>)
  32:	4770      	bx	lr
  34:	ff0fffff 	.word	0xff0fffff   ← ~0xF00000：M3 用 mvn.w 算，M0 只能存数据

00000038 <f1_pc13_value>:
  38:	2080      	movs	r0, #128	@ 0x80
  3a:	0380      	lsls	r0, r0, #14   ← M0 要两步：0x80 << 14 = 0x200000
  3c:	4770      	bx	lr
  3e:	46c0      	nop			@ (mov r8, r8)

00000040 <f1_clock_enable>:
  40:	2010      	movs	r0, #16
  42:	4770      	bx	lr

00000044 <modern_moder_mask>:
  44:	4800      	ldr	r0, [pc, #0]	@ (48 <modern_moder_mask+0x4>)
  46:	4770      	bx	lr
  48:	f3ffffff 	.word	0xf3ffffff   ← ~0xC000000 同样躺进池子

0000004c <modern_moder_value>:
  4c:	2080      	movs	r0, #128	@ 0x80
  4e:	04c0      	lsls	r0, r0, #19   ← 同样两步：0x80 << 19 = 0x4000000
  50:	4770      	bx	lr
  52:	46c0      	nop			@ (mov r8, r8)

00000054 <modern_otyper_mask>:
  54:	4800      	ldr	r0, [pc, #0]	@ (58 <modern_otyper_mask+0x4>)
  56:	4770      	bx	lr
  58:	ffffdfff 	.word	0xffffdfff   ← ~0x2000 也一样

0000005c <modern_clock_enable>:
```

 

M0 上没有"把任意 32 位立即数塞进寄存器"的指令（ARMv6-M 的立即数能力很有限）， 所以 ` ~0xF00000 ` 这种值只能 **躺进字面量池、用一条 ` ldr ` 取** 。   
数一下字节就具体了：M3 上算出这个掩码是一条 ` mvn.w `，  **4 字节** ；M0 上是一条 2 字节的 ` ldr ` 加上池子里 4 字节的常量，  **合计 6 字节** ，而且多一次内存访问。 同样的表达式，M0 比 M3 多出 **一半的字节** 。   
这正好是 §3 讲过的老道理在实战里的样子： **同一个常量表达式， 在不同架构上的代价可以差出好几成**  —— 但你不需要为此改写源码，编译器会替你选， 你要做的是 **知道它发生了** ，在真正抠字节的地方（中断服务程序、紧凑的启动代码） 才有判断力。

 

还有一件事得交代清楚：上面那些结论都建立在"这份文件在三个核上都能干净编过"之上。 教程里写"零告警"，就得是真的跑出来零告警，而不是"没看见告警"：

 

**bash**  — 三个核各跑一遍 ` -Wall -Wextra `（` -O2 `，只做语法与语义检查）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -O2 -fsyntax-only gpio_f1_vs_f4.c
$ arm-none-eabi-gcc -mcpu=cortex-m4 -mthumb -std=c11 -Wall -Wextra -O2 -fsyntax-only gpio_f1_vs_f4.c
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -Wall -Wextra -O2 -fsyntax-only gpio_f1_vs_f4.c

（三条命令都：无任何输出，退出码 0）
```

 

三条命令一条输出都没有，退出码都是 0 —— 也就是说这份文件里没有任何一处 "编译器想提醒你、但你忽略了"的地方。 **这不是它能证明"寄存器地址是错的"， 而是为了排除"编译器早就看出有问题"这种可能** ：零告警之后，那些数字对不对， 就纯粹是手册的事了，编译器不再背这个锅。

 

📖 ` PC13 ` / ` PC14 ` / ` PC15 ` 为什么只能用 2 MHz

 

这是 F1 上最反直觉、也最容易被抄到别的引脚上去的一条限制。手册的原文是：

 

**RM0008 ` DocID13902 Rev 17 ` §5.1.2「Battery backup domain」（印刷页 68）**   
  *"Due to the fact that the switch only sinks a limited amount of current (3 mA), the use of GPIOs PC13 to PC15 in output mode is restricted: the speed has to be limited to 2 MHz with a maximum load of 30 pF and  **these IOs must not be used as a current source (e.g. to drive a LED)** ."*

 

注意这句话在手册里的 **位置** ：它不在 GPIO 章节，而在第 5 章「Power control (PWR)」。 GPIO 章节只是把它引用了一下 —— §9.3.1 那一页（印刷页 174）里写着  *"Refer to the note on IO usage restrictions in Section 5.1.2: Battery backup domain."*   **这正是"配置对一个引脚全对、波形就是不对"这类问题最难查的原因： 限制常常不在你以为的那一章。**

 

三个数字各自对应一件事，缺一个都会踩坑：

 

```zhizhan-table
{"rows":[[{"body":"原文","header":true,"rowSpan":1,"colSpan":1},{"body":"它管的是什么","header":true,"rowSpan":1,"colSpan":1},{"body":"违反之后会出什么事  \n（推断，手册没给量化结论）","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` 3 mA `","header":false,"rowSpan":1,"colSpan":1},{"body":"这三个脚经过一个\"只灌得起 3 mA\"的模拟开关供电 —— 这是 **物理限制** ，不是建议值","header":false,"rowSpan":1,"colSpan":1},{"body":"拉超过 3 mA，输出电压会被拉塌，行为不可预期","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` 2 MHz ` \\+ ` 30 pF `","header":false,"rowSpan":1,"colSpan":1},{"body":"输出翻转速度与负载电容的乘积不能超过这个开关的驱动能力","header":false,"rowSpan":1,"colSpan":1},{"body":"波形上升沿变圆、边沿变缓，高频下干脆没有完整电平","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**不能当电流源**","header":false,"rowSpan":1,"colSpan":1},{"body":"只允许 **灌电流** （外部拉高、引脚拉低），不允许 **拉电流** （引脚推高去点亮东西）","header":false,"rowSpan":1,"colSpan":1},{"body":"点不亮，或者亮得很暗 —— 手册没写\"超了会怎样\"，只是明确说了  *must not*","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

**那你手里那块蓝板的 LED 为什么就接在 PC13 上？**  因为它接的是 ` VDD → LED → 限流电阻 → PC13 `： 电流从 VDD 出，经 LED 进引脚 —— 引脚是 **灌** 电流的，正好落在手册允许的那一半里。 这也顺带解释了为什么这块板子是 **低电平点亮** （§6.5 那张关键数字表里已经写过， 现在你知道它背后的原因了）。   
反过来说： **如果你把 LED 改成"引脚 → LED → GND"，同一块板子、同一个引脚， 立刻就违反了手册这条限制。**

 

**最后一定要记住适用范围：这条限制只管 PC13 / PC14 / PC15。**  它和"GPIO 速度"是完全两件事 —— PC0 到 PC12 想跑 50 MHz 就跑 50 MHz。 把 2 MHz 抄到别的引脚上，你会得到一个"明明代码都对、波形就是起不来"的调试噩梦。

 

而 PC14 / PC15 比 PC13 还要多一层身份：它们同时是  **LSE 低速晶振的 ` OSC32_IN ` / ` OSC32_OUT `** 。 手册在 GPIO 那一章末尾留了个 Note，措辞毫不含糊：

 

**RM0008 §9.3 末尾的 Note「Using OSC32\_IN/OSC32\_OUT pins as GPIO ports PC14/PC15」（印刷页 174）**   
  *"The LSE oscillator pins OSC32\_IN and OSC32\_OUT can be used as general-purpose I/O PC14 and PC15, respectively, when the LSE oscillator is off.  **The LSE has priority over the GP IOs function.** "*

 

换句话说： **只要你板上焊了那颗 32.768 kHz 晶振，这两个脚就不再是普通 IO** ， 配置写得再对也没用 —— 优先级在晶振那边。同一页紧接着还有一句更狠的：  *"The PC14/PC15 GPIO functionality is lost when the 1.8 V domain is powered off (by entering standby mode) or when the backup domain is supplied by VBAT … In this case the IOs are set in analog mode."*  你从待机唤醒回来，这两个脚会 **自己变成模拟模式** ，得重新配置。 （LSE 是 32.768 kHz 这件事的出处是 §7.2.4「LSE clock」，印刷页 95； 而"PC13–PC15 只能 2 MHz"那条限制在第 68 页 ——  **三条关于同一组引脚的限制， 散在三章里** ，这就是它们难查的原因。）

 

最后一件 F1 有、而且经常被忽略的事： **` LCKR ` 配置锁定** 。 写进去之后，这个端口的配置位就被硬件冻住了，后面再往 ` CRL ` / ` CRH `（或 ` MODER `）写， **会被静默忽略** ， 直到复位。它的写入序列是固定的五步：

 

**bash**  — 三次写入各自要放的数（` -O2 -mcpu=cortex-m3 `）

 

```text
$ arm-none-eabi-objdump -d gpio_cortex-m3.o | sed -n '/<lckr_step1_write>:/,$p'

00000060 <lckr_step1_write>:
  60:	f44f 3090 	mov.w	r0, #73728	@ 0x12000   ← 第 1 步：LCKK=1 → 0x12000
  64:	4770      	bx	lr
  66:	bf00      	nop

00000068 <lckr_step2_write>:
  68:	f44f 5000 	mov.w	r0, #8192	@ 0x2000   ← 第 2 步：LCKK=0 → 0x2000（只差 bit16）
  6c:	4770      	bx	lr
  6e:	bf00      	nop

00000070 <lckr_step3_write>:
  70:	f44f 3090 	mov.w	r0, #73728	@ 0x12000   ← 第 3 步：LCKK=1 → 又是 0x12000
  74:	4770      	bx	lr
  76:	bf00      	nop

00000078 <lckr_check_key>:
  78:	f44f 3090 	mov.w	r0, #73728	@ 0x12000   ← 第 4、5 步是【读】LCKR 查 bit16，本文件无对应函数
  7c:	4770      	bx	lr
  7e:	bf00      	nop
```

 

💀 锁不上不会有任何报错 —— 这是 ` LCKR ` 最坑的地方

 

两本手册描述的是 **同一个序列** ：对 ` bit16 `（` LCKK `） 写 1 → 0 → 1，中间 ` LCK[15:0] ` 一个位都不许变。 顺手把两处原文都放上来 —— 它们是这套结论唯一的依据：

 

**F1：RM0008 ` DocID13902 Rev 17 ` §9.2.7（印刷页 173–174）**   
  *"LOCK key writing sequence: Write 1 / Write 0 / Write 1 / Read 0 / Read 1 (this read is optional but confirms that the lock is active)"*

 

**F4：RM0090 Rev 22 §8.4.8（印刷页 286–287）**   
  *"LOCK key write sequence: WR LCKR\[16\] = ` '1' ` \+ LCKR\[15:0\] ; WR LCKR\[16\] = ` '0' ` \+ LCKR\[15:0\] ; WR LCKR\[16\] = ` '1' ` \+ LCKR\[15:0\] ; RD LCKR ; RD LCKR\[16\] = ` '1' ` (this read operation is optional but it confirms that the lock is active). Note: During the LOCK key write sequence, the value of LCK\[15:0\] must not change.  **Any error in the lock sequence aborts the lock.** "*

 

上面反汇编里那三个数就是这三步：` 0x12000 `（` LCKK=1 ` \+ pin13）、` 0x2000 `（` LCKK=0 ` \+ pin13）、 ` 0x12000 ` ——  **1 / 0 / 1** 。 两个值只差 ` bit16 ` 这一位，写错顺序就锁不上。

 

关键在于最后一句话： **"Any error in the lock sequence aborts the lock."**  —— 序列错了，锁定就作废，然后 **没有异常、没有中断、没有任何反馈** 。 你唯一能查的办法是第 4、5 步回去读 ` LCKR `，看 ` bit16 ` 是不是 1。少写这两步读的人，会一直以为自己锁上了。

 

还有一处值得留意：早期 StdPeriph 库里的锁定函数和这个次序并不一致， 以板上实际行为为准时， **认手册** 。ST 现在的 HAL（` HAL_GPIO_LockPin `） 就是照手册这个 1 / 0 / 1 写的。

 

💡 换系列时，按这个顺序逐条核对（照抄这套清单，能省下几个通宵）

 

 
1. **时钟开了吗？开的是哪个寄存器、第几位？**  —— 这是所有"代码没错但不干活"的第一嫌疑人（§6.5 总结的头号原因）。F1 是 ` APB2ENR.bit4 `，F4 是 ` AHB1ENR.bit2 `，H7 是 ` AHB4ENR.bit2 `。
 
2. **基址从哪来的？**  —— 不要背"GPIO 是 0x4001\_1000"，要背"从哪本手册的哪张表里查"。
 
3. **每引脚几位、在哪个寄存器？**  —— 4 位就是 CRL/CRH 分家 \+ 4 位 nibble；2 位就是一个 MODER 包完。
 
4. **移位量公式对不对？**  —— F1 是 ` (pin & 7) * 4 ` 且 pin≥8 要换寄存器；现代布局是 ` pin * 2 `。
 
5. **这个引脚有没有专属限制？**  —— PC13/14/15 的 2 MHz 就是活例子。这一步最容易被跳过，因为它不在 GPIO 章节里，在"电源"章节里。

  

```zhizhan-anchor
ch6-6
```



## 6.6 实战二：ESP32 的寄存器访问方式

 

ESP32 也是内存映射的寄存器，但乐鑫提供了一层更好的封装： **` REG_WRITE ` / ` REG_SET_BIT ` 系列宏** ， 以及为每个外设生成的 ` struct ` 定义。理解两者的对应关系，你就能在 IDK 和寄存器之间自由切换。

 

esp32\_reg.c — ESP32 寄存器操作（ESP-IDF） C

 

```text
/**
 * ESP32 寄存器级 GPIO 操作
 *
 * 两种风格并存：
 *   ① 直接用 REG_* 宏（最接近硬件，和 STM32 思路一致）
 *   ② 用 soc/gpio_struct.h 里的结构体（可读性更好）
 *
 * 两者操作的是同一组寄存器。
 */

#include <stdint.h>
#include "soc/gpio_reg.h"          /* GPIO_OUT_REG / GPIO_OUT_W1TS_REG ... */
#include "soc/gpio_struct.h"       /* gpio_dev_t 结构体映射 */
#include "soc/io_mux_reg.h"        /* IO_MUX_GPIO2_REG */
#include "soc/gpio_sig_map.h"

/* ============================================================
   风格 ①：REG_* 宏 —— 和 STM32 思路完全一致
   ============================================================ */

/* ESP32 的 GPIO 输出寄存器（注意：ESP32 有两组，32-39 在第二组）*/
/* GPIO_OUT_REG     : 当前输出值（读-改-写，有竞态） */
/* GPIO_OUT_W1TS_REG: Write 1 To Set    —— 原子置位，等价于 STM32 的 BSRR 低 16 位 */
/* GPIO_OUT_W1TC_REG: Write 1 To Clear  —— 原子清零，等价于 STM32 的 BSRR 高 16 位 */

#define LED_GPIO        2

static void led_init_reg(void)
{
    /* ---- 配置 IO_MUX：把引脚接到 GPIO 矩阵 ---- */
    /* ESP32 的引脚默认可能连到别的外设（如 JTAG、SPI Flash），
       必须先通过 IO_MUX 配置为普通 GPIO 功能 */

    /* 设置功能为 GPIO（MCU_SEL = 2 表示普通 GPIO） */
    REG_SET_FIELD(IO_MUX_GPIO2_REG, MCU_SEL, 2);

    /* 设置驱动强度。
       ⚠ FUN_DRV 是 IO_MUX 里的一个【2 位字段】（bit11:10），不是单根 bit。
         单 bit 的开关才用 REG_SET_BIT / REG_CLR_BIT（比如下面的 FUN_IE）；
         多 bit 字段一律用 REG_SET_FIELD，它内部按 _S / _V 做掩码 + 移位，
         不会把字段写歪。三个宏的分工记牢：
           REG_SET_BIT  (reg, MASK)          → reg |= MASK        （单 bit）
           REG_CLR_BIT  (reg, MASK)          → reg &= ~MASK       （单 bit）
           REG_SET_FIELD(reg, FIELD, value)  → reg 的 FIELD 字段整体 = value */
    REG_SET_FIELD(IO_MUX_GPIO2_REG, FUN_DRV, 2);  /* 2 = 约 20 mA 档，够点 LED */
    REG_CLR_BIT(IO_MUX_GPIO2_REG, FUN_IE);        /* 关闭输入（不需要读回时省电） */

    /* 注意别把"驱动强度"和"输出使能"混为一谈：
       FUN_DRV 只决定这根脚能灌/拉多大电流；
       真正把引脚设成输出方向的是下面的 GPIO_ENABLE_W1TS。 */

    /* ---- 配置 GPIO 方向为输出 ---- */
    /* GPIO_ENABLE_W1TS：写 1 使能对应引脚为输出 */
    REG_WRITE(GPIO_ENABLE_W1TS_REG, (1UL << LED_GPIO));

    /* ---- 初始熄灭（ESP32 的板载 LED 通常高电平点亮）---- */
    REG_WRITE(GPIO_OUT_W1TC_REG, (1UL << LED_GPIO));
}

static inline void led_on_reg(void)
{
    REG_WRITE(GPIO_OUT_W1TS_REG, (1UL << LED_GPIO));   /* 原子置位 */
}

static inline void led_off_reg(void)
{
    REG_WRITE(GPIO_OUT_W1TC_REG, (1UL << LED_GPIO));   /* 原子清零 */
}

static inline void led_toggle_reg(void)
{
    /* 读输出寄存器判断当前状态 */
    if (REG_READ(GPIO_OUT_REG) & (1UL << LED_GPIO)) {
        led_off_reg();
    } else {
        led_on_reg();
    }
}

/* ============================================================
   风格 ②：结构体映射（GPIO 结构体在 soc/gpio_struct.h）
   ------------------------------------------------------------
   extern gpio_dev_t GPIO;   // 指向 0x3FF44000
   ============================================================ */

#include "soc/gpio_struct.h"

static void led_init_struct(void)
{
    /* 结构体成员直接对应寄存器偏移，可读性更好 */
    GPIO.enable_w1ts = (1UL << LED_GPIO);      /* 使能输出 */
    GPIO.out_w1tc    = (1UL << LED_GPIO);      /* 初始熄灭 */
}

static inline void led_on_struct(void)
{
    GPIO.out_w1ts = (1UL << LED_GPIO);
}

static inline void led_off_struct(void)
{
    GPIO.out_w1tc = (1UL << LED_GPIO);
}

/* ============================================================
   STM32 与 ESP32 的寄存器操作对照表
   ------------------------------------------------------------
   STM32F1                          ESP32
   ------------------------------   ------------------------------
   RCC_APB2ENR |= IOPCEN            自动使能（复位后外设时钟已开）
   时钟必须先开，否则写入无效        无此概念（但 IO_MUX 必须配置）
   GPIOC_CRH |= MODE/CNF            IO_MUX_GPIO2_REG 的 MCU_SEL 字段
   GPIOC_BSRR = (1 << pin)          GPIO_OUT_W1TS_REG = (1 << pin)
   GPIOC_BSRR = (1 << (pin+16))     GPIO_OUT_W1TC_REG = (1 << pin)
   GPIOC_ODR 读输出状态              GPIO_OUT_REG
   GPIOC_IDR 读输入状态              GPIO_IN_REG
   ============================================================ */

/* ============================================================
   ⚠ ESP32 特有的三个坑
   ============================================================ */

/* 坑 1：引脚必须"空闲"才能当 GPIO 用
   GPIO 6-11 接 SPI Flash，GPIO 34-39 是只输入引脚，GPIO 0/2/12/15 是 strapping 引脚
   （影响启动模式）。在 ESP32 上随便选引脚会导致无法启动或写入 Flash 失败。 */

/* 坑 2：双核并发
   ESP32 是双核，两个核可能同时访问同一寄存器。
   REG_* 宏本身不是原子的（虽然 W1TS/W1TC 是原子的）。
   跨核共享数据需要用自旋锁：
*/
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static portMUX_TYPE g_lock = portMUX_INITIALIZER_UNLOCKED;

static void safe_cross_core_update(void)
{
    portENTER_CRITICAL(&g_lock);        /* 自旋锁，同时防任务切换和跨核 */
    /* ... 访问共享寄存器/变量 ... */
    portEXIT_CRITICAL(&g_lock);
}

/* 坑 3：中断里不能用 portENTER_CRITICAL
   必须用 portENTER_CRITICAL_ISR / portEXIT_CRITICAL_ISR */
static void IRAM_ATTR gpio_isr_handler(void *arg)
{
    portMUX_TYPE *lock = (portMUX_TYPE *)arg;
    portENTER_CRITICAL_ISR(lock);
    /* ... */
    portEXIT_CRITICAL_ISR(lock);
}
```

  

```zhizhan-anchor
ch6-6-1
```



### 6.6.1 IO\_MUX 还是 GPIO Matrix：两根不同的线

 

上面那份代码里，` led_init_reg() ` 的第一件事是 ` REG_SET_FIELD(IO_MUX_GPIO2_REG, MCU_SEL, 2) `。为什么"点个灯"要先动这个？ 因为 ESP32 的引脚上其实接着  **两级开关** ，而这两级开关分属 **两个不同的外设** ：

 

| 对比项 | IO\_MUX 直连 | GPIO Matrix 绕行 |
| --- | --- | --- |
| 信号路径 | 外设 → IO\_MUX 的 ` MCU_SEL ` 功能号 → pad | 外设 → 矩阵的 ` OUT_SEL ` / ` IN_SEL ` → pad |
| 你要做的 | 只改 pad 寄存器一个字段 | pad 先选成普通 GPIO， *再* 把信号编号写进矩阵寄存器 |
| 装在哪个外设 | IO\_MUX，基址 ` 0x3ff49000 ` | GPIO，基址 ` 0x3ff44000 ` |
| 能连什么 | 只能选这个引脚 **被硬连到** 的那几个外设 | **任意** 输入信号到任意引脚、任意输出信号到任意引脚 |
| 代价 | 无额外逻辑 | 多一级组合逻辑。具体差几个周期属于芯片手册范畴，本节不做量化 |
| 什么时候用它 | 外设的标准引脚、要跑高频时序 | 引脚被板子布死了、或同一个信号要同时送几个脚 |

 

麻烦的地方在于： **两条路都需要 pad 的 ` MCU_SEL ` 选中某个功能号** 。 走 IO\_MUX 时它是"选那个外设"；走矩阵时它是"选普通 GPIO"（功能号 = ` 2 `）。 数字一样是 2，含义却相反 —— 这是这一节最容易记反的地方。

 

esp32\_iomux\_matrix.c — 两条路线写在一起，地址全部来自 IDF 头文件 C

 

```text
/**
 * ESP32：IO_MUX 直连 与 GPIO Matrix 绕行 —— 两根不同的线
 *
 * 本文件没有一个字是自己抄的地址，全部来自 IDF v6.0 的
 *   soc/esp32/register/soc/io_mux_reg.h
 *   soc/esp32/register/soc/gpio_reg.h
 *   soc/esp32/register/soc/rtc_io_reg.h
 *   soc/esp32/include/soc/gpio_sig_map.h
 *   soc/esp32/include/soc/rtc_io_channel.h
 * 所以页面上出现的每个 0x3ff4_xxxx 和每个 bit 号，
 * 都是乐鑫自己的头文件说了算，不是抄来的。
 */
#include <stdint.h>
#include "soc/soc.h"
#include "soc/io_mux_reg.h"
#include "soc/gpio_reg.h"
#include "soc/rtc_io_reg.h"
#include "soc/gpio_sig_map.h"
#include "soc/rtc_io_channel.h"

#define REG32(a)  (*(volatile uint32_t *)(uintptr_t)(a))

/* 两个主角分属【两个外设】—— 这是整节最容易搞混的地方：
     pad 寄存器在 IO_MUX 外设里（基址 + 0x40）
     矩阵寄存器在 GPIO  外设里（基址 + 0x538） */
#define PAD_GPIO2       IO_MUX_GPIO2_REG               /* IO_MUX + 0x40  */
#define MTX_OUT_GPIO2   GPIO_FUNC2_OUT_SEL_CFG_REG     /* GPIO   + 0x538 */

/* 第二组寄存器（GPIO32-39）的位号：GPIO32 对应 bit0 */
#define IN_GROUP1(n)    ((uint32_t)((n) - 32))

/* ============================================================
   路线 A：IO_MUX 直连 —— 信号不过矩阵
   ------------------------------------------------------------
   只把 pad 的功能号改成那个外设的编号。
   代价：一个引脚只能选它自己被硬连到的那几个外设。
   ============================================================ */
uint32_t iomux_gpio2_input_pullup(void)
{
    uint32_t pad = REG32(PAD_GPIO2);

    pad &= ~((uint32_t)MCU_SEL_M);
    pad |= (uint32_t)PIN_FUNC_GPIO << MCU_SEL_S;   /* 功能号 = 2 */
    pad |= (uint32_t)FUN_PU;                       /* 上拉  bit8 */
    pad &= ~((uint32_t)FUN_PD);                    /* 下拉  bit7 */
    pad |= (uint32_t)FUN_IE;                       /* 输入  bit9 */
    REG32(PAD_GPIO2) = pad;

    return REG32(GPIO_IN_REG) & (1u << 2);
}

/* ============================================================
   路线 B：GPIO Matrix 绕行 —— 任意信号到任意引脚
   ------------------------------------------------------------
   引脚先变成"普通 GPIO"，再把外设信号【编号】写进 OUT_SEL。
   代价：多一级延迟；换来的是布线自由度。
   ============================================================ */
void matrix_ledc_to_gpio2(void)
{
    uint32_t pad = REG32(PAD_GPIO2);
    uint32_t mtx;

    pad &= ~((uint32_t)MCU_SEL_M);
    pad |= (uint32_t)PIN_FUNC_GPIO << MCU_SEL_S;
    REG32(PAD_GPIO2) = pad;

    mtx  = REG32(MTX_OUT_GPIO2);
    mtx &= ~((uint32_t)GPIO_FUNC2_OUT_SEL_M);
    mtx |= (uint32_t)LEDC_HS_SIG_OUT0_IDX << GPIO_FUNC2_OUT_SEL_S;  /* 71 */
    mtx |= (uint32_t)GPIO_FUNC2_OEN_SEL;    /* 输出使能也交给矩阵管 */
    REG32(MTX_OUT_GPIO2) = mtx;
}

/* 谁都不接、就当普通 GPIO 输出用？OUT_SEL 写 SIG_GPIO_OUT_IDX 即可。
   这个数的存在本身就说明：GPIO 输出也是"矩阵上的一个信号"。 */
void matrix_plain_gpio2_out(void)
{
    uint32_t mtx = REG32(MTX_OUT_GPIO2);

    mtx &= ~((uint32_t)GPIO_FUNC2_OUT_SEL_M);
    mtx |= (uint32_t)SIG_GPIO_OUT_IDX << GPIO_FUNC2_OUT_SEL_S;      /* 256 */
    REG32(MTX_OUT_GPIO2) = mtx;

    REG32(GPIO_ENABLE_W1TS_REG) = 1u << 2;
    REG32(GPIO_OUT_W1TS_REG)    = 1u << 2;
    REG32(GPIO_OUT_W1TC_REG)    = 1u << 2;
}

/* ============================================================
   GPIO32-39：第二组寄存器，位号要减 32
   ------------------------------------------------------------
   32-39 这一组在 GPIO_OUT1_* / GPIO_ENABLE1_* / GPIO_IN1_* 里，
   GPIO32 对应 bit0。照 GPIO 号写 bit32 是写不进去的。
   ============================================================ */
void gpio32_33_set(void)
{
    REG32(GPIO_ENABLE1_W1TS_REG) = (1u << IN_GROUP1(32)) | (1u << IN_GROUP1(33));
    REG32(GPIO_OUT1_W1TS_REG)    = (1u << IN_GROUP1(32)) | (1u << IN_GROUP1(33));
    REG32(GPIO_OUT1_W1TC_REG)    = (1u << IN_GROUP1(32)) | (1u << IN_GROUP1(33));
}

/* ============================================================
   RTC 域：deep sleep 里还活着的那几个引脚
   ------------------------------------------------------------
   ⚠ 这里的位号【不是 GPIO 号】，是 RTCIO 通道号：
     GPIO34 → 通道 4，而 GPIO0 → 通道 11。照着 GPIO 号写必错。
   另一件事：RTC_GPIO 也有 W1TS / W1TC 这一对。
   ============================================================ */
void rtc_gpio34_pulse(void)
{
    REG32(RTC_GPIO_ENABLE_W1TS_REG) = 1u << RTCIO_GPIO34_CHANNEL;
    REG32(RTC_GPIO_OUT_W1TS_REG)    = 1u << RTCIO_GPIO34_CHANNEL;
    REG32(RTC_GPIO_OUT_W1TC_REG)    = 1u << RTCIO_GPIO34_CHANNEL;
}

/* 只读引脚：34-39 连输出使能位都不存在，这里能读、不能写。
   注意读它也得用第二组 —— GPIO_IN_REG >> 34 在 C 里是未定义行为，
   而且那个寄存器本来也只覆盖 0-31。 */
uint32_t gpio34_read(void)
{
    return (REG32(GPIO_IN1_REG) >> IN_GROUP1(34)) & 1u;
}
```

 

◆ 先说清楚：这一节的数字都是哪来的

 

这一节和 §6.5.2 有一处根本不同： **ESP32 的代码不能用 ARM 工具链验** 。 拿 ` arm-none-eabi-gcc ` 编它，语法能过、"编译通过"这盏灯也亮着， 可灯照亮的是错的东西 —— 你去核对反汇编，看到的会是 ARM 的 ` ldr `/` str `， 而 ESP32 上根本没有那些指令。

 

所以这一节换成真正的 ` xtensa-esp32-elf-gcc `，并且  **直接 include ESP-IDF v6.0 源码树里的 ` soc/*_reg.h `** 。 下面全部证据分成三类，来源不同、可核验的程度也不同，请不要混着看：

 

| 证据类型 | 谁保证它对 | 本节的哪些结论靠它 |
| --- | --- | --- |
| **工具链事实** | Xtensa 编译器现场编译 \+ objdump 反汇编 | 每个地址、每个位号、每条指令形状 |
| **IDF 头文件事实** | 乐鑫自己写的 ` soc/esp32/register/soc/*_reg.h ` | 常量池里那些数的 *含义* （哪个宏、哪个字段） |
| **源码事实** | 对 IDF 源码树真跑 ` grep `（§6.6.3） | cache/DMA 那几个宏的数值 —— 它们所在的头文件脱离 IDF 构建系统编不过 |

 

**没有第四类。**  凡是这三条路都够不着的话（比如"过矩阵会慢几个时钟周期"）， 这一节就明说不做量化，而不是给一个看着专业的数字。

 

先看最硬的一条： **地址到底在不在目标文件里** 。 ESP32 的寄存器地址不是立即数，而是躺在常量池（` .literal ` 段）里的一个数 —— ` .text ` 里那条 ` l32r ` 在链接前只是个占位。 把池子原样倒出来看：

 

**bash**  — 先确认零告警，再把常量池整个倒出来（` xtensa-esp32-elf-gcc `，` -O2 `）

 

```text
$ xtensa-esp32-elf-gcc -std=c11 -Wall -Wextra -O2 -fsyntax-only esp32_iomux_matrix.c
$ xtensa-esp-elf-objdump -s -j .literal iomux.o

iomux.o:     file format elf32-xtensa-le

Contents of section .literal:
 0000 4090f43f 7f8fffff 00230000 3c40f43f  @..?.....#..<@.?   ← 掩码 ~0x7080 = ~(MCU_SEL | FUN_PD)
 0010 4090f43f ff8fffff 00200000 3845f43f  @..?..... ..8E.?   ← 掩码 ~0x7000 = ~MCU_SEL；与上一行相减，差 0x0080 = FUN_PD
 0020 3845f43f 2440f43f 0840f43f 0c40f43f  8E.?$@.?.@.?.@.?
 0030 3040f43f 1440f43f 1840f43f 1084f43f  0@.?.@.?.@.?...?
 0040 0484f43f 0884f43f 4040f43f           ...?...?@@.?   ← 这一行最后一个字是 GPIO_IN1_REG，gpio34_read 用的就是它
```

 

注意第一行那条 ` -fsyntax-only ` 命令 **一行输出都没有** 。 这句话不是修辞：下面那段是脚本里 ` throw ` 出来的 —— 编译器只要吐一个字， 这一节就生成不出来。至于命令里的 ` -I ` 路径，是这个包装脚本按 IDF 的方式补上的 （真做项目时由 ` idf.py ` 负责），所以页面上显示的命令行和真正执行的那行完全一致。

 

池子里一共 19 个字，其中  **15 个落在外设寄存器窗口 ` 0x3FF0_0000 ` 段** ，剩下的 ` 4 ` 个是掩码和初值 —— 本身不是地址，但下面会看到它们同样有用。 逐字对照：

 

| 池内偏移 | 数值 | 它是谁 |
| --- | --- | --- |
| 0x00 | 0x3ff49040 | ` IO_MUX_GPIO2_REG ` |
| 0x04 | 0xffff8f7f | ` ~0x7080（清 MCU_SEL 与 FUN_PD 的掩码） ` |
| 0x08 | 0x00002300 | ` 0x2300（PIN_FUNC_GPIO<<12 \| FUN_PU \| FUN_IE） ` |
| 0x0c | 0x3ff4403c | ` GPIO_IN_REG ` |
| 0x10 | 0x3ff49040 | ` IO_MUX_GPIO2_REG（同一个 pad，第二次出现） ` |
| 0x14 | 0xffff8fff | ` ~0x7000（这次只清 MCU_SEL，没动上下拉） ` |
| 0x18 | 0x00002000 | ` 0x2000（只写功能号 2，没有 FUN_PU / FUN_IE） ` |
| 0x1c | 0x3ff44538 | ` GPIO_FUNC2_OUT_SEL_CFG_REG ` |
| 0x20 | 0x3ff44538 | ` GPIO_FUNC2_OUT_SEL_CFG_REG（矩阵寄存器，第二次出现） ` |
| 0x24 | 0x3ff44024 | ` GPIO_ENABLE_W1TS_REG ` |
| 0x28 | 0x3ff44008 | ` GPIO_OUT_W1TS_REG ` |
| 0x2c | 0x3ff4400c | ` GPIO_OUT_W1TC_REG ` |
| 0x30 | 0x3ff44030 | ` GPIO_ENABLE1_W1TS_REG ` |
| 0x34 | 0x3ff44014 | ` GPIO_OUT1_W1TS_REG ` |
| 0x38 | 0x3ff44018 | ` GPIO_OUT1_W1TC_REG ` |
| 0x3c | 0x3ff48410 | ` RTC_GPIO_ENABLE_W1TS_REG ` |
| 0x40 | 0x3ff48404 | ` RTC_GPIO_OUT_W1TS_REG ` |
| 0x44 | 0x3ff48408 | ` RTC_GPIO_OUT_W1TC_REG ` |
| 0x48 | 0x3ff44040 | ` GPIO_IN1_REG ` |

 

这张表不是我照着源码抄的 —— 偏移和数值两列是 **从上面那段 objdump 输出里现算出来的** ， "它是谁"一列逐条与 IDF 宏对照，对不上就当场报错。  **而且池子里每一个字都必须有交代** ：漏掉一个字，这张"逐字对照"的表就是残的， 而残的表看起来和完整的表一模一样。写这一节时正是这条守卫抓出了我漏掉的 ` 0x20 `（矩阵寄存器的第二次出现）。

 

于是页面上的 ` 0x3ff49040 ` 和 ` 0x3ff44538 ` 这两个数， 是"编译器 \+ IDF 头文件"共同背书过的。

 

◆ 两个掩码相减，FUN\_PD 的位号就掉出来了

 

回头看第 ` 0x00 ` 行和第 ` 0x10 ` 行，它们是 **同一个 pad**  的两组常量，分别来自 ` iomux_gpio2_input_pullup ` 和 ` matrix_ledc_to_gpio2 `。区别只有一个：前者要清掉上拉/下拉，后者不用。

 

 
- ` 0xffff8f7f ` = ` ~0x7080 ` —— 清了 ` MCU_SEL `  *和*  ` FUN_PD `
 
- ` 0xffff8fff ` = ` ~0x7000 ` —— 只清了 ` MCU_SEL `
 

 

两个数相减，差的正好是 ` 0x0080 `。  **这个差值不是推导出来的，是两份真输出对出来的**  —— 它同时证明了三件事：` MCU_SEL ` 占 ` 0x7000 `（bit14:12）、 ` FUN_PD ` 是 ` 0x80 `（bit7）、而且这两个字段互不重叠。 同一份对照里的 ` 0x2300 ` 与 ` 0x2000 ` 也是这个关系： 差值 ` 0x0300 ` 正好是 ` FUN_IE ` 加 ` FUN_PU `。

 

看两个关键点：` 0x3ff49040 ` 是 ` IO_MUX ` 的基址加 ` 0x40 `， 而 ` 0x3ff44538 ` 是 ` GPIO ` 的基址加 ` 0x538 `。 两个 ` 0x3ff4 ` 开头、只差中间几位 —— 这也正是"两根线分属两个外设"最容易看走眼的地方。

 

但这里有个必须交代清楚的地方。上面那段反汇编里，取地址的指令长这样： ` l32r a9, fffc0004 ` —— 那个 ` fffc0004 `  **不是一个地址** ，它是未链接目标文件里的占位符。真正的落点由搬迁表决定， 而搬迁表同时也是一份很强的证据：

 

**bash**  — 搬迁表：每条取址指令到底取的是池子里的哪个字

 

```text
$ xtensa-esp-elf-objdump -r iomux.o

iomux.o:     file format elf32-xtensa-le

RELOCATION RECORDS FOR [.text]:
OFFSET   TYPE              VALUE
00000003 R_XTENSA_SLOT0_OP  .literal
00000006 R_XTENSA_SLOT0_OP  .literal+0x00000004
00000011 R_XTENSA_SLOT0_OP  .literal+0x00000008
0000001c R_XTENSA_SLOT0_OP  .literal+0x0000000c
0000002f R_XTENSA_SLOT0_OP  .literal+0x00000010
00000032 R_XTENSA_SLOT0_OP  .literal+0x00000014
0000003a R_XTENSA_SLOT0_OP  .literal+0x00000018
00000043 R_XTENSA_SLOT0_OP  .literal+0x0000001c
00000067 R_XTENSA_SLOT0_OP  .literal+0x00000020
00000080 R_XTENSA_SLOT0_OP  .literal+0x00000024
0000008a R_XTENSA_SLOT0_OP  .literal+0x00000028
00000092 R_XTENSA_SLOT0_OP  .literal+0x0000002c
0000009f R_XTENSA_SLOT0_OP  .literal+0x00000030
000000a9 R_XTENSA_SLOT0_OP  .literal+0x00000034
000000b1 R_XTENSA_SLOT0_OP  .literal+0x00000038
000000bf R_XTENSA_SLOT0_OP  .literal+0x0000003c
000000c9 R_XTENSA_SLOT0_OP  .literal+0x00000040
000000d1 R_XTENSA_SLOT0_OP  .literal+0x00000044
000000df R_XTENSA_SLOT0_OP  .literal+0x00000048


RELOCATION RECORDS FOR [.xt.lit]:
OFFSET   TYPE              VALUE
00000000 R_XTENSA_32       .literal


RELOCATION RECORDS FOR [.xt.prop]:
OFFSET   TYPE              VALUE
00000000 R_XTENSA_32       .literal
0000000c R_XTENSA_32       .text
00000018 R_XTENSA_32       .text
00000024 R_XTENSA_32       .text
00000030 R_XTENSA_32       .text
0000003c R_XTENSA_32       .text
00000048 R_XTENSA_32       .text
00000054 R_XTENSA_32       .text
00000060 R_XTENSA_32       .text
0000006c R_XTENSA_32       .text
00000078 R_XTENSA_32       .text
00000084 R_XTENSA_32       .text
00000090 R_XTENSA_32       .text
0000009c R_XTENSA_32       .text
```

 

这张表要说两件事。

 

第一， **它把上一屏的占位符和池子偏移对上了** 。搬迁记录 ` 00000003 ` 指向 ` .literal `，也就是偏移 ` 0x00 `；而 ` 0x03 ` 正是 ` iomux_gpio2_input_pullup ` 里 ` l32r a9, fffc0004 ` 那条指令的位置。下面那些注释里的 "池子 0x00""池子 0x04"就是这么来的 —— 不是我看源码猜的。

 

第二，也是更硬的一条：` .text ` 段里  **一共 19 条搬迁记录，全部指向 ` .literal `， 一条符号搬迁都没有** 。这句话的分量在于它的反面 —— 如果编译器是把地址当成 "某个外部符号的地址"来处理，这张表里就会出现符号名，链接期才能定下来； 而这里一条都没有，说明 ` 0x3ff49040 ` 这类数在 **编译期**  就已经是常量了，来源只能是那些 ` soc/*_reg.h ` 里的宏。  **这正是"页面上的地址是乐鑫头文件给的"这句话的落点。**

 

再看两个 **难验证** 的数，它们才是位号事实的核心。IO\_MUX 那条路只做了一件事： 在一堆掩码里把字段挑出来改掉。

 

**bash**  — IO\_MUX 路线：改功能号 \+ 上拉 \+ 下拉 \+ 输入使能，四个动作编译成了什么

 

```text
$ xtensa-esp-elf-objdump -d iomux.o | sed -n '/<iomux_gpio2_input_pullup>:/,/retw/p'

00000000 <iomux_gpio2_input_pullup>:
   0:	004136               	entry	a1, 32
   3:	000091               	l32r	a9, fffc0004 <gpio34_read+0xfffbff28>   ← PAD_GPIO2 ← 池子 0x00 = 0x3ff49040
   6:	0000a1               	l32r	a10, fffc0008 <gpio34_read+0xfffbff2c>   ← 掩码 ← 池子 0x04 = ~0x7080
   9:	0020c0               	memw
   c:	0988                	l32i.n	a8, a9, 0
   e:	1088a0               	and	a8, a8, a10
  11:	0000a1               	l32r	a10, fffc0014 <gpio34_read+0xfffbff38>   ← 值   ← 池子 0x08 = 0x2300
  14:	2088a0               	or	a8, a8, a10
  17:	0020c0               	memw
  1a:	0989                	s32i.n	a8, a9, 0
  1c:	000081               	l32r	a8, fffc001c <gpio34_read+0xfffbff40>   ← GPIO_IN_REG ← 池子 0x0c = 0x3ff4403c
  1f:	0020c0               	memw
  22:	0828                	l32i.n	a2, a8, 0
  24:	480c                	movi.n	a8, 4   ← 1 << 2：读回的就是 GPIO2 那一位
  26:	102280               	and	a2, a2, a8
  29:	f01d                	retw.n
```

 

这里藏着这一节最漂亮的一条证据。编译器把四个"读-改-写"合并成了 **一次与、一次或** ， 于是两条算术指令的两个操作数，同时钉住了五个位号：

 

 
- 掩码是 ` 0xffff8f7f `，也就是 ` ~0x7080 `。 源码里被"清掉"的有两样：` MCU_SEL ` 和 ` FUN_PD `。 而 ` 0x7080 = 0x7000 | 0x0080 ` ——  **一条掩码同时证明 ` MCU_SEL ` 占 bit14:12、` FUN_PD ` 是 bit7** 。
 
- 值是 ` 0x2300 = 0x2000 | 0x0200 | 0x0100 `。 源码里被"置上"的有三样：功能号 2 左移 12 位、` FUN_IE `、` FUN_PU `。 于是  **同一个数同时证明 ` PIN_FUNC_GPIO = 2 `、` FUN_IE ` 是 bit9、` FUN_PU ` 是 bit8** 。
 

 

这不是"我查了手册说 bit8 是上拉"，而是"编译器把三种位号合成一个数，而这个数长这样"。 手册上任何一个位号写错了，这两个十六进制数都会变。

 

顺便说一个反复出现的 ` memw `：每一对寄存器读写之间都夹着它。 ESP32 上 ` volatile ` 只保证"不会被优化掉"， **不保证读写顺序**  —— 而外设寄存器往往对顺序有要求。这个坑在第 4 章讲 ` volatile ` 时已经埋下过伏笔。

 

再看矩阵那条路。它要写的是另一个外设、另一个寄存器，字段也更长（9 位）：

 

**bash**  — GPIO Matrix 路线：把 LEDC 的信号接到 GPIO2，以及"谁都不接"的普通输出

 

```text
$ xtensa-esp-elf-objdump -d iomux.o | sed -n '/<matrix_ledc_to_gpio2>:/,/retw/p'

0000002c <matrix_ledc_to_gpio2>:
  2c:	004136               	entry	a1, 32
  2f:	0000a1               	l32r	a10, fffc0030 <gpio34_read+0xfffbff54>
  32:	000091               	l32r	a9, fffc0034 <gpio34_read+0xfffbff58>
  35:	0020c0               	memw
  38:	0a88                	l32i.n	a8, a10, 0
  3a:	0000b1               	l32r	a11, fffc003c <gpio34_read+0xfffbff60>
  3d:	108890               	and	a8, a8, a9
  40:	2088b0               	or	a8, a8, a11
  43:	000091               	l32r	a9, fffc0044 <gpio34_read+0xfffbff68>
  46:	0020c0               	memw
  49:	0a89                	s32i.n	a8, a10, 0
  4b:	0020c0               	memw
  4e:	0988                	l32i.n	a8, a9, 0
  50:	00aea2               	movi	a10, 0xfffffe00   ← ~0x1FF：OUT_SEL 是 9 位字段（bit8:0）
  53:	1088a0               	and	a8, a8, a10
  56:	47a4a2               	movi	a10, 0x447   ← 0x447 = OEN_SEL(bit10) | 71(LEDC_HS_SIG_OUT0_IDX)
  59:	2088a0               	or	a8, a8, a10
  5c:	0020c0               	memw
  5f:	0989                	s32i.n	a8, a9, 0
  61:	f01d                	retw.n
$ xtensa-esp-elf-objdump -d iomux.o | sed -n '/<matrix_plain_gpio2_out>:/,/retw/p'

00000064 <matrix_plain_gpio2_out>:
  64:	004136               	entry	a1, 32
  67:	000091               	l32r	a9, fffc0068 <gpio34_read+0xfffbff8c>
  6a:	00aea2               	movi	a10, 0xfffffe00
  6d:	0020c0               	memw
  70:	0988                	l32i.n	a8, a9, 0
  72:	1088a0               	and	a8, a8, a10
  75:	00a1a2               	movi	a10, 0x100   ← 256 = SIG_GPIO_OUT_IDX：普通 GPIO 输出也是矩阵上的一个信号
  78:	2088a0               	or	a8, a8, a10
  7b:	0020c0               	memw
  7e:	0989                	s32i.n	a8, a9, 0
  80:	000091               	l32r	a9, fffc0080 <gpio34_read+0xfffbffa4>
  83:	480c                	movi.n	a8, 4   ← 1 << 2
  85:	0020c0               	memw
  88:	0989                	s32i.n	a8, a9, 0
  8a:	000091               	l32r	a9, fffc008c <gpio34_read+0xfffbffb0>
  8d:	0020c0               	memw
  90:	0989                	s32i.n	a8, a9, 0
  92:	000091               	l32r	a9, fffc0094 <gpio34_read+0xfffbffb8>
  95:	0020c0               	memw
  98:	0989                	s32i.n	a8, a9, 0
  9a:	f01d                	retw.n
```

 

第二段最后那三条 ` s32i.n ` 值得单独说。它们写的是 ` GPIO_ENABLE_W1TS_REG `、` GPIO_OUT_W1TS_REG `、 ` GPIO_OUT_W1TC_REG ` —— 写进去的都是同一个 ` movi.n a8, 4 `， 也就是 ` 1 << 2 `。三个寄存器共用一个立即数，这正是第 4 章讲的 "同一份位掩码，写哪个寄存器决定它起什么作用"。

 

⚠ 一句话选路

 

板上引脚已经定死、或者你要接的信号和引脚本来就对得上 →  **IO\_MUX** ，一行 ` MCU_SEL ` 搞定。

 

引脚被别的功能占了、或者要把一个信号同时送到几个脚 →  **矩阵** 。代价是多写一个寄存器，换来的是"任意信号到任意引脚"这个自由度 —— 代价不只是代码，还有一级额外的逻辑延迟。值不值得，取决于你的时序还剩多少余量。

 

```zhizhan-anchor
ch6-6-2
```



### 6.6.2 哪些引脚碰不得：三组寄存器与一张禁区表

 

知道了怎么配，下一个问题就是 **配哪一个** 。ESP32 有 34 个物理 GPIO， 但能随手拿来做普通输入输出的 *远不到 34 个* 。上面那份代码的注释里提了一句 "坑 1"，这里把它展开成一张能查的表 —— 每一条都附上 IDF 里的出处。

 

| 引脚 | 能不能用 | 原因（IDF v6.0 出处） |
| --- | --- | --- |
| ` 6–11 ` | 不能 | 接模组上的 SPI Flash。 ` docs/en/api-reference/peripherals/gpio/esp32.inc:198 `：  *SPI0/1: GPIO6-11 and GPIO16-17 are usually connected to the SPI flash and [PSRAM](term:psram) integrated on the module and therefore should not be used for other purposes.* |
| ` 16/17 ` | 看模组 | WROVER 上被 PSRAM 占作 ` CS `(IO16) / ` CLK `(IO17)。 ` esp_psram/esp32/esp_psram_impl_quad.c:111 `：  *For ESP32-WROVER or ESP32-WROVER-B module, the clock IO is IO17, the cs IO is IO16* 。 没接 PSRAM 的板子上可以正常用 |
| ` 34–39 ` | 只能输入 | ` soc/esp32/include/soc/soc_caps.h:186 `：  *GPIO \>= 34 are input only* ， 且 ` SOC_GPIO_VALID_OUTPUT_GPIO_MASK ` 把 34–39 排除在可输出之外 |
| ` 34–39 ` | 无上下拉 | **这是最容易踩的一条。**  ` esp_driver_gpio/include/driver/gpio.h:178 `：  *Only pins that support both input & output have integrated pull-up and pull-down resistors. Input-only GPIOs 34-39 do not.*  —— 也就是说，想在 34–39 上接一个按键， **必须外挂电阻** ，软件里怎么写都没用 |
| ` 0/2/12/15 ` | 慎用 | strapping 引脚，上电时的电平决定启动模式。做输出通常没事，但别在复位瞬间拉错电平 |

 

还有一条更隐蔽的： **32–39 这一组根本不在同一批寄存器里** 。 ` GPIO_OUT_REG `、` GPIO_ENABLE_REG ` 这些寄存器每个只有 32 位， 而引脚编号到了 39。所以乐鑫给它们配了第二组：

 

| 第一组（GPIO0–31） | 第二组（GPIO32–39） | 偏移 |
| --- | --- | --- |
| ` GPIO_OUT_W1TS_REG ` | ` GPIO_OUT1_W1TS_REG ` | 0x08 / 0x14 |
| ` GPIO_OUT_W1TC_REG ` | ` GPIO_OUT1_W1TC_REG ` | 0x0c / 0x18 |
| ` GPIO_ENABLE_W1TS_REG ` | ` GPIO_ENABLE1_W1TS_REG ` | 0x24 / 0x30 |
| ` GPIO_IN_REG ` | ` GPIO_IN1_REG ` | 0x3c / 0x40 |

 

第二组里  **GPIO32 对应 bit0** 。ROM 头文件 ` esp_rom/esp32/include/esp32/rom/gpio.h:14 ` 是这么写的：  *Change GPIO(32-39) pin output by setting, clearing, or disabling pins, GPIO32\<-\>BIT(0)* 。 于是"操作 GPIO34"落到指令上，是取第  **2**  位 —— 这个减法忘了做，写进去的就是 GPIO34 号引脚之外的某个脚。

 

下面把三种"号不对"的情形放在一起：32–39 的位偏移（` -32 `）、 只读引脚的读法、以及 RTC 域那套 **另一套编号** 。

 

**bash**  — 第二组寄存器、只读引脚的读法、RTC 通道号，编译成了什么（` -O2 `）

 

```text
$ xtensa-esp-elf-objdump -d iomux.o | sed -n '/<gpio32_33_set>:/,$p'

0000009c <gpio32_33_set>:
  9c:	004136               	entry	a1, 32
  9f:	000091               	l32r	a9, fffc00a0 <gpio34_read+0xfffbffc4>
  a2:	380c                	movi.n	a8, 3   ← 3 = GPIO32/33 → 第二组的 bit0/bit1（不是 bit32/33）
  a4:	0020c0               	memw
  a7:	0989                	s32i.n	a8, a9, 0
  a9:	000091               	l32r	a9, fffc00ac <gpio34_read+0xfffbffd0>
  ac:	0020c0               	memw
  af:	0989                	s32i.n	a8, a9, 0
  b1:	000091               	l32r	a9, fffc00b4 <gpio34_read+0xfffbffd8>
  b4:	0020c0               	memw
  b7:	0989                	s32i.n	a8, a9, 0
  b9:	f01d                	retw.n
	...

000000bc <rtc_gpio34_pulse>:
  bc:	004136               	entry	a1, 32
  bf:	000091               	l32r	a9, fffc00c0 <gpio34_read+0xfffbffe4>
  c2:	081c                	movi.n	a8, 16   ← 16 = 1 << 4：RTCIO_GPIO34_CHANNEL = 4，不是 34
  c4:	0020c0               	memw
  c7:	0989                	s32i.n	a8, a9, 0
  c9:	000091               	l32r	a9, fffc00cc <gpio34_read+0xfffbfff0>
  cc:	0020c0               	memw
  cf:	0989                	s32i.n	a8, a9, 0
  d1:	000091               	l32r	a9, fffc00d4 <gpio34_read+0xfffbfff8>
  d4:	0020c0               	memw
  d7:	0989                	s32i.n	a8, a9, 0
  d9:	f01d                	retw.n
	...

000000dc <gpio34_read>:
  dc:	004136               	entry	a1, 32
  df:	000081               	l32r	a8, fffc00e0 <gpio34_read+0xfffc0004>
  e2:	0020c0               	memw
  e5:	0828                	l32i.n	a2, a8, 0
  e7:	042220               	extui	a2, a2, 2, 1   ← extui …,2,1：取的是 bit2 —— 34 - 32 = 2
  ea:	f01d                	retw.n
```

 

三条指令，各钉住一个结论：

 

 
- ` movi.n a8, 3 ` —— 源码写的是 GPIO32 和 GPIO33。 两个引脚在第二组里是 bit0 和 bit1，合起来正好是 ` 3 `。  **要是编译器吐出一个 ` 1 << 32 ` 那种数，这个 3 就不会出现。**
 
- ` extui a2, a2, 2, 1 ` —— 一条指令同时说明三件事： 读的是 **第二个** 输入寄存器、取的是  **bit2** 、宽度 1 位。 而 ` 34 - 32 = 2 `。如果源码里写成 ` GPIO_IN_REG >> 34 `， 这是移位位数越界的未定义行为，编译器会给出完全不同的东西
 
- ` movi.n a8, 16 ` —— 源码写的是 ` 1 << RTCIO_GPIO34_CHANNEL `。 出现  **16**  说明这个通道号是  **4** ，不是 34
 

 

✕ RTC 域有自己的编号：RTCIO 通道号 ≠ GPIO 号

 

想用 ` RTC_GPIO_* ` 那组寄存器（deep sleep 唤醒就要用它）， 位号必须查 RTCIO 通道号，而它是 **乱序** 的：

 

| GPIO | RTCIO 通道 | GPIO | RTCIO 通道 | GPIO | RTCIO 通道 |
| --- | --- | --- | --- | --- | --- |
| 0 | 11 | 13 | 14 | 33 | 8 |
| 2 | 12 | 14 | 16 | 34 | 4 |
| 4 | 10 | 15 | 13 | 35 | 5 |
| 12 | 15 | 25 | 6 | 36 | 0 |

 

` GPIO34 → 通道 4 `，而 ` GPIO0 → 通道 11 `。 出处是 ` esp_hal_gpio/esp32/rtc_io_periph.c ` 里的 ` rtc_io_num_map ` 表和 ` soc/esp32/include/soc/rtc_io_channel.h `。 照着 GPIO 号写 ` 1 << 34 `，写进去的是别的东西。

 

另外，能用于 RTC 唤醒（` ext0 ` / ` ext1 `）的引脚只有  **` 0, 2, 4, 12–15, 25–27, 32–39 `**  共 18 个 —— ` esp_hw_support/include/esp_sleep.h:278 ` 与 ` :322 ` 的注释里写得明明白白。 而且这两处还带了一条容易被忽略的注解：  *Internal pullups and pulldowns don't work when RTC peripherals are shut down. In this case, external resistors need to be added.*  —— 省电省到把 RTC 外设都关了，内部上下拉也就跟着没了。

 

```zhizhan-anchor
ch6-6-3
```



### 6.6.3 cache 关掉之后：ISR 和 DMA 内存要满足什么

 

ESP32 的代码默认跑在外部 Flash 上，靠 cache 取指。而 **写 Flash 的时候 cache 必须关掉**  —— 这时候如果来了中断，ISR 的代码如果还在 Flash 里，CPU 就取不到指了。 这不是理论问题，是每个用 [NVS](term:nvs) 存过配置的人都会撞上的一次崩溃。

 

办法是把 ISR 放进 IRAM，并在注册时声明这件事。 这里要用的宏分布在 ` esp_intr_alloc.h ` 和 ` esp_heap_caps.h ` 里， 而这两个头文件都 ` #include <sdkconfig.h> `，  **脱离 IDF 构建系统根本编不过** （实测报 ` fatal error: sdkconfig.h `）。 所以这一段不走工具链，改成对 IDF 源码树真跑 ` grep `：

 

**bash**  — 源码事实：三处真跑 grep（` $IDF ` 是你的 ESP-IDF 根目录），外加一处负面证据

 

```text
$ grep -n "define ESP_INTR_FLAG_IRAM" "$IDF/components/esp_hw_support/include/esp_intr_alloc.h"

42:#define ESP_INTR_FLAG_IRAM          (1<<10) ///< ISR can be called if cache is disabled
$ grep -n "define MALLOC_CAP_DMA" "$IDF/components/heap/include/esp_heap_caps.h"

34:#define MALLOC_CAP_DMA              (1<<3)  ///< Memory must be able to accessed by DMA
48:#define MALLOC_CAP_DMA_DESC_AHB     (1<<17) ///< Memory must be capable of containing AHB DMA descriptors
49:#define MALLOC_CAP_DMA_DESC_AXI     (1<<18) ///< Memory must be capable of containing AXI DMA descriptors
$ grep -n "define MALLOC_CAP_CACHE_ALIGNED" "$IDF/components/heap/include/esp_heap_caps.h"

50:#define MALLOC_CAP_CACHE_ALIGNED    (1<<19) ///< Memory must be aligned to the cache line size of any intermediate caches
$ grep -rn "SPI_FLASH_CACHE_ALIGN" "$IDF/components" | head -3

（无任何输出，退出码 1）
```

 

最后那条 ` grep ` 同样 **一行输出都没有** ，而且退出码是 1 —— 这是在说"这个名字在 v6.0 里已经不存在了"。和前面 M0 那句"零告警"是同一个用法：  *负面证据只在真的什么都没找到时才会被生成* 。把这个宏从旧教程里抄过来，编译器会告诉你它不认识。

 

| 宏 | 值 | 含义（IDF v6.0 出处） |
| --- | --- | --- |
| ` ESP_INTR_FLAG_IRAM ` | 1\<\<10 | ` esp_intr_alloc.h:42 `： *ISR can be called if cache is disabled* |
| ` MALLOC_CAP_DMA ` | 1\<\<3 | ` esp_heap_caps.h:34 `： *Memory must be able to accessed by DMA* |
| ` MALLOC_CAP_CACHE_ALIGNED ` | 1\<\<19 | ` esp_heap_caps.h:50 `： *Memory must be aligned to the cache line size of any intermediate caches* |
| ` SPI_FLASH_CACHE_ALIGN ` | — | **v6.0 已移除** ，上面那条 grep 找不到它 |

 

⚠ 加了 ` ESP_INTR_FLAG_IRAM ` 不等于万事大吉

 

这个标志只是" **允许** 在 cache 关闭时被调用"。IDF 会在注册时校验地址， ` esp_intr_alloc.h:125 ` 写着：  *If ESP\_INTR\_FLAG\_IRAM flag is used, and handler address is not in IRAM or RTC\_FAST\_MEM, then ESP\_ERR\_INVALID\_ARG is returned.*  —— 校验不过会直接返回错误码，不会静默生效。所以 ` IRAM_ATTR ` 那个属性不能忘。

 

还有一条不成文的：ISR 里 **不能再调用任何还留在 Flash 里的函数** 。 标志管的是 ISR 自己的入口地址，管不了它调用链上的每一个函数。 这条属于 IDF 的运行时约定，本节没有工具链证据可以支撑，只作为提醒列在这里。

  

⚠ 什么时候该用寄存器，什么时候该用 HAL / IDF 驱动

 

| 场景 | 选择 |
| --- | --- |
| 学习 / 理解硬件 | **寄存器** 。这是唯一能真正建立硬件直觉的方式 |
| 追求极致性能（如 bit-bang 时序） | **寄存器** 。HAL 的抽象层可能带来几百 ns 的额外延迟 |
| Flash/RAM 极度紧张 | **寄存器** 。HAL 库能占 20-50 KB |
| 产品开发、多人协作 | **HAL / IDF 驱动** 。可维护性、可移植性更重要 |
| 需要快速验证想法 | **HAL / IDF** 。不要重新发明轮子 |
| HAL 有 bug 或功能缺失 | **混合** 。在 HAL 之上直接操作寄存器补丁 |

 

**建议的成长路径** ：先用 HAL 做出东西 → 用寄存器重写一遍 → 之后默认用 HAL，  *但在需要时知道怎么"钻到下面去"* 。这个能力差距，就是初级和中级嵌入式工程师的分水岭。

 

```zhizhan-anchor
ch6-7
```



## 6.7 位操作的综合应用：一个寄存器级环形缓冲区

 

环形缓冲区（ring buffer）是串口接收、音频流、日志缓存的核心数据结构。 标准实现用取模运算，但在 MCU 上 **可以用位运算把取模变成位与** —— 这是嵌入式里最经典的优化技巧之一。

 

ringbuf.h — 零取模运算的环形缓冲区 C

 

```text
#ifndef RINGBUF_H
#define RINGBUF_H

#include <stdint.h>
#include <stddef.h>
#include <string.h>

/* ============================================================
   核心技巧：缓冲区大小取 2 的幂，则 "取模" 可以变成 "位与"

   idx % 256  ==  idx & 255        （仅当 size 是 2 的幂时成立）

   在 Cortex-M0 上，除法/取模是软件模拟的，要几十个周期；
   位与只要 1 个周期。对于每字节都调用的缓冲区，这是数量级差异。
   ============================================================ */

typedef struct {
    uint8_t *buf;
    uint32_t size;          /* 必须是 2 的幂 */
    uint32_t mask;          /* size - 1，用于快速取模 */
    volatile uint32_t head; /* 写入位置（生产者修改） */
    volatile uint32_t tail; /* 读取位置（消费者修改） */
    uint32_t overflow;      /* 溢出计数（诊断用） */
} ringbuf_t;

/* ---------- 初始化：编译期检查 size 是 2 的幂 ---------- */
#define RINGBUF_INIT(_buf) {                       \
    .buf = (_buf),                                 \
    .size = sizeof(_buf),                          \
    .mask = sizeof(_buf) - 1u,                     \
    .head = 0, .tail = 0, .overflow = 0            \
}

/* 编译期断言：size 必须是 2 的幂
   ⚠ 用关键字形式 _Static_assert：ringbuf.h 里不需要再 include <assert.h> */
#define RINGBUF_ASSERT_POW2(_buf) \
    _Static_assert(((sizeof(_buf) & (sizeof(_buf) - 1u)) == 0), \
                   "环形缓冲区大小必须是 2 的幂")

/* ---------- 状态查询 ---------- */
static inline uint32_t rb_count(const ringbuf_t *rb)
{
    /* 无符号减法天然处理回绕：head=5, tail=250, size=256 → 5-250 = 11 (mod 2^32) */
    return (rb->head - rb->tail) & rb->mask;
}

static inline uint32_t rb_space(const ringbuf_t *rb)
{
    return rb->mask - rb_count(rb);   /* 留一个空位区分"满"和"空" */
}

static inline int rb_is_empty(const ringbuf_t *rb) { return rb->head == rb->tail; }
static inline int rb_is_full(const ringbuf_t *rb)  { return rb_count(rb) == rb->mask; }

/* ---------- 单字节操作 ---------- */
static inline int rb_put(ringbuf_t *rb, uint8_t b)
{
    uint32_t next = (rb->head + 1u) & rb->mask;
    if (next == rb->tail) {
        rb->overflow++;                 /* 满：丢弃新数据（也可选择覆盖最旧） */
        return -1;
    }
    rb->buf[rb->head] = b;              /* 先写数据 */
    rb->head = next;                    /* 后更新 head —— 顺序很重要！ */
    /* ↑ 如果先更 head 再写数据，消费者可能在数据写入前就读到它 */
    return 0;
}

static inline int rb_get(ringbuf_t *rb, uint8_t *out)
{
    if (rb->head == rb->tail) return -1;
    *out = rb->buf[rb->tail];           /* 先读数据 */
    rb->tail = (rb->tail + 1u) & rb->mask;  /* 后更新 tail */
    return 0;
}

/* ---------- 块操作（高效路径）---------- */
uint32_t rb_write(ringbuf_t *rb, const uint8_t *data, uint32_t len);
uint32_t rb_read(ringbuf_t *rb, uint8_t *out, uint32_t len);

uint32_t rb_write(ringbuf_t *rb, const uint8_t *data, uint32_t len)
{
    uint32_t space = rb_space(rb);
    if (len > space) len = space;
    if (len == 0) { rb->overflow++; return 0; }

    /* 可能跨越回绕点，分两段拷贝 —— memcpy 比逐字节快得多 */
    uint32_t first = rb->size - rb->head;     /* 到缓冲区末尾的距离 */
    if (first > len) first = len;

    memcpy(&rb->buf[rb->head], data, first);
    if (len > first) {
        memcpy(rb->buf, data + first, len - first);   /* 回绕部分 */
    }

    rb->head = (rb->head + len) & rb->mask;
    return len;
}

uint32_t rb_read(ringbuf_t *rb, uint8_t *out, uint32_t len)
{
    uint32_t avail = rb_count(rb);
    if (len > avail) len = avail;
    if (len == 0) return 0;

    uint32_t first = rb->size - rb->tail;
    if (first > len) first = len;

    memcpy(out, &rb->buf[rb->tail], first);
    if (len > first) {
        memcpy(out + first, rb->buf, len - first);
    }

    rb->tail = (rb->tail + len) & rb->mask;
    return len;
}

/* ============================================================
   在中断中的典型用法（单生产者单消费者，无锁）

   中断（生产者）只改 head，主循环（消费者）只改 tail。
   由于 head/tail 都是 32 位对齐变量，在 32 位 MCU 上读写是原子的。
   → 无需任何锁！这是 SPSC 环形缓冲区的经典无锁设计。
   ============================================================ */

/* ---- 使用示例 ---- */
#define UART_RX_SIZE 256            /* 必须是 2 的幂 */

static uint8_t    s_uart_rx_buf[UART_RX_SIZE];
static ringbuf_t  s_uart_rx = RINGBUF_INIT(s_uart_rx_buf);

/* 编译期检查（放在文件作用域）*/
RINGBUF_ASSERT_POW2(s_uart_rx_buf);

/* 串口中断：生产者 */
void USART1_IRQHandler(void)
{
    /* 检查接收标志... */
    uint8_t byte = 0x00; /* = USART1->DR; */

    if (rb_put(&s_uart_rx, byte) != 0) {
        /* 缓冲区满：记录溢出，但不阻塞中断 */
    }
}

/* 主循环：消费者 */
void app_poll(void)
{
    uint8_t chunk[32];
    uint32_t n = rb_read(&s_uart_rx, chunk, sizeof chunk);
    if (n) {
        process_frame(chunk, n);
    }
}

#endif /* RINGBUF_H */
```

 

◆ 这个实现里有四个值得学的手法

 

 
1. **用位与代替取模** ：` idx & mask ` 比 ` idx % size ` 便宜， 但 **原因常被说错** 。不是因为"MCU 没有除法器"——Cortex-M3/M4/M7 都有硬件除法指令 ` UDIV ` / ` SDIV `，而 ` size ` 是 2 的幂时， ` % size ` 编译出来也不过是 ` udiv ` \+ ` mls ` 两条，谈不上慢。 真正没有除法指令的是  **Cortex-M0 / M0\+** （STM32F0、G0 这些）， 那里 ` % ` 会去调 libgcc 的软件除法例程，一条除法顶几十条 ` and `。 所以这条手法的价值在于三点： **①一次乘除都不花；②不依赖 libgcc 的除法例程（省几百字节 Flash）； ③从 M0 到 M7 表现完全一致** ——不管跑在哪个核上，` & mask ` 都是同一条 ` and `。 代价是 **缓冲区大小必须是 2 的幂** ——用 ` RINGBUF_ASSERT_POW2 ` 在编译期强制这一点。
 
2. **无符号减法天然处理回绕** ：` (head - tail) & mask ` 不需要任何 ` if (head < tail) ` 判断。 这是 Module 01 补码知识的直接应用。
 
3. **"先写数据后更新指针"的顺序** ：这是无锁数据结构的基本纪律。 顺序反了，消费者可能读到未初始化的数据。 *编译器不会帮你检查，靠纪律。*
 
4. **SPSC 无锁设计** ：单生产者单消费者，生产者只写 head、消费者只写 tail， 在 32 位对齐的前提下读写是原子的 →  **完全不需要关中断或加锁** 。 这是中断与主循环通信的标准模式，也适用于 [FreeRTOS](term:rtos) 任务间通信。

 

✕ 这个实现不适用的场景

 

**多生产者或多消费者时不安全。** 两个中断同时调 ` rb_put `， ` head ` 的读-改-写会丢失更新（正是 6.4 节的竞态）。   
  
 需要 MPSC 时，必须在 ` rb_put ` 里加临界区保护： ` critical_enter() ` / ` critical_exit() `， 或改用原子指令（` __atomic_fetch_add `）。   
  
  **ESP32 上还要考虑双核** ——即使是 SPSC，如果生产者在 Core0、消费者在 Core1， 仍然需要内存屏障或自旋锁来保证可见性顺序。

  

```zhizhan-anchor
ch6-7-1
```



### 6.7.1 满了就覆盖最旧的：三个跟着一起改的东西

 

§6.7 那个环形缓冲区的政策是 **"满了就拒绝写入"** ：` rb_put() ` 返回 ` false `，让调用者自己决定怎么办。这在很多场合是对的 —— 丢一个字节是明确的错误，应该被上报。

 

但另一些场合正相反。串口 DMA 收上来的数据、音频流的采样、传感器的最新读数， 这些场景里 **调用者往往是中断或 DMA，它没资格"等"，也没地方"上报"** 。 对它来说，最合理的政策是：满了就挤掉最旧的，永远写得进去，别的事后再说。

 

| 对比项 | 拒绝写入（§6.7 那个） | 覆盖最旧（本节这个） |
| --- | --- | --- |
| 满了怎么表现 | ` rb_put() ` 返回 ` false `，数据没进去 | ` ovrb_put() ` 返回 ` void `，数据一定进去了 |
| 谁来承担后果 | 生产者 —— 它必须处理失败 | 消费者 —— 它下次读的时候会发现少了一段 |
| ` head `/` tail ` 的取值范围 | 都掩码到 ` [0, size) `，永远落在容量内 | **自由回绕** ，只增不减，掩码留到算下标那一刻才用 |
| "丢了多少"从哪来 | 不存在这件事 | 无符号差值减容量， **不需要额外计数器** |
| 消费者能不能信任自己的位置 | 能：没读过的一定还在 | **不能** ：每次读都得先对账 |
| 典型用户 | 命令解析、协议帧 —— 丢了就是错 | 串口/音频/传感器 —— 宁可丢旧的，也不能卡住生产者 |

 

这张表右边那一列的三条，就是标题里说的"三个跟着一起改的东西"。 它们不是三个独立的优化点，而是 **同一个政策翻转在三个地方留下的后果** 。 所以这件事没法靠"在 ` rb_put ` 里把 ` return false ` 改成覆盖"来得到 —— 那个改法会留下一个 **能编过、能跑、但会静默读错数据** 的缓冲区。

 

ringbuf\_overwrite.h — 满了就覆盖最旧的，生产者永不阻塞 C

 

```text
/* ringbuf_overwrite.h — 满了就覆盖最旧的：生产者永不阻塞
 *
 * 和 6.7 那个 ringbuf.h 只差一条政策：满时是"拒绝写入"还是"挤掉最旧的"。
 * 听起来像改一个 if，实际上下面三件事会一起改掉 ——
 * 这也正是覆盖式缓冲区没法靠"在旧实现上改一行"得到的原因。
 *
 *   ① head / tail 必须【自由回绕】（只增不减），掩码留到算下标那一刻才用；
 *      否则回绕之后差值不再携带"落后多少"的信息。
 *   ② "丢了多少"不需要额外计数器：无符号差值减容量，就是答案。
 *   ③ 消费者的位置随时可能失效，只能在每次取数据时现场对账。
 *
 * 串口 DMA、音频流、"只关心最新一帧"的传感器读数，都是这个取舍：
 * 宁可丢最旧的，也不要让生产者（往往是中断或 DMA）阻塞或失败。
 */
#ifndef RINGBUF_OVERWRITE_H
#define RINGBUF_OVERWRITE_H

#include <stdint.h>
#include <stddef.h>

#define OVRB_SIZE  256u                 /* 必须是 2 的幂 */
_Static_assert((OVRB_SIZE & (OVRB_SIZE - 1u)) == 0u,
               "OVRB_SIZE 必须是 2 的幂，否则算下标就退化成取模");

typedef struct {
    uint8_t          *buf;
    uint32_t          mask;             /* 容量 - 1 */
    volatile uint32_t head;             /* 自由回绕，只由生产者写 */
    uint32_t          tail;             /* 自由回绕，只由消费者写 */
} ovrb_t;

/* 生产者：永不失败、永不阻塞。写进 (head & mask)，然后发布新的 head。
   掩码在这个函数里用掉；head 本身只增不减。 */
static inline void ovrb_put(ovrb_t *rb, uint8_t b)
{
    uint32_t h = rb->head;

    rb->buf[h & rb->mask] = b;          /* ① 先写数据 */
    rb->head = h + 1u;                  /* ② 后发布（自由回绕，不掩码） */
}

/* 消费者：先对账、再取。返回本次被迫跳过的字节数（也就是被覆盖掉的那些）。 */
static inline uint32_t ovrb_read(ovrb_t *rb, uint8_t *out, uint32_t want)
{
    uint32_t head = rb->head;           /* volatile 只读一次，读了就存起来 */
    uint32_t tail = rb->tail;
    uint32_t lost = 0u;

    uint32_t lag = head - tail;         /* 无符号减法：回绕天然正确 */
    if (lag > rb->mask + 1u) {          /* 落后超过一个满容量 = 有数据没读就没了 */
        lost  = lag - (rb->mask + 1u);
        tail += lost;                   /* 跳过已经被覆盖的那一段 */
    }

    uint32_t n = head - tail;           /* 现在真正还能读到的字节数 */
    if (n > want) n = want;
    for (uint32_t i = 0u; i < n; i++) {
        out[i] = rb->buf[(tail + i) & rb->mask];
    }
    rb->tail = tail + n;
    return lost;
}

#endif /* RINGBUF_OVERWRITE_H */
```

 

逐条对上表里那三行：

 

 
1. **自由回绕（①）** 。` head ` 和 ` tail ` 只增不减， ` h & rb->mask ` 这个掩码 **只在写数组那一刻用一次** 。 差值 ` head - tail ` 于是携带了完整的"落后多少"信息 —— 这正是回绕之后还能知道丢没丢数据的前提。
 
2. **丢帧数不用计数器（②）** 。` lost = lag - (mask + 1) `： 落后量超过一个满容量，超出的部分就是被覆盖掉的。 因为两个计数器都是 ` uint32_t `，回绕时这个减法天然正确 —— 不需要 ` if ` 去判断谁更大。
 
3. **消费者现场对账（③）** 。` ovrb_read() ` 开头先把 ` head ` 读一次存进局部变量（` volatile ` 只能读一次）， 然后用它和 ` tail ` 对账。读到一半生产者又写了？没关系 —— 下一次调用会重新对账，丢掉的字节会在那个时候被算出来。
 

 

⚠ 这份实现是怎么定下来的：两个真被推翻的版本

 

这一节最该讲清楚的其实不是"最终长什么样"，而是 **"为什么不是另外那两种显而易见的样子"** 。 下面两个版本都曾经是我打算写进页面的，都是自己推翻的：

 

```zhizhan-table
{"rows":[[{"body":"被推翻的写法","header":true,"rowSpan":1,"colSpan":1},{"body":"看着哪里对","header":true,"rowSpan":1,"colSpan":1},{"body":"实际错在哪","header":true,"rowSpan":1,"colSpan":1}],[{"body":"消费者每次都无条件  \n` tail = (head + 1) & mask ` 重新同步","header":false,"rowSpan":1,"colSpan":1},{"body":"简单：反正\"最新的一定在 head-1\"，直接跳过去不就行了","header":false,"rowSpan":1,"colSpan":1},{"body":"**没有溢出时也会跳过 1 个还活着的字节** 。缓冲区没满的时候， 消费者读出的第一个字节永远是错的 —— 而它不会报任何错","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` head `/` tail ` 都掩码到  \n` [0, size) `（像 §6.7 那样）","header":false,"rowSpan":1,"colSpan":1},{"body":"和 §6.7 保持一致，下标运算少一次掩码","header":false,"rowSpan":1,"colSpan":1},{"body":"**满和空变得无法区分** ：都掩码之后 ` head == tail ` 既可能是\"空\"也可能是\"刚好写满一圈\"，消费者只能当成空， 于是满缓冲区的数据全部读不到","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

第二个错很值得停一下： **它不是"少掩码一次"这种性能问题，而是把信息删掉了** 。 掩码到 ` [0, size) ` 之后，"写了几圈"这件事就不在计数器里了， 而"丢了多少"恰恰需要这份信息。这也解释了为什么覆盖式缓冲区的计数器必须自由回绕 ——  **不是风格偏好，是信息量问题** 。

 

◆ 第四类证据：把"我推了半天觉得对"变成"反例不存在"

 

§6.6 那个证据分类表末尾写着" **没有第四类** "—— 那句话说得很对， 但它是对 §6.6 说的。这一节要用到第四类，所以必须在这里登记清楚， 而不是悄悄多塞一类进来。

 

麻烦在于：` ringbuf_overwrite.h ` 里那套下标算术  **一次都没在目标上被执行过**  —— 本机没有 ARM/Xtensa 硬件， 也没有 qemu 这类能把它真正跑起来的仿真环境。编译器能给的只有"语法没错、没告警" —— 它不知道 ` lag ` 该不该减容量，更不知道减完是不是漏了字节。

 

**bash**  — 能不能把它跑起来，先看本机有没有可运行的目标环境（不是"有没有编译器"）

 

```text
$ command -v qemu-system-arm qemu-arm qemu-system-gnuarmeclipse

（无任何输出，退出码 1）
```

 

能补上这个缺口的只有一条路：把那段算术 **逐算子抄成 JS** ， 再拿一个"不可能算错"的参考实现和它逐字节对账，把所有操作序列穷举一遍。

 

这里要说清一个容易被误用的点： **第四类证据的价值与"本机有没有编译器"无关** 。 就算手边有一台能把这段逻辑编成 PC 小程序的编译器， **跑几个手挑的用例也证明不了"没有反例"**  —— 要的恰恰是把全部操作序列穷举一遍。而"本机的 PATH 上有没有 gcc"是个随运行环境漂的量， 拿它当前提，等于让证据跟着环境一起漂。真正不变、也真正相关的是"这份 header 从没在目标上跑过"。

 

```zhizhan-table
{"rows":[[{"body":"证据类型","header":true,"rowSpan":1,"colSpan":1},{"body":"谁保证它对","header":true,"rowSpan":1,"colSpan":1},{"body":"它能证明什么","header":true,"rowSpan":1,"colSpan":1},{"body":"它不能证明什么","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**① 工具链事实**","header":false,"rowSpan":1,"colSpan":1},{"body":"编译器 / objdump / readelf 现场输出","header":false,"rowSpan":1,"colSpan":1},{"body":"指令形状、条数、节对齐、符号","header":false,"rowSpan":1,"colSpan":1},{"body":"运行期行为","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**② 手册事实**","header":false,"rowSpan":1,"colSpan":1},{"body":"芯片手册","header":false,"rowSpan":1,"colSpan":1},{"body":"寄存器语义、时序规格","header":false,"rowSpan":1,"colSpan":1},{"body":"本机无硬件，本源验不了","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**③ 源码事实**","header":false,"rowSpan":1,"colSpan":1},{"body":"IDF / 内核源码里 grep 出来","header":false,"rowSpan":1,"colSpan":1},{"body":"某个宏/常量的存在与取值","header":false,"rowSpan":1,"colSpan":1},{"body":"宏展开后的实际行为","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**④ 模型检验**   \n（本节新增）","header":false,"rowSpan":1,"colSpan":1},{"body":"穷举：全部操作序列跑一遍，和参考实现对账","header":false,"rowSpan":1,"colSpan":1},{"body":"**下标算术没有反例** （42550272 条序列）","header":false,"rowSpan":1,"colSpan":1},{"body":"**不是\"这份 C 被跑过\"** ；也不能证明真机器上的时序与可见性","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

第四类的 **全部价值** 就在一句话上：它把"我推了半天觉得对"变成了 "反例不存在"。它不能替代另外三类 —— 它连"这段代码能编过"都不证明。 想让它有意义，必须同时给出它的 **边界** ，也就是下面这张表。

 

模型和 C 之间还埋着一颗雷： **两份代码会各自漂移** 。 改 C 的时候忘了改模型，模型检验就变成了在验一个已经不存在的实现， 而且它照样全绿。所以中间必须有一步机械核对，这里分成两道检查：

 

 
1. **检查 A（锚点）** ：下面那张 14 行的对照表里， 每一行都必须在 **真文件里恰好出现一次** 。 谁动了被登记的行，锚点就找不到 —— 当场抛错，而不是悄悄跳过。
 
2. **检查 B（函数体算子序列）** ：不看对照表， 直接把两个文件里的 ` ovrb_put ` / ` ovrb_read `  **现读现抽** ， 归一化成算子序列后 **逐条按顺序** 比。 往任一边加一行、删一行、改一个常数、挪一次语句次序，两边就对不上 —— 哪怕那行根本没被登记进对照表。
 

 

对照表本身因此只剩一个作用： **给人看** ，逐条说明哪一行对应哪一行。 真正的判据是 A 和 B。   
  
 但"A 和 B"也只是两道检查的名字 —— 它们 **会不会真的红** 得另外证明， 所以还有第三份文件拿 7 条变异去撞它们（改常数 / 删行 / 加行 / 交换次序 / 丢括号）， 逐条核对 **红在哪一道检查上** 。

 

| # | ` ringbuf_overwrite.h ` | ` rbmodel.js ` | 归一化算子序列 |
| --- | --- | --- | --- |
| 1 | rb-\>buf\[h & rb-\>mask\] = b; | st.buf\[h & st.mask\] = b; | ` ID[ID & ID] = ID ` |
| 2 | rb-\>head = h \+ 1u; | st.head = h \+ 1 \>\>\> 0; | ` ID = ID + N ` |
| 3 | uint32\_t h = rb-\>head; | const h = st.head \>\>\> 0; | ` ID ID = ID ` |
| 4 | uint32\_t head = rb-\>head; | let head\_ = st.head \>\>\> 0; | ` ID ID = ID ` |
| 5 | uint32\_t tail = rb-\>tail; | let tail\_ = st.tail \>\>\> 0; | ` ID ID = ID ` |
| 6 | uint32\_t lost = 0u; | let lost = 0; | ` ID ID = N ` |
| 7 | uint32\_t lag = head - tail; | let lag = head\_ - tail\_ \>\>\> 0; | ` ID ID = ID - ID ` |
| 8 | if (lag \> rb-\>mask \+ 1u) { | if (lag \> st.mask \+ 1) { | ` ID (ID > ID + N) { ` |
| 9 | lost = lag - (rb-\>mask \+ 1u); | lost = lag - (st.mask \+ 1) \>\>\> 0; | ` ID = ID - (ID + N) ` |
| 10 | tail \+= lost; | tail\_ = tail\_ \+ lost \>\>\> 0; | ` ID = ID + ID ` |
| 11 | uint32\_t n = head - tail; | let n = head\_ - tail\_ \>\>\> 0; | ` ID ID = ID - ID ` |
| 12 | if (n \> want) n = want; | if (n \> want) n = want; | ` ID (ID > ID) ID = ID ` |
| 13 | out\[i\] = rb-\>buf\[(tail \+ i) & rb-\>mask\]; | out\[i\] = st.buf\[(tail\_ \+ i) & st.mask\]; | ` ID[ID] = ID[(ID + ID) & ID] ` |
| 14 | rb-\>tail = tail \+ n; | st.tail = tail\_ \+ n \>\>\> 0; | ` ID = ID + ID ` |

 

**bash**  — 检查 A / 检查 B 各跑一遍，再拿 7 条变异证明它们会红（` node `，无编译器参与）

 

```text
$ node mirror.js ringbuf_overwrite.h | tail -3

核对对象：ringbuf_overwrite.h
检查 A：14 对锚点全部在各自文件里各出现 1 次。
检查 B：ovrb_put 函数体 C 3 条 / JS 3 条，算子序列逐条一致；ovrb_read 函数体 C 13 条 / JS 13 条，算子序列逐条一致。
$ node mirror_neg.js ringbuf_overwrite.h

mirror.js 变异测试 —— 每条都该红在指定的检查上

✓ M1 发布 head 时 +1 改成 +2                  期望 A，实际 A
    锚点在 ringbuf_overwrite.h 里出现 0 次，应该是 1 次：rb->head = h + 1u;
✓ M2 删掉取数据那一整行                           期望 A，实际 A
    锚点在 rbmodel.js 里出现 0 次，应该是 1 次：out[i] = st.buf[(tail_ + i) & st.mask];
✓ M3 JS 多出一条语句（对照表里根本没登记它）               期望 B，实际 B
    ovrb_read 的函数体对不上 —— 条数不同：C 13 条，JS 14 条；第 13 条起对不上：C 是「ID ID」，JS 是「ID = ID + #1」；语句本身也变了：JS 里有、C 里没有：ID = ID + #1
✓ M4 C 的返回值多算一格                          期望 B，实际 B
    ovrb_read 的函数体对不上 —— 第 13 条起对不上：C 是「ID ID + #1」，JS 是「ID ID」；语句本身也变了：C 里有、JS 里没有：ID ID + #1；JS 里有、C 里没有：ID ID
✓ M5 JS 把 lost 的清零挪到 lag 之后（语句集合不变，顺序变）  期望 B，实际 B
    ovrb_read 的函数体对不上 —— 第 3 条起对不上：C 是「ID ID = #0」，JS 是「ID ID = ID - ID」；两边的语句集合其实一样 —— 是【顺序】被改了
✓ M6 循环条件 < 改成 <=（差一格，最容易犯）              期望 B，实际 B
    ovrb_read 的函数体对不上 —— 第 10 条起对不上：C 是「ID (ID ID = #0 ID < ID ID++) {」，JS 是「ID (ID ID = #0 ID <= ID ID++) {」；语句本身也变了：C 里有、JS 里没有：ID (ID ID = #0 ID < ID ID++) {；JS 里有、C 里没有：ID (ID ID = #0 ID <= ID ID++) {
✓ M7 丢掉括号，让减法先算                          期望 A，实际 A
    锚点在 ringbuf_overwrite.h 里出现 0 次，应该是 1 次：lost  = lag - (rb->mask + 1u);

7 条变异：7 条红在预期的检查上，0 条不符，其中漏网（全绿）0 条。
```

 

**bash**  — 穷举全部操作序列，对账"读了什么"和"丢了多少"（` node `，无编译器参与）

 

```text
$ node rbmodel.js

覆盖式环形缓冲区 · 穷举模型检验

操作字母表：put(0xa1)  put(0xb2)  put(0xc3)  read(1)  read(2)  read(3)   —— 6 种
容量 sweep：mask = 1, 3, 7, 15（容量 2, 4, 8, 16）
每条序列核对两件事：① 读懂的字节能逐字对上参考序列 ② 报出的"丢了多少"能逐字对上

【组一】计数器从 0 起
                mask=1      mask=3      mask=7     mask=15
      深度 7      279936      279936      279936      279936
      深度 9    10077696    10077696    10077696    10077696
        违例           0           0           0           0
        违例           0           0           0           0

【组二】计数器从 0xfffffffc 起（中途穿过 2^32 回绕）
                mask=1      mask=3      mask=7     mask=15
      深度 7      279936      279936      279936      279936
        违例           0           0           0           0

合计核对 42550272 条序列，违例 0 条。
（被测模型的每一行算式都与参考实现逐项对账；耗时 2827 ms）
```

 

✕ 一个不会红的检查器，比没有检查器更坏

 

上面那句"违例 0 条"要能被相信，前提是这个检查器 **有能力红** 。 所以对模型做了 7 处变异，每一处都是"一个看起来合理的写法"， 看它抓不抓得到：

 

| 变异（把某个算子改成另一种合理写法） | 组一违例 | 组二违例 | 判读 |
| --- | --- | --- | --- |
| M1 去掉丢帧对账 | 72171 | 72171 | 红 —— 抓到 |
| M2 阈值 \> 改成 \>= | 0 | 0 | 绿 —— 没抓到（ **这是正确结果** ，见下） |
| M3 掩码用在计数器上 | 133407 | 240594 | 红 —— 抓到 |
| M4 发布时不加一（off-by-one） | 72171 | 72171 | 红 —— 抓到 |
| M5 一次读满整个容量 | 205973 | 205973 | 红 —— 抓到 |
| M6 回绕当成空（有符号比较） | 0 | 40095 | 红 —— 抓到 |
| M7 读指针不前进 | 97254 | 97254 | 红 —— 抓到 |

 

6 条被抓到，其中有一条 **值得单独说** ： "回绕当成空"这处变异， **组一一条都没抓到，组二抓到了 40095 条** 。这就是组二存在的全部理由 —— 只跑"计数器从 0 起"那一组的话，回绕这件事 **根本没被考到** 。   
  
 还有一处是 **抓不到的，而这是正确结果** ：把溢出判据从 ` lag > mask + 1 ` 改成 ` lag >= mask + 1 `， 两者 **语义等价** 。因为当 ` lag ` 正好等于容量时， ` lost = lag - (mask + 1) = 0 `，那个 ` if ` 体是空转 —— 走进去和不走进去的结果一样。 **边界上观察不到差别，是这份实现的性质** ， 不是检查器漏了。

 

○ 记一笔：这条"回绕检验"曾经是假的

 

组二的起点最初写的是 ` 0xFFFFFF00 `。听起来够靠上了，但深度 7 的序列 最多自增 7 次，` 0xFFFFFF00 + 7 = 0xFFFFFF07 ` ——  **离 232 还差 248 格，一次都没绕过** 。 那一组顶着"回绕检验"的名字，实际什么也没考。   
  
 发现它的过程值得记下来：是 **变异测试** 把它揪出来的。 故意把回绕写成"` head < tail ` 就当空"（这是最容易踩的那个坑）， 结果 **组一 0 违例、组二也 0 违例**  —— 一组本该红的变异全绿， 说明这两组都没在考它。把起点改成 ` 0xFFFFFFFC ` （深度 7 至少自增 4 次，必定穿过上界）之后，同一处变异在组二上当场红了 40095 条。   
  
  **一条全绿的检验，最该做的事是去证明它能红。**

 

```zhizhan-anchor
ch6-7-2
```



### 6.7.2 volatile 与编译屏障：实测它们各自挡住了什么

 

§6.7 那个 ` ringbuf.h ` 的注释里写着： ` head ` 必须是 ` volatile `， 因为它是"数据写完了"的 **发布信号** 。这个说法本身没错，但它太笼统了 —— ` volatile ` 到底挡住了什么？加一条编译屏障又会多挡住什么？

 

这两个问题的答案 **不难猜，但很容易猜错** 。下面这份文件把四组对照写在一起， 全部结论都来自 ` -O2 ` 的真反汇编 —— 猜的那部分我写在了注释里， 然后让反汇编来判它。其中第一组就判了个 **"猜错"** ， 这份文件的头部注释里留着那次记录。

 

fence\_check.c — volatile 挡住的与没挡住的，四组对照 C

 

```text
/* fence_check.c — volatile 到底挡住了什么、又没挡住什么
 *
 * 四组对照，全部拿 -O2 的 ARM 反汇编说话：
 *   组一：静态数组 + volatile 头指针 —— 加不加编译屏障，指令一样吗？
 *   组二：把数据换成外部可见的全局数组，逼编译器必须真的写 —— 顺序变了吗？
 *   组三：屏障真正【救活】过的东西 —— 一个本该被删掉的空循环。
 *   组四：原子栅栏会不会被"M 核是强序的"这个说法省掉？
 *
 * 这一节的结论是实测出来的，不是推理出来的：四组的答案分别是
 * "一样"、"一样"、"14 条 vs 4 条"、"照发 dmb"。
 *
 * ⚠ 上面那句原本写的是 "4 条 vs 15 条"。写它的时候我只在脑子里推了一遍
 *   volatile 循环该多出哪几条，没有真的去数；反汇编出来是 14 vs 4。
 *   这类"顺手估一个数"是本章最想拦住的动作 —— 它看着像结论，
 *   其实是把读者的核对成本转嫁了出去。
 */
#include <stdint.h>

#define RB_SIZE 8u

/* ---------------- 组一：静态缓冲区 + volatile 发布 ----------------
   这一组的重点是：s_buf 在本编译单元里【没有任何读者】，
   于是 8 次写入全部属于"死存储"，编译器有权整个删掉。 */
static uint8_t           s_buf[RB_SIZE];
static volatile uint32_t s_head;

void pub_plain(const uint8_t *src)
{
    for (uint32_t i = 0u; i < RB_SIZE; i++) {
        s_buf[i] = src[i];
    }
    s_head = RB_SIZE;
}

void pub_fenced(const uint8_t *src)
{
    for (uint32_t i = 0u; i < RB_SIZE; i++) {
        s_buf[i] = src[i];
    }
    __asm__ volatile ("" ::: "memory");     /* 编译屏障 */
    s_head = RB_SIZE;
}

/* ---------------- 组二：让数据"必须存在"，再看顺序 ----------------
   g_buf 是外部链接的全局数组，本单元之外可能有人读它，
   编译器就不敢删了 —— 这时才能看清 volatile 发布与数据写入的相对顺序。 */
uint8_t           g_buf[RB_SIZE];
volatile uint32_t g_head;

void pub_visible(const uint8_t *src)
{
    for (uint32_t i = 0u; i < RB_SIZE; i++) {
        g_buf[i] = src[i];
    }
    g_head = RB_SIZE;                       /* 发布 */
}

/* ---------------- 组三：屏障真正派上用场的一处 ----------------
   空循环是标准的"死代码"，-O1 起就会被删。要让循环活下来，
   常见写法是把计数器声明成 volatile —— 代价是它被迫住在栈上。
   编译屏障能在不牺牲寄存器分配的前提下达到同样目的。 */
void wait_volatile(void)
{
    for (volatile uint32_t i = 0u; i < 100u; i++) {
        /* 空 */
    }
}

void wait_fenced(void)
{
    for (uint32_t i = 0u; i < 100u; i++) {
        __asm__ volatile ("" ::: "memory");
    }
}

/* ---------------- 组四：原子栅栏到底发不发指令 ----------------
   Cortex-M 常被说成"强序"，于是很容易推出"__atomic_thread_fence 在 M 核上
   是个空操作"。编译器不这么认为。下面四种内存序各写一个函数，
   让反汇编来判断这个推理对不对 —— 顺便还能看出 M0 和 M3 在这件事上有没有分歧。 */
void fence_seq_cst(void) { __atomic_thread_fence(__ATOMIC_SEQ_CST); }
void fence_acquire(void) { __atomic_thread_fence(__ATOMIC_ACQUIRE); }
void fence_release(void) { __atomic_thread_fence(__ATOMIC_RELEASE); }
void fence_relaxed(void) { __atomic_thread_fence(__ATOMIC_RELAXED); }
```

 

✕ 第一组的答案：编译屏障 **没有** 救回那 8 次写入

 

组一里 ` pub_plain ` 和 ` pub_fenced ` 只差一行 ` __asm__ volatile ("" ::: "memory") `。 写这段的时候我以为会看到"有屏障 → 8 次写入保住 / 没屏障 → 被删"。  **实测不是。**

 

两款核上，两个函数的指令 **逐字节相同** ，而且 **都只剩 4 条** ： 8 次写入在两个版本里 **都被删掉了** ，只剩发布那一句 ` movs r2, #8 ` / ` str r2, [r3] `。

 

"逐字节相同"这句话不是修辞 —— 它是可以拿命令核的。 把两个函数的 **机器码那一列** 单独切出来比：

 

**bash**  — 只比机器码字节：两款核上两个函数是否真的一致

 

```text
$ for c in m3 m0; do arm-none-eabi-objdump -d fence-$c.o | sed -n "/<pub_plain>:/,/^$/p"  | tail -n +2 | cut -f2 | grep -v '^$' > p-$c.hex; arm-none-eabi-objdump -d fence-$c.o | sed -n "/<pub_fenced>:/,/^$/p" | tail -n +2 | cut -f2 | grep -v '^$' > f-$c.hex; cmp p-$c.hex f-$c.hex && echo "cortex-$c：pub_plain 与 pub_fenced 的机器码逐字节相同"; done

cortex-m3：pub_plain 与 pub_fenced 的机器码逐字节相同
cortex-m0：pub_plain 与 pub_fenced 的机器码逐字节相同
$ wc -l p-m3.hex f-m3.hex p-m0.hex f-m0.hex

  5 p-m3.hex
  5 f-m3.hex
  5 p-m0.hex
  5 f-m0.hex
 20 total
$ cat p-m3.hex

2208      
4b01      
601a      
4770      
00000000
```

 

这条命令里有两处不能省。 **一是 ` cut -f2 `** ： 比的是 **机器码那一列** ，不是整行输出 —— ` objdump ` 每行是「地址 \+ 机器码 \+ 助记符」三段， 地址在两个函数里当然不一样，整行比必然不等，而"逐字节相同"说的本来就不是地址。  **二是 ` tail -n +2 `** ： ` sed ` 切出来的第一行是 ` 00000000 <pub_plain>: ` 这种 **函数标签行** ， 它 **没有制表符**  —— ` cut -f2 ` 切不动它， 会把整行原样留在结果里，而两个函数的标签显然不同， ` cmp ` 于是报"不同"。那个"不同"跟指令一个字的关系都没有， 所以这一行必须先扔掉。

 

还有一处是顺手做的： **滤掉空行** 。它 **不影响**  ` cmp ` 的结论（空行两边都有，比出来还是相同）， 但它影响 ` wc ` 和 ` cat ` 读出来的东西 —— ` sed ` 那个区间会把函数后面用来分隔的空行也切进来， 不滤掉的话每个文件是 6 行而不是 5 行，"4 条指令加一个常量池字"这句话就对不上了。

 

下面两条 ` cortex-…：…逐字节相同 ` 是 ` cmp ` 原样的结果（` && ` 后面的 ` echo ` 只在 ` cmp ` 返回 0 时才响，所以它响了两声）； ` wc -l ` 说四个文件都是 5 行 —— 谁都没多、谁都没少 （` total ` 那一行是 ` wc ` 自己加的）； 最后 ` cat ` 出来的是 **被比的东西** ： 4 条指令加一个常量池字，两个版本一个字节都不差。

 

为什么？因为 ` s_buf ` 是 ` static ` 的、 在 **本编译单元里没有任何读者** ，那 8 次写入是标准的"死存储"。 编译屏障管的是 **顺序** （不许把这条和那条换位、不许把变量缓存在寄存器里跨过去）， 它 **不管"存在"**  —— 一个从头到尾没人读的存储，删掉它不违反任何顺序约束。   
  
  **这是本节最该记住的一条：` volatile ` 与编译屏障解决的是可见性与顺序， 不是"这段代码会不会被优化掉"。** 要不要保住那 8 次写入， 得靠"它真的被读"这件事本身（` volatile ` 限定那个数组、 通过外部链接暴露出去、或者干脆用 ` __atomic ` / ` __asm__ volatile ` 带操作数的形式）。

 

组二就是为了把"它真的被读"这件事补上：` g_buf ` 换成外部链接的全局数组， 本单元之外可能有人读，编译器就不敢删了。 **这时才能看清顺序**  —— 而这正是 §6.7 那句注释真正想说的事：

 

**bash**  — 组二：数据"必须存在"之后，再看发布与数据写入的先后（` -O2 `）

 

```text
$ arm-none-eabi-objdump -d fence-m3.o | sed -n "/<pub_visible>:/,/^$/p"

00000018 <pub_visible>:
  18:	4a06      	ldr	r2, [pc, #24]	@ (34 <pub_visible+0x1c>)
  1a:	1e43      	subs	r3, r0, #1
  1c:	3007      	adds	r0, #7
  1e:	f813 1f01 	ldrb.w	r1, [r3, #1]!   ← 循环体：带写回的预自增寻址，两个指针各走 8 步（ldrb.w r1, [r3, #1]!）
  22:	4283      	cmp	r3, r0
  24:	f802 1f01 	strb.w	r1, [r2, #1]!
  28:	d1f9      	bne.n	1e <pub_visible+0x6>
  2a:	2208      	movs	r2, #8   ← 发布：g_head = RB_SIZE，值就是 8
  2c:	4b02      	ldr	r3, [pc, #8]	@ (38 <pub_visible+0x20>)
  2e:	60da      	str	r2, [r3, #12]   ← 数据写入全部排在发布之前 —— 这是实测到的顺序
  30:	4770      	bx	lr
  32:	bf00      	nop
  34:	00000003 	.word	0x00000003   ← 常量池字 = .bss+3：下面那条 strb 带写回（先加 1 再存），起手正好落在 g_buf
  38:	00000000 	.word	0x00000000   ← 常量池字 = .bss+0，加上 #12 的偏移正好是 g_head
$ arm-none-eabi-objdump -d fence-m0.o | sed -n "/<pub_visible>:/,/^$/p"

00000018 <pub_visible>:
  18:	2300      	movs	r3, #0   ← 循环计数器从头到尾在 r3 里，比 M3 那组还省一条
  1a:	b510      	push	{r4, lr}
  1c:	4c04      	ldr	r4, [pc, #16]	@ (30 <pub_visible+0x18>)
  1e:	1d21      	adds	r1, r4, #4   ← M0 没有带写回的寻址，循环体多一条 adds，共 5 条
  20:	5cc2      	ldrb	r2, [r0, r3]
  22:	545a      	strb	r2, [r3, r1]
  24:	3301      	adds	r3, #1
  26:	2b08      	cmp	r3, #8
  28:	d1fa      	bne.n	20 <pub_visible+0x8>
  2a:	60e3      	str	r3, [r4, #12]   ← 发布只有这一条：计数器 r3 走到头正好是 8，地址也早就装在 r4 里
  2c:	bd10      	pop	{r4, pc}
  2e:	46c0      	nop			@ (mov r8, r8)   ← 函数末尾的对齐填充（不是发布的一部分）
  30:	00000000 	.word	0x00000000
```

 

| 函数 | M3 条数 | M0 条数 | 它证明了什么 |
| --- | --- | --- | --- |
| ` pub_plain ` | 4 | 4 | 组一：8 次写静态数组是死存储， **整段被删掉** ，只剩发布 |
| ` pub_fenced ` | 4 | 4 | 组一：多一行编译屏障，产物与上一行 **逐字节相同** |
| ` pub_visible ` | 12 | 12 | 组二：数据"外部可见"后写入保住了，且 **全部排在发布之前** |
| ` wait_volatile ` | 14 | 14 | 组三：计数器被迫住栈上，每轮 4 访存 \+ 1 加 \+ 1 比较， **循环体 6 条** |
| ` wait_fenced ` | 4 | 6 | 组三：计数器留在寄存器里，一圈两拍；M0 多一条 ` cmp ` 和一条对齐 ` nop ` |
| ` fence_seq_cst ` | 3 | 3 | 组四：` dmb ish ` \+ ` bx lr ` \+ 对齐 ` nop ` |
| ` fence_acquire ` | 3 | 3 | 组四：与 ` SEQ_CST `  **一字不差** |
| ` fence_release ` | 3 | 3 | 组四：与 ` SEQ_CST `  **一字不差** |
| ` fence_relaxed ` | 2 | 2 | 组四： **什么都没发** ，只剩 ` bx lr ` 和对齐 ` nop ` |

 

组二的 12 条里，前面是一个 4 条指令的拷贝循环 （M3：` ldrb.w r1, [r3, #1]! ` / ` cmp ` / ` strb.w r1, [r2, #1]! ` / ` bne.n ` —— 两个指针各自带写回地走 8 步； M0 上没有带写回的寻址，于是多一条 ` adds `，循环体 5 条）， 后面才是发布那一句 —— 而 **发布在两款核上长得不一样** ： M3 上是 ` movs r2, #8 ` 加 ` str r2, [r3, #12] ` （另有一条 ` ldr r3, [pc, #8] ` 把 ` g_head ` 的地址取进来），M0 上只剩 ` str r3, [r4, #12] ` 一条 —— 那个循环计数器 r3 走到头正好是 8，正好就是要发布的值， 地址也早就在 r4 里了，不用再单独装一次。

 

这里有个容易数错的地方： **源码里那 8 次写入并没有被展开成 8 条** ， 反汇编上只能看到一条 ` ldrb ` 和一条 ` strb `， 那 8 次是 **这一圈转 8 遍** 转出来的。 所以"12 条"这个数里，真正在搬数据的只有 2 条 —— 数指令条数的时候， **静态条数和执行次数是两码事** 。

 

**数据写入全部排在发布之前** ，这一点是实测到的顺序。 至于"编译器为什么没敢把发布提到前面"，那是 **推断** ，不是实测： ` g_buf ` 是外部链接的数组，编译器无法证明 ` volatile ` 的 ` g_head ` 与它互不重叠 （` uint8_t ` 可以别名任何东西），于是只能保留顺序。  **实测给的是结果，这个说法给的是理由，两者别混。**

 

◆ 第三组：屏障真正"救活"过的东西

 

同一份文件里还有一处，编译屏障 **确实** 改变了产物 —— 而且差别不小。 空循环是标准的死代码，` -O1 ` 起就会被整个删掉。 要让循环活下来，最常见的写法是把计数器声明成 ` volatile `； 另一种写法是循环体里放一条编译屏障。

 

两者都能让循环留下来，但 **代价差了三倍多** ： ` volatile ` 让计数器 **被迫住在栈上** ， 每一轮都得 ` ldr ` 出来、` adds `、 ` str ` 回去、 **再 ` ldr ` 一次** 才够比较 —— 循环体 6 条，整个函数 14 条； 编译屏障 **不牺牲寄存器分配** ，计数器留在寄存器里， 一圈只剩 ` subs `/` bne ` 两拍， 整个函数 4 条。

 

**bash**  — 组三：两种"别删我"的写法，产物差多少（` cortex-m3 `）

 

```text
$ arm-none-eabi-objdump -d fence-m3.o | sed -n "/<wait_volatile>:/,/^$/p"

0000003c <wait_volatile>:
  3c:	2300      	movs	r3, #0
  3e:	b082      	sub	sp, #8
  40:	9301      	str	r3, [sp, #4]
  42:	9b01      	ldr	r3, [sp, #4]   ← 进循环前的第一次判断 —— 这一条不算在循环体里
  44:	2b63      	cmp	r3, #99	@ 0x63
  46:	d805      	bhi.n	54 <wait_volatile+0x18>
  48:	9b01      	ldr	r3, [sp, #4]   ← 循环体入口：ldr / adds / str / ldr / cmp / bls 共 6 条
  4a:	3301      	adds	r3, #1
  4c:	9301      	str	r3, [sp, #4]
  4e:	9b01      	ldr	r3, [sp, #4]
  50:	2b63      	cmp	r3, #99	@ 0x63
  52:	d9f9      	bls.n	48 <wait_volatile+0xc>
  54:	b002      	add	sp, #8
  56:	4770      	bx	lr
$ arm-none-eabi-objdump -d fence-m3.o | sed -n "/<wait_fenced>:/,/^$/p"

00000058 <wait_fenced>:
  58:	2364      	movs	r3, #100	@ 0x64
  5a:	3b01      	subs	r3, #1   ← subs 顺手置标志位，后面 bne.n 直接用它 —— 整个函数 4 条
  5c:	d1fd      	bne.n	5a <wait_fenced+0x2>
  5e:	4770      	bx	lr
```

 

**bash**  — 同一份源码，换 ` cortex-m0 `：多出来的两条是什么

 

```text
$ arm-none-eabi-objdump -d fence-m0.o | sed -n "/<wait_volatile>:/,/^$/p"

00000034 <wait_volatile>:
  34:	2300      	movs	r3, #0
  36:	b082      	sub	sp, #8
  38:	9301      	str	r3, [sp, #4]
  3a:	9b01      	ldr	r3, [sp, #4]   ← 进循环前的第一次判断 —— 这一条不算在循环体里
  3c:	2b63      	cmp	r3, #99	@ 0x63
  3e:	d805      	bhi.n	4c <wait_volatile+0x18>
  40:	9b01      	ldr	r3, [sp, #4]   ← 循环体入口：同样是 ldr / adds / str / ldr / cmp / bls 6 条
  42:	3301      	adds	r3, #1
  44:	9301      	str	r3, [sp, #4]
  46:	9b01      	ldr	r3, [sp, #4]
  48:	2b63      	cmp	r3, #99	@ 0x63
  4a:	d9f9      	bls.n	40 <wait_volatile+0xc>
  4c:	b002      	add	sp, #8
  4e:	4770      	bx	lr
$ arm-none-eabi-objdump -d fence-m0.o | sed -n "/<wait_fenced>:/,/^$/p"

00000050 <wait_fenced>:
  50:	2364      	movs	r3, #100	@ 0x64
  52:	3b01      	subs	r3, #1   ← subs r3, #1 —— 和 M3 那组是同一个机器码 3b01
  54:	2b00      	cmp	r3, #0   ← M3 那组没有这一条：多了 cmp r3, #0 才 bne
  56:	d1fc      	bne.n	52 <wait_fenced+0x2>
  58:	4770      	bx	lr
  5a:	46c0      	nop			@ (mov r8, r8)   ← 函数末尾的对齐填充，门禁的口径把它也算一条
```

 

▸ 读表时注意 M0 那一列的"多两条"

 

` wait_fenced ` 在 M3 上是 4 条、M0 上是 6 条。 而 ` wait_volatile `  **两款核都是 14 条**  —— 所以多出来的这两条 **不是屏障的代价** ，是 M0 那一侧的两处细节：

 

**一条是 ` cmp r3, #0 `。**  M3 那组里，` subs r3, #1 ` 后面直接接了 ` bne.n `； M0 这组却在中间补了一条 ` cmp r3, #0 ` 再 ` bne.n `。 两条路径上的 ` subs ` 是 **同一个机器码**  （两边都是 ` 3b01 `），而 16 位 ` SUBS ` 立即数版按 ARMv6-M 的编码表 **本来就置标志位**  （这是手册事实 —— 本机没有 M0 硬件，这一句跑不了，只能查手册）。 所以这一条 **看着是多余的** 。 同一个指令字，在 M3 那组被信任、在 M0 这组不被信任， 那是编译器自己的选择； **我们没法从 GCC 源码证实它为什么这么选， 所以只把它当实测记下来，不替它编一个理由。**

 

**另一条是函数末尾的 *对齐填充*  ` nop `。**  门禁数指令的口径把填充也算一条（这条口径在 §6.2 位带那段的实测里写死过： 从函数标签数到下一个空行，排除 ` .word ` 这类字面量池数据行）， 所以 ` wait_fenced ` 在 M0 上是 6 而不是 5。 数自己机器上的结果时记得用同一条口径，否则同一个函数会数出两个数。

 

最后补一条边界：` __atomic_thread_fence(__ATOMIC_SEQ_CST) ` 在  **cortex-m3 与 cortex-m0 上都会真的发出一条 ` dmb ish `** 。 有人以为"Cortex-M 是强序的，所以原子栅栏在 M 核上是免费的" —— 编译器不这么认为，它会照发不误。这条指令要不要花代价是微架构问题， 但 **"它存在"这件事是工具链事实** ，可以当场核 —— 组四那四个函数就是为这句话写的：

 

**bash**  — 组四：四种内存序的原子栅栏，各编出什么（两款核对照）

 

```text
$ arm-none-eabi-objdump -d fence-m3.o | sed -n '/<fence_seq_cst>:/,$p'

00000060 <fence_seq_cst>:
  60:	f3bf 8f5b 	dmb	ish
  64:	4770      	bx	lr
  66:	bf00      	nop

00000068 <fence_acquire>:
  68:	f3bf 8f5b 	dmb	ish
  6c:	4770      	bx	lr
  6e:	bf00      	nop

00000070 <fence_release>:
  70:	f3bf 8f5b 	dmb	ish
  74:	4770      	bx	lr
  76:	bf00      	nop

00000078 <fence_relaxed>:
  78:	4770      	bx	lr
  7a:	bf00      	nop
$ arm-none-eabi-objdump -d fence-m0.o | sed -n '/<fence_seq_cst>:/,$p'

0000005c <fence_seq_cst>:
  5c:	f3bf 8f5b 	dmb	ish
  60:	4770      	bx	lr
  62:	46c0      	nop			@ (mov r8, r8)

00000064 <fence_acquire>:
  64:	f3bf 8f5b 	dmb	ish
  68:	4770      	bx	lr
  6a:	46c0      	nop			@ (mov r8, r8)

0000006c <fence_release>:
  6c:	f3bf 8f5b 	dmb	ish
  70:	4770      	bx	lr
  72:	46c0      	nop			@ (mov r8, r8)

00000074 <fence_relaxed>:
  74:	4770      	bx	lr
  76:	46c0      	nop			@ (mov r8, r8)
```

 

▸ 四种内存序给了三个答案，"松弛"那一行最值得看

 

` SEQ_CST ` / ` ACQUIRE ` / ` RELEASE ` 三种都发出 ` dmb ish `； ` RELAXED `  **什么都不发**  —— 函数里只剩 ` bx lr `（另外那条 ` nop ` 是函数末尾的对齐填充，不是栅栏的产物）。 同一款核、同一份源码，只换了括号里的那个内存序，产物就不一样： 这说明这个栅栏 **不是照"Cortex-M 强不强序"来的，而是照你写的内存序来的** 。 你写 ` RELAXED `，它就真的什么都不给你。 所以"Cortex-M 强序、栅栏免费"这句话错在两处： **它既不是免费的， 也没有把三种序压成同一条指令。**

 

```zhizhan-anchor
ch6-7-3
```



### 6.7.3 缓冲区开多大：位置运算、DMA 对齐与容量让步

 

"缓冲区开多大"看着像一个容量问题 —— 开大点不就行了。 但容量这个数一旦定下来，会同时买下 **三样平时看不出关系的东西** ： 位置运算能不能退化成一条位运算、缓冲区能不能满足 DMA 的对齐要求、 以及 **容量要不要为了某个上游尺寸让步** 。第三样是最容易吃亏的， 因为它往往由外部决定（"一帧 200 字节"），而不是由你选。

 

rb\_size\_cost.c — 一个容量决定，三处后果 C

 

```text
/* rb_size_cost.c — "缓冲区开多大"这一个决定，同时买下三样东西
 *
 * 这三样在代码里分得很开（算下标、对 DMA、写静态断言），
 * 但它们其实是同一个决定的三个后果，所以放在一起看：
 *   ① 位置运算能不能退化成一条位运算；
 *   ② 缓冲区能不能满足 DMA 的对齐要求；
 *   ③ 容量本身要不要为某个上游尺寸（比如一帧 200 字节）让步。
 */
#include <stdint.h>

/* ---------------- ① 位置运算：2 的幂 vs 不是 ----------------
   下面五组写的是同一件事的两种说法，专看反汇编是否一致。 */
uint32_t pos_mask_256 (uint32_t i) { return i & 255u;  }
uint32_t pos_mod_256  (uint32_t i) { return i % 256u;  }
uint32_t pos_mask_1024(uint32_t i) { return i & 1023u; }
uint32_t pos_mod_1024 (uint32_t i) { return i % 1024u; }
uint32_t pos_mod_200  (uint32_t i) { return i % 200u;  }   /* 不是 2 的幂 */

/* ---------------- ② DMA 对齐：由属性决定，不由变量名决定 ----------------
   两个数组大小一样、类型一样，唯一的差别是 dma_buf 多了对齐属性。
   对齐这件事写在【节属性】里，链接器照它摆位置 —— 反汇编看不出来，
   要看 readelf 的节表。
   加 -DNO_ALIGN 去掉属性，就能当场量出"有属性 / 没属性"的差别。 */
#ifdef NO_ALIGN
#  define DMA_ALIGN
#else
#  define DMA_ALIGN __attribute__((aligned(32)))
#endif

DMA_ALIGN uint8_t dma_buf[256];
uint8_t           plain_buf[256];

uint32_t use_bufs(void)
{
    return (uint32_t)dma_buf[0] + (uint32_t)plain_buf[0];
}
```

 

◆ 先纠正一个说法：2 的幂不是"更快"，是"完全一样"

 

常见说法是"用 ` & ` 代替 ` % ` 更快"。 这句话 **方向对，但措辞会让人误解代价的量级** 。 把 ` i % 256 ` 和 ` i & 255 ` 真编出来看：

 

| 写法 | M3 | M0 | 产物 |
| --- | --- | --- | --- |
| ` i & 255 ` | 2 | 4 | ` uxtb r0, r0 ` 一条；M0 要先装 255 再 ` ands ` |
| ` i % 256 ` | 2 | 4 | 与上一行 **逐字节相同**  —— 编译器把 ` % ` 认成了同一件事 |
| ` i & 1023 ` | 3 | 4 | ` ubfx r0, r0, #0, #10 `；M0 用左移 22 \+ 右移 22 凑 |
| ` i % 1024 ` | 3 | 4 | 与上一行 **逐字节相同** |
| ` i % 200 ` | 6 | 5 | M3 乘魔数 ` 0x51eb851f `；M0 调 ` __aeabi_uidivmod ` |

 

**两款核上都是逐字节相同的。**  这不是"位运算快一点"，是 **编译器把 ` % ` 认成了同一件事**  —— 2 的幂这个约束一给，取模就变成了移位或位与， 写成 ` & ` 的唯一好处是 **把这个前提写进代码里** ， 免得哪天容量被人改成 200 而没人注意到。所以真正的理由不是性能，是 **自证** ： ` _Static_assert((OVRB_SIZE & (OVRB_SIZE - 1u)) == 0u, ...) ` 那句话 才是这一节的重点。

 

**bash**  — 五组位置运算的反汇编（两款核对照）、两条"逐字节相同"的证明、以及有没有函数调用

 

```text
$ arm-none-eabi-objdump -d size-m3.o | sed -n '/<pos_mask_256>:/,$p'

00000000 <pos_mask_256>:
   0:	b2c0      	uxtb	r0, r0   ← i & 255 → uxtb 一条（整个函数 2 条）
   2:	4770      	bx	lr

00000004 <pos_mod_256>:
   4:	b2c0      	uxtb	r0, r0   ← i % 256：与上一行<strong>逐字节相同</strong>
   6:	4770      	bx	lr

00000008 <pos_mask_1024>:
   8:	f3c0 0009 	ubfx	r0, r0, #0, #10   ← i & 1023 → ubfx 一条就切出低 10 位
   c:	4770      	bx	lr
   e:	bf00      	nop

00000010 <pos_mod_1024>:
  10:	f3c0 0009 	ubfx	r0, r0, #0, #10   ← i % 1024：与上一行<strong>逐字节相同</strong>
  14:	4770      	bx	lr
  16:	bf00      	nop

00000018 <pos_mod_200>:
  18:	22c8      	movs	r2, #200	@ 0xc8
  1a:	4b03      	ldr	r3, [pc, #12]	@ (28 <pos_mod_200+0x10>)
  1c:	fba3 1300 	umull	r1, r3, r3, r0   ← umull 乘的是常量池里那个魔数
  20:	099b      	lsrs	r3, r3, #6
  22:	fb02 0013 	mls	r0, r2, r3, r0
  26:	4770      	bx	lr
  28:	51eb851f 	.word	0x51eb851f   ← 魔数 0x51eb851f —— 除以 200 的定点倒数

0000002c <use_bufs>:
  2c:	4b02      	ldr	r3, [pc, #8]	@ (38 <use_bufs+0xc>)
  2e:	7818      	ldrb	r0, [r3, #0]
  30:	f893 3100 	ldrb.w	r3, [r3, #256]	@ 0x100   ← 偏移 256 = plain_buf 与 dma_buf 的间距；对齐的差别在这里一个字都看不出
  34:	4418      	add	r0, r3
  36:	4770      	bx	lr
  38:	00000000 	.word	0x00000000
$ arm-none-eabi-objdump -d size-m0.o | sed -n '/<pos_mask_256>:/,$p'

00000000 <pos_mask_256>:
   0:	23ff      	movs	r3, #255	@ 0xff   ← M0 没有"立即数与"这条指令，先 movs r3, #255 再 ands（共 4 条）
   2:	4018      	ands	r0, r3
   4:	4770      	bx	lr
   6:	46c0      	nop			@ (mov r8, r8)

00000008 <pos_mod_256>:
   8:	23ff      	movs	r3, #255	@ 0xff   ← i % 256：与上一行<strong>逐字节相同</strong>
   a:	4018      	ands	r0, r3
   c:	4770      	bx	lr
   e:	46c0      	nop			@ (mov r8, r8)

00000010 <pos_mask_1024>:
  10:	0580      	lsls	r0, r0, #22   ← M0 也没有 ubfx，用 lsls #22 + lsrs #22 凑出低 10 位
  12:	0d80      	lsrs	r0, r0, #22
  14:	4770      	bx	lr
  16:	46c0      	nop			@ (mov r8, r8)

00000018 <pos_mod_1024>:
  18:	0580      	lsls	r0, r0, #22   ← i % 1024：与上一行<strong>逐字节相同</strong>
  1a:	0d80      	lsrs	r0, r0, #22
  1c:	4770      	bx	lr
  1e:	46c0      	nop			@ (mov r8, r8)

00000020 <pos_mod_200>:
  20:	b510      	push	{r4, lr}
  22:	21c8      	movs	r1, #200	@ 0xc8
  24:	f7ff fffe 	bl	0 <__aeabi_uidivmod>   ← bl __aeabi_uidivmod —— 这一条 M3 那侧没有
  28:	0008      	movs	r0, r1
  2a:	bd10      	pop	{r4, pc}

0000002c <use_bufs>:
  2c:	4b02      	ldr	r3, [pc, #8]	@ (38 <use_bufs+0xc>)
  2e:	7818      	ldrb	r0, [r3, #0]
  30:	4b02      	ldr	r3, [pc, #8]	@ (3c <use_bufs+0x10>)   ← 第二次取地址：plain_buf（dma_buf 在前一个常量池字里）
  32:	781b      	ldrb	r3, [r3, #0]
  34:	18c0      	adds	r0, r0, r3
  36:	4770      	bx	lr
	...
$ for c in m3 m0; do for k in 256 1024; do a=$(arm-none-eabi-objdump -d size-$c.o | sed -n "/<pos_mask_$k>:/,/^$/p" | tail -n +2 | cut -f2); b=$(arm-none-eabi-objdump -d size-$c.o | sed -n "/<pos_mod_$k>:/,/^$/p"  | tail -n +2 | cut -f2); [ "$a" = "$b" ] && echo "cortex-$c：pos_mask_$k 与 pos_mod_$k 的机器码逐字节相同"; done; done

cortex-m3：pos_mask_256 与 pos_mod_256 的机器码逐字节相同
cortex-m3：pos_mask_1024 与 pos_mod_1024 的机器码逐字节相同
cortex-m0：pos_mask_256 与 pos_mod_256 的机器码逐字节相同
cortex-m0：pos_mask_1024 与 pos_mod_1024 的机器码逐字节相同
$ arm-none-eabi-nm -u size-m3.o

（无任何输出，退出码 0）
$ arm-none-eabi-nm -u size-m0.o

         U __aeabi_uidivmod
```

 

✕ 非 2 的幂的代价，只在没有除法器的核上才炸开

 

` i % 200 ` 是"上游尺寸决定了容量"的典型受害者。它编出来是这样：

 

| 核 | 条数 | 实际发生了什么 |
| --- | --- | --- |
| ` cortex-m3 ` | 6 | ` movs r2, #200 ` \+ 取魔数 \+ ` umull ` \+ ` lsrs #6 ` \+ ` mls ` 求余； **没有函数调用** （` nm -u ` 无输出） |
| ` cortex-m0 ` | 5 | ` push ` 存现场 \+ ` movs r1, #200 ` \+ ` bl __aeabi_uidivmod ` \+ ` movs r0, r1 ` \+ ` pop `； **多一次函数调用** |

 

M3 有硬件除法器，但编译器 **连除法指令都没用**  —— 它把除以 200 换成了 **乘一个魔数** （` umull ` \+ 右移 6 位 \+ ` mls ` 求余），一共 6 条， **没有函数调用** 。 M0 没有除法器，于是真的 **调了 libgcc 的 ` __aeabi_uidivmod `** ：` push ` 保存现场、 ` bl ` 进去算、` pop ` 回来 —— 这一段几十个周期的活，就为了对 200 取个余。   
  
 说"非 2 的幂很慢"是不准确的： **在 M3 这类有除法器的核上它只贵几条指令， 在 M0 这类核上它变成一个函数调用** 。 你的代码要在哪一类核上跑，决定了这句话对你成不成立。

 

⚠ DMA 对齐：这件事反汇编里根本看不出来

 

` dma_buf ` 和 ` plain_buf ` 大小一样、类型一样，唯一的差别是前者多了 ` __attribute__((aligned(32))) `。 去看反汇编， **两个数组的区别一个字都看不出来**  —— 对齐这件事 **写在节属性里** ，由链接器照着摆位置。 所以这条证据必须走 ` readelf -S `。

 

下面这个对照不是另写一个文件，是 **门禁当场改出来的** ： 加一个 ` -DNO_ALIGN `，属性就没了。

 

**bash**  — 同一份源码，加属性和去掉属性各编一次，比节对齐字段

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -c rb_size_cost.c -o al-m3-on.o && arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -DNO_ALIGN -c rb_size_cost.c -o al-m3-off.o
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O2 -c rb_size_cost.c -o al-m0-on.o && arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O2 -DNO_ALIGN -c rb_size_cost.c -o al-m0-off.o
$ arm-none-eabi-readelf -S al-m3-on.o al-m3-off.o al-m0-on.o al-m0-off.o | grep -E "File:|\.bss"

File: al-m3-on.o
  [ 4] .bss              NOBITS          00000000 000080 000200 00  WA  0   0 32
File: al-m3-off.o
  [ 4] .bss              NOBITS          00000000 000070 000200 00  WA  0   0  4
File: al-m0-on.o
  [ 4] .bss              NOBITS          00000000 000080 000200 00  WA  0   0 32
File: al-m0-off.o
  [ 4] .bss              NOBITS          00000000 000074 000200 00  WA  0   0  4
$ arm-none-eabi-nm -n size-m3.o | grep -E "dma_buf|plain_buf"

00000000 B dma_buf
00000100 B plain_buf
$ arm-none-eabi-nm -n size-m0.o | grep -E "dma_buf|plain_buf"

00000000 B plain_buf
00000100 B dma_buf
```

 

加属性时 ` .bss ` 的 ` Al ` 字段是 32，去掉之后是 4。  **注意节对齐是整个节的属性，不是那个变量的属性**  —— 它要求"这个节里的东西按 32 字节对齐摆"， 于是带属性的那个数组必然从一个 32 的倍数上开始。 而 **两个数组谁排在前面，是编译器自己定的** ： 上面最后两条 ` nm -n ` 里，` dma_buf ` 在 M3 上落在节内偏移 0x00、 在 M0 上落在 0x100 —— 同一个源文件、同一个属性，换一款核位置就换了。 位置换了，但"对齐到 32 的倍数"这条约束两边都满足， 这就是它和"给变量指定一个地址"的区别。   
  
 这也是为什么"我把数组声明成 ` uint8_t buf[256] ` 就够了" 这个想法靠不住： **256 字节的大小和对齐是两件事** ， 编译器只保证前者的下限（数组起始对齐到元素对齐，也就是 1）。

 

○ 把三处后果收在一句话里

 

容量这个数，同时决定了： **①**  下标运算能不能退化成位运算 （能，但真正的好处是把前提写进代码）、  **②**  能不能满足 DMA / cache line 的对齐要求 （要另加属性，容量本身给不了）、  **③**  要不要为上游尺寸让步（让了就把 ` % ` 请回来，在某些核上请回的是一个函数调用）。 所以正确的顺序不是"先定容量再写代码"，而是 **先把这三条摆出来， 再决定容量，并把不能让步的那条写成 ` _Static_assert `** 。

   

```zhizhan-anchor
ch6-8
```



## 6.8 位操作与原子操作：寄存器里没有的那一半

 

§6.6 讲 GPIO 的时候我留了一句"这个检查本身不是原子的"，§6.7 末尾又冒出来一个 ` __atomic_fetch_add `，然后就没了下文。这一节把这两件事一起收掉：  **位运算和"原子"这两个词，在 Cortex-M 上各自对应到哪一条指令、哪一个库函数。**

 

之所以要专门讲，是因为这两件事的答案 **和你写下的那一行 C 完全没有对应关系** 。 ` x & 0xFF ` 可能是一条指令，也可能是三条； ` __builtin_clz(x) ` 在 M3 上是一条 ` clz `， 在 M0 上是一个函数调用；而` __atomic_fetch_add ` 更极端 —— 它在 M3 上会展开成一个 ` LDREX/STREX ` 循环， 在 M0 上 **连链接都过不去** 。

 

最后那句话不是"性能差一点"的意思，是"这个目标根本链不出来"的意思。 本节会把它一步步量出来：先看六个位运算在两款核上各自发什么， 再看原子操作落到哪几条指令上，最后看 M0 上这件事为什么没有退路、 以及唯一的出路长什么样。

 

◆ 本节的两条主结论，先摆在这里

 

**①**  位运算指令是 **核的型号** 决定的： ` REV ` 属于 ARMv6-M 基础指令集， ` CLZ ` / ` RBIT ` 属于 ARMv7-M 扩展。 所以 M0 上"少的那一半"不是编译器偷懒，是核里真的没有这个电路。

 

**②**  ` __atomic_* ` 的硬件基础是 **独占访问**  （` LDREX ` / ` STREX `），而这是 ARMv7-M 才有的。 M0 上编译器会把它降级成一个外部函数调用，而 **工具链里没有提供那个函数**  —— 于是编得过、链不过，且没有库可以补。

 

```zhizhan-anchor
ch6-8-1
```



### 6.8.1 六个位运算，两款核，一张表

 

下面这份文件里的六个函数，每个都只有一行，全是 C 标准库之外的内建函数 （` __builtin_* `，GCC 和 Clang 都有）。摆在一起的目的只有一个：  **把"一行 C"和"几条指令"之间的那张对照表量出来** 。

 

bitops\_insn.c — 六个位运算，两款核：哪一条是单条指令 C

 

```text
/* bitops_insn.c — 位操作指令层：哪一条是单条指令，哪一条会变成函数调用
 *
 * 这一节只问一个问题：写下一行位运算，编译器到底发什么。
 * 六个函数，每个都只有一行，摆在一起看两款核的差别。
 *
 * 实测环境：GCC 13.3.1、-O2、cortex-m3 与 cortex-m0。
 * 每个函数上面注释里的条数是 objdump 数出来的，门禁会照着反汇编再数一遍。
 */
#include <stdint.h>

/* ① 前导零：CLZ 是 ARMv7-M 的指令。ARMv6-M 没有这条，退化成 libgcc 调用。 */
uint32_t clz_builtin(uint32_t x) { return (uint32_t)__builtin_clz(x); }

/* ② 尾随零：连 M3 上都不是单条。CLZ 只数高位，得先 RBIT 把位序倒过来。 */
uint32_t ctz_builtin(uint32_t x) { return (uint32_t)__builtin_ctz(x); }

/* ③ 数 1 的个数：两款核都没有这条指令，统一调 libgcc 的 __popcountsi2。
 *    也就是说 popcount 在 Cortex-M 上【从来没有】划算过。 */
uint32_t popcount_builtin(uint32_t x) { return (uint32_t)__builtin_popcount(x); }

/* ④ 字节序反转：REV 属于 ARMv6-M 的基础指令集 ——
 *    这一条在 M0 上反而只剩它自己能自足。 */
uint32_t bswap_builtin(uint32_t x) { return __builtin_bswap32(x); }

/* ⑤ 位序反转：RBIT 是 ARMv7-M 的。M0 上写 "rbit" 汇编器直接报错
 *    （不是"慢"，是"不认"），所以这里必须按 __ARM_ARCH 分流。 */
#if defined(__ARM_ARCH) && (__ARM_ARCH >= 7)
uint32_t rbit_cmsis(uint32_t x)
{
  uint32_t r;
  __asm__ volatile ("rbit %0, %1" : "=r" (r) : "r" (x));
  return r;
}
#else
uint32_t rbit_cmsis(uint32_t x)
{
  uint32_t r = 0u;
  for (uint32_t i = 0u; i < 32u; i++) { r = (r << 1) | (x & 1u); x >>= 1; }
  return r;
}
#endif

/* ⑥ 同一个循环，手写的、没做任何分流。
 *    在 M3 上它【不会】被认成 RBIT —— 编译器不替你做这个优化。 */
uint32_t rbit_loop(uint32_t x)
{
  uint32_t r = 0u;
  for (uint32_t i = 0u; i < 32u; i++) { r = (r << 1) | (x & 1u); x >>= 1; }
  return r;
}
```

 

先用 ` -Wall -Wextra -O2 ` 把它在两个核上各编一遍， 确认这份文件本身没有告警 —— 下面所有反汇编都来自这两个目标文件。 （这一条是 **上界声明** ：它只证明"编得过、没告警"， 证明不了任何一句关于指令的话，那些话要从反汇编里来。）

 

| 函数 | M3 条数 | M0 条数 | 两款核上分别是什么 |
| --- | --- | --- | --- |
| ` clz_builtin ` | 3 | 3 | M3：` clz r0, r0 ` 一条；M0：` bl __clzsi2 ` ——  **没有这条指令** |
| ` ctz_builtin ` | 4 | 3 | M3：` rbit ` \+ ` clz `；M0：` bl __ctzsi2 ` —— 两边都不是单条 |
| ` popcount_builtin ` | 3 | 3 | 两款核 **都是函数调用**  ` __popcountsi2 ` —— Cortex-M 从来没有这条指令 |
| ` bswap_builtin ` | 2 | 2 | 两款核 **都是 ` rev r0, r0 ` 一条** ：` REV ` 属于 ARMv6-M 基础指令集 |
| ` rbit_cmsis ` | 3 | 14 | M3：内联汇编发的 ` rbit ` 一条；M0：` #else ` 那个 32 次循环 |
| ` rbit_loop ` | 9 | 14 | 手写循环、没做 ` #if ` 分流：M3 上 **明明有 RBIT 却不用** ，老实发循环 |

 

条数口径：从 ` <函数名>: ` 起、到下一个空行为止， 数 objdump 列出的每一行指令， **包含 ` bx lr ` 和编译器补的对齐 ` nop `** ，不含末尾常量池里的数据行。 也就是说：表里的数是"这个函数在目标文件里占几行"， 不是"执行路径上有几条" —— 这个口径在 §6.7 已经用过一次，门禁按同一段代码数。

 

空口说没意思，直接把两个目标文件的反汇编摆出来。先看 M3：

 

**bash**  — M3 上六个位运算函数各自发什么（` -O2 `）

 

```text
$ arm-none-eabi-objdump -d bitops-m3.o

bitops-m3.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <clz_builtin>:
   0:	fab0 f080 	clz	r0, r0   ← clz 一条 —— ARMv7-M 的指令。这个函数一共 3 行（含末尾对齐 nop）
   4:	4770      	bx	lr
   6:	bf00      	nop

00000008 <ctz_builtin>:
   8:	fa90 f0a0 	rbit	r0, r0   ← 先 rbit 把位序倒过来，再 clz —— CLZ 只数高位，数不了尾随零
   c:	fab0 f080 	clz	r0, r0
  10:	4770      	bx	lr
  12:	bf00      	nop

00000014 <popcount_builtin>:
  14:	b508      	push	{r3, lr}
  16:	f7ff fffe 	bl	0 <__popcountsi2>   ← popcount：M3 也没有这条指令，进函数第一件事就是 bl
  1a:	bd08      	pop	{r3, pc}

0000001c <bswap_builtin>:
  1c:	ba00      	rev	r0, r0   ← bswap：rev 一条。REV 属于 ARMv6-M 基础指令集
  1e:	4770      	bx	lr

00000020 <rbit_cmsis>:
  20:	fa90 f0a0 	rbit	r0, r0   ← rbit_cmsis 走的是 #if 的 v7 分支：一条 rbit
  24:	4770      	bx	lr
  26:	bf00      	nop

00000028 <rbit_loop>:
  28:	4603      	mov	r3, r0
  2a:	2220      	movs	r2, #32   ← movs r2, #32 —— 手写循环的迭代计数器
  2c:	2000      	movs	r0, #0
  2e:	f003 0101 	and.w	r1, r3, #1
  32:	3a01      	subs	r2, #1
  34:	ea41 0040 	orr.w	r0, r1, r0, lsl #1   ← orr.w r0, r1, r0, lsl #1：把取出的那一位并进结果
  38:	ea4f 0353 	mov.w	r3, r3, lsr #1
  3c:	d1f7      	bne.n	2e <rbit_loop+0x6>   ← 循环回跳。这一版 9 行；上面那个 rbit_cmsis 3 行 —— 差的就是那一条 rbit
  3e:	4770      	bx	lr
```

 

再看同一份源码、只把 ` -mcpu ` 换成 ` cortex-m0 `：

 

**bash**  — M0 上同一份源码的反汇编，六个函数里有三个变成了函数调用

 

```text
$ arm-none-eabi-objdump -d bitops-m0.o

bitops-m0.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <clz_builtin>:
   0:	b510      	push	{r4, lr}
   2:	f7ff fffe 	bl	0 <__clzsi2>   ← M0 没有 clz 指令：这里变成 bl __clzsi2（M3 那侧是一条 clz）
   6:	bd10      	pop	{r4, pc}

00000008 <ctz_builtin>:
   8:	b510      	push	{r4, lr}
   a:	f7ff fffe 	bl	0 <__ctzsi2>   ← ctz 也变成一次调用；M3 上是 rbit + clz 两条
   e:	bd10      	pop	{r4, pc}

00000010 <popcount_builtin>:
  10:	b510      	push	{r4, lr}
  12:	f7ff fffe 	bl	0 <__popcountsi2>   ← popcount 同样是调用 —— 这是两款核上待遇唯一相同的操作
  16:	bd10      	pop	{r4, pc}

00000018 <bswap_builtin>:
  18:	ba00      	rev	r0, r0   ← bswap 还是 rev 一条：REV 在 M0 上也有
  1a:	4770      	bx	lr

0000001c <rbit_cmsis>:
  1c:	0003      	movs	r3, r0   ← rbit_cmsis 走 #else 分支：和下面的 rbit_loop 是同一段循环
  1e:	b510      	push	{r4, lr}
  20:	2220      	movs	r2, #32
  22:	2000      	movs	r0, #0
  24:	2401      	movs	r4, #1
  26:	0021      	movs	r1, r4
  28:	0040      	lsls	r0, r0, #1
  2a:	4019      	ands	r1, r3
  2c:	3a01      	subs	r2, #1
  2e:	4308      	orrs	r0, r1
  30:	085b      	lsrs	r3, r3, #1
  32:	2a00      	cmp	r2, #0
  34:	d1f7      	bne.n	26 <rbit_cmsis+0xa>
  36:	bd10      	pop	{r4, pc}

00000038 <rbit_loop>:
  38:	0003      	movs	r3, r0
  3a:	b510      	push	{r4, lr}
  3c:	2220      	movs	r2, #32
  3e:	2000      	movs	r0, #0
  40:	2401      	movs	r4, #1
  42:	0021      	movs	r1, r4
  44:	0040      	lsls	r0, r0, #1
  46:	4019      	ands	r1, r3   ← M0 的循环体：ands / subs / orrs / lsrs / cmp / bne
  48:	3a01      	subs	r2, #1
  4a:	4308      	orrs	r0, r1
  4c:	085b      	lsrs	r3, r3, #1
  4e:	2a00      	cmp	r2, #0
  50:	d1f7      	bne.n	42 <rbit_loop+0xa>
  52:	bd10      	pop	{r4, pc}
```

 

◆ 逐行读出来的四件事

 

 
1. **` REV `（字节序反转）是唯一一款两款核都自足的操作。**  ` __builtin_bswap32 ` 在 M3 和 M0 上 **都只发一条 ` rev r0, r0 `** 。原因不在优化器，在指令集归属： ` REV ` 是 ARMv6-M 的基础指令， ` CLZ ` / ` RBIT ` 是 ARMv7-M 才加的。 这条差别在选型时经常被忽略 ——  **协议里凡是有字节序转换的，M0 一点都不吃亏； 凡是要数前导零的（比如定点的 ` log2 `、找最高位），M0 要吃一次调用。**
 
2. **` POPCNT ` 在 Cortex-M 上一律不存在。**  ` __builtin_popcount ` 在两款核上 **都是 ` bl __popcountsi2 `** ，成本一样。 所以"用 popcount 数 CRC 的 1 位"这件事，在 M 核上从来没有免费过。
 
3. **连 M3 上的 ` __builtin_ctz ` 都不是单条。**  它先 ` rbit ` 再 ` clz ` —— ` CLZ ` 只数高位，要数尾随零就得先把位序倒过来。 这也顺带解释了 ` RBIT ` 为什么值得单独存在：  **它是"位序反转"这一族算法的前置步骤** 。
 
4. **最刺眼的一行是 ` rbit_loop `。**  M3 上明明有 ` RBIT ` 这条指令， 编译器 **没有** 把那个 32 次循环认出来，老老实实发了 9 条指令； M0 上更没法认（核里根本没这条），发 14 条。 而上一行的 ` rbit_cmsis ` 干的是同一件事：它走的 ` #if ` 分支里内联汇编发了 ` rbit `， 所以 M3 那侧只花  **1 条真正的计算指令**  （表里记的是 3 行 —— 那 3 行里有 ` bx lr ` 和一条对齐用的 ` nop `， 本节的条数一律按这个口径数，不是按"干活的指令"数）。

 

⚠ 这就是 CMSIS 里 ` __RBIT ` 要带 ` #if ` 的原因

 

` rbit_loop ` 和 ` rbit_cmsis ` 在 M0 分支上  **是同一段代码、逐条相同的指令**  —— 都是那个循环。 这不是巧合：M0 上没有 ` RBIT `， CMSIS 的 ` __RBIT ` 实现 **也只能写成这个循环** 。 如果你在 M0 的工程里直接写 ` __asm__("rbit %0, %1") `，  **汇编器会当场报错** （不是"性能差"，是"这条指令不存在"）—— 所以所有跨 M0/M3 的代码里，这类内联汇编都必须裹在 ` __ARM_ARCH ` 判断里。上面的 ` #if ` 就是这个原因，不是为了好看。

 

顺带一提：` __ARM_ARCH ` 在 M0 上是 6、 在 M3 上是 7， 对应的宏分别是 ` __ARM_ARCH_6M__ ` 和 ` __ARM_ARCH_7M__ `。 写 ` #if (__ARM_ARCH >= 7) ` 就是在问"这个核有没有 v7-M 那一套扩展指令"。

 

表里"变成函数调用"这件事还有一个后续问题： **那三个函数由谁提供？**  答案可以在目标文件的未定义符号里直接看到 —— 而且这份文件在 M0 上  **真的能链过** （下一节的原子操作恰好相反，这个对比是本节的重点之一）。 最后一步是给这个对比上保险：把库摘掉再链一次，让"库确实在起作用"这件事 从"我猜是 ` libgcc ` 提供的"变成"摘掉它立刻就不过"。

 

**bash**  — 五步：两款核的未定义符号对照 → M0 上链一次（过）→ 看那三个符号由谁补上 →  **再把库摘掉链一次（不过）** （工具链的绝对路径折叠成 ` <工具链> `，其余一字未改）

 

```text
$ arm-none-eabi-nm -u bitops-m3.o

         U __popcountsi2
$ arm-none-eabi-nm -u bitops-m0.o

         U __clzsi2
         U __ctzsi2
         U __popcountsi2
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -nostartfiles -Wl,-e,0 bitops-m0.o -o bitops-m0.elf

（无任何输出，退出码 0）
$ arm-none-eabi-nm bitops-m0.elf | grep -E "__clzsi2|__ctzsi2|__popcountsi2"

00008054 T __clzsi2
00008090 T __ctzsi2
000080d0 T __popcountsi2
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -nostartfiles -Wl,-e,0 -nostdlib bitops-m0.o -o /dev/null

〈工具链〉/ld.exe: bitops-m0.o: in function `clz_builtin':
bitops_insn.c:(.text+0x2): undefined reference to `__clzsi2'
〈工具链〉/ld.exe: bitops-m0.o: in function `ctz_builtin':
bitops_insn.c:(.text+0xa): undefined reference to `__ctzsi2'
〈工具链〉/ld.exe: bitops-m0.o: in function `popcount_builtin':
bitops_insn.c:(.text+0x12): undefined reference to `__popcountsi2'
collect2.exe: error: ld returned 1 exit status
```

 

○ 记一笔：这一路证据能证明什么、不能证明什么

 

能证明的是： **在 GCC 13.3.1、` -O2 `、这两款核上， 这些内建函数被编成了这些指令** ，以及 M0 上少的那三个由 ` libgcc ` 提供、链接器找得到。 不能证明的是：换个 GCC 版本、换个 ` -O ` 级别、 或者换一款具体型号（比如 M0\+ / M23），上面这张表还成不成立。 所以本节的每一张表都标了它是"实测"，而不是"手册规定"。 真正手册规定的是那条 **归属关系** ： ` REV ` 在 ARMv6-M 里、` CLZ ` / ` RBIT ` 不在。

 

```zhizhan-anchor
ch6-8-2
```



### 6.8.2 ` __atomic_* ` 的硬件基础：LDREX/STREX 与那两条 dmb

 

现在回到 §6.7 结尾那句话。先明确一件事：  **` __atomic_fetch_add ` 不是一条指令，也不是一个函数**  —— 它是一个"由编译器决定降级成什么"的 **契约** 。 在这个核上能降级成独占访问指令，它就展开成几条指令； 降不了，它就变成一次外部调用。下面这份文件把"同一个意思的五种写法"摆在一起 —— 从 ` volatile ` 基线，到手写的 CAS 循环，到内建的一行写法， 到只换一个内存序参数的那一版，最后补上老名字 ` __sync_* `（很多人以为"老写法总归更保守"，这一版就是拿来验这句话的）。

 

atomic\_ops.c — 原子操作落在什么硬件上：从 volatile 到 CAS 循环 C

 

```text
/* atomic_ops.c — 原子操作到底落在什么硬件上
 *
 * §6.7 末尾留了一句"或改用原子指令（__atomic_fetch_add）"，没解释它在硬件上是什么。
 * 这份文件就是那句话的答案，分三层：
 *   ① volatile 什么都没挡住（拿它当基线）
 *   ② __atomic_* 在 M3 上是 LDREX/STREX 循环，在 M0 上是一个叫不出来的函数
 *   ③ 编译期就能问清楚"这个核锁不锁得住"
 *
 * 实测环境：GCC 13.3.1、-O2、cortex-m3 与 cortex-m0。
 */
#include <stdint.h>

typedef struct {
  volatile uint32_t head;
  volatile uint32_t tail;
} mp_rb_t;

/* ① 基线：volatile 只保证"每次都真去读写内存"，
 *    读-改-写这三步之间没有任何保护。 */
void counter_inc_volatile(volatile uint32_t *p) { *p += 1u; }

/* ② 用 CAS 循环"领号"：这是原子操作最一般的形态。
 *    成功就返回旧的 head；失败时 __atomic_compare_exchange_n 会把内存里的
 *    实际值写回 h，然后重试。 */
uint32_t rb_claim(mp_rb_t *rb)
{
  uint32_t h = __atomic_load_n(&rb->head, __ATOMIC_RELAXED);
  for (;;) {
    uint32_t next = h + 1u;
    if (__atomic_compare_exchange_n(&rb->head, &h, next, 0,
                                    __ATOMIC_RELAXED, __ATOMIC_RELAXED)) {
      return h;
    }
  }
}

/* ③ 同一件事的简洁写法。M3 上编出来的就是 LDREX/STREX 循环。 */
uint32_t rb_claim_fetch_add(mp_rb_t *rb)
{
  return __atomic_fetch_add(&rb->head, 1u, __ATOMIC_RELAXED);
}

/* ④ 只把内存序从 RELAXED 换成 SEQ_CST，其余一个字不改。
 *    M3 上多出来的是两条 dmb —— 内存序的全部代价就在这里。 */
uint32_t rb_claim_seq_cst(mp_rb_t *rb)
{
  return __atomic_fetch_add(&rb->head, 1u, __ATOMIC_SEQ_CST);
}

/* ⑤ 老名字：__sync_fetch_and_add 是 GCC 更早的那一套内建。
 *    它和 __atomic_* 走的是同一条降级路径 —— 放进来是为了回答
 *    "那我用老写法是不是就没事了"，答案是同一个链接错误。 */
uint32_t rb_claim_sync(mp_rb_t *rb)
{
  return __sync_fetch_and_add(&rb->head, 1u);
}

/* ⑥ 编译期就问清楚：4 字节的原子操作在这个核上锁不锁得住。
 *    M3 上这是真命题，直接过。M0 上是假命题 —— 于是这份文件在 M0 上
 *    连编都编不过，下面那些反汇编也就无从谈起。
 *    所以正文里的做法是【照实写、但按 __ARM_ARCH 让开】；
 *    想看让开之后那句断言真红一次，加 -DNO_ATOMIC_GUARD
 *    （门禁里有一条规格就是这么干的，正文那段红字就是这么来的）。 */
#if !defined(__ARM_ARCH) || (__ARM_ARCH >= 7) || defined(NO_ATOMIC_GUARD)
_Static_assert(__atomic_always_lock_free(4, 0),
               "no lock-free 4-byte atomics on this core");
#endif
```

 

这份文件里的五个函数可以配成三对来读： ` rb_claim `（手写的 CAS 循环）与 ` rb_claim_fetch_add `（内建的一行）是 **语义相同、写法不同** 的一对； ` rb_claim_fetch_add ` 与 ` rb_claim_seq_cst ` 是 **只差一个内存序参数** 的一对； ` rb_claim_sync ` 与 ` rb_claim_seq_cst ` 则是 **新旧两套内建** 的一对 —— 后者默认就是 ` SEQ_CST `，所以它俩应当编出同一段代码，这一条下面会当场验。 条数全在下面这张表里：

 

| 函数 | M3 条数 | M0 条数 | 说明 |
| --- | --- | --- | --- |
| ` counter_inc_volatile ` | 4 | 4 | **不是原子操作** 。两款核都只有 ` ldr ` / ` adds ` / ` str ` —— ` volatile ` 只管"真读写" |
| ` rb_claim ` | 13 | 19 | 手写的 CAS 循环。M3 上一整段 ` ldrex ` / ` strex ` 重试；M0 上 **整段变成一个调用** |
| ` rb_claim_fetch_add ` | 8 | 5 | M3：` ldrex ` / ` adds ` / ` strex ` / ` cmp ` / ` bne ` 五条循环， **没有任何屏障** ；M0：一次 ` bl ` |
| ` rb_claim_seq_cst ` | 10 | 5 | 与上一行只差内存序参数：M3 上多两条 ` dmb ish `（一前一后）；M0 上只是把运行时参数从 ` #0 ` 换成 ` #5 ` |
| ` rb_claim_sync ` | 10 | 5 | 老名字 ` __sync_fetch_and_add `：M3 上 **与 SEQ\_CST 那版逐条相同** ；M0 上同样是一个叫不出来的符号 |

 

M3 上的反汇编 —— 五个函数全在里面，独占访问指令就在其中：

 

**bash**  — M3 上五个函数的反汇编；末尾那个 ` rb_claim_sync ` 是用来验"老名字有没有换来更小的代码"的

 

```text
$ arm-none-eabi-objdump -d atomic-m3.o

atomic-m3.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <counter_inc_volatile>:
   0:	6803      	ldr	r3, [r0, #0]   ← volatile 版：ldr / adds / str 三条 —— 中断落在 adds 和 str 之间就丢一次自增
   2:	3301      	adds	r3, #1
   4:	6003      	str	r3, [r0, #0]
   6:	4770      	bx	lr

00000008 <rb_claim>:
   8:	4603      	mov	r3, r0
   a:	6800      	ldr	r0, [r0, #0]
   c:	1c41      	adds	r1, r0, #1
   e:	e853 2f00 	ldrex	r2, [r3]   ← ldrex：把 head 读进独占监视器（CAS 的"读"这一步）
  12:	4282      	cmp	r2, r0   ← cmp r2, r0：把读回来的实际值和期望值比一比
  14:	d104      	bne.n	20 <rb_claim+0x18>   ← 不相等 → 跳到 0x20 走"重试"分支
  16:	e843 1c00 	strex	ip, r1, [r3]   ← strex：只有这一条成功、且返回 0，写才算数
  1a:	f1bc 0f00 	cmp.w	ip, #0
  1e:	d1f6      	bne.n	e <rb_claim+0x6>   ← strex 失败 → 跳回 0x0e 重来
  20:	4610      	mov	r0, r2
  22:	d1f3      	bne.n	c <rb_claim+0x4>   ← 这一条 bne 复用的是 0x12 那次 cmp 的标志位：从上面落下来不跳，从 0x14 跳过来必然跳
  24:	4770      	bx	lr
  26:	bf00      	nop

00000028 <rb_claim_fetch_add>:
  28:	4603      	mov	r3, r0
  2a:	e853 0f00 	ldrex	r0, [r3]   ← fetch_add 版：ldrex → adds → strex 三步，没有"比期望值"那一段
  2e:	1c42      	adds	r2, r0, #1
  30:	e843 2100 	strex	r1, r2, [r3]
  34:	2900      	cmp	r1, #0
  36:	d1f8      	bne.n	2a <rb_claim_fetch_add+0x2>
  38:	4770      	bx	lr
  3a:	bf00      	nop

0000003c <rb_claim_seq_cst>:
  3c:	4603      	mov	r3, r0
  3e:	f3bf 8f5b 	dmb	ish   ← SEQ_CST 多出来的第一条 dmb —— 在 ldrex 之前
  42:	e853 0f00 	ldrex	r0, [r3]
  46:	1c42      	adds	r2, r0, #1
  48:	e843 2100 	strex	r1, r2, [r3]
  4c:	2900      	cmp	r1, #0
  4e:	d1f8      	bne.n	42 <rb_claim_seq_cst+0x6>
  50:	f3bf 8f5b 	dmb	ish   ← 第二条 dmb —— 在循环之后
  54:	4770      	bx	lr
  56:	bf00      	nop

00000058 <rb_claim_sync>:
  58:	4603      	mov	r3, r0
  5a:	f3bf 8f5b 	dmb	ish   ← __sync 版也有这条 dmb，而且和上面 SEQ_CST 那一段逐条相同
  5e:	e853 0f00 	ldrex	r0, [r3]
  62:	1c42      	adds	r2, r0, #1
  64:	e843 2100 	strex	r1, r2, [r3]
  68:	2900      	cmp	r1, #0
  6a:	d1f8      	bne.n	5e <rb_claim_sync+0x6>
  6c:	f3bf 8f5b 	dmb	ish
  70:	4770      	bx	lr
  72:	bf00      	nop
```

 

先看那一对"新旧内建"：` rb_claim_seq_cst ` 与 ` rb_claim_sync ` 编出来的  **是逐条相同的指令** （连 ` dmb ish ` 的位置都一样）， 条数也都是 10 条。 这不是巧合：` __sync_* ` 是 ` __atomic_* ` 的前身，GCC 对它的处理就是"按 ` SEQ_CST ` 转成 ` __atomic_* `"。 **所以换老名字不会更省、也不会更安全 —— 它在新的编译器上只是同一个东西的另一个拼法。**  它在 M0 上给你的，是同一个链接错误（下面那张红框里有它的名字）。

 

◆ 内存序的全部代价，就是那两条 ` dmb `

 

` rb_claim_fetch_add `（` RELAXED `）和 ` rb_claim_seq_cst `（` SEQ_CST `） 的源码只差最后一个参数，编出来的指令 **只差两条 ` dmb ish `** ： 一条在 ` ldrex ` 之前、一条在循环之后。 中间那 5 条（` ldrex ` / ` adds ` / ` strex ` / ` cmp ` / ` bne `）两边一字不差。  **所以"要不要更严的内存序"这个问题，在代码体积上就是两条屏障指令的差别， 代价不在指令数，在它对流水线和中断延迟的影响。**

 

这也回过头解释了 §6.7.2 里那个 ` fence_seq_cst ` 为什么只有三条指令：那里是个 **空函数** ，编译器只发了 ` dmb ish ` 加返回 —— 也就是"半个屏障"。 把它和这里对上，就能理解 ` __atomic_thread_fence ` 发的是"屏障本身"，而 ` __atomic_fetch_add ` 发的是"屏障 \+ 保证不被打断的读-改-写"。

 

▸ 顺带看一眼最上面那个 ` volatile ` 版本

 

` counter_inc_volatile ` 在 **两款核上都只有 4 条** ： ` ldr ` / ` adds ` / ` str ` / ` bx lr `。 ` volatile ` 的全部作用就是"这三条不许被优化掉、 不许合并"，它 **一个字都没提"这三条之间不能被打断"** 。 这就是 §6.4 那个读-改-写竞态在汇编层面长什么样：  **中断只要落在 ` adds ` 和 ` str ` 之间，这次自增就丢了** ， 而两条核的代码一模一样 —— 换核救不了它。

 

✕ M0 的坏消息：编得过，链不过，而且没有库能补

 

把同一份文件换到 M0 上编，结果是 **编译成功、链接失败** 。 这不是"某个选项没开"，而是编译器走了另一条路： M0 没有独占访问指令，于是 ` __atomic_* ` 被降级成对外部函数的调用 —— 名字叫 ` __atomic_fetch_add_4 ` 和 ` __atomic_compare_exchange_4 `， 内存序作为 **运行时参数** 传进去。 编译阶段这两个符号可以悬着，链接阶段必须有人提供。

 

**bash**  — M0 上依次做四件事：看目标文件（编译是过的）→ 链一次（这一步红）→ 把 ` -latomic ` 放到目标文件 **之后** 再链一次 → 最后翻库的家底（工具链的绝对路径折叠成 ` <工具链> `，其余一字未改）

 

```text
$ arm-none-eabi-nm -u atomic-m0.o

         U __atomic_compare_exchange_4
         U __atomic_fetch_add_4
         U __sync_fetch_and_add_4
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -nostartfiles -Wl,-e,0 atomic-m0.o -o atomic-m0.elf

〈工具链〉/ld.exe: atomic-m0.o: in function `rb_claim':
atomic_ops.c:(.text+0x1e): undefined reference to `__atomic_compare_exchange_4'
〈工具链〉/ld.exe: atomic-m0.o: in function `rb_claim_fetch_add':
atomic_ops.c:(.text+0x36): undefined reference to `__atomic_fetch_add_4'
〈工具链〉/ld.exe: atomic-m0.o: in function `rb_claim_seq_cst':
atomic_ops.c:(.text+0x42): undefined reference to `__atomic_fetch_add_4'
〈工具链〉/ld.exe: atomic-m0.o: in function `rb_claim_sync':
atomic_ops.c:(.text+0x4c): undefined reference to `__sync_fetch_and_add_4'
collect2.exe: error: ld returned 1 exit status
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -nostartfiles -Wl,-e,0 atomic-m0.o -latomic -o atomic-m0-la.elf

〈工具链〉/ld.exe: cannot find -latomic: No such file or directory
collect2.exe: error: ld returned 1 exit status
$ arm-none-eabi-nm 〈工具链〉/../lib/gcc/arm-none-eabi/13.3.1/libgcc.a 2>/dev/null | grep -cE '__atomic_fetch_add_4|__atomic_compare_exchange_4|__sync_fetch_and_add_4'

0
$ find 〈工具链〉/.. -name 'libatomic*'

（无任何输出，退出码 0）
```

 

上面第 2 步的失败信息里，四个 ` undefined reference ` 分别来自 ` rb_claim `、` rb_claim_fetch_add `、 ` rb_claim_seq_cst ` 和 ` rb_claim_sync ` ——  **新旧两套内建、CAS 循环和一行写法，全部落在同一堵墙上** 。 第 3 步是专门为 ` -latomic ` 设计的： 链接器扫静态库是单遍向后的，把库放在目标文件 **后面** 才是它最有利的位置， 所以"放在前面所以没找到"这种解释在这里不成立 —— 它报的是 ` cannot find -latomic `， 意思是 **这个库里根本没有这个文件** 。 第 4 步直接去翻库：这套工具链里没有 ` libatomic.a `， ` libgcc.a ` 里那三个符号出现 0 次。

 

有人会说："那是因为你没给库，你前面 bitops 在 M0 上不也链过了？" —— 对，而且这正好是本节要的那个对比。 §6.8.1 里 M0 的 ` bitops_insn.c ` 之所以链得过， 是因为它缺的 ` __clzsi2 ` / ` __ctzsi2 ` / ` __popcountsi2 `  **确实躺在 ` libgcc.a ` 里** ； 同样那份文件，只要把库摘掉（` -nostdlib `）就立刻链不过， 未定义引用正是这三个符号。那份对照就在上面 §6.8.1 的转录里。  **所以 M0 上这两份文件的差别，不在"有没有给库"， 而在"这个符号到底有没有人提供"。**

 

这就是本节最该记住的一句： **用 ` __atomic_* ` 写的代码，在 M3 上能跑，在 M0 上会停在链接这一步** 。 它不会在编译期报错，不会在运行时表现异常 —— 它会在你换芯片、换 ` -mcpu ` 的那一刻， 以一个"undefined reference"的形式出现。至少这个失败是响的， 比静默的数据错误好得多；但你要能认出它是什么意思。

 

```zhizhan-anchor
ch6-8-3
```



### 6.8.3 M0 上怎么写：把中断关掉

 

既然 M0 上没有独占访问、也没有 ` libatomic `， 那"领号"这一步到底怎么写？答案其实比 ` __atomic_* ` 老得多：  **关中断 → 读-改-写 → 恢复中断** 。 下面这份文件就是 M0 上的那一版，一共一个函数。

 

atomic\_m0\_safe.c — 没有 LDREX/STREX 的核上，领号这一步这么写 C

 

```text
/* atomic_m0_safe.c — 没有 LDREX/STREX 的核上，"领号"这一步怎么写
 *
 * 上面那份 atomic_ops.c 在 M0 上【编得过、链不过】—— 这是这一节的核心结论。
 * 那 M0 上到底该怎么办？答案不是"换一个更基础的原子函数"（工具链里根本没有），
 * 而是回到最老的办法：关中断 → 读-改-写 → 恢复中断。
 *
 * 实测环境：GCC 13.3.1、-O2、cortex-m3 与 cortex-m0（两份核都能链过）。
 */
#include <stdint.h>

typedef struct {
  volatile uint32_t head;
  volatile uint32_t tail;
} mp_rb_t;

uint32_t rb_claim_primask(mp_rb_t *rb)
{
  uint32_t primask, h;
  __asm__ volatile ("mrs %0, primask" : "=r" (primask));   /* 先存下旧值 */
  __asm__ volatile ("cpsid i" ::: "memory");               /* 关中断 */
  h = rb->head;
  rb->head = h + 1u;                                       /* 这三行现在是一体的 */
  __asm__ volatile ("msr primask, %0" :: "r" (primask) : "memory");
  return h;
}
```

 

它在两款核上的反汇编，值得逐条看一遍：

 

**bash**  — 同一份文件在两款核上的反汇编：条数一样，编码形式不同

 

```text
$ arm-none-eabi-objdump -d safe-m3.o

safe-m3.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <rb_claim_primask>:
   0:	4603      	mov	r3, r0
   2:	f3ef 8210 	mrs	r2, PRIMASK   ← mrs r2, PRIMASK：先把"中断现在是开是关"存下来
   6:	b672      	cpsid	i   ← cpsid i：关中断
   8:	6800      	ldr	r0, [r0, #0]   ← 从这一条到 msr 之间是一体的，中断插不进来
   a:	1c41      	adds	r1, r0, #1
   c:	6019      	str	r1, [r3, #0]
   e:	f382 8810 	msr	PRIMASK, r2   ← msr PRIMASK, r2：写回进来时的原值，不是无条件开中断
  12:	4770      	bx	lr
$ arm-none-eabi-objdump -d safe-m0.o

safe-m0.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <rb_claim_primask>:
   0:	0003      	movs	r3, r0   ← M0 侧只有这一条和 M3 不同：movs 是 16 位形式（M3 那边是 mov）
   2:	f3ef 8210 	mrs	r2, PRIMASK
   6:	b672      	cpsid	i
   8:	6800      	ldr	r0, [r0, #0]
   a:	1c41      	adds	r1, r0, #1
   c:	6019      	str	r1, [r3, #0]
   e:	f382 8810 	msr	PRIMASK, r2
  12:	4770      	bx	lr
```

 

| 对比项 | ` LDREX ` / ` STREX `（M3 起） | 关中断（M0 只能这样） |
| --- | --- | --- |
| 谁提供这个能力 | ARMv7-M 的 **独占访问指令** （` LDREX ` / ` STREX `，核里的硬件） | ` PRIMASK ` 寄存器 \+ ` cpsid i ` —— 属于基础系统控制， **M0 上也有** |
| 实测条数（M3 / M0） | 8 条 / 链不过 | 8 条 / 8 条 |
| 对中断延迟的影响 | **不关中断** 。代价是 ` STREX ` 可能失败、要重试，重试次数不确定 | **关中断** 。延迟 = 临界区长度，就那么几条指令，是确定的 |
| 能不能嵌套调用 | 天然可以：没有"状态"要保存，独占监视器是核的隐式状态 | 要显式保存/恢复 ` PRIMASK ` 才嵌套得对（见上面那张表） |
| 适合的场景 | 多主竞争（另一个核、DMA 也会改同一块内存）、临界区偏长 | 单核、临界区只有几条指令 —— 也正是 M0 上唯一的选择 |

 

⚠ 恢复现场必须用 ` mrs `/` msr PRIMASK `，不能用 ` __enable_irq() `

 

这是本节最容易写错的一处，而且错了以后 **大部分时候还是对的** 。 CMSIS 提供的 ` __disable_irq() ` / ` __enable_irq() ` 是一对"无条件开着/无条件关掉"的宏， 而上面这段代码用的是 **"先存下旧值、最后原样写回"** 。 差别在嵌套的时候才暴露：

 

| 写法 | 单层调用 | 外层已经在临界区里时 |
| --- | --- | --- |
| ` __disable_irq() ` … ` __enable_irq() ` | 正确 | **错误** ：内层退出时无条件开中断，把外层的临界区一起打开了 |
| ` mrs ` 存旧值 … ` msr ` 写回 | 正确 | 正确：写回的是"进来时是什么样"，外层继续保持关中断 |

 

代价是两条指令（` mrs ` / ` msr `）， 换来的性质是"这段临界区可以嵌套"。 这类"单层对、多层错"的 bug 在单测里通常测不出来 —— 只有当中断处理函数里也调用同一个函数时才炸， 而那一刻的现象是"偶发丢一个数"，离原因非常远。

 

最后是那个"编译期就能问清楚"的办法。C11 的 ` _Static_assert ` 配 ` __atomic_always_lock_free `， 可以在 **编译阶段** 就问出"这个核上 4 字节原子操作锁不锁得住"， 而不必等到链接器报未定义符号：

 

麻烦在于： **这份文件在 M0 上本来编不过，上面那段红字也就无从出现**  —— 源码里那句断言裹在 ` #if (__ARM_ARCH >= 7) ` 里， M0 上它整段被跳过，于是编译"成功"、失败推迟到链接。 想看那句断言真红一次，就得把 ` #if ` 让开。 下面两条命令都加了 ` -DNO_ATOMIC_GUARD `， 也就是 **把两道核放在同一个条件下** 比 —— M3 上它照旧成立（退出码 0、无输出）， M0 上它当场变成一条编译错误：

 

**bash**  — 同一句断言、同一个 ` -DNO_ATOMIC_GUARD `，只换 ` -mcpu `：M3 通过，M0 报静态断言失败

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -O2 -DNO_ATOMIC_GUARD -c atomic_ops.c -o /dev/null

（无任何输出，退出码 0）
$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -Wall -Wextra -O2 -DNO_ATOMIC_GUARD -c atomic_ops.c -o /dev/null

atomic_ops.c:65:1: error: static assertion failed: "no lock-free 4-byte atomics on this core"
   65 | _Static_assert(__atomic_always_lock_free(4, 0),
      | ^~~~~~~~~~~~~~
```

 

◆ 把 §6.7 那句没说完的话补完

 

§6.7 结尾给的建议是"用硬件原子寄存器（BSRR / W1TS），或改用原子指令 ` __atomic_fetch_add `"。现在可以把后半句说得准确一点：

 

 
- 在 **有独占访问的核** 上（M3 / M4 / M7、以及 ESP32 的 Xtensa）， ` __atomic_* ` 是一条正路： 它展开成 ` LDREX ` / ` STREX ` 循环，  **不加锁、不关中断** ，因此不会拉长中断延迟。
 
- 在 **M0 / M0\+ 这类核上** ，它是一条死路： 编译器降级出来的符号在工具链里不存在，链接直接失败。 这时候要么换成"关中断 \+ 读-改-写"， 要么干脆 **把共享状态改成单写者** （§6.7 的 SPSC 环形缓冲区就是这条思路： 只有生产者写 ` head `、只有消费者写 ` tail `， 于是根本不需要原子加法）。
 

 

所以 **"用不用原子操作"这个问题的答案，取决于你选的那款核有没有那条指令** 。 这也是为什么本节要花这么大力气去数指令条数 —— 这些结论不能靠"我印象里 M0 好像也可以"来定， 它们的表现形式就是"能不能链过"，而这件事只能量。

  

◆ 本章要点

 

 
- 位操作五件套： **置位 ` |= `，清零 ` &= ~ `，翻转 ` ^= `，读取 ` & `，写字段"先清后写"** 。
 
- 写多 bit 字段 **必须"清掩码 \+ 写值"** ，不能只 ` |= `。
 
- 永远用 ` 1UL ` 而不是 ` 1 ` 做移位；` MASK_BITS(32) ` 必须特判。
 
- 位带让 bit 操作变成单条原子 ` str `，但 **它只是 M3 / M4 这两款实现的额外功能，M7 起 ARM 就不再提供了** 。
 
- 位域描述硬件寄存器是 **反模式** ：位序、原子性、可移植性都有问题。用掩码宏。
 
- 读-改-写竞态是 **最隐蔽的 bug 类型** 。` volatile ` 不解决它。 **用 BSRR/W1TS 这类硬件原子寄存器** 。
 
- STM32 GPIO 三步： **开时钟 → 配 CRH/CRL → 用 BSRR 操作** 。在常见失败原因里，忘开时钟排第一。
 
- ESP32 用 ` REG_WRITE(GPIO_OUT_W1TS_REG, ...) `，思路和 BSRR 完全一致；但要额外配 IO\_MUX，且注意双核并发。
 
- 环形缓冲区用 **位与代替取模**  \+  **无符号减法处理回绕**  \+  **SPSC 无锁设计** ，是嵌入式最经典的组合技巧。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 简答：为什么点灯/改引脚优先用 BSRR，而不是"读 ODR、改一位、写回"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"BSRR 是 **只写、单次写原子** 的置位/复位寄存器，一次写就能改定位而不影响其它位。 **\"读 ODR→改位→写回\"是读-改-写** ，中断插在中间就会丢失或抵消别的修改——这是最隐蔽的一类竞态。"}
   ```
 
2. 判断：位带（bit-band）能实现"原子翻转"吗？像 ` ^= 1 ` 那样？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**不能。** Cortex-M 没有\"位带异或\"；对位带别名地址做 ` ^= 1 ` 仍然是\"读别名→异或→写别名\"的读-改-写，照样有窗口。位带能原子保证的是 **对单个别名的普通读/写** （` =1 `/` =0 `），不是翻转。"}
   ```
 
3. 简答：为什么"用位域描述硬件寄存器"是反模式？列出至少两条理由。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① 位域布局（分配方向、跨存储单元）是 **实现定义** 的，换个编译器/端序就可能变；② 位域 **不可取地址** ，也无法保证单次访问的原子性（` -fstrict-volatile-bitfields ` 之外情形要小心）；③ 表达力不如掩码宏。 **用显式掩码宏 FIELD\\_GET/SET。**"}
   ```
 
4. 找错：` uint32_t m = 1 << 31; ` 有问题吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"有。` 1 ` 是 ` int `，左移 31 位进入符号位是 **有符号溢出（UB）** 。应写 ` 1UL << 31 `（或用 ` BIT(31) ` 宏，注意宏内部也要用无符号常量）。"}
   ```
 
5. 简答：` __atomic_* ` 内建在 Cortex-M0 上能链接通过吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**编译能过、链接常常过不了。** M0 没有 ` LDREX/STREX `，` __atomic_fetch_add ` 之类的 lock-free 实现需要 ` libatomic ` 或 libgcc 里的原子辅助函数；裸工具链上若没有这些符号，就是一片 ` undefined reference `。M0 上共享计数应改用 **关中断临界区** 或软件序列。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  试试不用 HAL，用寄存器让板载 LED 闪起来。

 

```zhizhan-assessment
{"id":"course-b01-ch6","criterion":"为普通位域与 W1C 寄存器选择不同写法；用正确位宽掩码且不读改写清除其他事件。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 N1570 · 对象、类型与语言语义](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) · [ST RM0008 · 外设地址与寄存器语义](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
