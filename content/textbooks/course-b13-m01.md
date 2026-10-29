# 端侧 AI 全景与算力预算

```zhizhan-anchor
m01
```



端侧 AI 的第一步不是选模型，而是 **算预算** ：可用算力（MAC/s）、内存、延迟期限、功耗。预算决定了模型规模与是否量化/加速。

 

> 前置：C 语言与信号采样基础。 · ◷ 约 44 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为目标模型算出 MAC 数、峰值内存与延迟截止期，并据此选定模型规模。



```zhizhan-anchor
m01-knowledge-boundary
```



### 峰值内存不是各层 tensor 大小简单求和



峰值由张量同时存活的集合、工作区、对齐与运行时开销决定。按每一步列出仍存活的输入/输出；跳连可能延长生命，可复用缓冲则降低峰值。权重常驻量、激活峰值和整机 RAM 预算分别记录；数组求和可当保守上界，不能称实际峰值。

 

本章速览




- 先算算力/内存/延迟/功耗预算，再定模型规模。

- 延迟由少数最重层主导，优化优先它们。

- 预算→设计→测量闭环。

 

```zhizhan-anchor
m01-budget
```



```zhizhan-anchor
m01-budget-t
```



## 1.1 约束先行：先算预算再设计



端侧 AI 的第一步不是选模型，而是算 **物理约束** ：算力（MAC/s）、内存、延迟期限、功耗、带宽。先做“预算 → 设计 → 测量”的闭环，而不是先训练再想办法塞进去。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  预算驱动的端侧 AI 流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="预算驱动的端侧 AI 流程" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">定约束</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">定规模</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">部署测量</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">对照调整</text></svg>
```



定约束（算力/内存/延迟/功耗）→ 定模型规模 → 部署测量 → 对照预算调整。



表 1.1 端侧 AI 的五个约束



| 约束 | 指标 | 影响 |
| --- | --- | --- |
| 算力 | MAC 数/延迟 | 模型层数与宽度 |
| 内存 | 峰值/常驻 | 是否放得下 |
| 延迟 | 截止期 | 实时性是否达标 |
| 功耗 | 每次推理能耗 | 电池寿命 |
| 带宽 | 权重读取 | Flash 访问瓶颈 |



budget.c 节选C

 

```text
uint32_t mac = 0, mem = 0;
for (int i=0;i<nlayers;i++) { mac += layers[i].mac; mem += layers[i].tensor; }
if (mac > MAC_BUDGET || mem > MEM_BUDGET) shrink_or_quantize();
```

先算 MAC/内存预算，超预算先降规模或量化



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 预算模型：预设逐层耗时与截止期



以下输入数字为教学预设，只验证预算求和。实际逐层耗时必须由对应推理运行时测得，再用整体延迟验证调度与 IO 开销：



host\_latency.cC

 

```text
/* host_latency.c —— 推理延迟预算：逐层耗时求和与截止期判定（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_latency.c -o host_latency && ./host_latency
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int layers_us[] = {50, 180, 300, 120, 40};   /* 教学预设值，不是设备推理测量 */
    int n = (int)(sizeof(layers_us)/sizeof(layers_us[0]));
    int total = 0; for (int i = 0; i < n; i++) total += layers_us[i];
    int deadline = 800;
    printf("预设层耗时预算=%dus 截止期=%dus → %s\n", total, deadline, total <= deadline ? "满足" : "超期");
    if (total != 690) ok = 0;
    if (!(total <= deadline)) ok = 0;
    printf("最重层占 %.0f%%（优化优先它）\n", 300.0*100/total);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

预设数字的求和模型（未执行实际模型推理）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_latency.c -o labs/host_latency && ./labs/host_latency
预设层耗时预算=690us 截止期=800us → 满足
最重层占 43%（优化优先它）
RESULT: PASS
```



逐层和 690µs ≤ 截止期 800µs；最重层占 43%——优化的优先级由它决定。



表 1.2 预算指标与判定



| 量 | 含义 | 判定 |
| --- | --- | --- |
| 总延迟 | 逐层求和 | ≤ 截止期 |
| 最重层 | 占比最高 | 优先优化 |
| 峰值内存 | 同时存活张量 \+ 工作区 \+ 运行时开销 | 在预算内 |
| MAC/s | 算力 | 够不够 |



```zhizhan-anchor
m01-loop
```



```zhizhan-anchor
m01-loop-t
```



## 1.3 预算闭环



先量化约束再设计模型，避免“训好却部署不了”。常用手段：量化、剪枝、算子融合、换更小骨干网。



budget.c 节选C

 

```text
uint32_t total = 0;
for (int i=0;i<nlayers;i++) total += layers[i].us;
if (total > deadline_us) shrink_or_quantize();   // 超预算先降规模/量化
/* 找出占比最大的层，优先优化它 */
```

预算闭环：先算总量；超截止期先降规模/量化



表 1.3 超预算的应对



| 超预算时 | 手段 | 代价 |
| --- | --- | --- |
| 降规模 | 更小骨干网 | 精度下降 |
| 量化 | int8 | 精度/实现 |
| 剪枝 | 去冗余 | 稀疏支持 |
| 加速 | DSP/NPU | 可移植性 |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检与三级对照



预算自检：算力/内存/延迟/功耗都有量、都有预算线。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  延迟预算的构成（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="延迟预算的构成（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">最重层</text><rect x="150" y="26" width="258" height="18" rx="4" class="sv-red-s"></rect><text x="416" y="43" class="sv-lbl-hi">43%</text><text x="12" y="67" class="sv-lbl">其余层</text><rect x="150" y="50" width="342" height="18" rx="4" class="sv-cyn-s"></rect><text x="500" y="67" class="sv-lbl-hi">57%</text><text x="12" y="91" class="sv-lbl">截止期余量</text><rect x="150" y="74" width="84" height="18" rx="4" class="sv-grn-s"></rect><text x="242" y="91" class="sv-lbl-hi">14%</text></svg>
```



总延迟 = Σ各层；最重层是优化重点。示例总 690µs、截止期 800µs、余量约 14%。



表 1.4 端/边/云算力



| 层级 | 算力 | 典型模型 |
| --- | --- | --- |
| MCU 端 | 几十–几百 MOPS | TinyML 关键词/异常 |
| Linux 边缘 | GOPS 级 | 视觉/语音 |
| 云/训练 | TFLOPS | 训练与重训 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **先训后想** ：模型太大塞不进。

- **只看参数量不看 MAC** ：某些层极贵。

- **忽略峰值内存** ：推理中途 OOM。

- **忽略功耗** ：电池设备撑不住。



◆ 自测 · Module 01（先答再看）




1. 为什么端侧 AI 要先算预算？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"算力/内存/延迟/功耗是不可协商的物理约束。先量化约束再设计模型，避免“训好却部署不了”。"}
   ```

2. 为什么优化要先找“最重层”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"延迟由少数关键层主导。示例中最重层占 43%，先优化它收益最大；盲目优化别处收益低。"}
   ```

3. 为什么“只看参数量”会误判成本？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"参数量不等于计算量：某些层（如大卷积/全连接）即使参数不多，MAC 数与访存也可能极贵。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你目标模型逐层估 MAC/内存/延迟，写成一张预算表并标出最重层。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_latency.c `：逐层耗时求和并与截止期比较，找出最重层。



**检查结果：** 预设耗时的预算总和 690µs ≤ 截止期 800µs；逐层和与总延迟一致；最重层占比 43%。

 

迁移练习：把本章的“能为目标模型算出 MAC 数、峰值内存与延迟截止期，并据此选定模型规模。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m01","criterion":"预设耗时的预算总和 690µs ≤ 截止期 800µs；逐层和与总延迟一致；最重层占比 43%。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
