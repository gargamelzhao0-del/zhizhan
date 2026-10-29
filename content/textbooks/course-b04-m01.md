# 定位与边界

```zhizhan-anchor
m01
```



Python 在嵌入式里有两个位置： **上位机** （PC 上的工具/分析/CI）与 **设备端** （MicroPython 固件）。 混淆这两者，是新手最常见的方向性错误。这一节先把"什么该放哪"划清楚。

 

> ◷ 约 55 分钟 · ◈ CPython / MicroPython / CircuitPython · ⚑ 先分清位置

 

```zhizhan-anchor
m01-1
```



## 1.1 三种 Python，别混为一谈

 

| 实现 | 跑在哪 | 特点 / 适用 |
| --- | --- | --- |
| **CPython** | PC / 服务器 / Linux 边缘设备 | 标准库齐全、第三方库海量；本册的 **上位机主角** （pyserial/numpy/pandas/matplotlib） |
| **MicroPython** | MCU（ESP32/STM32/RP2040） | 固件里带解释器，约 256KB Flash 起；` machine ` 直接操作外设；支持 ` viper ` 加速 |
| **CircuitPython** | MCU（Adafruit 生态） | MicroPython 分支：USB 拖拽式部署、库友好；性能与底层控制略弱于原版 |

 

一句话： **CPython 是"工具"，MicroPython 是"设备上的一层薄抽象"** 。前者决定你的开发效率，后者决定你能不能把 Python 直接跑在板子上。

 

```zhizhan-anchor
m01-2
```



## 1.2 分工边界：什么放设备端、什么放上位机

 

**FIG 1.1**  分工边界：硬实时与体积敏感留给设备，计算与流程留给上位机

 

```zhizhan-figure
<svg viewBox="0 0 660 236" role="img" aria-label="设备端与上位机的职责分工">
          <rect x="24" y="30" width="280" height="182" rx="8" class="sv-amb-s"></rect>
          <text x="164" y="54" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--amb)">设备端 · MCU</text>
          <text x="40" y="80" class="sv-lbl-dim">▸ 硬实时：中断、DMA、控制环</text>
          <text x="40" y="102" class="sv-lbl-dim">▸ 极致体积/功耗</text>
          <text x="40" y="124" class="sv-lbl-dim">▸ 寄存器级时序</text>
          <text x="40" y="146" class="sv-lbl-dim">▸ 长期无人值守运行</text>
          <text x="40" y="176" class="sv-lbl-dim" style="fill:var(--amb)">语言：C / C++ / Rust（MicroPython 仅原型）</text>
          <rect x="356" y="30" width="280" height="182" rx="8" class="sv-cyn-s"></rect>
          <text x="496" y="54" class="sv-lbl-hi" text-anchor="middle" style="fill:var(--cyn)">上位机 · PC / 边缘</text>
          <text x="372" y="80" class="sv-lbl-dim">▸ 串口收发与协议测试</text>
          <text x="372" y="102" class="sv-lbl-dim">▸ 数据分析 / 画图 / 报告</text>
          <text x="372" y="124" class="sv-lbl-dim">▸ 批量构建、烧录、回归</text>
          <text x="372" y="146" class="sv-lbl-dim">▸ 数据集与模型准备</text>
          <text x="372" y="176" class="sv-lbl-dim" style="fill:var(--cyn)">语言：Python（CPython）</text>
        </svg>
```

 

判断口诀： **与"时间/体积/功耗"强相关 → 设备端；与"效率/数据/流程"强相关 → 上位机** 。MicroPython 只在"设备端但要求不高"的缝隙里用。

 

```zhizhan-anchor
m01-3
```



## 1.3 同一件功能：MicroPython 与 CPython 写法对照

 

功能相同——"点亮 LED、按秒闪烁、打印状态"。左边是设备端 MicroPython（` machine ` 直接操作硬件）， 右边是上位机 CPython（通过串口与设备交互）。注意 ` time.sleep_ms ` 与 ` time.sleep ` 这类"看着像、其实不同"的 API。

 

blink\_mp.py — 设备端 MicroPython：直接操作硬件 Python

 

```text
# blink_mp.py —— 跑在 MCU 上的 MicroPython（ESP32/STM32）
from machine import Pin
import time

led = Pin(2, Pin.OUT)          # 设备端：直接拿到一个引脚对象

n = 0
while True:
    led.value(n % 2)           # 0/1 翻转
    time.sleep_ms(500)         # MicroPython 特有的毫秒延时
    print("tick", n)           # 经串口 REPL / UART 输出
    n += 1
```

 

monitor\_pc.py — 上位机 CPython：通过串口观察设备 Python

 

```text
# monitor_pc.py —— 跑在 PC 上的 CPython（需要 pyserial）
import serial
import time

# 打开设备串口（端口名按你的系统改）
with serial.Serial("COM5", 115200, timeout=1) as ser:
    while True:
        line = ser.readline()          # 读到换行；空表示超时
        if line:
            print("设备:", line.decode(errors="replace").strip())
        time.sleep(0.1)
```

 

◆ 三个"看着一样、其实不同"的点

 

 
- ` time.sleep_ms `（设备端，整数毫秒）vs ` time.sleep `（上位机，浮点秒）——写错就是"睡 0 秒"或"睡 500 秒"。
 
- 设备端 ` print ` 走 REPL/UART 调试口， **不是**  PC 的终端；上位机要看，得用 pyserial 读。
 
- 设备端内存以 KB 计：` while True ` 里别不断创建对象（GC 停顿，见 M02）。

 

```zhizhan-anchor
m01-4
```



## 1.4 什么时候 **别** 用 MicroPython

 

| 需求 | 结论 |
| --- | --- |
| 硬实时（μs 级中断响应、严格抖动） | 不用——解释器与 GC 会带来不可控抖动 |
| 极致 BOM（几 KB Flash / 极低功耗） | 不用——解释器本身就要几百 KB |
| 寄存器级时序、[DMA](term:dma) 精调 | 不用——用 C/Rust；MicroPython 只暴露高层 API |
| 快速原型、教学、胶水逻辑、现场脚本 | 合适——改一行即生效，REPL 即时验证 |

 

⚠ 本册的立场

 

**设备端主力仍是 C/C\+\+/Rust（见第①②③册）** ；MicroPython 是"在某些场合更快的选择"，不是替代。 而上位机 Python 几乎 **总是** 值得——它把验证与迭代的成本降到很低。

 

```zhizhan-anchor
m01-5
```



## 1.5 选择清单：设备端还是上位机

 

**FIG 1.2**  把功能分到设备端与上位机

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="硬实时、离线、低延迟放设备端；重计算、可视化、联网放上位机">
          <rect x="30" y="40" width="230" height="60" rx="6" class="sv-cyn-s"></rect>
          <text x="145" y="62" class="sv-lbl-hi" text-anchor="middle">设备端（MicroPython）</text>
          <text x="145" y="82" class="sv-lbl-dim" text-anchor="middle">实时·离线·省资源</text>
          <rect x="300" y="40" width="230" height="60" rx="6" class="sv-grn-s"></rect>
          <text x="415" y="62" class="sv-lbl-hi" text-anchor="middle">上位机（CPython）</text>
          <text x="415" y="82" class="sv-lbl-dim" text-anchor="middle">重计算·可视化·联网</text>
          <text x="600" y="72" class="sv-lbl-dim" text-anchor="middle">按需分工</text>
        </svg>
```

 

判断标准：是否需要"硬实时/离线/毫秒级"，是则下沉设备端，否则放上位机更省事。

 

choose.py — 用一条判断做分工决策 Python

 

```text
def where_to_run(need_hard_realtime, offline, ms_latency):
    if need_hard_realtime or offline or ms_latency:
        return "device (MicroPython)"
    return "host (CPython)"

print(where_to_run(True, False, False))   # device
print(where_to_run(False, False, False))  # host
```

 

**bash**  — 复跑：` python tools/probes/m01_src/choose.py `（本机真实运行）

 

| 需求 | 放设备端 | 放上位机 |
| --- | --- | --- |
| 硬实时控制 | ✓ |  |
| 离线运行 | ✓ |  |
| 数据可视化 |  | ✓ |
| 复杂分析/训练 |  | ✓ |

 

| 写法差异 | MicroPython | CPython |
| --- | --- | --- |
| 硬件访问 | ` machine ` 模块 | 无（用串口/网络） |
| 内存 | 很小，需省 | 大 |
| 标准库 | 精简 | 完整 |

 

◆ 迁移练习

 

列出你项目里的功能，逐条判断"设备端还是上位机"，并说明理由（实时性/离线/资源）。

 

◆ 本章要点

 

 
- CPython（上位机）与 MicroPython/CircuitPython（设备端）是两种定位，别混用。
 
- 分工口诀：时间/体积/功耗敏感 → 设备端；效率/数据/流程 → 上位机。
 
- 同一功能写法不同：` machine.Pin ` \+ ` time.sleep_ms `（设备）vs ` pyserial ` \+ ` time.sleep `（上位机）。
 
- 硬实时、极致体积、寄存器时序——不要用 MicroPython。
 
- 上位机 Python 几乎总值得投入：它决定你的验证速度。

 

◆ 自测 · Module 01（先答再看）

 

 
1. 判断：MicroPython 就是在单片机上跑 CPython。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。MicroPython 是为 MCU 裁剪的 **独立实现** ，只实现 Python 3 的一个子集，另有 ` machine ` 等硬件模块；CPython 无法在几 KB 的 MCU 上运行。"}
   ```
 
2. 简答：一个"每 100μs 响应一次外部中断并翻转引脚"的需求，该用 MicroPython 吗？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不该。硬实时与严格抖动超出 MicroPython 能力（解释器开销 \\+ GC 停顿）；这类需求应放设备端 C/C\\+\\+/Rust。"}
   ```
 
3. 诊断：有人写 ` time.sleep(500) ` 想做"延时 500 毫秒"，为什么在设备端不对？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"MicroPython 的 ` time.sleep ` 单位是秒，500 会睡 500 秒；毫秒延时应用 ` time.sleep_ms(500) `。"}
   ```
 
4. 动手：写一个上位机脚本，用 pyserial 打开串口、打印每一行；再写设备端 MicroPython 用 ` print ` 每秒输出一行。想一想两边各自运行在哪。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"设备端 ` print ` 输出到 REPL/UART；上位机用 ` ser.readline() ` 读并显示——这正是 §1.3 两段代码的合用方式。"}
   ```
 
5. 判断：既然有了 MicroPython，嵌入式就不需要 C/C\+\+/Rust 了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。MicroPython 只覆盖\"要求不高\"的缝隙；硬实时、极致体积、寄存器时序仍是 C/C\\+\\+/Rust 的领域。它是补充，不是替代。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 01 完成？**  把你手上一个嵌入式需求，按 §1.2 的口诀拆成"设备端做什么、上位机做什么"两栏。

 

```zhizhan-assessment
{"id":"course-b04-m01","criterion":"把工具分析与硬实时控制分开，测量瓶颈后说明选择 Python 的理由。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
