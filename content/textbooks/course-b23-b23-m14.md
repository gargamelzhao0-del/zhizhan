# B23-M14状态估计与传感器融合入门

```zhizhan-anchor
B23-M14
```



学习范围 · 预测与观测；互补滤波；标量卡尔曼；Q/R；创新；异常观测



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="状态估计与传感器融合入门 · 机制路径"><title>状态估计与传感器融合入门 · 机制路径</title><defs><marker id="arrow-B23-M14" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">模型预测状态</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M14)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">取得有效观测</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M14)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">创新与增益</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M14)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">更新状态与不确定度</text></svg>
```



状态估计与传感器融合入门 · 机制路径



滤波可以平滑读数，状态估计还利用动态模型推断没有直接测量的量。例如位置传感器给位置，模型帮助估计速度。互补滤波按频段组合信息；线性卡尔曼滤波按模型和噪声假设，在预测与观测之间分配权重。

 

先理解一个标量随机游走模型。状态预测保持 x 不变，预测方差 Pp=P\+q·Ts。观测 z 的噪声方差为 R，增益 K=Pp/(Pp\+R)，状态更新 x←x\+K(z−x)。R 大时更信预测，预测不确定度大时更信观测；q 与 R 都是有单位的方差参数。



Python · 一维示意，要求 P≥0、q≥0、R\>0、Ts\>0



```text
predicted_p = p + q * ts
innovation = measurement - estimate
k = predicted_p / (predicted_p + r_variance)
estimate += k * innovation
p = (1-k)**2 * predicted_p + k*k * r_variance
```



上面协方差更新采用标量 Joseph 形式。矩阵系统还需要状态转移、观测矩阵、控制输入，以及与采样周期相匹配的 Q。软件默认矩阵不能替代模型。观测时间不对齐、安装方向错误和偏置未处理，往往比调增益更先影响效果。

 

记录创新 z−预测观测及其统计。持续偏移可能来自模型或偏置，单个巨大创新可能来自异常观测。拒绝观测时只进行预测并保留不确定度增长，不能把丢失观测写成零。融合结果必须和保留的独立参考一起评价。



**动手练习** 

生成缓慢变化的真实温度与带噪观测，改变 q/R，比较响应速度、误差与创新序列。

 **检查结果** 

方差非负；每个矩阵或标量有物理含义；丢样时不伪造观测。



核对与延伸：[FilterPy：线性卡尔曼滤波](https://filterpy.readthedocs.io/en/latest/kalman/KalmanFilter.html)



```zhizhan-assessment
{"id":"course-b23-b23-m14","criterion":"方差非负；每个矩阵或标量有物理含义；丢样时不伪造观测。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
