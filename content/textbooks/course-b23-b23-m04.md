# B23-M04排序、查找与标定表插值

```zhizhan-anchor
B23-M04
```



学习范围 · 二分查找；有序表；线性插值；外插；查表误差



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="排序、查找与标定表插值 · 机制路径"><title>排序、查找与标定表插值 · 机制路径</title><defs><marker id="arrow-B23-M04" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">校准点与排序</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M04)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">定位相邻区间</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M04)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">执行线性插值</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M04)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">检查误差与边界</text></svg>
```



排序、查找与标定表插值 · 机制路径



传感器常用分段标定表把原始读数 x 转成物理量 y。找到相邻点 (x0,y0)、(x1,y1)，计算 y=y0\+(y1−y0)(x−x0)/(x1−x0)。输入表的 x 必须严格递增，重复节点会导致除零，乱序会导致区间定位错误。

 

例如 x=1.5 V 位于 1 V→20°C 与 2 V→50°C 之间，插值得到 35°C。这个结果只反映局部直线假设；测量误差、表点误差和曲线弯曲仍然存在。把检查点放在标定节点之间，才能评价插值误差。



Python · 区间公式



```text
x0, y0 = 1.0, 20.0
x1, y1 = 2.0, 50.0
x = 1.5
assert x1 > x0
y = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
assert y == 35.0
```



非等距节点可二分定位，等距表可直接算索引。区间外输入要明确选择报错、钳位或外插；温控传感器超出已验证范围时，继续外插可能把断线变成正常温度。NumPy 和 CMSIS-DSP 的接口边界行为需要分别核对，不能假设两个函数天然一致。



**动手练习** 

用 5 个标定点做查表，增加端点、节点中间、超范围、重复节点与乱序输入。

 **检查结果** 

非法表被拒绝；每个边界行为有明确结果；节点间测试给出最大物理量误差。



核对与延伸：[ARM CMSIS-DSP：线性插值](https://arm-software.github.io/CMSIS-DSP/main/group__LinearInterpolate.html)



```zhizhan-assessment
{"id":"course-b23-b23-m04","criterion":"非法表被拒绝；每个边界行为有明确结果；节点间测试给出最大物理量误差。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
