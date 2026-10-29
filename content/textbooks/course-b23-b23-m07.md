# B23-M07数据采集：时间戳、序号与质量契约

```zhizhan-anchor
B23-M07
```



学习范围 · 单调时钟；采样时间；丢样；质量标志；CSV 与版本信息



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="数据采集：时间戳、序号与质量契约 · 机制路径"><title>数据采集：时间戳、序号与质量契约 · 机制路径</title><defs><marker id="arrow-B23-M07" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">采样时刻打标</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M07)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">序号检查连续性</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M07)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">质量标志随数据</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M07)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">保存原始日志</text></svg>
```



数据采集：时间戳、序号与质量契约 · 机制路径



用于控制的数据时刻应尽量代表实际采样时刻，而不是串口打印时刻。数据经 [DMA](term:dma)、队列和网络转发后，收到它的时间已经包含等待。把采样时间和接收时间分开记录，才能估计延迟，判断某个旧样本是否还可用于当前决策。

 

周期和间隔用单调时钟计算；人类可读日期可以用于对齐运行记录。时钟回绕需要按计数器位宽处理，无符号差分仅在已约定的回绕范围内有效。重启后序号可能重置，日志应带 boot\_id 或 session\_id，不能把两次启动当成一条连续采样序列。



CSV · 示例字段，不是板上实测数据



```text
session_id,seq,t_sample_us,adc_raw,temperature_c,quality,config_id
sim-001,0,0,2048,25.0,VALID,cal-v1
sim-001,1,100000,2050,25.1,VALID,cal-v1
sim-001,3,300000,0,,SENSOR_INVALID,cal-v1
```



上面的序号 2 缺失，应记录 GAP；第三条没有有效温度，不能填 0°C 继续送入控制器。质量标志可区分有效、超范围、过期、丢样、校准失效。算法除了输入值，也应接收有效性和数据年龄。

 

保存原始数据，派生列通过参数和脚本重新生成。日志至少关联固件版本、采样设置、标定系数和控制参数；否则一条看似改善的曲线，可能只是更换了标定或采样率。



**动手练习** 

为一份日志注入丢样、重复序号、重启和时间逆序；输出每类异常计数。

 **检查结果** 

无效值不会伪装成正常物理量；能区分采样间隔与传输延迟。



核对与延伸：[Python：单调计时与性能计数器](https://docs.python.org/3/library/time.html)



```zhizhan-assessment
{"id":"course-b23-b23-m07","criterion":"无效值不会伪装成正常物理量；能区分采样间隔与传输延迟。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
