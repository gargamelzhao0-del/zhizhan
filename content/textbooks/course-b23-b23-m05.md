# B23-M05状态机：正常、降级与故障锁存

```zhizhan-anchor
B23-M05
```



学习范围 · 状态；事件；转换条件；故障锁存；恢复与重新使能



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="状态机：正常、降级与故障锁存 · 机制路径"><title>状态机：正常、降级与故障锁存 · 机制路径</title><defs><marker id="arrow-B23-M05" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">SAFE 等待使能</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M05)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">ACTIVE 正常控制</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M05)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">FAULT 输出关闭</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M05)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">复位后回到 SAFE</text></svg>
```



状态机：正常、降级与故障锁存 · 机制路径



控制公式解决“输出多少”，状态机解决“此刻是否允许输出”。为温控定义 SAFE、ACTIVE、FAULT：上电进入 SAFE；数据有效且用户使能后进入 ACTIVE；传感器失效或超温进入 FAULT，并立即关闭加热。故障恢复后，需要显式复位回到 SAFE，再经过使能才能重新运行。

 

把优先级写在转换逻辑里：故障条件先于使能条件。否则复位和超温同一周期出现时，程序可能短暂恢复输出。每个状态还应说明进入动作，例如清理积分、初始化滤波状态、记录故障码；这些动作和持续执行的状态动作要区分。



C · 逻辑顺序，完整函数见 algorithms.c



```text
if (!sensor_ok || overtemp) return FAULT;
if (state == FAULT) return reset ? SAFE : FAULT;
if (state == SAFE && arm) return ACTIVE;
return state;
```



恢复不等于抹掉故障记录。保存首次故障时间和原因，复位只改变运行状态。计时器溢出、通讯重连、设备重启都属于输入事件；用状态—事件表逐项考虑，能减少多个布尔标志互相矛盾的情况。



**动手练习** 

列出每个状态遇到 sensor\_invalid、overtemp、reset、arm 时的结果，运行 C 实验中的锁存断言。

 **检查结果** 

故障优先；数据恢复不会自动重新输出；复位和使能不会在一次转换中越过 SAFE。



核对与延伸：[W3C SCXML：状态与转换语义（本例为自写 C）](https://www.w3.org/TR/scxml/)



```zhizhan-assessment
{"id":"course-b23-b23-m05","criterion":"故障优先；数据恢复不会自动重新输出；复位和使能不会在一次转换中越过 SAFE。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
