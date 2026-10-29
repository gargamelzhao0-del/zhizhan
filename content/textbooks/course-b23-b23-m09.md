# B23-M09重采样与滤波：平滑背后的延迟

```zhizhan-anchor
B23-M09
```



学习范围 · 采样定理；混叠；EMA；FIR/IIR；分块状态；因果与离线滤波



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="重采样与滤波：平滑背后的延迟 · 机制路径"><title>重采样与滤波：平滑背后的延迟 · 机制路径</title><defs><marker id="arrow-B23-M09" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">确认采样时基</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M09)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">防止混叠</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M09)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">因果滤波与状态</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M09)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">测噪声和延迟</text></svg>
```



重采样与滤波：平滑背后的延迟 · 机制路径



采样率改变前先考虑信号带宽。高频成分一旦在 ADC 采样时混叠，后续数字滤波无法把它唯一恢复。降低已有数字数据的采样率时，先低通，再抽取；带抗混叠滤波的重采样函数能帮助离线验证，但它不能补救采集端已经发生的混叠。

 

指数平滑只需一个状态：y\[k\]=αx\[k\]\+(1−α)y\[k−1\]。0\<α≤1，α 越小通常越平滑、响应越慢。以时间常数 τf 选取 α=1−exp(−Ts/τf)，可以让参数带有时间尺度；这对应单极点离散形式，实际响应仍需测量。



Python · 单状态因果滤波



```text
import math
ts, tau_filter = 0.1, 0.5
alpha = 1.0 - math.exp(-ts / tau_filter)
filtered = first_valid_sample
for sample in valid_samples:
    filtered += alpha * (sample - filtered)
```



FIR 一般需要保存历史输入，IIR 需要保存递推状态。分块调用时不能每块都清空状态，否则块边界会产生瞬态。较高阶 IIR 可采用二阶节形式，在离线验证和目标实现中都记录系数顺序与状态约定。

 

离线前后向滤波能使用未来样本，适合某些分析任务；在线控制不能照搬。先比较噪声标准差、阶跃延迟，再把滤波延迟计入闭环。只追求曲线平滑，可能让控制器来不及响应。



**动手练习** 

对“阶跃\+噪声”序列比较 α=0.2 和 0.8，测达到阶跃幅度 90% 的时间。

 **检查结果** 

滤波前后单位一致；块处理结果与连续处理一致；延迟有明确时间单位。



核对与延伸：[SciPy：多相重采样](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.resample_poly.html) · [SciPy：二阶节滤波](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfilt.html) · [SciPy：双向滤波](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfiltfilt.html)



```zhizhan-assessment
{"id":"course-b23-b23-m09","criterion":"滤波前后单位一致；块处理结果与连续处理一致；延迟有明确时间单位。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
