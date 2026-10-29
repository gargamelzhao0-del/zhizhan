# B23-M10特征提取、频谱与带迟滞的事件检测

```zhizhan-anchor
B23-M10
```



学习范围 · RMS；去直流；频率分辨率；PSD；迟滞；持续时间；误报漏报



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="特征提取、频谱与带迟滞的事件检测 · 机制路径"><title>特征提取、频谱与带迟滞的事件检测 · 机制路径</title><defs><marker id="arrow-B23-M10" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">连续数据分帧</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M10)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">计算时频特征</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M10)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">阈值与迟滞</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M10)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">验证事件与误报</text></svg>
```



特征提取、频谱与带迟滞的事件检测 · 机制路径



平均值、峰峰值和 RMS 描述不同现象。含直流信号的 RMS 同时包含偏置和波动；诊断交流振动时，先明确是否去均值。对 N 个样本，RMS=sqrt(Σx²/N)。窗口长度不仅影响统计波动，还决定至少需要等多久才能形成一个完整特征。

 

FFT 频率间隔为 fs/N。fs=1000 Hz、N=1000 时，相邻频点间隔为 1 Hz；这不意味着任何相差 1 Hz 的信号都能可靠区分。窗函数、信噪比、记录长度和泄漏也影响结果。功率谱密度单位通常是输入单位的平方/Hz，计算频带功率时要对 PSD 按频率积分。



Python · RMS 与去直流 RMS



```text
import math
mean = sum(samples) / len(samples)
rms = math.sqrt(sum(x*x for x in samples) / len(samples))
ac_rms = math.sqrt(sum((x-mean)**2 for x in samples) / len(samples))
```



事件检测不要只用一条阈值线。进入报警用 high，退出报警用 low，要求 high\>low，并限制持续时间。持续时间最好按时间戳累计；只有确认无丢样且固定周期时，才用连续样本个数换算时间。这样可以减少阈值附近的反复触发。

 

给事件检测单独设置验证集，记录误报率、漏报率和检测延迟。现场每小时误报次数常比一条“准确率”更容易解释。温控报警、振动异常和电流突变应分别定义真实事件标签。



**动手练习** 

构造 50 Hz 正弦、直流偏置、噪声和短尖峰，比较 RMS 与交流 RMS，并测试带迟滞报警。

 **检查结果** 

频谱坐标有单位；报警不在阈值附近抖动；误报和检测延迟分别统计。



核对与延伸：[SciPy：Welch 功率谱](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.welch.html)



```zhizhan-assessment
{"id":"course-b23-b23-m10","criterion":"频谱坐标有单位；报警不在阈值附近抖动；误报和检测延迟分别统计。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
