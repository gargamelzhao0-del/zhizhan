# 编译与链接全流程

```zhizhan-anchor
ch5
```



"编译报错"这四个字背后其实是四个完全独立的阶段。分清它们，你才能看懂绝大多数报错信息， 才能回答"为什么这个函数找不到""为什么固件这么大""为什么优化后行为变了"。

 

> ◷ 约 115 分钟 · ◈ 含 Makefile 与 CMake 实战 · ⚑ 能读懂链接错误

 

```zhizhan-anchor
ch5-1
```



## 5.1 从 .c 到 .elf：四个阶段

 

**FIG 5.1**  GCC 编译的四个阶段与产物

 

```zhizhan-figure
<svg viewBox="0 0 660 396" width="660" height="396" role="img" aria-label="编译四阶段">
          <defs>
            <marker id="ah10" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <!-- 源文件 -->
          <rect x="14" y="106" width="86" height="52" rx="6" class="sv-box" stroke="var(--txt-2)"></rect>
          <text x="57" y="130" class="sv-lbl-hi" text-anchor="middle">main.c</text>
          <text x="57" y="147" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">纯文本</text>

          <path d="M 104 132 L 128 132" class="sv-arrow"></path>

          <!-- ① 预处理 -->
          <rect x="132" y="96" width="112" height="72" rx="6" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="188" y="118" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--vio)">① 预处理 cpp</text>
          <text x="188" y="137" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">展开宏 · 展开 #include</text>
          <text x="188" y="153" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">处理条件编译</text>

          <path d="M 248 132 L 272 132" class="sv-arrow"></path>
          <text x="260" y="124" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">.i</text>

          <!-- ② 编译 -->
          <rect x="276" y="96" width="112" height="72" rx="6" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="332" y="118" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">② 编译 cc1</text>
          <text x="332" y="137" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">语法分析 → 优化</text>
          <text x="332" y="153" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">→ 生成汇编码</text>

          <path d="M 392 132 L 416 132" class="sv-arrow"></path>
          <text x="404" y="124" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">.s</text>

          <!-- ③ 汇编 -->
          <rect x="420" y="96" width="112" height="72" rx="6" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="476" y="118" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">③ 汇编 as</text>
          <text x="476" y="137" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">汇编码 → 机器码</text>
          <text x="476" y="153" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">生成符号表</text>

          <path d="M 536 132 L 560 132" class="sv-arrow"></path>
          <text x="548" y="124" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">.o</text>

          <!-- ④ 链接 -->
          <rect x="564" y="96" width="84" height="72" rx="6" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="606" y="118" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--grn)">④ 链接 ld</text>
          <text x="606" y="137" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">合并段</text>
          <text x="606" y="153" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">解析符号</text>

          <!-- 各阶段报错特征（① ② 在上排，③ ④ 在下排） -->
          <rect x="14" y="196" width="310" height="88" rx="6" class="sv-vio-s"></rect>
          <text x="28" y="216" class="sv-lbl-hi" style="fill:var(--vio)">① 预处理错误（cpp）</text>
          <text x="28" y="236" class="sv-lbl-dim" style="font-size:10px">fatal error: xxx.h: No such file</text>
          <text x="28" y="253" class="sv-lbl-dim" style="font-size:10px">#error 触发的自定义消息</text>
          <text x="28" y="272" class="sv-lbl-dim" style="font-size:10px">宏展开后的怪异语法错误</text>

          <rect x="336" y="196" width="310" height="88" rx="6" class="sv-cyn-s"></rect>
          <text x="350" y="216" class="sv-lbl-hi" style="fill:var(--cyn)">② 编译错误/警告（cc1）</text>
          <text x="350" y="236" class="sv-lbl-dim" style="font-size:10px">error: expected ';' before '}'</text>
          <text x="350" y="253" class="sv-lbl-dim" style="font-size:10px">warning: unused variable</text>
          <text x="350" y="272" class="sv-lbl-dim" style="font-size:10px">⚠ 类型不匹配 · 隐式转换</text>

          <rect x="14" y="292" width="310" height="88" rx="6" class="sv-amb-s"></rect>
          <text x="28" y="312" class="sv-lbl-hi" style="fill:var(--amb)">③ 汇编错误（as）</text>
          <text x="28" y="332" class="sv-lbl-dim" style="font-size:10px">invalid instruction shape</text>
          <text x="28" y="349" class="sv-lbl-dim" style="font-size:10px">selected processor does not support ...</text>
          <text x="28" y="368" class="sv-lbl-dim" style="font-size:10px">⚠ 多半是 -mcpu / -mthumb 配错</text>

          <rect x="336" y="292" width="310" height="88" rx="6" class="sv-grn-s"></rect>
          <text x="350" y="312" class="sv-lbl-hi" style="fill:var(--grn)">④ 链接错误（ld）</text>
          <text x="350" y="332" class="sv-lbl-dim" style="font-size:10px">undefined reference to 'foo'</text>
          <text x="350" y="349" class="sv-lbl-dim" style="font-size:10px">multiple definition of 'g_x'</text>
          <text x="350" y="368" class="sv-lbl-dim" style="font-size:10px">region RAM overflowed</text>

          <!-- 标题 -->
          <text x="14" y="34" class="sv-lbl-hi" style="fill:var(--txt-hi);font-size:13px">一条命令跑完四个阶段，也可以分步停下来看中间产物</text>
          <text x="14" y="58" class="sv-lbl-dim" style="font-size:11px">gcc -E → .i（只看预处理）   gcc -S → .s（只看汇编）   gcc -c → .o（只汇编不链接）</text>
          <text x="14" y="78" class="sv-lbl-dim" style="font-size:11px">arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb   ← 交叉编译就是"目标架构不同"，流程完全一样</text>
        </svg>
```

 

**报错信息会告诉你它在哪个阶段失败。** 看到 ` undefined reference ` 就别再去看头文件了—— 那是链接阶段的问题，头文件早就处理完了。

 

bash分阶段观察编译过程

 

```text
$ cat > hello.c <<'EOF'
#include <stdio.h>
#define SQUARE(x) ((x)*(x))
int main(void){ printf("%d\n", SQUARE(5)); return 0; }
EOF

$ gcc -E hello.c | tail -5
# 预处理后：宏已展开，头文件内容已插入
    printf("%d\n", ((5)*(5)));         ← SQUARE(5) 被替换掉了

$ gcc -S hello.c -o hello.s && cat hello.s
# 编译后：x86-64 汇编
    movl    $25, %esi                  ← 编译器直接在编译期算出 25！
    leaq    .LC0(%rip), %rdi
    call    printf@PLT                 ← 注意：printf 只是"引用"，地址还不知道

$ gcc -c hello.c -o hello.o && nm hello.o
# 汇编后：符号表，U = undefined（未定义），T = 在 .text 中已定义
0000000000000000 T main
                 U printf            ← 未定义符号，等链接器去找
# 这里只有 U printf，没有 U puts —— 因为 printf("%d\n", ...) 带转换符 %d，
# GCC 不会做 printf→puts 的变换。那个变换只在"无转换符且以 \n 结尾"
# （例如 printf("hello\n")）并且开了 -O1 以上时才会发生。

$ gcc hello.c -o hello && ./hello
$ nm hello | grep -E ' (T|U) (main|printf)(@|$)'
0000000000001149 T main
                 U printf@GLIBC_2.2.5  ← 链接后仍然"未定义"，但已绑定到动态库
```

 

◆ 一个函数名的一生

 

 
1. **预处理后** ：` printf ` 变成了 ` printf `（函数名没有被宏替换），但它的 *函数原型声明* 被从 ` stdio.h ` 插进来了。
 
2. **编译后** ：生成一条 ` call printf ` 指令，但地址字段是空的——编译器不知道 ` printf ` 在哪。
 
3. **汇编后** ：` .o ` 文件里有一个 **未定义符号（U printf）** 和一条 **重定位记录** ：" *代码里偏移 0x1A 处的 4 个字节，填 printf 的地址* "。
 
4. **链接后** ：链接器在其他 ` .o ` 或库里找到 ` printf `，把它的地址 **填回** 那条重定位记录。

 

```zhizhan-anchor
ch5-2
```



## 5.2 目标文件与 ELF：读懂二进制

 

` .o `、` .elf `、` .axf `、` .out ` 这些文件本质上都是  **ELF 格式** ， 只是用途不同（可重定位 / 可执行）。

 

**FIG 5.2**  ELF 文件结构（可重定位目标文件 vs 可执行文件）

 

```zhizhan-figure
<svg viewBox="0 0 660 356" width="660" height="356" role="img" aria-label="ELF 结构对比">
          <!-- 左：.o -->
          <text x="20" y="24" class="sv-lbl-hi" style="fill:var(--amb)">main.o（可重定位 ET_REL）</text>
          <rect x="20" y="34" width="290" height="300" rx="8" class="sv-box" stroke="var(--amb)"></rect>

          <rect x="30" y="44" width="270" height="34" rx="4" fill="var(--card-2)" stroke="var(--line-2)"></rect>
          <text x="42" y="65" class="sv-lbl-dim">ELF Header（架构、类型、入口）</text>

          <rect x="30" y="84" width="270" height="34" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="42" y="105" class="sv-lbl-dim" style="fill:var(--grn)">.text（代码，地址从 0 开始）</text>

          <rect x="30" y="124" width="270" height="34" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="42" y="145" class="sv-lbl-dim" style="fill:var(--grn)">.rodata / .data / .bss</text>

          <rect x="30" y="164" width="270" height="58" rx="4" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="42" y="184" class="sv-lbl-hi" style="fill:var(--vio)">.symtab 符号表</text>
          <text x="42" y="201" class="sv-lbl-dim" style="font-size:10px">main=T(定义) · printf=U(未定义)</text>
          <text x="42" y="216" class="sv-lbl-dim" style="font-size:10px">g_x=D · s_y=b · const_z=r</text>

          <rect x="30" y="228" width="270" height="58" rx="4" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="42" y="248" class="sv-lbl-hi" style="fill:var(--cyn)">.rel.text 重定位表</text>
          <text x="42" y="265" class="sv-lbl-dim" style="font-size:10px">"偏移 0x1A 处填 printf 地址"</text>
          <text x="42" y="280" class="sv-lbl-dim" style="font-size:10px">"偏移 0x24 处填 .rodata+0"</text>

          <rect x="30" y="292" width="270" height="32" rx="4" fill="var(--card-2)" stroke="var(--line-2)"></rect>
          <text x="42" y="312" class="sv-lbl-dim">.debug_* （调试信息，-g 才有）</text>

          <!-- 右：elf -->
          <text x="350" y="24" class="sv-lbl-hi" style="fill:var(--grn)">main.elf（可执行 ET_EXEC）</text>
          <rect x="350" y="34" width="290" height="300" rx="8" class="sv-box" stroke="var(--grn)"></rect>

          <rect x="360" y="44" width="270" height="34" rx="4" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="372" y="65" class="sv-lbl-hi" style="fill:var(--vio)">.isr_vector @ 0x08000000</text>

          <rect x="360" y="84" width="270" height="46" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="372" y="104" class="sv-lbl-hi" style="fill:var(--grn)">.text @ 0x08000100（真实地址）</text>
          <text x="372" y="121" class="sv-lbl-dim" style="font-size:10px">所有 call 指令的地址已填好</text>

          <rect x="360" y="136" width="270" height="34" rx="4" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="372" y="157" class="sv-lbl-dim" style="fill:var(--grn)">.rodata @ 0x08002A00</text>

          <rect x="360" y="176" width="270" height="46" rx="4" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="372" y="196" class="sv-lbl-hi" style="fill:var(--amb)">.data 初值 @ 0x08003000（LMA）</text>
          <text x="372" y="213" class="sv-lbl-dim" style="font-size:10px">VMA = 0x20000000，启动时拷贝</text>

          <rect x="360" y="228" width="270" height="34" rx="4" fill="var(--line)" stroke="var(--line-2)" stroke-dasharray="3 3"></rect>
          <text x="372" y="249" class="sv-lbl-dim">.bss @ 0x20000100（不占文件空间）</text>

          <rect x="360" y="268" width="270" height="56" rx="4" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="372" y="288" class="sv-lbl-hi" style="fill:var(--cyn)">Program Headers（加载视图）</text>
          <text x="372" y="305" class="sv-lbl-dim" style="font-size:10px">烧录器按这个把段写到 Flash 对应地址</text>
          <text x="372" y="319" class="sv-lbl-dim" style="font-size:10px">objcopy 用它生成 .bin / .hex</text>
        </svg>
```

 

**关键区别** ：` .o ` 里的地址都是"段内偏移"（从 0 开始），需要链接器重定位； ` .elf ` 里的地址是"真实物理地址"，可以直接烧进芯片。

 

basharm-none-eabi 工具链实战

 

```text
$ arm-none-eabi-size firmware.elf
   text    data     bss     dec     hex filename
  24180     156    3216   27552    6ba0 firmware.elf
   ↑      ↑       ↑
   |      |       └─ .bss：只占 RAM
   |      └─ .data：Flash 和 RAM 各占一份
   └─ .text + .rodata：只占 Flash
→ Flash 占用 = text + data = 24336 字节
→ RAM  占用 = data + bss  =  3372 字节（还要加 heap + stack）

$ arm-none-eabi-size -A firmware.elf          # 按段细分
section                size         addr
.isr_vector             392    134217728
.text                 24180    134218120
.rodata                1460    134242300
.data                   156    536870912
.bss                   3216    536871068

$ arm-none-eabi-nm --size-sort --print-size firmware.elf | tail -8
# 找"谁吃掉了我的 Flash"就用这条。
# 注意 --size-sort 是升序，所以 tail 给出的这几行仍是从小到大 —— 最大的在最后一行。
20000088 00000004 B g_counter
2000088c 00000400 B g_rx_buffer
2000008c 00000800 b s_cache
08002a1c 00000800 r g_sin_lut
0800321c 00001000 T g_big_state_machine

$ arm-none-eabi-objdump -h firmware.elf              # 段头表
$ arm-none-eabi-objdump -d firmware.elf | head -40    # 反汇编
$ arm-none-eabi-readelf -S firmware.elf              # 等价于 objdump -h，但信息更全
$ arm-none-eabi-readelf -s firmware.elf | head -20   # 符号表

$ arm-none-eabi-objcopy -O binary firmware.elf firmware.bin   # 生成裸二进制
$ arm-none-eabi-objcopy -O ihex firmware.elf firmware.hex     # 生成 Intel HEX
```

 

| 工具 | 用途 | 最常用参数 |
| --- | --- | --- |
| ` size ` | 看 Flash/RAM 占用 | ` -A ` 按段细分 · ` -B ` Berkeley 格式（即默认输出） · ` -d ` 十进制 · ` -x ` 十六进制 |
| ` nm ` | 列符号表 | ` --size-sort --print-size ` 找大符号 · ` -u ` 只看未定义 |
| ` objdump ` | 反汇编 / 看段 | ` -d ` 反汇编 · ` -h ` 段头 · ` -S ` 混排源码 |
| ` readelf ` | ELF 结构细节 | ` -S ` 段 · ` -s ` 符号 · ` -r ` 重定位 · ` -l ` 程序头 |
| ` objcopy ` | 格式转换 | ` -O binary ` · ` -O ihex ` · ` --only-section= ` |
| ` strings ` | 提取可打印字符串 | 快速看固件里有哪些提示文本 |

 

```zhizhan-anchor
ch5-2-1
```



### 5.2.1 符号表：T / t / D / d / B / b / R / r / U 是什么意思

 

bashnm 输出解读

 

```text
$ arm-none-eabi-nm firmware.elf | grep -E ' (main|hal_init|g_baud|s_state|g_table|g_counter|s_cache|g_version|free|malloc)$'
080001e4 T main          ← T 大写：全局符号，在 .text（代码）
08000a2c t hal_init      ← t 小写：static 函数，文件局部可见
20000000 D g_baud        ← D 大写：全局，已初始化的数据（.data）
20000004 d s_state       ← d 小写：static 已初始化数据
20000008 D g_table       ← D 大写：uint8_t[128]，同样在 .data
20000088 B g_counter     ← B 大写：全局，未初始化（.bss）
2000008c b s_cache       ← b 小写：static 未初始化（2048 字节）
08002a10 R g_version     ← R：只读数据（.rodata）
         U free           ← U：未定义，需要外部提供
         U malloc
# 大写 = 全局可见（外部链接）；小写 = 局部（static，内部链接）
# 这个大小写规则是排查"符号冲突"最快的线索
```

 

✔ 三个高频排查场景

 

**场景 1：固件太大，想知道谁占的空间**

 

` arm-none-eabi-nm --size-sort --print-size firmware.elf | tail -20 `

 

**场景 2：链接报 undefined reference，但函数明明定义了**

 

` arm-none-eabi-nm -u firmware.elf ` 看谁没被解析，再 ` nm libfoo.a ` 确认库里有没有这个符号（注意 C\+\+ 名字修饰）。

 

**场景 3：怀疑编译器优化掉了"有用的"代码**

 

` arm-none-eabi-objdump -d firmware.elf | grep -A20 '<my_func>:' ` 看实际生成的指令。

 

```zhizhan-anchor
ch5-2-2
```



### 5.2.2 符号表字母全表：W / V / C / A 这些你还没见过的

 

上面那张表只覆盖了最常见的 8 个字母。` nm ` 实际会用到  **20 多个** 字母， 而剩下那些恰好各对应一类"查了半天查不出来"的 bug：弱符号、common 符号、链接脚本给的绝对地址。 用一个文件把它们一次性凑齐。

 

symtypes.c — 尽量把 nm 的字母表凑齐 C

 

```text
/* symtypes.c —— 尽量把 nm 的字母表凑齐：大小写各一套 + 弱符号 + 未定义 */
#include <stdint.h>

int          g_init  = 42;          /* D：非 static，已初始化 */
int          b_zero;                /* B：非 static，未初始化 */
const uint32_t r_const = 0x1234;    /* R：只读常量 */
void g_fn(void) { }                 /* T：非 static 函数 */

static int s_counter;                                     /* b：static 未初始化 */
static __attribute__((noinline)) uint32_t t_helper(void)  /* t：static 函数 */
{ s_counter++; return (uint32_t)s_counter; }

__attribute__((weak)) void w_defined(void) { }   /* W：弱定义函数 */
__attribute__((weak)) int  v_defined = 7;        /* V：弱定义对象 */

extern void u_strong(void);                      /* U：强未定义 */
extern void w_undef(void) __attribute__((weak)); /* w：弱未定义（声明） */
extern int  v_undef       __attribute__((weak)); /* v：弱未定义（声明） */

/* 必须真的引用，否则编译器不会为"只声明"的符号产生符号表项 */
void caller(void)
{
    if (w_undef) w_undef();
    if (v_undef) g_init += v_undef;
    u_strong();
    g_init += (int)t_helper() + (int)r_const + v_defined;
    g_fn();
    w_defined();
}
```

 

✦ 两处刻意的写法，删掉就测不出来

 

**① ` extern ` 声明必须被真的引用。**  只写 ` extern void w_undef(void); ` 而不调用它，编译器 *根本不会* 为这个符号产生符号表项—— 你会以为是 ` nm ` 用法不对。所以 ` caller() ` 里必须真的写 ` if (w_undef) w_undef(); `。

 

**② ` t_helper ` 必须加 ` noinline `。**  ` static ` 函数只要被内联进调用者、或者返回值被丢弃，编译器就直接把它整个删掉， ` t ` 这个字母永远不会出现。 **小写字母"看不到"是常态，不是异常。**

 

先看 **未链接的 ` .o `** ：

 

bashnm 对 .o 的完整输出（12 行）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -c symtypes.c -o symtypes.o
$ arm-none-eabi-nm symtypes.o
00000000 B b_zero          ← 未初始化全局
00000038 T caller
00000000 T g_fn
00000000 D g_init
00000000 R r_const         ← 在 .rodata 段里，所以是 R
00000004 b s_counter       ← 小写 b：static
0000000c t t_helper        ← 小写 t：static 函数
         U u_strong        ← 大写 U：强未定义（地址栏空白）
00000004 V v_defined       ← 大写 V：弱【定义】的对象
         w v_undef         ← 小写 w：弱未定义
0000002c W w_defined       ← 大写 W：弱【定义】的函数
         w w_undef
```

 

注意最后三行：` v_undef ` 在 C 里声明为 ` extern int `（对象），但 ` nm ` 给它的字母仍然是 **小写 ` w `** ，不是 ` v `。 GNU 手册里 ` v ` 的定义是"被明确标记为弱对象的符号"，而一个 *未定义* 的弱引用拿不到这个标记。  **别照着手册背字母，照着实际输出认。**

 

再看 **链接之后的 ` .elf `** 。用的是这份链接脚本—— 注意它把 ` .rodata ` 收进了 ` .text ` 输出段：

 

symtypes.ld — 注意 .rodata 被并进了 .text Linker Script

 

```text
/* symtypes.ld —— 注意 .rodata 被收进了 .text 输出段（这会让 r_const 显示成 T） */
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 256K
         RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 64K }
_estack = 0x20010000;
ENTRY(caller)
SECTIONS {
  .text : { *(.text*) *(.rodata*) } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

还差一个符号。` u_strong ` 是 **强** 未定义，不补上它链接会当场失败 （` undefined reference to 'u_strong' `）；只有弱引用才可以悬空。补一个最小实现：

 

symstub.c — 只为满足 caller() 里的强未定义符号 u\_strong C

 

```text
/* symstub.c —— 只为满足 caller() 里的强未定义符号 u_strong */
void u_strong(void) { }
```

 

bashnm 对 .elf 的输出（11 行）

 

```text
$ arm-none-eabi-ld -T symtypes.ld symtypes.o symstub.o -o symtypes.elf
$ arm-none-eabi-nm symtypes.elf
20010000 A _estack        ← A：绝对地址，来自脚本里 "_estack = 0x20010000"
20000008 B b_zero
08000038 T caller
08000000 T g_fn
20000000 D g_init
080000a8 T r_const        ← 在 .o 里是 R，这里变成 T 了
2000000c b s_counter
0800000c t t_helper
0800009c T u_strong       ← 被 symstub.o 补上，U 变成 T
20000004 V v_defined
0800002c W w_defined

# v_undef 和 w_undef 去哪了？——一个都不剩
$ arm-none-eabi-nm symtypes.elf | grep -cE ' (v_undef|w_undef)$'
0
```

 

⚠ 两个反直觉现象，各对应一类真实 bug

 

**① 同一个符号，在 ` .o ` 里是 ` R `，在 ` .elf ` 里变成 ` T `。**  ` r_const ` 明明是 ` const `，怎么变成代码符号了？   
 因为  **` nm ` 的字母跟的是"符号落在哪个 *输出段* "，不是 C 语言里的 ` const `** 。 链接脚本把 ` .rodata ` 并进了 ` .text `，常量就成了 ` .text ` 的一部分，于是显示 ` T `。   
 这解释了为什么"用 ` nm ` 找只读数据表"经常找不到： *你得先看链接脚本怎么归置 ` .rodata `* 。

 

**② 弱未定义符号在最终可执行文件里 *直接消失* ，不是报错、也不是留个空地址。**  ` v_undef ` / ` w_undef ` 在 ` .o ` 里清清楚楚是 ` w `， 链接后 ` grep ` 出来是 ` 0 ` 行——未满足的弱引用被解析成地址 ` 0 `，符号本身不再输出。   
 这就是 5.3.1 节那个现象的根源： **` nm firmware.elf | grep _printf_float ` 查不到， 不代表 ` %f ` 能正常工作** ——恰恰相反，"查不到"才是它 *没被链进来* 的证据。

 

| 字母 | 含义 | 典型来源 / 排查提示 |
| --- | --- | --- |
| ` A ` | 绝对地址，不随重定位改变 | 链接脚本里的 ` _estack = 0x20010000; `。用它查 **栈顶到底设在哪** |
| ` T ` / ` t ` | 代码段（` .text `） | 小写 = ` static `。注意 ` .rodata ` 并进来后常量也显示 ` T ` |
| ` D ` / ` d ` | 已初始化数据（` .data `），占 Flash \+ RAM | 小写 = ` static `。查"RAM 里谁占了大头"看这一族 |
| ` B ` / ` b ` | 未初始化数据（` .bss `）， **只占 RAM** | 小写 = ` static `。大数组忘了初始化能省 Flash，就是这个字母 |
| ` R ` / ` r ` | 只读数据（` .rodata `） | 字面量、` const ` 表。 *是否保留 ` R ` 取决于链接脚本* |
| ` C ` | common 符号（未初始化的"暂定定义"） | **只有 ` -fcommon ` 下才出现** 。GCC 13.3 默认 ` -fcommon [disabled] `，所以默认是 ` B ` |
| ` W ` / ` w ` | 弱符号（函数） | 大写 = 已定义，小写 = 未定义。` __attribute__((weak)) ` 的典型产物 |
| ` V ` / ` v ` | 弱符号（对象） | 大写 = 已定义。 **未定义的弱对象实测显示为 ` w `，不是 ` v `** |
| ` U ` | 未定义，需要别的目标文件或库提供 | 链接报 ` undefined reference ` 时挨个查的就是它 |

 

✔ 两个过滤开关，实测行数

 

同一个 ` symtypes.o `，` nm ` 全量输出  **12 行** ：

 

` nm --defined-only symtypes.o ` →  **9 行** （滤掉 ` u_strong ` / ` v_undef ` / ` w_undef `）。 看"这个文件到底贡献了什么"时用它，` U ` 是噪音。

 

` nm -u symtypes.o ` →  **3 行** ，正好是那三个未定义符号： ` U u_strong `、` w v_undef `、` w w_undef `。  **排查"链接缺符号"用这一个** ，它回答的是"我还需要谁"。

 

```zhizhan-anchor
ch5-2-3
```



### 5.2.3 从 .elf 到 .bin：objcopy 到底写进去了什么

 

烧录工具要的是 **纯二进制**  ` .bin `（或 ` .hex `）， 而编译器产出的是带符号表、带重定位信息的 ` .elf `。中间的转换靠 ` arm-none-eabi-objcopy -O binary `。

 

很多人以为这个转换就是"把 ELF 的头去掉"。 **不是。**  它做的事是： *把各个段按各自的 **装载地址（LMA）** 摆放到文件里，中间的空洞补 0* 。 于是一旦某个段的 LMA 写错，你得到的不是"稍微大一点"的 bin，而是一个 **几百 MB 的怪物** 。

 

lma\_demo.c — 三个段各放一处 C

 

```text
/* lma_demo.c —— 三个段各放一处，用来观察 objcopy 到底把什么写进了 .bin */
#include <stdint.h>

const uint32_t g_tbl[4] = { 0x11111111u, 0x22222222u, 0x33333333u, 0x44444444u };  /* .rodata → 只占 Flash */
uint32_t       g_calib  = 0x11223344u;   /* .data → Flash 里存初值，运行时拷进 RAM */
uint32_t       g_zero[4];                /* .bss  → 一点 Flash 都不占 */

int main(void)
{
    g_zero[0] = g_calib + g_tbl[0];
    return (int)g_zero[0];
}
```

 

两份链接脚本只差最后那个 ` AT > FLASH `：

 

lma\_good.ld — .data 同时给出运行地址和装载地址 Linker Script

 

```text
/* lma_good.ld —— 正确版：.data 用 "> RAM AT > FLASH" 同时给出 VMA 和 LMA */
MEMORY {
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}
ENTRY(main)
SECTIONS {
  .text   : { *(.text*) *(.rodata*) } > FLASH
  .data   : { *(.data*) } > RAM AT > FLASH
  .bss    : { *(.bss*) *(COMMON) } > RAM
}
```

 

lma\_bad.ld — 少了 AT \> FLASH 的反面版 Linker Script

 

```text
/* lma_bad.ld —— 反面版：只写 "> RAM"，".data" 的装载地址被默认成和运行地址一样 */
MEMORY {
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}
ENTRY(main)
SECTIONS {
  .text   : { *(.text*) *(.rodata*) } > FLASH
  .data   : { *(.data*) } > RAM
  .bss    : { *(.bss*) *(COMMON) } > RAM
}
```

 

⚠ 这个错误 ` size ` 完全看不出来

 

两份脚本编出的 ELF，` arm-none-eabi-size ` 的输出 **一字不差** ： ` text 56 · data 4 · bss 16 `，连 ELF 文件本身都是同样的 ` 9044 ` 字节。 差别只在 ` readelf -l ` 的  **PhysAddr**  一列，和最终 ` .bin ` 的大小上。

 

bash同一份 .o，两份脚本，只比装载地址与 .bin 体积

 

```text
$ arm-none-eabi-readelf -l lma_good.elf | grep LOAD
  LOAD  0x001000 0x08000000 0x08000000 0x00038 0x00038 R E   ← .text：VMA = LMA，都在 Flash
  LOAD  0x002000 0x20000000 0x08000038 0x00004 0x00014 RW    ← .data：VMA 在 RAM，LMA 在 Flash ✔

$ arm-none-eabi-objcopy -O binary lma_good.elf lma_good.bin && stat -c%s lma_good.bin
60                       ← 0x38 的代码 + 4 字节初值，就这么大

$ arm-none-eabi-readelf -l lma_bad.elf | grep LOAD
  LOAD  0x001000 0x08000000 0x08000000 0x00038 0x00038 R E
  LOAD  0x002000 0x20000000 0x20000000 0x00004 0x00014 RW    ← LMA 也变成 RAM 地址了 ✘

$ arm-none-eabi-objcopy -O binary lma_bad.elf lma_bad.bin && stat -c%s lma_bad.bin
402653188                ← 384 MB。objcopy 老老实实从 0x08000000 一路补 0 补到 0x20000000
```

 

` 0x20000000 − 0x08000000 = 0x18000000 = 402653184 `，再加上那 4 字节初值， 正好是 ` 402653188 `。 **这不是"固件变大"，这是固件里塞了一整片不存在的 Flash 空洞。**  烧录工具会直接拒绝，或者写几个小时之后失败。

 

所以 ` AT > FLASH ` 这四个字是嵌入式的 **必备常识** ： ` > RAM ` 说的是"运行时它在哪"，` AT > FLASH ` 说的是"它的初值被烧在哪"。 没有后者，链接器就认为初值本来就在 RAM 里，而 RAM 掉电即失——顺带产出一个 384 MB 的 bin。

 

#### 空洞补什么？` --gap-fill ` 与 ` --pad-to `

 

"段与段之间的空洞补 0"是默认行为，可以用 ` --gap-fill ` 改。先用一份带真实段间空隙的脚本观察： ` .text ` 在 ` 0x08000000 `（长 ` 0x28 `）， ` .tail ` 被钉在 ` 0x08000200 `，中间空出 ` 0x1D8 ` 字节。

 

lma\_gap.c — 制造真实的节间空隙 C

 

```text
/* lma_gap.c —— 制造一段真实的【节间空隙】，用来观察 --gap-fill 填不填 */
#include <stdint.h>

const uint32_t g_head[4] = { 0xAAAAAAAAu, 0xBBBBBBBBu, 0xCCCCCCCCu, 0xDDDDDDDDu };

/* 手动指定到另一个段，链接脚本把它放在 0x08000200 —— 与 .text 之间留出真实空隙 */
__attribute__((section(".tail"), used))
const uint32_t g_tail[2] = { 0x5A5A5A5Au, 0xA5A5A5A5u };

int main(void) { return (int)(g_head[0] + g_tail[0]); }
```

 

lma\_gap.ld — 段间空隙（.tail 钉在 0x08000200） Linker Script

 

```text
/* lma_gap.ld —— .tail 被放到 0x08000200，与 .text 之间留出真实空隙 */
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 256K
         RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 64K }
ENTRY(main)
SECTIONS {
  .text : { *(.text*) *(.rodata*) } > FLASH
  .tail 0x08000200 : { KEEP(*(.tail)) } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

bash段间空隙：--gap-fill / --pad-to 实测

 

```text
# .text 0x28 @0x08000000，.tail 0x08 @0x08000200 —— 中间空 0x1D8 字节
$ arm-none-eabi-objcopy -O binary -j .text -j .tail gap.elf gap.bin && stat -c%s gap.bin
520                      ← 0x208，空洞被补了 0x1D8 个 0x00
$ sha256sum gap.bin
484742730f9c6b12…

$ arm-none-eabi-objcopy -O binary -j .text -j .tail --gap-fill 0xff gap.elf g1.bin
520 字节，sha = e8064cfda727ce70…       ← 大小没变，内容变了
$ arm-none-eabi-objcopy -O binary -j .text -j .tail --gap-fill 0x00 gap.elf g0.bin
520 字节，sha = 484742730f9c6b12…       ← 和不加参数【完全相同】→ 默认填充值就是 0x00

# 空洞里到底是不是 ff？直接看字节
$ od -A x -t x1 -j 0x30 -N 16 g1.bin
000030 ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff
000040

$ arm-none-eabi-objcopy -O binary -j .text -j .tail --pad-to 0x08000400 gap.elf gp.bin
1024                     ← 0x400，--pad-to 是按【绝对地址】把尾部撑到指定位置
```

 

⚠ ` --gap-fill ` 只管 *段与段之间* ，管不了 *段内部* 的空洞

 

这是最容易被误传的一条。把同一个空隙挪到 ` .text ` 输出段 **内部** —— 脚本看起来只多了一行：

 

```text
.text : {
  *(.text*) *(.rodata*)
  . = 0x100;             /* ← 段【内部】的空洞（这里的 . 是相对段起点的偏移） */
  *(.tail)
} > FLASH
```

 

此时 ` .tail ` 会被并进 ` .text `，整个段变成 ` 0x108 ` 字节。 再试三种填充： **默认** 、` --gap-fill 0xff `、` --gap-fill 0x5a `—— 输出 **都是 264 字节，sha 都是 ` 62ff4f94fcd75789 `…，一字不差** 。 直接 dump 空洞处的字节，读到的仍然是 ` 00 `，不是 ` ff `。

 

**结论：** ` --gap-fill ` 作用于 *节区之间的间隙填充* ； 输出段 *内部* 由 ` . = N ` 造成的空洞属于该段的正常内容，objcopy 按原样搬运。 想控制后者，得在脚本里显式写 ` = 0xFF ` 填充（` BYTE() `/` FILL() `），不能指望 objcopy。

 

lma\_hole.ld — 节内空洞（与 lma\_gap.ld 只差一行） Linker Script

 

```text
/* lma_hole.ld —— 反面版：把空隙留在 .text【输出段内部】，而不是两个段之间 */
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 256K
         RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 64K }
ENTRY(main)
SECTIONS {
  .text : {
    *(.text*) *(.rodata*)
    . = 0x100;             /* ← 段【内部】的空洞（这里的 . 是相对段起点的偏移） */
    *(.tail)
  } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

| 参数 | 作用 | 实测 |
| --- | --- | --- |
| ` -O binary ` | 输出纯二进制。按各段  **LMA**  摆放，段间空洞补 0 | good 60 字节 / bad 402653188 字节 |
| ` -O ihex ` | 输出 Intel HEX。 **带地址记录，空洞不占文件体积** | LMA 写错时用它更容易看出地址异常 |
| ` -j <段名> ` | 只导出指定段（` --only-section `） | 可重复写多个，如 ` -j .text -j .tail ` |
| ` --gap-fill <值> ` | 填充 **段与段之间** 的空洞 | 默认值实测为 ` 0x00 `； *不作用于段内空洞* |
| ` --pad-to <地址> ` | 把输出 **尾部** 撑到指定绝对地址 | ` --pad-to 0x08000400 ` → 1024 字节 |
| ` -S ` / ` --strip-all ` | 去掉符号表 / 调试信息， **只减体积、不改镜像内容** | 发布版常加，但保留一份带符号的 ` .elf ` 用于解栈 |

 

```zhizhan-anchor
ch5-3
```



## 5.3 静态库与动态库

 

|  | 静态库 .a / .lib | 动态库 .so / .dll |
| --- | --- | --- |
| **构建** | ` ar rcs libfoo.a a.o b.o ` | ` gcc -shared -fPIC -o libfoo.so a.o b.o ` |
| **链接时机** | 编译期把用到的 .o  **复制进最终镜像** | 只记录依赖，运行期由加载器映射 |
| **体积** | 只把 *用到的* 目标文件打进去（按 .o 粒度） | 镜像小，但运行需要库文件存在 |
| **嵌入式** | **✔ 标配** 。MCU 上几乎只用静态库 | ✕ 裸机不支持；嵌入式 Linux 支持，见后续课程 |
| **典型例子** | ` libc_nano.a ` · ` libm.a ` · 厂商 HAL 库 | 嵌入式 Linux 的 ` libc.so.6 ` |

 

⚠ 静态库的"按需提取"特性（链接顺序陷阱）

 

链接器处理静态库的规则是： **"从当前位置往后扫描，只提取那些能解决当前未定义符号的成员"** 。 而且 *它只扫一遍* 。

 

链接顺序问题 bash

 

```text
# ✕ 错误顺序：liba 先出现，此时还没有"未定义符号"需要它解决
gcc main.o -la -lb
# 如果 main 用 b()，b() 又用 a()：处理 -la 时没人要 a()，直接跳过；
# 处理 -lb 时引入 b()，它需要 a()，但 -la 已经扫过了 → undefined reference to 'a'

# ✔ 正确顺序：被依赖的放后面
gcc main.o -lb -la

# ✔ 更省心的做法：用 --start-group / --end-group 让链接器反复扫描
gcc main.o -Wl,--start-group -la -lb -Wl,--end-group
```

 

**规则：依赖方在前，被依赖方在后** 。这个坑在链接厂商 SDK 时极其常见。

 

```zhizhan-anchor
ch5-3-1
```



### 5.3.1 newlib 与 newlib-nano：同一套 API，两份实现

 

上面把 ` libc_nano.a ` 当成"嵌入式静态库的典型例子"一笔带过，这里补上它的来历。  **nano 不是"另一种 C 库"** ——它不是 musl、也不是 picolibc，而是  *同一个 newlib 用 ` -Os ` 重新编出来的第二份* ： 头文件相同、函数名相同、源码相同，差别只在编译选项，以及几个被做成"按需拉取"的功能。

 

` arm-none-eabi-gcc ` 默认链的是 **完整 newlib** ，换成 nano 只需加一行 ` --specs=nano.specs `。先用三个探针量一下这一行开关值多少钱。

 

np\_int.c — 体积矩阵的基线探针：一次 %d 格式化 C

 

```text
/* np_int.c —— newlib / newlib-nano 体积矩阵的基线探针：一次 int 格式化 */
#include <stdio.h>

int main(void)
{
    printf("%d\n", 1);
    return 0;
}
```

 

np\_flt.c — 探针：一次 %f 格式化 C

 

```text
/* np_flt.c —— 探针：一次 %f 格式化 */
#include <stdio.h>

int main(void)
{
    printf("%f\n", 1.0);
    return 0;
}
```

 

np\_lld.c — 探针：一次 %lld 格式化（long long） C

 

```text
/* np_lld.c —— 探针：一次 %lld 格式化（long long） */
#include <stdio.h>

int main(void)
{
    printf("%lld\n", 1LL);
    return 0;
}
```

 

np\_puts.c — 探针：只用 puts，不碰 printf C

 

```text
/* np_puts.c —— 探针：只用 puts，不碰 printf */
#include <stdio.h>

int main(void)
{
    puts("hi");
    return 0;
}
```

 

bash同一份源码，只换 C 库

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os --specs=nosys.specs src/np_int.c -o b/np_int__full.elf
   text    data     bss     dec     hex filename
  38900    2036    1296   42232    a4f8 b/np_int__full.elf

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os --specs=nano.specs --specs=nosys.specs src/np_int.c -o b/np_int__nano.elf
   text    data     bss     dec     hex filename
   5752     104     368    6224    1850 b/np_int__nano.elf
← text 从 38900 掉到 5752，只剩 14.8%

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os --specs=nano.specs --specs=nosys.specs -u _printf_float src/np_int.c -o b/np_int__npf.elf
   text    data     bss     dec     hex filename
  17508     468     372   18348    47ac b/np_int__npf.elf
← 只是把浮点格式化"要回来"，就吃掉 11756 字节
```

 

```zhizhan-table
{"rows":[[{"body":"探针","header":true,"rowSpan":1,"colSpan":1},{"body":"完整 newlib  \n` --specs=nosys.specs `","header":true,"rowSpan":1,"colSpan":1},{"body":"newlib-nano  \n` --specs=nano.specs --specs=nosys.specs `","header":true,"rowSpan":1,"colSpan":1},{"body":"nano \\+ ` -u _printf_float `","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` printf(\"%d\") `","header":false,"rowSpan":1,"colSpan":1},{"body":"38900 / 2036 / 1296","header":false,"rowSpan":1,"colSpan":1},{"body":"**5752 / 104 / 368**","header":false,"rowSpan":1,"colSpan":1},{"body":"17508 / 468 / 372","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` printf(\"%f\") `","header":false,"rowSpan":1,"colSpan":1},{"body":"38908 / 2036 / 1296","header":false,"rowSpan":1,"colSpan":1},{"body":"**5756 / 104 / 368**","header":false,"rowSpan":1,"colSpan":1},{"body":"17516 / 468 / 372","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` printf(\"%lld\") `","header":false,"rowSpan":1,"colSpan":1},{"body":"38908 / 2036 / 1296","header":false,"rowSpan":1,"colSpan":1},{"body":"**5756 / 104 / 368**","header":false,"rowSpan":1,"colSpan":1},{"body":"—","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` puts() `","header":false,"rowSpan":1,"colSpan":1},{"body":"8460 / 1404 / 840","header":false,"rowSpan":1,"colSpan":1},{"body":"**3456 / 104 / 368**","header":false,"rowSpan":1,"colSpan":1},{"body":"17628 / 468 / 372","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

**表注：** 单位是 ` size ` 的 text / data / bss（字节）， 四条命令都带 ` -mcpu=cortex-m3 -mthumb -Os `。 每一格都是本机真编真链、` arm-none-eabi-size ` 读出来的， 不是从手册上抄的。

 

⚠ nano 下 ` %f ` 为什么会静默失效

 

看上表第二行：nano 下 ` %f ` 只比 ` %d ` 多  **4 字节** ； ` %lld ` 也多 4 字节，两者 *数字完全相同* 。 4 字节连一条指令都放不下——说明 **浮点格式化的代码根本没有进镜像** ， 程序会安静地打印出错误结果。

 

机制用 ` nm ` 看得一清二楚：` libc_nano.a ` 里有一个独立成员 ` libc_a-nano-vfprintf_float.o `，它 *定义*  ` _printf_float `（` W `，弱定义）； 而 ` libc_a-nano-vfprintf.o ` / ` libc_a-nano-svfprintf.o ` 把 ` _printf_float ` 列成 ` w `（ **弱未定义** ）。 弱引用在没人满足时 **不会报错** ，链接器只是把这个分支当"没有"处理掉。

 

所以 nano 的规矩是： **要用浮点 printf，必须显式"点名"把它拉进来** —— ` -u _printf_float `（返回值 0 也一并点名）。 代价是  **\+11756 字节** （5752 → 17508），比用 ` puts ` 的整程序还大。 顺带一提，完整 ` libc.a ` 里 ` _printf_float ` ` _scanf_float ` ` _printf_i ` ` _scanf_i `  **一个都没有** ——这也是"完整 newlib 下 ` %f ` 只多 8 字节"的原因：浮点本来就在里面。

 

◈ ` -u ` 的语义：只是"记一笔"，不检查符号存不存在

 

` -u sym `（长写法 ` --undefined=sym `）的意思是  *"假装有地方引用了 sym"* 。实测三种情况的退出码：

 

 
- 完整 newlib \+ ` -u _printf_float `：退出码  **0** ，符号表里多出一个 **悬空的 ` U _printf_float `** ，体积一字不差（38900/2036/1296），但 ELF 的 sha256 变了（` 513b9fb8… ` → ` 4e6a00… `）。
 
- nano \+ ` -u _printf_float `：退出码 0，符号表里出现 ` 0000828c W _printf_float `——这次是 **真把它拉进来了** 。
 
- 任意库 \+ ` -u _no_such_symbol_xyz `：退出码 **仍然是 0** ，什么也不发生。
 

 

所以 ` -u ` 不能当"这个符号必须存在"的检查用——它只是把名字记进待解决列表， 解决不了也不吭声。 **要在 CI 里断言符号存在，得用 ` nm ` 查，不能靠退出码。**

 

◆ 两个库装在哪儿：找 ` libc_nano.a ` 时容易踩的坑

 

想知道自己手上的 nano 有多大，不能去 ` arm-none-eabi/lib/thumb/v7-m/nofp/ ` 找—— 那里 **只有 ` libc.a `** 。nano 版装在  **GCC 自己的 lib 目录**  ` lib/gcc/arm-none-eabi/13.3.1/thumb/v7-m/nofp/ ` 下。实测该目录里的归档体积：

 

| 归档文件 | 字节 | 说明 |
| --- | --- | --- |
| ` libc.a ` | 1165320 | 完整 newlib |
| ` libc_nano.a ` | **893560** | nano 版 C 库 |
| ` libg.a ` / ` libg_nano.a ` | 1165320 / 893560 | 带调试信息的同名库，体积一致 |
| ` libm.a ` | 564490 | 数学库 |
| ` libnosys.a ` | 29518 | 桩函数表，见 §5.3.2 |
| ` librdimon.a ` / ` librdimon_nano.a ` | 19170 / 18822 | semihosting 桩，见 §5.3.2 |

 

**注意这是归档文件的大小，不是固件体积** ——静态库按需提取， 链进去的只有真正被引用的那几个成员（所以上表里 nano 的 text 才 5752 字节，而归档有 893 KB）。

 

```zhizhan-anchor
ch5-3-2
```



### 5.3.2 桩函数：` --specs=nosys.specs ` 到底做了什么

 

上一节的实验都带了 ` --specs=nosys.specs `。这一行 **不是可选项** —— 去掉它连裸机程序都链不上。原因是 libc 里有一批函数（` _write ` ` _read ` ` _close ` ` _lseek ` ` _sbrk ` ` _exit ` …）在 PC 上由操作系统提供， 在裸机上 **没有操作系统可以调用** ，必须由你或工具链补一份实现。

 

bash不加 specs：链接直接失败

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os src/np_int.c -o b/spec_1.elf
退出码 = 1
exit.c:(.text.exit+0x14): undefined reference to `_exit'
closer.c:(.text._close_r+0xc): undefined reference to `_close'
lseekr.c:(.text._lseek_r+0x14): undefined reference to `_lseek'
readr.c:(.text._read_r+0x14): undefined reference to `_read'
writer.c:(.text._write_r+0x14): undefined reference to `_write'

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -lnosys src/np_int.c -o b/spec_7.elf
退出码 = 1
# 换成手写 -lnosys（库放在源码前），一模一样地失败
exit.c:(.text.exit+0x14): undefined reference to `_exit'
closer.c:(.text._close_r+0xc): undefined reference to `_close'
lseekr.c:(.text._lseek_r+0x14): undefined reference to `_lseek'
readr.c:(.text._read_r+0x14): undefined reference to `_read'
writer.c:(.text._write_r+0x14): undefined reference to `_write'
```

 

| 命令行（均在 ` -mcpu=cortex-m3 -mthumb -Os ` 之上） | 退出码 | text / data / bss | 告警 |
| --- | --- | --- | --- |
| （裸链，无 specs） | **1** | — | ` _exit/_close/_lseek/_read/_write ` 未定义 |
| ` --specs=nosys.specs ` | 0 | 38900 / 2036 / 1296 | 8 条 |
| ` --specs=nano.specs `（单独） | **1** | — | 同上，桩函数仍然缺 |
| ` --specs=nano.specs --specs=nosys.specs ` | 0 | 5752 / 104 / 368 | 6 条 |
| ` --specs=rdimon.specs ` | 0 | 41524 / 2328 / 1468 | **0 条** |
| ` --specs=nano.specs --specs=rdimon.specs ` | 0 | 7632 / 396 / 540 | **0 条** |

 

⚠ ` --specs=nano.specs ` 单独用也会失败

 

看表的第 3 行：nano.specs  **只负责换 C 库** ，不含任何桩函数。 所以它必须和 ` nosys.specs `（或 ` rdimon.specs `） *一起* 用。 而第 4 行说明：换成 nano 后告警从 8 条降到 6 条——因为 nano 的 ` printf ` 路径不再牵动 ` _getpid ` / ` _kill ` 这两个信号相关桩。

 

◆ nosys 与 rdimon：一个"故意失败"，一个真实现

 

最后两行告警数是 0，这不是巧合。` rdimon ` 的桩是 **真实现** —— 它走 semihosting，把 ` _write ` 转成一句"请调试器帮我输出"，所以在连接着 GDB / OpenOCD 时 *真的能看到串口输出* 。代价是体积：比 nosys 多  **2624 字节 text** （41524 vs 38900）。

 

而 ` nosys ` 的桩是 **空实现** ，链接器知道它"永远失败"， 于是主动发一条告警提醒你： ` warning: _write is not implemented and will always fail `。  **这就是"printf 编译通过、串口却一个字都没有"的直接原因** —— 函数链上了，但 ` _write ` 什么也不做。 要真正输出，得自己实现 ` _write ` 把字节塞进 UART 寄存器（见第 6 章的 ` fputc ` 重定向）。

 

◈ 重点发现：` --specs=nosys.specs ` ≠ ` -lnosys `

 

既然 ` nosys.specs ` 就是"把 ` libnosys.a ` 链进来"， 那手写 ` -lnosys ` 应该等价才对。实测 **五种写法全失败** ，只有 ` nosys.specs ` 那一种能过：

 

| 命令 | 退出码 |
| --- | --- |
| ` -lnosys src/np_int.c `（库在前） | **1** |
| ` src/np_int.c -lnosys `（库在后） | **1** |
| ` src/np_int.c -Wl,--start-group -lnosys -Wl,--end-group ` | **1** |
| ` src/np_int.c -Wl,--start-group -lc -Wl,--end-group ` | **1** |
| ` src/np_int.c -Wl,--start-group -lnosys -lc -Wl,--end-group ` | **0** ，38900 / 2036 / 1296 |
| ` --specs=nosys.specs src/np_int.c ` | **0** ，38900 / 2036 / 1296 |

 

关键在最后两行 **输出完全相同** 。结论： ` nosys.specs ` 的本质 **不是"加了个 ` -lnosys `"** ， 而是 **"把 ` -lnosys ` 和 ` -lc ` 放进同一个 ` --start-group `"** 。 原因是 libc 的 ` closer.o ` / ` writer.o ` 对 ` _close ` / ` _write ` 的 *引用* ， 是在 ` -lc ` 被处理时才产生的；此时单独的 ` -lnosys ` 早就扫完了。 只有两者同组，` ld ` 才会反复扫描这个组直到所有引用都解决。  **这正是 §5.3 开头那条"依赖方在前、被依赖方在后"规则的最硬核案例** —— 当两个库互相引用时，顺序无解，只能上 ` --start-group `。

 

```zhizhan-anchor
ch5-3-3
```



### 5.3.3 ` -nostdlib ` / ` -nostartfiles ` / ` -nodefaultlibs `：三个容易混淆的开关

 

这三个开关名字很像，作用范围却完全不同。它们的区别只有一句话：  **` -nostartfiles ` 不链启动代码、` -nodefaultlibs ` 不链库、 ` -nostdlib ` 两样都不链** 。下面用同一份探针逐个实测。

 

bash三个开关的实测结果

 

```text
$ gcc -mcpu=cortex-m3 -mthumb -Os --specs=nosys.specs -nostartfiles src/np_int.c -o ns/nostart.elf
退出码 = 0                      # ← 注意：成功
warning: cannot find entry symbol _start; defaulting to 00008000
   text    data     bss     dec     hex filename
  38044    2012     864   40920    9fd8 ns/nostart.elf

$ gcc -mcpu=cortex-m3 -mthumb -Os --specs=nosys.specs -nodefaultlibs src/np_int.c -o ns/nodeflib.elf
退出码 = 1
np_int.c:(.text.startup+0x6): undefined reference to `printf'
crt0.o:(.text+0x22): undefined reference to `memset'
(.text+0x4a): undefined reference to `__libc_init_array'
(.text+0x56): undefined reference to `exit'
collect2.exe: error: ld returned 1 exit status

$ gcc -mcpu=cortex-m3 -mthumb -Os --specs=nosys.specs -nostdlib src/np_int.c -o ns/nostdlib.elf
退出码 = 1
warning: cannot find entry symbol _start; defaulting to 00008000
np_int.c:(.text.startup+0x6): undefined reference to `printf'
collect2.exe: error: ld returned 1 exit status
```

 

| 额外 flag | 退出码 | text / data / bss | 症状 |
| --- | --- | --- | --- |
| （无） | 0 | 38900 / 2036 / 1296 | 基线，8 条 nosys 桩告警 |
| ` -nostartfiles ` | **0** | **38044 / 2012 / 864** | 9 条告警（比基线多一条 ` entry symbol `） |
| ` -nodefaultlibs ` | **1** | — | ` printf ` / ` memset ` / ` __libc_init_array ` / ` exit ` 未定义 |
| ` -nostdlib ` | **1** | — | 连入口都没有 \+ ` printf ` 未定义 |

 

⚠ 最危险的一格：` -nostartfiles ` 退出码是 0

 

它 **成功链接了一个跑不起来的程序** 。用 ` nm ` 和 ` readelf -h ` 对照基线与它：

 

| 符号 / 属性 | 基线 | ` -nostartfiles ` |
| --- | --- | --- |
| ` _start ` | ` 000080e8 T ` | **` U `（未定义）** |
| ` __libc_init_array ` | ` 0000870c T ` | **整个符号消失** |
| ` main ` | ` 0000802c T ` | ` 00008000 T ` |
| ` _exit ` / ` _sbrk ` | ` 00011048 ` / ` 0001101c ` | 仍然在（另址：` 00010d40 ` / ` 00010d14 `） |
| **ELF 入口点** | ` 0x80e9 `（= ` _start ` \| Thumb 位） | **` 0x8000 `（= ` main ` 本身）** |

 

后果是 **三件启动期必做的事全部消失** ：` .data ` 从 Flash 搬到 RAM 的初值搬运、 ` .bss ` 清零、以及 ` __libc_init_array() ` 调用—— 后者负责跑 ` __attribute__((constructor)) ` 函数和 C\+\+ 全局对象构造。 于是 **所有初值非零的全局变量都是垃圾值** ，而 *唯一的那条提示只是一句 warning* 。 这就是为什么"看退出码的 CI"会直接放过它。

 

◈ 为什么 ` -nostartfiles ` 能用、` -nostdlib ` 不能用

 

从表的第 2、4 行对比就能看出来：` -nostartfiles `  **仍然链 C 库** ， 所以 ` printf ` 还能找到；它只是把 ` crt0.o ` 那一层拿掉了。 ` -nostdlib ` 把库也一起断了，` printf ` 自然无处可寻。

 

**实用建议：** 嵌入式项目里这三者用得非常少，因为厂商的启动文件 （` startup_stm32xxxx.s ` \+ 链接脚本）本来就把 ` _start ` 那一层的活接过去了—— 通常的做法是加 ` -nostartfiles ` 避免和 ` crt0.o ` 打架，  *但必须自己确认 ` .data ` 搬运和 ` .bss ` 清零在启动文件里， 并且 ` Reset_Handler ` 会调用 ` __libc_init_array `* 。 ` -nostdlib ` 留给完全不用 C 库的极端场景（例如纯汇编的小 bootloader）。

 

```zhizhan-anchor
ch5-4
```



## 5.4 GCC 选项：嵌入式的关键开关

 

下面这些选项，每一个在嵌入式项目里都值得单独理解。先看 **优化等级** ，因为它是"为什么优化后行为变了"的根源。

 

| 等级 | 做了什么 | 适用场景 |
| --- | --- | --- |
| ` -O0 ` | 不做优化，每条语句独立翻译 | **调试专用** 。变量不被优化掉，单步执行符合直觉。但代码大、慢，可能掩盖时序 bug |
| ` -Og ` | 以调试体验为优先的优化 | **推荐的调试等级** 。比 -O0 更接近真实行为，又保持可调试 |
| ` -O1 ` | 基础优化：常量折叠、死代码删除 | 空间/速度平衡，编译快 |
| ` -O2 ` | 积极优化：循环优化、指令调度、内联小函数 | 算力吃紧而  **Flash 宽裕** 时的选择。速度优先 |
| ` -O3 ` | 激进：向量化、循环展开、更激进的内联 | 计算密集场景。代码会明显变大，可能不划算 |
| ` -Os ` | 以 **减小体积** 为目标（关掉少数会增大体积的 -O2 优化） | **嵌入式固件的默认选择** 。除非实测证明算力不够，否则从 -Os 起步 |
| ` -Ofast ` | -O3 \+ 违反 IEEE 浮点规范（-ffast-math） | ✕ 慎用：浮点结果可能不符合预期，非结合律 |
| ` -flto ` | 链接期优化：跨 .o 文件内联 | 能让出 5-20% 体积/性能。需要整个项目一起编 |

 

✕ 优化等级变化引发的三类"灵异事件"

 

 
1. **` -O0 ` 能跑，` -O2 ` 就不行** ：最常见的元凶是 ` volatile ` 缺失（见 Module 02）， 或代码里有未定义行为（有符号溢出、越界、类型双关）被优化器"利用"了。
 
2. **变量在 GDB 里显示 ` <optimized out> `** ：值被放进了寄存器或被完全消除。 调试期用 ` -Og `，或把关键变量声明为 ` volatile `。
 
3. **延时循环被优化没了** ：` for(i=0;i<100000;i++); ` 在 -O2 下会被整个删掉。 用 ` volatile ` 计数器或 ` __NOP() ` \+ 硬件定时器。

 

嵌入式推荐的一套编译选项 Makefile

 

```text
# ==================== 目标平台 ====================
# Cortex-M3（STM32F103）为例
CPU      = -mcpu=cortex-m3
FPU      =                                    # M3 无硬件 FPU
# Cortex-M4F（STM32F407）用这行：
# CPU    = -mcpu=cortex-m4
# FPU    = -mfpu=fpv4-sp-d16 -mfloat-abi=hard

THUMB    = -mthumb                            # Cortex-M 只跑 Thumb，必加
MCU      = $(CPU) $(FPU) $(THUMB)

# ==================== 优化与语言 ====================
OPT      = -Og                                # 开发期；量产先试 -Os，实测算力不够再上 -O2
LTO      =                                     # 量产可加 -flto

# ---- 严格语言标准与警告（这是代码质量的第一道防线）----
WARN     = -Wall -Wextra -Wshadow -Wdouble-promotion \
           -Wundef -Wconversion -Wsign-conversion \
           -Wcast-align -Wpointer-arith -Wstrict-prototypes \
           -Wmissing-prototypes -Wmissing-declarations

CSTD     = -std=c11

# -fno-common：多个 .o 定义同名全局 → 直接报错（而非静默合并）
# -ffunction-sections -fdata-sections：每个函数/变量独立成段（配合 --gc-sections 瘦身）
LANG     = -fno-common \
           -ffunction-sections -fdata-sections

# ==================== 调试信息 ====================
DBG      = -g3 -gdwarf-4                       # -g3 包含宏定义，方便 GDB 里看宏

# ==================== 链接选项 ====================
LDSCRIPT = -T STM32F103C8T6.ld
LDFLAGS  = $(MCU) $(LDSCRIPT) \
           -Wl,-Map=build/firmware.map \
           -Wl,--gc-sections \
           -Wl,--print-memory-usage \
           -Wl,--cref \
           --specs=nano.specs \
           --specs=nosys.specs
# 说明写在下面而不是贴在续行反斜杠后面 —— 原因见本节后面的「Makefile 三大坑」：
#   -Wl,-Map=build/firmware.map   生成 map 文件（体积分析必备）
#   -Wl,--gc-sections             删除未被引用的段（配合 -ffunction-sections -fdata-sections）
#   -Wl,--print-memory-usage      链接完直接打印 RAM/Flash 占用百分比
#   -Wl,--cref                    map 里加交叉引用表
#   --specs=nano.specs            用 newlib-nano（体积小很多）
#   --specs=nosys.specs           无系统调用桩（等价于 -lnosys，但能避开链接顺序问题）

# ==================== 完整编译命令 ====================
CFLAGS   = $(MCU) $(OPT) $(CSTD) $(WARN) $(LANG) $(DBG) $(LTO) \
           -I./Inc -I./Drivers/CMSIS/Include \
           -DUSE_HAL_DRIVER -DSTM32F103xB

# 典型编译命令
# arm-none-eabi-gcc $(CFLAGS) -c Src/main.c -o build/main.o
# arm-none-eabi-gcc $(CFLAGS) $(LDFLAGS) build/*.o -o build/firmware.elf
```

 

◆ 三个真正能瘦身的选项（联合使用才有效）

 

```text
-ffunction-sections -fdata-sections  (编译)  +  -Wl,--gc-sections  (链接)
```

 

默认情况下， *一个 ` .c ` 文件里的所有函数都在同一个 ` .text ` 段* 。 只要这个文件里有 **任意一个函数** 被用到，链接器就得把整个段保留——包括那些没用的函数。   
  
 ` -ffunction-sections ` 让 **每个函数独立成段** （` .text.my_func `）， ` --gc-sections ` 就能精确删除未引用的段。  **在大型项目上通常能省 10%-30% 的 Flash。**    
  
 ⚠ 注意：这也意味着 **中断向量表必须用 ` KEEP() ` 保护** （见 4.4 节）， 否则它会被当作"没人引用的段"删掉——症状是烧录后立刻 HardFault。

 

```zhizhan-anchor
ch5-4-1
```



### 5.4.1 用 map 文件做体积分析

 

bashfirmware.map 实战

 

```text
$ arm-none-eabi-gcc ... -Wl,--print-memory-usage ...
Memory region         Used Size  Region Size  %age Used
           FLASH:       24180 B        64 KB     36.90%
             RAM:        3372 B        20 KB     16.46%

$ grep -A 30 "Linker script and memory map" build/firmware.map | head -40

$ arm-none-eabi-nm --size-sort --print-size build/firmware.elf | tail -10 | tac
# --size-sort 是"升序"，tail 取末尾（也就是最大的几个），
# 再用 tac 反转成降序 —— 最胖的排在最上面，一眼看得出来。
# 列序是：地址 大小 类型 符号名（--print-size 把大小插在地址之后）
0800321c 00002000 T g_audio_table        ← 8 KB 的表，考虑移到外部 Flash
0800521c 00000800 T g_font_bitmap
08005a1c 0000037c T dsp_process          ← 单个函数 892 字节，考虑 -O2 重编
2000008c 00000800 b s_cache              ← 2048 字节（2 KB）；小写 b = static，外部链接不到
2000088c 00000400 B g_rx_buffer          ← 1024 字节（1 KB）接收缓冲；大写 B = 非 static 全局

# map 文件里还能看到"哪个 .o 贡献了多少"
$ grep -E '\.text\s+0x' build/firmware.map | sort -k2 -r | head
 .text.dsp_process    0x200   build/dsp.o
 .text.fft_radix2     0x180   build/dsp.o
 .text.uart_isr       0x90    build/uart.o
← 被 --gc-sections 丢掉的段不在这个段里，它们在 map 顶部的
#    "Discarded input sections" 段（不是 "removed"，grep 这个词什么也搜不到）
```

 

```zhizhan-anchor
ch5-4-2
```



### 5.4.2 map 文件的六个标准段落

 

上一节用的是编好的 ` firmware.map `。这一节我们 **从零造一份 map** ， 把一个程序"该被丢的东西"一次性凑齐，然后挨个段落读过去。 读懂这六个段落，你就有了回答"我的 Flash 到底被谁吃了"的全部材料——  *不需要额外的工具，链接器早就把答案写在这个文件里了* 。

 

先看这份小程序。它的每一个全局对象都是 **故意的** ： 有人调用的函数、没人调用的函数、只被读一次的常量表、有初值的全局变量、 没有初值的大数组，再加一个 **在别的源文件里** 的函数。

 

mapdemo2.c — 一个"该丢的东西"齐全的小程序 C

 

```text
/* mapdemo2.c —— 六种情况一次凑齐，专门用来喂 map 文件
 *   有人用的函数 / 没人用的函数 / 常量表 / 有初值的全局 /
 *   没初值的大数组 / 在别的源文件里的函数 */
#include <stdint.h>

int util_used(void);                        /* 定义在 util.c，最后编成 libutil.a */

const uint32_t g_tbl[4] = { 1, 2, 3, 4 };   /* .rodata */
uint32_t       g_calib  = 0x11223344;       /* .data  */
uint32_t       g_zero[16];                  /* 无初值的全局 → COMMON */
static uint32_t s_used  = 7;                /* static → 本文件私有 */

uint32_t never_called(void) { return 42; }  /* 没有任何人调用它 */

int main(void)
{
    g_zero[0] = g_calib + s_used + g_tbl[0] + (uint32_t)util_used();
    return 0;
}
```

 

util.c — 编成静态库的成员：一个有人用、一个没人用 C

 

```text
/* util.c —— 打成 libutil.a，用来说明"库成员是怎么被拉进来的" */
int g_common;                              /* 有 -fcommon 时是 COMMON 符号 */

int util_used(void)   { return g_common + 1; }   /* main 引用它 → 整个成员被拉进来 */
int util_unused(void) { return 99; }             /* 没人引用 → 等着被丢掉 */
```

 

mapdemo\_good.ld — .data 有 AT \> FLASH，LMA 与 VMA 分离 linker script

 

```text
/* mapdemo_good.ld —— 故意写得很短的脚本，只为了在 map 里看清段是怎么摆的 */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}
ENTRY(main)
SECTIONS
{
  .text : { *(.text*) *(.rodata*) } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

bash造一份 map：编两个文件 \+ 打一个库 \+ 链一次

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -std=c11 \
    -fcommon -ffunction-sections -fdata-sections -c src/mapdemo2.c -o b/mapdemo2.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -std=c11 \
    -fcommon -ffunction-sections -fdata-sections -c src/util.c -o b/util.o
$ arm-none-eabi-ar rcs lib/libutil.a b/util.o

# 关键的一步：-Wl,-Map= 让链接器把施工记录写下来，-Wl,-cref 额外要一张交叉引用表
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os \
    -fcommon -ffunction-sections -fdata-sections \
    -nostdlib -nostartfiles \
    -Wl,--gc-sections -Wl,-cref -Wl,-Map=b/full.map \
    -T src/mapdemo_good.ld b/mapdemo2.o -L lib -lutil -o b/full.elf
$ echo $?          ← 退出码 0，一声不吭
0
```

 

注意最后那行： **链接器什么也没说，退出码 0** 。所有值得看的东西都在 ` b/full.map ` 里。下面是这份 map 的 **完整内容** ， 一字未改（工具链是 mingw 版，行尾是 CRLF，这一点后面还会提）。  **下面这张表里所有的行号，都是指这份转录的行号** —— 离开了这份转录，行号本身没有意义，原因见转录之后第一个框：

 

b/full.map实测转录 · 共 106 行 · 一字未改

 

```text
Archive member included to satisfy reference by file (symbol)

lib\libutil.a(util.o)         b/mapdemo2.o (util_used)

Allocating common symbols
Common symbol       size              file

g_zero              0x40              b/mapdemo2.o
g_common            0x4               lib\libutil.a(util.o)

Discarded input sections

 .text          0x00000000        0x0 b/mapdemo2.o
 .data          0x00000000        0x0 b/mapdemo2.o
 .bss           0x00000000        0x0 b/mapdemo2.o
 .text.never_called
                0x00000000        0x4 b/mapdemo2.o
 .rodata.g_tbl  0x00000000       0x10 b/mapdemo2.o
 .text          0x00000000        0x0 lib\libutil.a(util.o)
 .data          0x00000000        0x0 lib\libutil.a(util.o)
 .bss           0x00000000        0x0 lib\libutil.a(util.o)
 .text.util_unused
                0x00000000        0x4 lib\libutil.a(util.o)

Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00040000         xr
RAM              0x20000000         0x00010000         xrw
*default*        0x00000000         0xffffffff

Linker script and memory map

LOAD b/mapdemo2.o
LOAD lib\libutil.a

.text           0x08000000       0x2c
 *(.text*)
 .text.startup.main
                0x08000000       0x20 b/mapdemo2.o
                0x08000000                main
 .text.util_used
                0x08000020        0xc lib\libutil.a(util.o)
                0x08000020                util_used
 *(.rodata*)

.glue_7         0x0800002c        0x0
 .glue_7        0x0800002c        0x0 linker stubs

.glue_7t        0x0800002c        0x0
 .glue_7t       0x0800002c        0x0 linker stubs

.vfp11_veneer   0x0800002c        0x0
 .vfp11_veneer  0x0800002c        0x0 linker stubs

.v4_bx          0x0800002c        0x0
 .v4_bx         0x0800002c        0x0 linker stubs

.iplt           0x0800002c        0x0
 .iplt          0x0800002c        0x0 b/mapdemo2.o

.rel.dyn        0x0800002c        0x0
 .rel.iplt      0x0800002c        0x0 b/mapdemo2.o

.data           0x20000000        0x4 load address 0x0800002c
 *(.data*)
 .data.g_calib  0x20000000        0x4 b/mapdemo2.o
                0x20000000                g_calib

.igot.plt       0x20000004        0x0 load address 0x08000030
 .igot.plt      0x20000004        0x0 b/mapdemo2.o

.bss            0x20000004       0x44 load address 0x08000030
 *(.bss*)
 *(COMMON)
 COMMON         0x20000004       0x40 b/mapdemo2.o
                0x20000004                g_zero
 COMMON         0x20000044        0x4 lib\libutil.a(util.o)
                0x20000044                g_common
OUTPUT(b/full.elf elf32-littlearm)
LOAD linker stubs

.comment        0x00000000       0x45
 .comment       0x00000000       0x45 b/mapdemo2.o
                                 0x46 (size before relaxing)
 .comment       0x00000045       0x46 lib\libutil.a(util.o)

.ARM.attributes
                0x00000000       0x2d
 .ARM.attributes
                0x00000000       0x2d b/mapdemo2.o
 .ARM.attributes
                0x0000002d       0x2d lib\libutil.a(util.o)

Cross Reference Table

Symbol                                            File
g_calib                                           b/mapdemo2.o
g_common                                          lib\libutil.a(util.o)
g_tbl                                             b/mapdemo2.o
g_zero                                            b/mapdemo2.o
main                                              b/mapdemo2.o
never_called                                      b/mapdemo2.o
util_unused                                       lib\libutil.a(util.o)
util_used                                         lib\libutil.a(util.o)
                                                  b/mapdemo2.o
```

 

106 行，看着像天书。其实它的骨架只有 **六个段落** ，而且顺序是固定的。 下表左边是段落的 *逐字标题* 和 **实测行号** （就是上面那份文件的行号， 可以直接对着数），右边是"它什么时候才会出现"：

 

| 段落标题（逐字） | 实测行号 | 出现的条件 |
| --- | --- | --- |
| ` Archive member included to satisfy reference by file (symbol) ` | 1 | 只有 **真的从 ` .a ` 里拉出成员** 时才出现。本例里 main 调用了 ` util_used `，所以 ` util.o ` 被拉进来 |
| ` Allocating common symbols ` | 5 | 只有存在  **COMMON 符号** （` -fcommon ` 下无初值的全局变量）时才出现。两个源文件都有，列在下面 |
| ` Discarded input sections ` | 11 | 带 ` --gc-sections ` 时出现。 **没有东西可丢时不是消失，而是改写成一行**  ` There are no discarded input sections `，位置不变 |
| ` Memory Configuration ` | 25 | 总有。三个存储区的起点、长度、权限 |
| ` Linker script and memory map ` | 32 | 总有。主体部分：每个段落在哪个地址、谁贡献的 |
| ` OUTPUT(…) ` / ` LOAD linker stubs ` | 80 / 81 | 前者总有（回报输出文件），后者只在链接器需要造跳板时才有内容 |
| ` Cross Reference Table ` | 95 | **只有加 ` -cref ` 才有** 。不加这个选项，整个段落不会出现 |

 

⚠ 先记住一件事： **这些行号不是 map 的固有属性**

 

上面那张表里的行号（1 / 5 / 11 / 25 / 32 / 81 / 95），只在  **"输入文件名很短"** 这个前提下成立 —— 也就是本例这种写法： ` b/mapdemo2.o `、` lib\libutil.a(util.o) `。

 

同一个程序、同一组选项，只是把命令行换成 **很长的绝对路径**  （真实工程里到处都是，比如 ` build/CMakeFiles/app.dir/src/main.c.obj `）， map 的 **第 3 行就会折成两行** ：

 

短路径 vs 长路径形状示意（中间用 … 省略）；行数与行号是实测值

 

```text
# 短路径：本节的转录，第 3 行一行装得下
lib\libutil.a(util.o)         b/mapdemo2.o (util_used)

# 长路径：同样一行内容，被 ld 折成了两行（第 4 行以空格开头，是个续行）
…\build\lib\libutil.a(util.o)
                              …\build\obj\main.c.obj (util_used)
```

 

多出来的这一行会把后面 **每一个** 段落往下推一行。 这个对照是实测过的： **同一份源码、同一组选项** ，只把输入路径换成长的， 整份 map 从  **106 行变成 107 行** ， ` Allocating common symbols ` 从第  **5**  行落到第  **6**  行，` Discarded input sections ` 从第  **11**  行落到第  **12**  行，一路推到底。   
  
 所以： **不要背行号，要 grep 段名** 。行号只适合用来读"紧接着段名下面的那几行"， 而且仅限你手上这一份 map。这一条也算个提醒 —— 凡是"把工具输出当固定格式背下来" 的做法，早晚会在换一台机器、换一个路径长度的时候失效。

 

下面把其中 **最容易读错的三段** 单独拆出来讲。剩下的 ` Memory Configuration ` 和 ` Linker script and memory map ` 靠"对着地址数"就能读， 不需要额外解释。

 

⚠ 第一段就有人读错：被 ` --gc-sections ` 丢掉的东西不叫 "removed"

 

这是本站自己的前几版里写错的一处，值得单独拎出来： 很多人（包括搜索引擎里的不少答案）会说"被 gc 掉的段在 map 里标注 ` removed `"。  **实测：map 里根本没有 "removed" 这个词** ， ` grep removed b/full.map ` 什么都搜不到。

 

真实情况是它们被整段搬到了 **文件顶部** 一个叫 ` Discarded input sections ` 的段落里（本例第 11 行起）， 第 13–23 行就是全部被丢掉的东西：

 

| 被丢掉的段 | 大小 | 为什么该丢 |
| --- | --- | --- |
| ` .text ` / ` .data ` / ` .bss ` | ` 0x0 ` | 空段。` -ffunction-sections ` 之后每个函数独立成段，这几个"总段"就没有内容了 |
| ` .text.never_called ` | ` 0x4 ` | 没有任何调用点。 **这就是 ` -ffunction-sections ` \+ ` --gc-sections ` 想要的效果** |
| ` .rodata.g_tbl ` | ` 0x10 ` | 16 字节的常量表。 **注意：它被丢掉不是链接器的功劳** ，见下一个框 |
| ` .text.util_unused ` | ` 0x4 ` | 库里的 ` util_unused `： **成员被拉进来了，但成员里没用的函数照样丢** |

 

还有一个细节：` Discarded input sections ` 这个标题  **不是"有内容才出现"** 。把 ` --gc-sections ` 去掉再链一次， 它的位置（还是第 11 行）会变成一行字：` There are no discarded input sections `。 也就是说—— *看到这一行，说明你根本没开 gc，而不是"没有浪费"* 。

 

◆ ` .rodata.g_tbl ` 是编译器丢的，不是链接器丢的

 

这一条很容易看反。` g_tbl ` 在 ` main ` 里明明被用了： ` g_tbl[0] `。可它整张表（` 0x10 ` 字节）出现在"被丢掉"的清单里。

 

原因是 ` -Os ` 在 **编译期** 就把 ` g_tbl[0] ` 求值成了字面量 ` 1 `，于是目标文件里再也没有任何代码引用这张表。 链接器看到的只是一段"没人引用的数据段"，照章丢弃。   
  
 所以读 map 的一条通用心法： **map 告诉你"谁被丢了"，但不告诉你"是谁决定的"。**  链接器只会丢"没人引用"的东西；至于"为什么会没人引用"，答案通常在编译器的优化里， 得回头看生成的汇编。

 

◈ ` Cross Reference Table ` 的方向：是"符号 ← 定义它的文件"，不是"谁引用了谁"

 

第 95 行起的那张表，列的是 **符号** 和 **定义它的文件** 。证据就在表里： ` never_called ` 和 ` util_unused ` 这两个函数 刚刚才被 ` --gc-sections ` 丢掉，却照样出现在这张表上 （第 103、104 行）——因为它们确实 *定义* 在那里，只是没被采用。 想查"谁引用了谁"，应该看的是别的段落： ` Archive member included to satisfy reference by file (symbol) ` 那一行， 格式是 **被拉进来的成员 ← 引用它的文件（引用的符号）** ， 本例第 3 行：` lib\libutil.a(util.o)  b/mapdemo2.o (util_used) `。

 

◈ ` LOAD ` 行有两层意思，别只看第一层

 

第 34–35 行的 ` LOAD b/mapdemo2.o ` / ` LOAD lib\libutil.a ` 列出的是 **输入文件** ；而第 81 行的 ` LOAD linker stubs ` 指的是 **链接器自己造的跳板** ——本例里是空的，因为在 Cortex-M3 上没有 ARM/Thumb 状态切换的需求。 （什么时候会有，见 [§4.4.3](doc:course-b01-ch4#ch4-4-3) 讲 veneer 的那一节。）

 

真正关心 VMA 与 LMA 的时候，看的是每个 **输出段** 标题行后面那半句： 第 65 行 ` .data  0x20000000  0x4 load address 0x0800002c ` —— VMA 在 RAM（` 0x20000000 `），LMA 在 Flash（` 0x0800002c `）， 一眼就能看出"初值存在 Flash、运行时搬到 RAM"。   
  
 顺带一个 **实测到的意外** ：第 73 行的 ` .bss ` 只写了 ` > RAM `、 **没有**  ` AT > FLASH `， 它却也被标了 ` load address 0x08000030 `（正好接在 ` .data ` 的 LMA 之后）。可见"没有 AT 就一定 LMA = VMA"这句话 在 **多个段连续排布** 时不成立。这里只报实测值，机制不属于本节范围， 真要下结论得去翻 ` ld ` 手册里 Output Section LMA 那一节。

 

⚠ 一个跨平台的坑：map 文件的行尾是 CRLF

 

mingw 构建的 Arm GNU Toolchain 写出来的 map 是  **CRLF**  行尾 （本次实测报告里也打出了这一条），Linux 原生工具链写出来的是 LF。 所以 ` grep `/` awk `/` sed ` 处理 map 时，` $ ` 锚点会莫名其妙失配，` $'\r' ` 会跟到字段尾巴上去。 **固定写法是先 ` dos2unix `， 或者在脚本里显式剥掉 ` \r `** —— 这一点在 CI 里换机器时最容易咬人：同一份 map，本地能跑的解析脚本在 Linux runner 上就换了行为。

 

```zhizhan-anchor
ch5-4-3
```



### 5.4.3 可复现构建：为什么你的固件每次编译哈希都不一样

 

先问一个问题： **你在本地编出来的 ` firmware.bin `， 和 CI 上编出来的那份，是同一个文件吗？**    
  
 大多数人会回答"应该是吧"。而正确答案是： **大概率不是** —— 即使源码一字不差、工具链同一个版本、参数一模一样。 这件事有个专门的名字叫 **可复现构建（reproducible build）** ：  *同一份源码 \+ 同一套工具链 \+ 同一组参数，无论如何重复，都产出逐字节相同的产物* 。   
  
 嵌入式为什么在乎它？三个很实际的理由：

 

| 场景 | 如果构建不可复现，会发生什么 |
| --- | --- |
| **[OTA](term:ota) 升级校验** | 你按哈希比对"设备上跑的固件 == 你发布的那份"，结果本地编一遍哈希就变了， **校验逻辑直接失效** ——要么误报，要么你就干脆关掉校验 |
| **多人 / 多机协作** | A 编出来 120 KB，B 编出来 120 KB，哈希却不同。` git ` 里那份"已发布的 bin"到底是谁编的、和源码对不对得上，说不清 |
| **安全审计与追溯** | 你声称"这个二进制就是这份源码的编译结果"，但 **没法验证** ——因为编译不可重复，任何人重编都得不到同一个文件 |

 

好消息是： **默认情况下 GCC 编出来的 ` .o ` 本来就是可复现的** 。 坏消息是： **有几个很常见的东西会把它破坏掉** ，而且破坏方式是"悄悄换掉几个字节"， 你从大小、从日志、从退出码上完全看不出来。 这一节我们就用一个最小实验，把这几个破坏源一个个抓出来。

 

repro.c — 不含任何时间宏：能不能两次编出同一个字节？ C

 

```text
/* repro.c —— 不含任何时间宏：能不能两次编出同一个字节？ */
#include <stdint.h>
uint32_t add3(uint32_t a, uint32_t b, uint32_t c) { return a + b + c; }
int main(void) { return (int)add3(1, 2, 3); }
```

 

stamp.c — 只多用了一个 \_\_DATE\_\_ / \_\_TIME\_\_ C

 

```text
/* stamp.c —— 只多用了一个 __DATE__ / __TIME__ */
#include <stdint.h>
const char g_built[] = __DATE__ " " __TIME__;
uint32_t add3(uint32_t a, uint32_t b, uint32_t c) { return a + b + c; }
int main(void) { return (int)add3(1, 2, 3) + (int)g_built[0]; }
```

 

两个文件几乎一样，` stamp.c ` 只多了一行 ` const char g_built[] = __DATE__ " " __TIME__; `。 这两行是编译器在 **编译那一刻** 填进去的字符串常量。

 

bash同一个源文件编两次，比对哈希（不设任何环境变量）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os \
    -nostdlib -nostartfiles -c repro.c -o r1.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os \
    -nostdlib -nostartfiles -c repro.c -o r2.o
$ sha256sum r1.o r2.o
611d0a3a9eafe2cd04f3a8d7ae3393fdcc4b2604af05b6b92410406def504f3f  r1.o
611d0a3a9eafe2cd04f3a8d7ae3393fdcc4b2604af05b6b92410406def504f3f  r2.o
# 64 位十六进制，一个字符不差。880 字节。

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 \
    -nostdlib -nostartfiles -c repro.c -o r0.o
$ stat -c%s r0.o r1.o
888
880
$ sha256sum r0.o
33e5a41c92602660…  r0.o          ← 和上面完全不是一个文件
```

 

◆ 结论一：默认可复现，但"可复现"必须 **连参数一起说**

 

同一份源码、同一条命令编两次 →  **逐字节相同** ，连 ` -frandom-seed ` 都不用给。   
  
 但换一个优化级别（` -O0 `）就 **既不是同一个大小、 也不是同一个哈希** 了。所以"可复现"这句话从来不是针对源码说的， 而是针对 **"源码 \+ 工具链版本 \+ 完整参数 \+ 环境"这一整套输入** 说的。 少写一个参数，这句话就不成立。

 

那破坏源在哪？把 ` stamp.c ` 用同样的方式编两次——注意中间要  **隔开一秒以上** ，原因下面说：

 

bash同一个源文件编两次，但这次里面有 \_\_DATE\_\_ / \_\_TIME\_\_

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os \
    -nostdlib -nostartfiles -c stamp.c -o s1.o
$ sleep 1.2                     ← __TIME__ 的分辨率是「秒」，不隔开一秒就测不出来
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os \
    -nostdlib -nostartfiles -c stamp.c -o s2.o
$ stat -c%s s1.o s2.o
988
988                             ← 大小一模一样，看不出任何异常
$ sha256sum s1.o s2.o
（两次的哈希不相同 —— 具体是什么值取决于你运行它的时刻，
   所以这里不印。要紧的是"它们不一样"这件事本身。）
```

 

✕ 结论二：唯一的破坏源，就藏在 ` .rodata ` 里那 20 个字节

 

` __DATE__ ` 展开成 ` "Oct  8 2026" `（11 字符， 日期小于 10 时前面补一个空格，长度固定），` __TIME__ ` 展开成 ` "22:13:20" `（8 字符）。中间加一个空格，正好  **20 个字节的只读字符串** ，落在 ` .rodata ` 里。   
  
 两次编译的差别， **全部落在这 20 个字节里** ：绝大多数情况下就是秒的那一位 （两次挨得很近时只差最后一个字符，实测里 ` :56 ` 与 ` :57 ` 就只差一位）；偶尔跨过整分钟，那会差上两三位。 无论差几位，它都会让 **整个产物** 的 sha256 全变——哪怕大小一个字节都没差。   
  
 这就是"我的固件每次编译哈希都不一样"最常见的原因： 项目里某个角落有一行 ` printf("build %s %s\n", __DATE__, __TIME__) `， 或者一个"版本信息"字符串，或者某个库的启动横幅。  **它在源码里看起来人畜无害，代价却落在整包固件上。**

 

上面那个"具体值取决于运行时刻"的说法听着像在打太极。所以我们换一个  **完全确定** 的做法：把构建时间 **当成一个输入变量钉住** —— 它就是 ` SOURCE_DATE_EPOCH `，值是 Unix 时间戳（秒）。 GCC 看到它之后，` __DATE__ ` / ` __TIME__ ` 不再读挂钟，而是读这个数。

 

bash钉住 SOURCE\_DATE\_EPOCH，同一个源文件编两次 \+ 换一个 [epoch](term:epoch) 再编一次

 

```text
$ SOURCE_DATE_EPOCH=1700000000 arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb \
    -std=c11 -Os -nostdlib -nostartfiles -c stamp.c -o e1.o
$ sleep 1.2                     ← 照样隔开一秒：要证明的是"时间真的被钉住了"，不是"跑得快"
$ SOURCE_DATE_EPOCH=1700000000 arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb \
    -std=c11 -Os -nostdlib -nostartfiles -c stamp.c -o e2.o
$ SOURCE_DATE_EPOCH=1700000100 arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb \
    -std=c11 -Os -nostdlib -nostartfiles -c stamp.c -o e3.o
# 下面这张表要三行并排看，64 位十六进制铺满屏幕反而不好比，
# 所以只取前 16 位（cut -c1-16,65-）。完整哈希是同一串。
$ sha256sum e1.o e2.o e3.o | cut -c1-16,65-
7e04705beb3ae357  e1.o
7e04705beb3ae357  e2.o          ← 隔了 1.2 秒，照样逐字节相同
43568ef6fb91e09f  e3.o          ← 只把 epoch 加 100 秒，整包就变了

$ arm-none-eabi-objdump -s -j .rodata e1.o e3.o
e1.o:     file format elf32-littlearm

Contents of section .rodata:
 0000 4e6f7620 31342032 30323320 32323a31  Nov 14 2023 22:1
 0010 333a3230 00                          3:20.

e3.o:     file format elf32-littlearm

Contents of section .rodata:
 0000 4e6f7620 31342032 30323320 32323a31  Nov 14 2023 22:1
 0010 353a3030 00                          5:00.
```

 

◆ 结论三：解药就是 ` SOURCE_DATE_EPOCH `，代价是"版本号不再自动"

 

对比 ` e1.o ` 与 ` e3.o ` 的 ` .rodata `：字节 ` 33 3a 32 30 `（"3:20"） 变成了 ` 33 3a 30 30 `（"5:00"）—— **只差一个字节** ， 而整包的 sha256 从 ` 7e04705b… ` 变成了 ` 43568ef6… `。   
  
  **这就是那句话的完整证据链：一个字节的差别，就能让整包固件的哈希全变。**    
  
 落地时要注意一个取舍：钉住 epoch 之后， **固件里的构建时间就不再是"真实编译时刻"了** 。 所以工程上的做法通常是 **二选一** ：

 

 
- **要可复现**  → 在 Makefile/CMake 里显式给 ` SOURCE_DATE_EPOCH `（很多项目取 ` git log -1 --format=%ct `， 即"最后一次提交的时间"——它既是确定的，又是有意义的版本信息）；
 
- **要真实构建时间**  → 就别在固件里嵌时间， 把它放在 **发布记录** 里（文件名、Git tag、CI 元数据），而不是塞进二进制。

 

⚠ ` -frandom-seed ` 不是"可复现构建的开关"，别抄错作业

 

网上讲可复现构建的文章里，` -frandom-seed=0 ` 出现的频率极高。 但在本例（纯 C、不开 LTO、不含时间宏）里实测： ` -frandom-seed=1 `、` -frandom-seed=2 `、  **完全不加** ，三者的 sha256 完全相同（都是 ` 611d0a3a… `）。   
  
 它针对的是 **编译器需要自己生成名字** 的场合——LTO 下的静态符号改名、 C\+\+ 匿名命名空间的修饰名等等（这一条是手册事实，本例里看不到区别）。  **把它当成可复现构建的万能钥匙，是把症状当成了病因。**

 

编译侧讲完了，链接侧还有两件事要说。先看默认情况：

 

bash链接两次，以及 readelf -n 里到底有没有东西

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -nostdlib -nostartfiles \
    r1.o -o l1.elf
ld.exe: warning: cannot find entry symbol _start; defaulting to 00008000
# 这句告警的原因：-nostartfiles 去掉了启动代码，而默认链接脚本要找的入口符号
# 是 _start，不是 main。这里只关心链接产物本身，所以让它照默认值走。
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -nostdlib -nostartfiles \
    r1.o -o l2.elf
$ sha256sum l1.elf l2.elf | cut -c1-16,65-
a8d9d3644f486be7  l1.elf
a8d9d3644f486be7  l2.elf          ← 5100 字节，两次相同

$ arm-none-eabi-readelf -n l1.elf
（没有任何输出 —— 这份 ELF 里没有 .note.gnu.build-id）
```

 

"什么都没有"这句话最难证明：空输出到底是"真的没有"，还是"命令根本没跑成"？ 这一点交付时的做法是 **把两种可能都印出来** ——退出码 0、且 stdout 里确实一个字节都没有。 接下来加上 ` -Wl,--build-id `，同样的源码、同样的链接参数，只多这一个开关：

 

bash加上 --build-id：多出来的是什么，它会不会破坏可复现

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -nostdlib -nostartfiles \
    -Wl,--build-id r1.o -o bi1.elf
ld.exe: warning: cannot find entry symbol _start; defaulting to 00008024
# 注意入口地址从 00008000 变成了 00008024 —— build-id 那段被放在了最前面，
# 整个镜像往后挪了 0x24 字节。
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -nostdlib -nostartfiles \
    -Wl,--build-id r1.o -o bi2.elf
ld.exe: warning: cannot find entry symbol _start; defaulting to 00008024
$ sha256sum bi1.elf bi2.elf | cut -c1-16,65-
a249a28edf26b531  bi1.elf         ← 5212 字节（比上面多了 112）
a249a28edf26b531  bi2.elf         ← 链接两次仍然相同

$ arm-none-eabi-readelf -n bi1.elf
Displaying notes found in: .note.gnu.build-id
  Owner                Data size   Description
  GNU                  0x00000014 NT_GNU_BUILD_ID (unique build ID bitstring)
    Build ID: 384e1841e67384c55dbae9b2f705b4c8b355695e

$ arm-none-eabi-objdump -h bi1.elf | grep -i note
  0 .note.gnu.build-id 00000024  00008000  00008000  00001000  2**2
```

 

◈ build-id 是 **内容的哈希** ，不是时间戳 —— 所以它不破坏可复现性

 

` Build ID: 384e1841e67384c55dbae9b2f705b4c8b355695e ` 这 20 字节， 是链接器对产物内容算出来的摘要。所以：

 

 
- **同一份输入 → 同一个 build-id** ：上面 ` bi1.elf ` 与 ` bi2.elf ` 连链两次，哈希逐字节相同，证明它不是随机数；
 
- **换一个字节 → build-id 就变** ：这正是它的用途。调试器、崩溃转储、 OTA 服务器都靠它认"这堆代码到底是哪一次构建"；
 
- 它会让 ELF  **变大** （5100 → 5212 字节）、哈希 **改变** ， 但不会让它 **不可复现** ——这两件事经常被混为一谈。

 

⚠ 最后一个坑：共享库漏了符号，链接器 **不会告诉你**

 

可执行文件里少一个符号，` ld ` 当场报错。但换成 ` -shared ` 编共享库 / 插件，默认行为是  **把未定义符号原样留在 ` .dynamic ` 里，一声不吭地成功** —— 错误被推迟到 **加载时** 才炸，而在嵌入式里那可能意味着"设备在客户现场起不来"。

 

undef.c — 故意只声明、不定义：wrap() 调了一个不存在的函数 C

 

```text
/* undef.c —— 故意只声明、不定义：wrap() 调了一个不存在的函数 */
extern int who_knows(void);
int wrap(void) { return who_knows() + 1; }
```

 

bash-shared 的默认行为 vs 加上 --no-undefined

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -nostdlib -nostartfiles \
    -c undef.c -o u.o          # 编译期一切正常：u.o 里那个符号就是 U（未定义）

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -nostdlib -nostartfiles \
    -shared u.o -o u_def.elf
$ echo $?
0                              ← 退出码 0，1812 字节的 .so 照样生成了

$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -nostdlib -nostartfiles \
    -shared -Wl,--no-undefined u.o -o u_nou.elf
u.o: in function `wrap':
undef.c:(.text+0x4): undefined reference to `who_knows'
collect2.exe: error: ld returned 1 exit status
$ echo $?
1                              ← 这次在链接期就被拦下了
```

 

◆ 落地清单：把可复现构建当成一条 **会被 CI 检查的规则**

 

光知道原理没用，得让它变成"错了就红"。可以照这四条做：

 

 
1. **编两次比对哈希** ：CI 里把目标编两遍（可以清扫中间产物后再编一遍）， 对 ` .bin `/` .elf ` 算 sha256，不同就失败。  *这是唯一能自动发现"有人又往固件里塞了 ` __TIME__ `"的办法。*
 
2. **钉住 ` SOURCE_DATE_EPOCH `** ：取值用 ` git log -1 --format=%ct `，写进构建系统而不是靠人记。
 
3. **写清"可复现"的前提** ：工具链版本（本仓库用的是 Arm GNU Toolchain 13.3.Rel1）、完整参数、环境变量。 **少一样，这句承诺就不成立。**
 
4. **共享库一律加 ` -Wl,--no-undefined `** ：它把"加载时才炸" 提前成"链接时就炸"，成本是一个开关。

 

```zhizhan-anchor
ch5-4-4
```



### 5.4.4 调试信息：` -g ` 到底往产物里塞了什么

 

上一节最后那句"调试信息不进固件"值得单独拆开讲。因为围绕 ` -g ` 的误解特别多： 有人说"加 ` -g ` 会让 Flash 变大"，有人说"` -g3 ` 能看见宏就一定要开"， 还有人说"ESP-IDF 写死 ` -gdwarf-4 ` 是因为调试器不认 DWARF 5"。 这三句话都能用同一条命令问清楚——把产物量一遍。

 

实验对象还是 §5.4.3 那个 ` repro.c `（十几行、不含任何时间宏）， 只换 ` -g ` 这一族参数，其余不变。为了让字节数 **在任何机器上都一样** ， 下面这一组数据是 **把编译时的工作目录钉在源码所在目录、只传裸文件名** 量出来的 （理由见本节最后那个盒子——这一步不做，你复现出来的数字会和我差几十个字节）：

 

| 参数 | ` .o ` 字节 | sha256（前 16 位） | 关键证据 |
| --- | --- | --- | --- |
| 不加 ` -g ` | 880 | ` 611d0a3a9eafe2cd ` | 没有任何 ` .debug_* ` 节 |
| ` -g0 ` | 880 | ` 611d0a3a9eafe2cd ` | **与"不加 ` -g `"逐字节相同** |
| ` -g ` | 3312 | ` 28270ee4814e3c1b ` | **Version: 5** ，语言码  **29 (C11)** ；` .debug_info ` 0xf4、 ` .debug_str ` 0x10a（266） |
| ` -g2 ` | 3312 | ` 4956b48e6d9265a1 ` | 尺寸与 ` -g `  **一模一样** ， ` .debug_str ` 0x10b（267）——只差 producer 里一个字符 |
| ` -g1 ` | 2208 | ` dc7c16b9dff3f9bd ` | ` .debug_info ` 只有 0x4f； **连 ` .debug_loclists ` 都没有** |
| ` -g3 ` | 29532 | ` 1eea737a27c2def6 ` | **八个 ` .debug_macro ` 节** ； ` .debug_str ` 涨到 0x3c46（15430） |
| ` -gdwarf-4 ` | 3400 | ` 7a9865b53c01f07c ` | **Version: 4** ，语言码退回  **12 (ANSI C99)** ； 节名变回 ` .debug_loc ` / ` .debug_ranges ` |
| ` -gdwarf-5 ` | 3320 | ` c9fa9752bfe4ed6c ` | Version 5，语言码 29 (C11)；节名是 ` .debug_loclists ` / ` .debug_rnglists ` |

 

◆ 第一条结论：这台工具链上，` -g `  **默认就是 DWARF 5**

 

裸写 ` -g `，` readelf --debug-dump=info ` 报的就是 ` Version: 5 `，语言码 ` 29 (C11) `—— 和显式写 ` -gdwarf-5 ` 是同一个版本。   
  
 所以 ` -gdwarf-4 ` 在这条工具链上 **不是"默认"，而是一次降级** 。 知道这一点，才能读懂下一段 ESP-IDF 的源码。

 

⚠ 第二条：` .o ` 大小相同 **不等于** 内容相同，` -g ` 与 ` -g2 ` 就是反例

 

` -g ` 与 ` -g2 ` 编出来的 ` .o `  **都是 3312 字节** ，但 sha256 一个是 ` 28270ee4… `、 一个是 ` 4956b48e… `。差别在哪？   
  
 在 ` DW_AT_producer `——编译器把 **自己的命令行原样抄进了调试信息** ， ` -g2 ` 比 ` -g ` 多一个字符 ` 2 `， ` .debug_str ` 就从 266 变成 267 字节。   
  
 这恰好接上 §5.4.3 的主题： **构建参数是产物身份的一部分** 。 它甚至不需要改变任何代码的语义，只要出现在命令行里，就能让哈希变掉。 反过来说—— **"哈希不同"永远不能单独当作"内容有实质差异"的证据** ， 得看差在哪一节、差多少字节。这里的差是 1 字节，而且是字符串表。

 

✕ 第三条（要纠正的说法）：降级到 DWARF 4  **不是无损的**

 

网上常见的说法是"DWARF 4 和 5 差不多，随便用一个就行"。实测的差别至少有四处：

 

| 观察点 | ` -gdwarf-5 ` | ` -gdwarf-4 ` |
| --- | --- | --- |
| 版本号 | Version 5 | Version 4 |
| 语言代码 | ` 29 (C11) ` | ` 12 (ANSI C99) ` ←  **退回上一代** |
| 变量位置表 | ` .debug_loclists ` 70 字节 | ` .debug_loc ` 86 字节 |
| 地址范围表 | ` .debug_rnglists ` 25 字节 | ` .debug_ranges ` 24 字节 |

 

语言代码那一行最值得留意： **DWARF 4 的语言代码表里根本没有 C11**  （` DW_LANG_C11 = 0x1d ` 是 DWARF 5 才加进去的，这是 DWARF 规范事实）， 所以 GCC 只能 **往回退一格** 报成 C99。调试器读到的"这门语言是 C99"—— 对 ` _Generic `、` _Static_assert ` 这些 C11 特性来说，是会认错的。

 

体积上，本例 ` -gdwarf-4 ` 反而 **比 ` -gdwarf-5 ` 大 80 字节**  （3400 vs 3320）。有意思的是：把所有 ` .debug_* ` 节的尺寸加起来， 两者只差 20 字节—— **剩下那 60 字节根本不来自调试内容本身** ，而是节头、对齐、 偏移这些结构开销。所以 **别拿一个几十行的例子去外推"哪个版本更省 Flash"** ， 这个方向的结论要在真实工程上量。

 

⚠ 第四条（最实用的一条）： **调试信息里藏着你的绝对路径** ，它会让产物不可复现

 

这是 ` -g ` 最容易被忽略的副作用，也是它 **破坏可复现构建** 的方式—— 和 ` __DATE__ ` 那条路子完全不同：

 

 
- ` DW_AT_name ` 记的是 **源码文件的路径** ；
 
- ` DW_AT_comp_dir ` 记的是 **编译时的工作目录** ；
 
- 两者都 **原封不动** 写进 ` .debug_str `。
 

 

这意味着： **同一份源码，放在两个不同的绝对路径下编译，` .o ` 就不一样** 。 我用一条 54 字符的假路径做了对照实验（把工作目录"钉"成那个名字）：

 

| 工作目录 | ` .debug_str ` | ` .o ` 字节 |
| --- | --- | --- |
| 一个点 ` . ` | 0x10a（266） | 3312 |
| 54 字符的假路径 | 0x141（321） | 3376 |
| 同一条假路径 **再加一个字符** | 0x142（322） | 3376 |

 

**路径长一个字符，产物就多一个字节** ——因为那串字符真的躺在二进制里。   
  
 解药是 ` -fdebug-prefix-map=<编译时的目录>=. `： 它把记录进调试信息的路径前缀重写成 ` . `。 本站的验证脚本就是用这一条把 ` DW_AT_comp_dir ` 钉成一个点， 所以上表那些字节数在任何机器上量出来都一样——  **同一份源码，从两个完全不同的绝对路径编译，得到 3312 字节、sha256 都是 ` 28270ee4814e3c1b `。**

 

**顺手记一个坑** ：如果你同时给两条 ` -fdebug-prefix-map ` （比如既想重写源码目录又想重写工作目录）， **后一条会盖掉前一条** 。 我一开始就是这么写的，结果 ` comp_dir ` 从 ` . ` 变成了 ` .\verify\build\src `，` .o ` 从 3312 涨到 3340—— 路径依赖又回来了，而且很隐蔽。 **要钉就只留一条。**

 

◆ 第五条（本节的重点结论）： **调试信息改的是 ` .elf `，不是固件**

 

前面量的是 ` .o `。真正要交付的是链接之后的产物，那就各量一遍—— 同一份 ` repro.c `，四种参数，链接命令不变，然后 ` objcopy -O binary ` 出固件：

 

```zhizhan-table
{"rows":[[{"body":"参数","header":true,"rowSpan":1,"colSpan":1},{"body":"` .elf ` 字节","header":true,"rowSpan":1,"colSpan":1},{"body":"` .elf ` sha256","header":true,"rowSpan":1,"colSpan":1},{"body":"` .bin `","header":true,"rowSpan":1,"colSpan":1}],[{"body":"不加 ` -g `","header":false,"rowSpan":1,"colSpan":1},{"body":"5100","header":false,"rowSpan":1,"colSpan":1},{"body":"` a8d9d3644f486be7 `","header":false,"rowSpan":1,"colSpan":1},{"body":"**全部 10 字节**   \n sha256 ` a641e1d3f6490ca2 `  \n  *四个版本一字不差*","header":false,"rowSpan":4,"colSpan":1}],[{"body":"` -g `","header":false,"rowSpan":1,"colSpan":1},{"body":"6912","header":false,"rowSpan":1,"colSpan":1},{"body":"` 492a75948a5caea6 `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -gdwarf-4 -ggdb `  \n *（ESP-IDF 用的那一组）*","header":false,"rowSpan":1,"colSpan":1},{"body":"6936","header":false,"rowSpan":1,"colSpan":1},{"body":"` b17f60b8c0b4c217 `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -g3 `","header":false,"rowSpan":1,"colSpan":1},{"body":"26168","header":false,"rowSpan":1,"colSpan":1},{"body":"` 2cfa906996b36173 `","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

` .elf ` 从 5100 一路涨到 26168（ **五倍多** ）， 而 ` .bin `  **恒为 10 字节、sha256 一个字都不差** 。   
  
  **为什么？** 因为调试信息放在 ` .debug_* ` 这些节里， 它们 **不带 ` ALLOC ` 属性** ——链接器不会给它们分配运行时地址， ` objcopy -O binary ` 只搬运"要装进存储器"的段，自然一个字节都不收。  **所以"加 ` -g ` 会让 Flash 变大"是错的；让 ` .elf ` （以及你的 Git 仓库、你的 CI 归档）变大才是真的。**

 

▸ 那 ESP-IDF 为什么写死 ` -gdwarf-4 `？——看它自己的注释

 

` $IDF_PATH/tools/cmake/build.cmake ` 里给目标编译选项的默认值有这两行 （ **下面这段是源码事实，逐字照抄自 ESP-IDF v6.0 的仓库** ）：

 

build.cmakegrep -B1 -A1 'gdwarf-4\\|ggdb'

 

```text
    # Default is dwarf-5 since GCC 11, fallback to dwarf-4 because of binary size
    # TODO: IDF-5160
    "-gdwarf-4"
    # always generate debug symbols (even in release mode, these don't
    # go into the final binary so have no impact on size
    "-ggdb"
```

 

两句注释正好把两件事说透了：

 

 
- **` -ggdb ` 那句** 几乎就是本节第五条结论的原文—— "these don't go into the final binary so have no impact on size"。 IDF 的 release 构建也照样生成调试信息，正是因为 **它不进固件** ； 出问题时你手上那份 ` .elf ` 就能直接对栈回溯。
 
- **` -gdwarf-4 ` 那句** 给的理由是 ` binary size `。  *注意：这里的"binary"指的是 ` .elf `（留档、传输、CI 缓存的那个大文件）， 不是烧进 Flash 的镜像。*    
    **但要诚实说明本节的立场** ：我这次用的例子只有十几行， 量出来的方向是"` -gdwarf-4 ` 反而大 80 字节"，  **和 IDF 注释里给的理由对不上** 。这不构成"IDF 写错了"的证据—— 一个真实工程有成千上万个编译单元、大量的类型与内联信息，DWARF 5 的 ` .debug_loclists `/` .debug_rnglists ` 在那种规模下 通常更省（同一张表被多个编译单元共享）。  **正确读法是把 IDF 的注释当作"他们在自己那个量级上量过的结论"，而不是一句通用规律。**

 

◆ 落地清单：` -g ` 这一族的工程默认值

 

 
1. **开发/调试构建：` -ggdb3 `** （或 ` -g3 `）。 要的就是宏定义与更完整的类型信息——排查问题时，"这个值到底被展开成了什么"经常是决定性的。  *代价是 ` .elf ` 可能大一个数量级（本例 3312 → 29532），但固件不受影响。*
 
2. **发布构建：` -g `，不要 ` -g0 `** 。 理由就是 IDF 那条注释：调试信息不进 Flash，你却可能一年后才发现需要它。  **发布产物要同时归档 ` .elf ` 与该版本的源码** ，否则符号对不上。  *顺便：` .elf ` 里是否含源码路径也取决于 ` -fdebug-prefix-map `， 它是"归档的 ` .elf ` 会不会泄露构建机目录结构"的开关。*
 
3. **调试信息格式跟着工具链默认走，别乱钉版本** 。除非像 IDF 那样有明确理由 （他们是为了 ` .elf ` 体积），否则 **显式写 ` -gdwarf-N ` 只会让你和下游工具（GDB、崩溃解析服务）的默认值对不上** 。
 
4. **可复现构建必须处理路径** ：加 ` -fdebug-prefix-map=$(CURDIR)=. `，  **并且只加这一条** 。这一步和 ` SOURCE_DATE_EPOCH ` 是并列的两件事—— 前者管"路径"，后者管"时间"， **少一个，哈希就还是不稳。**

 

```zhizhan-anchor
ch5-4-5
```



### 5.4.5 ` --gc-sections ` 与 LTO：删得掉什么，删不掉什么

 

§5.4.1 那张 Gcc 选项表里，` -ffunction-sections -fdata-sections ` 和 ` -Wl,--gc-sections ` 是挨着写的两行，很容易被读成"一对开关，一起加上就瘦身"。 它们确实是配合关系，但配合的方式和多数人想的不一样——而且用错的时候，  **链接器一声不吭，产物却可能整个是空的** 。

 

先立好实验台：一个最小的链接脚本（ **有 ` ENTRY `、没有 ` KEEP `** ）， 和一份两个函数的源码。

 

gc.ld — 最小链接脚本：有 ENTRY、没有 KEEP Linker Script

 

```text
/* gc.ld —— 有入口、没有 KEEP 的最小脚本 */
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 256K
         RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 64K }
ENTRY(main)
SECTIONS {
  .text : { *(.text*) *(.rodata*) } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

gctest.c — 一个被调用、一个没人用的全局函数 C

 

```text
/* gctest.c —— 两个非 main 的全局函数：一个被调用，一个没人用 */
#include <stdint.h>
uint32_t g_sink;
uint32_t used_fn(void)   { g_sink = 1; return g_sink; }
uint32_t unused_fn(void) { g_sink = 2; return g_sink; }
int main(void) { return (int)used_fn(); }
```

 

` used_fn ` 被 ` main ` 调用， ` unused_fn ` 没有任何人引用。用 ` -O0 ` 编译 —— **不开优化，就不会有内联来搅局** ，这是这个实验成立的前提， 理由下面会看到。链接时只换两个开关：

 

bash四组对照：只换一个开关

 

```text
# ① 基线
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O0 -c gctest.c -o gctest.o
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -nostdlib -nostartfiles \
      -T gc.ld gctest.o -o t.elf

# ② 只加链接侧的 --gc-sections
$ ... -Wl,--gc-sections -T gc.ld gctest.o -o t.elf

# ③ 只加编译侧的 -ffunction-sections -fdata-sections
$ arm-none-eabi-gcc ... -O0 -ffunction-sections -fdata-sections -c gctest.c -o gctest.o
$ arm-none-eabi-gcc ... -T gc.ld gctest.o -o t.elf

# ④ 两侧都加
$ arm-none-eabi-gcc ... -O0 -ffunction-sections -fdata-sections -c gctest.c -o gctest.o
$ arm-none-eabi-gcc ... -Wl,--gc-sections -T gc.ld gctest.o -o t.elf
```

 

| 编译参数 | 链接参数 | text / data / bss | ` unused_fn ` |
| --- | --- | --- | --- |
| （无） | （无） | 72 / 0 / 4 | 在 |
| （无） | ` -Wl,--gc-sections ` | **72**  / 0 / 4 | **仍在** （一个字节都没删） |
| ` -ffunction-sections -fdata-sections ` | （无） | 70 / 0 / 4 | 在 |
| ` -ffunction-sections -fdata-sections ` | ` -Wl,--gc-sections ` | **42**  / 0 / 4 | **被删** |

 

⚠ 第一条：` --gc-sections ` 的作用粒度是 **「输入节」** ，不是「函数」

 

把第 ② 行和第 ① 行并排看： **只加 ` --gc-sections `， text 一个字节都没少（两组都是 72）， ` unused_fn ` 原封不动地留在产物里。**  它确实执行了回收，只是 **没有可以回收的单位** —— 整个 ` .text ` 是一个不可分割的输入节， 而 ` main ` 引用着它，所以它整体是活的。

 

只有第 ④ 行（两侧都加）才真的删掉东西：text 从 72 掉到 42。 想要看见它到底删了什么，得去 map 里找—— ` --gc-sections ` 把丢掉的东西记在一个专门的段落里：

 

bashfull.map 里的 Discarded input sections 一段（原文）

 

```text
Discarded input sections

 .text          0x00000000        0x0 gctest.o
 .data          0x00000000        0x0 gctest.o
 .bss           0x00000000        0x0 gctest.o
 .text.unused_fn
                0x00000000       0x1c gctest.o
```

 

前三行（` .text `/` .data `/` .bss ` 三个空壳，大小 0x0） 是加了 ` -ffunction-sections ` 之后剩下的"容器"节，本身已经没有内容； 真正被删掉的是 ` .text.unused_fn `， 它的大小 ` 0x1c ` 就是  **28 字节** 。

 

**注意这个数字怎么对：** 72 − 42 =  **30**  字节， 而被删的 ` .text.unused_fn ` 只有 ` 0x1c ` =  **28**  字节。 差的 2 个字节是 **对齐** ——节是按 4 字节边界排放的， 删掉一个 28 字节的节，它后面所有节一起往前挪， 省下来的总量不等于"这个函数编译出来有多大"。  *拿函数体积去预估"能省多少 Flash"，误差就来自这里； 真要算账，只能看改参数前后 ` size ` 的差。*

 

✕ 第二条（会让人白忙一天的坑）：` --gc-sections ` 需要 **根** ，没有根它把整份程序都丢掉

 

上面所有实验都带着 ` -T gc.ld `，脚本里有一行 ` ENTRY(main) `。 这一行不是装饰： **它就是 GC 的根** —— 链接器从入口符号出发，能走到的节全部保留，走不到的才丢。

 

那如果没有入口呢？把 ` -T gc.ld ` 去掉， 改用工具链的默认脚本，其余一字不改：

 

| 链接参数 | 退出码 | text / data / bss | ld 说了什么 |
| --- | --- | --- | --- |
| *（不加 ` --gc-sections `）* | 0 | 72 / 0 / 4 | 一句 ` warning: cannot find entry symbol _start ` |
| ` -Wl,--gc-sections ` | **0** | **0 / 0 / 0** | 同一句 ` warning `， **没有别的** |

 

第二行的 ` .elf ` 里 **什么都没有了** ： ` main `、` used_fn `、` unused_fn ` 一个符号都不剩——符号表里只剩下工具链默认脚本给的那一批绝对符号 （` __bss_start `、` _edata ` 之类，地址全是 ` 0x00008000 `），而 ` _start ` 自己 仍然是 ` U `（未定义）。  **而 ld 的退出码是 0。**    
  
 原因就是"没有根"：` -nostdlib ` 下没有 ` _start `， 脚本里又没有 ` ENTRY `，于是 GC 找不到任何一个起点， 判据退化成"所有节都不可达"—— **整个程序被当成垃圾收走了。 而它唯一给出的线索，是一句在很多工程里已经刷屏到没人看的 warning。**    
  
  **这条不是理论风险** ：真实工程里 ` -nostdlib `/` --gc-sections ` 是嵌入式常见的组合，一旦链接脚本改过、或者入口符号名写错一个字， 症状就是"编过了、链过了、烧进去不动"。所以  **用 ` --gc-sections ` 时，务必让链接脚本显式写出 ` ENTRY(...) `** ， 并把这个"什么都没剩"的 ` .elf ` 体积当成 CI 的一条断言。

 

⚠ 第三条：` --gc-sections ` 会把 ` .init_array ` 整个收走——除非你写了 ` KEEP `

 

前两条讲的是"删得不够多"和"删得太多"。这一条是删错东西：  **它会把构造函数表当成垃圾** 。

 

` __attribute__((constructor)) ` 标记的函数， 要靠启动代码遍历 ` .init_array ` 这一段依次调用。 问题在于：` .init_array ` 里的表项会被启动代码读， 但 **启动代码是用指针遍历的** ——链接器做可达性分析时看不见这条边， 它只知道"没有任何节引用 ` .init_array `"。

 

准备两份只有一行之差的脚本：一份 ` .init_array ` 直接放， 另一份外面套 ` KEEP(...) `。

 

ctordemo.c — 一个 \_\_attribute\_\_((constructor)) 函数 C

 

```text
/* ctordemo.c —— 一个 __attribute__((constructor)) 函数，看它会不会被 --gc-sections 收走 */
#include <stdint.h>
uint32_t g_flag;
__attribute__((constructor)) static void my_ctor(void) { g_flag = 0xC0FFEE; }
int main(void) { g_flag = 1; return (int)g_flag; }
```

 

ctors\_gc\_nokeep.ld — .init\_array 没写 KEEP Linker Script

 

```text
/* ctors_gc_nokeep.ld */
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 256K
         RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 64K }
ENTRY(main)
SECTIONS {
  .text : { *(.text*) *(.rodata*) } > FLASH
  .init_array : { . = ALIGN(4); __init_array_start = .; *(.init_array) __init_array_end = .; } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

看 ` .init_array ` 那一段：里面写的是 **裸的**  ` *(.init_array) `—— **没有 ` KEEP `** 。 下一份和它逐字相同，只把这一处换成 ` KEEP(*(.init_array)) `。

 

ctors\_gc\_keep.ld — .init\_array 写了 KEEP Linker Script

 

```text
/* ctors_gc_keep.ld */
MEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 256K
         RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 64K }
ENTRY(main)
SECTIONS {
  .text : { *(.text*) *(.rodata*) } > FLASH
  .init_array : { . = ALIGN(4); __init_array_start = .; KEEP(*(.init_array)) __init_array_end = .; } > FLASH
  .data : { *(.data*) } > RAM AT > FLASH
  .bss  : { *(.bss*) *(COMMON) } > RAM
}
```

 

把两个开关交叉，一共四组（编译侧固定加 ` -ffunction-sections -fdata-sections `）：

 

| 脚本 | ` --gc-sections ` | text / data / bss | ` my_ctor ` | start / end |
| --- | --- | --- | --- | --- |
| 无 ` KEEP ` | 否 | 56 /  **4**  / 4 | ` 08000000 t my_ctor ` | 08000038 / 0800003c |
| 无 ` KEEP ` | **是** | 28 /  **0**  / 4 | **符号消失** | **0800001c / 0800001c（相等）** |
| 有 ` KEEP ` | 否 | 56 /  **4**  / 4 | ` 08000000 t my_ctor ` | 08000038 / 0800003c |
| 有 ` KEEP ` | **是** | 56 /  **4**  / 4 | ` 08000000 t my_ctor ` | 08000038 / 0800003c |

 

` data ` 那一格就是这个程序里 ` .init_array ` 的大小 （` ctordemo.c ` 里没有别的已初始化数据）， 所以看第二行：它从  **4 字节变成 0 字节** ， ` my_ctor ` 这个符号 **整个消失** ， 而 ` __init_array_start ` 和 ` __init_array_end `  **塌成了同一个地址 ` 0x0800001c `** —— 启动代码里那个 ` for (p = start; p < end; p++) ` 循环于是 **跑 0 次** 。

 

**而链接退出码是 0，没有任何一条诊断提到 ` .init_array `。**  函数没被调用、表空了、循环没进——它一个字都没说。  *（这四组链接里 ld 一共只发了 3 条 warning，全是 ` has a LOAD segment with RWX permissions `—— 手写最小链接脚本时常见的权限提示，和 ` .init_array ` 毫无关系。 换句话说： **唯一"提到" ` .init_array ` 被收走的地方， 是我们自己用 ` nm ` 查出来的那两行。**  顺带记一笔：这条 RWX 提示正好说明手写脚本时 ` MEMORY ` 的 权限标记和节的实际属性要对上，否则链接器会连着提醒你三次。）*

 

这正是 ` KEEP ` 存在的理由：它明确告诉链接器 "这一节是被间接引用的，别动它"。   
  
 所以 **只要你的工程用了 ` --gc-sections `， 就必须逐条检查链接脚本里所有"由代码按指针遍历"的节** ： ` .init_array `（C\+\+ 全局对象构造、` constructor ` 属性）、 ` .fini_array `（析构）、中断向量表、 以及任何 RTOS 或框架自己注册的"段式注册表"。 判据很简单： **这一节是被"符号引用"的，还是被"指针扫描"的？**  后者一律要 ` KEEP `。

 

✦ 第四条：LTO 的粒度比节级 GC 更细，所以 ` --gc-sections ` 就没活干了

 

前面三个实验都在 ` -O0 ` 下做，是为了隔离变量。 现在把优化打开—— **同一份 ` gctest.c `，同样的链接脚本， 编译和链接两侧同时变** ：

 

```zhizhan-table
{"rows":[[{"body":"编译 / 链接参数","header":true,"rowSpan":1,"colSpan":1},{"body":"text / data / bss","header":true,"rowSpan":1,"colSpan":1},{"body":"存活的符号","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` -Os `（基线）","header":false,"rowSpan":1,"colSpan":1},{"body":"36 / 0 / 4","header":false,"rowSpan":1,"colSpan":1},{"body":"` g_sink `、` used_fn `、` unused_fn `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Os -flto `","header":false,"rowSpan":1,"colSpan":1},{"body":"**4 / 0 / 0**","header":false,"rowSpan":1,"colSpan":1},{"body":"**三个全没了** （只剩 ` main `）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Os -flto ` \\+ ` -Wl,--gc-sections `","header":false,"rowSpan":1,"colSpan":1},{"body":"4 / 0 / 0","header":false,"rowSpan":1,"colSpan":1},{"body":"同上","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Os -flto ` \\+ ` -ffunction-sections -fdata-sections ` \\+ ` -Wl,--gc-sections `","header":false,"rowSpan":1,"colSpan":1},{"body":"4 / 0 / 0","header":false,"rowSpan":1,"colSpan":1},{"body":"同上","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Os ` \\+ ` -ffunction-sections -fdata-sections ` \\+ ` -Wl,--gc-sections `  \n *（无 LTO 对照）*","header":false,"rowSpan":1,"colSpan":1},{"body":"12 / 0 / 4","header":false,"rowSpan":1,"colSpan":1},{"body":"` g_sink `（` unused_fn ` 已死）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

第 2 行到第 4 行 **数值完全一样** ——这是本条的结论： ` -flto ` 之后再加 ` --gc-sections `、 再加 ` -ffunction-sections `， **一个字节都不会再变** 。 因为 LTO 在 **编译期（准确地说是链接期的优化阶段）** 做死代码消除， 它能看见整个程序里每个函数的引用关系， 粒度 **比"输入节"细得多** ；等轮到底层链接器的 ` --gc-sections ` 时， 已经没有可删的节了。

 

*注意两个"顺手删干净"的附带效果：第 2 行里 ` used_fn ` 也没了 ——它被内联进 ` main `；` g_sink ` 也没了 ——它的写入被证明无人读取，被死存储消除。*   **LTO 不只是"不给 ` --gc-sections ` 活干"，它也改变了你能在符号表里看到什么。**

 

✕ 第五条（LTO 最容易踩的坑）：LTO 会 **改符号的可见性**

 

上一条里 ` g_sink ` 凭空消失，容易被解释成"没被用到"。 但 ` g_sink ` 是个 **非 ` static ` 的全局变量** ， 别的文件是可以引用它的。把 ` gctest.c ` 拆成两个编译单元试试 ——第二个文件什么都不做， **只读一下 ` g_sink `** ：

 

gclto.c — 主 TU：g\_sink 是全局，但只有本程序的 read\_sink() 会读它 C

 

```text
/* gclto.c —— 两个 TU 版的主文件 */
#include <stdint.h>
uint32_t g_sink;
uint32_t used_fn(void)   { g_sink = 1; return g_sink; }
uint32_t unused_fn(void) { g_sink = 2; return g_sink; }
uint32_t read_sink(void);
int main(void) { return (int)(used_fn() + read_sink()); }
```

 

gcref.c — 另一个 TU：通过只读引用证明 g\_sink 是"被用的" C

 

```text
/* gcref.c —— 另一个编译单元，只读 g_sink，不改它 */
#include <stdint.h>
extern uint32_t g_sink;
uint32_t read_sink(void) { return g_sink; }
```

 

| 参数 | text/data/bss | ` nm ` 里的 ` g_sink ` |
| --- | --- | --- |
| ` -Os `（基线） | 56 / 0 / 4 | ` 20000000 B g_sink `  *大写 B：全局数据* |
| ` -Os -flto ` | **16 / 0 / 4** | ` 20000000 b g_sink `  **小写 b：局部数据** |

 

**` B ` 变成了 ` b `。**  在 ` nm ` 的约定里，大写 = 全局（extern 可见）， 小写 = 局部（文件内可见）。也就是说：  **LTO 看见 ` g_sink ` 在整个程序里不再被外部引用， 就把它内部化成了 ` static ` 级别的符号。**  这不是 bug，是 LTO 本该做的事——但它有两个真实后果：

 

 
- **靠符号名连接的接口会在 LTO 下失效。**  如果你的启动代码、调试脚本、或者 PC 端工具是"按符号名去找 ` g_sink `"的（` dlsym ` 风格、或者干脆 ` objcopy --redefine-sym `），LTO 一开就可能找不到它。 需要跨 TU 稳定的符号，要么用 ` __attribute__((used)) ` / ` externally_visible ` 钉住，要么在链接脚本里用 ` KEEP ` \+ ` PROVIDE ` 显式导出。
 
- **反过来说，LTO 是"整个程序语义"级别的优化。**  它把 ` read_sink ` 内联掉、把 ` g_sink ` 内部化，于是 text 从 56 字节掉到 16 字节。  *它做得越多，你越不能假设"我写了这个函数，符号表里就有它"。*

 

⚠ 第六条：` -flto ` 在 ` -O0 ` 下不省一个字节——但它已经在改你的符号表了

 

上面所有 LTO 的效果都发生在 ` -Os ` 下。把优化级别退回去看看 —— **同一份源码、同一个脚本，只差优化级别** ：

 

| 参数 | text / data / bss | ` nm ` 查到的 ` unused_fn ` |
| --- | --- | --- |
| ` -O0 `（基线） | 72 / 0 / 4 | ` 0800001c T unused_fn `  *大写 T：全局函数* |
| ` -O0 -flto ` | **72 / 0 / 4** | ` 0800001c t unused_fn `  **小写 t：已内部化** |

 

体积那一列 **一模一样（都是 72）** ——` -flto ` 在 ` -O0 ` 下一个字节都没省。原因是  **LTO 本身不等于"会删死代码"** ： 它只是把优化的舞台从"单个编译单元"搬到了"整个程序"， 真正动手删东西的仍然是优化器，而 ` -O0 ` 关掉了优化器。 所以  **` -flto ` 要和 ` -O1 ` 以上的优化级别一起用才有瘦身意义** ， 而且要在 **编译和链接两侧都加** （只在一侧加，LTO 不会生效）。

 

**但别就此以为它"什么都没做"。** 看第三列： 同一个 ` unused_fn `，同一个地址 ` 0x0800001c `，符号类型却从大写 ` T ` 变成了小写 ` t `； ` g_sink ` 也从 ` B ` 变成 ` b `。 也就是说  **LTO 的"内部化"这一步不依赖优化级别，它在 ` -O0 ` 下就已经发生了**  ——只是一个字节的代码都没删而已。 内存里那份 ` g_sink ` 还在、函数还在， 但 **它已经不再是导出符号** （下一条框会讲这件事为什么危险）。   
  
  *顺带一说：` -flto ` 会显著拉长链接时间，也会让 map 变得不那么直观 ——中间表示的合并过程不出现在最终 map 里。省下来的那二十几个字节， 在很多项目里换不回这点调试成本。用之前先量。*

 

✦ 落地清单：这一节的六个数字，对应六条工程规矩

 

 
1. **` -Wl,--gc-sections ` 必须配 ` -ffunction-sections -fdata-sections ` 一起上。**  只加链接侧那个，` .text ` 一个字节都不会少（0x48 → 0x48）， 而且它不会报错，你会以为它在工作。
 
2. **用 ` --gc-sections ` 的工程，链接脚本里必须有 ` ENTRY(...) `。**  没有根它会删光整个程序，退出码还是 0。把"` .elf ` 体积不为 0"做成 CI 断言。
 
3. **凡是"靠指针扫描"的节，一律 ` KEEP `。**  ` .init_array `、` .fini_array `、向量表、注册表。 判据：这一节是被符号引用的，还是被遍历的？
 
4. **别把 ` --gc-sections ` 当成主要瘦身手段。**  它删掉的只是"整节都没人用"的那些；真正省 Flash 的是 ` -Os `、` -flto `、 以及最后那道 ` --specs=nano.specs `（见 §5.4.2）。
 
5. **开 LTO 就要接受符号表会变。**  模块间接口不要靠"符号名能被外部找到"来维持， 需要稳定的符号用 ` used ` / ` externally_visible ` 钉住。
 
6. **` -flto ` 只在 ` -O1 ` 以上才有意义，且编译链接两侧都要加。**  ` -O0 -flto ` 的产物和不加完全一样，白等链接时间。

 

```zhizhan-anchor
ch5-5
```



## 5.5 Makefile：从命令堆到构建系统

 

手工敲 ` gcc ` 命令只在做实验时可行。真实项目需要一个 **可重复、增量、跨平台** 的构建系统。 Make 是最基础也最通用的一层。

 

Makefile — 一个可直接用于 STM32 项目的完整模板 Makefile

 

```text
# ============================================================
#  STM32F103 项目 Makefile —— 支持增量编译
#
#  ★ 这一份是【教学版】：为了逐步讲清每条规则，只保留了主流程。
#    要直接抄进工程用的完整模板（含 RELEASE 双配置、flash/debug/
#    analyze 辅助目标、-lm、独立的 ASFLAGS）见附录 A.7 ——
#    两份共用同一套变量名和同一个链接脚本名，可以无缝替换。
# ============================================================

TARGET   := firmware
BUILD    := build

# ---------- 工具链 ----------
PREFIX   := arm-none-eabi-
CC       := $(PREFIX)gcc
AS       := $(PREFIX)gcc -x assembler-with-cpp
CP       := $(PREFIX)objcopy
SZ       := $(PREFIX)size

# ---------- 源文件 ----------
C_SOURCES   := $(wildcard Src/*.c) $(wildcard Drivers/STM32F1xx_HAL_Driver/Src/*.c)
ASM_SOURCES := startup_stm32f103xb.s

# ---------- 输出目录：$(notdir) 把源文件"拍平"到单层 ----------
# 注意：notdir 是拍平，不是"镜像源码树"。Src/uart.c 和 Drivers/.../Src/uart.c
# 都会变成 build/uart.o，后者覆盖前者 —— 症状是"改了代码却不生效"。
# 项目里一旦出现同名 .c，就得改成保留目录结构的写法：
#   OBJECTS := $(addprefix $(BUILD)/,$(C_SOURCES:.c=.o))
#   $(BUILD)/%.o: %.c | $(BUILD)
#   	@mkdir -p $(dir $@)
#   	$(CC) -c $(CFLAGS) $< -o $@
OBJECTS := $(addprefix $(BUILD)/,$(notdir $(C_SOURCES:.c=.o)))
vpath %.c $(sort $(dir $(C_SOURCES)))     # ← 关键：告诉 make 去哪找源文件
OBJECTS += $(addprefix $(BUILD)/,$(notdir $(ASM_SOURCES:.s=.o)))
vpath %.s $(sort $(dir $(ASM_SOURCES)))

# ---------- 编译选项 ----------
MCU      := -mcpu=cortex-m3 -mthumb
OPT      := -Og
C_DEFS   := -DUSE_HAL_DRIVER -DSTM32F103xB
C_INCLUDES := -IInc -IDrivers/STM32F1xx_HAL_Driver/Inc -IDrivers/CMSIS/Include
CFLAGS   := $(MCU) $(OPT) -std=c11 -Wall -Wextra \
            -ffunction-sections -fdata-sections -fno-common \
            $(C_DEFS) $(C_INCLUDES) -g3 -gdwarf-4
ASFLAGS  := $(MCU) $(OPT) -Wall -fdata-sections -ffunction-sections
LDSCRIPT := STM32F103C8T6.ld
LIBS     := -lc -lm
LDFLAGS  := $(MCU) --specs=nano.specs --specs=nosys.specs -T$(LDSCRIPT) $(LIBS) \
            -Wl,-Map=$(BUILD)/$(TARGET).map,--cref \
            -Wl,--gc-sections -Wl,--print-memory-usage

# ============================================================
#  目标
# ============================================================

.PHONY: all clean flash size debug

all: $(BUILD)/$(TARGET).elf $(BUILD)/$(TARGET).hex $(BUILD)/$(TARGET).bin

# 链接
$(BUILD)/$(TARGET).elf: $(OBJECTS) Makefile
	$(CC) $(OBJECTS) $(LDFLAGS) -o $@
	$(SZ) $@

# 格式转换
$(BUILD)/%.hex: $(BUILD)/%.elf
	$(CP) -O ihex $< $@

$(BUILD)/%.bin: $(BUILD)/%.elf
	$(CP) -O binary -S $< $@

# 编译 C
$(BUILD)/%.o: %.c Makefile | $(BUILD)
	$(CC) -c $(CFLAGS) -MMD -MP -MF"$(@:%.o=%.d)" $< -o $@

# 汇编
$(BUILD)/%.o: %.s Makefile | $(BUILD)
	$(AS) -c $(ASFLAGS) $< -o $@

# 目录创建（order-only prerequisite：| 之后的目标不触发重新编译）
$(BUILD):
	mkdir -p $@

# ---------- 依赖文件自动包含（头文件变了自动重编）----------
-include $(wildcard $(BUILD)/*.d)

# ---------- 辅助目标 ----------
size: $(BUILD)/$(TARGET).elf
	$(SZ) -A $<

flash: $(BUILD)/$(TARGET).bin
	st-flash --reset write $< 0x08000000

debug: $(BUILD)/$(TARGET).elf
	openocd -f interface/stlink.cfg -f target/stm32f1x.cfg &

clean:
	rm -rf $(BUILD)
```

 

◆ 这个 Makefile 里最值钱的三行

 

 
1. **` vpath %.c $(sort $(dir $(C_SOURCES))) `**   
    它让所有 ` .o ` 能平铺在一个目录里，而源文件可以散在任意子目录。 没有这行，你就得手工为每个子目录写一套规则。
 
2. **` -MMD -MP -MF"$(@:%.o=%.d)" `**   
    自动生成 **头文件依赖** 。` -MMD ` 生成 ` .d ` 文件列出该 ` .o ` 依赖哪些头文件； ` -include $(wildcard $(BUILD)/*.d) ` 把它们读进来。  **没有这个机制，你改了 ` .h ` 文件，make 不会重新编译受影响的 ` .c `** —— 这是最经典的"改了代码却没生效"的来源。
 
3. **` | $(BUILD) `（order-only prerequisite）**   
    竖线后面的目标 *只要求存在，不要求比目标新* 。 如果写成普通依赖 ` $(BUILD)/%.o: %.c $(BUILD) `， 每次 ` build ` 目录的 mtime 变化都会导致全量重编。  **这一个字符的差别，决定了你的增量编译是 2 秒还是 2 分钟。**

 

```zhizhan-anchor
ch5-5-1
```



### 5.5.1 Makefile 三大坑

 

这三条在真实项目里的出现率高得离谱，而 make 对它们的反应从"当场报错"到"一声不吭"都有。  **报错的那种反而好办；真正花钱的是不报错的那些** ——构建照常"成功"，问题跑到运行时、或者等几周后别人改了一行才引爆。

 

坑 1 · 续行反斜杠后面写注释 —— 续行会当场断掉

 

Makefile 判断"这行要不要续"只看 **一件事** ：这个物理行的 *最后一个字符* 是不是反斜杠。 make 的处理顺序是 **先拼行、再删注释** ：先用"行尾反斜杠"规则把若干物理行拼成一条 *逻辑行* ， 拼完之后才把 ` # ` 到行尾的内容丢掉。

 

所以只要在带 ` \ ` 的行尾写 ` # 注释 `，这一行就不再"以反斜杠结尾"了—— 续行当场断在这里， **而那个反斜杠本身会被原样保留下来** 。断口的位置决定了后果是"报错"还是"静默出错"：

 

**情形 ① 断口后面还跟着续行 → make 直接报错（还算幸运）**

 

A.mk — 注释写在中间某行的续行反斜杠后面 Make

 

```text
LDFLAGS  = -mcpu=cortex-m3 \
           -Wl,-Map=build.map \      # 生成 map 文件   ← 这一行不再以 \ 结尾
           -Wl,--gc-sections \
           --specs=nano.specs
$(info LDFLAGS=<$(LDFLAGS)>)
```

 

bash实际的 make 输出（GNU Make 4.4.1）

 

```text
$ make -f A.mk
A.mk:3: *** missing separator (did you mean TAB instead of 8 spaces?).  Stop.
← 注意报的是第 3 行，而不是写注释的第 2 行 ——
   第 3、4 行失去了"续行"身份，变成一条孤立语句，
   make 不认识它，只好抱怨"缺少分隔符"
```

 

**情形 ② 断口正好落在续行链的末尾 → 一声不吭，反斜杠混进变量值**

 

D.mk — 注释写在最后一条续行的反斜杠后面 Make

 

```text
A = x \
    y \      # 链尾的注释
$(info A=<$(A)>)
```

 

bash没有任何警告

 

```text
$ make -f D.mk
[D] A=<x y \      >
← 值里多出一个孤立的反斜杠。它会被当成一个普通参数
   原样交给编译器，于是你收到一条和语法毫无关系的怪错误
```

 

**✅ 正确写法：说明写在变量定义的上方**

 

Makefile — 注释与续行分开 Make

 

```text
# LDFLAGS 逐项说明：
#   $(MCU)                  -mcpu=cortex-m3 -mthumb
#   $(LDSCRIPT)             -T STM32F103C8T6.ld
#   -Wl,-Map=...            生成 map 文件
#   -Wl,--gc-sections       删除未被引用的段
#   --specs=nano.specs      使用 newlib-nano，Flash 占用小很多
LDFLAGS  = $(MCU) $(LDSCRIPT) \
           -Wl,-Map=build/firmware.map \
           -Wl,--gc-sections \
           --specs=nano.specs \
           --specs=nosys.specs
```

 

**唯一的例外** ：整条续行链的 *最后一行* （那一行本来就不以 ` \ ` 结尾）写注释是安全的， 会被正常丢掉。但"哪一行是最后一行"会随编辑而变——所以干脆一条都别写。   
 排查手法：` make -p ` 会打印所有变量的最终值，一眼就能看出被截断成了什么； ` make -n ` 只打印不执行，能看清真实的命令行。

 

坑 2 · $(notdir) 拍平目录 —— 同名源文件互相覆盖

 

本节的 Makefile 用 ` $(notdir $(C_SOURCES:.c=.o)) ` 把所有 ` .o ` 平铺进 ` build/ `，再用 ` vpath ` 反查源文件。这在"每个目录下文件名都不重名"时完美工作， 但 **一旦出现两个同名 ` .c `，它们会映射到同一个 ` build/xxx.o `** —— ` vpath ` 只会挑第一个匹配，第二个文件永远不会被编译，也不会有任何警告。

 

bash同名文件的症状

 

```text
$ find . -name 'uart.c'
# ./Src/uart.c                 ← 你写的新驱动
# ./Drivers/STM32F1xx_HAL_Driver/Src/uart.c   ← 厂商旧驱动（或反过来的旧版本）

$ make
Compiling Src/uart.c
Finished building target
← 只编了一个。改另一个文件，make 毫无反应

# 保目录的写法：把路径里的 / 换成 _，用 subst 而不是 notdir
# OBJECTS := $(addprefix $(BUILD)/,$(subst /,_,$(C_SOURCES:.c=.o)))
#   → build/Src_uart.o  build/Drivers_STM32F1xx_HAL_Driver_Src_uart.o
# 代价是一定要配 mkdir -p，不能再靠 addprefix 一层的简单规则
```

 

取舍：源文件少、命名有纪律时，拍平是最省事的； **接入厂商 SDK 之后目录里迟早会撞名** ， 这时要么改用 ` subst ` 保目录，要么老老实实上 CMake（见下一节）。

 

坑 3 · = 与 := 的求值时机 —— $(shell) 会被反复执行

 

` = ` 是 **递归展开** ：右侧文本原样存下， *每次引用这个变量时* 都重新展开一次。 ` := ` 是 **立即展开** ：定义的那一刻就求值完，存最终结果。

 

Makefile — 递归展开的代价 Make

 

```text
# ❌ 每次引用都会真的 fork 一个 shell 去跑 git
BUILD_ID = $(shell git rev-parse --short HEAD)$(shell date +%H%M)

# 这个变量在 Makefile 里被引用了 8 次 → git 和 date 各被调用 8 次。
# 更糟的是：如果它出现在某条 recipe 里，而该 recipe 有 200 行 .o 要编，
# shell 就会被调用 200 次，构建时间凭空多出好几秒。

# ✅ 只求值一次
BUILD_ID := $(shell git rev-parse --short HEAD)$(shell date +%H%M)

# 判断口诀：
#   右侧含 $(shell ...) / $(wildcard ...) / 依赖其它变量 → 用 :=
#   确实需要"用到时才求值"（例如引用一个后面才定义的变量）→ 才用 =
```

 

顺带一个小坑： **recipe 行必须用 ` Tab ` 缩进** ，用空格会报 ` *** missing separator. Stop. `。编辑器里务必关掉"Tab 转空格"， 或者干脆给 Makefile 单独加一条规则保持硬 Tab。

 

```zhizhan-anchor
ch5-5-2
```



### 5.5.2 CMake：当项目超过 20 个源文件

 

cmake/arm-none-eabi.cmake \+ CMakeLists.txt CMake

 

```text
# ============ cmake/arm-none-eabi.cmake ============
# 工具链描述必须独立成文件，用 -DCMAKE_TOOLCHAIN_FILE= 传给 CMake。
# 不要把它内联进 CMakeLists.txt —— CMAKE_C_COMPILER 这类变量只在
# "首次配置、且尚未用宿主编译器做过任何探测"时才被采纳；内联进顶层文件
# 经常会静默失效：CMake 表面上用了你的路径，实际仍在调宿主 gcc。
set(CMAKE_SYSTEM_NAME      Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)   # 交叉编译时不能运行目标程序

set(TOOLCHAIN_PREFIX arm-none-eabi-)
set(CMAKE_C_COMPILER   ${TOOLCHAIN_PREFIX}gcc)
set(CMAKE_CXX_COMPILER ${TOOLCHAIN_PREFIX}g++)
set(CMAKE_ASM_COMPILER ${TOOLCHAIN_PREFIX}gcc)
set(CMAKE_OBJCOPY      ${TOOLCHAIN_PREFIX}objcopy)
set(CMAKE_SIZE         ${TOOLCHAIN_PREFIX}size)

# 汇编文件请用大写后缀 .S。CMake 只对 .S 自动加 -x assembler-with-cpp，
# 宏和 #include 才会先过一遍预处理器；小写 .s 不过预处理器，
# 启动文件里只要出现 #define 就直接语法报错。必须沿用 .s 时手动补这句：
set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -x assembler-with-cpp")

# 让 find_package / find_library / find_path 只在目标工具链里找，
# 避免误链到宿主机（x86）上的同名库
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)


# ============ 顶层 CMakeLists.txt ============
cmake_minimum_required(VERSION 3.20)

# 这里不再出现任何 arm-none-eabi- 的路径 —— 它们全在工具链文件里
project(stm32_firmware C CXX ASM)

# ---------- 通用编译选项 ----------
add_compile_options(
    -mcpu=cortex-m3 -mthumb
    -ffunction-sections -fdata-sections -fno-common
    -Wall -Wextra -Wshadow
    $<$<COMPILE_LANGUAGE:CXX>:-fno-exceptions -fno-rtti>   # 嵌入式 C++ 通常关异常
)
add_compile_definitions(USE_HAL_DRIVER STM32F103xB)

add_link_options(
    -mcpu=cortex-m3 -mthumb
    -T${CMAKE_SOURCE_DIR}/STM32F103C8T6.ld
    --specs=nano.specs --specs=nosys.specs
    -Wl,--gc-sections -Wl,-Map=${PROJECT_NAME}.map,--cref
    -Wl,--print-memory-usage
)

# ---------- 把 HAL 做成独立静态库（编译一次，多处复用）----------
add_library(hal STATIC
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_uart.c
)
target_include_directories(hal PUBLIC Drivers/STM32F1xx_HAL_Driver/Inc Drivers/CMSIS/Include)

# ---------- 应用 ----------
add_executable(${PROJECT_NAME}
    Src/main.c
    Src/app.c
    startup_stm32f103xb.S     # 大写 .S，才会过预处理器
)
target_link_libraries(${PROJECT_NAME} hal)
target_include_directories(${PROJECT_NAME} PRIVATE Inc)

# ---------- 生成 .hex / .bin / 打印体积 ----------
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O ihex   $<TARGET_FILE:${PROJECT_NAME}> ${PROJECT_NAME}.hex
    COMMAND ${CMAKE_OBJCOPY} -O binary -S $<TARGET_FILE:${PROJECT_NAME}> ${PROJECT_NAME}.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:${PROJECT_NAME}>
    COMMENT "生成 hex / bin 并打印体积"
)

# ---------- 调试与量产的 profile ----------
set(CMAKE_C_FLAGS_DEBUG   "-Og -g3 -gdwarf-4")
set(CMAKE_C_FLAGS_RELEASE "-Os -g0 -DNDEBUG -flto")

# 用法（工具链文件只在"首次配置"这一步传，之后 cmake --build 不用再传）：
#   cmake -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE=cmake/arm-none-eabi.cmake \
#         -DCMAKE_BUILD_TYPE=Debug
#   cmake --build build
#
# 换 Release 时用同一个 build 目录会沿用上次缓存的工具链，安全；
# 但如果换了工具链文件本身，务必先删掉 build/ 重新配置 ——
# CMakeCache.txt 里缓存了编译器路径，改文件不会自动生效。
```

 

✔ Make 还是 CMake？

 

| 情况 | 建议 |
| --- | --- |
| 学习 / 单芯片 / 10 个源文件以内 | **手写 Makefile** 。能看懂每一行，出问题好排查 |
| 多目标平台（STM32 \+ ESP32 \+ PC 仿真） | **CMake** 。工具链文件切换即可 |
| 使用厂商 SDK（ESP-IDF / Zephyr / STM32CubeMX） | **用它的构建系统** 。ESP-IDF 用 CMake，CubeMX 生成 Makefile 或 CMake |
| 需要单元测试（PC 上跑逻辑测试） | **CMake** 。同一份代码编出两个 target，一个给 ARM，一个给 x86 跑测试 |

 

**一个非常实用的技巧** ：用 CMake 把 *不依赖硬件的纯逻辑代码* （协议解析、状态机、算法） 单独编成 PC 版本，在电脑上跑单元测试。 **硬件调试一次要几十秒，PC 上跑测试只要几毫秒。**  这是提升嵌入式开发效率最有效的手段之一。

 

```zhizhan-anchor
ch5-5-3
```



### 5.5.3 工具链文件：一行写错，整个工程 configure 都过不去

 

上一节那份 ` CMakeLists.txt ` 是照着真实 STM32 工程写的 *模板* ，它引用的 ` Drivers/ `、` Src/ ` 并不在本站仓库里。把那个块按文件头的两行注释拆成 ` cmake/arm-none-eabi.cmake ` 与 ` CMakeLists.txt ` 两个文件、真的 configure 一次， 结果如下 —— 注意 ` -- Configuring done `  **已经打印出来了** ，说明工具链文件和 CMakeLists 的写法本身没问题，卡住的只是"源文件不在"：

 

bash§5.5.2 那份模板：实测只差源文件

 

```text
$ cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE=cmake/arm-none-eabi.cmake
-- The C compiler identification is GNU 13.3.1
-- The CXX compiler identification is GNU 13.3.1
-- The ASM compiler identification is GNU
-- Found assembler: <工具链>/arm-none-eabi-gcc
-- Detecting C compiler ABI info
-- Detecting C compiler ABI info - done
-- Check for working C compiler: <工具链>/arm-none-eabi-gcc - skipped
-- Detecting C compile features
-- Detecting C compile features - done
-- Detecting CXX compiler ABI info
-- Detecting CXX compiler ABI info - done
-- Check for working CXX compiler: <工具链>/arm-none-eabi-g++ - skipped
-- Detecting CXX compile features
-- Detecting CXX compile features - done
-- Configuring done (2.2s)
CMake Error at CMakeLists.txt:24 (add_library):
  Cannot find source file:

    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c


CMake Error at CMakeLists.txt:32 (add_executable):
  Cannot find source file:

    Src/main.c


CMake Error at CMakeLists.txt:24 (add_library):
  No SOURCES given to target: hal


CMake Error at CMakeLists.txt:32 (add_executable):
  No SOURCES given to target: stm32_firmware


CMake Generate step failed.  Build files cannot be regenerated correctly.
退出码 1 —— 错因是"文件缺失"，不是"写法错误"
（上面每个 CMake Error 后面的空行也是输出的一部分，原样保留）
（<工具链> 是省略：原文是工具链 bin 的绝对路径加 .exe；耗时随机器而变；其余逐字）
```

 

这一节换成一个 **能在本机真跑通的最小工程** ：五个文件、一个 ` main `、一次 ` printf `，用它把工具链文件里最容易写错的三处量出来。实测环境： **cmake 4.0.3 \+ ninja 1.12.1 \+ arm-none-eabi-gcc 13.3.1** ，目标 ` -mcpu=cortex-m3 -mthumb -Os -Wall `， 工具链的 ` bin ` 已加入 ` PATH `（所以工具链文件里可以只写裸名字）。

 

#### 坑一：` CMAKE_TRY_COMPILE_TARGET_TYPE ` —— 少了它，configure 直接失败

 

先看很多人第一版会写成的样子 —— 它缺的正是上面那 **最关键的一行** （注释也比下面那份规范写法省）：

 

cmake/toolchain\_old.cmake — 反面教材：把那一行删掉 CMake

 

```text
# toolchain_old.cmake —— 反面教材：没有 TRY_COMPILE_TARGET_TYPE
set(CMAKE_SYSTEM_NAME      Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER   arm-none-eabi-gcc)
set(CMAKE_ASM_COMPILER arm-none-eabi-gcc)
set(CMAKE_OBJCOPY      arm-none-eabi-objcopy)
set(CMAKE_SIZE         arm-none-eabi-size)
set(CMAKE_AR           arm-none-eabi-ar)
set(CMAKE_RANLIB       arm-none-eabi-ranlib)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_C_FLAGS_INIT          "-mcpu=cortex-m3 -mthumb -Os -Wall")
set(CMAKE_EXE_LINKER_FLAGS_INIT "-mcpu=cortex-m3 -mthumb")
```

 

用它 configure，退出码  **1** ：

 

bash少了那一行：实测输出（节选）

 

```text
$ cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE=cmake/toolchain_old.cmake
-- Detecting C compiler ABI info
-- Detecting C compiler ABI info - failed
-- Check for working C compiler: <工具链>/arm-none-eabi-gcc
-- Check for working C compiler: <工具链>/arm-none-eabi-gcc - broken
CMake Error at <cmake>/share/cmake-4.0/Modules/CMakeTestCCompiler.cmake:67 (message):
  The C compiler
    "<工具链>/arm-none-eabi-gcc"
  is not able to compile a simple test program.
  It fails with the following output:
    （试编译的链接命令略）
    libc.a(libc_a-exit.o): in function `exit':
    exit.c:(.text.exit+0x14): undefined reference to `_exit'
    libc.a(libc_a-closer.o): in function `_close_r':
    closer.c:(.text._close_r+0xc): undefined reference to `_close'
    libc.a(libc_a-lseekr.o): in function `_lseek_r':
    lseekr.c:(.text._lseek_r+0x14): undefined reference to `_lseek'
    libc.a(libc_a-readr.o): in function `_read_r':
    readr.c:(.text._read_r+0x14): undefined reference to `_read'
    libc.a(libc_a-writer.o): in function `_write_r':
    writer.c:(.text._write_r+0x14): undefined reference to `_write'
    libc.a(libc_a-sbrkr.o): in function `_sbrk_r':
    sbrkr.c:(.text._sbrk_r+0xc): undefined reference to `_sbrk'
    collect2.exe: error: ld returned 1 exit status
  CMake will not be able to correctly generate this project.
Call Stack (most recent call first):
  CMakeLists.txt:2 (project)
-- Configuring incomplete, errors occurred!
```

 

**根因** ：CMake 判断"编译器可用"的办法，是 *真的链一个可执行文件* 出来 （一个只含 ` int main(void){return 0;} ` 的测试程序）。裸机工具链没有操作系统， newlib 把 ` _exit ` / ` _write ` / ` _sbrk ` 这些 "系统调用"留成了未实现的桩函数，全靠 ` libnosys ` 补 —— 你没带 nosys，链接就必然停在 ` undefined reference ` 上。六个符号一个不少，全在这一屏里。

 

规范写法就是把探测的"链接"这一步取消掉：

 

cmake/toolchain\_new.cmake — 规范写法：一行都不能少 CMake

 

```text
# toolchain_new.cmake —— Cortex-M 交叉编译工具链描述（规范写法）
set(CMAKE_SYSTEM_NAME      Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)

# ↓↓↓ 整份文件里最关键的一行：让编译器可用性探测【只编译成静态库】，不去链接可执行文件。
# 裸机工具链没有 _exit / _write / _sbrk 的实现，默认探测（试链一个 main）必然失败。
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)

set(CMAKE_C_COMPILER   arm-none-eabi-gcc)
set(CMAKE_ASM_COMPILER arm-none-eabi-gcc)
set(CMAKE_OBJCOPY      arm-none-eabi-objcopy)
set(CMAKE_SIZE         arm-none-eabi-size)
set(CMAKE_AR           arm-none-eabi-ar)
set(CMAKE_RANLIB       arm-none-eabi-ranlib)

# 可执行程序（objcopy/size 这些）从宿主机 PATH 找，头文件与库从工具链 sysroot 找。
# 本工程没配额外 sysroot，所以 CMAKE_FIND_ROOT_PATH 留空，只看下面三条的语义。
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)

set(CMAKE_C_FLAGS_INIT          "-mcpu=cortex-m3 -mthumb -Os -Wall")
set(CMAKE_EXE_LINKER_FLAGS_INIT "-mcpu=cortex-m3 -mthumb")
```

 

| 工具链文件 | configure 退出码 | 探测行的结局 |
| --- | --- | --- |
| 少了那一行 | **1** | ` ABI info - failed ` → ` Check for working C compiler … - broken `， 接着是 6 个 ` undefined reference ` 与 ` Configuring incomplete, errors occurred! ` |
| 规范写法（` STATIC_LIBRARY `） | 0 | ` Detecting C compiler ABI info - done ` → ` Check for working C compiler … - skipped ` |
| 少了那一行，但把 ` --specs=nosys.specs ` 塞进 ` CMAKE_EXE_LINKER_FLAGS_INIT ` | 0 | 同样是 ` - done ` → ` - skipped `； 门禁把两份  **configure 输出** 里的路径与耗时归一化后逐行比对， **差异 0 行** |

 

✔ 两条修法都能让 configure 过去，但机制不一样

 

第一条（` STATIC_LIBRARY `）是 **根本不去链接** ； 第二条（nosys）是 **让那一次探测链接能成功** 。两条路最后都走到同一句话，因为 CMake 模块里的逻辑是 "ABI 探测过了，就不再做专门的链接测试" —— 这一步在 ` CMakeTestCCompiler.cmake ` 里 就这么六行（ **源码事实** ：本站没读过、也没跑过 CMake 源码，这几行直接抄自本机安装的 cmake 4.0.3 里 ` share/cmake-4.0/Modules/CMakeTestCCompiler.cmake ` 第 28～33 行）：

 

```text
CMAKE_DETERMINE_COMPILER_ABI(C ${CMAKE_ROOT}/Modules/CMakeCCompilerABI.c)
if(CMAKE_C_ABI_COMPILED)
  # The compiler worked so skip dedicated test below.
  set(CMAKE_C_COMPILER_WORKS TRUE)
  message(STATUS "Check for working C compiler: ${CMAKE_C_COMPILER} - skipped")
endif()
```

 

⚠ 第二条有个前提：` --specs=nosys.specs `  **只能给一次** 。 下面那个工程自己的 ` target_link_options ` 里已经写了它，工具链文件里再给一遍的话， configure 照样过（两处的探测结果一模一样），可一到真构建，链接器会直接拒绝 —— 实测退出码 1：` arm-none-eabi-gcc: fatal error: …/nosys.specs: attempt to rename spec
      'link_gcc_c_sequence' to already defined spec 'nosys_link_gcc_c_sequence' `。 要么留在工程里、要么挪进工具链文件，二选一。

 

这也是为什么 **不能拿 ` - skipped ` 这一行去判断"我写对了"** ：上面三种情况里有 两种都会打印它，而"没写对"的那一种打印的是 ` - broken `。要看的是 **退出码** 和 它前面那句 ` ABI info ` 到底是 ` - done ` 还是 ` - failed `。

 

#### 把最小工程真的构建出来

 

再加上四个文件：工程定义、链接脚本、启动文件、应用代码。工程名就叫 ` fw `， 产物是 ` fw.elf `（下面会看到"名字"这件事本身也有个坑）。

 

cmake/CMakeLists.txt — 四件套之一：工程定义 CMake

 

```text
cmake_minimum_required(VERSION 3.20)
project(fw C ASM)

add_executable(fw src/main.c startup.c)

# 产物后缀要在【目标】上设，不能靠工具链文件里的 CMAKE_EXECUTABLE_SUFFIX（下面有实测）
set_target_properties(fw PROPERTIES SUFFIX ".elf")

target_compile_options(fw PRIVATE -ffunction-sections -fdata-sections)

target_link_options(fw PRIVATE
    -T${CMAKE_CURRENT_SOURCE_DIR}/link.ld
    --specs=nosys.specs
    -Wl,-Map=${CMAKE_CURRENT_BINARY_DIR}/fw.map
    -Wl,--gc-sections)

add_custom_command(TARGET fw POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:fw> fw.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:fw>)
```

 

cmake/link.ld — 四件套之二：链接脚本（注意 .heap 段那两行） Linker

 

```text
/* link.ld —— STM32 风格的最小链接脚本（给 crt0 和 libnosys 提供它们要用的符号） */
MEMORY {
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 256K
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}
ENTRY(Reset_Handler)
_estack = ORIGIN(RAM) + LENGTH(RAM);
SECTIONS {
  .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
  .text : { *(.text*) *(.rodata*) } > FLASH
  .ARM.extab : { *(.ARM.extab*) } > FLASH
  .ARM : { __exidx_start = .; *(.ARM.exidx*) __exidx_end = .; } > FLASH
  _sidata = LOADADDR(.data);
  .data : { _sdata = .; *(.data*) _edata = .; } > RAM AT > FLASH
  .bss  : { _sbss = .; *(.bss*) *(COMMON) _ebss = .; } > RAM
  /* libnosys.a 的 sbrk.o 需要 end/_end 当堆起点；自写脚本必须自己给 */
  .heap (NOLOAD) : { . = ALIGN(8); PROVIDE(end = .); PROVIDE(_end = .); } > RAM
}
```

 

cmake/startup.c — 四件套之三：向量表与 Reset\_Handler C

 

```text
/* startup.c —— 最小启动文件：向量表 + Reset_Handler（负责 .data 搬运 / .bss 清零） */
#include <stdint.h>
extern uint32_t _sidata, _sdata, _edata, _sbss, _ebss, _estack;
extern int main(void);
void Reset_Handler(void);
void Default_Handler(void) { for (;;) { } }
__attribute__((section(".isr_vector"), used))
void (* const g_vectors[])(void) = { (void (*)(void))&_estack, Reset_Handler };
void Reset_Handler(void)
{
    uint32_t *s = &_sidata, *d = &_sdata;
    while (d < &_edata) { *d++ = *s++; }
    for (d = &_sbss; d < &_ebss; ) { *d++ = 0; }
    main();
    for (;;) { }
}
```

 

cmake/main.c — 四件套之四：应用代码 C

 

```text
/* main.c —— CMake 交叉编译演示用的最小固件 */
#include <stdio.h>
volatile unsigned g_tick;
int main(void) { g_tick = 1; printf("tick=%u\n", g_tick); return 0; }
```

 

bash构建成功：三条编译/链接记录 \+ 8 条桩函数警告

 

```text
$ cmake --build build
[1/3] Building C object CMakeFiles/fw.dir/src/main.c.obj
[2/3] Building C object CMakeFiles/fw.dir/startup.c.obj
[3/3] Linking C executable fw.elf
ld.exe: …/libc.a(libc_a-closer.o): in function `_close_r':
closer.c:(.text._close_r+0xc): warning: _close is not implemented and will always fail
ld.exe: …/libc.a(libc_a-closer.o): note: the message above does not take linker garbage collection into account
ld.exe: …/libc.a(libc_a-fstatr.o): in function `_fstat_r':
fstatr.c:(.text._fstat_r+0xe): warning: _fstat is not implemented and will always fail
ld.exe: …/libc.a(libc_a-signalr.o): in function `_getpid_r':
signalr.c:(.text._getpid_r+0x0): warning: _getpid is not implemented and will always fail
ld.exe: …/libc.a(libc_a-isattyr.o): in function `_isatty_r':
isattyr.c:(.text._isatty_r+0xc): warning: _isatty is not implemented and will always fail
ld.exe: …/libc.a(libc_a-signalr.o): in function `_kill_r':
signalr.c:(.text._kill_r+0xe): warning: _kill is not implemented and will always fail
ld.exe: …/libc.a(libc_a-lseekr.o): in function `_lseek_r':
lseekr.c:(.text._lseek_r+0x14): warning: _lseek is not implemented and will always fail
ld.exe: …/libc.a(libc_a-readr.o): in function `_read_r':
readr.c:(.text._read_r+0x14): warning: _read is not implemented and will always fail
ld.exe: …/libc.a(libc_a-writer.o): in function `_write_r':
writer.c:(.text._write_r+0x14): warning: _write is not implemented and will always fail
   text	   data	    bss	    dec	    hex	filename
  28428	   1740	    388	  30556	   775c	…/build/fw.elf
退出码 0 —— 桩函数的 warning 一共 8 条，每条后面跟一条 note（note 不计入 warning）
（ld.exe 后面那串是 ld.exe 自己报的绝对路径，为排版缩成一个 …；
  除上面第一条外，其余 7 条 warning 后面也各跟一条形状相同的 note 行，同样略去；
  表里 filename 列那个绝对路径来自 $<TARGET_FILE:fw>，也把前缀缩成了 …）
```

 

这 8 条警告值得单独说一句： **它不阻止构建，但意味着 ` printf ` 的输出没人接** 。 ` printf ` 要落盘就得走 ` _write `，nosys 给的 ` _write ` 桩函数什么都不做 —— 所以在真机上跑这段代码，串口里一个字都不会出现。要让它真能输出，得自己实现 ` _write ` 把字节怼进 UART 的 DR 寄存器（这一条在 §7 有完整代码）。

 

```zhizhan-table
{"rows":[[{"body":"产物","header":true,"rowSpan":1,"colSpan":1},{"body":"字节数","header":true,"rowSpan":1,"colSpan":1},{"body":"sha256 前 16 位","header":true,"rowSpan":1,"colSpan":1},{"body":"说明","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` fw.elf `","header":false,"rowSpan":1,"colSpan":1},{"body":"51788","header":false,"rowSpan":1,"colSpan":1},{"body":"138e5928f390702c","header":false,"rowSpan":1,"colSpan":1},{"body":"带符号表与节表。门禁把同一份工程放到 **两个不同深度** 的目录里各建一次， 字节数与 sha256  **完全一致**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` fw.bin `","header":false,"rowSpan":1,"colSpan":1},{"body":"30168","header":false,"rowSpan":1,"colSpan":1},{"body":"8ffeed29d4c66837","header":false,"rowSpan":1,"colSpan":1},{"body":"` objcopy -O binary ` 的产物：只有段内容，没有符号表。 跨目录同样字节数与哈希一致","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` fw.map `","header":false,"rowSpan":1,"colSpan":1},{"body":"242052","header":false,"rowSpan":1,"colSpan":1},{"body":"—","header":false,"rowSpan":1,"colSpan":1},{"body":"map 是链接过程的文本记录， **深浅无关** ：门禁把同一个工程放到 深 42 个字符的目录里又建了一次，map 仍是 242052 字节，而且两次的 map 里  **一次都没出现构建目录的绝对路径** （门禁逐份数过）—— 因为 CMake 传给链接器的 对象文件是构建目录内的相对路径（` CMakeFiles/fw.dir/src/main.c.obj `）， 里面唯一带绝对路径的地方是 **工具链的库成员** 。  \n 但\"看产物是否可复现\"仍然要看 ELF 的哈希、不要看 map：ELF 只记内容， map 还把工具链装在哪儿一并记了进去","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

bash产物体检：体积、入口、关键符号

 

```text
$ arm-none-eabi-size build/fw.elf
   text	   data	    bss	    dec	    hex	filename
  28428	   1740	    388	  30556	   775c	build/fw.elf
→ Flash 占用 = text + data = 30168 字节，正好等于 fw.bin 的大小

$ arm-none-eabi-readelf -h build/fw.elf
  Type:                              EXEC (Executable file)
  Entry point address:               0x8000025
  Flags:                             0x5000200, Version5 EABI, soft-float ABI
→ 入口地址最低位是 1 —— 这是 Thumb 状态标志位，0x08000024 那条 Reset_Handler 就是它

$ arm-none-eabi-nm build/fw.elf | grep -E ' (_estack|end|_sidata|g_tick|main|Reset_Handler)$'
20010000 R _estack           ← ORIGIN(RAM) + LENGTH(RAM)
08006f0c A _sidata           ← .data 在 Flash 里的加载地址
20000850 ? end               ← 就是 link.ld 里 PROVIDE 出来的那个堆起点
200006cc B g_tick            ← 未初始化，落在 .bss
08000008 T main
08000024 T Reset_Handler

$ arm-none-eabi-nm -n build/fw.elf   # -n = 按地址排
08000000 R g_vectors
08000008 T main
08000024 T Reset_Handler
08000064 t stdio_exit_handler
…（后面还有几百行，略）
```

 

注意上面第一条命令 **没有**  ` -n `：` nm ` 默认按 **符号名**  排序，所以输出里 ` 20010000 ` 排在最前面、` 08000024 ` 反而在最后 —— 那不是内存顺序，别照着它画内存图。加上 ` -n `（第二条命令）之后，前三行才是真正的地址序： ` g_vectors ` 在 ` 08000000 `、` main ` 在 ` 08000008 `、` Reset_Handler ` 在 ` 08000024 `。

 

#### 坑二：链接脚本里少了 ` PROVIDE(end = .) `，构建期才炸

 

把 ` link.ld ` 里 ` .heap ` 那两行删掉（其余一字不改），  **configure 照样是 0**  —— 因为链接脚本只在真正链接时才被读。炸的是构建那一步：

 

bash少了 .heap 段：实测输出（节选）

 

```text
$ cmake --build build
[1/3] Building C object CMakeFiles/fw.dir/src/main.c.obj
[2/3] Building C object CMakeFiles/fw.dir/startup.c.obj
[3/3] Linking C executable fw.elf
FAILED: fw.elf
  （8 条 _close/_fstat/_getpid/_isatty/_kill/_lseek/_read/_write 的桩函数警告，同上）
  in function `_sbrk':
  sbrk.c:(.text._sbrk+0x18): undefined reference to `end'
collect2.exe: error: ld returned 1 exit status
ninja: build stopped: subcommand failed.
退出码 1
```

 

注意引用 ` end ` 的是  **` libnosys.a(sbrk.o) `** ， 不是你的代码 —— 你的代码只调了 ` printf `，是 ` printf ` 要 ` malloc `、` malloc ` 要 ` _sbrk `， 于是链接器把 nosys 的 ` sbrk.o ` 拉进来，而它一进来就要 ` end `。 修法就是上面 ` link.ld ` 里那两行 ` PROVIDE `。 这条"谁定义了 ` end `、它是懒惰的"的完整来龙去脉在 [§4.5.1](doc:course-b01-ch4#ch4-5-1)，这里只是把它在 CMake 工程里再确认一次。

 

#### 坑三：` CMAKE_EXECUTABLE_SUFFIX ` 写在工具链文件里不生效

 

很多资料（包括本站上一版）会告诉你"在工具链文件里加一句 ` set(CMAKE_EXECUTABLE_SUFFIX ".elf") `，产物就带 .elf 后缀了"。 实测： **在 cmake 4.0.3 \+ ` CMAKE_SYSTEM_NAME Generic ` 下，这句不生效** ， 产物仍是一个没有后缀的 ` fw `；把同一句放进 CMakeLists 也要放在 ` project() ` 之后才稳。稳妥的写法是直接设在目标上：

 

| 写法 | 构建目录里的产物 | 结论 |
| --- | --- | --- |
| 工具链文件里 ` set(CMAKE_EXECUTABLE_SUFFIX ".elf") ` | ` fw ` ` fw.bin ` ` fw.map ` | **没生效** （后缀被平台系统模块重置掉） |
| CMakeLists 里 ` set_target_properties(fw PROPERTIES SUFFIX ".elf") ` | ` fw.elf ` ` fw.bin ` ` fw.map ` | **生效** ，本节的产物就来自这一行 |

 

⚠ 把 CMake 用到裸机上的六条检查清单

 

 
1. 工具链文件 **单独成文件** ，靠 ` -DCMAKE_TOOLCHAIN_FILE= ` 传入（见 §5.5.2 的讲解）。
 
2. ` CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY ` 有没有写。少了它，报错会指向 CMake 自己的模块文件， **跟你的代码一行关系都没有** ，最容易白查半天。
 
3. 判断"配好了"要看 **退出码** 与 ` ABI info - done/- failed `，  **不要** 看 ` - skipped `（两种情况都会打印它）。
 
4. 换了工具链文件、改了 ` CMAKE_C_FLAGS_INIT ` 这类变量，先  **删掉 ` build/ ` 重新 configure**  —— ` CMakeCache.txt ` 里缓存着编译器路径，改文件不会自动生效（这一条 §5.5.2 也提过）。
 
5. 自写链接脚本时，` end ` / ` _end ` 得自己 ` PROVIDE `（§4.5.1）。少了它，报错出现在 **链接期** 而不是 configure 期。
 
6. 产物的后缀、` objcopy `／` size ` 的调用，全部写在 ` add_custom_command(... POST_BUILD) ` 里，别指望工具链文件替你管这些。

 

```zhizhan-anchor
ch5-6
```



## 5.6 交叉编译：为什么需要"另一套"工具链

 

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| **build** | 编译动作发生的机器 | x86-64 Windows 11 |
| **host** | 编译器程序运行的机器 | 同上（本地编译时 build = host） |
| **target** | 生成的可执行文件运行的机器 | ARM Cortex-M3 |
| **交叉编译** | build ≠ target | 在 PC 上编 ARM 固件 |
| **工具链前缀** | 标明 host 和 target | ` arm-none-eabi- ` = ARM 目标 · 无 OS · EABI |

 

bash工具链命名解码

 

```text
arm-none-eabi-gcc
 │    │    │    └─ gcc：这是 C 编译器
 │    │    └────── eabi：使用 ARM EABI（嵌入式应用二进制接口）
 │    └─────────── none：无操作系统（裸机）→ 没有 Linux 系统调用
 └──────────────── arm：目标架构是 ARM

# 对比几个常见的：
arm-none-linux-gnueabihf-gcc   ← 目标跑 Linux，硬浮点
arm-none-eabi-gcc              ← 裸机（STM32 用这个）
xtensa-esp32-elf-gcc           ← ESP32（Xtensa 架构）
riscv32-unknown-elf-gcc        ← RISC-V 裸机
aarch64-linux-gnu-gcc          ← 64 位 ARM Linux

# 验证工具链是否装好
$ arm-none-eabi-gcc --version
arm-none-eabi-gcc (GNU Arm Embedded Toolchain 10.3-2021.10) 10.3.1 20210824

# 查看编译器默认的宏（判断是否真的在用 Cortex-M3 配置）
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -dM -E - < /dev/null | grep -E '__ARM|__thumb|CORTEX'
#define __ARM_ARCH 7
#define __ARM_ARCH_7M__ 1              ← 正确识别为 ARMv7-M
#define __thumb__ 1                    ← Thumb 模式已启用
# 注意这里"没有" __ARM_FP —— 因为 cortex-m3 根本没有 FPU。
# 这就是本章"STM32F1 无硬件浮点"这句话的机器可验证证据：
# 编译器不会凭空定义 __ARM_FP，宏列表里查不到，就说明浮点运算会走软件库。

# 换成带单精度 FPU 的 M4F 再看，__ARM_FP 才会出现：
$ arm-none-eabi-gcc -mcpu=cortex-m4 -mfloat-abi=hard -mfpu=fpv4-sp-d16 -mthumb -dM -E - < /dev/null | grep -E '__ARM_FP|__VFP'
#define __ARM_FP 4                     ← bit2 置位 = 支持单精度（bit1=half, bit3=double）
#define __VFP_FP__ 1                   ← 确有 VFP 硬件浮点单元
```

 

⚠ ESP32 的特殊性

 

STM32 是 ARM Cortex-M，用标准 GNU ARM 工具链即可。  **ESP32 是 Xtensa（或 RISC-V）架构** ，工具链是乐鑫自己维护的 ` xtensa-esp32-elf-gcc `， 通常 *不需要手动装* ——` idf.py ` 会在首次构建时自动下载匹配的工具链到 ` ~/.espressif/ `。   
  
 所以 ESP32 项目的"编译链接"这层被 ESP-IDF 封装得更彻底：你写 ` idf.py build `， 它背后跑的仍然是 CMake \+ xtensa-gcc \+ 自己的链接脚本。  **本章讲的原理完全适用，只是操作入口变成了 ` idf.py `。**    
  
 ESP-IDF 下想看实际编译命令：` idf.py -v build `（verbose）。 想看链接脚本：` build/esp32.ld ` 和 ` build/esp32.project.ld `。 想看 map：` build/*.map `。

 

```zhizhan-anchor
ch5-6-1
```



### 5.6.1 另一张地图：ESP32 的地址体系与分区表

 

前面所有关于地址的直觉，都建立在 STM32 那张图上：Flash 从 ` 0x08000000 ` 起 （本章链接脚本和 ` nm -n ` 的输出都印证了这一点）、SRAM 从 ` 0x20000000 ` 起、 外设寄存器从 ` 0x40000000 ` 起。最后这一条不是 ST 的习惯，而是 **架构规定** ： Armv7-M 手册（DDI 0403）表 B3-1 里，` 0x40000000–0x5FFFFFFF ` 整段的类型就是 Peripheral（ **手册事实** ）。

 

到了 ESP32，这三条 **全都不成立**  —— 而最容易栽的恰恰是 ` 0x40000000 `。

 

✗ ESP32 上 ` 0x40000000 ` 不是外设区，是 ROM 的取指窗口

 

ESP-IDF v6.0 的 ` components/soc/esp32/include/soc/soc.h ` 把地图逐段钉死 （ **源码事实** ：读源码得来 —— 本站没有 ESP32 硬件，也没跑过 IDF 构建）：

 

```text
#define SOC_IROM_MASK_LOW       0x40000000   <-- 这一段是【屏蔽 ROM】的取指窗口
#define SOC_IROM_MASK_HIGH      0x40070000
#define SOC_CACHE_PRO_LOW       0x40070000
#define SOC_CACHE_APP_HIGH      0x40080000
#define SOC_IRAM_LOW            0x40080000   <-- 0x40080000 才是片内 SRAM 的取指视图
#define SOC_IRAM_HIGH           0x400AA000
#define SOC_IROM_LOW            0x400D0000   <-- flash 的取指窗口
#define SOC_DROM_LOW            0x3F400000   <-- flash 的只读数据窗口
#define SOC_DRAM_LOW            0x3FFAE000   <-- 片内 SRAM 的数据视图
#define SOC_DRAM_HIGH           0x40000000
```

 

那外设寄存器在哪？在 ` 0x3FF00000 ` 一带（` register/soc/reg_base.h `， 同样是源码事实）：` DR_REG_DPORT_BASE 0x3ff00000 `、 ` DR_REG_GPIO_BASE 0x3ff44000 `、` DR_REG_IO_MUX_BASE 0x3ff49000 `。 它们落在 **数据总线** 那一侧，紧贴在 DRAM 窗口的下方。

 

所以"把 STM32 上的 ` *(volatile uint32_t *)0x40000000 = x; ` 原样搬到 ESP32"会写进 ROM 的地址空间： **编译器不报错、链接器不报错，跑起来才出错** 。 这才是这一节存在的理由 —— 地址是不是外设区，工具链一个字都不会告诉你。

 

#### 一台芯片，三套地址

 

根源是 CPU 有 **两条总线** （取指 / 读写），再加上 flash 通过 MMU 映射进来的两个窗口。 于是同一份物理存储，在链接脚本里会有几个不同的地址：

 

```zhizhan-table
{"rows":[[{"body":"总线 / 窗口","header":true,"rowSpan":1,"colSpan":1},{"body":"地址","header":true,"rowSpan":1,"colSpan":1},{"body":"用途","header":true,"rowSpan":1,"colSpan":1},{"body":"链接脚本里的段名","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**指令总线** （IRAM）","header":false,"rowSpan":1,"colSpan":1},{"body":"0x40000000 起  \nSRAM 在 0x40080000","header":false,"rowSpan":1,"colSpan":1},{"body":"取指。只能  **4 字节对齐** 访问","header":false,"rowSpan":1,"colSpan":1},{"body":"` iram0_0_seg ` / ` iram0_2_seg `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**数据总线** （DRAM）","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3FF00000 起  \nSRAM 在 0x3FFAE000","header":false,"rowSpan":1,"colSpan":1},{"body":"读写。可以 **按字节** 访问","header":false,"rowSpan":1,"colSpan":1},{"body":"` dram0_0_seg `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**flash 数据窗口** （DROM）","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3F400000","header":false,"rowSpan":1,"colSpan":1},{"body":"读常量（字符串、` const ` 数组）","header":false,"rowSpan":1,"colSpan":1},{"body":"` drom0_0_seg `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**flash 取指窗口** （IROM）","header":false,"rowSpan":1,"colSpan":1},{"body":"0x400D0000","header":false,"rowSpan":1,"colSpan":1},{"body":"执行代码（经 MMU，本质仍在 flash 里）","header":false,"rowSpan":1,"colSpan":1},{"body":"` iram0_2_seg `（名字叫 iram，实际映射到 flash）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**外设**","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3FF00000 一带","header":false,"rowSpan":1,"colSpan":1},{"body":"寄存器读写（DPORT / GPIO / IO\\_MUX…）","header":false,"rowSpan":1,"colSpan":1},{"body":"不占段","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

对照本章前面 STM32 那张图： **STM32 上一块 SRAM 只有一个地址** ，` 0x20000000 ` 既能取指也能读写；ESP32 上同一块 SRAM 在两条总线上 **有两个地址** 。源码里这条注释是逐字的：

 

linker scriptESP-IDF v6.0 · components/esp\_system/ld/esp32/memory.ld.in

 

```text
rtc_iram_seg(RWX) :  org = 0x400C0000, len = 0x2000 - ESP_BOOTLOADER_RESERVE_RTC   ← 指令视图，可执行
rtc_data_seg(RW)  :  org = 0x3ff80000, len = 0x2000 - ESP_BOOTLOADER_RESERVE_RTC   ← 数据视图，同一块

/* RTC fast memory (same block as above, rtc_iram_seg), viewed from data bus */
```

 

RTC FAST 那 8 KB 是这样，片内那块 128 KB 的 D/IRAM 更是这样 （` soc.h `，源码事实）：` SOC_DIRAM_IRAM_LOW/HIGH = 0x400A0000/0x400C0000 `， ` SOC_DIRAM_DRAM_LOW/HIGH = 0x3FFE0000/0x40000000 ` —— 同样 128 KB，两个地址段。而且源码还多写了一句：

 

soc.hD/IRAM 的两条视图

 

```text
//First and last words of the D/IRAM region, for both the DRAM address as well as the IRAM alias.
#define SOC_DIRAM_IRAM_LOW    0x400A0000
#define SOC_DIRAM_IRAM_HIGH   0x400C0000
#define SOC_DIRAM_DRAM_LOW    0x3FFE0000
#define SOC_DIRAM_DRAM_HIGH   0x40000000
// Byte order of D/IRAM regions is reversed between accessing as DRAM or IRAM
#define SOC_DIRAM_INVERTED    1
```

 

注意最后那一行： **两条总线看到的字节序是相反的** 。这解释了一件在 ` memory.ld.in ` 里看着很怪的事 —— 堆的上界为什么是"倒着算"的：

 

linker script堆的边界（memory.ld.in，源码事实）

 

```text
_heap_start = _heap_low_start;                    /* 默认分支 */
_sram1_iram_start = 0x400A0000;
_sram1_iram_len   = ( _iram_end > _sram1_iram_start) ? (_iram_end - _sram1_iram_start) : 0;
_heap_end = ALIGN(0x40000000 - _sram1_iram_len - 3, 4);   ← 从 0x40000000 往下减
```

 

意思是：IRAM 用得多一点，堆就小一点 —— 因为 **它们本来就是同一块 RAM 的两头** 。 在 STM32 上你要自己算 ` data + bss + heap + stack ` 会不会撑爆 SRAM； 在 ESP32 上这件事写进了链接脚本的算式里。

 

#### 它自己的 MEMORY 块长什么样

 

把 ` memory.ld.in ` 的 ` MEMORY ` 块抄成一张表（源码事实）， 和本章前面那份 STM32 链接脚本对照着看，差别一目了然：

 

```zhizhan-table
{"rows":[[{"body":"段名","header":true,"rowSpan":1,"colSpan":1},{"body":"org","header":true,"rowSpan":1,"colSpan":1},{"body":"len","header":true,"rowSpan":1,"colSpan":1},{"body":"权限","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` iram0_0_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x40080000","header":false,"rowSpan":1,"colSpan":1},{"body":"0x20000 \\+ SRAM1\\_IRAM\\_LEN","header":false,"rowSpan":1,"colSpan":1},{"body":"RX","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` iram0_2_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x400D0020","header":false,"rowSpan":1,"colSpan":1},{"body":"0x330000 - 0x20","header":false,"rowSpan":1,"colSpan":1},{"body":"RX（ **其实是 flash** ）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` dram0_0_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3FFB0000 \\+ BTDM\\_RESERVE","header":false,"rowSpan":1,"colSpan":1},{"body":"0x2c200 - BTDM\\_RESERVE  \n（180.5 KB）","header":false,"rowSpan":1,"colSpan":1},{"body":"RW","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` drom0_0_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3F400020","header":false,"rowSpan":1,"colSpan":1},{"body":"0x400000 - 0x20","header":false,"rowSpan":1,"colSpan":1},{"body":"R","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` rtc_iram_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x400C0000","header":false,"rowSpan":1,"colSpan":1},{"body":"0x2000 - BOOTLOADER\\_RESERVE\\_RTC","header":false,"rowSpan":1,"colSpan":1},{"body":"RWX","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` rtc_data_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3ff80000","header":false,"rowSpan":1,"colSpan":1},{"body":"同上（同一块）","header":false,"rowSpan":1,"colSpan":1},{"body":"RW","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` rtc_slow_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x50000000","header":false,"rowSpan":1,"colSpan":1},{"body":"0x2000 - RESERVE\\_RTC\\_MEM","header":false,"rowSpan":1,"colSpan":1},{"body":"RW","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` extern_ram_seg `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x3F800000","header":false,"rowSpan":1,"colSpan":1},{"body":"0x400000","header":false,"rowSpan":1,"colSpan":1},{"body":"RW（外部 PSRAM）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

顺带解开一个看源码时的小困惑：` iram0_2_seg ` 和 ` drom0_0_seg ` 的起点为什么都不是整地址，而是 ` 0x400D0020 ` / ` 0x3F400020 `？ 源码注释给了答案（逐字翻译）：

 

那个 0x20 偏移：给 MMU 的"对模"让步

 

flash cache 的页是 64 KB；烧进芯片的 ` .bin ` 有一个  **0x18 字节的文件头** ，每个段又有一个  **0x08 字节的段头**  —— ` 0x18 + 0x08 = 0x20 `。预先把虚拟地址抬高 0x20，就能自动满足 flash cache MMU 的约束 ` paddr % 64KB == vaddr % 64KB `，省掉运行时换算。 （源码注释原文： *Setting this offset makes it simple to meet the flash cache MMU's constraint that (paddr % 64KB == vaddr % 64KB)* 。）

 

#### flash 上不止有你的代码：分区表

 

STM32 上 flash 里几乎只有你的固件（顶多再放个 bootloader 和参数区）。ESP32 不是：  **flash 的布局是一张表说了算** ，这张表叫分区表（partition table）， 编译时由 ` partitions.csv ` 生成，烧录时写在 flash 固定偏移处。默认的单应用表就三行：

 

cmake/partitions.csv — 默认单应用分区表：ESP-IDF v6.0 的 partitions\_singleapp.csv 逐字 CSV

 

```text
# Name,   Type, SubType, Offset,  Size, Flags
# Note: if you have increased the bootloader size, make sure to update the offsets to avoid overlap
nvs,      data, nvs,     ,        0x6000,
phy_init, data, phy,     ,        0x1000,
factory,  app,  factory, ,        1M,
```

 

四列的含义： **Name**  是名字（也是以后 ` esp_partition_find() ` 查它的键）、  **Type/SubType**  是类型与子类型、 **Offset**  留空表示"紧接上一个分区"、  **Size**  支持 ` 1M ` 和 ` 0x6000 ` 两种写法。 下面这些数字 **全部是实测** ：把文件交给乐鑫自己的工具 ` gen_esp32part.py ` （ESP-IDF 源码树里那一份，一个字没改）跑一遍，再把它生成的 bin 反解回 CSV 打印出来：

 

bash实测 · CSV → bin → CSV（Python 3.13.12）

 

```text
$ python gen_esp32part.py singleapp.csv singleapp.bin
Parsing CSV input...
Verifying table...
# 退出码 = 0；bin 字节数 = 3072（0xC00）

$ python gen_esp32part.py singleapp.bin -
Parsing binary partition input...
Verifying table...
# ESP-IDF Partition Table
# Name, Type, SubType, Offset, Size, Flags
nvs,data,nvs,0x9000,24K,
phy_init,data,phy,0xf000,4K,
factory,app,factory,0x10000,1M,
```

 

三个分区依次落在 ` 0x9000 ` / ` 0xf000 ` / ` 0x10000 `， 连起来就是 flash 的布局。` 0x9000 ` 这个起点也不是随便来的： bootloader 从 ` 0x1000 ` 开始放（` BOOTLOADER_OFFSET_IN_FLASH ` 的默认值）， 分区表默认在 ` 0x8000 `（` PARTITION_TABLE_OFFSET ` 的默认值）， 而它 **占 0x1000 字节** ，所以第一个分区最早只能从 ` 0x9000 ` 开始。 这条在 Kconfig 的注释里写得很直白：  *"the first partition must start at PARTITION\_TABLE\_OFFSET \+ 0x1000, since the partition table occupies 0x1000 bytes of flash space"* 。（以上四行源码事实。）

 

| 偏移 | 内容 | 谁来放 |
| --- | --- | --- |
| 0x1000 | 二级 bootloader | IDF 构建时自动烧（` IDF_TARGET_ESP32 ` 的默认偏移） |
| 0x8000 | 分区表（占 0x1000） | 由 ` partitions.csv ` 生成 |
| 0x9000 | 第一个分区可用的最早偏移 | — |
| 0x9000 | ` nvs ` 24 KB | 实测输出如上 |
| 0xf000 | ` phy_init ` 4 KB | 实测输出如上 |
| 0x10000 | ` factory ` 应用 1 MB | 实测输出如上 |

 

#### "挨着排"其实有对齐规则：应用分区必须落在 64 KB 边界

 

Offset 留空并不等于"紧挨着上一个分区的结尾"，中间还有一条 **按类型对齐** 的规则 （` gen_esp32part.py ` 源码，逐字）：

 

pythonALIGNMENT（gen\_esp32part.py 第 106 行起）

 

```text
ALIGNMENT = {
    APP_TYPE: 0x10000,             ← 应用分区按 64 KB 对齐
    DATA_TYPE: 0x1000,             ← 数据分区按 4 KB 对齐
    BOOTLOADER_TYPE: 0x1000,
    PARTITION_TABLE_TYPE: 0x1000,
}
```

 

而默认那张表里，` factory ` 恰好是 **自然对齐** 的： ` 0x9000 + 0x6000(nvs) + 0x1000(phy_init) = 0x10000 ` —— 正好踩在 64 KB 边界上。 也就是说， **光看默认表，这条规则咬没咬到你根本看不出来** 。要证明它真的存在，得构造反例。 实测两组只差一列的表：

 

```zhizhan-table
{"rows":[[{"body":"","header":true,"rowSpan":1,"colSpan":1},{"body":"第一个分区","header":true,"rowSpan":1,"colSpan":1},{"body":"第二个分区","header":true,"rowSpan":1,"colSpan":1},{"body":"第二个实际落在","header":true,"rowSpan":1,"colSpan":1},{"body":"说明","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**A**","header":false,"rowSpan":1,"colSpan":1},{"body":"` nvs ` 0x3000  \n（排到 0xC000）","header":false,"rowSpan":1,"colSpan":1},{"body":"` app, factory `","header":false,"rowSpan":1,"colSpan":1},{"body":"0x10000","header":false,"rowSpan":1,"colSpan":1},{"body":"被抬到 64 KB 边界， **0xC000–0x10000 这 16 KB 空置**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**B**","header":false,"rowSpan":1,"colSpan":1},{"body":"` nvs ` 0x3000  \n（同上）","header":false,"rowSpan":1,"colSpan":1},{"body":"` data, spiffs `","header":false,"rowSpan":1,"colSpan":1},{"body":"0xc000","header":false,"rowSpan":1,"colSpan":1},{"body":"数据分区只要求 4 KB 对齐，紧挨着排","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

A 与 B  **只差 Type 那一列** ，落点差了 ` 0x4000 ` —— 这就是 ` ALIGNMENT[APP_TYPE] = 0x10000 ` 的直接证据。它不是"留空时才算"的： 你显式写一个不对齐的偏移，工具会直接拒绝（实测）：

 

bash实测 · 显式写 0x11000 也不行

 

```text
$ python gen_esp32part.py misaligned.csv misaligned.bin   # 表里 app 分区写死 Offset=0x11000
Partition second invalid: Offset 0x11000 is not aligned to 0x10000
# 退出码 = 2，不生成 bin
```

 

同一条路上还有一条 **很容易被别人的例子带坑里** 的规则：可读写的 [NVS](term:nvs) 分区最小 0x3000。 照抄一个"小 nvs"的表会直接编不过（实测报文）：

 

bash实测 · nvs 小于 0x3000 必须标 readonly

 

```text
$ python gen_esp32part.py nvs_small.csv nvs_small.bin   # nvs 只有 0x1000
Partition nvs invalid: 'nvs' partition of type 1 and subtype 2 of this size (0x1000)
must be flagged as 'readonly' (the size of read/write NVS has to be at least 0x3000)
# 退出码 = 2，不生成 bin

$ python gen_esp32part.py nvs_ro.csv nvs_ro.bin   # 同一个表，加上 readonly 就过
# 退出码 = 0；反解：nvs,data,nvs,0x9000,4K,readonly
```

 

#### 分区表自己长什么样

 

分区表烧在 flash 上就是一串定长记录。` 0xC00 ` 这个文件大小不是随手定的 （下面四行都是 ` gen_esp32part.py ` 的源码，逐字）：

 

python分区表二进制的形状（gen\_esp32part.py 第 22–24、410–414 行）

 

```text
MAX_PARTITION_LENGTH = 0xC00  # 3K for partition data (96 entries) leaves 1K in a 4K sector for signature
MD5_PARTITION_BEGIN = b'\xeb\xeb' + b'\xff' * 14  # The first 2 bytes are like magic numbers for MD5 sum
PARTITION_TABLE_SIZE = 0x1000  # 整个扇区 4 KB，但表只占前 3 KB
…
    result += MD5_PARTITION_BEGIN + hashlib.md5(result).digest()
    result += b'\xff' * (MAX_PARTITION_LENGTH - len(result))  # pad the sector, for signing
```

 

所以文件是 **一格一格排下来** 的：每条表项  **32 字节** ， 一共 96 格（` 96 × 32 = 0xC00 = 3072 `，正好填满 3 KB）。 上面那张三行的表只占了前 3 格（` 0x00 / 0x20 / 0x40 `），  **第 4 格（` 0x60 `）装的是校验** ： 它的前 16 字节是"这格是 MD5"的标记 ` eb eb ` \+ 14 个 ` 0xff `， 后 16 字节才是真正的 MD5——算的是它 **前面所有字节** 的摘要（也就是前 ` 0x60 ` 字节）。 第 5 格往后才是补 ` 0xff `。实测这 4 格：

 

python实测 · 读回 singleapp.bin：前 0x70 字节 \+ 验 MD5

 

```text
$ python -c "（读 singleapp.bin：总长、前 4 条表项、MD5 那 16 字节）"
总长 3072 = 0xc00
0x0 aa 50 01 02 00 90 00 00 00 60 00 00 6e 76 73 00 .P.......`..nvs.
0x20 aa 50 01 01 00 f0 00 00 00 10 00 00 70 68 79 5f .P..........phy_
0x40 aa 50 00 00 00 00 01 00 00 00 10 00 66 61 63 74 .P..........fact
0x60 eb eb ff ff ff ff ff ff ff ff ff ff ff ff ff ff ← 第 4 格：MD5 标记 eb eb + 14×ff
0x70 起 16 字节 = f4ad4f4538564b5d7435b62c75b69524   ← 这格的后半，才是 MD5 本身
与前 0x60 字节的 md5 相同 = True                     ← 证明它确实覆盖前面全部表项
0x80 之后全 0xff = True
```

 

右边那一列可打印字符是工具顺手算的，不是抄的——注意 ` 0x60 ` 那格整列都是点， 因为 ` eb ` 和 ` ff ` 都不是可打印字符。四条表项尾巴上能读出名字的 ` nvs ` / ` phy_ ` / ` fact `， 正是 ` name[16] ` 那个字段在屏幕上本来的样子。

 

逐字段拆开看第一条（` nvs `），每一格都能和上面的 CSV 对上：

 

| 偏移 | 长度 | 字段 | 实测字节 |
| --- | --- | --- | --- |
| 0x00 | 2 | 魔数 ` 0x50AA `（小端） | ` aa 50 ` |
| 0x02 | 1 | type | ` 01 ` = DATA |
| 0x03 | 1 | subtype | ` 02 ` = NVS |
| 0x04 | 4 | offset（小端） | ` 00 90 00 00 ` = 0x9000 |
| 0x08 | 4 | size（小端） | ` 00 60 00 00 ` = 0x6000 |
| 0x0C | 16 | name（含结尾 ` \0 `，不足补零） | ` 6e 76 73 00 ` = "nvs" |
| 0x1C | 4 | flags | ` 00 00 00 00 ` |

 

type / subtype 的数值也和头文件对得上（` esp_partition.h `，源码事实）： type 只有 ` APP=0x00 ` / ` DATA=0x01 ` / ` BOOTLOADER=0x02 ` / ` PARTITION_TABLE=0x03 ` 四种是 IDF 自己占的， ` 0x40–0xFE ` 留给应用自定义；子类型里 app 族的 ` ota_0 ` = ` 0x10 `（` OTA_MIN ` \+ 0）， 一路到 ` ota_15 `。所以 CSV 里写的 ` ota_0 ` 是个 **名字** ， 落到 flash 上是数字 ` 0x10 ` —— 这就是为什么 OTA 表实测出来长这样：

 

bash实测 · OTA 表（partitions\_two\_ota.csv）

 

```text
$ python gen_esp32part.py partitions_two_ota.csv two_ota.bin
# 退出码 = 0；bin 字节数 = 3072
$ python gen_esp32part.py two_ota.bin -   # 反解回 CSV
nvs,data,nvs,0x9000,16K,
otadata,data,ota,0xd000,8K,
phy_init,data,phy,0xf000,4K,
factory,app,factory,0x10000,1M,
ota_0,app,ota_0,0x110000,1M,
ota_1,app,ota_1,0x210000,1M,
```

 

两个应用分区各 1 MB，落在 ` 0x110000 ` 和 ` 0x210000 ` —— 同样踩着 64 KB 边界，OTA 升级就是"把新固件写进另一个分区、改一下 ` otadata `、 下次启动换过去"。这一层的代价也在这里： **flash 得留得下两份应用** 。

 

⚠ 这一节里，哪些是"读来的"，哪些是"跑出来的"

 

本站这台机器上 **没有 ESP32 硬件** 。所以这一节必须分成两类看：  
 ·  **源码事实** （读了 ESP-IDF v6.0 源码树，没运行过）：地址宏与 MEMORY 块、 ` 0x20 ` 偏移的来历、分区表类型/子类型枚举、bootloader 与分区表的默认偏移。  
 ·  **实测** （本机真跑）：` gen_esp32part.py ` 的每一次运行 —— 两个默认表的反解结果、两个对齐反例、两条拒绝报文，以及分区表二进制的字节结构与 MD5。  
  **没有** 任何一句"烧录后会看到……"——那类话在没有板子的情况下写不出来。 等你有板子，第一件该做的事就是拿 ` esptool.py read_flash ` 把 ` 0x8000 ` 处的 0xC00 字节读回来，和这里的 dump 对一遍。

 

◆ 本章要点

 

 
- 四阶段： **预处理 → 编译 → 汇编 → 链接** 。看报错信息先判断是哪个阶段，能省一半排查时间。
 
- ` undefined reference ` 是链接错误， **不是语法错误** 。去查符号定义、库链接顺序、` extern "C" `。
 
- ` nm ` 的大小写规则： **大写 = 全局，小写 = static** 。这是排查符号冲突最快的线索。
 
- ` size ` 的三个数字： **Flash = text \+ data；RAM = data \+ bss** （还要加 heap \+ stack）。
 
- 静态库链接顺序： **依赖方在前，被依赖方在后** ；不确定就用 ` --start-group `。
 
- 优化等级：开发用 ` -Og `，量产用 ` -Os ` 或 ` -O2 `。  **"-O0 能跑 -O2 不行"几乎总是 volatile 缺失或未定义行为。**
 
- 三个瘦身选项要联合用：` -ffunction-sections -fdata-sections ` \+ ` -Wl,--gc-sections `。省 10-30% Flash。
 
- Makefile 里 ` -MMD -MP ` 提供头文件依赖追踪，` | $(BUILD) ` 提供正确的增量编译。 **缺了这两个，构建系统就是坏的。**
 
- 高价值技巧： **把纯逻辑代码编成 PC 版本跑单元测试** ，调试效率提升一个数量级。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 简答：从 .c 到 .elf 的四个阶段分别是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① 预处理 ` cpp `（展开宏/头文件）→ ② 编译 ` cc1 `（生成汇编）→ ③ 汇编 ` as `（生成目标文件 .o）→ ④ 链接 ` ld `（合并 \\+ 重定位 \\+ 生成 .elf）。 *看清出错在哪一阶段，排查方向完全不同。*"}
   ```
 
2. 判断：` nm ` 输出里字母大小写有含义吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"有。 **大写 = 全局符号（外部链接），小写 = 局部符号（` static ` 或 file-local）** 。段字母 ` T/t ` 代码、` D/d ` 已初始化数据、` B/b ` .bss、` R/r ` 只读、` U ` 未定义、` W/w ` 弱符号。"}
   ```
 
3. 简答：` --specs=nano.specs ` 省了什么？代价是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"换用  **newlib-nano** （精简重实现），通常省 10–25 KB。代价：` printf ` 默认 **不支持 ` %f `/` %lld `** ，要用必须加 ` -u _printf_float `/` -u _scanf_float `，且会显著增大体积。"}
   ```
 
4. 判断：` objcopy -O binary ` 出来的 .bin 往往比 text\+data 还大，为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为它把所有 **可装载段的 LMA 区间从最低到最高整体展开** ：段之间的空隙也要按 ` --gap-fill ` 填充。所以 .bin 大小 ≈ LMA 跨度，而不是各段大小之和。"}
   ```
 
5. 找错：开了 ` --gc-sections ` 后中断全部失效，最可能是什么被回收了？怎么救？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"被回收的是 **没人引用的段：中断向量表、` .init_array `（C\\+\\+ 全局构造/constructor）、自定义表** 。救法：链接脚本里用 ` KEEP(*(.isr_vector)) `、` KEEP(*(SORT(.init_array.*))) `，或给符号加 ` __attribute__((used)) `。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  试试 ` arm-none-eabi-nm --size-sort ` 找出你项目里最大的符号。

 

```zhizhan-assessment
{"id":"course-b01-ch5","criterion":"分别保存预处理、目标、链接输出；解释 undefined reference 与重复定义的来源。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[GCC · -E/-S/-c 与编译阶段](https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html) · [GNU ld · SECTIONS、MEMORY、符号与链接](https://sourceware.org/binutils/docs/ld/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
