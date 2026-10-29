# B23-M08标定、统计与异常数据处理

```zhizhan-anchor
B23-M08
```



学习范围 · 两点标定；偏置；方差；中值与 MAD；异常标志；数据分割



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="标定、统计与异常数据处理 · 机制路径"><title>标定、统计与异常数据处理 · 机制路径</title><defs><marker id="arrow-B23-M08" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">参考测量与标定</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M08)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">残差与噪声统计</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M08)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">标记异常样本</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M08)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">独立数据验证</text></svg>
```



标定、统计与异常数据处理 · 机制路径



两点线性标定先确定斜率 a=(y2−y1)/(x2−x1)，再求偏置 b=y1−a·x1，得到 y=a·x\+b。参考仪器也有误差；使用更多点检查非线性、温漂和重复性。拟合所用数据与验证所用数据分开，才能判断标定是否能迁移到新工况。

 

均值描述中心位置，方差描述离散程度。总体描述常用除数 N；估计独立同分布样本背后的总体方差时，常用 N−1。必须固定统计口径，尤其在比较 Python 与 MCU 输出时。相关的时间序列不能简单当成大量独立样本来声称估计精度提高。



Python · 基础样本统计，只用标准库



```text
import statistics
samples = [24.9, 25.0, 25.1, 25.0, 25.0]
mean = statistics.mean(samples)
sample_var = statistics.variance(samples)  # N-1
population_var = statistics.pvariance(samples)  # N
```



对尖峰可使用中值和 MAD：MAD=median(|x−median(x)|)。MAD 为零时不能直接做除法，应有由传感器噪声和分辨率定义的最低尺度。阈值不是通用常数：启动升温、真实碰撞和传感器断线可能都会产生大变化，结合物理范围、变化率和质量标志判断。

 

异常处理要保留原值和原因。离线清洗可以排除某些样本；在线控制还需决定是保持短时旧值、进入降级，还是立即关闭输出。这个动作由故障状态机负责，不能让滤波器静默掩盖断线。



**动手练习** 

对同一批数据分别加入常数偏置、随机噪声和单点尖峰，比较均值、中值与误差曲线。

 **检查结果** 

能解释哪种误差需要标定、哪种可以滤波；异常值和处理结果可追溯。



核对与延伸：[NumPy：方差](https://numpy.org/doc/stable/reference/generated/numpy.var.html)



```zhizhan-assessment
{"id":"course-b23-b23-m08","criterion":"能解释哪种误差需要标定、哪种可以滤波；异常值和处理结果可追溯。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
