# constexpr 与编译期计算

```zhizhan-anchor
m03
```



C 里生成一张查找表，要么手抄、要么写脚本生成、要么运行时初始化。C\+\+ 把它们统一成一件事：  **让计算发生在编译期，Flash 里只留结果表** 。这一节讲 ` constexpr `/` consteval `/` constinit `， 以及它们带来的真实账单。

 

> ◷ 约 60 分钟 · ◈ CRC 查表编译期生成 · ⚑ 零运行时开销的典范

 

```zhizhan-anchor
m03-1
```



## 3.1 把计算搬到 Flash 里

 

嵌入式最经典的一类优化是" **空间换时间** "：CRC、三角、对数、Gamma 校正……都预先算成一张表，运行时只查表。 C 的问题在于"表从哪来"：手抄容易错、脚本生成要额外工具、运行时初始化又要占启动时间与 RAM。

 

| 表的来源 | 做法 | 代价 |
| --- | --- | --- |
| 手抄进源码 | 把 256 个常数粘贴进去 | 易错、难维护、评审困难 |
| 脚本生成 | Python/Excel 生成 .c 文件 | 引入构建步骤与"生成物是否入库"的管理问题 |
| 运行期初始化 | 启动时算一遍填进 RAM 数组 | 占 RAM、占启动时间；表大时很亏 |
| **C\+\+ constexpr** | 写一个 **普通函数** ，加 ` constexpr `，让它 **在编译期求值** | 表进 ` .rodata `（Flash）；源码即算法，可测、可读 |

 

```zhizhan-anchor
m03-2
```



## 3.2 一个 ` consteval ` 的 CRC8 表

 

` constexpr ` 是" **可以在** 编译期求值"；` consteval `（C\+\+20）更强： **必须** 在编译期求值，否则直接编译失败。 编译期生成查找表用 ` consteval ` 最贴切 —— 它保证这张表绝不会在运行时被重新计算。

 

crc\_table.cpp — 表在编译期生成，运行时只查表 C\+\+

 

```text
// crc_table.cpp —— 同一份"算法"，编译期跑一遍生成表
#include <cstdint>
#include <array>

// consteval：保证这张表只能在编译期算出来（写错成运行时一律编译失败）
consteval std::array<uint8_t, 256> make_crc8_table() {
    std::array<uint8_t, 256> t{};
    for (int i = 0; i < 256; i++) {
        uint8_t c = (uint8_t)i;
        for (int b = 0; b < 8; b++)
            c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
        t[i] = c;
    }
    return t;
}

// 表落进 .rodata（Flash），不占 RAM、不需要运行时初始化
inline constexpr auto CRC8_TABLE = make_crc8_table();

uint8_t crc8(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) c = CRC8_TABLE[c ^ *d++];
    return c;
}
```

 

crc\_bit.cpp — 对照：不查表、逐位算 C\+\+

 

```text
// crc_bit.cpp —— 不建表，每个字节多算 8 次位运算
#include <cstdint>

uint8_t crc8_bitwise(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) {
        c ^= *d++;
        for (int i = 0; i < 8; i++)
            c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
    }
    return c;
}
```

 

crc\_runtime.cpp — 对照二：C 的老路子，表放 RAM、启动时算一遍 C\+\+

 

```text
// crc_runtime.cpp —— 同一份算法，但表放在 RAM，等启动时填
#include <cstdint>

static uint8_t s_table[256];   // .bss：256 字节 RAM，等 crc8_init() 来填

void crc8_init() {             // 启动流程里调用一次
    for (int i = 0; i < 256; i++) {
        uint8_t c = (uint8_t)i;
        for (int b = 0; b < 8; b++)
            c = (uint8_t)((c << 1) ^ ((c >> 7) ? 0x07 : 0));
        s_table[i] = c;
    }
}

uint8_t crc8_rt(const uint8_t* d, uint32_t n) {
    uint8_t c = 0;
    while (n--) c = s_table[c ^ *d++];
    return c;
}
```

 

✔ 本机实测账单（` -Os -std=c++20 `，` .o ` text 字节）

 

**查表版 = 288 字节** （其中表本身 ` .rodata.CRC8_TABLE ` 占  **0x100 = 256 字节** ）；  **逐位版 = 48 字节** 。 也就是说： **净增约 240 字节 Flash（288 − 48）换来"每字节只查一次表"** ，其中表本身 256 字节，而查表版代码比逐位版还少 16 字节 —— CRC 常在收包热路径上，这笔交易通常划算。  *关键是：这 256 字节是 **编译期算好直接放进 Flash 的** ，不占 RAM、不占启动时间，源码里也没有那 256 个魔法常数。*

 

作为对照，C 里最常见的"启动时建表"写法（下面第三个文件 ` crc_runtime.cpp `）确实更省 Flash—— 但那 256 字节 **并没有消失** ，它只是从 Flash 挪进了 RAM 的 ` .bss `，另外还要搭上一段启动代码。 三种写法的账单见  **FIG 3.1**  与下面的实测。

 

⚠ "启动时建表"还藏着一个正确性陷阱

 

` crc8_rt() ` 依赖 ` s_table `；若 ` crc8_init() ` 没被调用（或调用次序不对）， ` .bss ` 初值全 0，查表会 **静默返回错误的 CRC**  —— 不崩、不报错，最难查。 走这条路务必：① 在启动流程里明确、且 **先于任何使用** 地调用 ` crc8_init() `； ② 用一个"是否已初始化"的标志/断言兜底；③ 双核（如 ESP32）或中断里并发调用时 ` s_table ` 会被撕裂，需临界区或改用编译期表。 而这正是 ` consteval ` 一次性消除的问题：表在 Flash 里、天生只读、无需初始化。

 

**bash**  — 复跑：` bash tools/probes/m03.sh `（查表 vs 逐位；表确实进了 .rodata）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c crc_bit.cpp   -o crc_bit.o
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c crc_table.cpp -o crc_table.o
$ arm-none-eabi-size crc_bit.o crc_table.o
   text    data     bss     dec     hex filename
     48       0       0      48      30 crc_bit.o
    288       0       0     288     120 crc_table.o
$ arm-none-eabi-objdump -h crc_table.o | grep rodata
  4 .rodata.CRC8_TABLE 00000100  00000000  00000000  0000005c  2**0
# 多出来的 240 字节 = 这张 256 字节的表（0x100）；它落在 .rodata（Flash），
# .data 与 .bss 都是 0 —— 说明没有任何运行时初始化，也没有占 RAM。
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c crc_runtime.cpp -o crc_runtime.o
$ arm-none-eabi-size crc_bit.o crc_table.o crc_runtime.o
   text    data     bss     dec     hex filename
     48       0       0      48      30 crc_bit.o
    288       0       0     288     120 crc_table.o
     84       0     256     340     154 crc_runtime.o
$ arm-none-eabi-nm --print-size --demangle --size-sort crc_runtime.o
00000034 00000020 T crc8_rt(unsigned char const*, unsigned long)
00000000 00000034 T crc8_init()
00000000 00000100 b s_table
# 第三行是"表放 RAM"那条路：Flash 只要 84 字节（比查表版少 204），
# 代价是 256 字节 .bss 进了 RAM，外加启动时跑一次 crc8_init()
# —— 那 52 字节（0x34）指令要转 256×8 = 2048 轮内层位运算。
```

 

**FIG 3.1**  同一份"生成表"的算法，三种写法的资源位置对比 （三种都真编了，读数出自 ` arm-none-eabi-size -A `）

 

```zhizhan-figure
<svg viewBox="0 0 660 292" role="img" aria-label="逐位计算 / constexpr 查表 / 运行期建表 三种写法的 Flash 与 RAM 占用对比，以及各自的计算发生时间段">
          <!-- 表头 -->
          <text x="128" y="38" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">① 逐位计算</text>
          <text x="346" y="38" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--grn)">② constexpr 查表</text>
          <text x="564" y="38" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">③ 运行期建表</text>

          <!-- Flash 行 -->
          <text x="52" y="63" class="sv-lbl-dim" text-anchor="end">Flash</text>
          <rect x="60" y="50" width="19" height="18" rx="3" class="sv-cyn-s"></rect>
          <text x="85" y="63" class="sv-lbl-hi">48 B</text>
          <rect x="278" y="50" width="13" height="18" rx="3" class="sv-grn-s"></rect>
          <rect x="291" y="50" width="102" height="18" rx="3" class="sv-cyn-s"></rect>
          <text x="399" y="63" class="sv-lbl-hi">288 B</text>
          <rect x="496" y="50" width="34" height="18" rx="3" class="sv-amb-s"></rect>
          <text x="536" y="63" class="sv-lbl-hi">84 B</text>

          <!-- RAM 行 -->
          <text x="52" y="95" class="sv-lbl-dim" text-anchor="end">RAM</text>
          <text x="60" y="95" class="sv-lbl-hi">0 B</text>
          <text x="88" y="95" class="sv-lbl-dim">不占 RAM</text>
          <text x="278" y="95" class="sv-lbl-hi">0 B</text>
          <text x="306" y="95" class="sv-lbl-dim">不占 RAM</text>
          <rect x="496" y="82" width="102" height="18" rx="3" class="sv-red-s"></rect>
          <text x="604" y="95" class="sv-lbl-hi" style="fill:var(--red)">256 B</text>

          <!-- 启动成本 -->
          <text x="52" y="127" class="sv-lbl-dim" text-anchor="end">启动时</text>
          <text x="60" y="127" class="sv-lbl-dim">无</text>
          <text x="278" y="127" class="sv-lbl-dim">无（编译器算完）</text>
          <text x="496" y="127" class="sv-lbl-dim" style="fill:var(--amb)">跑 52 B 指令 · 2048 轮</text>

          <!-- 每次调用 -->
          <text x="52" y="153" class="sv-lbl-dim" text-anchor="end">每次调用</text>
          <text x="60" y="153" class="sv-lbl-dim">8 次位运算 / 字节</text>
          <text x="278" y="153" class="sv-lbl-dim">1 次查表 / 字节</text>
          <text x="496" y="153" class="sv-lbl-dim">1 次查表 / 字节</text>

          <line x1="16" y1="172" x2="644" y2="172" class="sv-dash"></line>

          <!-- 时间轴 -->
          <text x="16" y="194" class="sv-lbl-hi">同一份算法，算在哪一段时间？</text>
          <line x1="40" y1="250" x2="640" y2="250" class="sv-arrow"></line>

          <!-- ① 编译期 -->
          <path d="M80 246 L80 232 L300 232 L300 246" fill="none" stroke="var(--grn)" stroke-width="1.6"></path>
          <text x="80" y="224" class="sv-lbl" style="fill:var(--grn)">① 编译器在这里算完，结果直接写进 Flash</text>

          <!-- ② 启动 -->
          <path d="M400 246 L400 232 L450 232 L450 246" fill="none" stroke="var(--amb)" stroke-width="1.6"></path>
          <text x="400" y="224" class="sv-lbl" style="fill:var(--amb)">② CPU 启动时才算</text>

          <!-- 刻度 -->
          <line x1="110" y1="242" x2="110" y2="258" stroke="var(--line-2)"></line>
          <line x1="260" y1="242" x2="260" y2="258" stroke="var(--line-2)"></line>
          <line x1="420" y1="242" x2="420" y2="258" stroke="var(--line-2)"></line>
          <line x1="580" y1="242" x2="580" y2="258" stroke="var(--line-2)"></line>
          <text x="110" y="274" class="sv-lbl-dim" text-anchor="middle">编译期</text>
          <text x="260" y="274" class="sv-lbl-dim" text-anchor="middle">链接</text>
          <text x="420" y="274" class="sv-lbl-dim" text-anchor="middle">启动</text>
          <text x="580" y="274" class="sv-lbl-dim" text-anchor="middle">运行</text>
        </svg>
```

 

② 的 Flash 条画成两截： **浅绿 32 字节是 ` crc8() ` 的代码** ，  **青色 256 字节是 ` .rodata.CRC8_TABLE `** ——表是 **数据** ，所以它只进 Flash，永远不进 RAM。 ③ 是最容易被误判划算的一条：Flash 只花 84 字节（比 ② 少 204），但省下的不是消失了，而是 **搬家** 了—— ` .bss ` 多 256 字节 RAM，而且要多背 52 字节的 ` crc8_init() `， 它需要在启动流程里被调用一次（通常由 ` main ` 之前的启动代码调用），跑完 2048 轮位运算。 **RAM 比 Flash 金贵得多** （MCU 上 Flash 常是 RAM 的 4–8 倍）， 所以这笔"省 Flash"的交易在多数板子上是亏的；② 之所以赢，是因为它把这段计算挪到了 ① 那一段时间里，由 **编译器** 替你付掉。

 

```zhizhan-anchor
m03-3
```



## 3.3 ` constexpr ` 寄存器视图 \+ ` static_assert `

 

第①册用 ` offsetof + _Static_assert ` 把寄存器偏移钉进编译期。C\+\+ 里这套照旧，而且 ` constexpr ` 还能把"位域描述"也变成编译期常量，供 ` static_assert ` 校验。

 

regs.hpp — 寄存器偏移与位域，全在编译期校验 C\+\+

 

```text
// regs.hpp —— constexpr 描述 + static_assert 把手册钉进代码
#include <cstdint>
#include <cstddef>

struct gpio_regs {
    volatile uint32_t crl;    // 0x00
    volatile uint32_t crh;    // 0x04
    volatile uint32_t idr;    // 0x08
    volatile uint32_t odr;    // 0x0C
    volatile uint32_t bsrr;   // 0x10
};

// 编译期断言：布局一旦被改动，这里立刻报错（不用等运行期）
static_assert(offsetof(gpio_regs, odr)  == 0x0Cu, "ODR 偏移应为 0x0C");
static_assert(offsetof(gpio_regs, bsrr) == 0x10u, "BSRR 偏移应为 0x10");

// constexpr：把"位号/宽度"写成编译期常量，运行时零成本
struct Field { uint8_t pos; uint8_t width; };
constexpr Field CRL_MODE0{0, 2};        // CRL 里每个引脚低 2 位是 MODE
constexpr Field CRL_CNF0 {2, 2};        // 高 2 位是 CNF
constexpr uint32_t field_mask(Field f) { return ((1u << f.width) - 1u) << f.pos; }
static_assert(field_mask(CRL_MODE0) == 0x3u, "MODE 掩码应为 0x3");
static_assert(field_mask(CRL_CNF0)  == 0xCu, "CNF 掩码应为 0xC");

// constinit（C++20）：要求"常量初始化"，从根本上消除跨 TU 的动态初始化顺序问题
constinit uint32_t g_error_count = 0;
```

 

◆ constexpr / consteval / constinit 一句话区分

 

 
- ` constexpr `： **可以** 在编译期求值（也可在运行期）——"能省则省"。
 
- ` consteval `： **必须** 在编译期求值——用它来强制"这张表/这个常量绝不可能是运行期算的"。
 
- ` constinit `：要求变量做 **常量初始化** （constant initialization，在 ` main ` 前由编译器/加载器完成）。它与"动态初始化" **互斥** ，因此 **根本不存在跨 TU 的动态初始化顺序问题（SIOF）** 。它 **不** 代表不可改——可以配合可变变量。

 

⚠ 为什么需要 ` constinit `：一个 SIOF 反例

 

两个 TU 各有一个全局对象，构造顺序 **由链接器决定、标准不保证** ： ` a.cpp ` 里 ` extern int g_limit; ` 的构造函数读 ` g_limit `， 而 ` b.cpp ` 里 ` int g_limit = 100; ` —— 若 ` a ` 的构造函数先跑，就读到 0。 把 ` g_limit ` 写成 ` constinit int g_limit = 100; `，它就被强制常量初始化、在 **任何** 动态构造之前就绪，问题消失。   
 *边界：` constinit ` 要求初始化器本身是 **常量表达式** （类类型需要 ` constexpr ` 构造）；它 **不适用于函数局部静态** ，也不改变可写性。*

 

✔ 两个容易忽略的细节：` inline ` 与"实体化"

 

 
- **为什么写 ` inline constexpr auto CRC8_TABLE `** ：` constexpr ` 的命名空间作用域变量默认有 **内部链接** ，每个包含它的 TU 都会各存一份；加 ` inline `（C\+\+17）后它是 **唯一实体** ，多个 TU 共享同一份、不重复占 Flash。
 
- **` constexpr ` ≠ 不进存储** ：只要表被 **运行期代码** 引用（哪怕只取地址），编译器就必须为它开出实体（本例就是 ` .rodata ` 里的 256 字节）；只有"纯在常量表达式里用、从不被运行期触碰"的 ` constexpr ` 变量才可能完全不进镜像。
 
- **为什么用 ` std::array ` 而不是 C 数组** ：` std::array ` 可被 ` constexpr ` 函数 **按值返回** 、能整体拷贝/比较，且 ABI 上与 C 数组 **完全等价** （零额外开销）；原始指针不行，` std::span ` 是运行期视图、不能用于常量表达式返回。

 

```zhizhan-anchor
m03-4
```



## 3.4 边界：constexpr 不是万能的

 

| 想做的事 | 能编译期做吗 | 替代 |
| --- | --- | --- |
| 整数运算、数组、查表 | 能 | — |
| ` new/delete `、堆分配 | 不能\* | 改用固定大小数组 / ` std::array ` |
| 访问硬件寄存器（` volatile `） | 不能† | 常量表达式 **不允许读/写 volatile 左值** ；但把寄存器 **地址** 写成常量指针是允许的。硬件值只能在运行期读，编译期只描述"偏移/位号" |
| 浮点常量（多数情况） | 能 | 注意与运行期浮点结果的位级差异 |
| ` reinterpret_cast ` 双关 | 不能 | 运行期做，或改用 ` memcpy ` 语义 |

 

\*严格说 C\+\+20 起 ` constexpr new ` 是允许的，但要求"编译期分配、编译期释放"，对 MCU 的表生成没什么用，且容易踩运行时语义，本册不推荐。

 

```zhizhan-anchor
m03-5
```



## 3.5 编译期 vs 运行期：怎么选

 

**FIG 3.2**  constexpr 把计算搬到编译期

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="能在编译期算的常量放 Flash，运行期只读，省 RAM、省时间">
          <rect x="30" y="40" width="170" height="50" rx="6" class="sv-grn-s"></rect>
          <text x="115" y="62" class="sv-lbl-hi" text-anchor="middle">constexpr</text>
          <text x="115" y="81" class="sv-lbl-dim" text-anchor="middle">编译期常量（Flash）</text>
          <path d="M200 65 L250 65" class="sv-arrow"></path>
          <rect x="252" y="40" width="170" height="50" rx="6" class="sv-amb-s"></rect>
          <text x="337" y="62" class="sv-lbl-hi" text-anchor="middle">运行期 const</text>
          <text x="337" y="81" class="sv-lbl-dim" text-anchor="middle">只读，但值在运行期确定</text>
          <text x="530" y="60" class="sv-lbl-dim" text-anchor="middle">查表/换算尽量</text>
          <text x="530" y="80" class="sv-lbl-hi" text-anchor="middle">放到编译期</text>
        </svg>
```

 

` constexpr ` 保证编译期求值；` const ` 只是"不可改"，不保证何时求值。

 

| 关键字 | 求值时机 | 放哪 | 能不能当数组长度 |
| --- | --- | --- | --- |
| ` constexpr ` | 编译期 | Flash / 立即数 | 能 |
| ` const ` | 运行期或编译期 | 视情形 | 不一定 |
| ` #define ` | 预处理替换 | 无类型 | 能（但无类型检查） |
| ` constinit ` | 静态初始化期 | — | — |

 

| 场景 | 推荐 |
| --- | --- |
| 数学常量 π/换算系数 | ` constexpr ` |
| 寄存器地址常量 | ` constexpr ` 或 ` #define ` |
| 运行期可配阈值 | 运行期变量（可存 Flash/[NVS](term:nvs)） |
| 编译期查表 | ` constexpr ` 生成表 |

 

◆ 迁移练习

 

把一段"运行期循环算出来的查找表"改成 ` constexpr ` 编译期生成，比较改前改后的 RAM 占用与启动时间。

 

◆ 本章要点

 

 
- ` constexpr ` 让"生成表"的代码就是 **普通函数** ，表则由编译器在编译期算好放进 ` .rodata `（Flash）。
 
- 用 ` consteval ` 强制"必须编译期"，杜绝表在运行时被重算。
 
- 本机实测：CRC 查表版  **288 字节** （表占 256）vs 逐位版  **48 字节** ——空间换时间，且表不占 RAM、不占启动时间。
 
- "启动时建表"（` static ` 数组 \+ ` init() `）虽然只花  **84 字节**  Flash，却要付出  **256 字节 RAM**  和一段启动代码；能编译期算的，别留给启动。
 
- ` static_assert ` \+ ` offsetof ` 把寄存器布局钉进编译期，改错立刻报。
 
- ` constinit ` 解决"静态初始化顺序"问题，但它不等于不可变。
 
- constexpr  **不能** 访问硬件寄存器（` volatile `）、不能做运行期动态分配。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 判断：` constexpr ` 和 ` consteval ` 的区别是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` constexpr ` 表示\" **可以** 在编译期求值\"（也可运行期）；` consteval ` 表示\" **必须** 在编译期求值\"，否则编译失败。要保证\"这张表绝不在运行时算\"，用 ` consteval `。"}
   ```
 
2. 简答：编译期生成的查找表落在哪个段？占 RAM 吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"作为 ` constexpr `/` const ` 对象，它落在 ` .rodata `（Flash）， **不占 RAM** ，也 **不需要运行时初始化** 。本机实测 CRC 表就是一个 ` .rodata.CRC8_TABLE ` 段（0x100 字节）。"}
   ```
 
3. 填空：本机实测里，查表版比逐位版多花了约 \_\_\_\_\_\_ 字节 Flash，换来"每字节只查一次表"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"约  **240 字节** （查表版 288 vs 逐位版 48），其中表本身占 256 字节。CRC 常在热路径上，这笔交易通常划算。"}
   ```
 
4. 简答：` constinit ` 保证什么？它等于"不可修改"吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"保证变量的初始化是 **静态初始化** （在 ` main ` 前完成，不存在跨编译单元的动态初始化顺序问题）。它 **不** 保证变量不可修改——它约束的是\"何时初始化\"，不是\"能不能改\"。"}
   ```
 
5. 判断：能否用 ` constexpr ` 读一个硬件寄存器？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能。准确地说，常量表达式 **不允许读/写 ` volatile ` 左值** （哪怕它的地址是编译期常量）；把寄存器 **地址** 存成常量指针是允许的，但读它的值属于运行期行为。编译期能做的只是描述寄存器的 **偏移与位号** （` constexpr ` 常量 \\+ ` static_assert `）。"}
   ```
 
6. 选择题：一张 256 字节的查找表，用"启动时建表"（` static ` 数组 \+ ` init() `）比 ` consteval ` 生成省了 Flash，代价是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"代价是 **256 字节 RAM**  加一段启动代码。本机实测：` consteval ` 版 text 32 \\+ rodata 256 =  **288 B Flash / 0 B RAM** ；运行期建表版 text 84 / bss 256 =  **84 B Flash / 256 B RAM** 。表的字节数没有消失，只是从 Flash 搬到了 RAM——而 MCU 上 RAM 通常比 Flash 稀缺得多。"}
   ```
 
7. 预测：如果 ` CRC8_TABLE ` 只在 ` static_assert ` 里被用到（不被 ` crc8() ` 查表），它还占那 256 字节 Flash 吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不占。只要表从不被 **运行期代码** 引用（哪怕只取一次地址），编译器就可以只把它当编译期值、不为其开存储。本例因为 ` crc8() ` 真的查表，它才被实体化进 ` .rodata `。这就是\"` constexpr ` ≠ 一定进 Flash\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  把项目里一张"手抄/脚本生成"的查找表，改写成 ` consteval ` 生成。

 

```zhizhan-assessment
{"id":"course-b02-m03","criterion":"用 static_assert 验证编译期表，检查查表大小与目标二进制，不把 constexpr 当运行期性能保证。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
