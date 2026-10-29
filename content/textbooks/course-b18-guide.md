# 处理器与计算机体系结构 · 学习路线

```zhizhan-anchor
top
```

 

```zhizhan-anchor
content
```



◆ MODULE · 基础支撑

 

## 处理器与 体系结构

 

这本书回答的是： **为什么同样的 C 代码在不同芯片上性能差很多、并发内存序出错、[DMA](term:dma) 读到旧数据** ——问题分别落在 ISA/调用约定、内存层次、MMU/MPU、cache 一致性与内存序上。内容从  **MCU/MPU/SoC、汇编与调用约定、异常特权、内存层次** ，一路到  **MPU/MMU、DMA 一致性、内存序、RISC-V/Arm 对照、性能预算与跨平台分析** 。

 

**10** 模块 / 主题



**3** 架构



**5\+10** 运行 / 对照



**10** 机制图示

 

本文档的定位



面向 **会写 C、懂寄存器，但没系统学过体系结构** 的开发者。默认你能点灯能调度，但对“调用约定、cache、MMU、内存序”只有模糊印象。



每一章都包含：机制图 → 主机可运行的体系结构模型 →  **真实运行证据**  → 架构对照 → 失败路径 → 动手练习 → 自测。

 

证据怎么读



调用约定/参数入栈、cache 命中与局部性、内存序 (relaxed vs acquire)、虚拟到物理翻译与权限、CPI/周期预算等来自 ` labs/host_*.c `（主机 ` gcc ` 真实运行，打印 ` RESULT: PASS `）。

   

```zhizhan-anchor
book-mastery
```



```zhizhan-anchor
book-mastery-title
```



## 按问题查阅 · 读到能完成什么？



**解释同一数据缓冲在 CPU、DMA 与其他核心之间的[所有权](term:ownership)交接。**



入门条件：B00 对象、指针；当前平台手册。



首次阅读：[MCU、MPU 与 SoC](doc:course-b18-m01#m01) → [汇编与调用约定](doc:course-b18-m02#m02) → [异常、中断与特权级](doc:course-b18-m03#m03) → [内存层次与性能](doc:course-b18-m04#m04) → [DMA 与 Cache 一致性](doc:course-b18-m06#m06) → [内存序与多核共享](doc:course-b18-m07#m07)



按需延后：MMU/RISC-V/跨平台性能只在目标涉及时读，不要求为 MCU 项目先学全体系结构。



```zhizhan-details
{"title":"独立验收：先做，再展开核对","body":"**需求变更与故障：** 使缓冲跨 Cache 行、让 acquire 未读到发布值，分析旧数据和数据竞争风险。\n\n\n\n**通过判据：** 结论带核心型号、缓存属性、对齐与屏障依据；主机模型不替代架构保证。\n\n\n\n先不看示例独立实现；卡住时只查对应小节。成功复现后换一个输入、平台或需求，说明为什么仍成立。记录证据路径与失败原因，不以勾选数量代替能力。\n\n\n\n参考工程：[P01](doc:course-projects#P01)；[全库项目路线与时间安排](doc:course-learning-path)。"}
```



时间为规划估计，阅读、编程、排错分开记录。主机测试、SDK 构建与板上测量分别验收；自评不等于能力认证。
