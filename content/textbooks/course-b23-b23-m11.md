# B23-M11对象建模与阶跃辨识

```zhizhan-anchor
B23-M11
```



学习范围 · 一阶模型；增益；时间常数；纯滞后；阶跃实验；模型残差



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="对象建模与阶跃辨识 · 机制路径"><title>对象建模与阶跃辨识 · 机制路径</title><defs><marker id="arrow-B23-M11" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">在限定范围施加阶跃</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M11)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">估计稳态增益</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M11)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">估计时间常数</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M11)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">用另一段数据验证</text></svg>
```



对象建模与阶跃辨识 · 机制路径



控制器面对的是物理对象。入门可以用一阶热模型：dT/dt=(Tamb\+G·u−T)/τ。Tamb 是环境温度，G 是满占空比带来的稳态温升，τ 是时间常数。它忽略空间温差、非线性和传感器滞后，适合说明机制，不能未经验证就作为真实设备模型。

 

对已经接近稳态的对象施加输入阶跃 Δu，等新稳态后测 ΔT，得到局部增益 G≈ΔT/Δu。一阶无纯滞后模型在 τ 后完成最终变化的约 63.2%。若变化先等待 L 秒才开始，记录纯滞后 L，不要把它都塞进时间常数。

 

T(t)=T∞\+(T0−T∞)·exp(−t/τ)  
T∞=Tamb\+G·u

 

本册仿真取 Tamb=25°C、G=60°C/占空比、τ=20 s。恒定 u=0.5 的理想稳态是 55°C，20 s 后约为 43.96°C。用这个解析解可检查离散仿真，而不是只看曲线像不像。

 

辨识数据要包括足够长的稳定段，保存输入变化时刻，避免输出限幅或严重饱和改变实验含义。用另一输入幅度或工况验证预测，画残差并检查其是否随温度、速度或负载变化。偏差过大时需要改模型或限制使用范围。



### 一个时间常数，为什么还没到稳态？



恒定输入 u=0.5 时，稳态是 25\+60×0.5=55°C。解析解 T(t)=55−30·exp(−t/20)；20 秒只完成总变化的 63.2%，所以 T(20)=43.96°C。以下曲线来自这个解析模型，不是硬件实测。



```zhizhan-figure
<svg viewBox="0 0 650 310" role="img" aria-label="一阶温度响应：20秒43.96摄氏度，渐近55摄氏度"><path d="M45 60V260H620" fill="none" stroke="currentColor"></path><polyline points="45.0,260.0 52.0,251.2 59.0,242.9 66.0,234.9 73.0,227.4 80.0,220.2 87.0,213.3 94.0,206.8 101.0,200.7 108.0,194.8 115.0,189.2 122.0,183.9 129.0,178.8 136.0,174.0 143.0,169.4 150.0,165.0 157.0,160.9 164.0,156.9 171.0,153.2 178.0,149.6 185.0,146.2 192.0,143.0 199.0,139.9 206.0,137.0 213.0,134.2 220.0,131.6 227.0,129.1 234.0,126.7 241.0,124.4 248.0,122.2 255.0,120.2 262.0,118.2 269.0,116.3 276.0,114.6 283.0,112.9 290.0,111.3 297.0,109.8 304.0,108.3 311.0,106.9 318.0,105.6 325.0,104.4 332.0,103.2 339.0,102.0 346.0,101.0 353.0,99.9 360.0,99.0 367.0,98.0 374.0,97.2 381.0,96.3 388.0,95.5 395.0,94.8 402.0,94.1 409.0,93.4 416.0,92.7 423.0,92.1 430.0,91.5 437.0,90.9 444.0,90.4 451.0,89.9 458.0,89.4 465.0,89.0 472.0,88.5 479.0,88.1 486.0,87.7 493.0,87.3 500.0,87.0 507.0,86.6 514.0,86.3 521.0,86.0 528.0,85.7 535.0,85.4 542.0,85.2 549.0,84.9 556.0,84.7 563.0,84.5 570.0,84.2 577.0,84.0 584.0,83.8 591.0,83.6 598.0,83.5 605.0,83.3" fill="none" stroke="var(--cyn)" stroke-width="3"></polyline><path d="M45 80H610" stroke="var(--amber)" stroke-dasharray="6 4"></path><text x="50" y="35" fill="currentColor">温度 / °C · 虚线：55°C 稳态</text><text x="50" y="282" fill="currentColor">0 s</text><text x="178" y="282" fill="currentColor">20 s：43.96°C</text><text x="540" y="282" fill="currentColor">80 s</text></svg>
```



G=60°C/duty，τ=20 s，Tamb=25°C。有限时间响应与稳态分开验收。



动手：先手算 0、20、40 秒的温度，再运行 ` labs/control_checks.py ` 对拍。把 τ 改成 40 秒，解释为什么稳态不变、达到同一比例所需时间加倍。



**动手练习** 

先用解析式生成 u=0.5 的响应，再加入 2 s 延迟和测量噪声，估计 G、τ 与 L。

 **检查结果** 

明确模型假设和有效范围；参数由数据得到；独立验证段给出残差。



核对与延伸：[SciPy：连续模型离散化](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.cont2discrete.html)



```zhizhan-assessment
{"id":"course-b23-b23-m11","criterion":"明确模型假设和有效范围；参数由数据得到；独立验证段给出残差。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
