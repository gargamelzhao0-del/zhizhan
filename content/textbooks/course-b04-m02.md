# MicroPython 深入

```zhizhan-anchor
m02
```



把 Python 跑在 MCU 上，代价与边界都来自"解释器 \+ 堆"。这一节讲清 MicroPython 的 **内存与 GC** 、 ` machine ` 模块、定时中断，以及两个提速/扩展手段：` viper ` 与 C 模块。

 

> ◷ 约 70 分钟 · ◈ GC · machine · 定时中断 · viper · ⚑ 边界就在内存

 

```zhizhan-anchor
m02-1
```



## 2.1 运行时与内存：解释器 \+ 堆 \+ 固件

 

**FIG 2.1**  MicroPython 运行时：固件（Flash）与 GC 堆（RAM）各占一块

 

```zhizhan-figure
<svg viewBox="0 0 660 210" role="img" aria-label="MicroPython 在 Flash 与 RAM 上的组成">
          <rect x="30" y="28" width="600" height="40" rx="6" class="sv-box"></rect>
          <text x="46" y="53" class="sv-lbl-hi">Flash：固件（解释器 + 内建模块 + frozen bytecode）</text>
          <text x="614" y="53" class="sv-lbl-dim" text-anchor="end">写一次，掉电不丢</text>
          <rect x="30" y="84" width="380" height="44" rx="6" class="sv-grn-s"></rect>
          <text x="46" y="106" class="sv-lbl-hi">RAM：GC 堆（对象、字符串、list/dict…）</text>
          <text x="46" y="122" class="sv-lbl-dim">运行时分配 → 由 GC 回收；空间有限</text>
          <rect x="420" y="84" width="210" height="44" rx="6" class="sv-amb-s"></rect>
          <text x="436" y="106" class="sv-lbl-hi">RAM：C 栈 + 静态区</text>
          <text x="436" y="122" class="sv-lbl-dim">固件与中断用</text>
          <text x="30" y="162" class="sv-lbl-dim">GC 触发时机不确定 → 实时路径避免运行期分配；<tspan style="fill:var(--grn)">用 gc.mem_free() 观察水位</tspan>。</text>
          <text x="30" y="186" class="sv-lbl-dim" style="fill:var(--amb)">Flash 里还有一块可选文件系统（放 .py），或把核心模块 frozen 进固件。</text>
        </svg>
```

 

理解这张图就理解了一半边界： **Flash 放"不会变的东西"（固件\+可选 frozen 模块），RAM 靠 GC 管"运行时对象"** 。内存不足、GC 停顿都出在 RAM 那一块。

 

内存紧张时可主动回收：` gc.collect() `，并配合 ` gc.mem_free() ` 观察堆水位——这也是排查"跑着跑着 OOM"的第一步。

 

```zhizhan-anchor
m02-2
```



## 2.2 ` machine ` 模块：GPIO / UART / Timer

 

` machine ` 是设备端 Python 与硬件之间的接口层：` machine.Pin `、` machine.UART `、` machine.Timer `，配合 ` time.sleep_ms ` 等。它比 C 的寄存器操作高一层，因此也用不到指针/位掩码——这正是它"上手快"的原因，也是"控制力有限"的原因。

 

machine\_demo.py — GPIO / UART / Timer 的最小用法 Python

 

```text
# machine_demo.py —— 跑在 MCU 上（ESP32）
from machine import Pin, UART
import time

led = Pin(2, Pin.OUT)
uart = UART(1, baudrate=115200, tx=17, rx=16)

def heartbeat():
    led.value(not led.value())      # 翻转
    uart.write(b"HB\n")             # 发一行给上位机

while True:
    heartbeat()
    time.sleep_ms(1000)
```

 

```zhizhan-anchor
m02-3
```



## 2.3 定时中断：在中断里只做"最小的事"

 

用 ` machine.Timer ` 周期回调替代"主循环里 sleep 计数"——定时更准，也让主循环空出来干别的。 但要注意： **MicroPython 的回调运行在中断上下文** ，和 C 的 ISR 纪律一样——不做重活、不长时间分配/打印。

 

timer\_isr.py — 定时中断 \+ 主循环分工 Python

 

```text
# timer_isr.py —— 中断里只翻转标志，重活留给主循环
from machine import Pin, Timer
import time

led = Pin(2, Pin.OUT)
flag = False                     # 简单共享标志

def tick(t):
    global flag
    flag = True                  # 中断里：只做最短的操作

tim = Timer(0)
tim.init(period=500, mode=Timer.PERIODIC, callback=tick)   # 每 500ms

while True:
    if flag:
        flag = False
        led.value(not led.value())   # 重活放主循环
    time.sleep_ms(10)
```

 

⚠ 中断回调里的三条纪律（与 C 的 ISR 完全一致）

 

 
- **不做重活** ：不要在里面做长循环、复杂计算；只置标志/入队。
 
- **谨慎分配/打印** ：回调里创建对象或 ` print ` 可能触发 GC 或阻塞，拉长中断时间。
 
- **共享变量要小心** ：MicroPython 下同样有"主循环与中断同时读写"的问题；能用"中断只写、主循环只读的单字标志"就用它。

 

```zhizhan-anchor
m02-4
```



## 2.4 提速：` viper ` 与 ` native `

 

纯 Python 的逐字节处理在 MCU 上很慢。` @micropython.viper ` 让函数走 **定长整数** 的专门编译路径，接近机器码； ` @micropython.native ` 是中间的收益。代价是 **类型受限、不能用任意 Python 特性** 。

 

viper\_crc.py — 用 viper 加速逐位 CRC8 Python

 

```text
# viper_crc.py —— 用 viper 把热点函数编成近机器码
import micropython

@micropython.viper
def crc8(data: ptr8, n: int) -> int:
    c = 0
    for i in range(n):
        c ^= data[i]
        for _ in range(8):
            c = ((c << 1) ^ 0x07) & 0xFF if (c & 0x80) else (c << 1) & 0xFF
    return c

buf = bytearray(b"hello")
print(crc8(buf, len(buf)))
```

 

◆ viper / native 的取舍

 

 
- ` viper `：最快，但类型是 ` int/ptr/ptr8/ptr16/ptr32 ` 等定长，整数运算可能回绕； **只在热点函数上用** 。
 
- ` native `：比普通 Python 快、比 viper 宽松；作为中间档。
 
- 把它们 **局部** 用在数据密集循环（CRC/协议解析/滤波），而不是整段程序——否则可读性与兼容性双输。

 

```zhizhan-anchor
m02-5
```



## 2.5 与 C 扩展：什么时候必须下沉

 

MicroPython 允许用 C 写"用户模块"（user C module），编进固件后像内建模块一样 ` import `。 当某个操作"Python 写不了或太慢"（例如精确时序、专有外设、[DMA](term:dma) 精调），就把它做成 C 模块，Python 侧只留调用。 这其实是 M01"分工边界"在 **板子内部** 的又一次重演： **热/严的部分下沉到 C，胶水与逻辑留在 Python** 。

 

**FIG 2.2**  MicroPython 的运行时与内存

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="解释器 + 堆 + 固件；堆小、GC 会停顿，实时任务要避开分配">
          <rect x="30" y="40" width="180" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="120" y="63" class="sv-lbl-hi" text-anchor="middle">解释器</text>
          <text x="120" y="83" class="sv-lbl-dim" text-anchor="middle">逐字节执行</text>
          <rect x="240" y="40" width="180" height="56" rx="6" class="sv-cyn-s"></rect>
          <text x="330" y="63" class="sv-lbl-hi" text-anchor="middle">堆（小）</text>
          <text x="330" y="83" class="sv-lbl-dim" text-anchor="middle">对象分配源</text>
          <rect x="450" y="40" width="180" height="56" rx="6" class="sv-red-s"></rect>
          <text x="540" y="63" class="sv-lbl-hi" text-anchor="middle">GC 停顿</text>
          <text x="540" y="83" class="sv-lbl-dim" text-anchor="middle">实时任务避开</text>
        </svg>
```

 

ISR 里尽量不分配对象：分配可能触发 GC，带来不可预测的停顿。

 

| 能力 | 能否在 ISR 里做 | 原因 |
| --- | --- | --- |
| 置标志 / 写寄存器 | 能 | 不分配、快 |
| 分配对象 / 建列表 | 不建议 | 可能触发 GC |
| 打印 / 字符串格式化 | 不建议 | 慢且分配 |
| 复杂计算 | 下沉主循环 | 占用中断时间 |

 

| 提速手段 | 效果 | 代价 |
| --- | --- | --- |
| ` @micropython.viper ` | 整数运算大幅提速 | 类型受限 |
| ` @micropython.native ` | 整体提速 | 体积变大 |
| C 扩展模块 | 接近原生 | 需编译固件 |

 

| machine 模块 | 用途 | 要点 |
| --- | --- | --- |
| ` Pin ` | GPIO | 输入/输出/上下拉 |
| ` UART ` | 串口 | 波特率一致 |
| ` Timer ` | 定时/中断 | 回调要短 |
| ` ADC ` | 模拟采集 | 参考电压/量程 |

 

**bash**  — 复跑：` python tools/probes/m02_src/viper_crc.py `（本机真实运行）

 

◆ 迁移练习

 

把一个"在定时中断里做 CRC 计算"的 MicroPython 写法改成"中断只置标志、主循环算"，说明实时性的变化。

 

| 内存关注点 | 做法 | 避免 |
| --- | --- | --- |
| 堆分配 | 预先建好对象 | 循环里反复建列表 |
| GC | 关键路径避开 | 中断里分配 |
| 大缓冲 | 用 ` bytearray ` | 频繁切片 |
| 字符串 | 少拼接 | 循环里 ` += ` |

 

◆ 本章要点

 

 
- MicroPython = 固件（Flash） \+ GC 堆（RAM）；边界与问题都在 GC 堆。
 
- ` machine.Pin/UART/Timer ` 是设备端接口；比寄存器高一层、上手快、控制力有限。
 
- 定时中断里只做最小操作（置标志），重活留给主循环——与 C 的 ISR 纪律一致。
 
- ` viper `/` native ` 局部加速热点；类型受限，别滥用。
 
- 写不了/太慢的部分用  **C 用户模块** 下沉，是"板内分工"。

 

◆ 自测 · Module 02（先答再看）

 

 
1. 简答：MicroPython 的"内存不足"与"偶发卡顿"通常出在哪一块？为什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"出在 RAM 的  **GC 堆** 。运行时创建的对象由垃圾回收管理，堆小、触发时机不确定，回收时可能停顿；实时路径应避免运行期分配。"}
   ```
 
2. 判断：` machine.Timer ` 的回调里可以随便 ` print ` 和建 list。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不可以。回调运行在中断上下文，创建对象/打印可能触发分配或阻塞，拉长中断时间。应只置标志/入队，重活交给主循环。"}
   ```
 
3. 诊断：一段逐字节 CRC 在 MicroPython 上太慢，首选什么办法？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"先把该热点函数改成 ` @micropython.viper `（定长整数、近机器码）；若仍不满足，再考虑用 C 用户模块下沉。"}
   ```
 
4. 动手：用 ` gc.mem_free() ` 在主循环前后各打印一次，观察在循环里不断 ` append ` 一个 list 时堆水位如何变化。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会看到可用堆持续下降；触发 GC 后回升。这直观说明\"运行期分配 → GC 回收\"的代价，也是为什么中断/热路径要避免分配。"}
   ```
 
5. 判断：MicroPython 的 C 用户模块与"上位机 Python 调 C 库"是同一回事。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。C 用户模块是把它 **编进 MCU 固件** 、在设备端被 Python import；上位机 Python 调 C 库是 PC 侧的事。两者是\"板内分工\"与\"跨机分工\"的区别。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 02 完成？**  在 ESP32 上跑一次 ` timer_isr.py `，用 REPL 观察 ` gc.mem_free() ` 在长时间运行后是否稳定。

 

```zhizhan-assessment
{"id":"course-b04-m02","criterion":"在目标解释器记录 GC、分配、ISR 限制；测量最坏延迟而不照搬桌面 Python。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
