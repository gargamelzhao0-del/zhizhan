# Linux 推理与硬件加速

```zhizhan-anchor
m11
```



Linux 边缘设备算力更强，可用 NPU/GPU/DSP 加速。要点是 **选对运行时** 、把算子放到加速器、 **减少拷贝** ，并控制功耗与热。

 

> 前置：Module 06 的部署与 Module 07 的优化。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为 Linux 边缘模型选加速后端并把拷贝开销计入延迟与功耗预算。

 

本章速览




- 边缘用 NPU/GPU/DSP，注意算子与量化约束。

- 拷贝常是隐藏瓶颈，尽量零拷贝。

- 控制功耗与热。

 

```zhizhan-anchor
m11-backend
```



```zhizhan-anchor
m11-backend-t
```



## 11.1 选加速后端



CPU(SIMD)/GPU/NPU/DSP 各有适用：NPU 对定点高效但算子/量化受限，GPU 并行大但功耗高，DSP 适合信号类。异构调度要减少 CPU↔加速器拷贝。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  异构推理的数据流



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="异构推理的数据流" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">CPU 预处理</text><rect x="60" y="64" width="680" height="40" rx="6" class="sv-red-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">拷贝→加速器（总线）</text><rect x="60" y="108" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="132.0" class="sv-lbl-hi">NPU/GPU/DSP 推理</text><rect x="60" y="152" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="171.0" class="sv-lbl-hi">拷贝回 CPU</text></svg>
```



预处理 → 拷到加速器 → 推理 → 拷回 → 后处理。拷贝走总线，带宽有限，常是隐藏瓶颈。



表 11.1 加速后端



| 后端 | 适用 | 注意 |
| --- | --- | --- |
| CPU(SIMD) | 通用 | 延迟受核数 |
| GPU | 并行大 | 功耗/驱动 |
| NPU | 定点高效 | 算子/量化约束 |
| DSP | 信号类 | 编程复杂 |
| 异构 | 分工流水 | 调度与拷贝 |



accel.c 节选C

 

```text
void *dev = accel_alloc(bytes);           // 零拷贝/共享缓冲
copy_to_accel(in, dev); accel_run(model, dev);  // 拷贝计入延迟
if (accel_cpu_fallback(model) > 0) warn();      // 检测算子回退
```

共享缓冲 \+ 拷贝计入延迟 \+ 检测算子回退



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：端到端延迟预算



端到端延迟含拷贝。用逐层/分段预算核对是否仍满足截止期：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_latency.cC\n\n \n\n```text\n/* host_latency.c —— 推理延迟预算：逐层耗时求和与截止期判定（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_latency.c -o host_latency && ./host_latency\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int layers_us[] = {50, 180, 300, 120, 40};   /* 教学预设值，不是设备推理测量 */\n    int n = (int)(sizeof(layers_us)/sizeof(layers_us[0]));\n    int total = 0; for (int i = 0; i < n; i++) total += layers_us[i];\n    int deadline = 800;\n    printf(\"预设层耗时预算=%dus 截止期=%dus → %s\\n\", total, deadline, total <= deadline ? \"满足\" : \"超期\");\n    if (total != 690) ok = 0;\n    if (!(total <= deadline)) ok = 0;\n    printf(\"最重层占 %.0f%%（优化优先它）\\n\", 300.0*100/total);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n延迟预算模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_latency.c -o labs/host_latency && ./labs/host_latency
预设层耗时预算=690us 截止期=800us → 满足
最重层占 43%（优化优先它）
RESULT: PASS
```



计算 690µs 满足 800µs；加速时要把 CPU↔加速器拷贝计入，否则端到端可能超期。



表 11.2 端到端延迟构成



| 开销 | 计入 | 说明 |
| --- | --- | --- |
| 计算 | 必须 | NPU/GPU 推理 |
| 拷贝 | 必须 | 隐藏瓶颈 |
| 预处理 | 尽量 | 可放加速器侧 |
| 同步 | 视情况 | 调度开销 |



```zhizhan-anchor
m11-copy
```



```zhizhan-anchor
m11-copy-t
```



## 11.3 减少拷贝与功耗



用零拷贝/共享缓冲，并把预处理也尽量放到加速器侧；加速器常要求定点，量化不匹配就无法加速。



accel.c 节选C

 

```text
void *devbuf = accel_alloc(bytes);        // 共享/零拷贝缓冲
copy_to_accel(model_input, devbuf);       // 拷贝计入延迟预算
accel_run(model, devbuf);                 // NPU/DSP 执行
if (accel_fallback_to_cpu(model) > 0) warn();  // 算子回退=没加速
```

零拷贝缓冲 \+ 把拷贝计入预算 \+ 检测算子回退



表 11.3 加速风险与对策



| 风险 | 后果 | 对策 |
| --- | --- | --- |
| 算子回退 CPU | 没加速 | 检测回退占比 |
| 拷贝成瓶颈 | 延迟超期 | 零拷贝/共享 |
| 量化不匹配 | 无法加速 | 定点校准 |
| 功耗/热 | 降频 | 功耗预算 |



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检与三级对照



加速自检：算子支持、拷贝计入、无回退、功耗在预算。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  端到端延迟构成（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="端到端延迟构成（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">计算</text><rect x="150" y="26" width="330" height="18" rx="4" class="sv-grn-s"></rect><text x="488" y="43" class="sv-lbl-hi">55%</text><text x="12" y="67" class="sv-lbl">拷贝</text><rect x="150" y="50" width="180" height="18" rx="4" class="sv-red-s"></rect><text x="338" y="67" class="sv-lbl-hi">30%</text><text x="12" y="91" class="sv-lbl">预处理</text><rect x="150" y="74" width="90" height="18" rx="4" class="sv-amb-s"></rect><text x="248" y="91" class="sv-lbl-hi">15%</text></svg>
```



计算 \+ 拷贝 \+ 预处理。拷贝占比可能很大，是优化的关键。



表 11.4 三级加速



| 层级 | 加速后端 | 注意 |
| --- | --- | --- |
| MCU 端 | CMSIS-NN/DSP | 定点 |
| Linux 边缘 | NPU/GPU/DSP | 拷贝/算子 |
| 云/训练 | GPGPU | 吞吐 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **算子回退到 CPU** ：加速器没真正用上。

- **忽略拷贝** ：带宽成瓶颈。

- **只追速度不看功耗/热** ：降频/烫手。

- **量化不匹配 NPU** ：无法加速。



◆ 自测 · Module 11（先答再看）




1. 为什么“数据拷贝”常是异构推理的隐藏瓶颈？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CPU 与加速器间搬数据要走总线/内存，带宽有限且可能与计算争用；拷贝时间可能超过计算时间。零拷贝/共享缓冲能显著降低。"}
   ```

2. 加速后为什么还要检测“算子回退”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不支持的算子会静默回退到 CPU，导致“看起来用了加速器实际没有”。检测回退占比才知道真加速。"}
   ```

3. 为什么加速器常要求定点（量化）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"NPU/DSP 对定点（int8）有专用流水线更高效；浮点或量化不匹配的模型无法被加速，只能回退 CPU。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的 Linux 边缘模型选后端，测量计算/拷贝/预处理分段延迟，确保端到端在截止期内。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [ONNX Runtime](https://onnxruntime.ai/docs/)

 

动手练习



运行 ` labs/host_latency.c `（延迟预算）；为你的模型选后端并估算拷贝与计算开销。



**检查结果：** 记录实际 EP/算子回退、拷贝与预处理开销；用实测端到端分布和板上功耗核对需求，预设 690µs 不作为测量。

 

迁移练习：把本章的“能为 Linux 边缘模型选加速后端并把拷贝开销计入延迟与功耗预算。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-anchor
m11-real-runtime
```



```zhizhan-anchor
m11-real-runtime-t
```



## 真实运行时、实际后端与可比较的测量

 

预算表回答“希望多快”；benchmark 回答“这个模型在这个环境中多快”。先从项目根目录运行 P05 生成模型，再运行：

 

```text
python projects/p05_model_pipeline.py
python b13/labs/benchmark_ort.py --model projects/results/p05/model-int8.onnx --reference projects/results/p05/model.onnx --data projects/results/p05/data.csv --output benchmark.json --require-provider-only
```

 

[实验源码](textbook-file:b13/labs/benchmark_ort.py)遍历隔离的测试会话，比较浮点参考输出；分别测会话创建、首次调用与预热后 p50/p95/p99。计时包含 Python 调用，不包含文件 IO、外部采集和图外预处理。合成数据只验管线，不验现场识别率。

 

计时与 profile 使用独立会话，避免把跟踪开销混入延迟。报告实际节点 provider；请求了 NPU/GPU 不代表全部算子在该设备执行。更换后端后必须重测数值误差、数据拷贝与端到端开销。Windows CPU 结果不能当 MCU WCET 或板上功耗。

 

| 路线 | 应先验证 | 停止继续投入的条件 |
| --- | --- | --- |
| MCU 小模型 | 算子、arena、预处理、Flash/RAM 与硬截止期 | 简单规则达到业务指标，模型并无收益 |
| ONNX Runtime / EP | 图划分、后端支持、回退、拷贝与线程配置 | 后端缺关键算子，端到端并未改善 |
| LiteRT / ExecuTorch | 实际目标支持、导出链、量化和委托执行后端 | 必须维护大量自定义算子且无法承担长期成本 |

 

练习：使用同输入、同线程与预热策略对比两份模型，报告质量、延迟分布和文件大小；量化没有收益也应接受该结论。单独声明内存/功耗测量方法，不把文件体积当 RAM 峰值。

 

[ORT 执行后端](https://onnxruntime.ai/docs/execution-providers/) · [ORT profiling](https://onnxruntime.ai/docs/performance/tune-performance/profiling-tools.html) · [LiteRT](https://developers.google.cn/edge/litert/overview) · [ExecuTorch](https://docs.pytorch.org/executorch/stable/quick-start-section.html)（2026-10-13 核对；不同运行时按目标官方支持矩阵选型）。



```zhizhan-assessment
{"id":"course-b13-m11","criterion":"记录实际 EP/算子回退、拷贝与预处理开销；用实测端到端分布和板上功耗核对需求，预设 690µs 不作为测量。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
