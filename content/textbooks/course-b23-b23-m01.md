# B23-M01从需求到算法、数据与控制链

```zhizhan-anchor
B23-M01
```



学习范围 · 被控对象；数据与单位；误差；执行器；观测与闭环验证



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="从需求到算法、数据与控制链 · 机制路径"><title>从需求到算法、数据与控制链 · 机制路径</title><defs><marker id="arrow-B23-M01" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">物理对象与采样</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M01)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">可信数据与算法</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M01)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">控制决策与输出</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M01)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">日志回放与验证</text></svg>
```



从需求到算法、数据与控制链 · 机制路径



先用一个可测量的目标组织学习：让温度保持在 45°C，受到散热变化后仍能恢复。温度是被控量 y，45°C 是设定值 r，加热占空比是控制量 u，误差 e=r−y。算法把传感器读数转成可信的 y，控制器根据误差计算 u，日志帮助你解释结果。

 

一个数字离开单位和时间，就容易被误用。记录“2048”无法判断它是 ADC 原始码、毫伏还是编码器计数。建议把原始值、校准值、采样时刻、序号、质量标志一起保存。离线 Python 可以验证算法，MCU 负责在规定周期内运行；两端要使用相同的参数版本和输入语义。

 

| 对象 | 本册例子 | 必须约定 |
| --- | --- | --- |
| r / y | 目标温度 / 测量温度 | °C；测量是否有效 |
| u | 0～1 的加热占空比 | 限幅、更新周期、故障时为 0 |
| Ts | 0.1 秒 | 由采样/调度保证；记录实际抖动 |
| 结果 | 误差、饱和时长、故障响应 | 仿真结果与板上实测分别记录 |

 

学习顺序是先建立可回放的数据链，再校准和滤波，然后辨识对象并闭环，最后处理资源预算与失败路径。本册提供 18 章实战入门；完整证明、复杂控制器设计和具体器件驱动，可继续结合关联分册学习。



**动手练习** 

为温控或电机调速写一张接口表，明确目标、传感器、单位、采样周期、输出范围和故障动作。

 **检查结果** 

每个数值都有单位和时间含义；能解释一条数据如何影响一次控制输出。



核对与延伸：[SciPy：连续模型离散化](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.cont2discrete.html) · [Python：单调计时与性能计数器](https://docs.python.org/3/library/time.html)



```zhizhan-assessment
{"id":"course-b23-b23-m01","criterion":"每个数值都有单位和时间含义；能解释一条数据如何影响一次控制输出。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
