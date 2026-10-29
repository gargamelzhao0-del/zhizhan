# 术语与符号对照表

```zhizhan-anchor
glossary
```



本页是 B04 的 **单一事实源** ：` verify/glossary.json ` 与下表逐条比对， 两边漂移（少了/多了/写错）会在构建时 **直接失败** 。改术语/符号时，两处必须同步。

 

```zhizhan-anchor
glossary-terms
```



## 术语

 

| 术语 | 含义 |
| --- | --- |
| **CPython** | 标准 Python 解释器；跑在 PC/服务器，是本册上位机工具链的主力（pyserial/numpy/pandas/matplotlib）。 |
| **MicroPython** | 为 MCU 裁剪的 Python 3：约 256KB Flash / 16KB RAM 起，含 ` machine ` 模块直接操作外设，固件里自带解释器。 |
| **CircuitPython** | Adafruit 维护的 MicroPython 分支：更友好的 API、内置 USB 存储与库；适合教育与快速原型，性能/控制力略弱于原版 MicroPython。 |
| **REPL** | Read-Eval-Print Loop：MicroPython 的交互式命令行，通过串口进入，用于即时验证语句与寄存器读写。 |
| **垃圾回收** | MicroPython 用标记-清除式 GC 管理堆；内存不足时触发，可能造成毫秒级停顿——实时路径要避免运行期分配。 |
| **frozen bytecode** | 把 ` .py ` 预编译进固件（而非放在文件系统里），省 RAM、启动快、防篡改；量产常把核心模块 frozen。 |
| **viper** | MicroPython 的 ` @micropython.viper ` 装饰器：把函数编译成接近机器码的定长整数代码，比普通 Python 快数倍到数十倍。 |
| **pyserial** | CPython 的串口库（` import serial `）；本册用它做上位机收发、协议测试、固件下载触发。 |
| **帧解析** | 把串口字节流按帧结构（帧头/长度/载荷/校验）切出来；必须处理半包/粘包/超时。 |
| **numpy** | 数组与向量化数值计算库；把 ADC/IMU 采样批量转成数组做滤波、FFT、统计。 |
| **pandas** | 表格数据处理库（DataFrame）；把设备日志/CSV 当表做分组、聚合、重采样。 |
| **matplotlib** | 绘图库；把采样/功耗曲线画成图，直接服务于"数据看出的问题"。 |

 

```zhizhan-anchor
glossary-symbols
```



## 符号 / 构件

 

| 符号 / 构件 | 类别 | 说明 |
| --- | --- | --- |
| ` machine.Pin ` | MicroPython 模块 | GPIO：` Pin(n, Pin.OUT/IN) `，` value()/on()/off() `。 |
| ` machine.UART ` | MicroPython 模块 | 串口：` UART(n, baudrate=…) `，` read()/write()/any() `。 |
| ` machine.Timer ` | MicroPython 模块 | 硬件/软件定时器：` periodic ` 回调，用于定时中断。 |
| ` time.sleep_ms ` | MicroPython 函数 | 毫秒级延时（MicroPython 特有，CPython 用 ` time.sleep `）。 |
| ` gc.collect() ` | MicroPython 函数 | 主动触发垃圾回收；配合 ` gc.mem_free() ` 观察堆水位。 |
| ` memoryview ` | Python 内建 | 对 buffer 的零拷贝视图；串口收包后按偏移解析不额外复制。 |
| ` struct.pack ` | Python 内建 | 按格式把数值打包成字节（` '<H' ` 小端 u16 等），用于组帧。 |
| ` ser.readline() ` | pyserial 方法 | 读到换行；上位机读行/写行式命令的常用入口。 |
| ` esptool ` | 工具 | ` esptool.py `：ESP32/ESP8266 固件烧录与芯片信息读取。 |
| ` west ` | 工具 | Zephyr 的构建/烧录/调试元工具（` west build/flash/debug `）。 |

 

维护提示：正文里新增的术语/符号若要进对照表，先登记到 ` verify/glossary.json `，再补本表——两处同步后构建才会通过。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
