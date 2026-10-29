# 部署

```zhizhan-anchor
m06
```



部署要把模型落到具体运行时：选框架、确认 **算子支持** 、规划 **内存** 、把模型与固件版本绑定。“算子不支持”是最常见的部署失败。

 

> 前置：Module 05 的量化模型。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为目标运行时核对算子支持并按峰值规划张量内存，完成一次可加载部署。

 

本章速览




- 部署先确认运行时算子支持。

- 张量内存按峰值规划。

- 模型与固件版本绑定。

 

```zhizhan-anchor
m06-runtime
```



```zhizhan-anchor
m06-runtime-t
```



## 6.1 选运行时与查算子



部署要把模型落到具体运行时：TFLite Micro（MCU 常见）、CMSIS-NN（Cortex-M 优化）、ONNX Runtime（算子全但偏大）。第一件事是用运行时的转换器核对 **算子支持** 。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  部署流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="部署流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">选运行时</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">转换</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">查算子</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">内存/绑定</text></svg>
```



选运行时 → 转换模型 → 核对算子支持 → 规划 arena（峰值）→ 绑定固件版本 → 加载运行。



表 6.1 运行时取舍



| 运行时 | 优点 | 代价 |
| --- | --- | --- |
| TFLite Micro | 轻量、MCU 常见 | 算子/内存受限 |
| CMSIS-NN | Cortex-M 优化 | 需移植 |
| ONNX Runtime | 算子全 | 偏大 |
| LiteRT | Google 生态 | 依平台 |



runtime\_check.c 节选C

 

```text
if (!ops_all_supported(model)) return ERR_OPS;      // 算子支持
if (model_peak_bytes() > ARENA_BYTES) return ERR_MEM;// 峰值内存
if (model_ver() != EXPECT) return ERR_VER;           // 版本绑定
```

部署三查：算子、峰值内存、版本绑定



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：延迟与预算



部署后要对照预算测量。延迟预算证据（逐层求和与截止期）：



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



这里 690µs 是输入预算的求和，不是部署实测；运行 labs/benchmark\_ort.py 得到本机数据，再在目标设备重测。



表 6.2 部署检查点



| 检查项 | 方法 | 通过标志 |
| --- | --- | --- |
| 算子支持 | 转换器检查 | 全部支持 |
| 内存峰值 | arena 规划 | 在预算内 |
| 延迟 | 实测 | ≤ 截止期 |
| 绑定 | 模型-固件版本 | 一致 |



```zhizhan-anchor
m06-mem
```



```zhizhan-anchor
m06-mem-t
```



## 6.3 内存规划与绑定



张量内存（arena）要按 **峰值** 规划，否则运行到某一层就 OOM。模型要与固件版本绑定，避免更新后错配。



deploy.c 节选C

 

```text
static uint8_t tensor_arena[ARENA_BYTES] __attribute__((aligned(16)));
if (ARENA_BYTES < model_peak_bytes()) return -1;   // 按峰值规划
if (model_version() != fw_expect_model()) return -2; // 版本绑定校验
interpreter_init(&itp, model, tensor_arena, ARENA_BYTES);
```

arena 按峰值规划 \+ 模型/固件版本绑定校验



表 6.3 部署风险与对策



| 风险 | 后果 | 对策 |
| --- | --- | --- |
| 算子不支持 | 转换/运行失败 | 替换/回退算子 |
| arena 按均值 | 峰值 OOM | 按峰值规划 |
| 预处理不一致 | 精度掉 | 版本绑定 |
| 版本错配 | 加载失败 | 绑定校验 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与三级对照



部署自检：算子支持、内存峰值、延迟、版本绑定四项全过。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  arena 峰值 vs 均值（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="arena 峰值 vs 均值（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">均值</text><rect x="150" y="26" width="185" height="18" rx="4" class="sv-box"></rect><text x="343" y="43" class="sv-lbl-hi">40KB(相对)</text><text x="12" y="67" class="sv-lbl">峰值</text><rect x="150" y="50" width="462" height="18" rx="4" class="sv-red-s"></rect><text x="620" y="67" class="sv-lbl-hi">100KB(相对)</text><text x="12" y="91" class="sv-lbl">预算</text><rect x="150" y="74" width="554" height="18" rx="4" class="sv-grn-s"></rect><text x="712" y="91" class="sv-lbl-hi">120KB(相对)</text></svg>
```



峰值出现在最“拥挤”的一层，明显高于均值。按均值分配会在该层 OOM。



表 6.4 三级部署



| 层级 | 部署形态 | 注意 |
| --- | --- | --- |
| MCU 端 | TFLite Micro | 算子/内存紧 |
| Linux 边缘 | ONNX Runtime/LiteRT | 依赖较多 |
| 云/训练 | 训练框架导出 | 版本对齐 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **用了不支持的算子** ：转换/运行失败。

- **arena 按平均分配** ：峰值 OOM。

- **预处理与训练不一致** ：精度掉。

- **模型与固件版本不绑** ：更新后错配。



◆ 自测 · Module 06（先答再看）




1. 为什么张量内存要按峰值规划？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"推理时中间张量按层生命周期复用，峰值出现在最“拥挤”的一层；按平均会低估，运行时 OOM。"}
   ```

2. 部署前第一件事为什么是“查算子支持”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"“算子不支持”是最常见的部署失败。用运行时的转换器先核对，避免转换/运行期才发现。"}
   ```

3. 为什么模型要与固件版本绑定？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"运行时（算子集/张量约定）与模型形状/算子强相关。不绑定会在更新后错配，导致加载失败或结果错误。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用目标运行时转换你的模型并核对算子与内存峰值，把模型/预处理/固件版本写进绑定校验。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [ONNX Runtime](https://onnxruntime.ai/docs/)

 

动手练习



运行 ` labs/host_latency.c `（延迟预算）；用目标运行时检查器核对算子与内存峰值。



**检查结果：** 模型算子全部被运行时支持；张量内存峰值在预算内；在实际运行时测冷启动、预热后 p50/p95/p99 与端到端耗时，再与预先声明的截止期比较；690/800 只是预算演算。

 

迁移练习：把本章的“能为目标运行时核对算子支持并按峰值规划张量内存，完成一次可加载部署。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m06","criterion":"模型算子全部被运行时支持；张量内存峰值在预算内；在实际运行时测冷启动、预热后 p50/p95/p99 与端到端耗时，再与预先声明的截止期比较；690/800 只是预算演算。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
