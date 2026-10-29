# 算法、数据与控制实战 · 学习路线

```zhizhan-anchor
top
```



B23 / 算法、数据与控制



## 算法、数据与 控制实战



从采样数据出发，让算法按时算对，让控制有据可调。用可回放实验连接 MCU、数据分析与物理系统。

正文可读 · 实战入门

**算法** 实现与边界 **数据** 契约与回放 **控制** 响应与约束 **迁移** 验证与测量



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="学习路线：从输入数据到可验证的闭环系统"><title>学习路线：从输入数据到可验证的闭环系统</title><defs><marker id="arrow-overview" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">算法与实现</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-overview)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">数据与信号</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-overview)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">控制与估计</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-overview)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">落地与验证</text></svg>
```



学习路线：从输入数据到可验证的闭环系统



[从第一章开始](doc:course-b23-b23-m01#B23-M01)[打开温控交互实验](doc:course-b23-b23-m13#B23-M13)[运行完整仿真](doc:course-b23-b23-m17#B23-M17)



语言准备：[C 基础](doc:course-b00-guide) · [Python 基础](doc:course-b04a-guide)  
关联学习：[算法与数学](doc:course-b19-guide) · [信号与控制](doc:course-b20-guide) · [机器学习与数据](doc:course-b21-guide)  
本册提供入门讲解与主机实验；接板练习结合 [MCU 与外设](doc:course-b05-guide) 完成，板上测量另行记录。

 

```zhizhan-anchor
book-mastery
```



```zhizhan-anchor
book-mastery-title
```



## 控制项目实战 · 读到能完成什么？



**完成有版本数据、参数、故障注入与量化指标的温控回放项目。**



入门条件：B00 核心、B20 采样/PID 的相关小节；可先用确定性仿真。



首次阅读：[从需求到算法、数据与控制链](doc:course-b23-b23-m01#B23-M01) → [环形缓冲、滑动窗口与流式算法](doc:course-b23-b23-m03#B23-M03) → [数值计算、浮点误差与 Q15 定点](doc:course-b23-b23-m06#B23-M06) → [数据采集：时间戳、序号与质量契约](doc:course-b23-b23-m07#B23-M07) → [重采样与滤波：平滑背后的延迟](doc:course-b23-b23-m09#B23-M09) → [对象建模与阶跃辨识](doc:course-b23-b23-m11#B23-M11) → [离散控制、采样周期与实时预算](doc:course-b23-b23-m12#B23-M12) → [PI/PID：限幅、抗饱和与交互实验](doc:course-b23-b23-m13#B23-M13) → [数据回放、自动指标与故障注入](doc:course-b23-b23-m16#B23-M16) → [综合实战：可回放的温控闭环](doc:course-b23-b23-m17#B23-M17)



按需延后：电机、振动与更复杂控制按后续项目选读，不和 B20 从头重复。



```zhizhan-details
{"title":"独立验收：先做，再展开核对","body":"**需求变更与故障：** 改采样周期、加执行器饱和和传感器冻结；重新辨识、调参并说明失效边界。\n\n\n\n**通过判据：** 单位/时间/饱和政策一致，指标来自实际轨迹；没有把短时收敛当稳态或实机稳定性证明。\n\n\n\n先不看示例独立实现；卡住时只查对应小节。成功复现后换一个输入、平台或需求，说明为什么仍成立。记录证据路径与失败原因，不以勾选数量代替能力。\n\n\n\n参考工程：[P02](doc:course-projects#P02)；[全库项目路线与时间安排](doc:course-learning-path)。"}
```



时间为规划估计，阅读、编程、排错分开记录。主机测试、SDK 构建与板上测量分别验收；自评不等于能力认证。

                   

```zhizhan-anchor
B23-references
```



## 核对机制，继续深入



以下为官方项目文档和作者维护的参考。本文图解与练习为本册自行编写；涉及软件接口时，以实际安装版本的文档为准。




- [Linux 内核：环形缓冲区](https://docs.kernel.org/core-api/circular-buffers.html)索引、容量与并发发布顺序

- [ARM CMSIS-DSP：线性插值](https://arm-software.github.io/CMSIS-DSP/main/group__LinearInterpolate.html)浮点与定点插值接口

- [NumPy：方差](https://numpy.org/doc/stable/reference/generated/numpy.var.html)ddof、统计口径与累计精度

- [SciPy：多相重采样](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.resample_poly.html)改变采样率时的低通滤波

- [SciPy：二阶节滤波](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfilt.html)因果滤波与分块状态

- [SciPy：双向滤波](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfiltfilt.html)离线前后向滤波的适用边界

- [SciPy：Welch 功率谱](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.welch.html)频率与功率谱密度

- [SciPy：连续模型离散化](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.cont2discrete.html)零阶保持与离散模型

- [MathWorks：PID 抗积分饱和](https://www.mathworks.com/help/simulink/slref/anti-windup-control-using-a-pid-controller.html)条件积分、反算与执行器约束

- [FilterPy：线性卡尔曼滤波](https://filterpy.readthedocs.io/en/latest/kalman/KalmanFilter.html)状态、协方差与预测更新

- [FreeRTOS：周期任务](https://freertos.org/Documentation/02-Kernel/04-API-references/02-Task-control/02-vTaskDelayUntil)绝对周期唤醒与调度边界

- [Python：单调计时与性能计数器](https://docs.python.org/3/library/time.html)主机测时与墙上时间的区别

- [W3C SCXML：状态与转换语义（本例为自写 C）](https://www.w3.org/TR/scxml/)事件、转换与状态机语义延伸

- [CMSIS-DSP：Q15乘法与饱和](https://arm-software.github.io/CMSIS-DSP/main/group__BasicMult.html)定点范围与乘法饱和边界

- [MathWorks：梯形速度轨迹](https://www.mathworks.com/help/robotics/ref/trapveltraj.html)峰值、加速度与运动时长约束

- [SciPy：非等间隔梯形积分](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.trapezoid.html)按实际采样点与时间间隔积分
