# B23-M18迁移实战：电机调速与振动数据诊断

```zhizhan-anchor
B23-M18
```



学习范围 · 编码器速度；低速量化；速度 PI；限流；振动特征；多率任务；扩展方向



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="迁移实战：电机调速与振动数据诊断 · 机制路径"><title>迁移实战：电机调速与振动数据诊断 · 机制路径</title><defs><marker id="arrow-B23-M18" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">编码器与振动采样</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M18)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">速度与频带特征</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M18)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">速度环与限制</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M18)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">运行数据诊断</text></svg>
```



迁移实战：电机调速与振动数据诊断 · 机制路径



把温度换成速度，闭环结构仍然成立，但采样、驱动和模型需要重新建立。若编码器每转有效计数为 C，在窗口 Ts 内变化 Δn，转速 RPM=60·Δn/(C·Ts)。C 必须包含实际解码倍率；计数器回绕、方向和齿轮比也要统一。

 

低速短窗口可能连续多次得到零计数，然后突然跳变。可增加窗口或用相邻边沿周期估计速度，但前者增加延迟，后者需要处理超时和停转。根据速度范围选择方法，记录估计年龄；不能把未到新边沿当成无限保持旧速度。

 

先建立局部电机模型和驱动输出方向，再做速度 PI、斜率限制与输出限幅。电流限值、欠压、堵转及编码器失效进入故障状态机。带功率驱动的调试还需要器件额定范围和实际保护；本册附带代码只完成主机算法验证。

 

振动采样可以与速度控制使用不同频率。按稳定运行段计算交流 RMS、频带能量和峰值；改变转速会移动与转频相关的谱线，固定频率阈值可能误报。记录转速、负载、安装方式和采样设置，并按不同设备与工况留出验证数据。

 

完成这一项目后，可继续研究状态空间、LQR、MPC、机器人定位与规划、FOC、在线系统辨识和数据驱动诊断。进入这些方向前，先验证现有链路的数据质量、模型、实时预算和故障边界。



**动手练习** 

选择自己的电机或离线计数日志，生成速度估计；注入计数丢失与停转，再设计调速和诊断数据接口。

 **检查结果** 

编码器倍率与单位正确；低速和停转行为明确；控制时序与诊断窗口分开；板上验证单独记录。



```zhizhan-assessment
{"id":"course-b23-b23-m18","criterion":"编码器倍率与单位正确；低速和停转行为明确；控制时序与诊断窗口分开；板上验证单独记录。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
