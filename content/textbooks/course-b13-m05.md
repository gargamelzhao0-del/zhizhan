# 量化

```zhizhan-anchor
m05
```



量化把 float 权重/激活压成 int8，可能减少存储或提高吞吐；实际速度、大小与精度须同条件测量，转换/量化开销可能使小模型变慢。核心是  **scale**  与  **zero-point** 。

 

> 前置：Module 04 的训练与切分。 · ◷ 约 44 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能选定 scale 与 zero-point 完成 int8 量化，并在独立测试集上对拍精度。

 

本章速览




- 量化核心是 scale 与 zero-point，误差 ≤ scale/2。

- per-channel 精度更好；裁剪到 int8 范围。

- 在独立测试集评估量化前后指标。

 

```zhizhan-anchor
m05-quant
```



```zhizhan-anchor
m05-quant-t
```



## 5.1 scale 与 zero-point



量化用  **scale** （步长）与  **zero-point** （零点）把 float 映射到 int8。对称量化 zp=0、非对称更贴合范围；per-channel 比 per-tensor 精度更好。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  float → int8 → float



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="float → int8 → float" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">x (float)</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">q (int8)</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">裁剪</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">x' (反量化)</text></svg>
```



x → q=round(x/scale)\+zp（裁剪到 \[-128,127\]）→ x'=scale·(q-zp)。量化误差 ≤ scale/2（范围内）。



表 5.1 量化方案



| 方案 | 特点 | 注意 |
| --- | --- | --- |
| 对称 | zp=0，简单 | 适合权重 |
| 非对称 | 范围更贴合 | 激活常用 |
| per-tensor | 一组参数 | 简单 |
| per-channel | 每通道一组 | 可能减少误差，检查后端支持 |
| QAT | 训练中模拟量化 | 可能改善量化精度，须与 PTQ 实测比较 |



quant.c 节选C

 

```text
int8_t q = clamp_int8(roundf(x / scale) + zp);   // 量化+裁剪
float xr = scale * (q - zp);                       // 反量化
// 范围内 |xr-x| <= scale/2；越界被裁剪
```

先计算 round(x/scale)\+zp 再裁剪；未裁剪且按最近值舍入时，理想量化误差≤scale/2



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：误差上界与裁剪



下面这段程序量化/反量化并验证误差上界与越界裁剪：



host\_quant.cC

 

```text
/* host_quant.c —— int8 量化/反量化、误差上界与越界裁剪（主机可运行）。
 * 量化：q = clamp(round(x/scale) + zero_point, -128, 127)，反量化 x' = (q - zero_point)*scale。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_quant.c -o host_quant && ./host_quant
 */
#include <stdio.h>
#include <math.h>
static int clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }
int main(void) {
    int ok = 1;
    float scale = 0.02f; int zp = 0;
    /* 含网格外的值（产生非零误差）与超出可表示范围的值（触发裁剪） */
    float xs[] = {0.0f, 0.5f, -0.5f, 1.0f, -1.0f, 0.011f, 3.0f, -3.0f};
    float maxerr_in = 0.0f;
    int clamped = 0;
    for (unsigned i = 0; i < sizeof(xs)/sizeof(xs[0]); i++) {
        int raw = (int)lroundf(xs[i]/scale) + zp;
        int q = clamp(raw, -128, 127);
        int in_range = (raw >= -128 && raw <= 127);
        if (!in_range) clamped++;
        float xr = (q - zp) * scale;
        float e = fabsf(xr - xs[i]);
        if (in_range && e > maxerr_in) maxerr_in = e;
        printf("x=%+.3f q=%4d%s x'=%+.3f err=%.4f\n", xs[i], q, in_range ? "   " : " clamp", xr, e);
    }
    printf("范围内最大误差=%.4f（≤ scale/2=%.3f）；被裁剪样本数=%d（期望 2）\n",
           maxerr_in, scale/2, clamped);
    if (maxerr_in > scale/2 + 1e-6) ok = 0;
    if (clamped != 2) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

int8 量化模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_quant.c -o labs/host_quant && ./labs/host_quant
x=+0.011 q=   1    x'=+0.020 err=0.0090
x=+3.000 q= 127 clamp x'=+2.540 err=0.4600
x=-3.000 q=-128 clamp x'=-2.560 err=0.4400
范围内最大误差=0.0090（≤ scale/2=0.010）；被裁剪样本数=2（期望 2）
RESULT: PASS
```



scale=0.02 时范围内误差 ≤ scale/2=0.010；越界样本被裁剪到 \[-128,127\]（本例 2 例）。



表 5.2 量化关键数值



| 量 | 值 | 说明 |
| --- | --- | --- |
| scale | 0.02 | 步长 |
| zero-point | 0 | 对称 |
| 范围误差 | ≤0.010 | scale/2 |
| 裁剪 | 2 例 | 越界样本 |



```zhizhan-anchor
m05-eval
```



```zhizhan-anchor
m05-eval-t
```



## 5.3 独立测试集对拍



权重误差小不代表端到端指标不退化（误差会层间累积）。务必在 **独立测试集** 上比较量化前后的业务指标。



quant\_eval.py 节选Python

 

```text
sc = calibrate(train_loader)          # 校准求 scale
qmodel = quantize(model, sc, per_channel=True)
print("float F1", f1(model, test))
print("int8  F1", f1(qmodel, test))    # 独立测试集对拍
```

校准求 scale \+ 独立测试集对拍端到端指标



表 5.3 量化评估清单



| 检查 | 方法 | 通过标准 |
| --- | --- | --- |
| 范围误差 | ≤ scale/2 | 范围内 |
| 裁剪数 | 越界样本 | 记录并可控 |
| 端到端指标 | 独立测试集 | 回退≤阈值 |
| 体积/速度 | 对拍 | 收益符合预期 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与三级对照



量化自检：scale 合理、误差可控、端到端指标在独立集上可接受。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  量化前后体积/精度（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="量化前后体积/精度（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">float 体积</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-amb-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(相对)</text><text x="12" y="67" class="sv-lbl">int8 体积</text><rect x="150" y="50" width="136" height="18" rx="4" class="sv-grn-s"></rect><text x="294" y="67" class="sv-lbl-hi">25(相对)</text></svg>
```



int8 体积约 1/4、速度提升；代价是精度（示例 F1 略降）。要在独立测试集上确认可接受。



表 5.4 三级量化



| 层级 | 量化 | 注意 |
| --- | --- | --- |
| MCU 端 | int8 必备 | 算子支持 |
| Linux 边缘 | int8/fp16 | 加速器约束 |
| 云/训练 | QAT/PTQ | 精度优先 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **scale 选错** ：动态范围被压缩，精度掉。

- **不裁剪** ：溢出/环绕。

- **per-tensor 用于分布差异大的通道** ：精度损失大。

- **只看权重误差** ：忽略端到端指标。



◆ 自测 · Module 05（先答再看）




1. 为什么量化后一定要在独立测试集上评估指标？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"权重误差小不代表端到端任务指标不退化（误差会在层间累积/放大）。必须用独立测试集比较量化前后的业务指标。"}
   ```

2. 范围内量化误差的上界是多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"≤ scale/2。示例 scale=0.02 时最大误差 0.010（实测 0.0090）。"}
   ```

3. 为什么必须把越界值裁剪到 int8 范围？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不裁剪会溢出/环绕，产生荒谬结果。裁剪（clamp）到 \\[-128,127\\] 保证有界，越界样本数量要记录并可控。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你模型做一次 int8 量化，记录 scale/zp、范围内误差与裁剪数，并在独立测试集上对拍 F1。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [ONNX Runtime](https://onnxruntime.ai/docs/)

 

动手练习



运行 ` labs/host_quant.c `：验证 int8 量化/反量化与误差上界。



**检查结果：** 范围内反量化最大误差 ≤ scale/2（scale=0.02 时 0.010）；越界样本被裁剪到 \[-128,127\]（本例 2 例）。

 

迁移练习：把本章的“能选定 scale 与 zero-point 完成 int8 量化，并在独立测试集上对拍精度。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m05","criterion":"范围内反量化最大误差 ≤ scale/2（scale=0.02 时 0.010）；越界样本被裁剪到 [-128,127]（本例 2 例）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
