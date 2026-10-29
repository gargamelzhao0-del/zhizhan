# 上位机 GUI 与调试台

```zhizhan-anchor
m06
```



命令行脚本适合自动化，但"边调边看"时一个带 **实时曲线** 和 **命令面板** 的小工具效率更高。 这一节用标准库 ` tkinter ` \+ ` pyserial ` 搭一个最小调试台，并为 M07/[OTA](term:ota) 留出升级界面。

 

> ◷ 约 65 分钟 · ◈ tkinter · 实时曲线 · 升级界面 · ⚑ 线程与 UI 分离

 

```zhizhan-anchor
m06-1
```



## 6.1 调试台的三块：看、发、升

 

**FIG 6.1**  一个够用的串口调试台布局

 

```zhizhan-figure
<svg viewBox="0 0 660 220" role="img" aria-label="串口调试台布局：实时曲线、命令面板、日志">
          <rect x="20" y="24" width="620" height="120" rx="8" class="sv-box"></rect>
          <text x="36" y="46" class="sv-lbl-hi">① 实时曲线（ADC/IMU/功耗）</text>
          <polyline fill="none" stroke="var(--grn)" stroke-width="1.6" points="40,120 70,96 100,84 130,90 160,110 190,122 220,116 250,98 280,86 310,92 340,112 370,124 400,118 430,100 460,88 490,94 520,114 550,126 580,120 610,104"></polyline>
          <rect x="20" y="154" width="360" height="48" rx="8" class="sv-cyn-s"></rect>
          <text x="36" y="174" class="sv-lbl-hi" style="fill:var(--cyn)">② 命令面板</text>
          <text x="36" y="192" class="sv-lbl-dim">发送 start/stop/get/set … 带历史与快捷按钮</text>
          <rect x="396" y="154" width="244" height="48" rx="8" class="sv-amb-s"></rect>
          <text x="412" y="174" class="sv-lbl-hi" style="fill:var(--amb)">③ 固件升级</text>
          <text x="412" y="192" class="sv-lbl-dim">选文件 → 分块下发 → 进度/回滚（M07/OTA 铺垫）</text>
        </svg>
```

 

三块各司其职；关键工程约束是 **串口 I/O 不能阻塞 UI 线程** ——必须在后台线程读串口，用队列把数据交给 UI 刷新（见 §6.3）。

 

```zhizhan-anchor
m06-2
```



## 6.2 最小实时曲线（tkinter \+ pyserial）

 

plotter.py — 后台线程读串口，UI 画曲线 Python

 

```text
# plotter.py —— 最小实时曲线：串口线程 + tkinter 主线程
import threading, queue, serial, tkinter as tk

q = queue.Queue(maxsize=1000)          # 线程间用队列传数据（有界，防积压）

def reader(ser, stop):
    while not stop.is_set():
        line = ser.readline()          # 阻塞读（受 timeout 控制）
        if line:
            try:
                q.put_nowait(float(line))
            except (ValueError, queue.Full):
                pass                   # 丢非数字/满了就丢，绝不在采集线程里阻塞

class App:
    def __init__(self, root, ser):
        self.root, self.ser = root, ser
        self.data = []
        self.cv = tk.Canvas(root, width=600, height=200, bg="#0B1110")
        self.cv.pack()
        self.stop = threading.Event()
        threading.Thread(target=reader, args=(ser, self.stop), daemon=True).start()
        self._tick()
    def _tick(self):
        while not q.empty():           # 只取走队列里的最新数据
            self.data.append(q.get())
            del self.data[:-300]       # 只留最近 300 点
        self._draw()
        self.root.after(50, self._tick)  # 50ms 刷新
    def _draw(self):
        self.cv.delete("all")
        n = len(self.data)
        if n > 1:
            pts = [(20 + i*560/(n-1), 180 - (v % 4096)/4096*160) for i, v in enumerate(self.data)]
            self.cv.create_line(*[c for p in pts for c in p], fill="#4EF08A", width=1.4)

if __name__ == "__main__":
    ser = serial.Serial("COM5", 115200, timeout=1)
    root = tk.Tk(); root.title("serial plotter")
    App(root, ser); root.mainloop()
```

 

◆ 为什么"串口线程 \+ 队列 \+ after 刷新"是标准结构

 

 
- **UI 线程绝不阻塞** ：` readline() ` 在后台线程做，慢的是它、不是界面。
 
- **队列有界** ：采集快、UI 慢时丢旧数据，而不是无限积压把内存吃光。
 
- **刷屏只画最近 N 点** ：曲线是"窗口"，不是"历史全量"。

 

```zhizhan-anchor
m06-3
```



## 6.3 升级界面：为 OTA 铺路

 

③ 固件升级块把 M05 的烧录步骤搬进界面：选文件 → 分块下发 → 显示进度 → 校验 → 切换。 它与第②册协议编排里的  **OTA 状态机** （传输/校验/回滚）是同一套逻辑，只是这里由上位机驱动。

 

ota\_ui.py — 分块下发 \+ 进度回调（示意） Python

 

```text
# ota_ui.py —— 把固件分块下发，并按进度刷新界面
def send_firmware(ser, blob: bytes, chunk=1024, on_progress=lambda p: None):
    total = len(blob)
    for off in range(0, total, chunk):
        part = blob[off:off + chunk]
        ser.write(b"%06X" % off + part)     # 偏移 + 数据（示意协议）
        ack = ser.read(1)
        if ack != b"K":
            raise IOError(f"chunk at {off} not acked")
        on_progress((off + len(part)) / total)   # 回调 → UI 进度条
    ser.write(b"DONE")
```

 

⚠ 升级界面必须能"失败可退"

 

升级最怕"传到一半断了，设备变砖"。界面至少要有： **进度、超时、失败提示、以及"回滚/重试"按钮** ； 设备侧对应的双区/回滚机制在第②册 OTA 一节。上位机只是驱动器，安全边界在设备端。

 

```zhizhan-anchor
m06-4
```



## 6.4 后台线程读串口，UI 只画图

 

```zhizhan-anchor
m06-5
```



## 6.5 界面与采集解耦的好处

 

**FIG 6.2**  采集线程与 UI 线程解耦

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="后台线程阻塞读串口，入队列；UI 从队列取点画图，谁都不卡谁">
          <rect x="30" y="40" width="180" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="120" y="63" class="sv-lbl-hi" text-anchor="middle">采集线程</text>
          <text x="120" y="83" class="sv-lbl-dim" text-anchor="middle">阻塞读，不卡 UI</text>
          <path d="M210 68 L270 68" class="sv-arrow"></path>
          <rect x="272" y="40" width="120" height="56" rx="6" class="sv-cyn-s"></rect>
          <text x="332" y="63" class="sv-lbl-hi" text-anchor="middle">队列</text>
          <text x="332" y="83" class="sv-lbl-dim" text-anchor="middle">有界</text>
          <path d="M392 68 L452 68" class="sv-arrow"></path>
          <rect x="454" y="40" width="180" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="544" y="63" class="sv-lbl-hi" text-anchor="middle">UI 线程</text>
          <text x="544" y="83" class="sv-lbl-dim" text-anchor="middle">按帧取点画图</text>
        </svg>
```

 

队列要有界：UI 卡顿时丢最旧的点，而不是让内存无限涨。

 

ring.py — 有界的环形缓冲 Python

 

```text
class Ring:
    def __init__(self, n):
        self.n = n; self.buf = []
    def push(self, x):
        self.buf.append(x)
        if len(self.buf) > self.n: self.buf.pop(0)

r = Ring(3)
for x in range(5): r.push(x)
print(r.buf)   # [2, 3, 4]
```

 

**bash**  — 复跑：` python tools/probes/m06_src/ring.py `（本机真实运行）

 

| 关注点 | 采集线程 | UI 线程 |
| --- | --- | --- |
| 阻塞 | 读串口可阻塞 | 不阻塞 |
| 刷新 | 不关心 | 定时重画 |
| 缓冲 | 写队列 | 读队列 |
| 解耦 | 互不等待 | 互不等待 |

 

| 界面陷阱 | 后果 | 修复 |
| --- | --- | --- |
| 在 UI 线程里阻塞读串口 | 界面卡死 | 移到后台线程 |
| 无界缓冲 | 内存涨 | 用有界队列 |
| 频繁全量重画 | CPU 高 | 只画新点 |
| 线程直接改控件 | 偶发崩溃 | 通过队列传递 |

 

◆ 迁移练习

 

用"后台线程 \+ 有界队列"重写你的实时曲线程序，验证串口断开时 UI 不卡、内存不涨。

 

| 线程与队列 | 建议值 | 说明 |
| --- | --- | --- |
| 队列容量 | 几百~几千点 | 够画一屏 |
| 重画周期 | 20~50ms | 人眼舒适 |
| 读超时 | 50~200ms | 兼顾响应 |
| 丢弃策略 | 丢最旧 | 保最新 |

 

| 调试台三块 | 功能 |
| --- | --- |
| 看 | 实时曲线/日志 |
| 发 | 命令/参数下发 |
| 升 | 分块 OTA \+ 进度 |

 

◆ 本章要点

 

 
- 调试台三块：实时曲线、命令面板、固件升级。
 
- 标准结构： **串口后台线程 \+ 有界队列 \+ UI 定时刷新** ，UI 线程绝不阻塞。
 
- 曲线是"最近 N 点"的窗口，不是历史全量；满了丢旧数据。
 
- 升级界面 = 分块下发 \+ 进度回调 \+ 失败可退（回滚/重试）。
 
- 它与设备端 OTA 状态机是同一套逻辑的上位机侧（第②册）。

 

◆ 自测 · Module 06（先答再看）

 

 
1. 简答：为什么不能在 tkinter 主线程里直接 ` ser.readline() `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会阻塞 UI 线程，界面卡死（\"无响应\"）。应在后台线程读串口，经有界队列把数据交给 UI 定时刷新。"}
   ```
 
2. 判断：数据队列应该越大越好，保证不丢数据。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"相反，应有界。采集快、UI 慢时若无限积压会吃光内存且实时性丧失；有界队列 \\+ \"满了丢旧\"更稳。"}
   ```
 
3. 诊断：曲线越画越卡，最可能的原因？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"把\"历史全量\"都重画了。应只画最近 N 点（滑窗），并限制刷新频率（如 50ms 一次）。"}
   ```
 
4. 动手：给 ` plotter.py ` 加一个"暂停"按钮，暂停时仍读串口但不画（把数据继续入队或直接丢弃，两者各有什么影响？）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"继续入队 → 恢复后能看到暂停期间数据（但受队列上限）；直接丢弃 → 恢复后从当前值继续。按调试需要选。"}
   ```
 
5. 判断：升级界面做出来，设备就不会升级变砖了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不会。安全边界在 **设备端** （双区、校验、回滚）；上位机只负责可靠地驱动。界面要提供失败提示与重试，但不能替代设备端保护。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 06 完成？**  用 tkinter \+ pyserial 搭一个最小调试台：实时曲线 \+ 命令按钮 \+ 日志框。

 

```zhizhan-assessment
{"id":"course-b04-m06","criterion":"采集不阻塞 UI，退出时后台任务停止，满队列政策可观察。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
