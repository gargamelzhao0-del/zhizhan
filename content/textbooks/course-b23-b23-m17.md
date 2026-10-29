# B23-M17综合实战：可回放的温控闭环

```zhizhan-anchor
B23-M17
```



学习范围 · Python 仿真；CSV；PI 参数；抗饱和对比；故障关闭；C 移植



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="综合实战：可回放的温控闭环 · 机制路径"><title>综合实战：可回放的温控闭环 · 机制路径</title><defs><marker id="arrow-B23-M17" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">建立一阶仿真</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M17)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">固定 PI 与周期</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M17)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">生成日志和指标</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M17)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">回归后再移植</text></svg>
```



综合实战：可回放的温控闭环 · 机制路径



先完成一个不需要硬件的闭环。下载本册 [thermal\_pi.py](textbook-file:b23/labs/thermal_pi.py)，使用 Python 3.10 或更新版本运行。脚本只依赖标准库，每次生成 120 s 的确定性模型数据与指标；它不读传感器，也不控制真实输出。



终端 · 在下载目录运行



```text
python thermal_pi.py --scenario normal --out normal.csv
python thermal_pi.py --scenario cooling --out cooling.csv
python thermal_pi.py --scenario recovery --anti-windup on --out recovery-on.csv
python thermal_pi.py --scenario recovery --anti-windup off --out recovery-off.csv
python thermal_pi.py --scenario sensor-fault --out fault.csv
```



先核对 normal：5 s 时由 25°C 请求 45°C，观察输出和最终误差。cooling 在 60 s 将环境温度降到 20°C；recovery 在 5～60 s 请求 95°C，然后回到指定目标；sensor-fault 在 70 s 锁存故障。每个 CSV 记录时间、目标、温度、输出、积分、未限幅输出和故障标志。

 

本环境已运行默认模型、饱和恢复和故障场景，并将 Python 与网页模型逐采样对照。默认 normal 的最终误差约 −0.00068°C，只反映理想无噪声模型。真实系统的分辨率、传感器延迟、执行器和散热变化都会改变结果。



终端 · 主机 C 示例检查，需已有 GCC



```text
gcc -std=c11 -Wall -Wextra -Werror -pedantic algorithms.c -lm -o algorithms
# Linux / macOS: ./algorithms
# Windows PowerShell: ./algorithms.exe
```



[algorithms.c](textbook-file:b23/labs/algorithms.c) 提供环形缓冲、Q15、状态机和 PI 的主机断言。移植到 MCU 时新增定时采样、ADC 校准、PWM 驱动、状态机输出门控和故障保护。先以录制输入验证输出，再接实际对象，并逐步提高负载。



**动手练习** 

提交五份 CSV、模型参数、抗饱和对比结论和 C 检查结果；再写一张 MCU 接口映射表。

 **检查结果** 

可在新目录重跑；误差由指标计算；故障动作与控制算法分层；未把模型结论当成实物验收。



核对与延伸：[SciPy：连续模型离散化](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.cont2discrete.html) · [MathWorks：PID 抗积分饱和](https://www.mathworks.com/help/simulink/slref/anti-windup-control-using-a-pid-controller.html) · [Python：单调计时与性能计数器](https://docs.python.org/3/library/time.html)



```zhizhan-assessment
{"id":"course-b23-b23-m17","criterion":"可在新目录重跑；误差由指标计算；故障动作与控制算法分层；未把模型结论当成实物验收。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
