# B23-M16数据回放、自动指标与故障注入

```zhizhan-anchor
B23-M16
```



学习范围 · 黄金输入；确定性回放；IAE；超调；整定时间；故障测试；数据隔离



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="数据回放、自动指标与故障注入 · 机制路径"><title>数据回放、自动指标与故障注入 · 机制路径</title><defs><marker id="arrow-B23-M16" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">固定输入与配置</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M16)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">重跑算法或模型</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M16)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">计算统一指标</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M16)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">注入故障查边界</text></svg>
```



数据回放、自动指标与故障注入 · 机制路径



每次改算法，都重跑同一份输入和配置，再比较结果。黄金输入不是永远正确的现实，而是一组版本化的回归场景。保留正常、边界、历史失败和新工况，避免调参数只适配一条好看的曲线。

 

| 指标 | 含义 | 必须明确 |
| --- | --- | --- |
| IAE | ∫\|r−y\|dt，离散时按间隔累计 | 时间区间、物理量单位、丢样处理 |
| 超调 | 响应超过指定目标的程度 | 目标阶跃与参考幅度；目标回落另算 |
| 整定时间 | 进入误差带后保持到观察结束 | 误差带与观察窗口；未进入则未整定 |
| 饱和时长 | 输出达到限制的累计时间 | 上下限、容差及是否排除启动段 |
| 故障响应 | 故障到安全动作的时间 | 故障判定点、采样与输出测量点 |

 

实验场景至少包括目标变化、环境扰动、不可达目标、传感器失效、过期样本和计算超时。模型内的 fault 标志可以验证逻辑；硬件验证还需实际注入断线、丢帧和驱动故障，并量测输出，不能只检查一条日志字符串。

 

数据用于辨识和整定时，保留独立验证工况。连续相邻片段常有强相关性，随机分割容易让相似数据同时进入训练和验证。按设备、时间段或运行批次划分，记录每次参数搜索范围。



### 指标必须带时基



IAE=∫|r−y|dt，温控的单位是 °C·s。等间隔矩形近似为 Σ|e\[k\]|Ts；非等间隔可用梯形积分，必须读取实际时间戳。直接 Σ|e| 只在约定 Ts=1 时才等于该近似。以 e=1°C、时长2s 为例，IAE=2°C·s；采样加密不应把结果翻倍。实验中的这个性质测试用于识别遗漏 Ts 的错误。



**动手练习** 

运行附带 Python 的 normal、cooling、recovery、sensor-fault 四场景，保存 CSV 与参数。

 **检查结果** 

指标脚本可重复；故障后输出为零并锁存；仿真与实测结果分别归档。



核对与延伸：[SciPy：非等间隔梯形积分](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.trapezoid.html) · [Python：单调计时与性能计数器](https://docs.python.org/3/library/time.html)



```zhizhan-assessment
{"id":"course-b23-b23-m16","criterion":"指标脚本可重复；故障后输出为零并锁存；仿真与实测结果分别归档。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
