# 附录：速查表与陷阱清单

```zhizhan-anchor
appendix
```



这一部分不是用来通读的，是 **用来查的** 。 遇到具体问题时翻到对应表格，比重新翻前面的章节快得多。

 

> ◷ 查阅型 · ◈ 10 节 · 15 张表 · ⚑ 建议收藏

 

```zhizhan-anchor
ap-1
```



## A.1 嵌入式 C 陷阱速查表

 

下面每一条，都是 *编译器不报错、运行时才出问题* 的典型陷阱。 按"症状"索引，方便你在调试时反查。

 

| 症状 | 陷阱代码 | 根因 | 正确写法 |
| --- | --- | --- | --- |
| 低功耗中断后变量值不对 | ` while (!(REG & BIT)); ` | REG 未声明 ` volatile `，编译器把读操作提升出循环 | ` volatile uint32_t *reg ` |
| -O0 正常，-O2 出错 | ` flag = 1; ` 在 ISR 和主循环共享 | 缺 ` volatile ` 或非原子访问 | ` volatile uint8_t flag `（单字节读写天然原子）\+ 临界区保护多字节量；C11 可用 ` _Atomic ` |
| 全局变量莫名变值 | ` uint8_t buf[64]; i = 64; ` | 数组越界写入邻接内存 | 边界检查；` -Warray-bounds `；cppcheck |
| 随机的 HardFault | ` uint32_t v = *(uint32_t*)(buf+1); ` | 非对齐访问。 **M0/M0\+ 上必挂** ；M3/M4 上 ` LDR/STR ` 的字和半字 **硬件就支持非对齐** ，默认静默正确 —— 只有 ` LDM/STM `、` LDRD/STRD `，或打开了 ` CCR.UNALIGN_TRP ` 时才报 UNALIGNED | 用 ` memcpy(&v, buf+1, 4) ` —— 无论哪个核都安全 |
| 结构体大小和预期不符 | ` struct { uint8_t a; uint32_t b; }; ` 期望 5 字节 | 对齐填充，实际是 8 字节 | ` __attribute__((packed)) `；或调整成员顺序 |
| 协议解析数据错位 | ` packed ` 结构体成员取地址 | 取成员地址会得到非对齐指针，解引用触发 fault | 先 ` memcpy ` 到对齐的局部变量 |
| 浮点计算精度奇怪 | ` if (f == 3.14f) ` | 浮点不能用 ` == ` 比较 | ` fabsf(f - 3.14f) < 1e-5f ` |
| MCU 上跑得极慢 | ` printf("%f", x) ` | 软浮点格式化 \+ 阻塞串口输出 | 避免 ` %f `；用整数定点；用 ITM/[DMA](term:dma) |
| 栈莫名溢出 | ` void f(void){ uint8_t buf[1024]; } ` | 大局部数组吃光小栈（默认常 1KB） | 改 ` static `；或加大栈；用内存池 |
| 中断里改的变量丢失更新 | ` reg \|= (1<<n); ` 在 ISR 里 | 读-改-写竞态，主循环的写被覆盖 | 用 BSRR 原子寄存器；或临界区 |
| 函数指针调用即崩溃 | ` ((void(*)(void))0x08001000)(); ` | Thumb 芯片要求函数地址 LSB=1 | ` 0x08001001 `；正常情况编译器自动处理 |
| ISR 里卡死 / 系统挂起 | ISR 里调 ` malloc ` / ` printf ` / 等信号量 | 这些函数不可重入或阻塞 | ISR 只做"存数据 \+ 置标志"，处理放主循环 |
| 位域值不对 | ` struct { uint8_t a:4, b:4; } ` 依赖位序 | 位域布局由编译器 / ABI 决定，标准不规定。小端 ARM 与小端 x86（GCC）其实都是 **从 LSB 开始** 分配，但换个编译器、换个端序就可能变 —— 不可移植的根源是"没有约定"，不是"顺序相反" | 用显式掩码宏 ` FIELD_GET/SET ` |
| ` 1<<31 ` 得到负数 | ` uint32_t m = 1 << 31; ` | ` 1 ` 是 ` int `，左移 31 位是有符号溢出 UB | ` 1UL << 31 `；用 ` BIT(n) ` 宏 |
| 宏展开结果诡异 | ` #define SQ(x) x*x ` → ` SQ(1+2) `=5 | 缺少括号 | ` #define SQ(x) ((x)*(x)) `；用 ` static inline ` 更好 |
| 多文件重复定义 | 头文件里写 ` int g_var; ` | 每个 include 都产生一个定义 | 头文件用 ` extern int g_var; `，定义放 .c |
| 静态库里的函数没被链接 | ` gcc main.o -la -lb `，a 依赖 b | 静态库按需提取，顺序错了就找不到符号 | 依赖方在前：` -la -lb `；或 ` --start-group ` |
| 中断压根不进（或进了就飞） | ISR 函数名写成了 ` void tim2_isr(void) `，向量表里登记的是 ` TIM2_IRQHandler `；或开了 ` --gc-sections ` 后 ISR 被裁掉 | Cortex-M 的异常入口与返回 **全由硬件完成** ，ISR 就是普通 C 函数，不需要任何属性。` __attribute__((interrupt)) ` 是给经典 ARM 的 IRQ/FIQ 用的，STM32 裸机 / [FreeRTOS](term:rtos) 工程普遍不写它。真正出问题的永远是 **名字对不上** ，或函数在链接时被当成"没人引用"删掉了 | 函数名与向量表逐字一致（查 ` startup_*.s `）；给 ISR 加 ` __attribute__((used)) `，并在链接脚本里 ` KEEP(*(.isr_vector)) ` / ` KEEP(*(.vectors)) ` |
| 看门狗一直复位 | 主循环里无脑喂狗 | 某个任务卡死了但狗还在被喂 | 多任务位图式喂狗（见 8.5） |
| 固件比预期大很多 | 用了 ` printf ` / ` %f ` / 未裁剪的 HAL | 标准库格式化代码体积大 | ` --specs=nano.specs `；` --gc-sections `；自己写轻量输出 |
| 日志里出现乱码 / 崩溃 | ` sprintf(buf, "%s", s); ` 且 ` s ` 比 ` buf ` 长 | ` strcpy ` / ` sprintf `  **不做边界检查** ；` strncpy(dst, src, n) ` 在 ` src ` 长度 ≥ ` n ` 时 **不补结尾 ` \0 `** ，后面 ` strlen `/` %s ` 会一路读到越界 | ` snprintf(buf, sizeof buf, …) `；` strncpy ` 后手动补 ` buf[n-1] = '\0' `；或直接用带长度的 memcpy \+ 显式终止 |
| 函数里算数组长度总是错的 | ` int f(int a[10]){ sizeof a; } ` 得到 4 而不是 40 | 数组形参在 C 里 **退化成指针** ，` sizeof ` 量的是指针宽度。这是 C 语言层的规则，与编译器无关 | 长度单独传参 ` f(int *a, size_t n) `；宏里想拦退化可用 ` _Static_assert ` \+ ` __builtin_types_compatible_p `（见 §3.1 的 ` MUST_BE_ARRAY `） |
| 返回的指针指向垃圾数据 | ` char *f(void){ char buf[8]; return buf; } ` | 返回了栈上的局部地址，函数返回后这块栈即失效，调用方拿到的是悬垂指针。` -Wreturn-local-addr ` 会报，但很多工程没开 | 改成 ` static char buf[8] `（注意不可重入）、由调用方传入缓冲，或返回堆内存（嵌入式慎用） |
| -O2 下 64 位计数器偶尔丢更新 | ISR 与主循环共享 ` uint64_t ` 计数，各自 ` cnt++ ` | 32 位 MCU 上读写 64 位量要拆成两条 32 位访存， **不是原子操作** ；中断落在中间就撕裂 | 用 ` _Atomic uint64_t `（C11）；或用"高/低位分两次读 \+ 校验重读"的序列；最省事的是把共享量改成 32 位 |
| M7 上 DMA 收到的是旧数据 | CPU 写 DMA 源缓冲后立刻启动传输 | 带 D-Cache 的核（M7）上，CPU 的写可能还在 cache 里没落到内存，DMA 不经过 cache 就读到了旧值 | 启动 DMA 前对缓冲做 clean（` SCB_CleanDCache_by_Addr `），读回前 invalidate；最稳的是把 DMA 缓冲放在 **不经过 cache**  的 MPU 区域（或 CCM/DTCM SRAM） |
| 中断优先级设了却不生效 | 把抢占优先级直接写进 ` IPR `，忘了先配分组 | Cortex-M 的中断优先级分"抢占位 \+ 子优先级位"， **各占几位由 ` AIRCR.PRIGROUP ` 决定** 。分组没设或设错，写进去的数值含义就整个变了 | 全工程统一一次 ` NVIC_SetPriorityGrouping() `（HAL 默认可配为 ` NVIC_PRIORITYGROUP_4 `，即 4 位全抢占），再用 ` NVIC_SetPriority() ` 而不是裸写寄存器 |
| 电池设备续航远低于预期 | 主循环是 ` while(1){ poll(); } ` 空转 | 没有 ` WFI `，CPU 一直全速跑，电流停在 mA 级下不来；省电靠的是"没事干就睡" | 每个空闲轮次执行 ` __WFI() `（等中断再醒）；更彻底的是进 SLEEP/STOP 模式 |
| 程序崩了但日志是空的 | 用 ` printf ` 打日志，崩溃前一段日志丢失 | stdout 默认 **全缓冲** ，缓冲没满或没 flush，崩溃时缓冲随 RAM 一起没了 | 初始化时 ` setvbuf(stdout, NULL, _IONBF, 0) ` 关缓冲；关键日志用 ` fflush ` 或直写 ` write() `；实时性要求高就走 ITM/RTT |
| 指针本身被优化掉 / 指向的内容没更新 | ` volatile uint32_t *p ` 与 ` uint32_t * volatile p ` 混用 | ` const ` / ` volatile ` 修饰的是"指针"还是"指针指向的对象"，取决于它在 ` * ` 的哪一侧：` volatile T *p ` = 内容每次真读；` T * volatile p ` = 指针变量本身每次真读；` volatile T * volatile p ` = 两者都是 | 访问硬件寄存器几乎总是要 ` volatile T * `（内容可变）；把 ` volatile ` 加在指针变量上（` T * volatile `）通常 **不是你想要的** |

 

```zhizhan-anchor
ap-2
```



## A.2 GCC 编译选项速查

 

```zhizhan-anchor
ap-2-1
```



### A.2.1 必需选项（每个嵌入式项目都该有）

 

推荐的基础选项组合 Makefile

 

```text
# ---- 编译选项 ----
CFLAGS := -mcpu=cortex-m3 -mthumb
CFLAGS += -std=c11
CFLAGS += -Og -g3 -gdwarf-4

# ---- 警告：全开 ----
CFLAGS += -Wall -Wextra
CFLAGS += -Wshadow                  # 变量遮蔽
CFLAGS += -Wconversion -Wsign-conversion   # 隐式截断 ← 最重要
CFLAGS += -Wcast-align              # 指针转换导致对齐问题
CFLAGS += -Wpointer-arith
CFLAGS += -Wstrict-prototypes -Wmissing-prototypes -Wmissing-declarations
CFLAGS += -Wundef                   # #if 使用了未定义的宏
CFLAGS += -Wdouble-promotion        # float 被隐式提升为 double
CFLAGS += -Wformat=2 -Wformat-security
CFLAGS += -Wswitch-enum -Wswitch-default
CFLAGS += -Wnull-dereference
CFLAGS += -Wduplicated-cond -Wlogical-op
CFLAGS += -Wjump-misses-init -Wnested-externs -Wbad-function-cast
CFLAGS += -Wredundant-decls -Wwrite-strings

# ---- 代码生成 ----
CFLAGS += -fno-common               # 多次定义报错而不是合并（GCC 10+ 默认）
CFLAGS += -ffunction-sections -fdata-sections   # 配合 --gc-sections 裁剪
CFLAGS += -fno-strict-aliasing      # 嵌入式建议关掉，避免类型双关被优化掉
CFLAGS += -fstack-usage             # 生成 .su 文件，看每个函数的栈用量 ★

# ---- 可选：更激进的检查（仅调试期）----
# CFLAGS += -fanalyzer              # GCC 10+ 路径敏感分析（慢）
# CFLAGS += -fsanitize=undefined    # 仅 PC 端测试用，MCU 上不可用

# ---- 链接选项 ----
LDFLAGS := -mcpu=cortex-m3 -mthumb
LDFLAGS += -T$(LDSCRIPT)
LDFLAGS += -Wl,-Map=$(BUILD)/$(TARGET).map
LDFLAGS += -Wl,--gc-sections
LDFLAGS += -Wl,--print-memory-usage       # 打印 Flash/RAM 占用
LDFLAGS += -Wl,--cref                     # 交叉引用表
LDFLAGS += -nostartfiles
LDFLAGS += --specs=nano.specs             # 精简版 newlib（省 ~20KB）
LDFLAGS += --specs=nosys.specs            # 不需要系统调用桩
```

 

上面这一套是"任何 Cortex-M 项目都该有"的。下面这些是 **按芯片或场景追加** 的 —— 真正把它们抄漏，症状往往不是编译错误，而是"浮点突然慢了十倍""换了颗 M7 行为全变了"这类排查半天的问题。

 

| 选项 | 什么时候加 | 漏掉的后果 |
| --- | --- | --- |
| ` -mfpu=fpv4-sp-d16 -mfloat-abi=hard ` | F4 / F7 / H7 等带单精度 FPU 的核 | 不写就 **用软件浮点模拟** ：浮点运算慢一个数量级，还会把 ` __aeabi_fadd ` 这类库函数拉进镜像。这两项必须 **成对出现** |
| ` -mfloat-abi=softfp ` | 有 FPU，但要和按软浮点编译的库/预编译对象保持 ABI 兼容时 | 用 ` hard ` 与 ` softfp ` 拼在一起会得到链接期 "uses VFP register arguments, … does not" 之类的 ABI 不匹配报错 |
| ` -mfix-cortex-m3-ldrd ` | STM32F1 等  **Cortex-M3 r1p1**  芯片，且代码里可能出现背靠背的 ` LDRD/STRD ` 非对齐访问 | 踩到勘误时是"极其偶发、看波形也抓不住"的读数错误 —— 这类硅bug必须靠编译器规避，不能赌 |
| ` -Werror ` | CI / 提交门禁 | 不放 CI 里，警告就会越积越多、最后被全体无视。⚠  **本地开发别开** ：一个无害警告就编不过，反而逼人去关警告 |
| ` -ffreestanding ` | 裸机 \+ ` -nostdlib `，没有托管环境时 | 编译器会假设有完整的标准 C 环境，可能生成对 ` memcpy/memset ` 的隐式调用 —— 而你根本没链 ` -lc ` |
| ` -fno-builtin ` | 自己实现了 ` memcpy ` / ` printf ` 等并以同名提供时 | 编译器把你的定义替换成内建展开，你以为在调自己的实现，其实没有 |
| ` -fno-delete-null-pointer-checks ` | 故意用"解引用 NULL"来制造一次可控的 HardFault（§8.x 的演练） | 编译器把"NULL 已解引用 ⇒ 后面不可能再判空"当成立即生效的事实， **直接删掉你的空指针检查** ，演练失效 |
| ` -mno-unaligned-access ` | 在 M3/M4 上想复现 M0/M0\+ 的"非对齐必挂"行为时 | 不如实复现：M3/M4 默认让非对齐的字访问静默正确，你会以为代码"在 M0 上也没事" |

 

```zhizhan-anchor
ap-2-2
```



### A.2.2 优化等级对照

 

| 选项 | 含义 | 体积 | 适用场景 |
| --- | --- | --- | --- |
| ` -O0 ` | 不优化 | 最大 | 调试逐行单步时。⚠ 会放大代码体积，可能因此跑不进 Flash |
| ` -Og ` | 面向调试的优化 | 较小 | **推荐的调试配置** 。可单步追踪，性能比 -O0 好 |
| ` -O1 ` | 基础优化 | 小 | 体积和速度的平衡点 |
| ` -O2 ` | 较激进优化 | 中 | 速度优先 |
| ` -O3 ` | 最激进 | 可能变大 | 大量循环计算（DSP）。 **可能因循环展开而增大体积** |
| ` -Os ` | 优化体积 | 最小 | **量产首选** 。绝大多数嵌入式项目的正确选择 |
| ` -Ofast ` | -O3 \+ 违反标准 | 中 | ⚠  **会破坏浮点语义** ，嵌入式慎用 |
| ` -flto ` | 链接期优化 | 更小 | 跨文件内联和死代码消除。编译慢，但效果好 |

 

⚠ ` -O0 ` 不是"安全选项"

 

很多工程师认为 ` -O0 ` 最安全，这是个误解：   
  
  **① ` -O0 ` 会让代码变大** ——每个变量都占栈空间，每个表达式都生成指令。 一个在 ` -Os ` 下占 60 KB 的项目，` -O0 ` 下可能变成 90 KB， *直接跑不进 64 KB 的 Flash* 。   
  
  **② ` -O0 ` 会掩盖 bug** ——未 ` volatile ` 的变量在 ` -O0 ` 下每次都真的从内存读， 所以看起来正常；换到 ` -Os ` 就出问题了。   
  
  **③ 结论** ：用 ` -Og ` 调试，用 ` -Os ` 量产，  *并且一定要在 -Os 下也完整测一遍* 。

 

```zhizhan-anchor
ap-2-3
```



### A.2.3 常用的体积削减手段

 

```zhizhan-table
{"rows":[[{"body":"手段","header":true,"rowSpan":1,"colSpan":1},{"body":"典型收益","header":true,"rowSpan":1,"colSpan":1},{"body":"说明","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` --specs=nano.specs `","header":false,"rowSpan":1,"colSpan":1},{"body":"10–25 KB","header":false,"rowSpan":1,"colSpan":1},{"body":"换用 newlib-nano，去掉大量不用的格式化支持","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -ffunction-sections -fdata-sections `  \n\\+ ` -Wl,--gc-sections `","header":false,"rowSpan":1,"colSpan":1},{"body":"5–30%","header":false,"rowSpan":1,"colSpan":1},{"body":"每个函数/变量独立成段，链接时丢弃未引用的。⚠ 中断处理函数和放在段里的表要用 ` KEEP() ` 或 ` used ` 属性保住","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Os `","header":false,"rowSpan":1,"colSpan":1},{"body":"10–20%","header":false,"rowSpan":1,"colSpan":1},{"body":"相比 ` -O2 `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -flto `","header":false,"rowSpan":1,"colSpan":1},{"body":"5–15%","header":false,"rowSpan":1,"colSpan":1},{"body":"跨编译单元内联和死代码消除","header":false,"rowSpan":1,"colSpan":1}],[{"body":"去掉 ` printf ` / ` %f `","header":false,"rowSpan":1,"colSpan":1},{"body":"5–15 KB","header":false,"rowSpan":1,"colSpan":1},{"body":"格式化字符串引擎是体积大户。用自写的轻量输出","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wl,--gc-sections ` \\+ ` KEEP() ` 中断向量表","header":false,"rowSpan":1,"colSpan":1},{"body":"必须保留","header":false,"rowSpan":1,"colSpan":1},{"body":"向量表没被引用，不加 KEEP 会被删掉 → 所有中断失效","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

```zhizhan-anchor
ap-3
```



## A.3 C 关键字速查（嵌入式视角）

 

```zhizhan-table
{"rows":[[{"body":"关键字","header":true,"rowSpan":1,"colSpan":1},{"body":"嵌入式语境下的真实含义","header":true,"rowSpan":1,"colSpan":1},{"body":"典型误用","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` volatile `","header":false,"rowSpan":1,"colSpan":1},{"body":"\"每次访问都真的去内存读写\"。用于：硬件寄存器、ISR 与主循环共享的变量、` delay ` 循环计数","header":false,"rowSpan":1,"colSpan":1},{"body":"⚠  **不能保证原子性** ；` volatile ` 不是线程安全；对结构体整体加 ` volatile ` 未必有效","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` static `","header":false,"rowSpan":1,"colSpan":1},{"body":"三种身份：① 函数内 = 静态存储期（函数返回后值保留）② 文件级函数/变量 = 内部链接（其他 .c 看不见）③ 头文件/函数内 = 只初始化一次","header":false,"rowSpan":1,"colSpan":1},{"body":"在头文件里定义带 ` static ` 的变量 → 每个 .c 都有一份独立副本（浪费 RAM）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` const `","header":false,"rowSpan":1,"colSpan":1},{"body":"放在 ` .rodata `，占 Flash 不占 RAM。指针的 ` const ` 位置决定\"谁不可变\"","header":false,"rowSpan":1,"colSpan":1},{"body":"` const char *p `（内容不可变）vs ` char * const p `（指针不可变）搞混","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` extern `","header":false,"rowSpan":1,"colSpan":1},{"body":"\"这个符号在别的地方定义，链接时去找\"。用于跨文件共享全局变量/函数","header":false,"rowSpan":1,"colSpan":1},{"body":"在 .c 里写 ` extern ` 声明而不放头文件 → 类型不一致时无编译错误，链接后行为错乱","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` inline `","header":false,"rowSpan":1,"colSpan":1},{"body":"建议编译器内联（不强制）。` static inline ` 放头文件是标准做法","header":false,"rowSpan":1,"colSpan":1},{"body":"以为 ` inline ` 一定内联；对递归函数用 ` inline `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` register `","header":false,"rowSpan":1,"colSpan":1},{"body":"**已废弃** （C\\+\\+17 移除，C 中也不建议用）。编译器的寄存器分配比人好","header":false,"rowSpan":1,"colSpan":1},{"body":"所有老代码里的 ` register int i; ` 都可以删掉","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` restrict `","header":false,"rowSpan":1,"colSpan":1},{"body":"承诺\"这个指针是访问该内存的唯一途径\"，允许编译器生成更好的代码。用于 DSP / ` memcpy ` 类函数","header":false,"rowSpan":1,"colSpan":1},{"body":"撒谎会导致诡异错误（两个指针实际指向同一块内存时）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _Atomic `（C11）","header":false,"rowSpan":1,"colSpan":1},{"body":"真正的原子类型，比 ` volatile ` 正确。适合 ISR 与主循环共享的计数器","header":false,"rowSpan":1,"colSpan":1},{"body":"MCU 上未必有无锁实现，可能退化为加锁；记得链接 ` -latomic `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _Static_assert `（C11）  \n别名 ` static_assert `","header":false,"rowSpan":1,"colSpan":1},{"body":"编译期断言，零运行时开销。检查结构体大小、缓冲区尺寸、配置合法性。  \n关键字形式 **不需要头文件** ；` static_assert ` 需 ` <assert.h> `","header":false,"rowSpan":1,"colSpan":1},{"body":"忘了用它 → 结构体布局变了也没人发现","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _Noreturn `（C11）","header":false,"rowSpan":1,"colSpan":1},{"body":"函数不会返回（如 ` panic() `、` osReboot() `）。帮助编译器优化并消除警告","header":false,"rowSpan":1,"colSpan":1},{"body":"声明了却真的返回了 → 未定义行为","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

```zhizhan-anchor
ap-3-1
```



### A.3.1 GCC 属性（` __attribute__ `）高频清单

 

| 属性 | 用途与嵌入式场景 |
| --- | --- |
| ` packed ` | 取消结构体填充，用于解析通信协议。⚠ 成员取地址会得到非对齐指针 |
| ` aligned(n) ` | 强制对齐，用于 DMA 缓冲区（通常要 4 或 32 字节对齐）、位带变量 |
| ` section("name") ` | 放到指定段。用于把函数放 RAM 里执行、把表放特定 Flash 区 |
| ` used ` | "即使看起来没被引用也不要删"。用于中断向量表项、通过地址调用的表 |
| ` interrupt ` | ⚠  **Cortex-M 上不需要，也别加。** 它是给经典 ARM7/ARM9 的 IRQ/FIQ 模式用的 —— 那些核进入异常时要手动切换模式、手动保存寄存器，编译器得替你做。 **Cortex-M 的入栈、取向量、返回全由硬件完成** ，ISR 就是普通 C 函数，写 ` void TIM2_IRQHandler(void){...} ` 直接就能返回。中断不执行的真正原因是 **函数名和向量表对不上** （见 A.1），不是缺这个属性 |
| ` naked ` | 不生成序言/尾声，完全自己写汇编。用于 HardFault 处理器、上下文切换 |
| ` weak ` | 弱符号，可被同名强符号覆盖。启动文件里所有中断处理函数都是 ` weak ` |
| ` noreturn ` | 同 ` _Noreturn `，C99 兼容写法 |
| ` always_inline ` | 强制内联。用于极短的热路径函数、IO 操作封装 |
| ` optimize("O3") ` | 对单个函数覆盖全局优化等级。用于 DSP 内核函数 |
| ` unused ` | 抑制"未使用"警告。⚠ 别滥用，它会掩盖真实的死代码 |
| ` constructor ` | 在 ` main ` 之前自动执行（` __libc_init_array ` 会调用它） |

 

```zhizhan-anchor
ap-4
```



## A.4 STM32 常用寄存器速查

 

| 寄存器 | 地址（STM32F1） | 关键位说明 |
| --- | --- | --- |
| ` RCC_CR ` | ` 0x40021000 ` | bit0 HSION, bit16 HSEON, bit24 PLLON, bit25 PLLRDY |
| ` RCC_CFGR ` | ` 0x40021004 ` | bit\[1:0\] SW 时钟源选择, bit\[3:2\] SWS 实际时钟源, bit\[7:4\] HPRE AHB 分频, bit\[10:8\] PPRE1, bit\[13:11\] PPRE2, bit\[21:18\] PLLMUL |
| ` RCC_APB2ENR ` | ` 0x40021018 ` | bit0 AFIOEN, bit2 GPIOAEN, bit3 GPIOBEN, bit4 GPIOCEN, bit14 USART1EN |
| ` RCC_APB1ENR ` | ` 0x4002101C ` | bit0 TIM2EN, bit1 TIM3EN, bit17 USART2EN, bit21 I2C1EN, bit28 PWREN, bit29 BKPEN |
| ` RCC_CSR ` | ` 0x40021024 ` | 复位原因标志：bit26 PINRSTF, bit27 PORRSTF, bit28 SFTRSTF, bit29 IWDGRSTF, bit30 WWDGRSTF, bit31 LPWRRSTF |
| ` GPIOx_CRL ` | 基址 \+ ` 0x00 ` | 引脚 0–7 配置，每引脚 4 位： **低 2 位 MODE** （00 输入 / 01 输出 10MHz / 10 输出 2MHz / 11 输出 50MHz）、 **高 2 位 CNF** （输出模式：00 推挽 / 01 开漏 / 10 复用推挽 / 11 复用开漏；输入模式含义不同：00 模拟 / 01 浮空 / 10 上下拉 / 11 保留） |
| ` GPIOx_CRH ` | 基址 \+ ` 0x04 ` | 引脚 8–15 配置，同样是【低 2 位 MODE、高 2 位 CNF】。位偏移 = (pin − 8) × 4 |
| ` GPIOx_IDR ` | 基址 \+ ` 0x08 ` | 输入数据寄存器，只读，反映引脚实际电平 |
| ` GPIOx_ODR ` | 基址 \+ ` 0x0C ` | 输出数据寄存器，可读可写。 **读写是"读-改-写"，非原子** |
| ` GPIOx_BSRR ` | 基址 \+ ` 0x10 ` | **原子置位/复位** ：低 16 位写 1 置位对应引脚，高 16 位写 1 复位。只写，读回为 0 |
| ` GPIOx_BRR ` | 基址 \+ ` 0x14 ` | 原子复位，低 16 位有效 |
| ` GPIOx_LCKR ` | 基址 \+ ` 0x18 ` | 引脚配置锁定（防止误改配置） |
| ` AFIO_EVCR / MAPR / EXTICR ` | ` 0x40010000/04/08 ` | 复用功能重映射、外部中断线到端口的映射（` EXTICR[4] `） |
| ` NVIC_ISER0 ` | ` 0xE000E100 ` | 中断使能（写 1 使能）。` ISER1 ` 在 ` 0xE000E104 ` |
| ` NVIC_ICER0 ` | ` 0xE000E180 ` | 中断禁用（写 1 禁用） |
| ` NVIC_ISPR0 / ICPR0 ` | ` 0xE000E200 / 0xE000E280 ` | 置位/清除挂起标志 |
| ` NVIC_IPR[n] ` | ` 0xE000E400 `\+ | 中断优先级（每字节一个中断，只用高 4 位） |
| ` SCB_AIRCR ` | ` 0xE000ED0C ` | 优先级分组、系统复位（写 ` 0x05FA0004 ` 复位） |
| ` SCB_VTOR ` | ` 0xE000ED08 ` | 向量表偏移。用于 Bootloader 跳转到 App |
| ` SCB_CFSR ` | ` 0xE000ED28 ` | 可配置故障状态：MMFSR / BFSR / UFSR（见 8.3） |
| ` SysTick_CTRL/LOAD/VAL ` | ` 0xE000E010/14/18 ` | 系统滴答定时器。CTRL bit0 ENABLE, bit1 TICKINT, bit2 CLKSOURCE |
| ` DWT_CYCCNT ` | ` 0xE0001004 ` | 周期计数器（性能测量，见 8.6） |
| ` ITM_STIM0 ` | ` 0xE0000000 ` | ITM 通道 0，写字节即输出到 SWO |

 

```zhizhan-anchor
ap-4-1
```



### A.4.1 各外设基址（STM32F1 系列）

 

| 外设 | 基址 | 总线 | 备注 |
| --- | --- | --- | --- |
| FLASH / OB | ` 0x40022000 ` | AHB | Flash 编程与等待周期配置 |
| GPIOA–E | ` 0x40010800 `, ` 0x40010C00 `, ` 0x40011000 `, ` 0x40011400 `, ` 0x40011800 ` | APB2 | 每端口间隔 ` 0x400 ` |
| AFIO | ` 0x40010000 ` | APB2 | 重映射需先使能 AFIO 时钟 |
| EXTI | ` 0x40010400 ` | APB2 | IMR 屏蔽, PR 挂起, RTSR/FTSR 边沿 |
| USART1 | ` 0x40013800 ` | APB2 | SR bit5 RXNE, bit7 TXE；DR 数据寄存器 |
| USART2/3 | ` 0x40004400 / 0x40004800 ` | APB1 | — |
| TIM2–TIM5 | ` 0x40000000 ` \+ n×` 0x400 ` | APB1 | 通用定时器 |
| TIM1 / TIM8 | ` 0x40012C00 / 0x40013400 ` | APB2 | 高级定时器（带死区） |
| SPI1 | ` 0x40013000 ` | APB2 | SPI2 在 ` 0x40003800 `（APB1） |
| I2C1/2 | ` 0x40005400 / 0x40005800 ` | APB1 | — |
| ADC1/2 | ` 0x40012400 / 0x40012800 ` | APB2 | 规则组 DR 在偏移 ` 0x4C ` |
| DMA1/2 | ` 0x40020000 / 0x40020400 ` | AHB | 通道间隔 ` 0x14 ` |
| RCC | ` 0x40021000 ` | AHB | — |
| IWDG / WWDG | ` 0x40003000 / 0x40002C00 ` | APB1 | 独立/窗口看门狗 |
| PWR | ` 0x40007000 ` | APB1 | ` CR ` bit8 ` DBP `：解除备份域写保护（ **每次复位后都会被清掉，用 BKP/RTC 前必须重设** ） |
| BKP | ` 0x40006C00 ` | APB1 | 备份寄存器 ` DR1…DR10 ` 各 16 位，偏移 ` 0x04 + (n−1)×4 `，所以 ` DR1 ` 在 ` 0x40006C04 `。 **F1 的 BKP 与 RTC 是两个独立外设，基址不同** ；F4/F7/H7 才把备份寄存器并进 ` RTC->BKPxR `（32 位） |
| RTC | ` 0x40002800 ` | APB1 | F1 上是独立的 32 位秒计数器（` CRL/CRH/PRLL/PRLH/CNT `），不是日历型 |
| SysTick | ` 0xE000E010 ` | 内核 | — |
| NVIC | ` 0xE000E100 ` | 内核 | — |
| SCB | ` 0xE000ED00 ` | 内核 | — |

 

```zhizhan-anchor
ap-4-2
```



### A.4.2 跨系列对照：同一件事，三代芯片三个地址

 

上面整张表是  **STM32F1**  的。换到 F4 / H7， **外设名字几乎不变、地址却全变**  —— 而且变化不是"整体平移一个常数"能描述的：总线换了（APB2 → AHB1 → AHB4）、 时钟使能寄存器换了名字、GPIO 内部布局也从"每引脚 4 位 nibble"变成"每引脚 2 位"。 照抄 F1 的地址到 F4 上，症状是 **写寄存器没有任何反应，也不报错** 。

 

```zhizhan-table
{"rows":[[{"body":"要做的同一件事","header":true,"rowSpan":1,"colSpan":1},{"body":"STM32F1","header":true,"rowSpan":1,"colSpan":1},{"body":"STM32F4","header":true,"rowSpan":1,"colSpan":1},{"body":"STM32H7","header":true,"rowSpan":1,"colSpan":1}],[{"body":"使能 GPIOA 时钟","header":false,"rowSpan":1,"colSpan":1},{"body":"` RCC_APB2ENR ` bit2  \n` 0x40021018 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` RCC_AHB1ENR ` bit0  \n` 0x40023830 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` RCC_AHB4ENR ` bit0  \n` 0x580244E0 `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"GPIOA 端口基址","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x40010800 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x40020000 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x58020000 `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"引脚方向/模式寄存器","header":false,"rowSpan":1,"colSpan":1},{"body":"` CRL / CRH `，每引脚  **4 位** （低 2 MODE、高 2 CNF）","header":false,"rowSpan":1,"colSpan":1},{"body":"` MODER `，每引脚  **2 位**","header":false,"rowSpan":1,"colSpan":1},{"body":"` MODER `，每引脚  **2 位**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"USART1 基址","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x40013800 `（APB2）","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x40011000 `（APB2）","header":false,"rowSpan":1,"colSpan":1},{"body":"` 0x58000000 `（APB2）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"USART 波特率寄存器","header":false,"rowSpan":1,"colSpan":1},{"body":"` BRR `（偏移 ` 0x08 `）","header":false,"rowSpan":1,"colSpan":1},{"body":"` BRR `（偏移 ` 0x08 `）","header":false,"rowSpan":1,"colSpan":1},{"body":"` BRR `（偏移 ` 0x0C `）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"调试单元 CR（含 trace I/O 使能）","header":false,"rowSpan":1,"colSpan":1},{"body":"` DBGMCU_CR 0xE0042004 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` DBGMCU_CR 0xE0042004 `","header":false,"rowSpan":1,"colSpan":1},{"body":"` DBGMCU_CR 0x5C001004 `","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

**怎么自己换算，不用背** （这才是能带走的技能）：

 

 
1. **外设基址** ：翻该型号的《参考手册》→  *Memory map*  一节，每个外设都单列一行基址； 或直接翻该外设章节开头的  *register map* ，那里通常写着 "` 0x4001 3800 - 0x4001 3BFF `" 这样的范围。
 
2. **寄存器偏移** ：外设章节的 register map 表里，每个寄存器后面都标了 offset；基址 \+ offset 就是绝对地址。
 
3. **位号** ：别记十六进制，记  **bit 名** （如 ` GPIO_CRL_MODE0_Pos `）。CMSIS 头文件里每个位都有 ` _Pos ` / ` _Msk `， 这就是"位号跨系列会不会变"的权威答案： **直接看头文件，不要猜** 。
 
4. **最快的核对** ：在工程里 ` #include "stm32xxxx.h" `，写一行 ` _Static_assert(GPIOA_BASE == 0x40020000UL, "F4 GPIOA 基址"); ` —— 芯片选错、头文件选错，编译期当场报。
 

 

```zhizhan-anchor
ap-5
```



## A.5 链接脚本常用符号与命令

 

```zhizhan-table
{"rows":[[{"body":"符号 / 命令","header":true,"rowSpan":1,"colSpan":1},{"body":"含义","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` ENTRY(Reset_Handler) `","header":false,"rowSpan":1,"colSpan":1},{"body":"设置 ELF 入口点（写入 ` e_entry `，但 MCU 实际从向量表取 PC）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` MEMORY { } `","header":false,"rowSpan":1,"colSpan":1},{"body":"定义存储器区域：` FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 64K `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _sstack `","header":false,"rowSpan":1,"colSpan":1},{"body":"栈 **底** （最低地址，栈\"长到底\"的警戒线）。用来算栈用量和放栈哨兵","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _estack `","header":false,"rowSpan":1,"colSpan":1},{"body":"栈 **顶** （最高地址，栈从这里向下生长）。必须是向量表的第一个字（偏移 ` 0x00 `）；第二个字（0x04）是 Reset\\_Handler 入口—— 复位时硬件直接把 ` _estack ` 装进 SP。  \n⚠  **全站就统一用这一对名字** （` _sstack ` / ` _estack `，在模块 04 的链接脚本里定义）。看到别处的 ` __stack `、` _stack_top `、` estack ` 之类，都是同一个东西的别名 —— 抄代码时先统一，否则会出现\"启动文件引用 ` _estack `、链接脚本只定义了 ` _stack_top `\"这种链接期找不到符号的低级事故","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` .isr_vector `","header":false,"rowSpan":1,"colSpan":1},{"body":"中断向量表，必须放在 ` 0x08000000 `（或 VTOR 指向处），必须用 ` KEEP() `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` *(.text*) `","header":false,"rowSpan":1,"colSpan":1},{"body":"所有代码段","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` *(.rodata*) `","header":false,"rowSpan":1,"colSpan":1},{"body":"只读数据（` const ` 变量、字符串字面量）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _sidata `","header":false,"rowSpan":1,"colSpan":1},{"body":"` LOADADDR(.data) `，` .data ` 初值在 Flash 中的起始地址","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _sdata / _edata `","header":false,"rowSpan":1,"colSpan":1},{"body":"` .data ` 在 RAM 中的起止地址","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _sbss / _ebss `","header":false,"rowSpan":1,"colSpan":1},{"body":"` .bss ` 起止地址（启动代码要清零这一段）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _end `","header":false,"rowSpan":1,"colSpan":1},{"body":"所有静态数据结束的位置 —— 习惯上把堆的起点放在这里（` _end ` 也叫 ` end `，newlib 的 ` _sbrk ` 默认会引用它）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` __HeapBase / __HeapLimit `","header":false,"rowSpan":1,"colSpan":1},{"body":"自定义的堆起止符号。上电时用它们初始化 ` malloc ` 的堆区（或给 FreeRTOS 的 ` heap_4 ` 用）。` __HeapLimit ` 通常取 ` _sstack `，这样堆和栈相向生长、把中间空间吃干净","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _Min_Heap_Size / _Min_Stack_Size `","header":false,"rowSpan":1,"colSpan":1},{"body":"**不是运行期的配额，而是链接期的栅栏。** CubeMX 生成的脚本里，它们只被用来在 RAM 末尾预留一段 ` ._user_heap_stack `，并在区尾用 ` PROVIDE ` 定义 ` end / _estack `。所以把 ` _Min_Heap_Size ` 调大， **并不能让 ` malloc ` 多分内存**  —— 它只是让那段预留变大、更早暴露 RAM 不够（§4.5.1 实测过：改大预留段，` end ` 地址纹丝不动）。真正决定堆能用多少的是 ` _sbrk() ` 里的上界检查","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` PROVIDE(__preinit_array_start = .) ` 等边界符号","header":false,"rowSpan":1,"colSpan":1},{"body":"C 运行时初始化（` __libc_init_array `）和堆栈碰撞检查都靠这些符号\"知道段落边界在哪\"。 **漏定义它们** 的典型症状是链接期 ` undefined reference to '__init_array_start' `，或运行期 ` malloc ` 算出越界地址","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` _sbrk() `","header":false,"rowSpan":1,"colSpan":1},{"body":"**不是链接脚本符号，而是你必须自己实现的函数** 。newlib 的 ` malloc ` / ` printf ` 靠它向系统要内存；不实现就会链接报错或跑起来返回 ` -1 `。裸机上写一个\"从 ` _end ` 往上挪指针、碰到 ` __HeapLimit ` 就返回 ` -1 `\"的版本即可","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` .init_array / .fini_array `","header":false,"rowSpan":1,"colSpan":1},{"body":"C\\+\\+ 全局对象构造 / 析构、以及 ` __attribute__((constructor)) ` 的函数指针表。启动代码里的 ` __libc_init_array() ` 会遍历它。 **裸机工程漏了这段，全局 C\\+\\+ 对象就不会被构造**  —— 症状是\"成员变量全是 0 / 虚表指针为空\"","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` .ARM.exidx / .ARM.extab `","header":false,"rowSpan":1,"colSpan":1},{"body":"C\\+\\+ 异常、` throw `、以及部分回溯信息所需的索引表。` --gc-sections ` 下容易被当成\"没人引用\"裁掉，链 C\\+\\+ 代码时要显式保留（或干脆 ` -fno-exceptions -fno-unwind-tables ` 关掉，嵌入式通常也这么做）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` >RAM AT> FLASH `","header":false,"rowSpan":1,"colSpan":1},{"body":"VMA 在 RAM，LMA 在 Flash。启动时需手动拷贝","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` (NOLOAD) `","header":false,"rowSpan":1,"colSpan":1},{"body":"该段不占用 Flash，也不生成初值（用于外部 SDRAM 缓冲区）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` KEEP(*(.isr_vector)) `","header":false,"rowSpan":1,"colSpan":1},{"body":"即使没被引用也保留（配合 ` --gc-sections ` 必须加）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` ALIGN(4) `","header":false,"rowSpan":1,"colSpan":1},{"body":"地址对齐到 4 字节","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` PROVIDE(sym = .) `","header":false,"rowSpan":1,"colSpan":1},{"body":"定义符号，但如果代码里已定义则不覆盖","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` ASSERT(cond, \"msg\") `","header":false,"rowSpan":1,"colSpan":1},{"body":"链接期断言。 **强烈推荐加 Flash/RAM 溢出检查**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` . = ALIGN(8); `","header":false,"rowSpan":1,"colSpan":1},{"body":"位置计数器前进到 8 字节对齐处","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` /DISCARD/ `","header":false,"rowSpan":1,"colSpan":1},{"body":"丢弃指定段（如调试用的 ` .comment `）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

```zhizhan-anchor
ap-6
```



## A.6 工具命令速查

 

| 命令 | 用途 |
| --- | --- |
| ` arm-none-eabi-size fw.elf ` | 看 text/data/bss。公式：Flash = text \+ data，RAM = data \+ bss |
| ` arm-none-eabi-size -A fw.elf ` | 按段列出大小，找出哪个段占空间 |
| ` arm-none-eabi-nm --size-sort --print-size fw.elf ` | 按大小排序列出所有符号，找出符号占用排行。它读的是 ELF 符号表里的 ` st_size `， **和 ` -g ` 无关**  —— 没加 ` -g ` 也照样能排。⚠ 但看不到符号名时，那多半是 ` strip ` 过了，不是缺 ` -g ` |
| ` arm-none-eabi-nm -u fw.o ` | 列出未定义符号（` U `），排查链接错误 |
| ` arm-none-eabi-objdump -d fw.elf ` | 反汇编 |
| ` arm-none-eabi-objdump -d -S fw.elf ` | 反汇编并交织源码（需要 ` -g `） |
| ` arm-none-eabi-objdump -h fw.elf ` | 段头表：VMA/LMA/大小/属性 |
| ` arm-none-eabi-objdump -s -j .data fw.elf ` | 导出某个段的原始内容 |
| ` arm-none-eabi-readelf -a fw.elf ` | 完整 ELF 信息 |
| ` arm-none-eabi-readelf -S fw.elf ` | 段表 |
| ` arm-none-eabi-readelf -s fw.elf ` | 符号表（比 nm 信息更全） |
| ` arm-none-eabi-addr2line -e fw.elf -f -C 0x08000abc ` | **地址 → 源码行** 。HardFault 定位必备。 **⚠ 依赖 ` -g `** （建议 ` -g3 -gdwarf-4 `），不带调试信息就只能打出一串 ` ?? `。想让地址能准确映射回行号，优化等级别太高（` -Og ` 最好用） |
| ` arm-none-eabi-objcopy -O binary fw.elf fw.bin ` | 转二进制（烧录用） |
| ` arm-none-eabi-objcopy -O ihex fw.elf fw.hex ` | 转 Intel HEX（ST-Link Utility 用） |
| ` arm-none-eabi-objcopy -O binary --only-section=.text fw.elf t.bin ` | 只导出某个段 |
| ` arm-none-eabi-ar rcs libfoo.a a.o b.o ` | 创建静态库 |
| ` arm-none-eabi-ar t libfoo.a ` | 列出静态库成员 |
| ` arm-none-eabi-gcc -E x.c -o x.i ` | 只预处理，看宏展开结果 |
| ` arm-none-eabi-gcc -S x.c -o x.s ` | 生成汇编 |
| ` arm-none-eabi-gcc -dM -E - < /dev/null ` | 导出编译器所有预定义宏 |
| ` arm-none-eabi-gcc -fstack-usage ... ` | 生成 ` .su ` 文件，每函数栈用量 —— 排查栈溢出的利器 |
| ` openocd -f interface/stlink.cfg -f target/stm32f1x.cfg ` | 启动调试服务器 |
| ` st-flash write fw.bin 0x08000000 ` | 命令行烧录（stlink-tools） |
| ` idf.py -p COM3 flash monitor ` | ESP32 烧录并监视串口 |
| ` idf.py size-components ` | ESP32 按组件看体积占用 |
| ` xtensa-esp32-elf-objdump -d fw.elf ` | ESP32 反汇编 |
| ` arm-none-eabi-addr2line -e fw.elf -i -f -C 0x08000abc ` | 地址 → 源码行。` -i ` 展开内联调用链（` -O2 ` 下地址落在内联函数里时，不加它只会给你"最外层"那一行），` -f ` 带函数名，` -C ` 解码 C\+\+ 名字 |
| ` arm-none-eabi-c++filt _Z9read_tempv ` | 把符号表里的 C\+\+ 修饰名还原成可读形式。` nm `/` objdump ` 直接看是 ` _Z9read_tempv ` 这种，管道接一个 ` c++filt ` 才看得懂 |
| ` arm-none-eabi-objdump -d --source fw.elf ` | 反汇编并交织源码，等价于 ` -d -S `。 **依赖 ` -g `** |
| ` arm-none-eabi-gdb --batch -ex "target extended-remote :3333" -ex "load" -ex "bt" fw.elf ` | **无交互跑一批 GDB 命令后退出**  —— CI 里做"烧录 \+ 跑测试 \+ 抓回溯"回归的标准写法。` --batch ` 是关键，否则 GDB 会挂在交互提示上 |
| ` openocd -f board/st_nucleo_f103rb.cfg -c "program fw.elf verify reset exit" ` | 不启动 GDB，直接烧录 \+ 校验 \+ 复位 \+ 退出（` exit ` 少了这条 OpenOCD 就不会自己退） |
| ` STM32_Programmer_CLI -c port=SWD -w fw.hex -v -rst ` | ST 官方命令行烧录工具（Windows 上 ` STM32_Programmer_CLI.exe `），支持 ` -v ` 校验、` -rst ` 烧完复位，适合做成产线脚本 |
| ` esptool.py --chip esp32 write_flash 0x10000 fw.bin ` | ESP32 纯命令行烧录（` idf.py flash ` 内部就是在调它）；` esptool.py chip_id ` 可确认串口那头连的是不是芯片 |
| ` xtensa-esp32-elf-gdb --batch -ex "info threads" … ` | ESP32 侧的无交互 GDB，批量跑调试命令。双核目标上 ` info threads ` 能看到两个核各自的现场 |

 

```zhizhan-anchor
ap-7
```



## A.7 Makefile 模板

 

STM32F103 通用 Makefile — 全站唯一权威模板 Makefile

 

```text
# ============================================================
#  STM32F103 通用 Makefile
#  用法：
#    make            编译 Debug 配置
#    make RELEASE=1  编译 Release 配置
#    make flash      烧录
#    make debug      启动 GDB 调试
#    make analyze    静态分析
#    make size       看段/符号占用
#    make clean
#
#  ★ 这是全站【唯一一份】可以直接抄去用的完整模板。
#    模块 5.5 里那份是为了逐步讲解而精简过的教学版，
#    两者共用同一套宏名、同一个链接脚本名 STM32F103C8T6.ld，
#    所以从教学版迁移到这一份不会有任何冲突。
# ============================================================

TARGET   := firmware
BUILD    := build

# ---- 源文件（新增目录只需加到这里）----
C_SOURCES := \
  Src/main.c \
  Src/system_stm32f1xx.c \
  Src/led.c \
  Src/uart.c \
  $(wildcard Drivers/STM32F1xx_HAL_Driver/Src/*.c) \
  $(wildcard Middlewares/FreeRTOS/*.c)

ASM_SOURCES := startup_stm32f103xb.s

C_INCLUDES := \
  -IInc -ISrc \
  -IDrivers/STM32F1xx_HAL_Driver/Inc \
  -IDrivers/CMSIS/Device/ST/STM32F1xx/Include \
  -IDrivers/CMSIS/Include

# ⚠ 链接脚本名必须和模块 4 里写的那份一致 ——
#   全站统一叫 STM32F103C8T6.ld，不要用 CubeMX 生成的
#   STM32F103C8Tx_FLASH.ld，否则照着本站敲会 -T 找不到文件。
LDSCRIPT := STM32F103C8T6.ld

# ---- 工具链 ----
PREFIX  := arm-none-eabi-
CC      := $(PREFIX)gcc
AS      := $(PREFIX)gcc -x assembler-with-cpp
CP      := $(PREFIX)objcopy
SZ      := $(PREFIX)size
OD      := $(PREFIX)objdump
HEX     := $(CP) -O ihex
BIN     := $(CP) -O binary -S

# ---- CPU 选项 ----
CPU := -mcpu=cortex-m3 -mthumb
FPU :=

# ---- 公共选项 ----
COMMON := $(CPU) $(FPU) -std=c11

# ---- 芯片型号宏：HAL 的头文件靠它选寄存器定义 ----
#   ⚠ 少了 -DSTM32F103xB，HAL 源码里的 #if defined(STM32F103xB)
#     全部不成立 → 一编译就是成片的 "undefined"。
#     这是照抄 Makefile 时最常见的第一个坑。
CHIP_DEFS := -DUSE_HAL_DRIVER -DSTM32F103xB

# ---- 配置选择 ----
ifeq ($(RELEASE),1)
  OPT   := -Os -flto
  DBG   := -g0
  DEFS  := $(CHIP_DEFS) -DNDEBUG
else
  OPT   := -Og
  DBG   := -g3 -gdwarf-4
  DEFS  := $(CHIP_DEFS) -DDEBUG -DUSE_FULL_ASSERT
endif

# ---- 警告：全开 ----
WARN := -Wall -Wextra -Wshadow \
        -Wconversion -Wsign-conversion \
        -Wcast-align -Wpointer-arith \
        -Wstrict-prototypes -Wmissing-prototypes -Wmissing-declarations \
        -Wundef -Wdouble-promotion -Wformat=2 \
        -Wswitch-enum -Wswitch-default -Wnull-dereference \
        -Wduplicated-cond -Wlogical-op \
        -Wredundant-decls -Wwrite-strings

# ---- 代码生成 ----
GEN := -fno-common -ffunction-sections -fdata-sections \
       -fno-strict-aliasing -fstack-usage

CFLAGS := $(COMMON) $(OPT) $(DBG) $(DEFS) $(WARN) $(GEN) $(C_INCLUDES) \
          -MMD -MP

# ⚠ 汇编器【不能】喂 CFLAGS。
#   启动文件 startup_stm32f103xb.s 通常要过一遍 C 预处理器，
#   所以 AS 用 gcc -x assembler-with-cpp 是没问题的；
#   但 -std=c11 / -Wconversion / -Wshadow / -fstack-usage 这些是
#   C 前端和警告器的开关，灌给汇编器只会得到一片报错。
#   所以 ASFLAGS 单独写，只保留和汇编真正相关的那几项。
ASFLAGS := $(COMMON) $(OPT) $(DBG) $(DEFS) $(C_INCLUDES) -MMD -MP

# ---- 链接库 ----
#   -lm 不能省：用了 sqrtf / sinf / atan2f 之类，
#   不带它就会在链接期报 undefined reference to `sqrtf`。
#   在 -O2/-Os 下，编译器有时会把这些指令内联成 FPU 指令，
#   于是"调试配置能过、发布配置报错"—— 就是这个原因。
#   -lc 一般会自动带上，显式写出来是给读的人看。
LIBS := -lc -lm

LDFLAGS := $(COMMON) $(OPT) -T$(LDSCRIPT) -nostartfiles \
           --specs=nano.specs --specs=nosys.specs \
           $(LIBS) \
           -Wl,-Map=$(BUILD)/$(TARGET).map \
           -Wl,--gc-sections \
           -Wl,--print-memory-usage \
           -Wl,--cref \
           -Wl,--no-warn-rwx-segments

# ---- 目标文件列表 ----
OBJECTS  := $(addprefix $(BUILD)/,$(notdir $(C_SOURCES:.c=.o)))
OBJECTS  += $(addprefix $(BUILD)/,$(notdir $(ASM_SOURCES:.s=.o)))

# ---- vpath：让 make 能在原目录找到源文件 ----
vpath %.c $(sort $(dir $(C_SOURCES)))
vpath %.s $(sort $(dir $(ASM_SOURCES)))

# ============================================================
#  主要目标
# ============================================================
.PHONY: all clean flash debug analyze size

all: $(BUILD)/$(TARGET).elf $(BUILD)/$(TARGET).hex $(BUILD)/$(TARGET).bin

# ---- 编译 C ----
# | $(BUILD) 是 order-only 先决条件：目录不存在时先建，
# 但目录时间戳变化不会导致重新编译
$(BUILD)/%.o: %.c Makefile | $(BUILD)
	@echo "  CC      $<"
	@$(CC) -c $(CFLAGS) -Wa,-a,-ad,-alms=$(BUILD)/$(notdir $(<:.c=.lst)) $< -o $@

# ---- 编译汇编 ----
$(BUILD)/%.o: %.s Makefile | $(BUILD)
	@echo "  AS      $<"
	@$(AS) -c $(ASFLAGS) $< -o $@

# ---- 链接 ----
$(BUILD)/$(TARGET).elf: $(OBJECTS) Makefile
	@echo "  LD      $@"
	@$(CC) $(OBJECTS) $(LDFLAGS) -o $@
	@$(SZ) $@

$(BUILD)/%.hex: $(BUILD)/%.elf | $(BUILD)
	@$(HEX) $< $@

$(BUILD)/%.bin: $(BUILD)/%.elf | $(BUILD)
	@$(BIN) $< $@

$(BUILD):
	@mkdir -p $@

# ============================================================
#  辅助目标
# ============================================================
flash: $(BUILD)/$(TARGET).bin
	st-flash --reset write $< 0x08000000

debug: $(BUILD)/$(TARGET).elf
	openocd -f interface/stlink.cfg -f target/stm32f1x.cfg &
	$(PREFIX)gdb -x .gdbinit $<

analyze:
	@echo "==== cppcheck ===="
	cppcheck --enable=all --inconclusive --std=c11 \
	         --suppress=missingIncludeSystem \
	         $(C_INCLUDES) Src/

size: $(BUILD)/$(TARGET).elf
	@$(SZ) -A $<
	@echo ""
	@echo "==== 符号占用 Top 20 ===="
	@$(PREFIX)nm --size-sort --print-size $< | tail -20

clean:
	@rm -rf $(BUILD)

# ---- 头文件依赖（-include 让缺失的文件不报错）----
-include $(wildcard $(BUILD)/*.d)
```

 

◆ 这个 Makefile 里最值钱的四行

 

 
1. ` vpath %.c $(sort $(dir $(C_SOURCES))) ` —— 让 ` $(BUILD)/%.o: %.c ` 规则能在原目录找到源文件。  *没有它，所有 .o 都会被建在源码旁边，污染目录树。*
 
2. ` -MMD -MP ` 配合 ` -include $(wildcard $(BUILD)/*.d) ` —— 自动生成头文件依赖。 *没有它，改了 .h 不重新编译，你会浪费几个小时排查"改了没生效"。*
 
3. ` | $(BUILD) `（order-only）—— 目录不存在时先创建， 但目录时间戳变化不触发重编译。 *写成普通先决条件会导致每次 make 都全量重编。*
 
4. ` -fstack-usage ` —— 生成 ` .su ` 文件记录每个函数的栈用量。 排查栈溢出时，` cat build/*.su | sort -t$'\t' -k2 -n | tail -20 ` 直接列出"吃栈大户"。

 

⚠ 抄别人的 Makefile 时，四个最常见的坑

 

 
1. **漏了芯片型号宏** 。HAL 源码里到处是 ` #if defined(STM32F103xB) `，没有 ` -DSTM32F103xB ` 就一片 ` undefined `。 换芯片时改的是这一处，不是源文件。
 
2. **把 ` $(CFLAGS) ` 喂给了汇编器** 。 ` -std=c11 `、` -Wconversion `、 ` -fstack-usage ` 都是 C 前端的选项， 传给 ` as ` 只会报错。汇编规则要用单独的 ` $(ASFLAGS) `。
 
3. **链接时漏了 ` -lm `** 。 只要用到 ` sqrtf ` / ` sinf ` / ` atan2f `，就会 ` undefined reference `。 更迷惑的是：` -Og ` 下编译器可能把它们内联成指令， 于是只有 Release 配置报错。
 
4. **` $@ ` 和 ` $< ` 用反** 。 ` size: ... ` 里写 ` $(SZ) -A $@ `， 展开出来是 ` size -A size ` —— 对着一个不存在的文件报错。 目标文件永远是 ` $< `（第一个先决条件）， ` $@ ` 是当前目标的名字。

 

```zhizhan-anchor
ap-8
```



## A.8 学习路径建议

 

**FIG A.1**  从 C 到全栈嵌入式的六阶段路线

 

```zhizhan-figure
<svg viewBox="0 0 660 420" width="660" height="420" role="img" aria-label="学习路线"><defs><marker id="ah12" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker></defs>
          <!-- 阶段 1 -->
          <rect x="20" y="20" width="620" height="58" rx="7" class="sv-grn-s" stroke-width="1.8"></rect>
          <circle cx="48" cy="49" r="15" fill="var(--grn-d)" stroke="var(--grn)"></circle>
          <text x="48" y="54" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--grn)">①</text>
          <text x="76" y="44" class="sv-lbl-hi" style="fill:var(--grn);font-size:13px">嵌入式 C 进阶 —— 就是本站内容</text>
          <text x="76" y="64" class="sv-lbl-dim" style="font-size:10.5px">数据表示 · 存储类与 volatile · 指针 · 内存分区 · 编译链接 · 寄存器编程 · 调试</text>
          <text x="612" y="44" class="sv-lbl-hi" text-anchor="end" style="fill:var(--grn);font-size:11px">✓ 当前</text>

          <path d="M 330 80 L 330 100" stroke="var(--grn)" stroke-width="1.4" marker-end="url(#ah12)"></path>

          <!-- 阶段 2 -->
          <rect x="20" y="104" width="620" height="58" rx="7" class="sv-cyn-s"></rect>
          <circle cx="48" cy="133" r="15" fill="var(--cyn-d)" stroke="var(--cyn)"></circle>
          <text x="48" y="138" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">②</text>
          <text x="76" y="128" class="sv-lbl-hi" style="fill:var(--cyn);font-size:13px">MCU 外设与实时性</text>
          <text x="76" y="148" class="sv-lbl-dim" style="font-size:10.5px">GPIO · 定时器/PWM · UART/SPI/I2C · ADC/DMA · 中断优先级 · 低功耗 · 状态机</text>
          <text x="612" y="128" class="sv-lbl-dim" text-anchor="end" style="font-size:10.5px">STM32CubeMX + HAL 起步，逐步转寄存器</text>

          <path d="M 330 164 L 330 184" stroke="var(--line-2)" stroke-width="1.4" marker-end="url(#ah12)"></path>

          <!-- 阶段 3 -->
          <rect x="20" y="188" width="620" height="58" rx="7" class="sv-amb-s"></rect>
          <circle cx="48" cy="217" r="15" fill="var(--amb-d)" stroke="var(--amb)"></circle>
          <text x="48" y="222" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">③</text>
          <text x="76" y="212" class="sv-lbl-hi" style="fill:var(--amb);font-size:13px">RTOS 与并发</text>
          <text x="76" y="232" class="sv-lbl-dim" style="font-size:10.5px">FreeRTOS / Zephyr · 任务与优先级 · 队列/信号量/互斥量 · 优先级反转 · 临界区 · 栈用量分析</text>
          <text x="612" y="212" class="sv-lbl-dim" text-anchor="end" style="font-size:10.5px">从"裸机大循环"到"多任务"的思维转变</text>

          <path d="M 330 248 L 330 268" stroke="var(--line-2)" stroke-width="1.4" marker-end="url(#ah12)"></path>

          <!-- 阶段 4 -->
          <rect x="20" y="272" width="620" height="58" rx="7" class="sv-vio-s"></rect>
          <circle cx="48" cy="301" r="15" fill="var(--vio-d)" stroke="var(--vio)"></circle>
          <text x="48" y="306" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--vio)">④</text>
          <text x="76" y="296" class="sv-lbl-hi" style="fill:var(--vio);font-size:13px">通信协议与系统集成</text>
          <text x="76" y="316" class="sv-lbl-dim" style="font-size:10.5px">Modbus · CAN · BLE/WiFi · MQTT · 自定义二进制协议 · 校验/重传/超时 · OTA 升级 · Bootloader</text>
          <text x="612" y="296" class="sv-lbl-dim" text-anchor="end" style="font-size:10.5px">设备开始"联网"和"可维护"</text>

          <path d="M 330 332 L 330 352" stroke="var(--line-2)" stroke-width="1.4" marker-end="url(#ah12)"></path>

          <!-- 阶段 5 -->
          <rect x="20" y="356" width="300" height="58" rx="7" class="sv-red-s"></rect>
          <circle cx="48" cy="385" r="15" fill="var(--red-d)" stroke="var(--red)"></circle>
          <text x="48" y="390" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--red)">⑤</text>
          <text x="76" y="380" class="sv-lbl-hi" style="fill:var(--red);font-size:13px">嵌入式 Linux</text>
          <text x="76" y="400" class="sv-lbl-dim" style="font-size:10.5px">交叉编译 · 内核裁剪 · 设备树 · 驱动 · Yocto/Buildroot</text>

          <rect x="340" y="356" width="300" height="58" rx="7" class="sv-red-s"></rect>
          <circle cx="368" cy="385" r="15" fill="var(--red-d)" stroke="var(--red)"></circle>
          <text x="368" y="390" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--red)">⑥</text>
          <text x="396" y="380" class="sv-lbl-hi" style="fill:var(--red);font-size:13px">端侧 AI 与其他前沿</text>
          <text x="396" y="400" class="sv-lbl-dim" style="font-size:10.5px">TFLite Micro · CMSIS-NN · 量化 · TinyML</text>
        </svg>
```

 

**不要跳级。** 阶段 ②③ 是绝大多数嵌入式岗位的核心要求； 阶段 ④ 是"能独立做产品"的分水岭；阶段 ⑤⑥ 是差异化竞争力。  *每个阶段都建议"用一个小项目收尾"——没有项目收尾的学习，留存率会低得多。*

 

✔ 每个阶段的项目建议（做完一个再进下一个）

 

| 阶段 | 项目 | 检验点 |
| --- | --- | --- |
| **①** | 不用 HAL，纯寄存器实现"按键控制 LED 呼吸灯" | 能解释每一行寄存器操作的硬件含义；能自己写链接脚本 |
| **②** | 做一个"串口示波器"：ADC 采样 → DMA → 环形缓冲 → 上位机绘图 | 能画出完整的数据流图；说明每个环节的时序约束 |
| **③** | 用 FreeRTOS 重写上面这个项目，拆成采集/处理/通信三个任务 | 能说清每个任务的栈用量、优先级理由、共享数据的保护方式 |
| **④** | 做一个能 [OTA](term:ota) 升级的传感器节点，带 MQTT 上报 | 能处理升级失败回滚；断电不砖 |
| **⑤** | 给一块 Linux 开发板写一个字符设备驱动，控制 GPIO | 理解 file\_operations、设备树匹配、用户态/内核态边界 |
| **⑥** | 在 MCU 上跑关键字唤醒（KWS），识别 3 个词 | 能说明模型量化前后的精度/内存/耗时权衡 |

 

```zhizhan-anchor
ap-9
```



## A.9 术语与符号对照表

 

这一节是 **全站的"单一事实源"** ：正文里凡出现这些术语或符号，含义都以这里为准。 它不只是给读者查的 —— 构建脚本会把这张表与 ` verify/glossary.json ` 逐条比对，  **两边对不上就构建失败** ，免得同一件事在不同章节被写成不同的样子（这正是早期 200\+ 条质检里最隐蔽的一类问题）。

 

```zhizhan-anchor
ap-9-1
```



### A.9.1 术语（容易混用的成对概念，优先看前两条）

 

| 术语 | 精确定义 |
| --- | --- |
| **存储期** | 对象从分配到释放的时间区间。C 有四种：自动、静态、线程、动态（` malloc `）。回答的是" **什么时候分配/释放** "。 |
| **对象生存期** | 对象可以被 **合法访问** 的时间区间。它与存储期相关但不等同——例如动态存储期对象在 ` free ` 之后生存期即结束，再访问就是悬垂引用。 |
| **程序运行期** | 整个程序从 ` main ` 到退出的存亡区间。回答的是"进程/程序活着的这段时间"。 |
| **链接属性** | 符号是"外部链接"（别的编译单元可见，如非 ` static ` 全局）还是"内部链接"（只在本编译单元可见，如 ` static `）。 |
| **可见性** | 作用域层面的名字可及性。注意它与"链接属性" **不是一回事** ，不要混用。 |
| **数组退化** | 数组名在多数表达式中被转为指向首元素的指针；但 ` sizeof `、` & `、` _Alignof ` 除外——这正是 ` sizeof(数组形参) ` 会变成指针宽度的原因。 |
| **位带** | Cortex-M3/M4 可选的地址别名机制：外设区 ` 0x42000000 `、SRAM 区 ` 0x22000000 `，公式 ` alias = base + (addr−band_base)*32 + bit*4 `。它只能原子地读写单个位， **不能原子翻转** 。 |
| **别名区** | 位带映射出来的那一片地址区域。别名区不经过外设数据通路， **不能用于 DMA** 。 |
| **原子性** | 一次操作要么完整发生、要么完全没发生，中间不被中断或其他核观测到。 **` volatile ` 不提供原子性** 。 |
| **内存屏障** | 约束内存访问的可见顺序：编译屏障（` asm volatile("" ::: "memory") `）约束编译器，硬件屏障（` __DMB `/` __DSB `）约束总线与核。 |
| **易失性** | ` volatile ` 表达的性质：每次访问都真的读写内存，不得缓存、合并或删除。它 **既不含原子性、也不含屏障** 。 |

 

```zhizhan-anchor
ap-9-2
```



### A.9.2 符号（链接脚本与跨模块共用的那几个）

 

| 符号 | 类别 | 含义 |
| --- | --- | --- |
| ` _sstack ` | 链接脚本 | 栈底（低地址，栈的警戒线）。用来算栈用量和放栈哨兵。 |
| ` _estack ` | 链接脚本 | 栈顶（高地址，栈向下生长）。 **必须是向量表偏移 ` 0x00 ` 处的第一个字（初始 MSP）；偏移 0x04 是复位入口** ——复位时硬件直接把它装进 SP。 |
| ` _sidata ` | 链接脚本 | ` LOADADDR(.data) `：` .data ` 初值在  **Flash**  中的起始地址。 |
| ` _sdata ` | 链接脚本 | ` .data ` 在  **RAM**  中的起始地址。 |
| ` _edata ` | 链接脚本 | ` .data ` 在 RAM 中的结束地址。 |
| ` _sbss ` | 链接脚本 | ` .bss ` 起始地址（启动时从此清零）。 |
| ` _ebss ` | 链接脚本 | ` .bss ` 结束地址。 |
| ` _end ` | 链接脚本 | 所有静态数据结束处，习惯作为堆起点；newlib 的 ` _sbrk ` 默认引用它（别名 ` end `）。 |
| ` _Min_Heap_Size ` | 链接脚本常数 | 链接期预留的堆下限 **栅栏** ，不是运行期配额——调大它并不会让 ` malloc ` 多分内存。 |
| ` _Min_Stack_Size ` | 链接脚本常数 | 链接期预留的栈下限栅栏。 |
| ` __init_array_start ` | 链接脚本 | ` .init_array `（全局构造 / ` constructor ` 指针表）起始。 |
| ` __init_array_end ` | 链接脚本 | ` .init_array ` 结束。 |
| ` __libc_init_array ` | libc 函数 | 启动期遍历 ` __preinit_array ` 与 ` __init_array `、调用各构造函数。 |
| ` _sbrk ` | 用户实现的函数 | newlib 的 ` malloc `/` printf ` 向系统要内存的入口；裸机上必须自己实现。 |
| ` g_rx_buffer ` | 变量 | ` uint8_t[1024] `，非 ` static ` 全局 → ` nm ` 类型 ` B `，符号大小 ` 0x400 `。 |
| ` s_cache ` | 变量 | ` static int[512] ` = 2048 字节 → ` nm ` 类型 ` b `（局部符号），大小 ` 0x800 `。 |
| ` g_baud ` | 变量 | ` int 115200 `（跨编译单元用 ` extern ` 声明， **类型必须一致** ）。 |
| ` g_version ` | 变量 | ` const ` → 落 ` .rodata `（` nm ` 类型 ` R `），常驻 Flash，不占 SRAM。 |

 

⚠ 读别处代码时：栈符号的别名先统一

 

本站统一用 ` _sstack ` / ` _estack ` 这一对。 你在别处会看到 ` _stack_top `、` __stack `、` __initial_sp `（Keil 启动文件）、` estack ` 等写法 —— 它们通常是同一个东西的别名。 **抄代码前先统一命名** ，否则会出现"启动文件引用 ` _estack `、 链接脚本却只定义了 ` _stack_top `"这种链接期找不到符号的低级事故。

 

```zhizhan-anchor
ap-10
```



## A.10 组件与代码风格约定

 

这里登记三个 **给后续各册复用** 的展示组件（平台切换、代码 Diff、时序图）， 以及一份全站代码风格约定 —— 它们的作用是让"同一件事在不同章节、不同平台上"看起来始终一致。

 

```zhizhan-anchor
ap-10-1
```



### A.10.1 平台切换 Tab（I-07）

 

同一个功能，STM32 / ESP32 / 主机的写法并排放在一个可切换的组件里，而不是散落三处。 下面是活的可点示例（点标题切换）：

 

打开 GPIOC 时钟（F1：APB2ENR，bit4）：

 

```text
*(volatile uint32_t *)0x40021018 |= (1u << 4);   /* RCC_APB2ENR */
```

 

ESP32 用时钟门控宏（外设复位默认多已放开，但别依赖它）：

 

```text
REG_SET_BIT(GPIO_ENABLE_REG, GPIO_ENABLE_GPIO2);   /* IDF 风格 */
```

 

主机上没有寄存器：同一份 **纯逻辑** 直接编成 PC 程序跑测试（见 §7.6）。

 

```text
gcc -IInc test_alarm.c alarm_logic.c temp_svc.c -o test && ./test
```

 

*写法约定：` .ptabs ` 内放一个 ` .ptab-bar `（若干 ` button.ptab[data-tab] `）和若干 ` .ptab-pane[data-pane] `，` data-tab ` 与 ` data-pane ` 对应。*

 

```zhizhan-anchor
ap-10-2
```



### A.10.2 代码 Diff 视图（I-08）

 

左右并排对照"错误写法 vs 正确写法"、"重构前 vs 重构后"：

 

✕ 错误写法（读-改-写）✔ 正确写法（单次写原子）

 

```text
/* ISR 里改一位 */GPIOA->ODR |= (1u << 5);/* 读 → 改 → 写 *//* 中断插在中间就丢更新 */
```

 

```text
/* 用单次写原子寄存器 */GPIOA->BSRR = (1u << 5);/* 只写，不影响其它位 *//* 天然无竞态 */
```

 

```zhizhan-anchor
ap-10-3
```



### A.10.3 时序图（I-10）

 

协议、中断响应、DMA、OTA 这些"沿时间展开"的东西，用框图讲不清。下面是时序图组件的最小示例 （[I²C](term:i2c) 写一个寄存器）：

 

**SEQ A.1**  I²C 写入寄存器：START → 地址 → 寄存器 → 数据 → STOP

 

```zhizhan-figure
<svg viewBox="0 0 640 170" width="640" height="170" role="img" aria-label="I2C 写时序">
          <text x="80" y="18" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">主（MCU）</text>
          <text x="560" y="18" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">从（传感器）</text>
          <line x1="80" y1="26" x2="80" y2="158" class="lifeline"></line>
          <line x1="560" y1="26" x2="560" y2="158" class="lifeline"></line>
          <rect x="30" y="30" width="100" height="16" rx="3" class="sv-cyn-s"></rect>
          <text x="80" y="42" class="sv-lbl-dim" text-anchor="middle">START</text>
          <path d="M 84 60 L 552 60" class="msg"></path>
          <text x="318" y="54" class="sv-lbl-dim" text-anchor="middle">7 位地址 + W(0)</text>
          <path d="M 556 86 L 88 86" class="msg-ret"></path>
          <text x="318" y="80" class="sv-lbl-dim" text-anchor="middle">ACK</text>
          <path d="M 84 112 L 552 112" class="msg"></path>
          <text x="318" y="106" class="sv-lbl-dim" text-anchor="middle">寄存器地址 + 数据字节</text>
          <path d="M 556 138 L 88 138" class="msg-ret"></path>
          <text x="318" y="132" class="sv-lbl-dim" text-anchor="middle">ACK + STOP</text>
        </svg>
```

 

*写法约定：` .seq > .seq-hd `（标题）\+ ` .seq-bd `（内放手绘 SVG）；生命周期线用 ` .lifeline `，消息箭头用 ` .msg `（请求）/ ` .msg-ret `（应答）。*

 

```zhizhan-anchor
ap-10-4
```



### A.10.4 代码风格约定（I-06 / F-362）

 

| 维度 | 约定 |
| --- | --- |
| 缩进 | 统一  **4 个空格** ，不用 Tab。 |
| ` #include ` 位置 | 一律 **置顶** ，不在函数之间插入 include；系统头在前、项目头在后。 |
| 命名 | 全局变量 ` g_xxx `、静态变量/函数 ` s_xxx `、常量宏全大写、类型名 ` xxx_t `。 |
| 对齐 | **不用成排空格对齐变量名** （列宽一变就散），靠缩进表达层级即可。 |
| 每代码块 = 一个文件 | 要么是 **可直接编译的完整文件** （include 齐全、无未定义符号），要么在标题里明确标注"片段"并给出上下文。 |
| 运行环境标注 | 示例要写清跑在哪： **主机 x86-64 / STM32F103 / ESP32**  —— 同一段代码在两处行为不同时尤其重要。 |
| 数字来源 | 凡是"实测数字"必须附可复现命令或脚本；不确定的写"经验值"，不写精确百分比。 |

 

▸ 关于本资料的定位

 

本站（阶段 ①）的目标是 **把 C 语言在嵌入式语境下"讲透"** —— 不是再讲一遍语法，而是讲清楚 *编译器怎么处理你的代码、内存里到底发生了什么、硬件为什么这么设计* 。   
  
 学完这一站，你应该能做到：  **①**  看到一个 C 文件，能说出它会生成哪些段、占多少 Flash/RAM；  **②**  遇到 ` -O2 ` 才出现的 bug，能第一时间怀疑 ` volatile ` 和 UB；  **③**  遇到 HardFault，能自己用栈帧和 ` addr2line ` 定位到源码行；  **④**  不用 HAL 也能点亮一个 LED，并且知道每条寄存器操作在硬件上意味着什么。   
  
  *这四点，是后面所有阶段的共同地基。*

 

◆ 附录使用建议

 

 
- **A.1 陷阱表** ——遇到"莫名其妙"的问题时先扫一遍，命中率很高。
 
- **A.2 GCC 选项** ——建新项目时直接抄那个选项组合；` -Wconversion ` 和 ` -fstack-usage ` 是最容易被忽略的两个。
 
- **A.3 关键字与属性** ——` volatile ` / ` static ` / ` const ` 三者的精确语义值得反复看。
 
- **A.4 寄存器/基址** ——写裸机代码时查地址用。建议对照芯片手册（RM0008）确认，不同型号有差异。
 
- **A.5 链接脚本** ——` >RAM AT>FLASH `、` KEEP() `、` ASSERT() ` 是最常用的三个。
 
- **A.6 工具命令** ——` addr2line `、` nm --size-sort `、` size -A ` 是排查问题最常用的三条。
 
- **A.7 Makefile** ——直接可用。重点理解"最值钱的四行"。
 
- **A.8 路线图** ——每个阶段配一个项目，做完再进下一个。
 
- **A.9 术语与符号** —— **全站单一事实源** ：存储期/对象生存期/程序运行期怎么分、链接脚本那一串 ` _sxxx ` 符号各是什么。构建脚本会拿它和 ` verify/glossary.json ` 对账。
 
- **A.10 组件与风格** ——平台切换 Tab / 代码 Diff / 时序图三个复用组件，外加一份代码风格约定。

 

**已读完全部内容？**  建议从 Module 00 开始，按顺序精读一遍，每个模块都动手敲一遍代码。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
