# B23-M15前馈、串级与运动轨迹的工程入口

```zhizhan-anchor
B23-M15
```



学习范围 · 前馈与反馈；内外环；带宽分配；斜率限制；加速度与执行器约束



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="前馈、串级与运动轨迹的工程入口 · 机制路径"><title>前馈、串级与运动轨迹的工程入口 · 机制路径</title><defs><marker id="arrow-B23-M15" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">限制目标变化</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M15)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">模型计算前馈</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M15)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">反馈修正残差</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M15)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">执行器约束回传</text></svg>
```



前馈、串级与运动轨迹的工程入口 · 机制路径



反馈根据误差修正，前馈根据已知目标或扰动提前提供所需输出。若热模型稳态 T=Tamb\+G·u，则目标 r 的名义前馈为 (r−Tamb)/G，再由反馈修正模型误差。环境温度变化时，前馈能减少等待误差累积的过程，但错误模型也会直接带来错误输出。

 

前馈和反馈的总和仍要经过实际执行器约束，抗饱和应依据真正送给对象的输出处理。只限制 PI 单独的输出而忽略相加后的饱和，会重新引入积分问题。电机驱动中的电流限幅、驱动器内部环和电源电压变化也需要纳入接口。

 

串级把快内环和慢外环组合，例如电流环、速度环、位置环。先验证内环，再设计外环，并测量实际延迟。外环直接把一个尚未稳定的内环当成理想执行器，会使调试很难解释。带宽应有足够分离，但具体比例由对象和采样条件决定。



Python · 设定值斜率限制，rate 的单位是物理量/秒



```text
max_change = rate * ts
change = target - limited_reference
limited_reference += min(max_change, max(-max_change, change))
```



斜率限制可减轻突变请求。运动系统还应限制加速度，必要时限制 jerk；位置、速度和加速度边界都要与机械能力匹配。以路径规划或 MPC 为下一阶段时，先掌握模型、状态、约束和在线计算预算。



### 轨迹是随时间的函数



只计算 min(vmax, sqrt(a·距离)) 得到的是峰值速度，不是完整轨迹。对零起终速度的对称运动，先判断能否达到 vmax：若距离≤vmax²/a，使用三角速度；否则使用加速—匀速—减速。完整分段位置函数和端点断言见 ` labs/control_checks.py `。验收位置连续、末端达到目标、峰值不超限；真实电机还要考虑加加速度、负载与限位。



**动手练习** 

在模型中比较设定值阶跃与限速斜坡，再加入名义前馈并改变对象增益。

 **检查结果** 

总输出约束有效；说明前馈依赖哪个模型；轨迹参数有明确单位。



核对与延伸：[MathWorks：梯形速度轨迹](https://www.mathworks.com/help/robotics/ref/trapveltraj.html)



```zhizhan-assessment
{"id":"course-b23-b23-m15","criterion":"总输出约束有效；说明前馈依赖哪个模型；轨迹参数有明确单位。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
