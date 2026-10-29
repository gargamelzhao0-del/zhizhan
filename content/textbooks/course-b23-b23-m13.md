# B23-M13PI/PID：限幅、抗饱和与交互实验

```zhizhan-anchor
B23-M13
```



学习范围 · 比例与积分；条件积分；执行器饱和；微分滤波；整定；仿真比较



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="PI/PID：限幅、抗饱和与交互实验 · 机制路径"><title>PI/PID：限幅、抗饱和与交互实验 · 机制路径</title><defs><marker id="arrow-B23-M13" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">误差 r−y</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M13)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">P 与 I 计算</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M13)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">条件积分与限幅</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M13)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">对象响应再反馈</text></svg>
```



PI/PID：限幅、抗饱和与交互实验 · 机制路径



比例项 P=Kp·e 立即响应误差；积分项按 I←I\+Ki·e·Ts 累积持续误差。这里积分状态 I 已经包含 Ki，不能在输出处再乘一次 Ki。u=clip(P\+I,0,1)。对于温控，Kp 的单位是占空比/°C，Ki 是占空比/(°C·s)。

 

当执行器已经满功率，继续累加正误差不会增加真实输出，却会储存很大的积分。设定值回落后，输出可能仍长时间饱和。条件积分在候选输出超出上限且误差继续向上推动时暂停积分；下限对应处理。误差把输出拉回范围时允许积分更新。



Python · 条件积分核心；完整仿真见 thermal\_pi.py



```text
candidate = integral + ki * error * dt
proposal = kp * error + candidate
pushing = (proposal > 1 and error > 0) or (proposal < 0 and error < 0)
if not (anti_windup and pushing):
    integral = candidate
output = min(1, max(0, kp * error + integral))
```



先固定模型和采样周期，降低增益得到可解释的响应，再逐步改变参数并记录指标。微分项会放大高频噪声，常对测量值求带滤波的导数以减少设定值突变的冲击。先掌握 PI，再依据对象需求加入 D；不要把没有滤波的差分直接用于嘈杂传感器。

 

下面是纯仿真：第一阶热模型、无测量噪声和通信延迟，输出范围 0～1。选择“高设定后回落”，系统先要求 95°C，60 s 时回到滑块设定值；由于满功率理想稳态只有 85°C，能直接观察饱和及恢复。两条温度曲线仅改变抗饱和开关。

 

```zhizhan-thermal
thermal-pi
```

 

传感器失效场景在 70 s 锁存故障，随后 u=0。图中的恢复、误差和积分量来自模型计算，并不是实物验证。真实设备还需要独立保护、准确测温、执行器与驱动验证；仿真增益仅用于本教学对象。



### 抗饱和改善恢复，不承诺零超调



条件积分只在误差推动输出离开饱和方向时更新积分。它限制积分继续累积，但超调仍取决于对象滞后、Kp/Ki、采样周期和初始状态。比较相同参数下开/关抗饱和的积分峰值、恢复时间和超调；不要把“无超调”设成所有场景的必然结论。



**动手练习** 

分别开启/关闭抗饱和，选择高设定后回落，比较积分峰值与 60 s 后的恢复。改变 Kp、Ki 与 τ，每次只改一项。

 **检查结果** 

输出始终在 0～1；饱和不再无边界累积积分；能区分不可达目标、模型偏差和整定问题。



核对与延伸：[MathWorks：PID 抗积分饱和](https://www.mathworks.com/help/simulink/slref/anti-windup-control-using-a-pid-controller.html)



```zhizhan-assessment
{"id":"course-b23-b23-m13","criterion":"输出始终在 0～1；饱和不再无边界累积积分；能区分不可达目标、模型偏差和整定问题。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
