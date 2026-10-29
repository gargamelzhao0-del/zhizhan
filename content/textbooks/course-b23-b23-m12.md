# B23-M12离散控制、采样周期与实时预算

```zhizhan-anchor
B23-M12
```



学习范围 · 零阶保持；离散模型；固定周期；抖动；数据年龄；执行延迟



```zhizhan-figure
<svg viewBox="0 0 800 100" role="img" aria-label="离散控制、采样周期与实时预算 · 机制路径"><title>离散控制、采样周期与实时预算 · 机制路径</title><defs><marker id="arrow-B23-M12" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="currentColor" style="color:var(--cyn)"></path></marker></defs><rect class="node" x="10" y="22" width="175" height="52" rx="6"></rect><text x="97.5" y="54" text-anchor="middle">定时采样</text><path class="arrow" d="M185,48 H205" marker-end="url(#arrow-B23-M12)"></path><rect class="node node-primary" x="210" y="22" width="175" height="52" rx="6"></rect><text x="297.5" y="54" text-anchor="middle">本周期计算</text><path class="arrow" d="M385,48 H405" marker-end="url(#arrow-B23-M12)"></path><rect class="node" x="410" y="22" width="175" height="52" rx="6"></rect><text x="497.5" y="54" text-anchor="middle">保持执行器输出</text><path class="arrow" d="M585,48 H605" marker-end="url(#arrow-B23-M12)"></path><rect class="node" x="610" y="22" width="175" height="52" rx="6"></rect><text x="697.5" y="54" text-anchor="middle">核对延迟与抖动</text></svg>
```



离散控制、采样周期与实时预算 · 机制路径



连续对象由离散控制器驱动，执行器通常在两个更新之间保持输出。对上一章的一阶模型，保持 u 时可精确写成 T\[k\+1\]=a·T\[k\]\+(1−a)(Tamb\+G·u\[k\])，其中 a=exp(−Ts/τ)。这个式子是本册温控仿真的对象更新方式。

 

控制采样周期小于对象变化尺度是起点，但“某个固定比例”不能保证闭环稳定。模型滞后、计算延迟、滤波和控制器带宽共同影响设计。采样变快还会增加 CPU、总线和日志负担；应通过离散模型、频域分析和实验逐步确定。



Python · 恒定占空比的一阶精确更新



```text
a = math.exp(-ts / tau)
temperature = a * temperature + (1.0 - a) * (ambient + gain * duty)
```



[FreeRTOS](term:rtos) 的绝对周期唤醒接口帮助减少把“任务运行时间”累积进周期的问题，但不保证任务一定在期望时刻获得 CPU。记录实际采样间隔、计算起止、输出更新时间和 deadline miss。ISR 优先级、抢占和驱动阻塞仍可能造成抖动。

 

积分更新使用的 dt 必须与控制设计一致：固定周期实现以规定周期运行并检测超时；变周期实现用有效时间差，并专门分析异常长间隔。遇到过期数据、负时间差或明显超时，应走已定义的降级逻辑，不能把巨大 dt 直接乘进积分。



**动手练习** 

把仿真 Ts 从 0.1 s 改为 1 s、5 s；比较同一组控制参数下的响应，再对周期加入抖动。

 **检查结果** 

区分对象离散化正确与闭环稳定；输出采样间隔和超时统计。



核对与延伸：[SciPy：连续模型离散化](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.cont2discrete.html) · [FreeRTOS：周期任务](https://freertos.org/Documentation/02-Kernel/04-API-references/02-Task-control/02-vTaskDelayUntil)



```zhizhan-assessment
{"id":"course-b23-b23-m12","criterion":"区分对象离散化正确与闭环稳定；输出采样间隔和超时统计。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b23-guide)
