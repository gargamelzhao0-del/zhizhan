# B23-M06数值计算、浮点误差与 Q15 定点

```zhizhan-anchor
B23-M06
```



学习范围 · 量纲；溢出；Q15；宽乘法；饱和；量化误差



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="数值计算、浮点误差与 Q15 定点 · 机制路径"><title>数值计算、浮点误差与 Q15 定点 · 机制路径</title><defs><marker id="arrow-B23-M06" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">确定数值范围</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M06)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">选择格式与位宽</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M06)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">宽类型运算</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M06)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">缩放与饱和验证</text></svg>
```



数值计算、浮点误差与 Q15 定点 · 机制路径



先估计数值范围，再决定存储格式。Q15 常把有符号 16 位整数解释为整数值/32768，范围为 −1 到 1−1/32768。把物理量映射进去之前，必须约定满量程。例如 ±100°C 对应这个范围时，每个量化步长约为 0.00305°C。

 

两个 Q15 相乘得到带 30 个小数位的中间积，应在 32 位类型中完成乘法，再缩回 Q15。−1×−1 数学上等于 1，但正端不能表示 1，须饱和到 32767。以下使用整数除法向零截断，避免把负数右移的实现细节当成统一规则。



C · 完整函数和端点断言见 algorithms.c



```text
int32_t v = ((int32_t)x * (int32_t)y) / 32768;
if (v > 32767) v = 32767;
if (v < -32768) v = -32768;
return (int16_t)v;
```



浮点也需要范围检查。NaN 会使普通大小比较失去预期，不能只靠“低于阈值”判定传感器正常。校验 ` isfinite() `、周期是否为正、单位转换是否一致。累计大量近似值时，参考计算可使用更高精度；误差比较采用明确的绝对/相对容差。

 

滤波和控制中的量化会改变闭环行为。先用高精度离线模型作为基线，再用目标格式回放同一份输入，比较最大误差、饱和次数和响应指标；不能仅凭几个正常输入宣布定点移植成功。



**动手练习** 

检查 0、±0.5、−1×−1、接近正满量程及小负数相乘；比较浮点与定点误差。

 **检查结果** 

中间积不溢出；正端正确饱和；量化和截断规则写入参数说明。



核对与延伸：[CMSIS-DSP：Q15乘法与饱和](https://arm-software.github.io/CMSIS-DSP/main/group__BasicMult.html)



```zhizhan-assessment
{"id":"course-b23-b23-m06","criterion":"中间积不溢出；正端正确饱和；量化和截断规则写入参数说明。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
