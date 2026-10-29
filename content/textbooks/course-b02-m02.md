# 类、封装与 RAII

```zhizhan-anchor
m02
```



第①册 Module 07 用"不透明指针 \+ 成对的 ` init/deinit `"在 C 里模拟了封装。 C\+\+ 把这件事做成了语言的一部分： **构造即获取、析构即释放** 。 这一节讲清它替掉了什么、代价是什么，以及嵌入式里最该用它的两处。

 

> ◷ 约 75 分钟 · ◈ Rule of 0/3/5 · ⚑ 全册最实用的一节

 

```zhizhan-anchor
m02-1
```



## 2.1 从"成对的调用"到"一对构造/析构"

 

C 里每个资源（GPIO、串口、锁、[DMA](term:dma) 通道）都遵循同一套模式：` xxx_init() ` 获取、` xxx_deinit() ` 释放。 问题在于 **编译器不知道它们是一对** ：忘了 ` deinit `、提前 return、在两条分支里漏掉一条 —— 都不会报错，只会在运行期表现为"资源泄漏 / 外设不恢复"。

 

| C 的成对调用 | C\+\+ 的 RAII | 谁保证配对 |
| --- | --- | --- |
| ` gpio_init(&pin); ` … ` gpio_deinit(&pin); ` | 构造 ` GpioPin ` … 离开作用域自动析构 | 编译器（作用域退出时必调析构，含提前 return） |
| ` uint32_t s = enter_critical(); ` … ` exit_critical(s); ` | 作用域内建一个 ` IrqLock ` | 编译器 |
| 分配/释放缓冲区 | 一个持有者对象（含移动语义） | 编译器（对象销毁即释放） |

 

◆ RAII 的名字就是它的全部含义

 

**R** esource  **A** cquisition  **I** s  **I** nitialization： 把"获取资源"放进 **构造函数** 、把"释放资源"放进 **析构函数** 。 只要对象是栈上的局部变量， **任何\*\*正常\*\*的离开作用域（包括提前 ` return `）都会调用析构** 。  *注意"正常"二字 —— C\+\+ 里唯一能绕过析构的是 ` longjmp `/硬件异常这类"非正常退出"，而嵌入式正好常遇到它们（见 §2.6）。*

 

**FIG 2.1**  手动配对 vs RAII：遇到"提前 return"时谁还记得释放

 

```zhizhan-figure
<svg viewBox="0 0 660 230" width="660" height="230" role="img" aria-label="手动配对 vs RAII">
          <text x="18" y="44" class="sv-lbl-hi" style="fill:var(--txt-hi)">C · 手动配对</text>
          <rect x="18" y="56" width="86" height="34" rx="6" class="sv-grn-s"></rect>
          <text x="61" y="78" class="sv-lbl" text-anchor="middle">init()</text>
          <rect x="150" y="56" width="118" height="34" rx="6" class="sv-box"></rect>
          <text x="209" y="78" class="sv-lbl" text-anchor="middle">使用资源</text>
          <rect x="336" y="56" width="130" height="34" rx="6" class="sv-red-s" stroke-dasharray="5 4"></rect>
          <text x="401" y="78" class="sv-lbl" text-anchor="middle" style="fill:var(--red)">deinit() 缺失</text>
          <path d="M 104 73 L 146 73" class="sv-arrow"></path>
          <path d="M 268 73 L 332 73" class="sv-dash"></path>

          <line x1="300" y1="34" x2="300" y2="212" class="sv-dash"></line>
          <text x="306" y="30" class="sv-lbl-dim" style="fill:var(--amb)">提前 return 发生处</text>

          <text x="18" y="146" class="sv-lbl-hi" style="fill:var(--txt-hi)">C++ · RAII</text>
          <rect x="18" y="158" width="86" height="34" rx="6" class="sv-cyn-s"></rect>
          <text x="61" y="180" class="sv-lbl" text-anchor="middle">构造</text>
          <rect x="150" y="158" width="118" height="34" rx="6" class="sv-box"></rect>
          <text x="209" y="180" class="sv-lbl" text-anchor="middle">使用资源</text>
          <rect x="336" y="158" width="150" height="34" rx="6" class="sv-grn-s"></rect>
          <text x="411" y="180" class="sv-lbl" text-anchor="middle">~对象() 自动释放</text>
          <path d="M 104 175 L 146 175" class="sv-arrow"></path>
          <path d="M 268 175 L 332 175" class="sv-arrow"></path>
        </svg>
```

 

**C：** 提前 ` return ` 时若没手动调 ` deinit() `，资源就泄漏了——编译器不会提醒。  **C\+\+ RAII：** 只要对象是局部变量， **任何正常离开作用域** （含提前 ` return `）都会自动调用析构。

 

```zhizhan-anchor
m02-2
```



## 2.2 封装：不透明指针 vs 类

 

第①册的 C 版把结构体定义藏在 ` .c ` 里、头文件只留 ` typedef struct sensor sensor_t; `。 C\+\+ 的类默认就是这种"接口与实现分离"： **` private ` 成员对使用者不可见、不可直接访问** ，由编译器强制。

 

| 维度 | C 不透明指针 | C\+\+ 类 |
| --- | --- | --- |
| 隐藏实现 | 头文件只声明不完整类型，"藏"靠纪律 | ` private `，编译器强制 |
| 访问控制 | 无；任何人可读写结构体字段 | 有；越权访问直接编译报错 |
| 初始化 | 手动 ` xxx_init() `，易漏 | 构造函数保证"对象一旦存在就已初始化" |
| 内存布局 | 你说了算 | **由编译器/ABI 决定** （除非用标准布局类型并加断言） |
| 代价 | 零 | 零运行时开销；但布局不再完全可控，跨 ABI 要小心 |

 

```zhizhan-anchor
m02-3
```



## 2.3 RAII 包装一个 GPIO 引脚

 

下面左边是 C 的典型写法（` init `/` deinit ` 配对），右边是等价的 RAII 类。 注意 C\+\+ 版： **构造时配置、析构时恢复** ，而且 **拷贝被显式删除** （一个引脚不应该有两个"主人"）。

 

gpio\_c.c — C：手动配对，漏了就出问题 C

 

```text
/* gpio_c.c —— 谁调用 gpio_deinit，谁负责；编译器不检查 */
#include <stdint.h>
typedef struct {
    volatile uint32_t crl, crh, idr, odr, bsrr;   /* STM32F1 GPIO 寄存器 */
} gpio_regs_t;

static void gpio_init(gpio_regs_t *g, uint8_t pin, int as_output)
{
    if (!as_output) return;                       /* ✕ 早退分支漏掉"已初始化"的标记 */
    volatile uint32_t *cfg = (pin < 8u) ? &g->crl : &g->crh;
    const uint32_t sh = (pin & 7u) * 4u;
    *cfg = (*cfg & ~(0xFu << sh)) | (0x1u << sh);    /* CNF=00, MODE=01：通用推挽输出 */
}
static void gpio_deinit(gpio_regs_t *g, uint8_t pin)
{
    volatile uint32_t *cfg = (pin < 8u) ? &g->crl : &g->crh;
    const uint32_t sh = (pin & 7u) * 4u;
    *cfg &= ~(0xFu << sh);                           /* 复位为模拟输入 */
}
void use_gpio(gpio_regs_t *g, uint8_t pin, int fail_early)
{
    gpio_init(g, pin, 1);
    if (fail_early) return;                        /* ✕ 提前 return → 忘了 deinit */
    g->bsrr = (1u << pin);                         /* BSRR：单次写即置位，无需读改写 */
    gpio_deinit(g, pin);
}
```

 

gpio\_raii.hpp — C\+\+：构造获取、析构释放、禁拷贝 C\+\+

 

```text
// gpio_raii.hpp —— 把"配置一个引脚"变成一个对象的生命周期
#include <cstdint>

struct gpio_regs { volatile uint32_t crl, crh, idr, odr, bsrr; };   /* STM32F1 GPIO */

class GpioPin {
public:
    GpioPin(gpio_regs* r, uint8_t pin) noexcept : r_(r), pin_(pin) {}

    void as_output() noexcept {
        volatile uint32_t* cfg = (pin_ < 8u) ? &r_->crl : &r_->crh;
        const uint32_t sh = (pin_ & 7u) * 4u;
        *cfg = (*cfg & ~(0xFu << sh)) | (0x1u << sh);  // CNF=00, MODE=01
        owned_ = true;
    }
    void set(bool on) noexcept {
        // BSRR 低 16 位置位、高 16 位复位：单次写即原子，不必读改写 ODR
        r_->bsrr = on ? (1u << pin_) : (1u << (pin_ + 16u));
    }

    ~GpioPin() {
        if (owned_) {
            volatile uint32_t* cfg = (pin_ < 8u) ? &r_->crl : &r_->crh;
            const uint32_t sh = (pin_ & 7u) * 4u;
            *cfg &= ~(0xFu << sh);
        }
    }

    // 一个引脚只能有一个主人：拷贝被删除，回头要用"移动"（§2.5）
    GpioPin(const GpioPin&) = delete;
    GpioPin& operator=(const GpioPin&) = delete;

private:
    gpio_regs* r_;
    uint8_t    pin_;
    bool       owned_ = false;
};

void use_gpio(gpio_regs* r, uint8_t pin, bool fail_early)
{
    GpioPin p(r, pin);
    p.as_output();
    if (fail_early) return;      // ✔ 提前 return 也会调用 ~GpioPin()
    p.set(true);
}
```

 

✔ 代价与收益

 

**运行时代价≈0** ：` GpioPin ` 只是把 ` r_/pin_/owned_ ` 放在栈上，构造/析构就是几行寄存器操作（本例无虚函数）。  **收益是"不可能忘记释放"** ：编译器在每个离开作用域的路径上都替你插入析构调用 —— 这正是 C 版最常出错的地方。  *唯一要留意的是"是否内联"：` -O2 ` 下这条析构被内联，与手写调用体积相同；` -Os ` 下 GCC 可能保留一次调用（见下方探针第 5 步）。*

 

**bash**  — 复跑：` bash tools/probes/m02.sh `（Arm GNU Toolchain 13.3.1，cortex-m3；用 -O2 让析构内联）

 

```text
$ arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -O2 -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics -c gpio_raii.cpp -o gpio_raii.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -c gpio_c.c -o gpio_c.o
$ arm-none-eabi-size gpio_raii.o gpio_c.o
   text    data     bss     dec     hex filename
     76       0       0      76      4c gpio_raii.o
     68       0       0      68      44 gpio_c.o
# 同一功能：析构内联后，RAII 版只比 C 版多 8 字节（多一次"pin<8 选 CRL 还是 CRH"的判断）。

$ arm-none-eabi-objdump -d --demangle gpio_raii.o   # RAII 版 use_gpio
    2907        cmp     r1, #7                       # pin<8? 选 CRL/CRH
    b530        push    {r4, r5, lr}
    f04f 030f   mov.w   r3, #15                      # 4 位掩码 0xF
    f001 0c07   and.w   ip, r1, #7
    f8de 4000   ldr.w   r4, [lr]                     # 读 CRL/CRH
    ea4f 0c8c   mov.w   ip, ip, lsl #2               # sh = (pin&7)*4
    fa03 f30c   lsl.w   r3, r3, ip                   # mask = 0xF << sh
    ea24 0403   bic.w   r4, r4, r3
    fa05 fc0c   lsl.w   ip, r5, ip                   # ip = 1 << sh
    ea44 040c   orr.w   r4, r4, ip
    43db        mvns    r3, r3                       # r3 = ~mask（给析构复用）
    f8ce 4000   str.w   r4, [lr]                     # 写回 CRL/CRH：MODE=01
    b90a        cbnz    r2, 3e <use_gpio(+0x3e)>       # fail_early 分支
    408d        lsls    r5, r1                       # 正常路径：BSRR = 1 << pin
    6105        str     r5, [r0, #16]
    f8de 2000   ldr.w   r2, [lr]                     # ← 析构：两条路径都汇到这里
    4013        ands    r3, r2
    f8ce 3000   str.w   r3, [lr]                     #   *cfg &= ~mask
    bd30        pop     {r4, r5, pc}

$ arm-none-eabi-objdump -d --demangle gpio_c.o     # 手动配对版 use_gpio
    2907        cmp     r1, #7
    b570        push    {r4, r5, r6, lr}
    f04f 0c0f   mov.w   ip, #15
    f001 0307   and.w   r3, r1, #7
    682c        ldr     r4, [r5, #0]
    009b        lsls    r3, r3, #2
    fa0c fc03   lsl.w   ip, ip, r3
    ea24 0e0c   bic.w   lr, r4, ip
    fa06 f303   lsl.w   r3, r6, r3
    ea4e 0303   orr.w   r3, lr, r3
    602b        str     r3, [r5, #0]                  # 写回 CRL/CRH
    b92a        cbnz    r2, 40 <use_gpio(+0x40)>       # fail_early 分支
    408e        lsls    r6, r1                       # 只有正常路径写 BSRR、清配置位
    6106        str     r6, [r0, #16]
    682b        ldr     r3, [r5, #0]
    ea03 030c   and.w   r3, r3, ip
    602b        str     r3, [r5, #0]
    bd70        pop     {r4, r5, r6, pc}             # ← 提前 return 直接返回：CRL/CRH 从未恢复
```

 

⚠ 差别就在"提前 return 那条路径"

 

RAII 版的析构被内联成落在函数末尾的一小段， **正常路径与 ` fail_early ` 分支都会汇到那里清配置位**  （` cbnz r2, 3e ` 跳到 ` ldr.w r2,[lr] / ands / str.w ` 那三条）。 手动版在 ` fail_early ` 分支上是一条 ` cbnz r2, 40 ` → 直接 ` pop ` 返回，  **没写的那句 ` gpio_deinit() ` 编译器一声不吭** 。这就是 RAII 的全部价值：把"靠人记住"变成"编译器必须做"。   
 *注：本探针用 ` -O2 `；同一份源码在 ` -Os ` 下 GCC  **不内联这个析构函数** （会留一次 ` bl `）， RAII 版变成 106 字节、C 版 56 字节 —— 这多出来的字节来自优化等级，不是 RAII 本身（第 5 步实测）。*

 

```zhizhan-anchor
m02-4
```



## 2.4 Rule of 0 / 3 / 5：什么时候要自己写

 

一个类要不要自己写拷贝/移动/析构，取决于它 **是否直接管理资源** 。这条经验法则就叫 Rule of 0/3/5：

 

| 法则 | 适用 | 做法 |
| --- | --- | --- |
| **Rule of 0** | 类里 **不直接** 持有裸资源（只组合已有类型） | 什么都不写，让编译器生成—— **最理想的默认** |
| **Rule of 3** | 需要自定义析构（说明持有资源） | 析构 \+ 拷贝构造 \+ 拷贝赋值 **三者要么都写、要么都禁** |
| **Rule of 5** | 还想支持"搬走"资源 | 在 3 的基础上再加 **移动构造 \+ 移动赋值** |
| 只想禁拷贝 | 独占资源（引脚、锁、DMA 通道） | ` = delete ` 掉拷贝，需要传递时用移动 |

 

⚠ 最常见的坑：删了拷贝，却忘了"移动"

 

` = delete ` 掉拷贝构造后，这个类型就 **不能拷贝、也不能放进容器** （` vector ` 扩容要拷贝或移动）。 但要注意： **按值返回一个"纯右值"并不需要拷贝或移动**  —— C\+\+17 起保证复制省略（guaranteed copy elision）， ` return ByteStream(mem, cap); ` 是就地构造；只有"返回具名局部变量"（NRVO 不保证）才需要移动。 嵌入式里更常见的做法是： **让资源拥有者不被传递** （就地构造），或者给它一个明确的移动语义（下一节）。

 

✔ ` = default ` 与 ` = delete `：把"我要什么"写清楚

 

` = delete ` 明确 **禁掉** 某个特殊成员（如拷贝）；` = default ` 明确 **用编译器生成的默认实现** 。 两者都比"不写"更清楚： *不写* 时读者要猜"是默认了，还是漏了"。  
 三条最容易踩的 **相互抑制规则** ：

 

 
- 声明任一 **拷贝** 操作 → 另一个拷贝操作与两个 **移动** 操作都不再隐式声明；
 
- 声明任一 **移动** 操作 → 两个 **拷贝** 操作被隐式声明为 ` = delete `（仍参与重载，直接报错，而不是悄悄消失）；
 
- 声明 **析构函数**  → 两个 **移动** 操作不再隐式声明 —— 这正是"写了析构却忘了移动"的高频坑。
 

 

所以直接管理资源时，把 ` = default `/` = delete `  **逐条显式写出来** ，避免被抑制后得到意外行为。 注意 ` = default ` 只在 **能生成出正确语义** 时用；对直接管理裸资源的类，默认的按成员拷贝往往是错的（那才是 Rule of 3 要自己写的原因）。

 

```zhizhan-anchor
m02-5
```



## 2.5 移动语义：把资源"搬走"，而不是"复制"

 

移动（move）不是一个新东西，它是" **转移[所有权](term:ownership)** "的标准表达：源对象把资源交出去后进入"空"状态。 对固定缓冲/句柄来说，移动只需搬几个指针/长度， **不复制底层数据** 。

 

stream.hpp — 移动语义：移交缓冲所有权 C\+\+

 

```text
// stream.hpp —— 一个"拥有"一段缓冲的写入流；移动而不是拷贝
#include <cstdint>

class ByteStream {
public:
    ByteStream(uint8_t* buf, uint32_t cap) noexcept : buf_(buf), cap_(cap) {}

    // 移动：把 buf_/cap_/len_ 接管过来，把源置空
    ByteStream(ByteStream&& o) noexcept : buf_(o.buf_), cap_(o.cap_), len_(o.len_) {
        o.buf_ = nullptr; o.cap_ = 0; o.len_ = 0;
    }
    ByteStream& operator=(ByteStream&& o) noexcept {
        if (this != &o) {
            buf_ = o.buf_; cap_ = o.cap_; len_ = o.len_;
            o.buf_ = nullptr; o.cap_ = 0; o.len_ = 0;
        }
        return *this;
    }

    ByteStream(const ByteStream&) = delete;             // 独占：不许拷贝
    ByteStream& operator=(const ByteStream&) = delete;

    bool push(uint8_t b) noexcept { if (len_ >= cap_) return false; buf_[len_++] = b; return true; }
    uint32_t size() const noexcept { return len_; }
    bool valid() const noexcept { return buf_ != nullptr; }

private:
    uint8_t* buf_;
    uint32_t cap_;
    uint32_t len_ = 0;
};

// 用法：工厂函数"按值返回"一个流 —— 靠移动，没有数据拷贝
ByteStream make_stream(uint8_t* mem, uint32_t cap) {
    return ByteStream(mem, cap);        // C++17 起：保证省略拷贝（RVO/隐式移动）
}
```

 

◆ 移动语义在嵌入式里的意义

 

台式机上移动是为了"避免复制大对象"。在 MCU 上，它的价值更偏向 **表达所有权** ： 让"这段缓冲归谁"变成类型系统里的事实（只能有一个 ` ByteStream ` 持有它）， 从而在编译期排除"两个对象都想释放同一块内存"。这与第①册反复强调的"所有权清晰"是一回事。

 

```zhizhan-anchor
m02-6
```



## 2.6 析构不会在哪些情况下运行（嵌入式必读）

 

RAII 的保证建立在" **作用域正常退出** "之上。嵌入式中下面这些"非正常退出"会绕过析构，必须单独处理：

 

| 情形 | 析构会不会跑 | 后果 / 对策 |
| --- | --- | --- |
| 函数正常返回 / 提前 ` return ` | 会 | RAII 的主战场 |
| ` break `/` continue `/` goto ` 跳出作用域 | 会 | 编译器正确插入析构 |
| 异常抛出并沿栈展开（` -fexceptions `） | 会 | 但本册默认关异常（§1.3.1） |
| **HardFault / 未定义指令等硬件异常** | 不会 | 栈帧就地冻结，析构完全不执行 → 资源停留在中间态 |
| **` longjmp ` / 直接改 PC** | 不会 | 典型的"RAII 失效"场景 |
| 复位（看门狗/上电） | 不会 | 靠"上电自检 \+ 复位原因"恢复，而不是靠析构 |

 

◆ 析构顺序：后构造的先析构（嵌套 RAII 的基石）

 

 
- **局部对象** ：按构造的 **逆序** 析构（栈式）—— 先建的锁、外层缓冲最后才释放。
 
- **成员** ：按 **声明顺序的逆序** 析构（初始化是声明顺序，析构反过来；与构造函数的初始化列表书写顺序无关）。
 
- **基类** ：所有成员析构完之后，才析构基类。
 
- 收益：只要按"依赖关系"声明/构造， **销毁顺序自动正确**  —— 依赖者先建、后被销毁；被依赖者后建、先销毁。

 

✔ 嵌入式里的经典用法

 

先构造 ` IrqLock `（关中断）、再构造 ` SpiBus `（用总线抽数据）； 离开作用域时， **` SpiBus ` 先析构（总线用完），` IrqLock ` 后析构（再开中断）**  —— 这正是手写 ` exit_critical() ` 时最容易写反的顺序。

 

⚠ 推论：RAII 管"软件资源"，管不了"硬件异常与复位"

 

所以嵌入式里 RAII 用来说明" **正常控制流下的资源生命周期** "（引脚、锁、缓冲、会话）， 而" **断电/复位/崩溃后的恢复** "要靠第①册 Module 08 的那套机制（看门狗、复位原因、备份寄存器、上电自检）。  *两者分工明确，不能互相替代。*

 

**FIG 2.2**  RAII：构造即获取，析构即释放

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="对象进入作用域构造时获取资源，离开作用域自动析构释放">
          <rect x="30" y="40" width="140" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="100" y="68" class="sv-lbl-hi" text-anchor="middle">构造：上锁/开外设</text>
          <path d="M170 63 L220 63" class="sv-arrow"></path>
          <rect x="222" y="40" width="140" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="292" y="68" class="sv-lbl-hi" text-anchor="middle">使用资源</text>
          <path d="M362 63 L412 63" class="sv-arrow"></path>
          <rect x="414" y="40" width="150" height="46" rx="6" class="sv-red-s"></rect>
          <text x="489" y="68" class="sv-lbl-hi" text-anchor="middle">析构：解锁/关外设</text>
          <text x="330" y="120" class="sv-lbl-dim" text-anchor="middle">提前 return / 抛异常 / 故障跳出，析构都会运行</text>
        </svg>
```

 

RAII 把"配对操作"交给编译器，比人肉在每个返回点手动释放可靠得多。

 

| 手写成对调用 | RAII 封装 |
| --- | --- |
| 每个返回点都要记得释放 | 离开作用域自动释放 |
| 异常/故障路径易漏 | 栈展开时也会析构 |
| 代码分散、难审计 | 一对构造/析构，清晰 |
| C 里常见 bug 源 | C\+\+ 的强项 |

 

◆ 迁移练习

 

把你 C 代码里"上锁→临界区→解锁"的一段改成 RAII Guard 类，确认在任何提前返回路径下都能解锁。

 

◆ 本章要点

 

 
- **RAII = 构造获取 \+ 析构释放** ：把"成对的 ` init/deinit `"变成编译器保证的配对。
 
- 封装：C\+\+ 的 ` private ` 由 **编译器强制** ，取代了 C 里"靠纪律藏结构体"的做法。
 
- RAII 运行时 **代价≈0** ；收益是"任何正常退出路径都不会忘记释放"。
 
- Rule of 0 优先；直接持有资源时用  **Rule of 3/5** ；独占资源就 ` = delete ` 拷贝、用移动移交所有权。
 
- 析构 **不会** 在硬件异常、` longjmp `、复位时运行——嵌入式必须为这些路径单独设计恢复。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 简答：RAII 相比 C 的 ` init/deinit ` 配对，核心优势是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"把\"释放\"绑定到 **对象生命周期** 上：只要对象是栈局部变量， **任何正常离开作用域（含提前 ` return `）** 都会触发析构。这消除了 C 里最常见的\"某条分支忘了释放\"。"}
   ```
 
2. 判断：给一个类写了自定义析构，就可以不管拷贝构造/赋值了吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不行。写了析构通常意味着\"持有资源\"（Rule of 3）：要么同时定义/删除 **拷贝构造与拷贝赋值** ，要么用移动移交所有权（Rule of 5）。否则默认拷贝会制造\"两个对象指向同一资源\"的重复释放。"}
   ```
 
3. 填空：让一个 ` ByteStream ` 只能有一个主人，要 \_\_\_\_\_\_ 拷贝、提供 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**删除（` = delete `）** 拷贝构造与拷贝赋值；提供 **移动构造/移动赋值** 来转移所有权。"}
   ```
 
4. 简答：哪些"退出"会绕过析构？嵌入式怎么补救？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"硬件异常（HardFault 等）、` longjmp `/直接改 PC、复位都会绕过析构。补救靠第①册 Module 08 的机制：看门狗、复位原因、备份寄存器、上电自检——而不是靠 RAII。"}
   ```
 
5. 判断：RAII 一定会带来运行时开销（比如虚函数/堆分配）吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。像 ` GpioPin ` 这种 **无虚函数、栈上构造** 的类，构造/析构就是几条内联指令，运行时开销≈0。开销来自你选择实现 RAII 的方式（是否用虚函数、是否动态分配），不是 RAII 本身。"}
   ```
 
6. 诊断：` void f(gpio_regs* r, uint8_t pin){ GpioPin p(r,pin); p.as_output(); if (pin > 15) return; p.set(true); } ` 这段有两个问题，各是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① 逻辑上 ` as_output() ` 先执行、再判断 ` pin>15 `，而 ` as_output ` 里做了 ` 3u << (pin*2) ` —— ` pin>15 ` 时移位 ≥32，是  **UB** ；② 用\"业务合法性\"（pin 范围）当\"提前退出\"演示，掩盖了示例本意。正解：用独立的 ` fail_early ` 标志演示 ` return `，别把\"合法性检查\"和\"资源获取\"耦合。析构本身在两条路径上都会跑（RAII 正确）。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  挑一个你现在用 ` init/deinit ` 管理的资源，改成 RAII 类，删掉拷贝、加上移动。

 

```zhizhan-assessment
{"id":"course-b02-m02","criterion":"为外设句柄用 RAII 管理申请和释放，禁止复制唯一资源，构造失败不留下半初始化对象。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C\+\+ 工作草案（按示例标准核对）](https://eel.is/c++draft/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
