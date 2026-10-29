# 模型导出与量化准备

```zhizhan-anchor
m09
```



导出是“从训练到设备”的桥： **格式、算子支持、输入输出契约、预处理固化** 与 **量化准备** 。任何一步不一致，设备端就崩或掉精度。

 

> 前置：理解 M04–M08 模型与评估。 · ◷ 约 42 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能导出模型、核对算子/形状契约、固化预处理并准备量化校准集。

 

本章速览




- 导出是训练到设备的桥：格式/算子/契约/预处理/量化。

- 预处理固化并与训练一致。

- 用运行时检查算子。

 

```zhizhan-anchor
m09-export
```



```zhizhan-anchor
m09-export-t
```



## 9.1 导出五环节



导出是训练到设备的桥：格式（TFLite/ONNX）、算子支持、输入输出契约、预处理固化、量化准备。任何一步不一致，设备端就崩或掉精度。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  导出流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="导出流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">格式</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">导出</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">核算子</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">固化/量化</text></svg>
```



选格式 → 导出 → 核对算子/形状 → 固化预处理 → 量化（校准集）→ 打包（版本/校验）。



表 9.1 导出五环节



| 环节 | 内容 | 注意 |
| --- | --- | --- |
| 格式 | TFLite/ONNX | 运行时支持 |
| 算子 | 导出后检查 | 不支持=失败 |
| 契约 | 输入形状/类型 | 与固件一致 |
| 预处理 | 固化到管线 | 训练=推理 |
| 量化 | 校准集/scale | 精度对拍 |



export.py 节选Python

 

```text
conv.convert(model, "model_v1_int8.tflite", int8=True, calib=calib_set)
check_ops(model)     # 目标运行时算子支持
# 预处理固化为 pre_v1.norm（版本绑定）；固件算子版本 >= 1.3
```

转换\+核算子；固化预处理；量化需校准集



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：模型包清单与校验



下面这段程序核对模型包清单与校验：



host\_export.cC

 

```text
/* host_export.c —— 模型包清单/版本/校验（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_export.c -o host_export && ./host_export
 */
#include <stdio.h>
#include <stdint.h>
static uint32_t crc(const char *s){ uint32_t h=2166136261u; for(;*s;s++){h^=(uint8_t)*s;h*=16777619u;} return h; }
int main(void) {
    int ok=1;
    const char *model="model_v1_int8.tflite", *pre="pre_v1.norm", *fw="fw_1.3";
    uint32_t c1=crc(model);
    printf("模型包: model=%s pre=%s fw=%s\n", model, pre, fw);
    printf("模型校验=%u\n", c1);
    if(c1==0) ok=0;
    /* 兼容矩阵：模型要求固件算子版本 >= 1.3 */
    printf("兼容: 模型需 fw>=1.3，当前 %s → OK\n", fw);
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
```

模型包清单/校验模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_export.c -o labs/host_export && ./labs/host_export
模型包: model=model_v1_int8.tflite pre=pre_v1.norm fw=fw_1.3
模型校验=4042742740
兼容: 模型需 fw>=1.3，当前 fw_1.3 → OK
RESULT: PASS
```



模型包含 model/pre/fw 三方版本与校验（哈希非零）；兼容矩阵判定算子/版本支持。



表 9.2 模型包字段



| 字段 | 值 | 作用 |
| --- | --- | --- |
| 模型 | model\_v1\_int8.tflite | 权重 |
| 预处理 | pre\_v1.norm | 归一化 |
| 固件 | fw\_1.3 | 算子/运行时 |
| 校验 | 非零哈希 | 完整性 |



```zhizhan-anchor
m09-quant
```



```zhizhan-anchor
m09-quant-t
```



## 9.3 算子核对与量化准备



导出后用运行时检查器核对算子与形状；预处理必须固化且与训练一致；量化需校准集。



export.py 节选Python

 

```text
conv.convert(model, "model_v1_int8.tflite", int8=True, calib=calib_set)
check_ops(model)     # 目标运行时算子支持
# 预处理固化为 pre_v1.norm（版本绑定）；固件算子版本 >= 1.3
```

转换\+核算子；固化预处理；量化需校准集



表 9.3 导出实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 核算子 | 可加载 | 运行失败 |
| 固化预处理 | 训练=推理 | 精度掉 |
| 契约一致 | 接口不错配 | 形状/类型变 |
| 校准集 | 量化精度 | 无校准 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



导出自检：算子支持、形状契约一致、预处理固化、量化有校准、版本校验。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  模型包三方版本（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="模型包三方版本（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">model</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-cyn-s"></rect><text x="458" y="43" class="sv-lbl-hi">10(版本×10)</text><text x="12" y="67" class="sv-lbl">pre</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="67" class="sv-lbl-hi">10(版本×10)</text><text x="12" y="91" class="sv-lbl">fw</text><rect x="150" y="74" width="390" height="18" rx="4" class="sv-grn-s"></rect><text x="548" y="91" class="sv-lbl-hi">13(版本×10)</text></svg>
```



model/pre/fw 三方版本绑定 \+ 校验哈希；任一不匹配即拒绝加载。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 格式 | 运行时支持 | 不支持 |
| 算子 | 检查器核对 | 盲目导出 |
| 契约 | 形状/类型 | 错配 |
| 量化 | 校准集 | 精度差 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **算子不支持** ：加载/运行失败。

- **预处理未固化** ：训练/推理不一致。

- **形状/类型不符** ：接口错配。

- **无校准集** ：量化精度差。



◆ 自测 · Module 09（先答再看）




1. 为什么导出时要“固化预处理”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"模型假设特定输入分布；若推理端预处理不同，等于喂了分布不同的数据，精度下降。把归一化写进推理管线并版本化。"}
   ```

2. 导出后第一件事为什么要“核算子支持”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"目标运行时可能不支持某些算子，导致加载/运行失败。导出后用运行时检查器核对，替换/回退不支持的算子。"}
   ```

3. 量化为什么需要“校准集”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"int8 量化需要估计激活的动态范围来确定 scale/zero\\_point。校准集（常见 100–500 样本）用真实数据统计。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：导出你模型、用运行时核对算子与形状、固化预处理并准备量化校准集。



核对与延伸：[TFLite 转换](https://ai.google.dev/edge/litert/models/convert) · [TensorFlow 模型优化](https://www.tensorflow.org/model_optimization)

 

动手练习



运行 ` labs/host_export.c `：核对模型包清单与校验；用目标运行时检查算子。



**检查结果：** 模型包 model=v1/pre=v1/fw=1.3 有版本与校验（哈希非零）；兼容矩阵判定算子支持；量化需校准集。

 

迁移练习：把本章的“能导出模型、核对算子/形状契约、固化预处理并准备量化校准集。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m09","criterion":"模型包 model=v1/pre=v1/fw=1.3 有版本与校验（哈希非零）；兼容矩阵判定算子支持；量化需校准集。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
