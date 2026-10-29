# 调试、诊断与工具链

```zhizhan-anchor
ch8
```



嵌入式最核心的能力不是"写出没 bug 的代码"（那不可能），而是  **"能在没有 printf、不能重启、现场不能复现的条件下，把 bug 找出来"** 。 这一章讲的就是这套能力。

 

> ◷ 约 100 分钟 · ◈ 含 HardFault 实战代码 · ⚑ 最实用的一章

 

```zhizhan-anchor
ch8-1
```



## 8.1 调试的思维方式

 

工具是次要的， **方法才是主要的** 。嵌入式调试和软件调试最大的区别是： 你不能随便加 ` printf `（可能破坏时序、可能没有输出通道）， 不能随便重启（可能现场就没了），很多 bug **只在特定时序下出现** 。

 

**FIG 8.1**  嵌入式调试的四步循环

 

```zhizhan-figure
<svg viewBox="0 0 660 300" width="660" height="300" role="img" aria-label="调试循环">
          <defs>
            <marker id="ah12" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <!-- 四步 -->
          <rect x="30" y="30" width="150" height="72" rx="7" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="105" y="56" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">① 观察现象</text>
          <text x="105" y="76" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">不是"它坏了"</text>
          <text x="105" y="92" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">而是"第 3 次收包后卡住"</text>

          <path d="M 184 66 L 222 66" class="sv-arrow"></path>

          <rect x="226" y="30" width="150" height="72" rx="7" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="301" y="56" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">② 提出假设</text>
          <text x="301" y="76" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">"可能是 RX 缓冲区溢出"</text>
          <text x="301" y="92" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">必须可证伪</text>

          <path d="M 380 66 L 418 66" class="sv-arrow"></path>

          <rect x="422" y="30" width="150" height="72" rx="7" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="497" y="56" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--grn)">③ 设计实验</text>
          <text x="497" y="76" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">"把缓冲区从 256 改到 1024"</text>
          <text x="497" y="92" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">一次只改一个变量</text>

          <path d="M 572 66 L 610 66" class="sv-arrow"></path>
          <path d="M 610 66 L 610 130 L 105 130 L 105 106" stroke="var(--grn)" stroke-width="1.4" fill="none" marker-end="url(#ah12)" stroke-dasharray="5 4"></path>

          <rect x="440" y="160" width="190" height="52" rx="7" class="sv-vio-s"></rect>
          <text x="535" y="182" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--vio)">④ 验证结论</text>
          <text x="535" y="200" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">假设成立 → 找根因；不成立 → 换假设</text>

          <!-- 关键原则 -->
          <rect x="30" y="160" width="390" height="120" rx="7" class="sv-red-s"></rect>
          <text x="46" y="182" class="sv-lbl-hi" style="fill:var(--red)">四条铁律</text>
          <text x="46" y="204" class="sv-lbl-dim" style="font-size:11px">① 一次只改一个变量 —— 同时改三处，成功了也不知道是哪个起的作用</text>
          <text x="46" y="224" class="sv-lbl-dim" style="font-size:11px">② 先确认"能稳定复现" —— 不能复现的 bug 修不好，只能碰运气</text>
          <text x="46" y="244" class="sv-lbl-dim" style="font-size:11px">③ 相信数据，不相信直觉 —— "我觉得不可能" 是最贵的四个字</text>
          <text x="46" y="264" class="sv-lbl-dim" style="font-size:11px">④ 二分法定位 —— 在中间插检查点，一次砍掉一半搜索空间</text>
        </svg>
```

 

**最有效的单一技巧是二分法。**  "代码从 A 到 B 之间出了问题"——在中间加检查点，判断问题在前半段还是后半段， 重复 log₂(N) 次就能定位到具体位置。 *1000 行代码只需 10 次检查。*

 

✔ 现象描述的质量，决定调试的速度

 

| ✕ 无效描述 | ✔ 有效描述 |
| --- | --- |
| "程序跑飞了" | "运行 47 秒后进入 HardFault，每次时间接近但不完全相同" |
| "串口收不到数据" | "波特率 115200 下收 8 字节后停止，改成 9600 能完整收到" |
| "有时候会重启" | "只有电机启动的瞬间才重启，用示波器看 3.3V 有 400mV 的跌落" |
| "优化后就不对了" | "-O0 正常，-Og 开始出错，出错的变量是 g\_rx\_head" |

 

**规律** ：有效描述里一定有 *数字、条件、范围* 。 "每次都这样"和"100 次里有 3 次"指向完全不同的根因。

 

```zhizhan-anchor
ch8-1-1
```



### 8.1.1 把"调试"拆成三个可量化的维度

 

"调试能力"听起来玄，其实可以拆成三个 **能衡量、能改进** 的维度。每次卡住时，问自己卡在哪一个维度上：

 

| 维度 | 是什么 | 怎么提高 | 典型症状 |
| --- | --- | --- | --- |
| **可观测性** | 你能不能"看见"程序内部状态 | 加日志/断点/watch/RTT；把关键状态暴露出来；让断言带上下文 | "不知道它现在走到哪了""看不到这个变量的值" |
| **可复现性** | 问题能不能稳定重现 | 固定输入/时序/环境；缩小触发条件；必要时用硬件在环自动跑 | "时好时坏""现场能复现、实验室复现不了" |
| **可二分性** | 能不能把问题范围快速砍半 | 在中间点插检查点；模块边界清晰（§7.3）；能单独编译某一层 | "只能逐行读代码猜""改了 A，B 也变了" |

 

◆ 大多数"查不出来"，是缺了前两个维度

 

真正难查的 bug，几乎都是 **可复现性差** （偶发）或 **可观测性差** （现场看不到）造成的 —— 而不是"算法太复杂"。所以"为调试做的设计"（日志、状态暴露、诊断接口）在项目里的价值， 往往高于"把某个函数写得更快"。 *先让问题可见、可复现，很多 bug 会自己交代。*

 

```zhizhan-anchor
ch8-1-2
```



### 8.1.2 二分法：最有效的单一技巧，以及它的前提

 

一千行代码里的问题，用二分法十次检查点就能定位。但二分法有几个 **容易忽略的前提** ，不满足时它会失灵：

 

 
- **状态必须干净** ：每次测试前要回到同一个初始状态。"上一次跑残留的状态"会让二分结果自相矛盾。
 
- **一次只动一个变量** ：同时注释两处，问题消失了，你也不知道是哪个起的作用。
 
- **要有"好/坏"的判据** ：什么叫"通过"？必须先定义可观测的成败标准，否则二分没有方向。
 
- **问题在"边界"上时二分收敛慢** ：比如只在最大负载、最低温度下出现——这时代替"砍半代码"，更该做的是 **构造那个边界条件** （§8.15 的信号弱场景就是如此）。
 

 

✔ 一个比注释更好的二分手段

 

注释掉代码会改变程序行为、引入新变量。更干净的做法是 **插检查点** ： 在程序的关键节点打印/记录一个"到达标记 \+ 状态"，看"最后一个到达的检查点"在哪。 它不改变控制流，也不会把 bug"注释掉" ——  *用它定位的是"卡在哪一段"，而不是"删掉哪段就不复现"。*

 

```zhizhan-anchor
ch8-2
```



## 8.2 GDB \+ OpenOCD：硬件级调试

 

这是嵌入式最强大的调试手段： **可以在芯片运行时暂停它，查看/修改任意内存和寄存器** 。 STM32 用 ST-Link，ESP32 用内置的 JTAG（` idf.py openocd ` / ` idf.py gdb `）。

 

**FIG 8.2**  调试链路：GDB 不直接连芯片

 

```zhizhan-figure
<svg viewBox="0 0 660 200" width="660" height="200" role="img" aria-label="调试链路">
          <defs>
            <marker id="ah13" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path>
            </marker>
          </defs>

          <rect x="18" y="60" width="128" height="76" rx="7" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="82" y="86" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--vio)">arm-none-eabi-gdb</text>
          <text x="82" y="106" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">符号 · 断点 · 变量</text>
          <text x="82" y="122" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">读 .elf 文件</text>

          <path d="M 150 98 L 188 98" class="sv-arrow"></path>
          <text x="169" y="90" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">GDB RSP</text>
          <text x="169" y="114" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">:3333</text>

          <rect x="192" y="60" width="128" height="76" rx="7" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="256" y="86" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">OpenOCD</text>
          <text x="256" y="106" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">协议翻译层</text>
          <text x="256" y="122" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">JTAG/SWD 时序</text>

          <path d="M 324 98 L 362 98" class="sv-arrow"></path>
          <text x="343" y="90" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">SWD</text>
          <text x="343" y="114" class="sv-lbl-dim" text-anchor="middle" style="font-size:9px">2 根线</text>

          <rect x="366" y="60" width="128" height="76" rx="7" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="430" y="86" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">ST-Link / J-Link</text>
          <text x="430" y="106" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">USB ↔ SWD 转换</text>
          <text x="430" y="122" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">硬件调试探针</text>

          <path d="M 498 98 L 536 98" class="sv-arrow"></path>

          <rect x="540" y="60" width="104" height="76" rx="7" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="592" y="86" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--grn)">STM32</text>
          <text x="592" y="106" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">目标芯片</text>
          <text x="592" y="122" class="sv-lbl-dim" text-anchor="middle" style="font-size:10px">Debug 单元</text>

          <text x="18" y="34" class="sv-lbl-hi" style="fill:var(--txt-hi);font-size:12px">为什么要分两层？</text>
          <text x="18" y="180" class="sv-lbl-dim" style="font-size:10.5px">OpenOCD 把"读某个内存地址"翻译成 SWD 的位时序；GDB 只管协议和符号。这样换芯片只需换 OpenOCD 配置，GDB 使用方式完全不变。</text>
        </svg>
```

 

bash启动调试会话

 

```text
# ---- 终端 1：启动 OpenOCD（保持运行）----
$ openocd -f interface/stlink.cfg -f target/stm32f1x.cfg
Info : clock speed 1000 kHz
Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748
Info : Target voltage: 3.258000
Info : stm32f1x.cpu: hardware has 6 breakpoints, 4 watchpoints
Info : starting gdb server for stm32f1x.cpu on 3333     ← 记住这个端口
Info : Listening on port 3333 for gdb connections

# ---- 终端 2：启动 GDB ----
$ arm-none-eabi-gdb build/firmware.elf
(gdb) target extended-remote localhost:3333
(gdb) monitor reset halt            # 复位并停在第一条指令
(gdb) load                          # 烧录（GDB 也能烧录）
(gdb) break main
(gdb) continue

# ---- 如果用 STM32CubeIDE / VSCode，这些都被封装成一键操作 ----
# 但知道底层在做什么，出问题时才能排查（比如"连不上目标"）
```

 

GDB 常用命令速查（嵌入式专用） GDB

 

```text
# ============ 连接与控制 ============
target extended-remote localhost:3333
monitor reset halt              # 复位并停止
monitor reset init              # 复位并执行初始化脚本
load                            # 下载程序到 Flash
compare-sections                # 校验 Flash 内容与 .elf 是否一致
detach                          # 断开（程序继续运行）
quit

# ============ 断点 ============
break main                      # 函数断点
break uart.c:147                # 文件:行号
break uart_isr if rx_count > 100   # 条件断点 ← 极其实用
tbreak process_frame            # 临时断点（命中一次后自动删除）
watch g_rx_head                 # 数据断点：变量被写时停下
rwatch g_state                  # 变量被读时停下
awatch g_flag                   # 读或写都停
info breakpoints
delete 2                        # 删除 2 号断点
disable 3 / enable 3

# ⚠ 硬件断点数量有限（STM32 通常 6 个），软件断点需要改 Flash 内容

# ============ 执行控制 ============
continue / c
step / s                        # 单步进入函数
next / n                        # 单步跳过函数
finish                          # 运行到当前函数返回
until 147                       # 运行到指定行
stepi / nexti                   # 单条汇编指令级单步
advance main                    # 运行到 main

# ============ 查看数据 ============
print g_rx_head                 # 打印变量
print/x g_rx_head               # 十六进制
print/t g_flags                 # 二进制
print *ptr@10                   # 打印 ptr 指向的 10 个元素 ← 看数组的利器
print sizeof(struct sensor)
print g_sensor->err_count
info locals                     # 当前函数所有局部变量
info args                       # 当前函数参数
bt                              # 调用栈（backtrace）← 最重要的一条
bt full                         # 带局部变量的完整栈
frame 2                         # 切换到第 2 层栈帧
info frame

# ============ 查看内存 ============
x/16xw 0x20000000               # 从该地址读 16 个 32 位字（十六进制）
x/32bx &g_rx_buffer             # 32 个字节
x/8i $pc                        # 反汇编 $pc 起始的 8 条指令
x/s g_version                   # 按字符串显示
x/16xw (char*)&_estack - 64     # 看栈顶往下 64 字节有没有被踩
                                # ⚠ 一定要先转成 (char*) 再减。
                                #   直接写 &_estack - 16 的话，减多少【取决于
                                #   符号被推断成什么类型】—— 可能只减 16 字节，
                                #   也可能减 64 字节。GDB 不会报错，你只是
                                #   看错了地方，然后得出"栈没溢出"的错误结论。

# ============ 寄存器 ============
info registers                  # 所有寄存器
print $pc                       # 程序计数器
print $sp                       # 栈指针
print $lr                       # 链接寄存器
print/x $xpsr                   # 程序状态寄存器
set var g_debug_mode = 1        # 运行期改变量 ← 调试神器
set $r0 = 0x1234                # 直接改寄存器

# ============ 外设寄存器（用内存映射地址访问）============
set $gpioa_odr = (uint32_t *)0x4001080C
print/x *$gpioa_odr
set *$gpioa_odr = 1 << 5        # 直接点亮 PA5！

# 定义便捷函数（可以写进 .gdbinit）
define gpio
  printf "ODR=0x%08X IDR=0x%08X CRH=0x%08X\n", \
    *(uint32_t*)0x4001080C, *(uint32_t*)0x40010808, *(uint32_t*)0x40010804
end
# 之后直接输入 gpio 就能看 GPIOA 状态

# ============ 其他实用命令 ============
monitor reset halt
monitor flash write_image erase firmware.bin 0x08000000
monitor stm32f1x mass_erase 0   # 全片擦除（救砖）
monitor arm semihosting enable  # 开启半主机：走 GDB 通道，与 ITM 是两回事（见 8.2.1）
```

 

◆ 三个改变调试效率的命令

 

 
1. **` bt `（backtrace）** ：程序停在哪不重要， *"它是怎么走到这里的"才重要* 。 ` bt ` 显示完整调用链，配合 ` frame N ` 可以查看每一层的局部变量。
 
2. **` watch `（数据断点）** ：这是排查"变量莫名被改"的唯一有效手段。  *不要读代码猜谁改的——让硬件告诉你。*  ` watch g_state ` 后运行，一旦该变量被写就立刻停下，` bt ` 一看就知道是谁干的。
 
3. **条件断点 ` break file.c:100 if count == 1000 `** ： 循环里的 bug 往往只在特定迭代出现。没有条件断点，你要按 1000 次 continue。

 

.gdbinit — 放进项目根目录，每次自动加载 GDB

 

```text
# ============ 基础设置 ============
set confirm off                 # 不确认，直接执行
set pagination off              # 不分页
set print pretty on             # 结构体多行显示
set print elements 32           # 数组最多显示 32 个元素
set print array-indexes on      # 显示数组下标
set disassemble-next-line on    # 单步时自动反汇编下一行（嵌入式必备）
set history save on

# ============ 连接目标 ============
target extended-remote localhost:3333

# ============ 自定义命令 ============

# 查看所有段信息（等价于 size 命令）
define secinfo
  printf "--- Sections ---\n"
  maintenance info sections
end

# 查看当前栈使用量
define stackusage
  printf "SP=0x%08X  _estack=0x%08X  used=%u bytes\n", \
    $sp, &_estack, (unsigned int)((unsigned int)&_estack - (unsigned int)$sp)
end

# 打印 GPIOA 全部寄存器
define gpioa
  printf "CRL =0x%08X  CRH =0x%08X\n", *(unsigned int*)0x40010800, *(unsigned int*)0x40010804
  printf "IDR =0x%08X  ODR =0x%08X\n", *(unsigned int*)0x40010808, *(unsigned int*)0x4001080C
  printf "BSRR=0x%08X  BRR =0x%08X\n", *(unsigned int*)0x40010810, *(unsigned int*)0x40010814
end

# 查看 RCC 时钟配置
define rcc
  printf "CR      =0x%08X  (PLLON=%u, PLLRDY=%u)\n", \
    *(unsigned int*)0x40021000, \
    (*(unsigned int*)0x40021000 >> 24) & 1, \
    (*(unsigned int*)0x40021000 >> 25) & 1
  printf "CFGR    =0x%08X  (SW=%u, SWS=%u, HPRE=%u, PPRE2=%u)\n", \
    *(unsigned int*)0x40021004, \
    *(unsigned int*)0x40021004 & 3, \
    (*(unsigned int*)0x40021004 >> 2) & 3, \
    (*(unsigned int*)0x40021004 >> 4) & 0xF, \
    (*(unsigned int*)0x40021004 >> 11) & 7
  printf "APB2ENR =0x%08X\n", *(unsigned int*)0x40021018
end

# 反汇编当前函数
define df
  disassemble $pc - 40, $pc + 40
end

# 查看 HardFault 相关状态
define hf
  printf "CFSR  =0x%08X\n", *(unsigned int*)0xE000ED28
  printf "HFSR  =0x%08X\n", *(unsigned int*)0xE000ED2C
  printf "MMFAR =0x%08X\n", *(unsigned int*)0xE000ED34
  printf "BFAR  =0x%08X\n", *(unsigned int*)0xE000ED38
end

# ============ 断点预设 ============
# break HardFault_Handler
# break assert_failed
# break configASSERT
```

 

从网上抄 .gdbinit 时，这两行要删掉

 

很多 PC 端 GDB 教程里会有 ` set disassembly-flavor intel `。这一行是给  **x86 反汇编器** 切换 AT&T / Intel 语法的， ` arm-none-eabi-gdb ` 根本没有这个设置项 —— 启动时会报 ` Undefined set command `，后面的配置虽然还会继续读， 但每次调试都先给你一行红色报错。ARM 的反汇编只有一种语法（统一汇编语言 UAL）， 顺手换成 ` set disassemble-next-line on ` 才是真正有用的： 单步时自动把下一条要执行的指令反汇编出来，配合 ` info registers ` 看汇编和寄存器变化，是调时序问题的主要手段。

 

⚠ SWD 连不上的排查顺序

 

 
1. **目标板没供电？** SWD 需要目标板有电。用万用表量 3.3V。
 
2. **SWDIO/SWCLK 接反？** 最常见。看探针和板子的丝印。
 
3. **代码里禁用了 SWD 引脚？** 如果程序把 PA13/PA14 配成了普通 GPIO 或关掉了 AFIO 时钟， 上电后就无法连接了。 *解法：` monitor reset halt ` 在程序运行前抢占， 或者用 ` connect under reset ` 模式。*
 
4. **低功耗模式把调试单元关了？** 进入 STOP/STANDBY 后 SWD 失效。 需要配置 ` DBGMCU_CR ` 让调试单元在低功耗下保持工作。
 
5. **芯片读保护（RDP）被开启？** 需要先解除读保护（会全片擦除）。
 
6. **看门狗在复位循环？** 程序反复重启，GDB 刚连上就被复位。 用 ` monitor reset halt ` 后先禁用看门狗。

 

```zhizhan-anchor
ch8-2-1
```



### 8.2.1 三条把 printf 送出来的通道：semihosting / ITM / RTT

 

调试时你迟早会想"让板子把看到的东西打出来"。但 **"用什么通道把字节送出去"这件事有三条完全不同的路， 它们经常被混为一谈**  —— 尤其常见的是把 semihosting 和 ITM 当成同一回事。 实际上两者的原理刚好相反：一个是"停下来求调试器帮忙"，一个是"用一个专用引脚自己往外发"。

 

```zhizhan-table
{"rows":[[{"body":"通道","header":true,"rowSpan":1,"colSpan":1},{"body":"怎么打通","header":true,"rowSpan":1,"colSpan":1},{"body":"代价","header":true,"rowSpan":1,"colSpan":1},{"body":"适用与坑","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**semihosting  \n半主机**","header":false,"rowSpan":1,"colSpan":1},{"body":"链接时加 ` --specs=rdimon.specs `（不是 nosys！），启动时调一次 ` initialise_monitor_handles() `，GDB 侧执行 ` monitor arm semihosting enable `。","header":false,"rowSpan":1,"colSpan":1},{"body":"**每次调用都停内核** ，一次 printf 几十万周期，慢几个数量级","header":false,"rowSpan":1,"colSpan":1},{"body":"只适合\"救急、临时看一眼\"：不需要 SWO 线、不需要 RTT 代码，只要调试器连着就行。 **绝不能留在量产固件里**  —— 没有调试器时半主机指令会直接挂死程序。 **它和 ITM 是两条独立通道** ，` semihosting enable ` 不等于开 ITM","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**ITM / SWO**","header":false,"rowSpan":1,"colSpan":1},{"body":"需要把芯片的  **SWO 引脚** （F1 上是 PB3）接出来；固件里开 ` DEMCR.TRCENA ` \\+  **` ITM_TCR.ITMENA `**  \\+ TPIU（` LAR ` 解锁、` ACPR ` 波特率预分频、` SPPR=NRZ `），然后往 ` ITM_STIM0 ` 写字节。","header":false,"rowSpan":1,"colSpan":1},{"body":"快（微秒级）， **基本不停内核**","header":false,"rowSpan":1,"colSpan":1},{"body":"STM32 上 IDE（CubeIDE/Keil）的 \"SWV\" 窗口走的就是它。最常见的\"照抄后一个字都看不到\"原因是 **只开了 DEMCR 没开 ITMENA** ，或者 ACPR 波特率没配（SWO 和 SWD 共用时钟，但 trace 流要单独定速）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**SEGGER RTT**","header":false,"rowSpan":1,"colSpan":1},{"body":"目标端编进一小段（约 500 字节 RAM 的环形缓冲 \\+ 几个函数），探针在后台用 DMA 扫这块内存，` SEGGER_RTT_printf(0, …) ` 写进去，J-Link/OpenSDA 的 RTT Viewer 显示出来。","header":false,"rowSpan":1,"colSpan":1},{"body":"**最快** （纳秒级写入），不用 SWO 引脚","header":false,"rowSpan":1,"colSpan":1},{"body":"实践中最常用的 printf 替代：不占额外引脚、不休内核、掉电重启也能重连。前提是探针支持（J-Link 原生、ST-Link 需 OpenOCD 的 rtt 支持）。 **量产固件里也常留着它做现场日志** （写进 RAM 缓冲，读不读都不影响运行）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

一句话分清：semihosting 是"停下来求人"，ITM/RTT 是"自己往外发"

 

` monitor arm semihosting enable ` 打开的是 **半主机** 通道 —— 程序执行到 ` printf ` 时会触发一条特殊指令（` BKPT `），  **把 CPU 交给调试器** ，由调试器在主机上完成输出，然后才继续。所以它慢、而且没有调试器就挂死。 ITM 和 RTT 则是固件 **主动把字节写进一个硬件 FIFO / RAM 缓冲** ， 探针在旁边收 —— CPU 不必停。  
  
 也因此，"我开了 semihosting，怎么 SWV 窗口没输出"这类问题本身就是个伪命题：  **它们不是同一个窗口、不是同一条线、不是同一个开关。**

 

```zhizhan-anchor
ch8-2-2
```



### 8.2.2 OpenOCD 配置文件：把上面那一长串命令固化下来

 

每次手敲 ` -f interface/stlink.cfg -f target/stm32f1x.cfg ` 很累，而且项目里总有那么两三行"少了就连不上"。 标准做法是把它写成一个项目自带的 ` openocd.cfg `。 下面这张表列的是 **真正会出问题的那几行** ，以及它们各自防的是什么。

 

| 在 ` openocd.cfg ` 里写 | 为什么需要它 / 删掉会怎样 |
| --- | --- |
| ` source [find interface/stlink.cfg] ` | 加载探针驱动。用 J-Link 就换成 ` jlink.cfg `。找不到界面文件是最常见的启动失败 |
| ` transport select swd ` | 选定 SWD（两根线）而不是 JTAG。 **探针和芯片两端必须一致** ；不一致的表现是"能识别探针、但找不到目标" |
| ` adapter speed 1000 ` | SWD 时钟 kHz。速度调太高在长排线/差板子上会不稳，表现为连接时断时续； **连不上时先降到 100**  是标准急救动作 |
| ` source [find target/stm32f1x.cfg] ` | 加载目标芯片描述（Flash 算法、寄存器布局）。 **换型号必须换这个文件** ，否则烧录地址和 Flash 扇区全错 |
| ` reset_config srst_only srst_nogate ` | 只用 NRST 引脚复位、不联动其他信号。板子只引出了 SRST 时就必须这么配，否则 OpenOCD 会去动它没有的信号 |
| ` reset_config … connect_assert_srst ` | **救砖的关键一行。** 它在"复位仍被拉住"的状态下建立连接 —— 专门对付"程序一跑起来就把 SWD 引脚改成了 GPIO / 进了低功耗"导致再也连不上的情况。没有它，你只能靠手速或运气抢在程序改引脚之前连上 |
| ` -c "program fw.elf verify reset exit" ` | 命令行一次完成"烧录 \+ 校验 \+ 复位 \+ 退出"。` exit ` 少了这条，OpenOCD 烧完会一直挂着不退，脚本里就卡死 |
| ` -c "init; reset init" ` | 只连接、复位、跑芯片初始化脚本，用于"先手工确认能连上" |

 

⚠ 连不上时，先按这个顺序怀疑（比反复插拔线快）

 

 
1. **目标板供电** ：SWD 不提供电源，量一下 3.3V。
 
2. **SWDIO/SWCLK 接反或接错** ：发生率最高，看丝印比看感觉靠谱。
 
3. **adapter speed 太高** ：降到 ` 100 ` 再试。
 
4. **芯片被程序改成了"不允许调试"** ：加 ` connect_assert_srst `，用"复位期间连接"抢占。
 
5. **RDP 读保护或低功耗把调试单元关了** ：需要先解除保护（会全片擦除），或用 ` DBGMCU_CR ` 让调试在低功耗下保持。

 

```zhizhan-anchor
ch8-2-3
```



### 8.2.3 连接可靠性：连不上、连一半、一连就断

 

"调试器连不上"是最消磨士气的问题之一，因为它会挡住所有其他工作。按症状分成三类，处理方式完全不同：

 

| 症状 | 常见原因（按概率） | 处理 |
| --- | --- | --- |
| **完全连不上** | 目标没供电 / SWDIO·SWCLK 接反 / 探针驱动或固件问题 / 目标把 SWD 引脚改成了 GPIO / 进了低功耗 | 量电压→核对线序→` adapter speed ` 降到 100→加 ` connect_assert_srst `（复位期间连接）；` DBGMCU_CR ` 让调试在低功耗下保持 |
| **连上一半就失败** | SWD 速度太高 / 排线过长 / 目标时钟没起来（有些探针需要目标时钟） | 降速；缩短线、加地线；确认目标时钟树已配好 |
| **一连就断 / 反复复位** | 看门狗在复位循环 / 程序一运行就改调试引脚 / 欠压复位 | ` monitor reset halt ` 后 **先禁看门狗** ；或 ` connect_assert_srst ` 抢在程序改引脚之前连上 |

 

◆ 两个"救砖"思路

 

 
- **复位期间连接（connect under reset）** ：让芯片一直处于复位，CPU 不跑，你就一定能读到它、并擦除/重写导致连不上的那版固件。
 
- **掏空（mass erase）** ：实在连不上时，用探针的 mass erase 把整片擦掉（OpenOCD 的 ` stm32f1x mass_erase 0 ` 或工具里的 "full chip erase"）。 *代价是丢了 Flash 内容 —— 但砖也就救回来了。*

 

⚠ 预防胜于救砖

 

出厂的固件 **不要永久关闭调试口** ；如果产品需要保护，至少保留一个"上电后短暂窗口"可连， 或保留一条"恢复固件"的进入方式。 *否则一旦现场程序跑飞，你连进去改的机会都没有。*

 

```zhizhan-anchor
ch8-3
```



## 8.3 HardFault 定位：解剖崩溃现场

 

HardFault 是 Cortex-M 上最常见的"跑飞"表现，也是最容易让人束手无策的。 但它 **其实非常有信息量** ——硬件在进入异常前，把现场完整压进了栈里。

 

**FIG 8.3**  进入 HardFault 时，硬件自动压栈的 8 个寄存器

 

```zhizhan-figure
<svg viewBox="0 0 660 340" width="660" height="340" role="img" aria-label="HardFault 栈帧">
          <!-- 栈布局 -->
          <text x="24" y="22" class="sv-lbl-dim">低地址（SP 指向这里）</text>

          <rect x="24" y="32" width="300" height="34" rx="4" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="38" y="53" class="sv-lbl-hi" style="fill:var(--red)">R0</text>
          <text x="200" y="53" class="sv-lbl-dim" style="font-size:10px">SP + 0x00</text>

          <rect x="24" y="70" width="300" height="34" rx="4" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="38" y="91" class="sv-lbl-hi" style="fill:var(--red)">R1</text>
          <text x="200" y="91" class="sv-lbl-dim" style="font-size:10px">SP + 0x04</text>

          <rect x="24" y="108" width="300" height="34" rx="4" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="38" y="129" class="sv-lbl-hi" style="fill:var(--red)">R2</text>
          <text x="200" y="129" class="sv-lbl-dim" style="font-size:10px">SP + 0x08</text>

          <rect x="24" y="146" width="300" height="34" rx="4" fill="var(--red-d)" stroke="var(--red)"></rect>
          <text x="38" y="167" class="sv-lbl-hi" style="fill:var(--red)">R3</text>
          <text x="200" y="167" class="sv-lbl-dim" style="font-size:10px">SP + 0x0C</text>

          <rect x="24" y="184" width="300" height="34" rx="4" fill="var(--line)" stroke="var(--line-2)"></rect>
          <text x="38" y="205" class="sv-lbl-hi">R12</text>
          <text x="200" y="205" class="sv-lbl-dim" style="font-size:10px">SP + 0x10</text>

          <rect x="24" y="222" width="300" height="34" rx="4" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="38" y="243" class="sv-lbl-hi" style="fill:var(--amb)">LR（返回地址）</text>
          <text x="200" y="243" class="sv-lbl-dim" style="font-size:10px">SP + 0x14</text>

          <rect x="24" y="260" width="300" height="40" rx="4" fill="var(--grn-d)" stroke="var(--grn)" stroke-width="1.6"></rect>
          <text x="38" y="281" class="sv-lbl-hi" style="fill:var(--grn)">PC（出错指令地址）★</text>
          <text x="200" y="284" class="sv-lbl-dim" style="font-size:10px">SP + 0x18</text>

          <rect x="24" y="304" width="300" height="30" rx="4" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="38" y="324" class="sv-lbl-hi" style="fill:var(--cyn)">xPSR</text>
          <text x="200" y="324" class="sv-lbl-dim" style="font-size:10px">SP + 0x1C</text>

          <!-- 右侧说明 -->
          <rect x="344" y="32" width="298" height="130" rx="7" class="sv-grn-s"></rect>
          <text x="360" y="54" class="sv-lbl-hi" style="fill:var(--grn)">PC 就是答案</text>
          <text x="360" y="76" class="sv-lbl-dim" style="font-size:10.5px">栈帧里的 PC 是"出错的那条指令"的地址。</text>
          <text x="360" y="94" class="sv-lbl-dim" style="font-size:10.5px">把这个值喂给 addr2line，直接得到</text>
          <text x="360" y="112" class="sv-lbl-dim" style="font-size:10.5px">源码文件名和行号：</text>
          <text x="360" y="136" style="font-family:var(--mono);font-size:10.5px;fill:var(--grn)">arm-none-eabi-addr2line -e fw.elf \</text>
          <text x="360" y="152" style="font-family:var(--mono);font-size:10.5px;fill:var(--grn)">&nbsp;&nbsp;-f -C 0x08000abc</text>

          <rect x="344" y="176" width="298" height="158" rx="7" class="sv-red-s"></rect>
          <text x="360" y="198" class="sv-lbl-hi" style="fill:var(--red)">判断故障类型的四个寄存器</text>
          <text x="360" y="220" style="font-family:var(--mono);font-size:10.5px;fill:var(--cyn)">CFSR &nbsp;0xE000ED28</text>
          <text x="360" y="238" class="sv-lbl-dim" style="font-size:10px">bit[7:0] MMFSR @+0 — 内存管理（MPU）</text>
          <text x="360" y="254" class="sv-lbl-dim" style="font-size:10px">bit[15:8] BFSR @+1 — 总线错误（非法地址）</text>
          <text x="360" y="270" class="sv-lbl-dim" style="font-size:10px">bit[31:16] UFSR @+2 — 用法错误（除零/非对齐）</text>
          <text x="360" y="292" style="font-family:var(--mono);font-size:10.5px;fill:var(--cyn)">HFSR &nbsp;0xE000ED2C</text>
          <text x="360" y="310" class="sv-lbl-dim" style="font-size:10px">bit1 = FORCED（升级上来的），bit30 = VECTTBL</text>
          <text x="360" y="328" style="font-family:var(--mono);font-size:10.5px;fill:var(--cyn)">MMFAR / BFAR — 出错的访问地址</text>
        </svg>
```

 

**关键点：栈帧里的 PC 不是 HardFault\_Handler 的地址，而是引发故障的那条指令的地址。**  这就是为什么下面那个 handler 能从栈里"挖出"崩溃位置。

 

hardfault.c — 一个能自救的 HardFault 处理器（直接可用） C

 

```text
/**
 * 一个生产级的 HardFault 处理器
 *
 * 功能：
 *   ① 从栈帧中提取出错时的 PC / LR 和全部寄存器
 *   ② 解码 CFSR/HFSR，用人话说明故障原因
 *   ③ 通过串口输出（或写入备份寄存器，复位后可读回）
 *   ④ 停在死循环里，等待调试器连接查看现场
 *
 * 用法：把 HardFault_Handler 替换成你自己的（见文件末尾）
 */

#include <stdint.h>
#include <stdio.h>

/* ============ 系统控制块寄存器 ============ */
#define SCB_CFSR        (*(volatile uint32_t *)0xE000ED28UL)
#define SCB_HFSR        (*(volatile uint32_t *)0xE000ED2CUL)
#define SCB_MMFAR       (*(volatile uint32_t *)0xE000ED34UL)
#define SCB_BFAR        (*(volatile uint32_t *)0xE000ED38UL)
/* CFSR 名义上是一个 32 位寄存器，实际上由【三个子寄存器拼起来】。
   小端序下，位域和字节地址的对应关系是这样的：

     0xE000ED28  bit[7:0]    MMFSR   内存管理错误   → 读 1 字节 (uint8_t)
     0xE000ED29  bit[15:8]   BFSR    总线错误       → 读 1 字节 (uint8_t)
     0xE000ED2A  bit[31:16]  UFSR    用法错误       → 读 2 字节 (uint16_t) ★

   ★ UFSR 占 16 位，跨越字节 +2 和 +3，所以它必须用 uint16_t 读。
     ⚠ 写成 uint8_t 是个非常隐蔽的 bug：只会拿到 UFSR 的低 8 位
     （UNDEFINSTR / INVSTATE / INVPC / NOCP），
     而高 8 位里的 UNALIGNED(bit8) 和 DIVBYZERO(bit9) 永远读不出来 ——
     偏偏这两个是现场最常撞上的。代码不报错，只是"这两个故障从来不出现"。
     用 CMSIS 时对应 SCB->CFSR 的位域成员，道理一样。 */
#define SCB_CFSR_UFSR   (*(volatile uint16_t *)0xE000ED2AUL)   /* bit[31:16] */
#define SCB_CFSR_BFSR   (*(volatile uint8_t  *)0xE000ED29UL)   /* bit[15:8]  */
#define SCB_CFSR_MMFSR  (*(volatile uint8_t  *)0xE000ED28UL)   /* bit[7:0]   */

/* ============ 栈帧结构：硬件自动压入的 8 个寄存器 ============
   ⚠ 这个结构体只描述【基本帧】，也就是 8 个字（32 字节）。
   它并不总是完整的，有两种情况会让它"看起来对不上"：

   ① FPU 扩展帧
      如果芯片带 FPU（Cortex-M4F / M7）而且出错时正在用浮点，
      硬件会额外压入 18 个字：S0–S15 + FPSCR + 1 个保留字，
      总共 26 个字 = 104 字节。压的是哪一种，由 EXC_RETURN 的 bit4 决定：
         bit4 = 1  → 基本帧（8 字）
         bit4 = 0  → 扩展帧（26 字）
      好消息是扩展的 18 个字压在【低地址】，所以 r0/r1/.../xPSR 这 8 个字的
      相对位置不变，这个结构体照样能用；但如果要 dump 全部现场就得一并处理。
      （典型的坑：handler 里用了浮点，编译器为了省事只保存 S0-S15 的一部分，
        在延迟压栈 lazy stacking 下极易出错。HardFault handler 里别碰 float。）

   ② 8 字节对齐填充
      CCR.STKALIGN 复位默认是 1，硬件入栈前会把 SP 对齐到 8 字节边界。
      如果入栈前 SP 只对齐到 4 字节，硬件会先垫 4 个字节再压帧。
      这 4 个字节没有对应的"寄存器"，但整个帧跟着往下移了一格，
      表现出来就是"读出来的 r0 其实是 r1"。
      判断办法：看栈上 xPSR 的 bit9（SPREALIGN），置位就说明这次垫过。 */
typedef struct {
    uint32_t r0;
    uint32_t r1;
    uint32_t r2;
    uint32_t r3;
    uint32_t r12;
    uint32_t lr;        /* 返回地址（出错前最后调用的位置）*/
    uint32_t pc;        /* ★ 出错指令地址 */
    uint32_t xpsr;      /* bit9 = SPREALIGN，标记入栈时有没有做 8 字节对齐 */
} hf_stack_frame_t;

/* ============ 故障类型的可读解释 ============ */
typedef struct {
    uint32_t bit;
    const char *name;
    const char *desc;
} fault_desc_t;

static const fault_desc_t g_mmfsr_bits[] = {
    { 0,  "IACCVIOL",    "指令访问违规：跳到了 MPU 不允许执行的区域" },
    { 1,  "DACCVIOL",    "数据访问违规：读写被 MPU 保护的区域" },
    { 3,  "MUNSTKERR",   "出栈时内存管理错误" },
    { 4,  "MSTKERR",     "入栈时内存管理错误（栈溢出常见症状）" },
    { 7,  "MMARVALID",   "MMFAR 中的地址有效" },
};

static const fault_desc_t g_bfsr_bits[] = {
    { 0,  "IBUSERR",     "取指令总线错误" },
    { 1,  "PRECISERR",   "精确数据总线错误：访问了不存在的地址（空指针/野指针）" },
    { 2,  "IMPRECISERR", "不精确总线错误：写缓冲延迟报告，PC 可能已前进" },
    { 3,  "UNSTKERR",    "出栈总线错误" },
    { 4,  "STKERR",      "入栈总线错误：栈指针跑到了非法区域" },
    { 7,  "BFARVALID",   "BFAR 中的地址有效" },
};

static const fault_desc_t g_ufsr_bits[] = {
    { 0,  "UNDEFINSTR",  "未定义指令：PC 跑飞或执行了数据" },
    { 1,  "INVSTATE",    "无效状态：试图在 Thumb 芯片上执行 ARM 指令（函数指针 LSB=0）" },
    { 2,  "INVPC",       "无效 PC：异常返回时 PC 值非法" },
    { 3,  "NOCP",        "协处理器不存在：用了 FPU 但没使能（见下）" },
    { 8,  "UNALIGNED",   "非对齐访问（默认只在 LDM/STM、LDRD/STRD 或开了 CCR.UNALIGN_TRP 时才报）" },
    { 9,  "DIVBYZERO",   "除零（要先把 CCR.DIV_0_TRP 置 1 才会报；否则除零静默得 0）" },
    /* 注意：这两个位在 UFSR 的【高 8 位】，必须用 uint16_t 读 UFSR 才看得见 */
};

/* ============ 解码并打印 ============ */
static void decode_faults(void)
{
    uint32_t cfsr = SCB_CFSR;

    if (!cfsr) {
        /* CFSR 全 0 但进了 HardFault → 通常是 FORCED 或向量表问题 */
        uint32_t hfsr = SCB_HFSR;
        if (hfsr & (1UL << 30)) {
            log_puts("  HFSR.VECTTBL: 向量表读取失败（VTOR 配置错误？）\r\n");
        }
        if (hfsr & (1UL << 1)) {
            log_puts("  HFSR.FORCED: 由其他 fault 升级而来（但 CFSR=0，检查是否 enable 了那些 fault）\r\n");
        }
        return;
    }

    log_puts("  ---- 故障原因 ----\r\n");

    /* 用法错误（UFSR 是 16 位，别用 uint8_t，否则 bit8/bit9 永远读不到）*/
    uint16_t ufsr = SCB_CFSR_UFSR;
    for (size_t i = 0; i < sizeof g_ufsr_bits / sizeof g_ufsr_bits[0]; i++) {
        if (ufsr & (1u << g_ufsr_bits[i].bit)) {
            log_puts("  [UFSR] "); log_puts(g_ufsr_bits[i].name);
            log_puts(": "); log_puts(g_ufsr_bits[i].desc); log_puts("\r\n");
        }
    }

    /* 总线错误 */
    uint8_t bfsr = SCB_CFSR_BFSR;
    for (size_t i = 0; i < sizeof g_bfsr_bits / sizeof g_bfsr_bits[0]; i++) {
        if (bfsr & (1u << g_bfsr_bits[i].bit)) {
            log_puts("  [BFSR] "); log_puts(g_bfsr_bits[i].name);
            log_puts(": "); log_puts(g_bfsr_bits[i].desc); log_puts("\r\n");
        }
    }
    if (bfsr & (1u << 7)) {
        log_printf("  出错的访问地址 BFAR = 0x%08lX\r\n", (unsigned long)SCB_BFAR);
    }

    /* 内存管理错误 */
    uint8_t mmfsr = SCB_CFSR_MMFSR;
    for (size_t i = 0; i < sizeof g_mmfsr_bits / sizeof g_mmfsr_bits[0]; i++) {
        if (mmfsr & (1u << g_mmfsr_bits[i].bit)) {
            log_puts("  [MMFSR] "); log_puts(g_mmfsr_bits[i].name);
            log_puts(": "); log_puts(g_mmfsr_bits[i].desc); log_puts("\r\n");
        }
    }
    if (mmfsr & (1u << 7)) {
        log_printf("  出错的访问地址 MMFAR = 0x%08lX\r\n", (unsigned long)SCB_MMFAR);
    }
}

/* ============ 主处理器 ============ */
/* 必须用 naked 属性：编译器不生成任何序言/尾声，我们自己管理栈 */
__attribute__((naked))
void HardFault_Handler(void)
{
    __asm__ volatile (
        "tst   lr, #4              \n"   /* 检查 EXC_RETURN 的 bit2 */
        "ite   eq                  \n"   /* 判断异常前用的是 MSP 还是 PSP */
        "mrseq r0, msp             \n"   /* bit2=0 → 用的主栈 MSP */
        "mrsne r0, psp             \n"   /* bit2=1 → 用的进程栈 PSP */
        "mov   r1, lr              \n"   /* 把 EXC_RETURN 传给第二个参数 */
        "b     hardfault_report    \n"   /* 跳到 C 函数（不返回）*/
    );
}

/* 这个函数不再返回 —— 打印后死循环等调试器 */
void hardfault_report(hf_stack_frame_t *frame, uint32_t exc_return)
{
    /* 为什么这里可以放心用栈、放心调函数？
       ⚠ 不是因为上面那段汇编"切了栈"——它一个字节的栈都没动，
         只是把 MSP 或 PSP 的【值】读进 r0，当第一个参数传进来而已。

       真正的原因是 Cortex-M 的硬件规则：
         · 线程模式（普通代码、RTOS 任务）可以用 MSP，也可以用 PSP；
         · 但只要进入异常/中断，也就是 Handler 模式，就【只能】用 MSP。
       我们现在正处在 Handler 模式，SP 天然就是 MSP，与故障发生在
       线程模式还是别的异常里无关。

       所以上面那段汇编的职责只是"找到出事现场的那个栈"，
       然后把它当作一个普通的指针传进来。r0 指向的栈，和此刻正在用的栈，
       很可能是两个不同的栈 —— 这正是我们想要的效果：
       一边用 MSP 安稳地跑打印代码，一边读着 PSP 里那份崩溃现场。 */

    __asm__ volatile ("cpsid i" ::: "memory");   /* 关中断，避免二次故障 */

    log_puts("\r\n");
    log_puts("========================================\r\n");
    log_puts("  !!! HARD FAULT !!!\r\n");
    log_puts("========================================\r\n");

    log_printf("EXC_RETURN  = 0x%08lX\r\n", (unsigned long)exc_return);
    log_printf("栈指针来源  = %s\r\n",
               (exc_return & 4) ? "PSP（RTOS 任务栈）" : "MSP（主栈/中断）");

    log_puts("---- 寄存器现场 ----\r\n");
    log_printf("R0  = 0x%08lX   R1  = 0x%08lX\r\n",
               (unsigned long)frame->r0, (unsigned long)frame->r1);
    log_printf("R2  = 0x%08lX   R3  = 0x%08lX\r\n",
               (unsigned long)frame->r2, (unsigned long)frame->r3);
    log_printf("R12 = 0x%08lX\r\n", (unsigned long)frame->r12);
    log_printf("LR  = 0x%08lX   ← 谁调用了出错的函数\r\n", (unsigned long)frame->lr);
    log_printf("PC  = 0x%08lX   ← ★ 出错的指令地址（用 addr2line 查行号）\r\n",
               (unsigned long)frame->pc);
    log_printf("xPSR= 0x%08lX\r\n", (unsigned long)frame->xpsr);

    decode_faults();

    /* ---- 崩溃现场快照存入备份寄存器，复位后可读回 ---- */
    /* 设备在现场自动复位时，串口日志可能来不及看完，甚至根本没人在看。
       把最关键的两个值塞进备份寄存器，下次启动时一进门就能打印出来。

       ⚠ 注意系列差异，别照抄网上的代码：
         · F4 / F7 / H7：RTC->BKP0R、RTC->BKP1R（32 位，挂在 RTC 下）
         · F1 / F0     ：BKP->DR1、BKP->DR2（16 位，独立外设，只有 DR1..DR10）

       这是 F1 的写法（DRx 只有 16 位，所以 PC 要拆成两半存）： */
    /* bkp_unlock();   // 见 7.5 节：先开 BKPEN/PWREN 时钟，再置 PWR_CR.DBP 解锁
       BKP->DR1 = 0x5A5A;                                  // 魔数：区分"真写过"和"上电随机值"
       BKP->DR2 = (uint16_t)(frame->pc & 0xFFFFUL);        // PC 低 16 位
       BKP->DR3 = (uint16_t)(frame->pc >> 16);             // PC 高 16 位
       BKP->DR4 = (uint16_t)(SCB_CFSR & 0xFFFFUL);        // 故障类型（CFSR 低 16 位）
       PWR->CR &= ~PWR_CR_DBP;                            // 上锁
     */

    log_puts("----------------------------------------\r\n");
    log_puts("下一步：\r\n");
    log_printf("  arm-none-eabi-addr2line -e firmware.elf -f -C 0x%08lX\r\n",
               (unsigned long)frame->pc);
    log_puts("  或用 GDB: info line *0x"); /* 地址 */
    log_puts("\r\n");
    log_puts("典型原因对照：\r\n");
    log_puts("  PRECISERR + BFAR 接近 0x00000000 → 空指针解引用\r\n");
    log_puts("  PRECISERR + BFAR 是随机值       → 野指针 / 未初始化指针\r\n");
    log_puts("  STKERR / MSTKERR                 → 栈溢出（加大栈，查大局部数组）\r\n");
    log_puts("  UNDEFINSTR / INVSTATE            → 函数指针为 NULL 或 LSB=0\r\n");
    log_puts("  UNALIGNED                        → 指针类型转换后非对齐访问\r\n");
    log_puts("  DIVBYZERO                        → 除数为 0（M3/M4/M7；且需 CCR.DIV_0_TRP=1 才会报）\r\n");
    log_puts("  NOCP                             → 用了浮点但没使能 FPU\r\n");
    log_puts("  无 CFSR 位 + 循环重启            → 看门狗 / 供电跌落\r\n");
    log_puts("----------------------------------------\r\n");

    /* ---- 停在死循环：调试器可以连上查看完整现场 ---- */
    for (;;) {
        /* 这里不能返回！返回会再次触发故障 */
        __asm__ volatile ("nop");
    }
}

/* ============================================================
   在 startup 文件或链接时替换默认处理器

   ① 汇编方式（startup_stm32f103xb.s）：
      把 .weak HardFault_Handler 那一行注释掉，
      或者在你的代码里直接定义同名函数（强符号会覆盖 weak 符号）

   ② 如果用了 FreeRTOS，任务里崩溃时用的是 PSP：
      上面的 handler 已经处理了这种情况（检查 EXC_RETURN bit2）

   ③ 想看"是哪个任务"崩的：
      extern TaskHandle_t xTaskGetCurrentTaskHandle(void);
      char *name = pcTaskGetName(NULL);
      log_printf("崩溃于任务: %s\r\n", name);
   ============================================================ */
```

 

✔ 五类 HardFault 的快速判断表

 

```zhizhan-table
{"rows":[[{"body":"寄存器特征","header":true,"rowSpan":1,"colSpan":1},{"body":"最可能原因","header":true,"rowSpan":1,"colSpan":1},{"body":"排查动作","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` BFSR.PRECISERR `  \nBFAR ≈ ` 0x00000000 `","header":false,"rowSpan":1,"colSpan":1},{"body":"**空指针解引用**","header":false,"rowSpan":1,"colSpan":1},{"body":"` addr2line ` 查出错行，检查该行的指针参数。看返回值是否忘了检查","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` BFSR.PRECISERR `  \nBFAR 是随机值","header":false,"rowSpan":1,"colSpan":1},{"body":"**野指针 / 未初始化指针**","header":false,"rowSpan":1,"colSpan":1},{"body":"用 ` watch ` 盯住该指针变量；检查是否用了已 ` free ` 的内存","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` BFSR.STKERR ` 或 ` MMFSR.MSTKERR `","header":false,"rowSpan":1,"colSpan":1},{"body":"**栈溢出**","header":false,"rowSpan":1,"colSpan":1},{"body":"查大局部数组（\\>256 字节）、深递归、` printf `。加大栈或改静态分配","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` UFSR.INVSTATE `","header":false,"rowSpan":1,"colSpan":1},{"body":"**函数指针 LSB=0**","header":false,"rowSpan":1,"colSpan":1},{"body":"Cortex-M 只跑 Thumb，函数指针最低位必须是 1。检查是否把数据地址当函数调用了","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` UFSR.UNALIGNED `","header":false,"rowSpan":1,"colSpan":1},{"body":"**非对齐访问**","header":false,"rowSpan":1,"colSpan":1},{"body":"检查 ` uint8_t* ` 强转 ` uint32_t* ` 后解引用。  *用 ` memcpy ` 代替类型双关* 。   \n⚠  **注意平台差异** ：M0/M0\\+ 上任何非对齐访问都必挂； M3/M4 反而\"宠\"你 —— ` LDR `/` STR ` 的字和半字 **硬件就支持非对齐** ，默认静默地算对。 在这类核上看到 UNALIGNED，基本只有三种可能： 用到了 ` LDM/STM ` 或 ` LDRD/STRD `、 有人打开了 ` CCR.UNALIGN_TRP `、或者你正跑在 M0 上","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` CFSR = 0 ` 且反复重启","header":false,"rowSpan":1,"colSpan":1},{"body":"**看门狗 / 供电问题**","header":false,"rowSpan":1,"colSpan":1},{"body":"不是软件崩溃。查 ` RCC_CSR ` 的复位标志；用示波器看电源纹波","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ 寄存器读出来"错位一格"？先排这两件事，再怀疑 handler

 

上面这个 handler 在 F103（Cortex-M3，没有 FPU）上可以直接用。但换到 F4/F7/H7 这类带 FPU 的板子上， 如果解出来的 ` pc ` 明显荒谬，先别改 handler ——  **九成是下面两件事之一** ：

 

 
1. **压的是 FPU 扩展帧，而不是基本帧。**  带 FPU 的核在出错时可能多压 18 个字（S0–S15 \+ FPSCR \+ 1 个保留字）， 合计 26 字 = 104 字节。查 ` EXC_RETURN ` 的  **bit4** ： ` 1 ` = 基本帧（8 字），` 0 ` = 扩展帧（26 字）。 好在多出来的字压在 **低地址** ，` r0 `…` xPSR ` 的相对顺序不变， 所以本节这个 ` hf_stack_frame_t ` 照样能读出正确的值； 只是如果想 dump 全部现场，就得按扩展帧的布局再往里偏 18 个字。   
     *顺带一条硬规矩：HardFault handler 里不要写 ` float `。 一旦 handler 自己也用浮点，在延迟压栈（lazy stacking）机制下极易引发二次故障， 然后你就什么都看不到了。*
 
2. **硬件在帧前面垫了 4 个字节。**  ` CCR.STKALIGN ` 复位默认是 1，硬件入栈前会把 SP 对齐到 8 字节边界； 如果入栈前 SP 只对齐到 4 字节，它会先垫 4 个字节。 这 4 个字节不对应任何寄存器，但整个帧跟着往下移一格， 症状就是"读出来的 ` r0 ` 其实是 ` r1 `"。 判断办法：看栈上 ` xPSR ` 的  **bit9（SPREALIGN）** ，置位就说明这次垫过。
 

 

**一分钟排查法** ：先把 ` EXC_RETURN ` 和 ` xPSR ` 原样打出来， 照 bit4 和 bit9 确认帧格式，再动手解 ` pc `。 这两步都做完还错位，才轮到怀疑 handler 本身。

 

⚠ 把不精确的总线错误变成精确的

 

` IMPRECISERR `（不精确总线错误）是最难查的——因为写缓冲的存在，  **硬件报告故障时 PC 已经往前走了好几条指令** ，栈里的 PC 指向的位置和真正的出错点无关。   
  
  **解法** ：临时关闭写缓冲，强制每条存储指令立即完成，让错误变精确。 在 SystemInit 里加：   
  
 ` SCB->ACTLR |= (1UL << 1);  // DISDEFWBUF = 1，禁用默认写缓冲 `   
  
 只在调试时开——它会让每条存储指令都等到真正完成，明显降低性能，但能把"不精确"变"精确"。  *这个技巧很多工程师不知道，能省下大量排查时间。*    
  
  **⚠ 但它是有限定范围的，照抄到别的芯片上会静默失效：**

 

 
- **只有 Cortex-M3 / M4 的 ACTLR bit1 是 DISDEFWBUF。**  复位后 ACTLR 的值是芯片厂商设定的（有的芯片默认就已经关了写缓冲）， 所以先读出来确认再改。
 
- **Cortex-M0 / M0\+ 没有这一位** （M0 系列的 ACTLR 只有很少几位可控， 而且这个写缓冲本来就不存在）。写进去不报错，但毫无作用。
 
- **Cortex-M7 的 ACTLR 位定义完全不同** （bit1 不是 DISDEFWBUF）， 在 STM32F7 / H7 上照抄这一行，改的是一个无关的开关。
 
- **它只改变"存储指令什么时候算完成"** ，也就是只对写操作触发的 总线错误有效。对 **取指总线错误、以及读操作** 引起的故障没有任何帮助—— 那两类本来就是精确的或者由别的机制报告。
 

 

一句话： **它是 M3/M4 上的临时调试开关，不是通用配置** 。 查完这个问题记得改回去。

 

```zhizhan-anchor
ch8-3-1
```



### 8.3.1 从异常发生到 handler：硬件替你做的那几步

 

理解这条路径，"栈帧怎么摆""LR 为什么长那样"就不再是死记硬背。异常到来时， **硬件自动完成** ：

 

 
1. 把 8 个寄存器压入 **当时正在使用的栈** （Handler 模式固定用 MSP，任务用 PSP）：R0–R3、R12、LR、PC、xPSR。
 
2. 从向量表取出异常处理函数的地址，装入 PC。
 
3. 把 ` LR ` 设成一个特殊的 ` EXC_RETURN ` 值（不是普通返回地址）。
 
4. 更新 ` IPSR `（当前异常号）等状态。
 

 

| 概念 | 要点 |
| --- | --- |
| **` EXC_RETURN `** | handler 返回时把它写回 PC，硬件据此"出栈并回到被打断的地方"。它的低位编码了关键信息： **bit4**  表示"入栈的是否含 FPU 扩展帧"、bit3 表示"返回后用哪个栈（MSP/PSP）"、bit2 表示"返回线程还是 handler"。 *这就是为什么裸写 handler 返回时要小心恢复 LR* 。 |
| **尾链 / 迟到** | "尾链"：一个异常返回时若还有挂起的异常，硬件直接跳过去，不做出栈\+入栈。 "迟到"：高优先级异常在低优先级异常入栈过程中到来，硬件会改用新异常的向量、复用已压好的栈。 *这解释了为什么"某些中断组合下栈用量比预期小"。* |
| **handler 里该做** | 不要依赖 C 编译器之外的假设；用 ` __get_IPSR() ` 判断当前异常号；naked/汇编 handler 里若改了寄存器，必须完整恢复（尤其 LR）。 |

 

```zhizhan-anchor
ch8-3-2
```



### 8.3.2 栈帧的两种情形：基本帧与 FPU 扩展帧

 

"栈帧对不上"是很多人手工解析 HardFault 时的第一道坎，根源几乎都在这里：  **带 FPU 的核在特定条件下会压入的寄存器更多** 。

 

| 情形 | 压栈字数 | 内容 |
| --- | --- | --- |
| **基本帧** | 8 字（32 字节） | R0, R1, R2, R3, R12, LR, PC, xPSR（入栈顺序即按此从低地址到高地址） |
| **FPU 扩展帧** | 26 字（104 字节） | 基本帧 8 字 \+ 保留字 \+ FPSCR \+ S0–S15 \+ 填充（视对齐而定，见下） |

 

 
- **什么时候是扩展帧** ：核启用 FPU 且触发异常时"浮点上下文需要保存"（由 ` FPCCR ` 的 ` ASPEN/LSPEN ` 等控制）。判断方法是看 ` EXC_RETURN ` 的 bit4。
 
- **8 字节对齐填充** ：AAPCS 要求异常入口时栈 8 字节对齐。若压栈前 SP 未对齐，硬件会 **插入 4 字节填充** ，并在 ` xPSR ` 的 bit9 标记"有填充"。
 
- **于是"栈帧对不上"的典型原因** ：① 你按基本帧 8 字去读，实际是 FPU 26 字；② 你忽略了 4 字节对齐填充；③ 异常发生在异常/handler 里（嵌套），用的是 MSP 而非 PSP。 *先把这三点排掉，再怀疑 handler 写错。*
 

 

✔ 稳健的做法：别手工数，交给工具/代码

 

§8.3 的 ` hardfault_report() ` 已经用 ` tst lr, #4 / ite eq / mrseq / mrsne ` 正确选出了"被压栈时用的是哪个栈"，并打印 ` EXC_RETURN `。  **把帧布局的判断写进这段代码里** （并考虑 FPU 扩展帧与对齐填充），比每次手工推演可靠得多。

 

```zhizhan-anchor
ch8-4
```



## 8.4 静态分析：在编译期抓 bug

 

最好的 bug 是 **永远不会被写进去的 bug** 。静态分析工具在你不运行代码的情况下找出问题， 零运行时开销，应该集成到 CI 里。

 

| 工具 | 特点 | 典型能抓到的问题 |
| --- | --- | --- |
| **编译器警告** | 零成本，必须全开 | 未使用变量、隐式类型转换、可疑的 ` if ` 赋值、格式化字符串不匹配 |
| ` cppcheck ` | 快、轻量、专门针对 C/C\+\+ | 数组越界、内存泄漏、空指针解引用、未初始化变量、重复代码 |
| ` clang-tidy ` | 基于 AST，规则可配置 | 现代 C 惯用法、性能问题、可读性、` bugprone-* ` 系列规则很强 |
| ` clang --analyze ` | **路径敏感** 的符号执行 | 能追踪跨函数的 NULL 传播、资源泄漏路径。误报少但慢 |
| ` -fanalyzer `（GCC 10\+） | GCC 内置的路径分析 | 双重释放、` use-after-free `、空指针。ARM GCC 也有 |
| **MISRA / CERT 检查器** | 行业规范（汽车/医疗必备） | 规范符合性。工具如 ` PC-lint `、` Axivion `、` Helix QAC ` |

 

bash静态分析实战

 

```text
# ============ ① 编译器警告：最低成本，必须全开 ============
$ arm-none-eabi-gcc -c app.c -o /dev/null \
    -Wall -Wextra -Wshadow -Wconversion -Wsign-conversion \
    -Wcast-align -Wpointer-arith -Wstrict-prototypes \
    -Wmissing-prototypes -Wmissing-declarations -Wundef \
    -Wdouble-promotion -Wformat=2 -Wswitch-enum -Wswitch-default \
    -Wnull-dereference -Wduplicated-cond -Wlogical-op \
    -Wjump-misses-init -Wnested-externs -Wbad-function-cast

app.c:47:23: warning: conversion from 'int' to 'uint8_t' may change value [-Wconversion]
   47 |     buf[i] = sensor_value;     ← sensor_value 是 int，可能超过 255
      |              ^~~~~~~~~~~~
app.c:83:12: warning: declaration of 'i' shadows a previous local [-Wshadow]
   83 |     for (int i = 0; ...)       ← 外层已有一个 i，极易搞错
app.c:112:5: warning: converting a float to double [-Wdouble-promotion]
  112 |     printf("%f", my_float);     ← float 被提升为 double，MCU 上代价高

# ============ ② cppcheck ============
$ cppcheck --enable=all --inconclusive --std=c11 \
    --platform=unix32 --suppress=missingIncludeSystem \
    -I Inc -I Drivers/CMSIS/Include Src/

Checking Src/uart.c ...
Src/uart.c:156:9: error: Array 'rx_buf[64]' accessed at index 64, which is out of bounds.
    rx_buf[rx_idx] = byte;
        ^
← cppcheck 抓到了 off-by-one！这类 bug 人工审查极难发现

Src/protocol.c:89:5: warning: Variable 'frame_len' is assigned a value that is never used.
Src/ringbuf.c:203:12: style: The scope of the variable 'tmp' can be reduced.
Src/sensor.c:311:9: error: Null pointer dereference: cfg

# ============ ③ GCC 的 -fanalyzer（跨函数路径分析）============
$ arm-none-eabi-gcc -fanalyzer -c sensor.c -o /dev/null

sensor.c:88:1: warning: double-'free' of 's' [-Wanalyzer-double-free]
   88 |     free(s);
      |     ^~~~~~
  'sensor_destroy': events 1-6
    |   80 | sensor_t *s = sensor_get_default();
    |      |                  ^~~~~~~~~~~~~~~~~~ (1) 这里分配
    |   84 |     if (err) free(s);            (4) 第一次释放
    |   88 |     free(s);                       (5) 第二次释放 ← 双重释放！
← 路径敏感的符号执行，能发现人工审查漏掉的跨分支问题

# ============ ④ clang-tidy ============
$ clang-tidy Src/*.c -- -I Inc --target=arm-none-eabi

# ============ ⑤ 集成到 Makefile ============
# analyze: 不对产物做检查，只报告问题
# cc-check: 用 clang 编译（比 gcc 警告更多）做交叉验证

$ cat >> Makefile <<'EOF'
.PHONY: analyze
analyze:
	cppcheck --enable=all --inconclusive --std=c11 \
	         --suppress=missingIncludeSystem \
	         $(C_INCLUDES) Src/
	@echo "静态分析完成"
EOF
```

 

◆ ` -Wconversion ` 是嵌入式最重要的一条警告

 

MCU 上到处都是 ` uint8_t ` 寄存器、` uint16_t ` 计数器、` int ` 的隐式提升。  **但要有心理准备：打开它的一瞬间会涌出几百条警告，其中噪音占比不低 —— 别指望一次性清零。**    
  
 真正值得先动手的是 **截断类** ：赋值和传参时"宽的装进窄的"， 这一类才是会静默丢数据、且最难定位的。 典型场景：` buf[i] = adc_value; ` 其中 ` adc_value ` 是 12 位（0-4095）， ` buf ` 是 ` uint8_t ` 数组——编译不报错，但超过 255 的值被静默截断。  *这类 bug 在调试时表现为"数据偶尔不对"，极难定位。*    
  
 另一大块噪音来自` int ` 与` unsigned ` 的整数提升， 在小端 MCU 上往往 **结果本来就正确** ，只是类型规则恰好如此。 这类可以用 ` -Wno-sign-conversion ` 或就地 ` (uint8_t) ` 显式转换收掉。   
  
  **建议** ：新项目一开始就开，先把 **截断类** 修完，其余按文件、按模块逐步收敛； 老项目只在新增/改动的文件上开，避免一次改几千行把真正的隐患淹掉。

 

```zhizhan-anchor
ch8-4-1
```



### 8.4.1 编译器告警实战解读：哪几条真的在救你

 

编译器告警几十种，但真正高价值的就那么几条。下表按"实际危害"排序 —— 其中 ` -Wconversion ` 在嵌入式里排第一，因为 **隐式截断是头号隐蔽 bug** （数据范围、id、长度、时间戳被无声截掉）。

 

```zhizhan-table
{"rows":[[{"body":"告警","header":true,"rowSpan":1,"colSpan":1},{"body":"典型代码","header":true,"rowSpan":1,"colSpan":1},{"body":"为什么危险","header":true,"rowSpan":1,"colSpan":1},{"body":"修法","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` -Wconversion `  \n` -Wsign-conversion `","header":false,"rowSpan":1,"colSpan":1},{"body":"` uint16_t n = len; `（len 是 int）","header":false,"rowSpan":1,"colSpan":1},{"body":"悄悄截断高位；负值传给无符号量变成巨大正数","header":false,"rowSpan":1,"colSpan":1},{"body":"显式转换并 **先做范围检查** ；统一用 ` uintN_t ` 家族","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wsign-compare `","header":false,"rowSpan":1,"colSpan":1},{"body":"` if (i < len) `（i 是 int、len 是 size\\_t）","header":false,"rowSpan":1,"colSpan":1},{"body":"混符号比较，负值被当成巨大无符号数，判断反向","header":false,"rowSpan":1,"colSpan":1},{"body":"两边同类型；或显式转成有符号并确保非负","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wshadow `","header":false,"rowSpan":1,"colSpan":1},{"body":"内层变量名与外层重名","header":false,"rowSpan":1,"colSpan":1},{"body":"你以为在改外层，其实改的是内层副本","header":false,"rowSpan":1,"colSpan":1},{"body":"改名；用 ` -Wshadow ` 常开","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wcast-align `","header":false,"rowSpan":1,"colSpan":1},{"body":"` (uint32_t *)(buf + 1) `","header":false,"rowSpan":1,"colSpan":1},{"body":"产生非对齐指针，解引用在 M0 上挂、M3/M4 上依赖具体访问","header":false,"rowSpan":1,"colSpan":1},{"body":"用 ` memcpy ` 到对齐变量；或用 ` __packed ` 但知晓代价","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wmaybe-uninitialized `  \n` -Wuninitialized `","header":false,"rowSpan":1,"colSpan":1},{"body":"某条分支没赋初值就用","header":false,"rowSpan":1,"colSpan":1},{"body":"读到栈上的随机值，行为不确定","header":false,"rowSpan":1,"colSpan":1},{"body":"初始化；复查所有路径","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Warray-bounds `","header":false,"rowSpan":1,"colSpan":1},{"body":"常量下标越界","header":false,"rowSpan":1,"colSpan":1},{"body":"越界读写相邻内存","header":false,"rowSpan":1,"colSpan":1},{"body":"检查下标范围；配合 ` _Static_assert `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wreturn-local-addr `","header":false,"rowSpan":1,"colSpan":1},{"body":"返回栈上局部数组地址","header":false,"rowSpan":1,"colSpan":1},{"body":"悬垂指针","header":false,"rowSpan":1,"colSpan":1},{"body":"改 ` static `、由调用方传缓冲、或返回堆内存（慎用）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wformat ` / ` -Wformat-security `","header":false,"rowSpan":1,"colSpan":1},{"body":"` printf(\"%d\", (long)x) `；` printf(s) `","header":false,"rowSpan":1,"colSpan":1},{"body":"格式串与实参类型不匹配 → 读到错误宽度/越界；格式串漏洞","header":false,"rowSpan":1,"colSpan":1},{"body":"用 ` %ld `/` PRIdxx ` 宏；` printf(\"%s\", s) `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wdouble-promotion `","header":false,"rowSpan":1,"colSpan":1},{"body":"` float f; printf(\"%f\", f); `","header":false,"rowSpan":1,"colSpan":1},{"body":"` float ` 被提升为 ` double `，在无 FPU 的核上拉入软双精度库，体积与耗时暴涨","header":false,"rowSpan":1,"colSpan":1},{"body":"注意 ` float ` 算术；必要时用 ` -fsingle-precision-constant `","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wstrict-prototypes `  \n` -Wmissing-prototypes `","header":false,"rowSpan":1,"colSpan":1},{"body":"` void f(); `（空参数列表）","header":false,"rowSpan":1,"colSpan":1},{"body":"在 C 里表示\"参数未知\"，不是\"无参数\"，类型不安全","header":false,"rowSpan":1,"colSpan":1},{"body":"` void f(void) `；给每个非 static 函数一个原型","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -Wundef `","header":false,"rowSpan":1,"colSpan":1},{"body":"` #if FOO ` 但 FOO 未定义","header":false,"rowSpan":1,"colSpan":1},{"body":"未定义宏按 0 处理，条件判断常反","header":false,"rowSpan":1,"colSpan":1},{"body":"用 ` #if defined(FOO) `；对配置宏统一给默认值","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ ` -Wconversion ` 一开就几百条，怎么办

 

这是正常的，不是"工具太严"。治理顺序： **先只看"赋值/传参/返回"处的截断（真正会产生错误的）， 再管纯运算中的提升告警** 。老代码可以按 §8.11.4 的"增量清零 \+ 基线冻结"来推进。 千万别因为嫌吵就把它关掉 —— 它挡住的问题，恰恰是最难在运行期发现的。

 

```zhizhan-anchor
ch8-5
```



## 8.5 运行时检测：让 bug 自己暴露

 

静态分析找不到的 bug，就需要在运行时主动检测。这些都是 **零成本或极低成本的机制** ， 但能在关键时刻给出关键信息。

 

runtime\_check.c — 五种运行时检测机制 C

 

```text
/* ============================================================
   ① 栈使用量监测：知道"还剩多少栈"
   ------------------------------------------------------------
   方法：启动时把整个栈区填成特定图案，运行一段时间后
        检查图案被破坏到哪里 —— 就知道栈用过的最深位置。
   ============================================================ */
#include <stdint.h>
#include <string.h>
#include "ringbuf.h"    /* 6.4 的环形缓冲区：下面 rb_put_dbg 要用 */
#include "error.h"      /* ASSERT */
#include "log.h"        /* log_printf / log_error */

extern uint32_t _sstack;        /* 链接脚本提供：栈底（低地址）*/
extern uint32_t _estack;        /* 链接脚本提供：栈顶（高地址）*/

/* 这两个符号的定义方式见模块 4.4 的 STM32F103C8T6.ld，就两行：
       _estack = ORIGIN(RAM) + LENGTH(RAM);
       _sstack = _estack - _Min_Stack_Size;

   ⚠ 不要在这里再另起一个 ._user_stack 段把 _sstack / _estack 重新赋值一遍。
     链接脚本里同一个符号被赋值两次，链接器会用后出现的那个覆盖前一个，
     症状是"栈哨兵填到了错误的位置"或者"填到一半就停"，
     而链接阶段一声不吭。
     （有些 CubeMX 模板确实走"独立栈段"那套写法 —— 那就把这两句挪进那个段里，
       但全工程只能有一处定义。）*/

#define STACK_FILL_PATTERN  0xC0DEFACEUL

/* 在 main 最开始调用（此时栈用得还很少）*/
void stack_monitor_init(void)
{
    uint32_t *p = &_sstack;
    uint32_t *top = (uint32_t *)((uint32_t)&_estack - 64);  /* 留 64 字节给当前调用 */

    while (p < top) {
        *p++ = STACK_FILL_PATTERN;
    }
}

/* 返回栈的峰值使用量（字节）*/
uint32_t stack_get_peak_usage(void)
{
    uint32_t *p = &_sstack;
    uint32_t *top = (uint32_t *)&_estack;

    while (p < top && *p == STACK_FILL_PATTERN) {
        p++;
    }

    /* 从找到的第一个"被破坏"的位置到栈顶的距离 = 峰值使用量。

       ⚠ 但必须特判 p == top 这个边界，否则会写出一个"越灾难越报平安"的 bug：
       如果整个填充区都被写过（一个 STACK_FILL_PATTERN 都不剩），
       循环会一路走到 p == top，此时 top - p = 0 ——
       "栈已经彻底用满、下一步就要踩到 .bss"这个最危险的场景，
       会被打印成 peak=0/1024 (0%)，看起来比谁都安全。

       所以 p == top 时返回 total，而不是 0。 */
    if (p == top) {
        return (uint32_t)((uint32_t)top - (uint32_t)&_sstack);   /* 全被踩过 → 100% */
    }
    return (uint32_t)((uint32_t)top - (uint32_t)p);
}

/* 在低优先级任务或定时器里定期调用 */
void stack_report(void)
{
    uint32_t peak = stack_get_peak_usage();
    uint32_t total = (uint32_t)&_estack - (uint32_t)&_sstack;
    uint32_t pct = (uint32_t)((uint64_t)peak * 100 / total);

    log_printf("STACK: peak=%lu/%lu bytes (%lu%%)",
               (unsigned long)peak, (unsigned long)total, (unsigned long)pct);

    if (pct > 80) {
        log_error("栈使用率超过 80%%，有溢出风险！");
    }
}

/* ============================================================
   ② MPU 保护：让越界访问立即触发异常
   ------------------------------------------------------------
   没有 MPU 时，栈溢出会静默覆盖 .bss 里的全局变量 ——
   表现为"某个不相关的变量莫名变了值"，极难定位。
   配置 MPU 后，越界瞬间触发 MemManage Fault。
   ============================================================ */

/* ⚠ 地址要记准：SHCSR 在 0xE000ED24，MPU_CTRL 在 0xE000ED94。
   这两个差得很远，写成同一个地址是很常见的笔误 ——
   而写错的后果是"配置看上去成功了，实际一个字都没生效"。 */
#define SCB_SHCSR       (*(volatile uint32_t *)0xE000ED24UL)
#define MPU_CTRL        (*(volatile uint32_t *)0xE000ED94UL)
#define MPU_RNR         (*(volatile uint32_t *)0xE000ED98UL)
#define MPU_RBAR        (*(volatile uint32_t *)0xE000ED9CUL)
#define MPU_RASR        (*(volatile uint32_t *)0xE000EDA0UL)
#define MPU_RASR_ENABLE (1UL << 0)
#define MPU_RASR_SRD_OFF 8
#define MPU_RASR_SIZE_OFF 1
#define MPU_RASR_AP_OFF 24
#define MPU_RASR_XN     (1UL << 28)
#define MPU_CTRL_ENABLE (1UL << 0)
#define MPU_CTRL_PRIVDEFENA (1UL << 2)

#define GUARD_SIZE      256UL
#define GUARD_SIZE_LOG2 8                   /* log2(256)；RASR.SIZE = log2 - 1 = 7 */

/* 把【栈底下方的】一段区域设为"不可访问"（哨兵区）
   ------------------------------------------------------------
   哨兵区放哪里，是这段代码唯一需要动脑的地方。
   栈在 RAM 的最高端向下生长，.bss/.data/.heap 在低端。所以：

     ✕ 放在 .bss 起始处 —— 那是 RAM 的低端，和栈隔着几十 KB，
       栈要往下长几十 KB 才会碰到它。程序一般在碰到它之前早就
       把 .bss 里的全局变量踩烂了，你只会看到一个莫名其妙的
       MemManage Fault，还以为是自己代码写错了。更要命的是：
       这个哨兵本身就让 .bss 变成"不可访问"，
       于是程序第一次读写全局变量就会崩 —— 你测到的是
       "我配了哨兵"，而不是"我栈溢出了"。

     ✔ 放在紧贴栈底的下方 —— 栈只要多长 4 个字节，第一脚就踩在哨兵上，
       当场触发异常。这才是我们想要的。

   还有一个必须注意的点：MPU 要求区域基址按【区域大小】对齐。
   256 字节的区域，基址必须是 256 字节对齐 —— 所以要用 ~(256-1) 而不是
   ~31（32 字节）。用 32 字节对齐去配 256 字节的区域，硬件会按自己的
   N 值把低位丢掉，算出来的区域和你以为的不是同一块。 */
void mpu_guard_init(void)
{
    /* 区域下界：从 _sstack 往下退一个区域，再向下对齐到 256 字节 */
    uint32_t guard_base = ((uint32_t)&_sstack - GUARD_SIZE) & ~(GUARD_SIZE - 1UL);

    MPU_RNR  = 0;                                   /* 使用 0 号区域 */
    MPU_RBAR = guard_base;                          /* 只写地址：bit4 VALID=0，用 RNR 选区域 */
    /* SIZE = 7 → 256 字节（SIZE 字段编码的是 log2(大小) - 1）
       AP   = 0 → 特权/非特权都不可读写访问
       XN   = 1 → 不可执行 */
    MPU_RASR = (7UL << MPU_RASR_SIZE_OFF)
             | (0UL << MPU_RASR_AP_OFF)
             | MPU_RASR_XN
             | MPU_RASR_ENABLE;

    /* ⚠ 不开 MemManage 异常，MPU 违规不会进 MemManage_Handler，
       而是直接升级成 HardFault（你会看到 HFSR.FORCED=1、CFSR.MMFSR 有值）。
       想看到"内存管理错误"这个准确的分类，就必须开这一位。 */
    SCB_SHCSR |= (1UL << 16);                      /* MEMFAULTENA */

    /* 改 MPU 配置属于"改系统状态"，必须补屏障：
       DSB 保证前面的寄存器写已经落到硬件，ISB 清掉流水线里已取的旧指令 */
    __asm__ volatile ("dsb" ::: "memory");
    __asm__ volatile ("isb" ::: "memory");

    MPU_CTRL |= MPU_CTRL_ENABLE;
    MPU_CTRL |= MPU_CTRL_PRIVDEFENA;   /* 特权模式默认可以访问其他区域 */

    __asm__ volatile ("dsb" ::: "memory");
    __asm__ volatile ("isb" ::: "memory");
}

/* 还需要在 MemManage_Handler 里做和 HardFault 一样的报告
   （可以复用 8.3 的 hardfault_report，只是换个入口）
   小技巧：MemManage_Handler 里同样读 CFSR 的 MMFSR，如果看到
   MSTKERR/MUNSTKERR 且 MMFAR 落在哨兵区，那就实锤是栈溢出了。 */

/* ============================================================
   ③ 断言：把"假设"变成"检查"
   ------------------------------------------------------------
   见 Module 07 的 error.h。这里强调使用原则：
   ============================================================ */

/* ✔ 好的断言：检查内部不变量，违反 = 程序有 bug
   ringbuf_t 就是 6.4 里那个结构体（buf/size/mask/head/tail/overflow），
   这里写的是它的"调试版" —— 逻辑和 rb_put 一样，只是把隐含前提
   写成了显式检查。发布版换回 rb_put，调试版用这个。 */
void rb_put_dbg(ringbuf_t *rb, uint8_t v)
{
    ASSERT(rb != NULL);                     /* 调用方违反了契约 */
    ASSERT(rb->mask + 1u == rb->size);       /* 不变量：mask 必须等于 size-1 */
    ASSERT(rb->head < rb->size);             /* 内部状态被破坏了 */
    ASSERT(rb->tail < rb->size);
    ASSERT(rb_count(rb) <= rb->mask);        /* 元素个数不可能超过容量 */
    /* ... 之后就是 6.4 里 rb_put 的写入逻辑 ... */
}

/* ✕ 坏的断言：检查外部输入 —— 外部输入应该用错误码处理，不是断言 */
void handle_uart(uint8_t byte)
{
    /* ASSERT(byte < 0x80);  ← 错！噪声数据可能给出任意值，
                                这不是程序 bug，是正常情况。
                                应该：if (byte >= 0x80) { discard; return; } */
}

/* ============================================================
   ④ 看门狗：最后一道防线
   ============================================================ */

#define IWDG_KR     (*(volatile uint32_t *)0x40003000UL)
#define IWDG_PR     (*(volatile uint32_t *)0x40003004UL)
#define IWDG_RLR    (*(volatile uint32_t *)0x40003008UL)
#define IWDG_SR     (*(volatile uint32_t *)0x4000300CUL)

void watchdog_init(uint32_t timeout_ms)
{
    /* STM32 独立看门狗，时钟源是内部 40 kHz LSI（与主时钟独立，
       即使主时钟挂了看门狗仍然工作）*/

    IWDG_KR = 0x5555;                   /* 解除寄存器写保护 */

    /* ⚠ 独立看门狗的 PR / RLR 不是普通寄存器：
       你写进去的值要经过 LSI 时钟域同步才会真正生效，
       在同步完成之前【再写一次会被直接丢弃】。
       SR 里有两个"忙"标志，必须各自等：
         bit0 PVU — 预分频寄存器更新中
         bit1 RVU — 重装载寄存器更新中
       只等 PVU 不等 RVU，是这段代码最常见的漏写：
       表面上没报错，实际 RLR 还是旧值（复位值是 0xFFF = 4095），
       超时时间和你算的完全不是一回事。 */
    IWDG_PR = 4;                        /* 预分频 64 → 625 Hz */
    while (IWDG_SR & (1UL << 0)) { }     /* 等 PVU（预分频更新完成）*/

    /* 重装载值。⚠ RLR 只有 12 位，最大 4095，别算超了还不自知。
       LSI 标称 40 kHz，但数据手册给的实测范围是 30~60 kHz，
       也就是说同样的配置，实际超时时间可能有 ±50% 的漂移。
       看门狗超时宁可留足余量，不要贴着临界值设计。 */
    uint32_t reload = (40000UL / 64UL) * timeout_ms / 1000UL;
    if (reload > 4095UL) reload = 4095UL;      /* 钉死在 12 位上限 */
    if (reload == 0)     reload = 1;
    IWDG_RLR = reload;
    while (IWDG_SR & (1UL << 1)) { }     /* 等 RVU（重装载更新完成）★ 别漏这条 */

    IWDG_KR = 0xCCCC;                   /* 启动看门狗 */
    IWDG_KR = 0xAAAA;                   /* 首次喂狗 */
}

void watchdog_feed(void)
{
    IWDG_KR = 0xAAAA;
}

/* ⚠ 关键：看门狗必须检测"所有关键任务都跑了"，
   而不是在主循环里无脑喂狗 —— 那样任务卡死了看门狗也照样喂 */

typedef struct {
    uint32_t task_bitmap;               /* 每个任务一个 bit，置 1 表示本周期已报到 */
    uint32_t expected_mask;             /* 哪些任务是"必须报到"的 */
} wdg_t;

static wdg_t g_wdg;

/* ⚠ 这个初始化函数不能省。
   不初始化的话 expected_mask 是 0（.bss 清零），而 task_bitmap 一开始也是 0，
   于是 wdg_poll 里 0 == 0 恒成立 —— 每个轮次都喂狗，
   看门狗彻底变成摆设。这正是本节开头批判的"无脑喂狗"，
   只不过它伪装成了一个看起来很像监控的机制，比无脑喂狗更危险。

   用法：在启动时告诉它"本系统有哪几个任务参与监控"。
   比如任务号 0/1/2 必须定期报到：
       wdg_init((1UL << 0) | (1UL << 1) | (1UL << 2)); */
void wdg_init(uint32_t expected_mask)
{
    g_wdg.expected_mask = expected_mask;
    g_wdg.task_bitmap   = 0;
    watchdog_feed();                    /* 先喂一次，给任务们留出首个周期 */
}

void wdg_task_done(uint8_t task_id)
{
    g_wdg.task_bitmap |= (1UL << task_id);
}

void wdg_poll(void)
{
    /* 只有在所有【应该报到】的任务都报过之后，才喂狗并清零 */
    if (g_wdg.expected_mask != 0 &&      /* 防空配置：没配就别当成"全到齐" */
        g_wdg.task_bitmap == g_wdg.expected_mask) {
        watchdog_feed();
        g_wdg.task_bitmap = 0;
    }
    /* 否则不喂狗 → 看门狗超时 → 复位。
       这样就检测到了"某个任务卡死" */
}

/* 还可以做得更细一点：把 task_bitmap 也存进备份寄存器，
   这样复位后能直接知道是哪个任务没报到，而不是只知道"被狗咬了"。
   排查效率的差别非常大。 */

/* 复位原因识别：复位后读这个寄存器就知道为什么重启的
   RCC_CSR 的复位标志位（STM32F1，见 RM0008 的 RCC 章）：

     bit31  LPWRRSTF   低功耗模式复位（Standby 唤醒等）
     bit30  WWDGRSTF   窗口看门狗复位
     bit29  IWDGRSTF   独立看门狗复位      ← 现场最关心这个
     bit28  SFTRSTF    软件复位
     bit27  PORRSTF    上电/掉电复位
     bit26  PINRSTF    NRST 引脚复位
     bit24  RMVF       写 1 清除以上全部标志

   ⚠ 两个最容易踩的坑：

   ① 位号整体记错一位。把 bit26 当成"上电复位"，就会把
      "按住复位键"报成"上电复位"，排查方向当场被带偏。
      记法：从高位往低位依次是 LPWR / WWDG / IWDG / SFT / POR / PIN，
      也就是说 PIN 在【最低】位（bit26），POR 在它上面一位。

   ② 这些标志【不会自动清除】，一直残留到下一次复位。
      所以必须在读完之后主动清一次。否则"第一次上电时读到上电标志，
      之后每次看门狗复位也照样读到上电标志"，
      日志会一直骗你，而且骗得很有说服力。
      清除方式：往 RMVF（bit24）写 1，一次清掉全部
      （这些标志不能单独清，只能整体清）。 */
const char *reset_cause_str(void)
{
    #define RCC_CSR (*(volatile uint32_t *)0x40021024UL)

    uint32_t csr = RCC_CSR;

    /* 读完立刻清标志，免得下次复位时又混进旧数据。
       （在调试器里想先看原始值，就把这行注释掉，把 csr 留着慢慢看）*/
    RCC_CSR |= (1UL << 24);            /* RMVF = 1 → 清除全部复位标志 */

    /* 按"越意外越优先"的顺序判断：看门狗 > 软件 > 低功耗 > 引脚 > 上电。
       顺序很要紧 —— 上电复位会连带把别的标志一起留下，
       要是先判 POR，你可能永远看不到真正的原因。 */
    if (csr & (1UL << 29)) return "独立看门狗复位 ★（有任务卡死，或没喂狗）";
    if (csr & (1UL << 30)) return "窗口看门狗复位（喂狗太早或太晚）";
    if (csr & (1UL << 28)) return "软件复位（NVIC_SystemReset 调用的）";
    if (csr & (1UL << 31)) return "低功耗模式复位（Standby 唤醒等）";
    if (csr & (1UL << 26)) return "NRST 引脚复位（按了复位键 / 外部复位芯片）";
    if (csr & (1UL << 27)) return "POR/PDR 上电复位（首次上电，或电压跌落）";
    return "未知";
}

/* ============================================================
   ⑤ 内存填充检测：找出"用了未初始化内存"
   ------------------------------------------------------------
   调试期把 malloc 出来的内存填成 0xAA，如果代码依赖"默认是 0"
   的假设，就会立刻暴露问题。
   ============================================================ */
#include <stdlib.h>     /* malloc / free */

void *debug_malloc(size_t n)
{
    void *p = malloc(n);
    if (p) memset(p, 0xAA, n);          /* 明显的垃圾值 */
    return p;
}

/* 还可以定期扫描 .bss 区，检查有什么地方被意外改了：
   在启动时记录 .bss 的校验和，运行后重算比对，
   不一致 → 有越界写入。 */

extern uint32_t _sbss, _ebss;

uint32_t bss_checksum(void)
{
    uint32_t sum = 0;
    for (uint32_t *p = &_sbss; p < &_ebss; p++) {
        sum = (sum << 1) ^ *p;
    }
    return sum;
}
```

 

```zhizhan-anchor
ch8-5-1
```



### 8.5.1 RTOS 与堆：有一半的"还剩多少"已经被记着了

 

上面那五种机制都是 **自己动手** 填图案、配 MPU、写看门狗。一旦项目上了 RTOS， 有一部分"还剩多少"其实操作系统一直在替你记， **直接读出来就行，不用自己造轮子** ； 但另一半（尤其是堆）反而更危险 —— 因为申请和释放散落在各个任务里，没人说得清"谁把内存吃光了"。

 

| 想知道的事 | 现成接口 | 说明与坑 |
| --- | --- | --- |
| 每个任务的栈用过最深多少 | ` uxTaskGetStackHighWaterMark(NULL) `（NULL = 当前任务） | 返回的是 **"还剩多少个字（word）"** ，不是"用了多少"。越接近 0 越危险。这是设计任务栈大小时唯一的量化依据 —— 别拍脑袋给 512，量完再定 |
| 栈溢出时当场报警 | ` configCHECK_FOR_STACK_OVERFLOW `（1 或 2）\+ ` vApplicationStackOverflowHook() ` | =1 只在任务切换时查栈顶魔数，=2 还查整个栈帧。触发时进 hook， **hook 必须把任务名打出来** ，否则你只知道"有人溢出"、不知道是谁。这正是 Module 04 讲的栈溢出在 RTOS 下的落点 |
| 现在所有任务在干嘛 | ` vTaskList(buf) ` / ` vTaskGetRunTimeStats(buf) ` | 需要打开 ` configUSE_TRACE_FACILITY `（运行时统计还要 ` configGENERATE_RUN_TIME_STATS `）。输出一张"任务状态 \+ 优先级 \+ 栈余量"，是排查"谁在饿死谁"的起点 |
| 堆还剩多少、历史最低多少 | ` xPortGetFreeHeapSize() ` / ` xPortGetMinimumEverFreeHeapSize() ` | ` heap_4 `/` heap_5 ` 才有。 **"历史最低"比"当前剩余"重要得多** ：一次偶发的大分配可能瞬间吃掉一半堆，之后又还回来，只看当前值会完全错过 |
| GDB 里直接看任务 | OpenOCD 加载 RTOS 插件：` -c "… -rtos FreeRTOS" `，然后 ` info threads ` / ` thread apply all bt ` | 没有插件时 ` info threads ` 只知道内核态；加载之后 GDB 能列出每个任务的名字和完整调用栈 ——  **排查"某个任务卡在哪儿"的最快手段** |

 

◆ 裸机 / 自造堆：没有现成接口，就自己在 ` _sbrk ` 里记账

 

RTOS 的堆水位是"查询接口"，裸机直接调 newlib 的 ` malloc ` 就没有这种接口。 唯一的办法是 **在你自己的 ` _sbrk() ` 里记一笔账** ： 每被要一次内存，就把当前游标（也就是堆顶）记进一个全局变量； 于是"堆用了多少、离 ` __HeapLimit ` 还有多远"随时可查。

 

这也是为什么 Module 04 强调"堆的边界是 ` _sbrk ` 说了算"： ` _Min_Heap_Size ` 只是链接期的预留栅栏，真正决定能分配多少的是 ` _sbrk ` 里的上界检查。 不在这里记账，你就只剩"分配返回 NULL 时才知道"这一种（已经很晚的）反馈。

 

```zhizhan-anchor
ch8-5-2
```



### 8.5.2 把检测手段组合成一个自检框架

 

§8.5 前面列的手段不是"选一个用"，而是 **分层组合** 。按触发时机分成三层， 每层解决不同的问题、代价也不同：

 

```zhizhan-table
{"rows":[[{"body":"层次","header":true,"rowSpan":1,"colSpan":1},{"body":"什么时候跑","header":true,"rowSpan":1,"colSpan":1},{"body":"查什么","header":true,"rowSpan":1,"colSpan":1},{"body":"代价","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**上电自检  \n（PBIT）**","header":false,"rowSpan":1,"colSpan":1},{"body":"` main ` 早期、跑业务前","header":false,"rowSpan":1,"colSpan":1},{"body":"固件 CRC、配置区完整性、关键外设回读、RAM/栈填充初始化","header":false,"rowSpan":1,"colSpan":1},{"body":"只在启动时有开销；必须 **足够快** （不能拖慢启动）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**周期自检  \n（CBIT）**","header":false,"rowSpan":1,"colSpan":1},{"body":"低频定时（如 1 s）","header":false,"rowSpan":1,"colSpan":1},{"body":"栈峰值、堆水位、任务报到、参考通道、外部供电电压范围","header":false,"rowSpan":1,"colSpan":1},{"body":"分散在运行期；要 **可裁剪** ，别占太多 CPU","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**错误自检**","header":false,"rowSpan":1,"colSpan":1},{"body":"错误码返回、断言失败、Fault 入口","header":false,"rowSpan":1,"colSpan":1},{"body":"现场落盘（最近日志 \\+ 关键变量 \\+ 备份寄存器）、决定\"停/复位/降级\"","header":false,"rowSpan":1,"colSpan":1},{"body":"只在异常路径；正确性比速度重要","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

◆ 组合原则：把"最贵的检查"放在"最罕见的时刻"

 

上电自检可以重一点（一辈子跑一次），周期自检必须轻（每秒都跑）， 错误自检可以很重但要求绝对可靠（出事才跑，而且可能只跑这一次）。  **把 CRC 全片校验放进每秒的周期自检，就是典型的组合错误**  —— 它会吃掉大量 CPU、还可能反过来制造时序问题。

 

```zhizhan-anchor
ch8-5-3
```



### 8.5.3 更"硬核"的自检：固件完整性、参考通道与双看门狗

 

| 手段 | 检测什么 | 要点与代价 |
| --- | --- | --- |
| **固件 CRC 自检** | Flash 里的代码/常量是否被意外改写（位翻转、写坏、刷一半） | 启动时对代码区算一次 CRC，与烧录时写入的期望值比较。要 **知道 CRC 覆盖范围** （哪些段、怎么填充），否则会误报；全片校验在大固件上有启动耗时 |
| **配置区完整性** | 参数区是否损坏 / 是否被写了一半 | 参数区自带 CRC \+ 版本号 \+ 魔数；损坏时 **回退到出厂默认** 而不是直接用垃圾值（见 §8.15 的"参数损坏回退"） |
| **参考通道自检** | ADC / 传感器读数是否"可信" | 用 ADC 的内部参考通道或已知基准电压周期校对；或用 **冗余传感器两两对拍** （两根温度差超过阈值就报警）。成本是多个通道/器件，换来确定性 |
| **双看门狗** | 任务级卡死 \+ 系统级彻底失控 | IWDG（独立、最可靠，主时钟挂了也能复位）作为最后防线；WWDG 或任务级心跳检测"窗口内必须喂"以更早发现异常。两者职责不同，配合使用 |
| **RAM 自检** | RAM 单元是否物理损坏（关键项目） | 上电时用 March 等算法逐单元读写校验。 **不能自检正在使用的 RAM** （会毁掉自身状态），只能测空闲区或分块测；代价大，通常只在安全相关项目里做 |

 

⚠ 自检本身也会引入状态

 

自检结果（"CRC 不符""参考通道超差"）需要占地方存、并在复位后还能看到 —— 所以要写进 **备份寄存器或保留 RAM** ，并带上"自检轮次/时间"。 否则你只能看到"这次自检失败"，却不知道它 **是第一次还是每次都失败** 。  *自检的价值，一半在"检出了什么"，一半在"能不能被记录下来、被带回去"。*

 

```zhizhan-anchor
ch8-6
```



## 8.6 性能分析：找出时间花在哪

 

嵌入式性能问题往往表现为"时序不对""响应太慢""功耗偏高"。你需要 **测量** ，而不是猜。

 

profiling.c — DWT 周期计数器 \+ GPIO 打点 C

 

```text
/* ============================================================
   ① DWT 周期计数器：最精确的函数耗时测量
   ------------------------------------------------------------
   Cortex-M3/M4/M7 内置的 Data Watchpoint and Trace 单元
   有一个 32 位周期计数器，精度是"1 个 CPU 周期"
   ============================================================ */
#include <stdint.h>
#include "stm32f103xb.h"    /* GPIOB_BSRR / GPIOB_ODR / DWT 相关寄存器 */
#include "log.h"            /* log_printf */

/* 被测对象：一个典型的 DSP 处理函数（端侧 AI 那一卷会具体实现它）。
   这里只需要知道它的签名，测量方法本身与它做什么无关。 */
extern int16_t g_buf[256];
extern void    dsp_process_buffer(int16_t *buf, int n);

/* 下面 control_loop() 里打点的三个函数 —— 控制环里的经典三步。
   它们出自 8.x 的电机/温控实例，实现不在本章，这里同样只声明签名。 */
extern void adc_sample(void);       /* 采样本周期输入 */
extern void pid_compute(void);      /* 算一次 PID */
extern void pwm_update(void);       /* 把结果写进 PWM 寄存器 */

#define DWT_CTRL    (*(volatile uint32_t *)0xE0001000UL)
#define DWT_CYCCNT  (*(volatile uint32_t *)0xE0001004UL)
#define DEMCR       (*(volatile uint32_t *)0xE000EDFCUL)

void dwt_init(void)
{
    DEMCR |= (1UL << 24);           /* TRCENA：使能跟踪 */
    DWT_CYCCNT = 0;
    DWT_CTRL |= (1UL << 0);         /* CYCCNTENA：启动计数器 */
}

static inline uint32_t dwt_get(void)
{
    return DWT_CYCCNT;
}

/* ---- 用法：测量一段代码的周期数 ---- */
void measure_example(void)
{
    uint32_t start, cycles;

    dwt_init();

    start = dwt_get();
    /* ---------- 被测代码 ---------- */
    dsp_process_buffer(g_buf, 256);
    /* ------------------------------ */
    cycles = dwt_get() - start;

    /* 假设 72 MHz：cycles / 72 = 微秒 */
    log_printf("dsp_process: %lu cycles = %lu.%02lu us",
               (unsigned long)cycles,
               (unsigned long)(cycles / 72),
               (unsigned long)((cycles % 72) * 100 / 72));
}

static uint32_t g_total_cycles;

/* ---- 封装成宏，方便到处用 ----
   ⚠ 这里有个宏设计的经典坑，值得停下来看一眼。

   最自然的写法是：
       #define PROFILE_BEGIN()    uint32_t __p_start = dwt_get()
       #define PROFILE_END(name)  ... 用 __p_start ...

   PROFILE_BEGIN 展开出来是一条【声明语句】。于是同一个函数里写三次：

       PROFILE_BEGIN();   →  uint32_t __p_start = dwt_get();
       ...
       PROFILE_BEGIN();   →  uint32_t __p_start = dwt_get();   ← 同一作用域再声明一次

   编译器当场报错：redefinition of '__p_start'。

   那改成每个宏自己开一个块（do{...}while(0)）行不行？也不行 ——
   块一开，被测代码就跑到块外面去了，__p_start 结束时就已经销毁。

   那用 __LINE__ 拼唯一名字呢？BEGIN 和 END 不在同一行，
   两次展开拿到的 __LINE__ 不一样，名字对不上。

   结论：C 里没有干净的办法让一对宏"共用"一个局部变量。
   最务实的做法就是把变量名交给调用方指定 —— 多敲几个字符，
   换来的是任何作用域下都能用、不会有名字冲突、行为一目了然。 */
#define PROFILE_BEGIN(slot)     uint32_t slot = dwt_get()
#define PROFILE_END(name, slot) do {                                      \
        uint32_t __p_cyc = dwt_get() - (slot);                            \
        log_debug("%-20s %8lu cycles", (name), (unsigned long)__p_cyc);   \
        g_total_cycles += __p_cyc;                                        \
    } while (0)

void control_loop(void)
{
    PROFILE_BEGIN(t_adc);
    adc_sample();
    PROFILE_END("adc_sample", t_adc);

    PROFILE_BEGIN(t_pid);
    pid_compute();
    PROFILE_END("pid_compute", t_pid);

    PROFILE_BEGIN(t_pwm);
    pwm_update();
    PROFILE_END("pwm_update", t_pwm);

    /* 控制周期是 1 ms = 72000 周期。
       如果 g_total_cycles 接近这个数 → CPU 已经满载，没有余量了 */
}

/* ============================================================
   ② GPIO 打点 + 逻辑分析仪：看时序关系
   ------------------------------------------------------------
   在函数的入口/出口翻转一个空闲 GPIO，
   用逻辑分析仪（或便宜的 USB 逻辑分析仪）就能看到：
     - 每个函数的执行时间（脉宽）
     - 函数的执行顺序和间隔
     - 中断何时打断主循环（这是 DWT 看不到的！）
   ============================================================ */

#define DEBUG_PIN_HIGH()  (GPIOB_BSRR = (1UL << 0))
#define DEBUG_PIN_LOW()   (GPIOB_BSRR = (1UL << (0 + 16)))
#define DEBUG_PIN_TOGGLE() do {                     \
        if (GPIOB_ODR & 1UL) DEBUG_PIN_LOW();       \
        else                 DEBUG_PIN_HIGH();      \
    } while (0)

void isr_with_marker(void)
{
    DEBUG_PIN_HIGH();               /* 进入中断 → 拉高 */
    /* ... 中断处理 ... */
    DEBUG_PIN_LOW();                /* 退出中断 → 拉低 */
}

/* 在逻辑分析仪上你会看到：
   ┌──────┐          ┌────┐
   │      │          │    │      ← 中断执行时间（脉宽）
───┘      └──────────┘    └─────
   主循环              主循环

   如果中断脉宽 > 主循环周期 → 中断太频繁或太长，CPU 没时间跑主循环

   ⚠ 注意：打点本身有开销（约 2-3 个周期），
     测量极短的函数时会引入明显误差。
     需要精确测量时用 DWT。 */

/* ============================================================
   ③ ITM / SWO：不占串口的 printf
   ------------------------------------------------------------
   Cortex-M3/M4 的 ITM（Instrumentation Trace Macrocell）
   可以把字符直接交给芯片里的调试单元，从 SWO 引脚送出去，
   完全不占用 UART、也不占用中断时间。

   ⚠ 先纠正一个流传很广的说法：SWO 并不是"复用 SWDIO/SWCLK"。
     它是第三条独立的跟踪引脚。标准的 2×5 调试排针上本来就有它
     （第 13 脚），所以你的探针不必额外接线；但 MCU 那一侧的引脚
     必须是空着的 —— STM32F1 上它就是 PB3，和 JTDO 共用。
     板子没把 PB3 引到调试排针 → 这条路直接断掉。
     这正是"配置都对、SWV 窗口就是空白"的头号原因。

   还有：ITM 只在 Cortex-M3/M4/M7 上存在。M0 / M0+ 没有 ITM
     （M0+ 有 DWT，但没有 ITM），那类芯片只能靠 UART 或 GPIO 打点。
   ============================================================ */

/* ---- 相关寄存器（Cortex-M3/M4 上地址固定）---- */
#define ITM_LAR     (*(volatile uint32_t *)0xE0000FB0UL)   /* 解锁 */
#define ITM_TCR     (*(volatile uint32_t *)0xE0000E80UL)   /* 总控制 */
#define ITM_TER     (*(volatile uint32_t *)0xE0000E00UL)   /* 通道使能 */
#define ITM_STIM0   (*(volatile uint32_t *)0xE0000000UL)   /* 通道 0 数据口 */

#define TPIU_LAR    (*(volatile uint32_t *)0xE0040FB0UL)   /* 解锁 */
#define TPIU_CSPSR  (*(volatile uint32_t *)0xE0040004UL)   /* 端口位宽 */
#define TPIU_ACPR   (*(volatile uint32_t *)0xE0040010UL)   /* 波特率分频 */
#define TPIU_SPPR   (*(volatile uint32_t *)0xE00400F0UL)   /* 引脚协议 */
#define TPIU_FFCR   (*(volatile uint32_t *)0xE0040304UL)   /* 格式化 / 冲刷 */

#define TRACE_CLK_HZ    72000000UL     /* 跟踪时钟，这里取 HCLK */
#define SWO_BAUD_HZ      2000000UL     /* 期望的 SWO 速率 */

void itm_init(void)
{
    uint32_t presc = TRACE_CLK_HZ / SWO_BAUD_HZ - 1U;  /* 位率 = 时钟 /(ACPR+1) */

    DEMCR |= (1UL << 24);          /* TRCENA：跟踪总闸，必须先开 */

    /* ---- TPIU：决定 SWO 引脚上"怎么发" ---- */
    TPIU_LAR   = 0xC5ACCE55UL;      /* 解锁 TPIU 寄存器（不写这句后面全部无效）*/
    TPIU_CSPSR = 1UL;               /* 只用 1 位端口 —— SWO 是单根线 */
    TPIU_SPPR  = 0x2UL;             /* 0b10 = NRZ，即异步串行 SWO */
    TPIU_ACPR  = presc;             /* 分频，决定实际波特率 */
    TPIU_FFCR  = 0x100UL;           /* EnFt：打开格式化器，否则收不到完整包 */

    /* ---- ITM：决定"发什么" ---- */
    ITM_LAR = 0xC5ACCE55UL;
    ITM_TCR = (1UL << 0)           /* ITMENA：ITM 总开关 */
            | (1UL << 2)           /* SYNCENA：周期性同步包，主机靠它对齐 */
            | (1UL << 3)           /* TXENA：顺带转发 DWT 的数据包（做剖面时才需要）*/
            | (1UL << 16);         /* TraceBusID = 1：异步模式下这一栏不能是 0 */
    ITM_TER = 1UL << 0;            /* 只开通道 0 */
}

/* ⚠ 上面任何一句漏掉，症状都是"连上了但一片空白"：
     漏 DEMCR.TRCENA    → ITM 整个不工作（最常见的漏项）
     漏 ITM_TCR.ITMENA  → 通道使能了也没用，数据出不了 ITM
     漏 TPIU_SPPR = NRZ → 引脚上跑的是并行同步时序，SWO 端解出来全是垃圾
     ACPR 与实际跟踪时钟不匹配 → 满屏乱码，和 UART 波特率对不上完全一样 */

/* 单字符输出到 ITM：几十个周期，比任何 UART 都快

   读 STIM0：FIFO 满时读回 0，可写时 bit0 为 1。
   下面这种写法是【非阻塞】的 —— FIFO 满了就丢掉这个字符，
   换来的是绝不让调试输出卡住实时任务。
   要保证一个字符都不丢，把 if 换成 while 等它腾出位置即可。 */
static inline void itm_putc(char c)
{
    if (ITM_STIM0 == 0) return;     /* FIFO 满：这一字符直接丢弃 */
    *(volatile uint8_t *)0xE0000000UL = (uint8_t)c;
}

void itm_puts(const char *s)
{
    while (*s) itm_putc(*s++);
}

/* ---- 主机侧怎么收 ----
   SWO 的数据最终要落到某个地方。三条常见路：

   ① STM32CubeIDE / Keil：直接开 SWV / Trace 窗口，填好 CPU 时钟和
      SWO 波特率（要和上面 ACPR 算出来的一致），勾上 ITM 端口 0。
      这是最省事的一条，建议先用它确认硬件通路是通的。

   ② OpenOCD + GDB：先让 OpenOCD 把 TPIU 配成写到一个文件/流，
      再打开 ITM 端口：
          (gdb) monitor tpiu config internal swo.log uart off 72000000 2000000
          (gdb) monitor itm port 0 on
      各版本 OpenOCD 对这些命令的细节有差异，先看 monitor help tpiu。

   ③ J-Link：用 J-Link SWO Viewer，或 GDB 里 monitor swo。

   优点：
     - 不占用 UART，也不占用主循环时间（写入是往 FIFO 里塞）
     - 速率远高于 UART，可以在中断里安全使用
     - 不需要等待发送完成，实时性几乎不受影响
   缺点：
     - 要占用一根【专用的】SWO 引脚（F1 上是 PB3），板子必须把它引出
     - 需要调试器和主机工具配合，链路比 UART 长、更容易配错
     - 只能在连着调试器时用，脱机运行就没有了
   ============================================================ */

/* ============================================================
   ④ 真正的 printf 重定向：让标准库输出到串口
   ------------------------------------------------------------
   用于开发和调试阶段。量产固件应该用日志系统（Module 07）。
   ============================================================ */

/* 你自己的串口发送函数 —— 实现见 6.x 的 UART 章节，
   这里只声明签名（也正好说明：重定向 printf 不需要知道串口怎么配的）*/
extern void uart_putc_blocking(char c);

/* 方法 A：重写 _write（newlib 用这个）*/
#include <sys/stat.h>
#include <unistd.h>

int _write(int file, char *ptr, int len)
{
    (void)file;
    for (int i = 0; i < len; i++) {
        uart_putc_blocking(ptr[i]);     /* 你自己的串口发送函数 */
    }
    return len;
}

/* ⚠ 重定向 printf 的三个注意点：
   ① 会显著增大固件（几 KB 的格式化代码）。用 nano.specs 可以减小
   ② %f 会链接浮点格式化（再加几 KB）。尽量避免
   ③ uart_putc_blocking 是阻塞的。115200 波特率下 100 字节要 8.7 ms！
      在主循环里打日志会严重拖慢实时响应 */

/* 方法 B：用轻量级替代，体积小、速度快 */
void log_int(int32_t v)
{
    char buf[12];
    int i = 0;
    uint32_t u;

    if (v < 0) { itm_putc('-'); u = (uint32_t)(-(int64_t)v); }
    else       { u = (uint32_t)v; }

    do { buf[i++] = (char)('0' + u % 10); u /= 10; } while (u);

    while (i--) itm_putc(buf[i]);
}

void log_hex(uint32_t v)
{
    static const char hex[] = "0123456789ABCDEF";
    itm_puts("0x");
    for (int i = 28; i >= 0; i -= 4) {
        itm_putc(hex[(v >> i) & 0xF]);
    }
}
```

 

✕ 调试本身引入的 bug（海森堡 bug）

 

 
1. **打断点改变了时序** ：用 GDB 暂停会让所有中断延迟， 有些 bug 因此 *消失* （典型的竞态、看门狗复位）。这时要改用 GPIO 打点 \+ 逻辑分析仪，  **因为它是非侵入式的** 。
 
2. **串口打印改变了时序** ：加 ` printf ` 后 bug 不见了—— 因为打印的几毫秒改变了时序。 *这是"时序敏感 bug"的典型特征，不是 bug 修好了。*
 
3. **优化等级变了** ：调试时 ` -O0 `，量产 ` -Os `。  **一定要在量产配置下也测一遍** ——很多 bug 只在优化后出现（见 Module 05）。
 
4. **` volatile ` 破坏了优化** ：为了调试方便给变量都加 ` volatile `， 会阻止编译器优化，代码变慢变大。 *只在确实需要的地方加。*

 

```zhizhan-anchor
ch8-6-1
```



### 8.6.1 性能优化闭环：先测量，再动手，再测量

 

性能优化最容易犯的错误，是 **凭直觉优化"看起来很慢"的地方** 。 真实情况往往是：你以为的热点只占 5%，而某个不起眼的字符串拷贝占了大头。正确顺序永远是四步：

 

| 步骤 | 做什么 | 产出 |
| --- | --- | --- |
| **① 建立基线** | 用 DWT/SysTick 测出"这段现在花多久"，连同条件记录 | 一个可对比的数字（如"处理一帧 3.2 ms"） |
| **② 定位热点** | 分段计时或 GPIO 打点，找出时间主要花在哪几处 | 按耗时排序的清单（前 2~3 项） |
| **③ 只改一处** | 针对最大热点做优化（算法/查表/[DMA](term:dma)/内联/换数据类型） | 一处改动 |
| **④ 重新测量** | 同条件再测，确认真的变快、且没引入新问题 | 新数字 \+ 前后对比 |

 

◆ 一个真实感的例子（数字仅示意，方法才是重点）

 

某采集任务的循环要 5 ms，目标 4 ms。  **凭直觉** 去优化里面的浮点滤波 —— 改了半天只省 0.1 ms。  **先测量** 才发现：真正的大头是循环里每个样本都调了一次 ` printf("%f") ` 打调试日志（软浮点格式化 \+ 阻塞串口），占 3 ms。

 

把日志改成"只记环形缓冲、主循环之外统一输出"之后，直接降到 1.6 ms。  *热点常常不在"算法"里，而在"没人注意的副作用"里 —— 这就是为什么必须测量。*

 

⚠ 优化时最容易踩的三个坑

 

 
- **优化了不常走的分支** ：错误处理、初始化往往只跑一次，快慢无所谓；优化它们收益极低。
 
- **用眼睛数指令数** ：见 §8.12.2 —— 指令数≠周期数。想知道快没快，只有测。
 
- **把优化建立在 UB 上** ：为了快而依赖有符号溢出、类型双关、非对齐访问 —— 换优化等级/换编译器就会崩。这类"优化"是负债。

 

✔ 反过来：什么时候 **不** 该优化

 

如果这段代码 **不是热点** 、又 **很清晰** ，那就别动它。 "为性能牺牲可读性"只有在"它真的是瓶颈"时才划算。 先写对、写清楚；性能不够再按上面的闭环处理 ——  **不要预防性地把代码写复杂** 。

 

```zhizhan-anchor
ch8-6-2
```



### 8.6.2 代码体积与 RAM 占用优化

 

"跑得够快"之外，另一条常见的硬约束是" **放得进** "。Flash 和 RAM 的优化手段不同，别混用：

 

```zhizhan-table
{"rows":[[{"body":"目标","header":true,"rowSpan":1,"colSpan":1},{"body":"手段","header":true,"rowSpan":1,"colSpan":1},{"body":"说明 / 代价","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**省 Flash**   \n（代码体积）","header":false,"rowSpan":4,"colSpan":1},{"body":"` -Os `","header":false,"rowSpan":1,"colSpan":1},{"body":"优化体积；通常比 ` -O2 ` 小 10–20%，少数热点会变慢","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` -ffunction-sections -fdata-sections ` \\+ ` -Wl,--gc-sections `","header":false,"rowSpan":1,"colSpan":1},{"body":"删掉没人引用的函数/数据； **注意 KEEP 向量表与 .init\\_array** （§5.4）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` --specs=nano.specs ` \\+ 去掉 ` %f `","header":false,"rowSpan":1,"colSpan":1},{"body":"格式化引擎是体积大户；换 nano、避免浮点格式化能省几 KB～几十 KB","header":false,"rowSpan":1,"colSpan":1}],[{"body":"用查表代替实时计算","header":false,"rowSpan":1,"colSpan":1},{"body":"把三角函数/对数/CRC 预计算成表（放 Flash）； **代价是表本身占空间** ，且要权衡精度","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**省 RAM**   \n（运行占用）","header":false,"rowSpan":4,"colSpan":1},{"body":"把只读数据标 ` const `","header":false,"rowSpan":1,"colSpan":1},{"body":"让它落 ` .rodata `/Flash，不占 RAM（§2.5）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"复用缓冲区 / 内存池","header":false,"rowSpan":1,"colSpan":1},{"body":"避免\"每功能一个大数组\"；用固定块池或 arena（§4.5）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"位域/位图打包小状态","header":false,"rowSpan":1,"colSpan":1},{"body":"多个布尔状态打包进一个字节； **注意位域的可移植性** （§6.3），跨字节/跨编译器要谨慎","header":false,"rowSpan":1,"colSpan":1}],[{"body":"缩小栈的\"最大深度\"","header":false,"rowSpan":1,"colSpan":1},{"body":"消除深递归、大局部数组改 ` static `；用 §8.5 的峰值测量后 **按实测值定栈大小** ，别拍脑袋","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

◆ 换优化等级前，先建基线

 

` -Os `/` -flto ` 会改变代码行为（尤其暴露 UB 和缺 ` volatile ` 的问题）。 换之前先记下 ` size ` 基线、并 **在目标优化等级下完整回归一遍** 。 "调试用 -Og、发布用 -Os" 的团队，一定要有" **在 -Os 上也跑一遍测试** "这一步 —— 否则会掉进"调试配置能过、发布配置崩"的经典坑（§8.17）。

 

```zhizhan-anchor
ch8-6-3
```



### 8.6.3 中断延迟与实时性测量

 

"响应够不够快"在嵌入式中是可量化的。中断延迟的定义是： **从外设触发中断，到 ISR 的第一条指令开始执行** 之间的时间。 测它只需要一个 GPIO 打点 \+ 一台逻辑分析仪/示波器。

 

| 延迟的组成 | 怎么来的 | 能不能控制 |
| --- | --- | --- |
| **硬件固定延迟** | Cortex-M 入栈、取向量、跳转大约十几个周期（与核实现相关） | 不能，是架构决定的 |
| **当前关中断的时长** | 别的临界区（` __disable_irq ` / 高优先级 ISR）把中断挡住了 | 能 ——  **这是最该优化的部分** ：缩短临界区 |
| **优先级与抢占** | 更高优先级的中断正在处理，你的中断要排队 | 能 —— 合理分配优先级（§6.4 的 BASEPRI 思路） |
| **尾链/迟到** | 硬件优化，往往让"紧接着发生的中断"延迟更小 | 不能，是好事 |

 

✔ 测量方法（两步）

 

 
1. 用一根空余 GPIO 表示"中断触发"：外设触发信号的同时翻转它（可在硬件上用同一个信号，或软件里触发点打点）。
 
2. 在 ISR 的 **第一条指令** 再翻转另一个 GPIO。两个边沿的时间差 ≈ 中断延迟（含打点开销，约几条指令）。

 

⚠ 你要关心的是"最坏情况"，不是"平均值"

 

实时性的判据是 **最坏情况延迟（WCET/worst-case latency）** ，不是平均。 测的时候要让系统 **跑在最大负载下** （所有任务都在忙、DMA 在搬、高优先级中断在发）， 然后看那个最大的时间差。平均值漂亮、最坏值超标，在实时系统里就是不合格。  *这也解释了为什么"关中断时间"必须被当作纪律来审 —— 它是喂给最坏情况的直接输入。*

 

```zhizhan-anchor
ch8-7
```



## 8.7 调试检查清单

 

✔ 遇到问题的排查顺序（按成功率排序）

 

 
1. **确认供电和时钟。** 万用表量电压，示波器看晶振是否起振。  *很多"软件问题"其实是"晶体没起振"或"电压跌落"。*
 
2. **读复位原因寄存器。** ` RCC_CSR ` 会告诉你是不是看门狗复位的。 这一条能省下大量时间。
 
3. **看是不是 HardFault。** 在 ` HardFault_Handler ` 里下断点， 能停住就说明是崩溃，不是逻辑错误。
 
4. **用 ` addr2line ` 定位 PC。** 如果是 HardFault，栈里的 PC 直接指向出错行。
 
5. **检查外设时钟使能。** STM32 上"外设不工作"最常见的原因就是忘了开时钟， 而且 *不会有任何报错* 。
 
6. **读回配置寄存器验证。** 不要假设写入成功了—— 读回 ` GPIOC_CRH ` 确认值真的变了。
 
7. **用 ` watch ` 盯住异常变化的变量。** 让硬件告诉你谁改的， 比读代码猜快得多。
 
8. **二分法缩小范围。** 注释掉一半代码，看问题还在不在。
 
9. **检查栈使用量。** 栈溢出会静默破坏全局变量， 症状是"某个不相关的变量变了值"。
 
10. **在量产优化等级下复现。** 如果 ` -O0 ` 正常 ` -Os ` 出错， 优先怀疑 ` volatile ` 缺失或未定义行为。

 

| 症状 | 最可能的原因 | 验证方法 |
| --- | --- | --- |
| 上电就跑进 HardFault | 向量表位置错 / 栈顶地址错 / 启动代码没拷 .data | 检查链接脚本的 ` _estack ` 和 ` .isr_vector ` 段位置 |
| 程序运行一段时间后复位 | 看门狗超时 / 栈溢出 / 供电跌落 | 读 ` RCC_CSR ` 判断复位源；测栈峰值使用量 |
| 某全局变量莫名变了值 | **栈溢出覆盖**  / 数组越界 / 野指针 | ` watch ` 该变量；查所有写它的地方；检查栈使用量 |
| 外设完全不工作 | 时钟没开 / 引脚被复用占用 / 寄存器配置错 | 读 ` RCC_APBxENR ` 确认时钟位；读回配置寄存器 |
| 中断进不去 | NVIC 没使能 / 优先级分组错 / 标志没清 / 全局中断被关 | 读 ` NVIC_ISER ` 和 ` PRIMASK `；检查中断名是否和向量表一致 |
| 串口乱码 | 波特率不匹配 / 时钟源算错 / 接地不良 | 示波器量一位的时间，反推实际波特率 |
| -O0 正常，-O2 出错 | **volatile 缺失 / 未定义行为** | 对照 Module 02 的 volatile 表；开 ` -fsanitize=undefined `（PC 上） |
| GDB 连不上目标 | SWD 引脚被程序占用 / 低功耗模式 / 看门狗复位循环 | 用 "connect under reset"；检查是否把 PA13/PA14 配成了 GPIO |
| 固件烧进去没反应 | 烧录地址错 / 没烧向量表 / 芯片型号不匹配 | ` compare-sections ` 校验；确认 ` .isr_vector ` 在 ` 0x08000000 ` |

 

```zhizhan-anchor
ch8-7-1
```



### 8.7.1 主动制造一次崩溃：先验证"救援机制"本身管用

 

这一章给了你一堆救援机制 —— HardFault 处理器、栈填充、MPU 哨兵、看门狗、复位原因记录。 但它们有个共同的问题： **你只有在真出故障时才知道它们管不管用** ，而那时候你正焦头烂额。 正确做法是 **故意制造一次故障** ，亲眼看着这套机制把现场交到你手上 —— 这也正是本章开头那句"调试方法也要被调试"的落点。

 

| 故意制造 | 触发什么 | 用途与注意 |
| --- | --- | --- |
| ` __BKPT(0) ` / 内联 ` BKPT 0xAB ` | 调试断点（ **不是**  HardFault） | 验证"断点 \+ ` bt ` \+ 变量查看"这条链路是否顺畅。需要调试器连着 |
| ` __builtin_trap() ` | 非法指令 / trap → 进 HardFault | 验证 HardFault 处理器和 ` addr2line ` 定位链路。比手写野指针更可控 |
| ` __builtin_unreachable() ` | 声明"此处不可能到达" | ⚠ 它不是 trap —— 到达是未定义行为，编译器 **可能顺手删掉你的兜底代码** 。别拿它当错误处理 |
| ` assert(0) ` / ` ASSERT(0) ` | 断言失败 | 验证你的断言实现是"停机 \+ 打印现场"还是"仅记录后继续跑" |
| 读 / 写 ` NULL ` 指针 | MemManage / BusFault →（未开对应 handler 时）升级为 HardFault | 验证 §8.3 的"PC 落点 \+ CFSR 分类"。⚠ 见下面的坑 |
| 函数指针 LSB=0 后调用 | INVSTATE（非法状态） | 验证 §8.3 讲的 Thumb 位判据：正常函数指针最低位是 1，清零就是偶数地址 → INVSTATE |
| M0/M0\+ 上做非对齐 ` LDR ` | UNALIGNED | 验证非对齐访问的判据。⚠  **M3/M4 默认不报** （硬件支持非对齐字访问），别拿它在这两款核上复现 |

 

✕ 陷阱："故意解引用 NULL"会被编译器优化掉

 

GCC 默认认为"解引用 NULL 是未定义行为"，于是它会据此推断"程序执行过 ` *p ` 之后， ` p ` 不可能是 NULL" ——  **把你写的判空、日志、兜底全删掉** 。 结果是你精心设计的"空指针演练"根本没跑到那行，你却以为是处理器没工作。 要做这个演练，编译时加 ` -fno-delete-null-pointer-checks `， 或把指针声明成 ` volatile T * ` 让编译器不敢替你做这个假设。

 

```zhizhan-anchor
ch8-7-2
```



### 8.7.2 故障复盘：把现场留到"下一次上电"

 

设备装在现场、崩了、你不在旁边、也没有调试器。能带回来的，只有 **掉电前写进"不掉电存储"的那几个数** 。 这一章讲的零件本来就是为这件事准备的 —— 把它们串成一条完整链路，才算真正能用于现场：

 

| 环节 | 用什么（本章哪一节） | 留下什么 |
| --- | --- | --- |
| 谁卡死了 | 看门狗多任务喂狗（§8.5 ④） | 任务报到位图 ` task_bitmap ` —— 复位后读出来就知道是哪个任务没报到 |
| 为什么重启 | ` RCC_CSR ` 复位原因标志（§8.5 ④） | 复位类型（看门狗 / 软件 / 上电 / 引脚…）。 **读完记得写 RMVF 清除** ，否则下次复位会混进旧标志 |
| 重启前发生了什么 | 备份寄存器 BKP（F1：` BKP->DRx `；F4/H7：` RTC->BKPxR `） | 错误码、重启计数、最后一步状态。 **写之前必须先 ` RCC_APB1ENR.BKPEN=1 ` 打开时钟、` PWR_CR.DBP=1 ` 解除备份域写保护** （每次复位后 DBP 都会被清，必须重设），否则写进去无效 |
| 过程线索 | 分级日志 \+ RAM 环形日志（Module 07 的日志系统） | 最近 N 条日志留在 RAM 缓冲里，复位后 dump 出来 —— 这就是 §8.3 的 HardFault 报告最该带上的东西 |

 

◆ 一份能复现的 bug 报告，长这样

 

**现象** （必须带数字、条件、范围）→  **复现步骤** （1、2、3，能照着做）→  **期望 vs 实际**  →  **环境** （芯片型号、固件版本号 / git 提交、编译选项、优化等级）→  **已排除项** （试过 A、B，都不是）。 最后一项最省事也最少人写： *它能让下一个人（或三个月后的你）不从零开始。*

 

○ 把"能在 PC 上测的部分"真的测起来

 

本章所有手段都依赖硬件。但项目里总有一块是 **纯算法、不含寄存器访问** 的 （§7.3 那个 ` alarm_evaluate ` 就是），它完全可以在主机上测，不必等板子：

 

 
- **抽出来** ：把纯逻辑放进不 ` #include ` 任何 ` stm32xxxx.h ` 的文件，用宿主 gcc 直接编成测试程序。
 
- **框架** ：` Unity ` / ` CMock ` / ` Ceedling `，或先自己写几个 ` assert ` 也行 —— 有测试总比没测试强。
 
- **硬件替身（mock）两种** ：函数指针注入（运行时替换，见 §7.3 的 ` deps `）；或链接期 ` -Wl,--wrap=HAL_GetTick `，链接器把所有对它的调用重定向到你自己写的 ` __wrap_HAL_GetTick `。
 
- **覆盖率** ：宿主 gcc 加 ` --coverage `，跑完用 ` gcov ` / ` lcov ` 出报告。⚠ 它量的是" **PC 上这一份** "的覆盖率，不等于目标端覆盖率。
 
- **接进 CI** ：` make test ` 每次提交自动跑，失败就拦下。细节留给《工程化、测试与量产》那一册专门讲。

 

```zhizhan-anchor
ch8-7-3
```



### 8.7.3 内存问题排查清单

 

| 检查项 | 怎么做 |
| --- | --- |
| 栈够不够 | 填图案测峰值（§8.5）；按实测最大值的 1.5–2 倍定大小；中断嵌套会额外吃栈 |
| 有没有栈溢出 | 哨兵（§8.5）、MPU 保护区、RTOS 的 ` configCHECK_FOR_STACK_OVERFLOW ` |
| 堆水位 | RTOS 用 ` xPortGetMinimumEverFreeHeapSize() `；裸机在自己的 ` _sbrk ` 里记账（§8.5.1） |
| 有没有越界写 | ` .bss ` 校验和前后对比（§8.5 ⑤）；MPU；静态分析（§8.4） |
| 链接期是否放得下 | ` --print-memory-usage `；` ASSERT ` 段溢出（§4.4） |
| 对齐（DMA/cache） | DMA 缓冲按 M0 4 字节 / M7 cache line 对齐；用 ` _Alignas `/` aligned(n) `（§1.5） |

 

```zhizhan-anchor
ch8-7-4
```



### 8.7.4 通信问题排查清单

 

| 检查项 | 怎么做 |
| --- | --- |
| 物理层先排除 | 共地、电平、上拉、线序、供电（很多"协议问题"其实是电气问题） |
| 波特率/时钟 | 量一位宽度反推实际波特率；核对时钟树与分频（§8.8） |
| 帧格式 | 起始/停止/校验/长度字段是否与对端一致；字节序是否一致 |
| 流控与缓冲 | 接收溢出标志（ORE）、环形缓冲是否够大、是否会丢失（§6.7） |
| 时序参数 | [I²C](term:i2c) 上拉强度与总线电容；SPI 速度与建立/保持时间（§8.8） |
| 超时与重连 | 对端不回时有没有超时上限（否则任务卡死 → §8.15 的看门狗复位） |
| 抓包对照 | 逻辑分析仪解码 \+ 软件日志交叉验证；两边对不上说明有一边在"自说自话" |

 

✔ 清单的用法

 

这些清单不是让你"每次都过一遍"，而是 **卡住时按顺序排除** 。 更重要的是：把本次踩到的坑 **补回清单**  —— 清单越往后越贴合你的项目，这才是团队真正的调试资产。

 

```zhizhan-anchor
ch8-8
```



## 8.8 逻辑分析仪与示波器：协议层的"第二双眼睛"

 

GDB 能告诉你"程序执行到哪一行"，但它 **看不见线上发生了什么** 。 当问题是"时序不对""从机不响应""数据偶尔错位"时，唯一能说话的是把电信号画出来 —— 这就是示波器和逻辑分析仪的战场。它们和软件调试不是替代关系，而是 **分工关系** 。

 

```zhizhan-table
{"rows":[[{"body":"仪器","header":true,"rowSpan":1,"colSpan":1},{"body":"看什么","header":true,"rowSpan":1,"colSpan":1},{"body":"强项","header":true,"rowSpan":1,"colSpan":1},{"body":"局限","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**示波器**","header":false,"rowSpan":1,"colSpan":1},{"body":"连续电压随时间的变化（模拟量）","header":false,"rowSpan":1,"colSpan":1},{"body":"信号质量、上升/下降时间、过冲/振铃、电源纹波、眼图","header":false,"rowSpan":1,"colSpan":1},{"body":"通道少（2–4 路常见）；普通示波器不会\"解码协议\"","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**逻辑分析仪**","header":false,"rowSpan":1,"colSpan":1},{"body":"多路数字信号的高/低电平序列","header":false,"rowSpan":1,"colSpan":1},{"body":"通道多（8–16 路起步）；能把 UART/I²C/SPI/CAN 直接 **解码成数据**","header":false,"rowSpan":1,"colSpan":1},{"body":"只判高低电平，不告诉你\"电平好不好看\"（3.3V 还在 1.8V 悬着它照样当高）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**协议分析仪**","header":false,"rowSpan":1,"colSpan":1},{"body":"协议层的报文（如 CAN 分析仪、USB 分析仪）","header":false,"rowSpan":1,"colSpan":1},{"body":"直接给出字段、CRC、时间戳，甚至错误计数","header":false,"rowSpan":1,"colSpan":1},{"body":"针对特定协议、通常更贵；不解决物理层问题","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**混合信号示波器  \n（MSO）**","header":false,"rowSpan":1,"colSpan":1},{"body":"模拟 \\+ 数字同时","header":false,"rowSpan":1,"colSpan":1},{"body":"既看波形质量、又解码协议（\"这一帧为什么被从机 NAK\"）","header":false,"rowSpan":1,"colSpan":1},{"body":"价格最高","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

```zhizhan-anchor
ch8-8-1
```



### 8.8.1 采样率：买仪器前唯一必须搞懂的数字

 

采样率不够时，波形会被"混叠"成完全不同的样子，而且 **看不出来是假的** 。 经验法则： **采样率 ≥ 被测信号最高有效频率的 5–10 倍**  （奈奎斯特的 2 倍只是"不混叠"的理论下限，画方格波形需要更多点才能看清边沿）。

 

| 被测信号 | 实际最快边沿/频率 | 建议采样率 |
| --- | --- | --- |
| UART @115200 | 1 位 ≈ 8.7 µs（≈ 115 kHz） | ≥ 1–2 MS/s 就能轻松看清每一位 |
| I²C @400 kHz（快速模式） | SCL 400 kHz | ≥ 5 MS/s；要看清重复起始/时钟拉伸，越高越好 |
| SPI @10 MHz | SCK 10 MHz | ≥ 50–100 MS/s（否则位边界糊成一团） |
| 电源纹波 / 上电斜坡 | 开关电源 MHz 级纹波 | 用示波器，≥ 100 MS/s，且注意探头带宽 |

 

⚠ 探头也是电路的一部分

 

**×10 探头** 的输入电容、长地线回路会改变被测信号 —— 你会看到不属于电路的振铃。 高频测量时：用 **探头自带的短弹簧地** （不是那根鳄鱼夹长线）、 带宽要够（探头带宽 ≥ 信号最高频率），必要时在测试点预留探针环。  *测到的波形是"探头 \+ 电路"共同的结果，别把探头引入的失真当成 bug。*

 

```zhizhan-anchor
ch8-8-2
```



### 8.8.2 读一张 UART 波形

 

串口是最值得先学会读的波形： **空闲为高、起始位拉低、LSB 先发、停止位拉高** 。 下面这张图是 ` 0x41 `（字符 'A'）在 8N1 下的样子 —— 数格子就能读出来：

 

**WAVE A.1**  UART 8N1 发送 0x41（'A'）—— LSB 先发，空闲/停止位为高

 

```zhizhan-figure
<svg viewBox="0 0 660 150" width="660" height="150" role="img" aria-label="UART 波形">
          <line x1="40" y1="45" x2="640" y2="45" class="lifeline" style="stroke-dasharray:2 5"></line>
          <line x1="40" y1="85" x2="640" y2="85" class="lifeline" style="stroke-dasharray:2 5"></line>
          <polyline points="40,45 94,45 94,85 148,85 148,45 202,45 202,85 472,85 472,45 526,45 526,85 580,85 580,45 634,45" fill="none" stroke="var(--grn)" stroke-width="2"></polyline>
          <text x="67" y="38" class="sv-lbl-dim" text-anchor="middle">空闲(1)</text>
          <text x="121" y="102" class="sv-lbl-dim" text-anchor="middle">起(0)</text>
          <text x="175" y="38" class="sv-lbl-dim" text-anchor="middle">d0=1</text>
          <text x="283" y="102" class="sv-lbl-dim" text-anchor="middle">d1–d5=0</text>
          <text x="499" y="38" class="sv-lbl-dim" text-anchor="middle">d6=1</text>
          <text x="553" y="102" class="sv-lbl-dim" text-anchor="middle">d7=0</text>
          <text x="607" y="38" class="sv-lbl-dim" text-anchor="middle">停(1)</text>
          <text x="40" y="132" class="sv-lbl-dim">位宽 = 1/波特率；8N1 = 1 起始 + 8 数据 + 1 停止；数据位 LSB 在前</text>
        </svg>
```

 

✔ 读波形能立刻定性的四类串口问题

 

 
- **波特率不匹配** ：位宽对不上 —— 量一位的宽度反推实际波特率（1/位宽），别猜。
 
- **乱码但位宽对** ：多半是电平/极性（RS-232 反相）或接地问题，看空闲电平对不对。
 
- **丢一半字节** ：从机来不及收（没流控、接收中断被高优先级卡住），看帧与帧之间的间隔。
 
- **根本没有起始位** ：TX 引脚没配成复用输出、时钟没开、或线接错 —— 软件层再查也没用。

 

```zhizhan-anchor
ch8-8-3
```



### 8.8.3 从"症状"到"抓哪根线"

 

| 症状 | 抓什么 | 看什么 |
| --- | --- | --- |
| I²C 读回全 0xFF / 全 0 | SCL \+ SDA（两路一起） | 有没有 [ACK](term:ack)；SDA 是否被从机拉低；有没有时钟拉伸（SCL 被从机按住） |
| I²C 总线"死锁"（SCL 一直被拉低） | SCL \+ SDA | 某次读被中断打断在半途，从机在等时钟 —— 需要发 9 个时钟做恢复 |
| SPI 数据错位 / 全错 | SCK \+ MOSI \+ CS | CPOL/CPHA 是否匹配（数据在哪个边沿被采样）；CS 是否全程有效 |
| SPI 偶发错一位 | SCK \+ MOSI \+ CS（高速时） | SCK 太快导致建立/保持时间不足；走线过长振铃 |
| 中断响应比预期慢 | 中断触发引脚 \+ 一个 GPIO 打点 | 从"触发边沿"到"打点翻转"的时间差 = 中断延迟 |
| DMA 传输偶发丢数据 | DMA 请求/完成信号（若可引出）\+ 数据线 | 与 CPU 争总线的停顿；缓存一致性（M7） |

 

◆ 软件调试与仪器调试的分工

 

**逻辑问题（算错了、分支走错）→ 用 GDB/日志，快且便宜。**   **时序/电气问题（偶尔错、从机不回、边沿不对）→ 必须上仪器** ， 在源码里读一万行也读不出"SCL 被从机拉低"这件事。   
  
 最常见的低效是 **用错工具** ：明明是电气/时序问题，却在软件里反复加延时、改优先级 —— 而真正该做的，是把探头夹上去看一眼。反过来，一个纯逻辑 bug 去抓波形也是浪费。  *先问"这个问题在哪个域"，再选工具。*

 

```zhizhan-anchor
ch8-8-4
```



### 8.8.4 仪器进阶：协议解码、触发与长时间抓包

 

买一台逻辑分析仪只是开始。真正拉开差距的是 **怎么触发、怎么回看** ， 尤其是那种"几小时才错一次"的问题。

 

| 能力 | 用来抓什么 | 要点 |
| --- | --- | --- |
| **协议解码** | 把 UART/I²C/SPI/CAN 的电平直接翻译成字段：地址、数据、ACK/NAK、CRC | 要先在软件里设对协议参数（波特率/时钟极性/地址位宽）， **参数设错解码结果会一本正经地错** ——所以解码结果要能和软件日志交叉验证 |
| **边沿/电平触发** | 某根线出现特定边沿时开始录 | 设好触发位置（前置缓冲），才能看到"事件发生前"的信号，而不是只有之后 |
| **协议/模式触发** | "当地址等于 0x44 且第 3 个数据字节为 0xFF 时停" | 高级分析仪支持；对付偶发帧非常有效，不用人工翻几千帧 |
| **长时间/流式抓包** | 几小时～几天的运行，抓一次异常 | 受限于仪器缓冲；要么用"异常触发后存盘"，要么用"分段录制 \+ 条件停"。 *别指望它能像硬盘一样无限录* |
| **交叉触发** | 示波器（看模拟质量）\+ 分析仪（看协议）联动 | MSO 或带触发输出的设备才能做到；"协议错了"还是"信号烂了"一次定位 |

 

✔ 抓包的第一性原理：先想好"我要证明或排除什么"

 

漫无目的地挂着分析仪看波形，通常什么也发现不了。 有效的抓法是带着一个 **可证伪的问题** ： "从机到底有没有回 ACK？""中断延迟是不是真的超过 10 µs？""CS 有没有在传输中途被拉高？" 想清楚问题 → 决定抓哪几根线、设什么触发、看哪个字段 —— 这一步比仪器贵不贵重要得多。

 

```zhizhan-anchor
ch8-9
```



## 8.9 GDB 进阶：脚本、断点命令与自动化回归

 

§8.2 讲的是"手工敲命令"。但真正省时间的，是把重复动作 **写成脚本** ， 并从"每次手动调试"升级到" **每次提交自动跑** "。这一节把 GDB 从"交互工具"用成"可编程的自动化工具"。

 

```zhizhan-anchor
ch8-9-1
```



### 8.9.1 断点命令列表：命中时自动做一串事

 

手工流程通常是"停在断点 → 敲 ` bt ` → 敲 ` print ` → 敲 ` continue `"。 这套动作可以一次性挂到断点上，命中即自动执行，然后继续 ——  **适合抓偶发问题** ：

 

| 写法（GDB） | 作用 |
| --- | --- |
| ` break foo ` 然后 ` commands ` / ` silent ` / ` printf "…" ` / ` continue ` / ` end ` | 命中 ` foo ` 时不暂停，只打一行信息再自动继续 —— 相当于"不打断时序的日志断点" |
| ` break uart.c:147 if rx_count > 100 ` \+ ` commands ` | 只在条件满足时打印现场；循环里的偶发 bug 必备 |
| ` define mstatus ` … ` end ` | 自定义命令（如一次打印多个外设寄存器），之后直接输入 ` mstatus ` |
| ` hook-stop ` | 每次停下来都自动执行的命令（如自动 ` bt 5 ` \+ 看关键寄存器） |
| ` set $i = 0 ` / ` set $buf = (char*)0x20000000 ` | 临时变量，用来记数或给一个地址起名 |
| ` x/8i $pc ` / ` disassemble /r ` | 看指令（` /r ` 同时显示原始机器码字节） |

 

✔ 断点命令能把"偶发"变成"可记录"

 

一个每 500 次才错一次的问题，手工 continue 499 次不现实。 给它挂一段 ` commands `：命中就 ` printf ` 出关键变量 \+ ` bt `， 然后 ` continue ` —— 让它自己跑一整晚，第二天看输出里"最后一次异常前的状态"。  *这正是 HardFault 处理器 \+ RAM 环形日志在软件侧的等价物。*

 

```zhizhan-anchor
ch8-9-2
```



### 8.9.2 把 GDB 接进 CI：` --batch -ex `

 

GDB 可以不进交互界面，跑一批命令就退出。这是"自动化回归"的入口： 上电（` monitor reset halt `）→ ` load ` → ` continue ` 到某个测试点 → ` print ` 断言值 → 脚本检查输出。

 

| 要点 | 说明 |
| --- | --- |
| ` --batch ` | **关键** ：没有它，GDB 跑到命令末尾会挂在交互提示上，CI 直接卡死 |
| ` -ex "<命令>" ` | 按顺序执行一条命令；可重复多个（` -ex "monitor reset halt" -ex "load" -ex "continue" `） |
| ` -x script.gdb ` | 执行脚本文件（比一长串 ` -ex ` 好维护） |
| ` -return-child-result ` / 退出码 | 让 GDB 的退出码反映结果，CI 据此判红绿 |
| OpenOCD 侧 | 先起 ` openocd -f … `（后台），GDB 连 ` :3333 `；跑完 ` monitor shutdown `，再收掉 OpenOCD |
| 回归产物 | 把 GDB 输出重定向到文件，作为"这次提交的硬件在环结果"归档 |

 

⚠ 硬件断点/watchpoint 是有限资源

 

STM32 上通常只有  **6 个硬件断点、4 个 watchpoint** （见 §8.2 启动日志里那句 "hardware has 6 breakpoints, 4 watchpoints"）。超过就得动用软件断点 —— 而软件断点要改写 Flash 内容，在 Flash 上需要擦写、且会和"校验 Flash 内容"冲突。  *自动化脚本里别挂几十个断点，会静默失败或大幅拖慢。*

 

```zhizhan-anchor
ch8-9-3
```



### 8.9.3 GDB 里的 Python：当命令不够用

 

现代 ` arm-none-eabi-gdb ` 内置 Python，可以写函数遍历链表、解析自定义协议栈、 批量读取一段内存并按结构体渲染。典型用途：

 

 
- **遍历内核对象** ：脚本沿着 ` next ` 指针走一条任务链表并打印每个任务名（比手工 ` p *t ` 快得多）。
 
- **解析环形缓冲** ：按 ` head/tail ` 把一圈数据"展平"成时间顺序打印。
 
- **自定义 pretty-printer** ：让 ` print ` 某个句柄时显示成可读摘要，而不是一堆裸地址。
 

 

◆ 三条命令看"内存到底是谁的"

 

 
- ` info symbol <addr> ` —— 这个地址落在哪个函数/变量里（比 ` addr2line ` 多了"符号"这一维）。
 
- ` info line *<addr> ` —— 地址对应的源码行。
 
- ` maintenance info sections ` —— 段表（哪块地址是 Flash、哪块是 RAM），判断一个野指针"该不该在这儿"。

 

```zhizhan-anchor
ch8-9-4
```



### 8.9.4 数据断点（watch）实战：抓"谁改了这个变量"

 

普通断点停在 **某段代码** ；数据断点停在 **某个变量被访问的那一刻**  —— 两者解决的是完全不同的问题。排查"变量莫名被改"时，数据断点是唯一高效的手段（也是 §8.2 强调 ` watch ` 的原因）。

 

| 命令 | 触发条件 | 典型用途 |
| --- | --- | --- |
| ` watch expr ` | 表达式的值 **被写** 时停 | 抓"谁把这个状态改了"（最常用） |
| ` rwatch expr ` | 表达式 **被读** 时停 | 抓"谁在读这个被污染的指针/缓冲区" |
| ` awatch expr ` | 读或写都停 | 不确定是读还是写引起时 |
| ` info watchpoints ` | 列出当前观察点 | 确认没超出硬件数量 |

 

⚠ watch 的四个"真实限制"

 

 
- **数量有限** ：数据断点走硬件，STM32 上通常 **只有 4 个** 。挂多了要挂软件观察点（慢，且可能不精确）。
 
- **不支持硬件条件** ：` watch x if cond ` 的条件是 GDB 在命中后判的 —— 条件不满足它照样会先停下来，只是自动继续；对高频写入的变量会非常慢。要"只记录某次"就用断点命令 \+ ` printf ` 计数。
 
- **优化会让它失效** ：` -O2 ` 下变量可能整个住在寄存器里，根本不在内存 —— 没有"内存写"可观察。调试期用 ` -Og `，或临时把该变量声明为 ` volatile `。
 
- **观察的是地址，不是名字** ：变量被移出作用域后，地址可能被复用，观察点会"误报"到别的东西上。用完记得 ` delete `。

 

✔ 配合 ` display ` 与断点命令，形成"自动记录仪"

 

` display expr ` 让每次停下来都自动打印同一个表达式（不用反复敲 ` print `）。 再给一个断点挂上 ` commands `（打印 \+ 条件计数 \+ ` continue `）， 你就得到了一台"不打断程序、却把每次异常访问都记下来"的记录仪 —— 对付"跑一晚才错一次"的问题，这是最实用的组合。

 

```zhizhan-anchor
ch8-9-5
```



### 8.9.5 调试会话与脚本的组织

 

调试配置散落各处，换台机器就重来。把下面几件事固定下来，能省掉大量重复劳动：

 

| 资产 | 放什么 | 为什么 |
| --- | --- | --- |
| ` .gdbinit `（项目根） | 通用设置、自定义命令、断点预设（见 §8.2） | 每个成员、每次会话自动加载，行为一致 |
| 调试脚本（` .gdb `） | 连接、复位、` load `、批量检查 | CI 与本地共用同一份（§8.9.2） |
| ` openocd.cfg `（项目根） | 探针/目标/速度/复位策略（§8.2.2） | 不再手敲一长串 ` -f ` |
| IDE 配置（` launch.json ` 等） | 指向上面的脚本与 .elf | GUI 与命令行用同一套底层，避免"两套配置不一致" |
| 测试点约定 | 哪些变量/寄存器是"每次先看的" | 把它写成 GDB 自定义命令（如 ` mstatus `），团队统一 |

 

◆ 一条原则：调试配置要进版本库

 

` .gdbinit `、` openocd.cfg `、调试脚本、IDE 配置都应该 **提交进仓库** ， 而不是"每人自己配一份"。这样新人 clone 下来就能调试，也避免"只有某台机器上能连上"的玄学问题。  *把调试当作工程的一部分，而不是个人的临时技巧。*

 

```zhizhan-anchor
ch8-10
```



## 8.10 HardFault 深潜：从 ` CFSR ` 每一位到"哪行代码踩到它"

 

§8.3 给了你"看 PC → ` addr2line ` → 源码行"的定位链路。 但定位到一行代码之后，还要回答" **为什么这一行会触发 fault** "。 答案几乎全在 ` CFSR ` 里 —— 它把硬件抓到的错误分成了三类、十几个具体原因。 这一节把每一位讲清楚，并给出"哪种写法会点亮哪一位"的对照表。

 

◆ 先记住三个地址（都在内核私有外设 PPB 区）

 

 
- ` CFSR  = 0xE000ED28 `（ **C** onfigurable  **F** ault  **S** tatus，可配置故障状态）—— 三组各占一个字节。
 
- ` HFSR  = 0xE000ED2C `（ **H** ard **F** ault  **S** tatus）—— 说明"是谁升级上来的"。
 
- ` MMFAR= 0xE000ED34 ` / ` BFAR = 0xE000ED38 ` —— 触发故障的 **地址** （仅当对应 VALID 位置 1 时有效）。

 

```zhizhan-anchor
ch8-10-1
```



### 8.10.1 ` CFSR ` 三个分组

 

` CFSR ` 是一个 32 位寄存器，里面塞了三张表：低字节是  **MemManage** （内存管理）、 次字节是  **BusFault** （总线）、高 16 位是  **UsageFault** （用法）。 表里的"组内位"是它在各自字节/半字里的位号。

 

```zhizhan-table
{"rows":[[{"body":"分组","header":true,"rowSpan":1,"colSpan":1},{"body":"占 CFSR 的","header":true,"rowSpan":1,"colSpan":1},{"body":"组内位含义","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**MMFSR**   \nMemManage（访存违规）","header":false,"rowSpan":1,"colSpan":1},{"body":"bit\\[7:0\\]","header":false,"rowSpan":1,"colSpan":1},{"body":"位0 IACCVIOL（取指违规，MPU 拦下的执行）、位1 DACCVIOL（数据访问违规）、位3 MUNSTKERR（异常返回出栈出错）、位4 MSTKERR（异常入栈出错）、位5 MLSPERR（惰性保存浮点出错）、位7 MMARVALID（` MMFAR ` 有效）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**BFSR**   \nBusFault（总线错误）","header":false,"rowSpan":1,"colSpan":1},{"body":"bit\\[15:8\\]","header":false,"rowSpan":1,"colSpan":1},{"body":"位0 IBUSERR（取指总线错误）、位1 PRECISERR（ **精确** 数据总线错误，返回地址就是出错指令）、位2 IMPRECISERR（ **不精确** ，写入被缓冲，报告时已跑远）、位3 UNSTKERR、位4 STKERR（入/出栈总线错误 —— 多为 **栈问题** ）、位5 LSPERR、位7 BFARVALID（` BFAR ` 有效）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**UFSR**   \nUsageFault（用法错误）","header":false,"rowSpan":1,"colSpan":1},{"body":"bit\\[31:16\\]","header":false,"rowSpan":1,"colSpan":1},{"body":"位0 UNDEFINSTR（未定义指令）、位1 INVSTATE（ **非法状态** ：如 Thumb 位为 0 的函数指针）、位2 INVPC（非法 PC 载入/EXC\\_RETURN）、位3 NOCP（访问了不存在的协处理器，如在没 FPU 的核上执行浮点指令）、位8 UNALIGNED（非对齐访问， **M0/M0\\+ 上必报；M3/M4 仅 LDM/STM、LDRD 等或开了 ` CCR.UNALIGN_TRP ` 才报** ）、位9 DIVBYZERO（除零，需 ` CCR.DIV_0_TRP=1 `）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

```zhizhan-anchor
ch8-10-2
```



### 8.10.2 ` HFSR `：是它自己，还是被"升级"上来的

 

| HFSR 位 | 含义与判读 |
| --- | --- |
| ` bit1 VECTTBL ` | 取向量表时出错（向量表地址不对 / ` VTOR ` 指到无效处）。 |
| ` bit30 FORCED ` | **最重要的判据** ：置位说明"是 MemManage/BusFault/UsageFault 升级上来的"，真正的根因在 ` CFSR ` 里。此时应 **先看 CFSR，再看 HFSR** 。 |
| ` bit31 DEBUGEVT ` | 调试事件触发（如断点/观察点命中）。 |

 

✔ 三步判读法

 

 
1. 读 ` CFSR `：哪一组非 0，就锁定是"访存违规 / 总线错误 / 用法错误"。
 
2. 看对应 ` xARVALID `：` MMARVALID `→读 ` MMFAR `；` BFARVALID `→读 ` BFAR `。那是硬件抓到的 **出错地址** 。
 
3. 再结合 §8.3 的栈帧 PC（出错指令地址）用 ` addr2line ` 落到源码行。地址（` FAR `）和指令（` PC `）一起看，才能区分"哪条指令"和"哪个地址"。

 

```zhizhan-anchor
ch8-10-3
```



### 8.10.3 哪种写法会点亮哪一位（对照表）

 

| 典型代码 / 场景 | 会置位的标志 | 补充线索 |
| --- | --- | --- |
| 写空指针 ` *p = 1 `（` p==NULL `） | BFSR PRECISERR，常伴 BFARVALID | ` BFAR ` 接近 0（0x00000000 附近） |
| 读无效地址（外设时钟没开、地址错） | BFSR PRECISERR | ` BFAR ` 指向你访问的那个错误地址 |
| 栈溢出（往下踩穿） | BFSR STKERR / UNSTKERR | 配合 §8.5 的栈填充峰值一起看 |
| 开了 MPU 的越界访问 | MMFSR DACCVIOL / IACCVIOL | 若未开 MemManage 异常，会以 HFSR.FORCED 升级为 HardFault |
| 函数指针丢了 Thumb 位（LSB=0） | UFSR INVSTATE | 被调用的地址是 **偶数** ；正常函数指针最低位是 1 |
| 跳到 Flash 之外/擦除中的地址 | BFSR IBUSERR 或 UFSR INVPC | PC 落在未映射区域 |
| 执行到数据区（如损坏的函数表） | UFSR UNDEFINSTR / INVSTATE | 反汇编该地址是一堆无意义字节 |
| M0/M0\+ 上做非对齐 ` LDR ` | UFSR UNALIGNED | **M3/M4 默认不报** ，别拿它在这两款核上复现 |
| 除零（且 ` CCR.DIV_0_TRP=1 `） | UFSR DIVBYZERO | 默认该 trap 是关的，所以多数项目除零不会 fault |
| 在不带 FPU 的核上执行浮点指令 | UFSR NOCP | 多半是编译选项给了硬件浮点、但目标核没有 |

 

⚠ ` IMPRECISERR ` 为什么难查，以及怎么让它变精确

 

` IMPRECISERR ` 表示"出错时写的地址已经被缓冲，CPU 又往前跑了几条指令才报告"， 所以栈里的 PC 和真正的出错指令 **对不上** 。在  **Cortex-M3/M4**  上可以打开 ` SCB->ACTLR |= (1<<1) `（DISDEFWBUF）禁用写缓冲，把不精确错误变精确 —— 代价是性能略降，只在定位阶段开。  *⚠ 这一位只存在于 M3/M4：M0/M0\+ 没有它，M7 的位定义不同，照抄会静默无效。*  另外它只改"存储指令的完成时机"，对取指故障/读故障没有帮助。

 

```zhizhan-anchor
ch8-10-4
```



### 8.10.4 一次完整判读：从寄存器值到根因

 

把上面的方法走一遍。假设 ` HardFault_Handler ` 里读出来这样一组值 （下面左列是"你看到的"，右列是"怎么读"）：

 

```zhizhan-table
{"rows":[[{"body":"你看到的","header":true,"rowSpan":1,"colSpan":1},{"body":"判读","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` HFSR = 0x40000000 `","header":false,"rowSpan":1,"colSpan":1},{"body":"只有  **FORCED 置位** ：这是从 MemManage/BusFault/UsageFault 升级上来的， **不是纯粹的 HardFault** 。根因在 ` CFSR `。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` CFSR = 0x00008200 `","header":false,"rowSpan":1,"colSpan":1},{"body":"拆开：高 16 位 = ` 0x0000 `（ **UsageFault 全 0** ）；bit\\[15:8\\] = ` 0x82 `（ **BFSR** ）；bit\\[7:0\\] = ` 0x00 `（MemManage 全 0）。  \nBFSR 的 ` 0x82 ` = 二进制 ` 1000_0010 ` → 位 1  **PRECISERR**  \\+ 位 7  **BFARVALID** 。  \n结论： **精确的数据总线错误，且出错地址已记录** 。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` BFAR = 0x00000004 `","header":false,"rowSpan":1,"colSpan":1},{"body":"出错地址是 ` 0x00000004 ` ——  **几乎是空指针** （访问了 NULL 附近）。","header":false,"rowSpan":1,"colSpan":1}],[{"body":"栈帧里 ` PC = 0x08001a2c `","header":false,"rowSpan":1,"colSpan":1},{"body":"出错 **指令** 地址。` addr2line -e fw.elf -f -C 0x08001a2c ` 落到某个函数某一行。","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

合起来的结论： **在某一行，程序通过一个（接近 NULL 的）指针做了数据访问** 。 接下来就是常规查法：看那一行访问的是哪个指针、这个指针为什么是 NULL（初始化漏了？参数没传？结构体成员没赋值？）。

 

✕ 两个反直觉的边界

 

 
- **` BFAR = 0 ` 也可能是"地址真的是 0"** ：Cortex-M 的 ` 0x00000000 ` 是 Code 区别名（BOOT0=0 时别名到 Flash）， **读它常常静默成功** （读到的是向量表内容），只有 **写** 才会 fault。所以"读 NULL 没崩"不代表代码没问题 —— 它比崩溃更危险。
 
- **` IMPRECISERR ` 时 PC 和 BFAR 都对不上** ：栈里的 PC 已经跑到出错指令之后几条了。这时要么开 ` DISDEFWBUF `（M3/M4）把它变精确，要么从"出错地址"倒推是哪个外设/缓冲被误访问。

 

✔ 把这段判读固化成代码

 

别每次手工拆位。在 ` hardfault_report() `（§8.3）里就把 ` CFSR/HFSR/MMFAR/BFAR ` 打出来，并用 **位掩码逐个判断并打印人类可读的结论**  （"BusFault 精确错误，地址 0x…""栈入栈出错，疑似栈溢出"）。  *一次性写好，之后每一次崩溃都自动给你判读好的报告 —— 这是投入产出比最高的调试代码。*

 

```zhizhan-anchor
ch8-10-5
```



### 8.10.5 把 MemManage / BusFault / UsageFault 单独开出来

 

默认情况下，这三类故障都 **升级成 HardFault** （你只看到 ` HFSR.FORCED=1 `）。 虽然靠 ` CFSR ` 仍能判断，但把它们 **各自开成独立异常** ，能带来实实在在的好处：

 

| 异常 | 开出来的好处 | 开法（使能位） |
| --- | --- | --- |
| **MemManage** | MPU 越界时进 **专门** 的 handler，能区分"内存保护违规"和普通跑飞；配合栈保护区一眼看出栈溢出 | ` SCB->SHCSR \|= (1<<16) `（MEMFAULTENA） |
| **BusFault** | 总线错误单独处理；尤其配合 ` IMPRECISERR ` 的处理策略 | ` SCB->SHCSR \|= (1<<17) `（BUSFAULTENA） |
| **UsageFault** | 未定义指令、INVSTATE、非对齐（开 trap 时）、除零（开 trap 时）单独分类 | ` SCB->SHCSR \|= (1<<18) `（USGFAULTENA） |

 

⚠ 分组的代价：你要为每个 handler 都写报告代码

 

单独开后，三类故障不再进 HardFault， **你必须在各自的 handler 里也做报告** （可复用一个 ` fault_report() `）。 否则会变成"进了 MemManage\_Handler，但那里只有一句死循环" —— 现场信息全丢。  *分工是：三个专用 handler 负责分类报告，HardFault 负责兜底（捕获没单独开的那些）。*

 

✔ 还需要开哪几位开关

 

 
- ` CCR.UNALIGN_TRP `：让"非对齐访问"在 M3/M4 上也触发 UsageFault（默认不 trap）。调试阶段开，量产按需关。
 
- ` CCR.DIV_0_TRP `：让除零触发 UsageFault（默认关）。
 
- ` SCB->SHCSR ` 这三个使能位与上面的 CCR 位 **必须一起配** ，否则"开了故障源、却没开对应异常"，仍然是升级为 HardFault 或静默通过。

 

```zhizhan-anchor
ch8-11
```



## 8.11 静态分析进阶：把分析器用成"提交门禁"

 

§8.4 介绍了静态分析的基本用法。但要真正有价值，它必须 **进入 CI、并可失败退出**  —— 否则没人会主动去跑一个"跑完一堆输出、还得人工判断"的工具。

 

```zhizhan-anchor
ch8-11-1
```



### 8.11.1 工具分工：谁补谁的盲区

 

```zhizhan-table
{"rows":[[{"body":"工具","header":true,"rowSpan":1,"colSpan":1},{"body":"擅长的","header":true,"rowSpan":1,"colSpan":1},{"body":"盲区","header":true,"rowSpan":1,"colSpan":1},{"body":"定位","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**编译器告警  \n` -Wall -Wextra -Wconversion `**","header":false,"rowSpan":1,"colSpan":1},{"body":"类型/截断/格式串等 **单点、局部** 问题；零额外配置","header":false,"rowSpan":1,"colSpan":1},{"body":"跨函数路径、资源泄漏、并发","header":false,"rowSpan":1,"colSpan":1},{"body":"第一道、必开、进 CI","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**` -fanalyzer `（GCC）**","header":false,"rowSpan":1,"colSpan":1},{"body":"路径敏感：空指针、未初始化、双重释放、泄漏、跨函数","header":false,"rowSpan":1,"colSpan":1},{"body":"慢；对复杂控制流误报偏多；需要较新 GCC","header":false,"rowSpan":1,"colSpan":1},{"body":"提交门禁的\"重武器\"，可只对改动文件跑","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**cppcheck**","header":false,"rowSpan":1,"colSpan":1},{"body":"越界、数组退化、未使用、可疑条件；对嵌入式代码容忍度好","header":false,"rowSpan":1,"colSpan":1},{"body":"不真正编译，看不到宏展开后的类型","header":false,"rowSpan":1,"colSpan":1},{"body":"易接入、误报低，适合作为基础门禁","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**clang-tidy**","header":false,"rowSpan":1,"colSpan":1},{"body":"编码规范、现代化建议、部分 bug（` bugprone-* `）","header":false,"rowSpan":1,"colSpan":1},{"body":"需要 ` compile_commands.json `；对交叉编译头文件解析要配好","header":false,"rowSpan":1,"colSpan":1},{"body":"规范 \\+ bug 混合，适合有 ` clangd ` 的工程","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**clang static analyzer  \n（` scan-build `）**","header":false,"rowSpan":1,"colSpan":1},{"body":"与 ` -fanalyzer ` 类似的路径分析，报告更细","header":false,"rowSpan":1,"colSpan":1},{"body":"交叉编译配置复杂","header":false,"rowSpan":1,"colSpan":1},{"body":"可选加强","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**MISRA / CERT 检查器**","header":false,"rowSpan":1,"colSpan":1},{"body":"规则符合性（车载/医疗常强制）","header":false,"rowSpan":1,"colSpan":1},{"body":"商业工具；规则多、初始噪音大","header":false,"rowSpan":1,"colSpan":1},{"body":"合规项目才上","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

```zhizhan-anchor
ch8-11-2
```



### 8.11.2 进 CI 的关键：让它"能红"

 

| 做法 | 说明 |
| --- | --- |
| ` cppcheck --error-exitcode=1 ` | 发现问题就用非 0 退出码，CI 才会判红。 **没有这个参数，工具即使报了一堆问题也返回 0，CI 全绿——等于没接** |
| ` -fanalyzer ` 配 ` -Werror=analyzer-* ` | 把某几类分析告警升级为错误，其余保留为告警，控制信噪比 |
| 只分析改动文件 / 增量 | 全量 ` -fanalyzer ` 较慢；CI 里先对本次 diff 的文件跑 |
| 抑制清单（suppression） | 确认是误报的，写进抑制文件并 **注明理由 \+ 关联 issue** ；不许直接放宽规则 |
| 把告警数作为指标 | 记录每次提交的告警总数， **只许下降不许上升** ——防止"新代码又加了一堆" |

 

⚠ 信噪比：一次开满，等于一次也不开

 

老项目上第一次跑 ` -fanalyzer ` 或 MISRA 检查器，往往是几百上千条报告。 如果直接"全开 \+ 全当错误"，团队的第一个反应是 **把整个检查关掉** 。 正确节奏： **先开高价值、低误报的一小撮（截断/越界/空指针），把存量清干净，再逐步收紧。**   *门禁的价值不在"检查了多少条规则"，而在"红了的每一条都有人真的去改"。*

 

```zhizhan-anchor
ch8-11-3
```



### 8.11.3 静态分析抓不到的东西（别指望它）

 

 
- **时序/并发** ：ISR 与主循环的竞态、优先级反转 —— 静态分析基本看不见，靠 §8.5 的运行时检测与设计约束。
 
- **硬件相关** ：寄存器位号写错、时钟没开、引脚复用冲突 —— 只能靠手册核对与仪器（§8.8）。
 
- **编译器/ABI 假设** ：某平台特有的非对齐行为、` volatile ` 语义差异 —— 靠实测与门禁（这正是本站 I-03 编译门禁的意义）。
 

 

```zhizhan-anchor
ch8-11-4
```



### 8.11.4 迁移路线：从"一堆告警"到"零告警门禁"

 

老项目上手静态分析，最大的坑是 **想一步到位** 。下面是可落地的四步迁移法：

 

```zhizhan-table
{"rows":[[{"body":"阶段","header":true,"rowSpan":1,"colSpan":1},{"body":"做什么","header":true,"rowSpan":1,"colSpan":1},{"body":"门禁状态","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**第 0 步  \n量化**","header":false,"rowSpan":1,"colSpan":1},{"body":"先不做任何修改，把当前告警/分析报告总数 **记下来** ，存进仓库（如 ` .ci/baseline.json `）","header":false,"rowSpan":1,"colSpan":1},{"body":"只报告，不拦截","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**第 1 步  \n冻结**","header":false,"rowSpan":1,"colSpan":1},{"body":"门禁规则： **新增代码不许产生新告警** ，存量不动。每次提交对比基线，只许下降","header":false,"rowSpan":1,"colSpan":1},{"body":"能红（只对增量）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**第 2 步  \n收敛**","header":false,"rowSpan":1,"colSpan":1},{"body":"按\"高价值 \\+ 高数量\"排序（通常是截断类与越界类），逐个模块清理存量；每清理一批，下调基线上限","header":false,"rowSpan":1,"colSpan":1},{"body":"能红（增量 \\+ 存量上限）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**第 3 步  \n收紧**","header":false,"rowSpan":1,"colSpan":1},{"body":"存量清零后，把选定的几类升级为 ` -Werror ` / ` --error-exitcode=1 `，真正实现\"零告警\"","header":false,"rowSpan":1,"colSpan":1},{"body":"能红（全量）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

◆ 为什么必须"增量优先 \+ 基线冻结"

 

直接对老项目"全量零告警"的要求，结果几乎一定是 **团队把检查关掉** 。 而"存量冻结、增量清零"能让 **新代码立刻达标** ，同时给旧代码留出清理时间 —— 它把一个大到无法完成的动作，拆成了每天都能完成的小动作。  *门禁的目标不是"今天零告警"，而是"告警数单调不增"。*

 

```zhizhan-anchor
ch8-12
```



## 8.12 测量与功耗分析进阶：数字背后的陷阱

 

§8.6 讲了怎么"测"。但测量本身有陷阱： **量出来的数和真值之间可能差着系统性误差** ， 而且这种误差往往是"看着合理"的。这一节讲清楚三个最常见的坑，以及功耗该怎么量。

 

```zhizhan-anchor
ch8-12-1
```



### 8.12.1 三个会骗你的测量陷阱

 

| 陷阱 | 为什么 | 怎么避免 |
| --- | --- | --- |
| **DWT 周期计数器回绕** | ` CYCCNT ` 是  **32 位** 。72 MHz 下 2³² 个周期 ≈  **59.6 秒** 就绕一圈；1 Hz 都不到就溢出。跨过回绕点计时，差值会突然变负或变小 | 计时前后都读一次、 **用无符号减法** （` end - start ` 自然处理一次回绕）；但 **一次测量不能超过 59.6 秒** ，长任务要分段累加。⚠ 一定用 ` uint32_t `，别用 ` int ` |
| **空闲/WFI 时计数器停了** | 某些核/配置下，进入低功耗或 WFI 时 DWT 可能停止计数。用它测"含休眠的循环"会 **严重低估** 墙钟时间 | 测含休眠的耗时，改用 SysTick 的毫秒计数或 RTC，别只用 CYCCNT；两者各测一遍对比 |
| **测量本身改变被测** | 打点 GPIO 要几条指令、翻转一个引脚有电容；在紧循环里插打点，测出来的"耗时"里包含了测量开销，甚至改变优化结果 | 要精确就 **用 DWT 记周期、不打 IO** ；要时序关系（看到中断插入）才用 GPIO 打点，并意识到那是"含观测开销"的视图 |

 

◆ DWT 与 GPIO 打点：一个测"多少"，一个测"关系"

 

**DWT/CYCCNT**  告诉你"这段花了多少个周期"——精确、无干扰，但它 **看不到并行发生的事** ： 中断什么时候插进来、两个外设谁先动。  **GPIO 打点（配示波器/逻辑分析仪）** 告诉你"时间轴上的先后与重叠"——能一眼看出"中断打断在主循环的哪一步"， 但精度受 IO 翻转速度限制。  *要"耗时"用 DWT，要"时序"用打点，两者结合才是完整的性能视图。*

 

```zhizhan-anchor
ch8-12-2
```



### 8.12.2 "指令数"不等于"周期数"

 

反汇编里数了 10 条指令，就以为要 10 个周期 —— 在 Cortex-M 上通常 **不对** ：

 

 
- **Flash 等待周期** ：MCU 主频高于 Flash 访问速度时，取指要插等待周期（F1 在 48 MHz 以上就要配 ` FLASH_ACR.LATENCY `）。一个"同样的函数"在 24 MHz 和 72 MHz 下的 **周期数可能差很多** 。
 
- **分支与流水线** ：跳转要冲刷流水线；间接调用（虚表）不可预测，代价更高。
 
- **总线竞争** ：DMA 在搬数据时，CPU 取指/取数要排队 —— 同一段代码"在有 DMA 时"更慢。
 
- **缓存（M7 等）** ：有 cache 时，冷/热路径的周期数能差一个数量级；测性能要区分"首次"与"循环内"。
 

 

✔ 结论：性能数字必须"连同条件一起说"

 

"这个函数 12 个周期"是 **不完整** 的结论。完整的说法是： " **在 -O2、Cortex-M3、72 MHz、无 DMA 争用、热运行** 下，是 12 个周期"。 换了主频、优化等级、内核，数字就会变 —— 这也是本站为什么反复强调"实测要附条件与命令"。

 

```zhizhan-anchor
ch8-12-3
```



### 8.12.3 功耗怎么量、怎么看

 

| 手段 | 能测什么 | 注意 |
| --- | --- | --- |
| 万用表串电流档 | 平均电流（mA 级） | 表内阻会造成压降，改变被测电路；测不了 µA 级和瞬时波形 |
| 分流电阻 \+ 示波器 | 电流 **波形** （µs 级瞬态） | 选合适阻值（既要足够压差、又别明显影响供电）；用高侧/低侧一致的方法 |
| 专用功耗分析仪 | 长时间 µA 级、自动算平均/峰值、与时间线对齐 | 贵；但低功耗产品几乎必需 |
| 目标板自带电量计 | 电池电压/电流、剩余电量 | 精度有限，适合"产品级验证"而非"设计阶段定位" |

 

算续航只做一件事： **把每个外设/阶段"电流 × 占空比"加起来** ，得到一个平均电流， 再用电池容量去除。下面是最小的一张功耗预算表模板：

 

| 阶段 | 电流 | 占空比 | 贡献（平均电流） |
| --- | --- | --- | --- |
| 深睡（RTC \+ RAM 保持） | 例：2 µA | 99.5% | ≈ 2 µA |
| 唤醒采集（MCU \+ 传感器） | 例：8 mA | 0.4% | ≈ 32 µA |
| 无线上报（发射峰值） | 例：120 mA | 0.1% | ≈ 120 µA |
| 合计 | — | 100% | **≈ 154 µA**  → 2000 mAh 电池约 1.5 年（理想） |

 

⚠ 功耗预算里最容易被忽略的三项

 

 
- **发射峰值拉低电压** ：无线发射瞬间的大电流会让电池电压跌落，可能触发欠压复位 —— 平均电流算得再漂亮，峰值得扛住（加大电容/选合适电池）。
 
- **外设"忘了关"** ：休眠时没关的 LDO、上拉电阻、传感器待机电流，往往是 µA 预算的主要超支项。
 
- **温度与老化** ：电池容量、时钟漂移、漏电流都随温度变；常温算出的续航，\`-20℃\` 可能要打折。

 

```zhizhan-anchor
ch8-12-4
```



### 8.12.4 带时间戳的 trace：ITM / RTT 的另一种用法

 

§8.2.1 讲用 ITM/RTT"打印字符串"。但它们在性能分析里还有更高阶的用法：  **输出"带时间戳的事件流"** ，而不是人读的日志。

 

| 做法 | 得到什么 | 适合分析 |
| --- | --- | --- |
| 往 ITM 某通道写一个字节/几个字节的 **事件码** | 主机侧按到达顺序和时间戳还原事件序列 | 任务切换频率、中断发生密度、"谁在什么时候动了" |
| 写 **变量值** （如队列长度、错误计数） | 一条时间序列，可直接画曲线 | 队列水位、堆水位、传感器读数趋势 |
| 配合  **DWT 时间戳**  / 主机接收时间 | 每个事件带时间轴 | "这帧处理花了多久""两次中断间隔是否规律" |

 

⚠ trace 本身会改变时序

 

往 ITM 写一个字节很快，但 **不是零成本** ；在紧循环里每个迭代都写一个事件， 既会拖慢程序，也可能因为 FIFO 满而 **丢事件** 。 原则： **只在你真正关心的点打事件** ，并用"计数校验"确认没丢 （比如主机收到的事件数应等于固件里的计数）。 *丢事件的 trace 比没有 trace 更危险——它会让你以为"这事没发生"。*

 

```zhizhan-anchor
ch8-12-5
```



### 8.12.5 功耗优化清单：从"哪在漏"到"怎么省"

 

降低平均功耗只有两条路： **降低"醒着时的电流"** ，或 **减少"醒着的时间"** 。 按下面的顺序查，通常能快速找到大头：

 

```zhizhan-table
{"rows":[[{"body":"方向","header":true,"rowSpan":1,"colSpan":1},{"body":"手段","header":true,"rowSpan":1,"colSpan":1},{"body":"常见收益","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**减少醒着的时间**","header":false,"rowSpan":1,"colSpan":1},{"body":"提高处理效率、缩短唤醒窗口、把多次采集合并成一次、用中断代替轮询","header":false,"rowSpan":1,"colSpan":1},{"body":"往往最大 —— 电流再低，醒得久也白搭","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**降低醒着的电流**","header":false,"rowSpan":3,"colSpan":1},{"body":"关掉未用外设的时钟（` RCC_AHBxENR/APBxENR ` 对应位置 0）","header":false,"rowSpan":1,"colSpan":1},{"body":"每关一个外设省几 mA","header":false,"rowSpan":1,"colSpan":1}],[{"body":"按需降频（跑完高频任务就降回低频）","header":false,"rowSpan":1,"colSpan":1},{"body":"动态功耗大致随频率线性/超线性下降","header":false,"rowSpan":1,"colSpan":1}],[{"body":"缩短无线发射时间、提高单次传输效率","header":false,"rowSpan":1,"colSpan":1},{"body":"发射是最贵的（几十~上百 mA），省一次是一次","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**休眠与 IO**","header":false,"rowSpan":4,"colSpan":1},{"body":"空闲执行 ` __WFI() ` / 进 SLEEP；更省用 STOP/STANDBY","header":false,"rowSpan":1,"colSpan":1},{"body":"从 mA 级降到 µA 级的关键一步","header":false,"rowSpan":1,"colSpan":1}],[{"body":"未用 IO 配成 **模拟输入** 或按需下拉，避免悬空","header":false,"rowSpan":1,"colSpan":1},{"body":"悬空输入会让输入级振荡耗电","header":false,"rowSpan":1,"colSpan":1}],[{"body":"外部上拉/下拉、分压电阻、LED 限流电阻按需断开","header":false,"rowSpan":1,"colSpan":1},{"body":"这些\"静态\"支路常被忽略，却持续耗电","header":false,"rowSpan":1,"colSpan":1}],[{"body":"传感器/外设按需上电，不用时进关断","header":false,"rowSpan":1,"colSpan":1},{"body":"很多传感器待机也有几十 µA","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ 最常见的四个"隐形漏电"

 

 
- **没关的外设时钟** ：你以为没用的外设，只要时钟开着就在耗电。
 
- **悬空的 IO** ：尤其是输入脚，电平在门槛附近来回 → 输入级持续导通。
 
- **调试单元** ：某些配置下调试模块会额外耗电；量产应关闭。
 
- **稳压器静态电流** ：LDO/DC-DC 自身的静态电流在 µA 预算里可能占大头。

 

✔ 方法：一次只关一项，量一次

 

定位漏电时，最有效的是 **逐项开关并测量** ： 关掉某个外设时钟/把某组 IO 设为模拟，看电流下降多少。做出一张"谁耗了多少"的清单后， 优化顺序自然就出来了。 *不要凭芯片手册的典型值拍脑袋 —— 你的板子上的实际电流，只有量了才知道。*

 

```zhizhan-anchor
ch8-13
```



## 8.13 现场诊断与远程运维：设备装出去之后怎么办

 

实验室里你有调试器、有串口、能复位。但设备一旦装到现场，" **打开调试器** "这件事就消失了。 这一节讲的是 **让设备在没有你的情况下，把证据带回来** 。 它和《通信协议与系统集成》里的 [OTA](term:ota) 是一体两面： **能升级，也要能诊断** 。

 

```zhizhan-anchor
ch8-13-1
```



### 8.13.1 现场证据清单：出问题前就该埋好

 

| 证据 | 存在哪 | 回答什么问题 |
| --- | --- | --- |
| 复位原因 | ` RCC_CSR ` 读后即清，另存日志/备份寄存器 | "为什么重启"（看门狗 / 上电 / 引脚 / 软件） |
| 重启计数 \+ 最后状态 | 备份寄存器 BKP（掉电保持） | "重启了几次""卡在哪一步" |
| 最近 N 条日志 | RAM 环形缓冲，复位后 dump | "重启前发生了什么" |
| 关键变量快照 | 崩溃/复位前把它们写入保留区 | "内存里当时是什么值" |
| 故障统计计数 | 按错误码分类计数，随遥测上报 | "是偶发还是普遍""哪类问题最多" |

 

⚠ RAM dump 的边界

 

想把"崩溃那一刻的整片 RAM"存下来，是很多人的第一反应，但在 MCU 上通常不现实：  **RAM 小、Flash 写入要擦除且寿命有限、掉电时 RAM 内容就没了** 。 现实的做法是 **有选择地快照** ——只保留"你事先认为关键"的那几十个字节（错误码、状态机状态、几个计数器）， 放进备份寄存区或一片专门的保留 RAM（` (NOLOAD) ` 段，不被启动清零）。  *关键不是"存得多"，而是"出问题时你恰好需要的那几个数，之前就决定要存"。*

 

```zhizhan-anchor
ch8-13-2
```



### 8.13.2 远程诊断通道：让设备能被"问话"

 

| 通道 | 适合 | 注意 |
| --- | --- | --- |
| 串口 CLI / shell | 现场有人、能接 USB-TTL 时 | 给一组只读命令（看变量、看统计、触发自检）；写命令要权限控制 |
| MQTT/HTTP 命令下行 | 联网设备，远程"问几个数" | 命令要[幂等](term:idempotency)、限流、鉴权；断网时的行为要定义清楚 |
| 周期遥测里的诊断字段 | 最省事、最常用 | 把"复位原因/重启计数/错误计数/RSSI/电压"塞进常规上报，不用额外通道 |
| 远程 dump 上传 | 需要完整日志时 | 分块上传 \+ 断点续传；注意流量与功耗 |

 

◆ 远程运维的三条纪律

 

 
1. **只读优先** ：诊断通道默认只读；任何"写/执行"命令都要显式鉴权，并记录审计日志。
 
2. **失败要可见** ：命令超时、设备离线、OTA 失败，都要在平台上明确呈现，而不是静默丢弃。
 
3. **升级要能回滚** ：远程诊断常和 OTA 同一通道； **没有回滚路径的 OTA 比不升级更危险** （详见协议册的 A/B 双区与回滚）。

 

```zhizhan-anchor
ch8-13-3
```



### 8.13.3 从"救火"到"防火"：把现场数据变成设计输入

 

单次故障的复盘（§8.7 / §8.15）解决的是"这一次"。但真正省钱的，是把多台设备的现场数据 **聚起来看趋势** ：

 

 
- **按错误码统计** ：哪类故障占比最高 —— 下一个版本的优先级就有了依据，而不是拍脑袋。
 
- **按批次/固件版本分组** ：某个版本故障率明显偏高，说明是回归，不是环境。
 
- **按时间/地域相关** ：集中在某时段/某区域，可能是供电或网络环境问题，而不是固件 bug。
 
- **闭环回设计** ：把高频现场问题反哺到测试用例（§7.6 的错误注入、§8.11 的门禁规则），让同类问题 **在出厂前就被拦住** 。
 

 

✔ 一句话

 

现场诊断的最高形态，不是"把每一个 bug 都查到"，而是 **让下一次同类 bug 不再流到现场**  —— 现场数据 → 复盘 → 测试/门禁 → 设计，形成闭环。

 

```zhizhan-anchor
ch8-13-4
```



### 8.13.4 日志落盘与现场检索

 

RAM 环形日志能扛住"重启后 dump"，但设备一旦重启、断电、或被远程收走，RAM 内容就没了。 要跨重启保留，就得 **落盘** （写进 Flash/EEPROM/外部存储）。落盘的关键不是"写得多"，而是" **该写的时候一定写得进去** "。

 

| 策略 | 做法 | 取舍 |
| --- | --- | --- |
| **触发式落盘** | 平时只写 RAM 环形缓冲； **出现 error / 看门狗临近 / 关键事件** 时，把缓冲整体写进 Flash 保留区 | 写入次数极少、磨损小；代价是"触发前的那段"要靠 RAM 缓冲覆盖住 |
| **周期落盘** | 固定时间把最近日志写盘 | 简单，但写次数多、磨损大；适合事件稀疏的设备 |
| **双区/乒乓** | 两块保留区轮流写，写到一半掉电也不丢上一份 | 占两份空间，但抗掉电 |
| **磨损均衡** | 轮换写不同扇区，避免同一页被反复擦写 | 算法稍复杂；对高写入频率的设备是必需的 |

 

◆ 检索时的三个抓手

 

 
- **时间戳** ：每条日志带相对/绝对时间，才能和"外部事件"（断电、断网、用户操作）对齐。 *没有时间戳的日志，事后几乎无法排序。*
 
- **事件码 \+ 上下文** ：别只写"error"，写清楚"哪个模块、什么错误码、当时的几个关键值"（见 §7.4 的错误上下文）。
 
- **序号** ：每条日志一个自增序号，能一眼看出"有没有丢段"（掉电时最容易丢的就是中间某一段）。

 

✔ 一条实用原则

 

落盘的内容要能回答" **出事前最后几十毫秒发生了什么** "。 所以最该保证的，是 **错误发生点的那一条连同它前面若干条，一定能留下来** （这就是"触发式落盘"的核心）—— 至于平时那些 info 级日志，丢了就丢了。

 

```zhizhan-anchor
ch8-13-5
```



### 8.13.5 日志后端：选一个还是挂多个

 

§7.5 的日志实现里有一个 ` log_sink_t ` 注册接口 —— 这意味着 **后端是可以换、也可以叠加的** 。 不同阶段用不同后端，是很实用的做法：

 

| 后端 | 适合阶段 | 特点 | 注意 |
| --- | --- | --- | --- |
| **串口** | 开发/调试早期 | 通用、任何板子都有；可读性好 | 阻塞式输出会拖时序；要关缓冲、别在中断里打 |
| **ITM/SWO** | 有 SWO 引脚的 STM32 | 不占业务串口、快 | 需 SWO 线 \+ ITM/TPIU 配置（§8.2.1） |
| **RTT** | 开发 \+ 现场 | 不占引脚、不休内核、掉电重启可重连 | 探针要支持；RAM 缓冲会占内存（§8.2.1） |
| **内存环形缓冲** | 现场（离线） | 崩溃/复位后可 dump 出最后几条（§7.5 / §8.13.4） | 断电即失；需配合落盘才能跨重启 |
| **存储落盘** | 现场（跨重启） | 保留更久 | 写次数有限、要磨损均衡与抗掉电（§8.13.4） |

 

◆ 一个推荐的组合

 

**RTT（开发时人读） \+ 内存环形缓冲（现场最后 N 条） \+ 触发式落盘（跨重启保留关键段）** ， 三者同时挂、各管一段。开发期用 RTT 看得爽，出厂后靠 RAM 缓冲与落盘救命。  *关键是：` log_sink ` 从设计上就支持多后端 —— 如果写日志时把它硬编码成"就是串口"，后期想加通道就得改一堆地方。*

 

⚠ 格式化的代价，以及"二进制事件"的取舍

 

每条日志都做一次 ` vsnprintf ` 是有成本的（尤其带 ` %f `）。 对 **高频、结构固定** 的事件（如"收到一帧"），更好的做法是 **只写一个事件码 \+ 少量数值** （二进制）， 让主机侧去解析和格式化 —— 固件只负责"记录发生了什么"，把"怎么显示"留给上位机。  *这能显著降低对时序的干扰，也减少丢日志。*

 

```zhizhan-anchor
ch8-14
```



## 8.14 故障案例集：15 个"一看症状就知道先查哪"的条目

 

这一节是一张 **索引表** ：按"你看到的现象"反查"最可能的原因"和"用本章哪个工具去验证"。 它不是穷举，但覆盖了实践中最常见的 15 类。遇到问题时，先在这里对号入座，比从零开始想要快得多。

 

| 现象 | 最可能的根因（按概率） | 怎么验证 | 修法 |
| --- | --- | --- | --- |
| 上电立刻 HardFault，PC≈0 | 向量表/栈顶地址错；启动代码没拷 ` .data `；空指针 | ` readelf -h ` 看入口；` nm ` 看 ` .isr_vector ` 位置；栈帧 PC \+ ` addr2line ` | 修正链接脚本；确认 ` _estack ` 是向量表偏移 0x00 的第一个字（初始 MSP）；偏移 0x04 是复位入口（§4.2） |
| 运行一段时间后复位 | 看门狗超时 / 栈溢出 / 供电跌落 | 读 ` RCC_CSR ` 复位原因（§8.5）；栈填充峰值（§8.5） | 多任务喂狗定位卡死任务；加大栈或消除深调用（§8.15） |
| 某全局变量莫名改变 | **栈溢出覆盖**  / 数组越界 / 野指针 | ` watch ` 该变量（§8.2）；栈峰值；MPU 哨兵（§8.5） | 修越界/野指针；加大栈；给缓冲区加边界检查 |
| 外设完全不工作 | 时钟没开（头号）/ 引脚复用冲突 / 寄存器写错 | 读 ` RCC_APBxENR ` 确认时钟位；读回配置寄存器；逻辑分析仪看引脚（§8.8） | 开时钟；核对 AFIO/重映射；读回验证写入 |
| 中断进不去 | NVIC 没使能 / 优先级分组错 / 向量表名不符 / 全局中断被关 | 读 ` NVIC_ISER ` 与 ` PRIMASK `；比对 ` startup_*.s ` 里的 ISR 名 | 使能中断；统一优先级分组；函数名与向量表逐字一致；` KEEP ` 向量表 |
| 中断只进一次，之后不来了 | 忘了清中断标志 | 在 ISR 末尾看有没有清 ` SR `/` PR ` 标志 | 进 ISR 先清标志（或按硬件要求先读后清） |
| 串口乱码 | 波特率不匹配 / 时钟源算错 / 电平极性 / 接地不良 | 逻辑分析仪量一位宽度反推波特率（§8.8）；示波器看空闲电平 | 对齐波特率与时钟源；RS-232 注意反相；共地 |
| I²C 读回全 ` 0xFF `/全 0 | 从机无 ACK / 上拉电阻缺失 / 地址错 / 总线死锁 | 抓 SCL\+SDA（§8.8）：有无 ACK、SDA 是否被拉低、SCL 是否被从机按住 | 加/改上拉；核对 7 位地址；总线死锁时发 9 个时钟恢复（§8.8） |
| SPI 数据整体错位 | CPOL/CPHA 与从机不一致 / CS 时序不对 | 抓 SCK\+MOSI\+CS（§8.8）：数据在哪个边沿被采样；CS 是否全程有效 | 对齐四种模式之一；保证 CS 在整帧期间有效 |
| -O0 正常，-O2 出错 | ` volatile ` 缺失 / 未定义行为（有符号溢出、越界、类型双关） | 开 ` -Wall -Wextra -Wconversion `；PC 上 ` -fsanitize=undefined ` | 补 ` volatile `；修 UB；寄存器映射用 ` volatile ` 指针 |
| ` printf("%f") ` 没输出 | newlib-nano 默认不带浮点格式化 | 看链接选项有没有 ` -u _printf_float ` | 加 ` -u _printf_float `（接受体积代价），或改用整数定点输出 |
| 固件比预期大很多 | ` printf `/` %f `、未裁剪 HAL、未 ` --gc-sections ` | ` size -A ` 看段；` nm --size-sort ` 看符号排行（§5.4） | ` --specs=nano.specs `；` -ffunction-sections -fdata-sections -Wl,--gc-sections `；去掉 ` %f ` |
| 烧进去没反应 | 烧录地址错 / 没烧向量表 / BOOT 引脚状态 | ` compare-sections `；确认 ` .isr_vector ` 在 ` 0x08000000 ` | 修正烧录地址；确认 BOOT0/BOOT1 从 Flash 启动 |
| 低功耗电流下不去 | 外设没关 / 没进 WFI / IO 悬空 / LDO 静态电流 | 逐项关外设测电流；功耗分析仪看波形（§8.12） | 空闲 ` __WFI() `；进 STOP/STANDBY；未用 IO 配成模拟/下拉 |
| M7 上 DMA 收到旧数据 | D-Cache 一致性：CPU 写还在 cache 里就启动 DMA | 关 cache 复测是否消失；或读回缓冲看新旧 | 传输前 clean cache、读回前 invalidate；或把 DMA 缓冲放在非 cache 区（§8.8 表末行） |

 

✔ 用这张表的两条纪律

 

 
- **先验证、再改** ：表里的"最可能"是 **排查顺序** ，不是结论。跳过验证直接改，很容易"改好了但也不知道为什么好"。
 
- **一次只改一个变量** ：同时改三处，问题消失了你也不知道是哪处起的作用 —— 下次它还会回来。

 

```zhizhan-anchor
ch8-15
```



## 8.15 贯穿案例：一次"每几天随机重启"的完整复盘

 

前面七节把工具拆开讲了。这一节把它们 **串成一条线** ——用一个真实世界里最常见的故障： "设备在实验室好好的，装到现场后每 3～5 天随机重启一次，重启前没有任何征兆，现场也没人守着"。 请把这里的每一步，当成你明天就要做的事。

 

◆ 第 0 步：先把现象量化（不量化就没法验证修好没有）

 

| 要问的问题 | 本例的答案（举例） |
| --- | --- |
| 多久发生一次？ | 约 3～5 天一次（平均 3.7 天），不是每天都发生 |
| 和什么相关？ | 阴雨天/信号差的安装点更容易出现（这条是后来才发现的） |
| 重启前后有什么现象？ | 重启前最后一条上报缺失；本地记录里数据不连续 |
| 能复现吗？ | 实验室复现不出——环境相关 |

 

*"每几天一次、和信号有关"这两条，已经把怀疑范围砍掉了一大半。*

 

◆ 第 1 步：让设备自己把证据带回来（现场保留三件套）

 

现场没有调试器，唯一能带回来的是 **掉电前写进"不掉电存储"的几个数** 。 在本章工具里，这三样必须在发现问题的当天就加上：

 

 
- **复位原因** （§8.5 ④ ` RCC_CSR `）：重启后读出来、写进日志，再清标志。
 
- **看门狗报到图** （§8.5 ④）：把 ` task_bitmap ` 存进备份寄存器 —— 复位的瞬间就知道是哪个任务没报到。
 
- **最近 N 条日志** （§7.5）：RAM 环形缓冲，重启后 dump。

 

◆ 第 2 步：用排除法收敛（症状 → 最可能 → 怎么验证）

 

| 候选原因 | 为什么怀疑 / 为什么不怀疑 | 验证 |
| --- | --- | --- |
| 看门狗复位 | 随机、周期性、无征兆——最像 | 读 ` RCC_CSR `；本步返回 ` IWDGRSTF `，命中 |
| 供电跌落 | 电池设备常见；但电压记录没有掉到阈值以下 | 读电池计量/欠压标志，排除 |
| HardFault 跑飞 | 也随机；但复位原因里没有 ` SFTRSTF `/异常痕迹 | 看门狗优先，先排它 |
| 栈溢出 | 可能；但栈峰值记录远没到 80% | 栈填充峰值（§8.5 ①），排除 |
| Flash 写坏 / 掉电 | 数据不连续像是"存了一半"；但写入有完整性校验 | 校验日志，排除 |

 

◆ 第 3 步：从"被狗咬"到"哪个任务卡死"

 

复位原因说是独立看门狗。 **但这只回答了"它是被狗咬的"，没回答"谁让狗饿了"。**  于是取出备份寄存器里的任务报到位图：每次都是 **同一个 bit 没置位** —— 无线发送任务。到这一步，问题从"整机随机重启"缩小到了"一个具体任务"。

 

*这就是多任务喂狗相对于"主循环无脑喂狗"的全部价值：它把"重启"翻译成了"某个任务的锅"。*

 

✕ 第 4 步：根因——发送任务没有超时上限

 

翻发送任务的代码，发现它在"发一帧、等 ACK"处写了这样一句：

 

` while (!ack_received()) { /* 空转 */ } `

 

**它没有超时上限。** 信号好时几毫秒就收到 ACK；信号差时对方根本不回应，这个 ` while ` 就永远转下去——任务再也不报到、狗再也不被喂，几天后看门狗复位。 这解释了全部现象：随机（和信号相关）、周期（看门狗超时）、无征兆（` while ` 转圈不产生任何异常）。

 

**它还解释了"为什么实验室复现不出"** ：实验室信号好，ACK 永远及时——缺陷在实验室里被完美地藏了起来。

 

✔ 第 5 步：修复与验证（"改完"不等于"修好"）

 

 
1. **加超时** ：把 ` while ` 换成"带期限的重试"——等待超过 N 毫秒就放弃本帧、返回错误码、让任务照常报到。
 
2. **让失败可观测** ：超时发生就记一条日志（含重试次数、RSSI），下次现场日志里能直接看到。
 
3. **验证** ：在实验室用衰减器/屏蔽箱人为制造弱信号，复现"发送必然超时"的场景，确认任务仍能报到、不再触发看门狗。
 
4. **长跑** ：改完不算完，至少跑一周（跨过原来 3～5 天的复发周期），并统计"重启次数 = 0"。

 

○ 复盘：这个案例里真正值钱的是哪几步

 

 
- **先量化再动手** ："每几天一次 \+ 和信号有关"这两句话的价值，超过一百行代码。
 
- **让设备自己作证** ：复位原因 \+ 任务位图 \+ 最近日志，是现场设备唯一能"开口"的方式。
 
- **把"随机"翻译成"具体"** ：看门狗多任务喂狗，把整机故障定位到一个任务。
 
- **警惕"实验室完美地藏起缺陷"** ：凡是和外部环境（信号、电源、温度）相关的缺陷，实验室大概率复现不出——要靠模拟环境或现场取证。
 
- **"改完"要跨过一个完整复发周期才算"修好"** ：3～5 天复发的 bug，改完只跑 3 小时是没有任何意义的。

 

```zhizhan-anchor
ch8-16
```



## 8.16 调试工具链全景与选型

 

§8.2 用的是 ST-Link \+ OpenOCD \+ GDB 这条链。但工具不止一条链，不同组合在手感、价格、协议支持上差别很大。 这一节给一张全景图，帮你在建项目时一次选对，而不是踩坑后换。

 

```zhizhan-anchor
ch8-16-1
```



### 8.16.1 三层结构：探针 / 服务端 / 前端

 

**FIG 8.5**  调试链的三个可替换层

 

```zhizhan-figure
<svg viewBox="0 0 660 120" width="660" height="120" role="img" aria-label="调试链三层">
          <rect x="20" y="40" width="150" height="46" rx="7" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="95" y="60" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--vio)">前端</text>
          <text x="95" y="76" class="sv-lbl-dim" text-anchor="middle">GDB / VSCode / IDE</text>
          <path d="M 172 63 L 236 63" class="msg"></path>
          <rect x="240" y="40" width="150" height="46" rx="7" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="315" y="60" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">服务端</text>
          <text x="315" y="76" class="sv-lbl-dim" text-anchor="middle">OpenOCD / pyOCD / GDB Server</text>
          <path d="M 392 63 L 456 63" class="msg"></path>
          <rect x="460" y="40" width="180" height="46" rx="7" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="550" y="60" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">探针 + 芯片</text>
          <text x="550" y="76" class="sv-lbl-dim" text-anchor="middle">ST-Link / J-Link / CMSIS-DAP</text>
        </svg>
```

 

记忆点： **换探针只影响最右边一层；换前端不影响服务端** 。 理解这三层的边界，"连不上"时就能按层排查（§8.2 的 SWD 排查顺序正是按这个分层的）。

 

```zhizhan-anchor
ch8-16-2
```



### 8.16.2 探针怎么选

 

| 探针 | 优势 | 代价 / 局限 | 适合 |
| --- | --- | --- | --- |
| **ST-Link** （板载/V2/V3） | 便宜、Nucleo/Discovery 自带；OpenOCD 支持好 | 主要面向 ST；V2 克隆固件升级易翻车 | STM32 学习与中小项目（首选） |
| **J-Link** | 速度与稳定性最好；RTT、无限断点（部分型号）、Trace | 贵；正版授权 | 专业开发、需要 RTT / 高速下载 |
| **CMSIS-DAP / DAPLink** | 开源、跨厂商、免驱（USB-HID）；常做成板载 | 速度一般 | 多厂商、教学、自研板集成 |
| **Black Magic Probe** | 把 GDB server 直接烧进探针， **不需要 OpenOCD** | 生态小 | 喜欢极简链路的人 |
| **ESP 内置 USB-JTAG** | S3/C3/H2 等自带，无需外接探针 | 经典 ESP32 没有，需外接 | ESP32-S3 等开发 |

 

```zhizhan-anchor
ch8-16-3
```



### 8.16.3 服务端与前端的组合

 

| 组合 | 特点 | 适合 |
| --- | --- | --- |
| OpenOCD \+ ` arm-none-eabi-gdb ` | 最通用、最可脚本化（§8.9 的 CI 回归就靠它） | 命令行党、CI、需要精细控制 |
| OpenOCD \+ VSCode（Cortex-Debug） | 图形界面 \+ 断点/变量/寄存器面板；配置写入 ` launch.json ` | 日常开发（推荐） |
| pyOCD | 纯 Python，易集成到自动化脚本；支持 CMSIS-DAP | 产测脚本、自动化 |
| J-Link GDB Server \+ Ozone | SEGGER 生态，RTT 集成好 | 用 J-Link 的团队 |
| STM32CubeIDE / Keil / IAR | 开箱即用、封装了前面所有层 | 不想碰命令行、或用厂商库 |
| PlatformIO | 跨平台、配置即代码、内置调试与上传 | 多框架、偏好工程化配置 |

 

✔ 选型建议（一句话）

 

**STM32 学习/中小项目：板载 ST-Link \+ OpenOCD \+ VSCode(Cortex-Debug)。**  需要 RTT 或追求稳定：上 J-Link。要接 CI：保留 ` arm-none-eabi-gdb --batch ` 那条命令行走法。  *无论用哪个前端，底层那条"GDB → OpenOCD → 探针"的链路知识都不变 —— 出问题时才知道往哪一层查。*

 

```zhizhan-anchor
ch8-16-4
```



### 8.16.4 IDE 调试配置要点（以 VSCode \+ Cortex-Debug 为例）

 

GUI 调试配置看起来繁琐，但它其实就是把命令行的几件事写进一个 JSON。抓住下面这几个字段，就不容易被"配置玄学"困住：

 

| 字段（大意） | 作用 | 对应命令行 |
| --- | --- | --- |
| 待调试的 ELF | 告诉调试器符号与地址从哪来 | ` arm-none-eabi-gdb firmware.elf ` |
| GDB 可执行路径 | 用哪个 gdb（必须是带 Arm 目标的那个） | — |
| GDB 服务端口 | 连到哪个 OpenOCD ` :3333 ` | ` target extended-remote localhost:3333 ` |
| 启动前命令 | 复位/停止/加载 | ` monitor reset halt ` \+ ` load ` |
| 会话前是否自动起 OpenOCD | 自动拉起服务端，省得手动开终端 | —（或先手动 ` openocd -f … `） |
| ` openocdLaunchCommands ` 等 | 指定探针/目标配置 | ` -f interface/… -f target/… ` |

 

⚠ 最常见的一次配置失败：忘了"先起服务端"

 

IDE 报"连接被拒绝/连不上"时，第一件事是确认  **OpenOCD（服务端）在跑** 、 端口与配置里写的一致。分层的三层结构（§8.16.1）意味着： **前端连不上，问题可能在服务端或探针，而不在 IDE** 。 先手动起一次 ` openocd ` 看它能不能识别目标，是最高效的分诊动作。

 

```zhizhan-anchor
ch8-17
```



## 8.17 常见编译/链接错误速读

 

这些错误信息本身不难，难的是 **知道它大概率来自哪一类错误** 。按"你看到的关键字"反查：

 

| 编译/链接提示（关键字） | 最可能的原因 | 下手的动作 |
| --- | --- | --- |
| ` undefined reference to 'xxx' ` | 符号没定义 / 忘了链接某个 .c 或 .a / 链接顺序不对 / 名字被 C\+\+ 修饰 | 确认定义存在；把提供者放在使用者之后；C/C\+\+ 混用加 ` extern "C" ` |
| ` multiple definition of 'xxx' ` | 头文件里定义了变量/函数（每个 .c 一份） | 头文件改 ` extern ` 声明 \+ 某个 .c 定义一次；确认 ` -fno-common ` |
| ` region 'RAM' overflowed by N bytes ` | 静态占用超过 RAM/Flash | 看 ` size -A ` 与 map；裁剪或加内存（§5.4） |
| ` implicit declaration of function 'xxx' ` | 缺头文件；C99 下隐藏；C23 起是硬错误 | 补 ` #include `；别靠隐式声明 |
| ` expected ';' before … ` / 一堆连锁报错 | 前一行漏分号 / 括号不匹配 / 宏展开异常 | 看 **第一条** 报错；必要时 ` -E ` 看预处理结果 |
| ` conflicting types for 'xxx' ` | 同一符号在不同 TU 声明类型不一致 | 统一到头文件；开 LTO 后 ` -Wlto-type-mismatch ` 会点名（§2.6） |
| ` undefined reference to '_start' / 'Reset_Handler' ` / 入口相关警告 | 没给链接脚本 / 入口符号缺失 / 忘了启动文件 | 确认 ` -T ` 脚本与 startup 文件都在（§4.2） |
| ` cannot find -lyyy ` | 库名拼错 / 库路径没给 / 该库不存在 | 补 ` -L ` 路径；确认库文件存在 |
| ` section '.xxx' will not fit ` / orphan section | 自定义段没在脚本里声明，被当成孤儿 | 在 ` .ld ` 里显式安置该段（§4.4） |
| ` LOAD segment with RWX permissions ` | 某段同时可读可写可执行（常因 ` .init_array ` 与 ` .text ` 同段） | 多为警告；评估是否要把可写段与代码分开（§5.4） |

 

◆ 一个通用习惯：从"第一条错误"开始读

 

编译器很"啰嗦"：一个漏掉的分号常常引发后面几十条 **连锁错误** 。 而连锁错误的行号大多落在错误之后。 **永远先修第一条** ，改完再重编 —— 很可能一次就消掉一大半。 链接错误则相反：往往要看 **最后一条** （真正缺的符号），前面的 "undefined" 是它的连锁。

 

```zhizhan-anchor
ch8-18
```



## 8.18 把调试基础设施组装起来

 

这一章给了你一堆零件：HardFault 处理器、日志、看门狗、复位原因、备份寄存器、栈监测、RTT。 但散装零件不等于"能用的系统"。这一节把它们 **组装成一个可以放进任何项目的最小诊断模块** ， 并给出各部分的调用时机。

 

```zhizhan-anchor
ch8-18-1
```



### 8.18.1 模块的组成与职责

 

| 部件 | 职责 | 来自 |
| --- | --- | --- |
| 启动期初始化 | 填栈图案、开 RTT/日志后端、读一次复位原因并记录、打开调试单元（低功耗保持） | §8.5 / §8.2.1 |
| 运行时低频心跳 | 周期检查栈峰值、堆水位、各任务报到、喂狗 | §8.5 |
| 错误路径 | 断言失败 / 错误码触发时，落盘最近日志、写备份寄存器、决定"复位还是继续" | §7.4 / §8.13 |
| 崩溃入口 | HardFault/MemManage/BusFault/UsageFault 统一进一个报告函数：打印栈帧 \+ CFSR 判读 \+ 最近日志 | §8.3 / §8.10 |
| 带外通道 | RTT/ITM 输出诊断，不影响主串口业务 | §8.2.1 |

 

```zhizhan-anchor
ch8-18-2
```



### 8.18.2 调用时机（谁在什么时候调什么）

 

| 时机 | 做什么 |
| --- | --- |
| ` main() ` 最开始 | 读并记录复位原因（读完清 RMVF）；初始化栈填充；初始化日志后端；可选开调试单元保持 |
| 进入主循环前 | 初始化看门狗（ **带 expected\_mask** ）；建立"哪些任务/环节要报到" |
| 低频定时（如 1 s） | ` stack_report() `（\>80% 告警）；检查堆水位；打一条心跳 |
| 每次错误码返回处 | 用 ` ERR_CHECK ` 记录"文件:行号 \+ 错误码"；严重错误走落盘 \+ 备份寄存器 |
| 看门狗喂狗前 | 确认所有 expected 任务都报到；未到齐则不喂（让它复位并留下位图） |
| 各 Fault Handler 入口 | 调同一个 ` fault_report() `：打印栈帧、CFSR 判读、dump 最近日志，然后停机或复位 |

 

```zhizhan-anchor
ch8-18-3
```



### 8.18.3 三条"接线"纪律

 

 
- **错误通道要有"不能丢"的底线** ：无论我们多小心，总会有"最严重的那次"发生在日志后端还没起来时 —— 所以"最后一条关键信息"应尽量走 **不依赖复杂初始化的路径** （例如直接写一个固定的 RAM 保留位置，而不是走整个日志系统）。
 
- **诊断代码本身不能成为故障源** ：日志后端的缓冲区、栈填充、看门狗钩子都要 **明确不占关键资源、不可重入点要加保护** 。一个"为了调试而引入的 bug"最难查（§8.7 的"海森堡 bug"）。
 
- **量产要能裁剪** ：诊断模块应能通过编译期开关整体关掉或降级（日志用 ` LOG_LEVEL ` 裁剪），别让调试设施在量产固件里占地方、耗功耗。
 

 

✔ 一条经验

 

把上面这套做成 **项目模板的一部分** （新建工程就自带），而不是"出问题时现加"。 现加的问题在于：等你需要它的时候，设备已经在现场了 —— 而那一版固件里恰恰没有这些设施。  *诊断能力和业务功能一样，要在设计阶段就规划进去。*

 

```zhizhan-anchor
ch8-19
```



## 8.19 从个人技巧到团队能力：调试也要工程化

 

一个高手能查 bug，不代表团队能稳定交付。真正拉开差距的，是 **把调试经验沉淀成团队资产** ： 清单、脚本、模板、以及一套"出了问题怎么协作"的约定。

 

```zhizhan-anchor
ch8-19-1
```



### 8.19.1 把经验变成资产的四类载体

 

| 载体 | 内容 | 为什么有效 |
| --- | --- | --- |
| **排查清单** | §8.7 / §8.14 那种"按症状索引"的表，随项目补充 | 把"某个人知道"变成"谁都能查"；新人不依赖老人 |
| **脚本与配置** | 调试脚本、` openocd.cfg `、CI 回归（§8.9 / §8.16） | 把重复动作自动化，减少人为差异 |
| **模板** | 带诊断基础设施的工程模板（§8.18） | 新项目一开始就有 HardFault 报告、日志、看门狗 |
| **案例库** | 每次真实故障的复盘记录（现象/根因/如何发现/如何预防） | 同一个坑不再踩第二次；也是最好的新人教材 |

 

```zhizhan-anchor
ch8-19-2
```



### 8.19.2 一次故障的协作流程

 

 
1. **记录（谁发现谁记）** ：现场人员/测试按统一模板记录 —— 现象（带数字/条件/范围）、环境（固件版本/硬件批次）、已有的证据（复位原因/日志片段）。
 
2. **分诊（谁负责谁定级）** ：按 §8.14 的"症状→最可能"先给方向，判断是"已知问题"还是"新问题"，定优先级。
 
3. **定位与修复（开发）** ：用本章工具链定位； **每一步验证都写进记录** ，方便别人复现。
 
4. **回归（测试/CI）** ：把这次的问题 **补成一条测试或一条门禁规则** （§7.6 / §8.11.4），让同类问题被自动拦住。
 
5. **沉淀（全员）** ：更新清单、案例库、模板；该加的自检加上（§8.5.3）。
 

 

```zhizhan-anchor
ch8-19-3
```



### 8.19.3 三个反模式

 

| 反模式 | 后果 |
| --- | --- |
| **"口头传功"** ：经验只在某个人脑子里 | 他一休假/离职，同类问题就没人会查；知识无法积累 |
| **"改完就完"** ：修好了不补测试、不补清单 | 同一个坑在下一个版本/下一台设备复发；返工成本远高于补一条测试 |
| **"靠猜就好"** ：跳过测量与验证，凭直觉改代码 | 问题偶尔"消失"了但没找到根因，下一次以更隐蔽的形式回来（§8.15 的信号弱场景就是典型） |

 

◆ 一句话总结这一章

 

调试的终极目标，不是"我多会查 bug"，而是 **"让团队越来越少地依赖查 bug"** —— 用检查把问题提前、用诊断让它可见、用复盘让它不再复发。  *能把一次故障变成"以后不会再发生",才算真正把它解决了。*

 

◆ 本章要点

 

 
- 调试四步循环： **观察 → 假设 → 实验 → 验证** 。铁律是"一次只改一个变量"。
 
- 现象描述必须带 **数字、条件、范围** 。"100 次里有 3 次"和"每次都这样"是不同的问题。
 
- **二分法是最有效的单一技巧** ：1000 行代码只需 10 次检查点。
 
- 调试链路： **GDB → OpenOCD → ST-Link → 目标芯片** 。知道分层才能排查"连不上"。
 
- 三个改变效率的命令： **` bt `（怎么走到这里的）、` watch `（谁改的变量）、条件断点** 。
 
- **HardFault 栈帧里的 PC 就是出错指令地址** ，用 ` addr2line ` 直接查出源码行号。
 
- 五类故障对照： **PRECISERR\+BFAR≈0 → 空指针；STKERR → 栈溢出；INVSTATE → 函数指针 LSB=0；UNALIGNED → 类型双关** 。
 
- ` IMPRECISERR ` 时，在  **Cortex-M3/M4**  上开 ` SCB->ACTLR |= (1<<1) `（DISDEFWBUF）禁用写缓冲，把不精确错误变精确； *M0/M0\+ 没这一位，M7 的位定义不同，不能照抄* 。
 
- 静态分析： **` -Wconversion ` 是嵌入式最重要的一条警告** （截断是头号隐蔽 bug）；` cppcheck ` 抓越界；` -fanalyzer ` 抓跨函数路径问题。
 
- 运行时检测： **栈填充图案测峰值、MPU 哨兵、看门狗多任务喂狗、复位原因寄存器** 。
 
- 性能分析： **DWT 周期计数器测函数耗时，GPIO 打点看时序关系** （能看出中断干扰，DWT 看不出）。
 
- 警惕 **调试本身引入的 bug** ：断点和 printf 都会改变时序，让时序敏感的 bug 消失。

 

◆ 自测 · Module 08（先答再看）

 

 
1. 简答：拿到一个 HardFault，第一步该干什么？靠哪条命令落到源码行？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"先进 ` HardFault_Handler `，从异常栈帧里读出出错指令的  **PC** （和 ` LR `、` xPSR `），再用 ` arm-none-eabi-addr2line -e fw.elf -f -C <PC> ` 换算成\"文件:行号\"。 *PC 就是出错那一条指令的地址。*"}
   ```
 
2. 填空：` CFSR ` 里 ` STKERR ` 置位说明发生了 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"异常 **入栈（压栈）时总线出错** ——最常见的原因就是 **栈指针指向了非法或已耗尽的内存** ，也就是栈溢出。它属于 BFSR（BusFault）那一组。"}
   ```
 
3. 简答：semihosting、ITM/SWO、SEGGER RTT 三条 printf 通道，本质区别是什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"semihosting：遇到 ` printf ` 触发 ` BKPT ` 把 CPU  **交给调试器** ，由主机完成输出——慢、没调试器就挂死；ITM：固件把字节写进  **SWO 引脚的硬件 FIFO** ，需要接出 SWO 线并配 ITM/TPIU；RTT： **RAM 环形缓冲 \\+ 探针后台 DMA 读** ，不占额外引脚、不休内核，最适合量产现场日志。"}
   ```
 
4. 简答：GDB 的 ` watch `（数据断点）是用来干什么的？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"盯住\"某个变量被写（或读）的时刻\"。排查\"变量莫名被改\"时， **让硬件告诉你谁改的** ，比读代码猜快得多；命中断点后 ` bt ` 一看就知道是哪个函数干的。"}
   ```
 
5. 找错：崩溃时 ` printf ` 日志"前面都打了、最后一段全没了"，最可能的原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"stdout 默认 **全缓冲** ：最后一段还在缓冲里没刷出去，崩溃时随 RAM 一起丢失。解决：` setvbuf(stdout, NULL, _IONBF, 0) ` 关缓冲、关键日志 ` fflush `，或改用 ITM/RTT。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 08 完成？**  把 8.3 的 HardFault 处理器加进你的项目，主动制造一次空指针解引用试试。

 

```zhizhan-assessment
{"id":"course-b01-ch8","criterion":"保留一次故障的寄存器/栈/反汇编证据，指出最小复现和修复后的反例测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[GNU GDB · 调试、内存与寄存器](https://sourceware.org/gdb/current/onlinedocs/gdb.html/) · [Arm Cortex-M 架构文档](https://developer.arm.com/documentation/ddi0403/latest/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
