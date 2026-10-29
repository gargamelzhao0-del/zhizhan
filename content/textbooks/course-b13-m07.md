# 推理性能优化

```zhizhan-anchor
m07
```



优化先 **找瓶颈** （哪层最贵），再对症：算子融合、剪枝、DSP 指令、cache 友好布局。延迟与吞吐常常此消彼长，按目标优化并复测精度。

 

> 前置：Module 06 的部署与内存规划。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能定位最重层瓶颈并给出可复测的延迟优化，且不牺牲业务精度。

 

本章速览




- 先找瓶颈（最重层）再优化。

- 融合/剪枝/DSP/布局各有权衡。

- 每步复测延迟与精度。

 

```zhizhan-anchor
m07-find
```



```zhizhan-anchor
m07-find-t
```



## 7.1 先找瓶颈再优化



优化先测量定位瓶颈（哪层最贵、是算力还是访存），再对症：算子融合（减访存）、剪枝（减计算）、DSP/SIMD（加速）、布局优化（cache 命中）。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  优化的正确顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="优化的正确顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">测量</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">找最重层</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">判瓶颈</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">优化+复测</text></svg>
```



测量逐层耗时 → 找最重层 → 判瓶颈类型（算力/访存）→ 针对性优化 → 复测延迟与精度。



表 7.1 优化手段



| 手段 | 收益 | 代价 |
| --- | --- | --- |
| 算子融合 | 减少访存 | 实现复杂 |
| 剪枝 | 减少计算 | 精度/稀疏支持 |
| SIMD/DSP | 数倍加速 | 可移植性 |
| 布局优化 | cache 命中 | 预处理成本 |
| 多线程 | 吞吐 | 延迟/功耗 |



opt.c 节选C

 

```text
uint32_t d0 = bench(); uint32_t i = argmax_layer();  // 找最重层
optimize_layer(i);
assert(bench() < d0 && (f1_before - f1_after) <= 0.01f); // 复测延迟+精度
```

先找最重层；优化后复测延迟与精度



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：最重层定位



延迟由少数关键层主导。定位证据（最重层占比）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_latency.cC\n\n \n\n```text\n/* host_latency.c —— 推理延迟预算：逐层耗时求和与截止期判定（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_latency.c -o host_latency && ./host_latency\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int layers_us[] = {50, 180, 300, 120, 40};   /* 教学预设值，不是设备推理测量 */\n    int n = (int)(sizeof(layers_us)/sizeof(layers_us[0]));\n    int total = 0; for (int i = 0; i < n; i++) total += layers_us[i];\n    int deadline = 800;\n    printf(\"预设层耗时预算=%dus 截止期=%dus → %s\\n\", total, deadline, total <= deadline ? \"满足\" : \"超期\");\n    if (total != 690) ok = 0;\n    if (!(total <= deadline)) ok = 0;\n    printf(\"最重层占 %.0f%%（优化优先它）\\n\", 300.0*100/total);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n逐层耗时与瓶颈定位（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_latency.c -o labs/host_latency && ./labs/host_latency
预设层耗时预算=690us 截止期=800us → 满足
最重层占 43%（优化优先它）
RESULT: PASS
```



最重层占 43%——它定义了优化优先级；优化后复测总延迟与精度。



表 7.2 按瓶颈类型选手段



| 瓶颈类型 | 判据 | 首选优化 |
| --- | --- | --- |
| 算力 | MAC 多 | DSP/SIMD、剪枝 |
| 访存 | 权重读取大 | 融合、布局 |
| 内存 | 峰值高 | 量化、复用 |
| 并行不足 | 核闲置 | 多线程/流水 |



```zhizhan-anchor
m07-regress
```



```zhizhan-anchor
m07-regress-t
```



## 7.3 每步复测



每优化一步都要复测延迟与精度；优化不能牺牲业务指标。



opt.c 节选C

 

```text
float d0 = bench_latency(); float f0 = f1(model, test);
fuse_layers(&model);
float d1 = bench_latency(); float f1v = f1(model, test);
if (f0 - f1v > 0.01f) revert();   // 精度回退>1% 则回滚
assert(d1 < d0);
```

每步复测：延迟下降且精度回退不超过 1%



表 7.3 优化复测清单



| 优化 | 复测项 | 通过标准 |
| --- | --- | --- |
| 融合 | 延迟/精度 | 降延迟、精度不降\>1% |
| 剪枝 | 延迟/精度 | 同上 |
| DSP | 延迟/可移植 | 功能一致 |
| 多线程 | 延迟/抖动 | 实时性不恶化 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检与三级对照



优化自检：找过瓶颈、按类型优化、每步复测、精度不退化。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  优化前后延迟（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="优化前后延迟（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">优化前</text><rect x="150" y="26" width="487" height="18" rx="4" class="sv-amb-s"></rect><text x="645" y="43" class="sv-lbl-hi">690µs</text><text x="12" y="67" class="sv-lbl">优化后</text><rect x="150" y="50" width="339" height="18" rx="4" class="sv-grn-s"></rect><text x="497" y="67" class="sv-lbl-hi">480µs</text><text x="12" y="91" class="sv-lbl">截止期</text><rect x="150" y="74" width="565" height="18" rx="4" class="sv-cyn-s"></rect><text x="723" y="91" class="sv-lbl-hi">800µs</text></svg>
```



针对最重层优化后总延迟明显下降；若无变化，说明没找到真瓶颈。



表 7.4 三级优化



| 层级 | 优化重点 | 手段 |
| --- | --- | --- |
| MCU 端 | 算力/访存 | CMSIS-NN、融合 |
| Linux 边缘 | 并行/加速 | GPU/NPU、多线程 |
| 云/训练 | 训练吞吐 | 分布式 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **凭感觉优化** ：没找瓶颈。

- **只追速度不看精度** ：业务指标崩。

- **忽视 cache 布局** ：访存成瓶颈。

- **多线程引入抖动** ：实时性变差。



◆ 自测 · Module 07（先答再看）




1. 优化端侧推理为什么要先“找瓶颈”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"延迟由少数关键层/访存主导，盲目优化收益低。先测量定位，再针对性优化，并复测精度。"}
   ```

2. 优化后为什么要“复测精度”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"优化（融合/剪枝/近似）可能改变数值行为，导致业务指标回退。必须复测，超过阈值就回滚。"}
   ```

3. “访存瓶颈”的首选优化是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"减少访存：算子融合、cache 友好布局、权重压缩（量化）。它们直接降低内存带宽压力。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对你模型逐层测耗时找出最重层，针对它的瓶颈类型做一次优化并复测延迟与精度。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_latency.c `：定位最重层并估算优化收益；复测精度不退化。



**检查结果：** 先用真实 profile 找瓶颈；同数据、线程数与预热条件比较优化前后 p95、输出误差及资源，阈值在实验前声明。

 

迁移练习：把本章的“能定位最重层瓶颈并给出可复测的延迟优化，且不牺牲业务精度。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m07","criterion":"先用真实 profile 找瓶颈；同数据、线程数与预热条件比较优化前后 p95、输出误差及资源，阈值在实验前声明。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
